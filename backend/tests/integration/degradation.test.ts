/**
 * Integration — M-14 degradation (`FR-091`, `FR-093`, `FR-094`, `NFR-011`).
 *
 * The roadmap makes these "the sprint's primary deliverable, not its tail",
 * citing `PV §6`: trust is designed in the failure cases. So these tests are
 * about what happens when things go wrong, and specifically about the
 * distinctions that a careless implementation collapses:
 *
 *   · **timed out** vs **failed** vs **completed** — a run cut short has
 *     produced something, and reporting it as a plain completion (which is
 *     what happened before `FR-094` existed) hides that it is partial.
 *   · **failed** vs **omitted** — "tried and failed" and "chose not to" mean
 *     opposite things (`DB §4.4`, `FR-091`).
 *   · **retryable** vs **deterministic** — a rendered artifact cannot be
 *     usefully retried, and offering the control anyway would be a lie
 *     (`docs/15` D-40).
 *
 * No database and no provider: the Prisma client is a recording double and the
 * pipeline is a function, which is the seam `execute-analysis.ts` was built to
 * have.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import {
  anonymousCredential,
  anonymousLookup,
  noSessions,
} from "../helpers/anonymous-principal.js";
import type { AnalysisEvent } from "../../src/nie/events.js";
import type { PipelineResult } from "../../src/nie/contracts.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { createAnalysisExecutor } from "../../src/orchestrator/execute-analysis.js";
import { createTestCipher } from "../helpers/cipher.js";
import { ProviderError } from "../../src/provider/capability.js";

// A real cipher — see tests/helpers/cipher.ts. Not a pass-through: these
// suites must exercise the seal/open round trip, not skip past it.
const testCipher = await createTestCipher();

const ANALYSIS_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

// --- FR-094, the timeout --------------------------------------------------

interface Updated {
  readonly status?: string;
  readonly timeoutFlag?: boolean;
  readonly degradationFlag?: boolean;
}

const executorHarness = (options: {
  readonly runPipeline: () => Promise<PipelineResult>;
  readonly timeoutMs?: number;
}) => {
  const updates: Updated[] = [];
  const events: AnalysisEvent[] = [];
  /** Fires the deadline on demand, so no test waits out a real duration. */
  let fire: (() => void) | undefined;

  const prisma = {
    analysis: {
      updateMany: () => Promise.resolve({ count: 1 }),
      findUnique: () =>
        Promise.resolve({ input: { rawContent: "some stored input text" } }),
      update: ({ data }: { data: Updated }) => {
        updates.push(data);
        return Promise.resolve({});
      },
    },
  } as unknown as PrismaClient;

  const executor = createAnalysisExecutor({
    cipher: testCipher,
    prisma,
    mode: "replay",
    runPipeline: options.runPipeline,
    ...(options.timeoutMs !== undefined
      ? { timeoutMs: options.timeoutMs }
      : {}),
    setTimer: (fn) => {
      fire = fn;
      return 1;
    },
    clearTimer: () => {
      fire = undefined;
    },
    eventSink: {
      emit: (_id, event) => {
        events.push(event);
      },
    },
    now: () => new Date(0),
  });

  return { executor, updates, events, trip: () => fire?.() };
};

const completedResult: PipelineResult = {
  classification: {
    determinedType: "job_description",
    confidence: 0.9,
    candidateTypes: [],
    wasLowConfidence: false,
    mixedDetected: false,
  },
  artifactPlan: [],
};

test("a run that beats the deadline completes normally and is not flagged", async () => {
  const harness = executorHarness({
    runPipeline: () => Promise.resolve(completedResult),
  });

  const report = await harness.executor.execute(ANALYSIS_ID);

  assert.equal(report.outcome, "completed");
  const terminal = harness.updates.at(-1);
  assert.equal(terminal?.status, "completed");
  assert.notEqual(terminal?.timeoutFlag, true);

  const complete = harness.events.find((e) => e.type === "complete");
  assert.equal(complete?.type === "complete" && complete.timedOut, false);
});

