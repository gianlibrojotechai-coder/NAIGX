/**
 * Integration — the analysis job lifecycle (`SA §3.3`, `FR-091`, `FR-094`).
 *
 * Exercises the orchestrator against a fake store and an injected
 * `runPipeline`, so the lifecycle is tested without a database, a provider, a
 * credential or a network. Every run here is replay-mode and costs nothing.
 *
 * The behaviour that matters most is the last one: **a queued analysis never
 * stays queued.** Whatever happens — success, halt, degradation, a thrown
 * stage, or no input at all — the row reaches a terminal state, because an
 * analysis stuck at `queued` is indistinguishable from one nobody submitted.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createAnalysisExecutor } from "../../src/orchestrator/execute-analysis.js";
import { createTestCipher } from "../helpers/cipher.js";
import type { PipelineResult } from "../../src/nie/contracts.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

// A real cipher — see tests/helpers/cipher.ts. Not a pass-through: these
// suites must exercise the seal/open round trip, not skip past it.
const testCipher = await createTestCipher();

const ANALYSIS_ID = "22222222-2222-4222-8222-222222222222";
const INPUT = "A job posting long enough to be worth reasoning about.";

interface Row {
  status: string;
  completedAt: Date | null;
  degradationFlag: boolean;
}

/** A store just real enough to model the claim and the terminal write. */
const fakeStore = (initial: Partial<Row> = {}, rawContent = INPUT) => {
  const row: Row = {
    status: "queued",
    completedAt: null,
    degradationFlag: false,
    ...initial,
  };
  const updates: Partial<Row>[] = [];

  const prisma = {
    analysis: {
      updateMany: ({
        where,
        data,
      }: {
        where: { status?: string };
        data: Partial<Row>;
      }) => {
        if (where.status !== undefined && row.status !== where.status) {
          return Promise.resolve({ count: 0 });
        }
        Object.assign(row, data);
        updates.push(data);
        return Promise.resolve({ count: 1 });
      },
      findUnique: () =>
        Promise.resolve({
          analysisId: ANALYSIS_ID,
          input: rawContent === "" ? null : { rawContent },
        }),
      update: ({ data }: { data: Partial<Row> }) => {
        Object.assign(row, data);
        updates.push(data);
        return Promise.resolve(row);
      },
    },
  } as unknown as PrismaClient;

  return { prisma, row, updates };
};

const pipelineResult = (
  overrides: Partial<PipelineResult> = {},
): PipelineResult =>
  ({
    classification: { determinedType: "job_description", confidence: 0.9 },
    ...overrides,
  }) as PipelineResult;

const executor = (
  store: ReturnType<typeof fakeStore>,
  runPipeline: () => Promise<PipelineResult>,
) =>
  createAnalysisExecutor({
    cipher: testCipher,
    prisma: store.prisma,
    mode: "replay",
    runPipeline,
    now: () => new Date("2026-09-06T12:00:00.000Z"),
  });

// --- a queued analysis executes ------------------------------------------

test("a queued analysis is claimed, run, and completed", async () => {
  const store = fakeStore();
  let ranWith: unknown;

  const report = await executor(store, (input?: unknown) => {
    ranWith = input;
    return Promise.resolve(pipelineResult());
  }).execute(ANALYSIS_ID);

  assert.equal(report.outcome, "completed");
  assert.equal(report.mode, "replay");
  assert.equal(store.row.status, "completed");
  assert.ok(store.row.completedAt, "a terminal state carries its timestamp");
  // The input carries the lifecycle's cancellation signal (D-65 §7.2), not
  // yet aborted; everything else is exactly the stored analysis.
  const { signal, ...rest } = ranWith as { signal: AbortSignal };
  assert.ok(signal instanceof AbortSignal && !signal.aborted);
  assert.deepEqual(rest, { analysisId: ANALYSIS_ID, text: INPUT });

  // Claimed before it ran: `running` was written first.
  assert.deepEqual(store.updates[0], { status: "running" });
});

// --- FR-094: the deadline CANCELS ------------------------------------------

test("the deadline aborts the pipeline's signal, so no further provider call can start", async () => {
  // ⚠️ THE DEFECT THIS LOCKS OUT (2026-09-09). The deadline used to abandon
  // waiting and let the pipeline settle on its own: a call in flight ran to
  // completion and was billed, a regeneration that had just started did the
  // same, and a valid artifact was written 44 s after the analysis had been
  // reported terminal. `SA §11` says terminate.
  const store = fakeStore();
  let fire: (() => void) | undefined;
  let observed: AbortSignal | undefined;
  let settled = false;

  const report = await createAnalysisExecutor({
    cipher: testCipher,
    prisma: store.prisma,
    mode: "replay",
    timeoutMs: 1_000,
    // The timer is driven by the test, so the deadline fires exactly when
    // the "pipeline" is mid-flight.
    setTimer: (fn) => {
      fire = fn;
      return 0 as never;
    },
    clearTimer: () => undefined,
    runPipeline: (input) => {
      observed = input.signal;
      // A stage in flight: never resolves until the deadline has fired and
      // the executor has moved on, exactly like a slow provider call.
      return new Promise((resolve) => {
        setTimeout(() => {
          settled = true;
          resolve(pipelineResult());
        }, 40);
        // The executor registers its timer only after `runPipeline` has
        // returned this promise, so the deadline is fired on the next tick.
        setTimeout(() => fire?.(), 5);
      });
    },
    now: () => new Date("2026-09-06T12:00:00.000Z"),
  }).execute(ANALYSIS_ID);

  assert.equal(report.outcome, "timed_out");
  assert.equal(store.row.status, "timed_out");
  assert.ok(
    observed instanceof AbortSignal,
    "the pipeline received the signal",
  );
  // Aborted BEFORE the terminal status was written, so nothing downstream can
  // start a paid call between the two.
  assert.equal(observed.aborted, true);
  assert.equal(store.row.degradationFlag, true);

  // The late settlement changes nothing: the row stays terminal as timed_out.
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(settled, true);
  assert.equal(store.row.status, "timed_out");
});

