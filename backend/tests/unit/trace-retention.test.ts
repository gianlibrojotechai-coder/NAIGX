/**
 * Unit — tiered trace retention (`DB §8.3`).
 *
 * §8.3 calls tiering "the single most important design property of the trace
 * store". The property under test is not that rows expire, but that the three
 * entities expire on *different* schedules — a uniform sweep would satisfy a
 * naive "traces expire" test while destroying the design.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TRACE_RETENTION_DAYS,
  purgeExpiredTraces,
  retentionCutoff,
  type TracePurgeClient,
} from "../../src/db/trace-retention.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-13T12:00:00.000Z");

test("retention periods are the v1 policy values of DB §8.3", () => {
  assert.equal(TRACE_RETENTION_DAYS.stageTrace, 7);
  assert.equal(TRACE_RETENTION_DAYS.providerInvocation, 30);
  assert.equal(TRACE_RETENTION_DAYS.validationEvent, 30);
});

test("the content-bearing tier is strictly shorter than the metric tiers", () => {
  // The reason the trace store is three entities rather than one document:
  // a monolithic record would force everything onto the most restrictive
  // schedule, discarding cost and quality history that carries no privacy cost.
  assert.ok(
    TRACE_RETENTION_DAYS.stageTrace < TRACE_RETENTION_DAYS.providerInvocation &&
      TRACE_RETENTION_DAYS.stageTrace < TRACE_RETENTION_DAYS.validationEvent,
    "StageTrace holds user business content and must expire first",
  );
});

test("cutoffs are computed from the supplied instant, not the wall clock", () => {
  assert.deepEqual(
    retentionCutoff("stageTrace", NOW),
    new Date(NOW.getTime() - 7 * MS_PER_DAY),
  );
  assert.deepEqual(
    retentionCutoff("providerInvocation", NOW),
    new Date(NOW.getTime() - 30 * MS_PER_DAY),
  );
  assert.deepEqual(
    retentionCutoff("validationEvent", NOW),
    new Date(NOW.getTime() - 30 * MS_PER_DAY),
  );
});

interface RecordedCall {
  readonly entity: string;
  readonly cutoff: Date;
}

const recordingClient = (
  calls: RecordedCall[],
  counts: {
    stageTrace: number;
    providerInvocation: number;
    validationEvent: number;
  },
): TracePurgeClient => ({
  stageTrace: {
    deleteMany: async ({ where }) => {
      calls.push({ entity: "stageTrace", cutoff: where.startedAt.lt });
      return { count: counts.stageTrace };
    },
  },
  providerInvocation: {
    deleteMany: async ({ where }) => {
      calls.push({ entity: "providerInvocation", cutoff: where.recordedAt.lt });
      return { count: counts.providerInvocation };
    },
  },
  validationEvent: {
    deleteMany: async ({ where }) => {
      calls.push({ entity: "validationEvent", cutoff: where.recordedAt.lt });
      return { count: counts.validationEvent };
    },
  },
});

test("each entity is swept against its own cutoff, not a shared one", async () => {
  const calls: RecordedCall[] = [];
  const result = await purgeExpiredTraces(
    recordingClient(calls, {
      stageTrace: 3,
      providerInvocation: 5,
      validationEvent: 7,
    }),
    NOW,
  );

  assert.equal(calls.length, 3, "every tier is swept");

  const cutoffs = new Map(calls.map((c) => [c.entity, c.cutoff.getTime()]));
  assert.equal(
    cutoffs.get("stageTrace"),
    NOW.getTime() - 7 * MS_PER_DAY,
    "StageTrace swept at 7 days",
  );
  assert.equal(
    cutoffs.get("providerInvocation"),
    NOW.getTime() - 30 * MS_PER_DAY,
    "ProviderInvocation swept at 30 days",
  );
  assert.notEqual(
    cutoffs.get("stageTrace"),
    cutoffs.get("providerInvocation"),
    "tiers must not collapse onto one cutoff",
  );

  assert.deepEqual(result, {
    stageTrace: 3,
    providerInvocation: 5,
    validationEvent: 7,
  });
});

test("user business content is purged before the metric tiers", async () => {
  // If a later delete fails, the content is already gone rather than waiting
  // behind a failed sweep.
  const calls: RecordedCall[] = [];
  await purgeExpiredTraces(
    recordingClient(calls, {
      stageTrace: 0,
      providerInvocation: 0,
      validationEvent: 0,
    }),
    NOW,
  );
  assert.equal(calls[0]?.entity, "stageTrace");
});

test("a row exactly at its boundary is retained; one instant older is not", async () => {
  const calls: RecordedCall[] = [];
  await purgeExpiredTraces(
    recordingClient(calls, {
      stageTrace: 0,
      providerInvocation: 0,
      validationEvent: 0,
    }),
    NOW,
  );
  const cutoff = calls.find((c) => c.entity === "stageTrace")?.cutoff;
  assert.ok(cutoff);
  // The sweep uses `lt`, so a row written exactly at the cutoff survives.
  const atBoundary = new Date(cutoff.getTime());
  const older = new Date(cutoff.getTime() - 1);
  assert.ok(!(atBoundary < cutoff), "row at the boundary is retained");
  assert.ok(older < cutoff, "row one millisecond older is expired");
});