test("a run that exceeds the deadline is terminal `timed_out`, not `completed`", async () => {
  // Before `FR-094` was implemented nothing ever set this status: `timed_out`
  // sat in the enum and `timeoutFlag` was readable through two endpoints while
  // every over-long run reported a plain completion.
  const harness = executorHarness({
    runPipeline: () => new Promise<PipelineResult>(() => {}),
  });

  const running = harness.executor.execute(ANALYSIS_ID);
  // Let the claim and load settle, then trip the deadline.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  harness.trip();

  const report = await running;

  assert.equal(report.outcome, "timed_out");
  const terminal = harness.updates.at(-1);
  assert.equal(terminal?.status, "timed_out");
  assert.equal(terminal?.timeoutFlag, true);
  // `FR-091` — a run cut short is partial, and an unlabelled partial result is
  // the defect the requirement exists to prevent.
  assert.equal(terminal?.degradationFlag, true);
});

test("a timeout still emits the terminal event the stream contract requires", async () => {
  const harness = executorHarness({
    runPipeline: () => new Promise<PipelineResult>(() => {}),
  });

  const running = harness.executor.execute(ANALYSIS_ID);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  harness.trip();
  await running;

  // `API §7.4`: a terminal event is always emitted before the stream closes.
  // `API §7.7`: "client notification: `complete` event with the timeout flag".
  const complete = harness.events.find((e) => e.type === "complete");
  assert.ok(
    complete,
    "a client watching must not wait for an event that never comes",
  );
  assert.equal(complete.type === "complete" && complete.status, "timed_out");
  assert.equal(complete.type === "complete" && complete.timedOut, true);
  assert.equal(complete.type === "complete" && complete.degraded, true);
});

test("a genuine failure inside the deadline is a failure, not a timeout", async () => {
  // The race must not disguise one as the other: they need different messages
  // and `FR-094` only promises preservation for the timeout case.
  const harness = executorHarness({
    runPipeline: () => Promise.reject(new Error("stage 3 could not parse")),
  });

  const report = await harness.executor.execute(ANALYSIS_ID);

  assert.equal(report.outcome, "failed");
  assert.equal(harness.updates.at(-1)?.status, "failed");
});

// --- FR-093, provider failure containment ---------------------------------

test("a provider failure reaches the client with no provider detail", async () => {
  // `FR-093`: "Persistent failure produces a user-facing message with no
  // provider identification." `SA §3.5` says provider errors never surface
  // upward in provider-specific form, and `AI-006` keeps identity out entirely.
  const harness = executorHarness({
    runPipeline: () =>
      Promise.reject(
        new ProviderError(
          "persistent",
          "anthropic: model claude-x returned 400 invalid_request_error",
          { cause: new Error("sk-ant-REDACTED-looking-key") },
        ),
      ),
  });

  const report = await harness.executor.execute(ANALYSIS_ID);
  assert.equal(report.outcome, "failed");

  const errorEvent = harness.events.find((e) => e.type === "error");
  assert.ok(errorEvent);
  const text = JSON.stringify(errorEvent);

  for (const leak of [
    "anthropic",
    "claude",
    "sk-ant",
    "400",
    "invalid_request",
  ]) {
    assert.ok(
      !text.toLowerCase().includes(leak.toLowerCase()),
      `the client channel leaked "${leak}": ${text}`,
    );
  }
  // The diagnostic is kept — on the report, which is server-side.
  assert.match(report.failureReason ?? "", /anthropic/);
});

test("ProviderError carries a failure class and no provider identity of its own", async () => {
  const error = new ProviderError("transient", "upstream timed out");

  assert.equal(error.failureClass, "transient");
  assert.equal(error.name, "ProviderError");
  // There is no field an adapter name could occupy — absence by construction
  // rather than by filtering (`AI-006`).
  assert.ok(!("provider" in error));
  assert.ok(!("adapter" in error));
  await Promise.resolve();
});