test("a designed halt completes rather than failing", async () => {
  // `AI §5.4`: "the insufficient case is a designed outcome, not an error."
  const store = fakeStore();

  const report = await executor(store, () =>
    Promise.resolve(
      pipelineResult({
        haltedAt: { stageNumber: 3, reason: "Context insufficient" },
      }),
    ),
  ).execute(ANALYSIS_ID);

  assert.equal(report.outcome, "halted");
  assert.equal(store.row.status, "completed", "a halt is not a failure");
  assert.equal(store.row.degradationFlag, false);
});

test("a failed artifact marks the analysis degraded, not failed", async () => {
  // `FR-091` — partial failure yields partial results, honestly labelled. The
  // signal is read from the artifact plan the NIE already produced.
  const store = fakeStore();

  const report = await executor(store, () =>
    Promise.resolve(
      pipelineResult({
        artifactPlan: [
          {
            artifactType: "portfolio_suggestions",
            planned: true,
            depthLevel: "standard",
            inclusionReason: "planned",
            outcome: "failed",
          },
        ],
      }),
    ),
  ).execute(ANALYSIS_ID);

  assert.equal(report.outcome, "degraded");
  assert.equal(store.row.status, "completed");
  assert.equal(store.row.degradationFlag, true);
});

// --- failure never leaves it queued --------------------------------------

test("a thrown pipeline failure reaches a terminal state", async () => {
  const store = fakeStore();
  const seen: unknown[] = [];

  const report = await createAnalysisExecutor({
    cipher: testCipher,
    prisma: store.prisma,
    mode: "replay",
    runPipeline: () => Promise.reject(new Error("Stage 6 failed")),
    onError: (error) => seen.push(error),
  }).execute(ANALYSIS_ID);

  assert.equal(report.outcome, "failed");
  assert.match(report.failureReason ?? "", /Stage 6 failed/);
  assert.equal(store.row.status, "failed");
  assert.ok(store.row.completedAt);
  assert.equal(seen.length, 1, "the failure is surfaced, not swallowed");
});

test("an analysis with no stored input fails rather than hanging", async () => {
  const store = fakeStore({}, "");

  const report = await executor(store, () =>
    assert.fail("the pipeline must not run without input"),
  ).execute(ANALYSIS_ID);

  assert.equal(report.outcome, "failed");
  assert.equal(store.row.status, "failed");
  assert.match(report.failureReason ?? "", /no stored input/);
});

test("no path leaves the analysis queued or running", async () => {
  const cases: (() => Promise<PipelineResult>)[] = [
    () => Promise.resolve(pipelineResult()),
    () => Promise.reject(new Error("boom")),
    () => {
      throw new Error("synchronous boom");
    },
  ];

  for (const runPipeline of cases) {
    const store = fakeStore();
    await executor(store, runPipeline).execute(ANALYSIS_ID);
    assert.ok(
      ["completed", "failed"].includes(store.row.status),
      `ended at ${store.row.status}, which is not terminal`,
    );
  }
});

// --- the claim guard ------------------------------------------------------

test("an analysis already running is not executed a second time", async () => {
  // `API §14`: duplicate *submission* creates a distinct analysis by design.
  // Duplicate *execution* of one analysis is a different thing, and the status
  // column is the compare-and-set that prevents it.
  const store = fakeStore({ status: "running" });

  const report = await executor(store, () =>
    assert.fail("a claimed analysis must not run again"),
  ).execute(ANALYSIS_ID);

  assert.equal(report.outcome, "not_claimable");
  assert.equal(store.row.status, "running", "the other runner still owns it");
});

test("a completed analysis is not re-executed", async () => {
  const store = fakeStore({ status: "completed" });

  const report = await executor(store, () =>
    assert.fail("a finished analysis must not run again"),
  ).execute(ANALYSIS_ID);

  assert.equal(report.outcome, "not_claimable");
});

// --- the suite cannot select live ----------------------------------------

test("the executor reports the mode it was given and reaches no provider", async () => {
  // Mode is passed in already resolved, so nothing here can read an
  // environment variable into existence. `runPipeline` is the only seam, and
  // it is a local function — there is no adapter, no credential and no network
  // anywhere in this file.
  const store = fakeStore();

  const report = await createAnalysisExecutor({
    cipher: testCipher,
    prisma: store.prisma,
    mode: "replay",
    runPipeline: () => Promise.resolve(pipelineResult()),
  }).execute(ANALYSIS_ID);

  assert.equal(report.mode, "replay");
});
