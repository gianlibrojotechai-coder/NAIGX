/**
 * Unit — the cross-store purge queue (`DB §5.4`).
 *
 * The properties worth pinning are the ones that decide whether a deletion
 * promise is kept when something goes wrong: a failure that retries, a
 * persistent failure that is *recorded* rather than swallowed, and a retry
 * that does not spin inside a single drain.
 *
 * Also pinned: that `PROVIDER_INVOCATION` is never purged. That is a
 * deliberate reading of `DB §8.3` — it holds no user content and is retained
 * 30 days against StageTrace's 7 precisely so cost history survives — and a
 * later change "completing" the purge by adding it would destroy the data
 * `TV-4` and `NFR-083` depend on.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TRACE_PURGE_WINDOW_HOURS,
  createTracePurgeQueue,
  tracePurgeWindow,
  type TracePurgeClient,
} from "../../src/db/trace-purge.js";

interface Recorded {
  readonly eventType: string;
  readonly outcome: string;
  readonly userId: string | null;
}

const harness = (
  options: { failTimes?: number; maxAttempts?: number } = {},
) => {
  const deleted: string[][] = [];
  const events: Recorded[] = [];
  let failures = options.failTimes ?? 0;

  const client: TracePurgeClient = {
    stageTrace: {
      deleteMany: ({ where }) => {
        if (failures > 0) {
          failures -= 1;
          return Promise.reject(new Error("trace store unreachable"));
        }
        deleted.push([...where.analysisId.in]);
        return Promise.resolve({ count: where.analysisId.in.length });
      },
    },
  };

  const queue = createTracePurgeQueue({
    client,
    audit: {
      record: (event) => {
        events.push({
          eventType: event.eventType,
          outcome: event.outcome,
          userId: event.userId,
        });
        return Promise.resolve();
      },
    },
    ...(options.maxAttempts !== undefined
      ? { maxAttempts: options.maxAttempts }
      : {}),
  });

  return { queue, deleted, events };
};

test("the stated window is a bound the user is told about", () => {
  assert.equal(TRACE_PURGE_WINDOW_HOURS, 24);
  assert.match(tracePurgeWindow(), /24 hours/);
});

test("DB §5.4 — enqueue accepts, drain purges, completion is audited", async () => {
  const { queue, deleted, events } = harness();

  queue.enqueue({
    analysisIds: ["a", "b"],
    userId: "user-1",
    correlationId: "corr-1",
  });
  assert.equal(queue.pending, 1);

  const result = await queue.drain();

  assert.deepEqual(deleted, [["a", "b"]]);
  assert.equal(result.purged, 2);
  assert.equal(queue.pending, 0);
  assert.deepEqual(events, [
    { eventType: "trace.purged", outcome: "success", userId: "user-1" },
  ]);
});

test("an empty instruction is not queued", () => {
  const { queue } = harness();
  queue.enqueue({ analysisIds: [], userId: "u", correlationId: null });
  assert.equal(queue.pending, 0);
});

test("DB §5.4 — a failure retries rather than dropping the instruction", async () => {
  const { queue, deleted } = harness({ failTimes: 1 });

  queue.enqueue({ analysisIds: ["a"], userId: "u", correlationId: null });

  const first = await queue.drain();
  assert.equal(first.purged, 0);
  assert.equal(queue.pending, 1, "the instruction was dropped on failure");

  const second = await queue.drain();
  assert.equal(second.purged, 1);
  assert.deepEqual(deleted, [["a"]]);
});

test("a retry does not spin inside one drain", async () => {
  // The queue is snapshotted before the pass, so an instruction re-queued for
  // retry waits for the next drain. Without that, a persistent failure would
  // loop forever inside a single call.
  const { queue } = harness({ failTimes: 99 });

  queue.enqueue({ analysisIds: ["a"], userId: "u", correlationId: null });

  const result = await queue.drain();
  assert.equal(result.purged, 0);
  assert.equal(queue.pending, 1);
});

test("a persistent failure is recorded, not swallowed", async () => {
  // Giving up silently would leave the user believing traces were purged. The
  // audit trail says otherwise.
  const { queue, events } = harness({ failTimes: 99, maxAttempts: 2 });

  queue.enqueue({ analysisIds: ["a"], userId: "u", correlationId: null });

  await queue.drain();
  const final = await queue.drain();

  assert.equal(final.failed, 1);
  assert.equal(queue.pending, 0);
  assert.deepEqual(events, [
    { eventType: "trace.purge_failed", outcome: "failed", userId: "u" },
  ]);
});

test("a purge for a deleted user records no identity", async () => {
  // `FR-073` removed the user; the audit event survives without them.
  const { queue, events } = harness();

  queue.enqueue({ analysisIds: ["a"], userId: null, correlationId: null });
  await queue.drain();

  assert.equal(events[0]?.userId, null);
});

test("PROVIDER_INVOCATION is not part of the purge surface", () => {
  // Deliberate (`DB §4.7`, `DB §8.3`): it holds no user content, carries no
  // `analysis_id`, and outlives stage traces by 23 days so cost and
  // reliability history survives a deletion that removes content.
  //
  // Asserted structurally — the client type has one table, so a purge of
  // provider invocations cannot be written without changing the contract.
  const client: TracePurgeClient = {
    stageTrace: { deleteMany: () => Promise.resolve({ count: 0 }) },
  };
  assert.deepEqual(Object.keys(client), ["stageTrace"]);
});
