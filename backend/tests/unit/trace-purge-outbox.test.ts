/**
 * Unit — the durable trace-purge queue (`DB §5.4`, `M-19` Phase 3).
 *
 * The in-memory queue's tests (`trace-purge.test.ts`) cover the four-step
 * contract. These cover the properties that only the *durable* one can have,
 * and that the in-memory one silently lacked.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createTracePurgeOutbox } from "../../src/db/trace-purge-outbox.js";
import type { OutboxStore } from "../../src/db/trace-purge-outbox.js";

interface Row {
  purgeId: string;
  analysisIds: string[];
  userId: string | null;
  correlationId: string | null;
  attempts: number;
  enqueuedAt: Date;
  failedAt: Date | null;
}

/** A store backed by an array, exercising the real query shapes. */
function memoryStore(): OutboxStore & { rows: Row[] } {
  const rows: Row[] = [];
  let next = 0;

  return {
    rows,
    tracePurgeOutbox: {
      create: (args) => {
        next += 1;
        rows.push({
          purgeId: `p${String(next)}`,
          analysisIds: [...args.data.analysisIds],
          userId: args.data.userId,
          correlationId: args.data.correlationId,
          attempts: 0,
          enqueuedAt: new Date(next),
          failedAt: null,
        });
        return Promise.resolve(undefined);
      },
      findMany: (args) =>
        Promise.resolve(
          rows
            .filter((row) => row.failedAt === null)
            .sort((a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime())
            .slice(0, args.take),
        ),
      delete: (args) => {
        const index = rows.findIndex(
          (row) => row.purgeId === args.where.purgeId,
        );
        if (index >= 0) rows.splice(index, 1);
        return Promise.resolve(undefined);
      },
      update: (args) => {
        const row = rows.find((r) => r.purgeId === args.where.purgeId);
        if (row !== undefined) {
          if (args.data.attempts !== undefined)
            row.attempts = args.data.attempts;
          if (args.data.failedAt !== undefined)
            row.failedAt = args.data.failedAt;
        }
        return Promise.resolve(undefined);
      },
      count: () =>
        Promise.resolve(rows.filter((row) => row.failedAt === null).length),
    },
  };
}

interface HarnessOptions {
  readonly failTimes?: number;
  readonly maxAttempts?: number;
}

function harness(options: HarnessOptions = {}) {
  const store = memoryStore();
  const deleted: string[][] = [];
  const events: { eventType: string; outcome: string }[] = [];
  let failures = options.failTimes ?? 0;

  const queue = createTracePurgeOutbox({
    store,
    client: {
      stageTrace: {
        deleteMany: (args) => {
          if (failures > 0) {
            failures -= 1;
            return Promise.reject(new Error("trace store unavailable"));
          }
          deleted.push([...args.where.analysisId.in]);
          return Promise.resolve({ count: args.where.analysisId.in.length });
        },
      },
    },
    audit: {
      record: (event) => {
        events.push({ eventType: event.eventType, outcome: event.outcome });
        return Promise.resolve();
      },
    },
    ...(options.maxAttempts !== undefined
      ? { maxAttempts: options.maxAttempts }
      : {}),
    onError: () => undefined,
  });

  return { queue, store, deleted, events };
}

test("an enqueued instruction survives as a row, not as process memory", async () => {
  // ⚠️ THE WHOLE POINT OF PHASE 3. The in-memory queue held this in an array,
  // so a restart between the deletion and the drain lost it silently — bounded
  // only by `DB §8.3`'s 7-day trace expiry.
  const { queue, store } = harness();

  await queue.enqueue({
    analysisIds: ["a", "b"],
    userId: "user-1",
    correlationId: "corr-1",
  });

  assert.equal(store.rows.length, 1);
  assert.deepEqual(store.rows[0]?.analysisIds, ["a", "b"]);
  assert.equal(await queue.pending(), 1);
});

test("enqueue writes through a supplied transaction, not the queue's own store", async () => {
  // ⚠️ THIS IS THE DURABILITY GUARANTEE, AND IT IS EASY TO LOSE. If `enqueue`
  // ignored `tx` and wrote through its own client, the instruction would
  // commit in a *separate* transaction from the deletion — reopening the exact
  // window the outbox exists to close. A test that only checked "a row
  // appears" would pass either way, so this asserts which client received it.
  const { queue, store } = harness();
  const other = memoryStore();

  await queue.enqueue(
    { analysisIds: ["a"], userId: "u", correlationId: null },
    other,
  );

  assert.equal(
    store.rows.length,
    0,
    "the instruction bypassed the supplied transaction",
  );
  assert.equal(other.rows.length, 1);
});

test("a drained instruction deletes traces, audits, and removes its row", async () => {
  const { queue, store, deleted, events } = harness();
  await queue.enqueue({
    analysisIds: ["a"],
    userId: "u",
    correlationId: null,
  });

  const result = await queue.drain();

  assert.deepEqual(deleted, [["a"]]);
  assert.equal(result.purged, 1);
  assert.equal(store.rows.length, 0);
  assert.deepEqual(events, [{ eventType: "trace.purged", outcome: "success" }]);
});

test("a failure keeps the row and counts the attempt", async () => {
  const { queue, store } = harness({ failTimes: 1 });
  await queue.enqueue({ analysisIds: ["a"], userId: "u", correlationId: null });

  const first = await queue.drain();
  assert.equal(first.purged, 0);
  assert.equal(store.rows.length, 1, "the instruction was dropped on failure");
  assert.equal(store.rows[0]?.attempts, 1);

  const second = await queue.drain();
  assert.equal(second.purged, 1);
  assert.equal(store.rows.length, 0);
});

test("⚠️ an exhausted instruction is MARKED failed, never deleted", async () => {
  // The row records a purge the user was told would happen and which did not.
  // Deleting it would destroy the only evidence that anything is still owed —
  // and `pending()` would then report a clean queue.
  const { queue, store, events } = harness({ failTimes: 99, maxAttempts: 2 });
  await queue.enqueue({ analysisIds: ["a"], userId: "u", correlationId: null });

  await queue.drain();
  const final = await queue.drain();

  assert.equal(final.failed, 1);
  assert.equal(store.rows.length, 1, "the evidence was deleted");
  assert.ok(store.rows[0]?.failedAt instanceof Date);
  // Out of the drain's view, but not out of an operator's.
  assert.equal(await queue.pending(), 0);
  assert.deepEqual(events, [
    { eventType: "trace.purge_failed", outcome: "failed" },
  ]);
});

test("an empty instruction is not written at all", async () => {
  // The migration's CHECK would reject it; refusing here keeps a bulk delete
  // of zero analyses from failing a transaction it has no business failing.
  const { queue, store } = harness();
  await queue.enqueue({ analysisIds: [], userId: "u", correlationId: null });
  assert.equal(store.rows.length, 0);
});

test("overlapping drains do not process the same row twice", async () => {
  // `drain` runs on a timer and again at shutdown. Without the re-entrancy
  // guard a slow pass still running when the timer fires would select the same
  // rows, double-count attempts and double-audit a completion.
  const { queue, deleted, events } = harness();
  await queue.enqueue({ analysisIds: ["a"], userId: "u", correlationId: null });

  const [first, second] = await Promise.all([queue.drain(), queue.drain()]);

  assert.equal(first.purged + second.purged, 1, "the row was purged twice");
  assert.deepEqual(deleted, [["a"]]);
  assert.equal(events.length, 1);
});