// --- API-032, retry ------------------------------------------------------

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  spend: { reserveUsdPerAnalysis: "0.30" },
  port: 0,
  host: "127.0.0.1",
  trustProxy: false,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const retryApp = async (options: {
  readonly status?: string;
  readonly outcome?: string | null;
  readonly entryExists?: boolean;
  readonly analysisExists?: boolean;
  readonly retryArtifact?: (id: string, type: string) => Promise<void>;
}) => {
  const prisma = {
    healthCheck: { findFirst: () => Promise.resolve(null) },
    session: noSessions,
    analysis: {
      findUnique: () =>
        Promise.resolve(
          options.analysisExists === false
            ? null
            : { status: options.status ?? "completed", userId: null },
        ),
      ...anonymousLookup(credential, { analysisId: ANALYSIS_ID }),
    },
    artifactPlanEntry: {
      findFirst: () =>
        Promise.resolve(
          options.entryExists === false
            ? null
            : { outcome: options.outcome ?? "failed" },
        ),
    },
  };

  return buildApp({
    config,
    database: {
      prisma,
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    ...(options.retryArtifact !== undefined
      ? { retryArtifact: options.retryArtifact }
      : {}),
  });
};

/**
 * `API §7.8` permits an anonymous caller to retry a failed artifact, so these
 * requests present the credential for the analysis they act on. Ownership is
 * enforced from `M-15`.
 */
const credential = anonymousCredential();

const retry = (
  app: Awaited<ReturnType<typeof retryApp>>,
  type = "portfolio_suggestions",
) =>
  app.inject({
    method: "POST",
    url: `/analyses/${ANALYSIS_ID}/artifacts/${type}/retry`,
    headers: credential.header,
  });

test("retrying a failed generated artifact is accepted", async () => {
  const calls: string[] = [];
  const app = await retryApp({
    retryArtifact: (id, type) => {
      calls.push(`${id}:${type}`);
      return Promise.resolve();
    },
  });

  const res = await retry(app);
  const body = JSON.parse(res.body) as { data: Record<string, unknown> };

  assert.equal(res.statusCode, 202, "API-032 specifies 202 Accepted");
  assert.deepEqual(calls, [`${ANALYSIS_ID}:portfolio_suggestions`]);
  assert.equal(body.data["events_url"], `/analyses/${ANALYSIS_ID}/events`);
});

test("retrying an artifact that succeeded is 409, and says why", async () => {
  const app = await retryApp({ outcome: "generated" });
  const res = await retry(app);
  const body = JSON.parse(res.body) as { error: Record<string, unknown> };

  assert.equal(res.statusCode, 409);
  assert.equal(body.error["code"], "invalid_state");
  assert.match(String(body.error["message"]), /generated successfully/);
  // `FR-005` — every error names a corrective action, conflicts included.
  assert.ok(String(body.error["action"]).length > 0);
});

test("retrying an omitted artifact is 409 and preserves the omission distinction", async () => {
  // `DB §4.4` exists so "chose not to" and "tried and failed" stay apart. An
  // endpoint that retried an omission would erase that at the API boundary.
  const app = await retryApp({ outcome: "omitted" });
  const res = await retry(app);
  const body = JSON.parse(res.body) as { error: Record<string, unknown> };

  assert.equal(res.statusCode, 409);
  assert.match(String(body.error["message"]), /deliberately omitted/);
  assert.match(String(body.error["action"]), /decision, not a failure/);
});

test("retrying a deterministic rendered artifact is refused with a reason", async () => {
  // `docs/15` D-40: these are rendered from stored reasoning, so a retry
  // recomputes the identical document. Refusing beats performing a gesture.
  for (const type of [
    "workflow_recommendation",
    "risk_assessment",
    "assessment_feedback",
    "mermaid_diagram",
  ]) {
    const app = await retryApp({ retryArtifact: () => Promise.resolve() });
    const res = await retry(app, type);
    const body = JSON.parse(res.body) as { error: Record<string, unknown> };

    assert.equal(res.statusCode, 409, `${type} should be refused`);
    assert.equal(body.error["code"], "invalid_state");
    assert.match(String(body.error["message"]), /exactly the same document/);
    assert.equal(
      (body.error["details"] as Record<string, unknown>)["deterministic"],
      true,
    );
  }
});

test("retrying while the analysis is still running is refused", async () => {
  for (const status of ["queued", "running"]) {
    const app = await retryApp({ status });
    const res = await retry(app);

    assert.equal(res.statusCode, 409, `status ${status} should be refused`);
    assert.match(JSON.parse(res.body).error.message as string, /still running/);
  }
});

test("retrying an unknown analysis or artifact is 404", async () => {
  assert.equal(
    (await retry(await retryApp({ analysisExists: false }))).statusCode,
    404,
  );
  assert.equal(
    (await retry(await retryApp({ entryExists: false }))).statusCode,
    404,
  );
});

test("an instance with no reasoning stack reports the capability unavailable", async () => {
  // Not a 500 and not a silent success: the request was valid and the server
  // cannot serve it, which is what 503 means.
  const app = await retryApp({});
  const res = await retry(app);

  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).error.code, "service_unavailable");
});
