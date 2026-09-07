/**
 * Integration — the two refusals that are not failures (`API §9.3`).
 *
 * `FR-092` declines an unsupported input at Stage 1. `AI §5.4` stops an
 * insufficient one at Stage 3 and calls that "a designed outcome, not an
 * error". Both were computed by the pipeline and then **discarded** by the
 * orchestrator: the row was written as a plain `completed`, and `API-021`
 * served an analysis that looked ordinary and happened to be empty. A user
 * could not tell a deliberate refusal from a run that produced nothing.
 *
 * These tests pin the whole path — halt persisted, halt carried through the
 * shared view, 422 raised with the unknowns attached, and the export producing
 * a refusal rather than a hollow document. They also pin what must **not**
 * change: an ordinary completed, degraded or timed-out analysis is untouched,
 * and nothing invents a refusal for an analysis that never had one.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import { createAnalysisExecutor } from "../../src/orchestrator/execute-analysis.js";
import type { AnalysisEvent } from "../../src/nie/events.js";
import type { PipelineResult } from "../../src/nie/contracts.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import {
  anonymousCredential,
  anonymousLookup,
  noSessions,
} from "../helpers/anonymous-principal.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

const ANALYSIS_ID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

// --- the orchestrator: the halt must survive ------------------------------

interface Updated {
  readonly status?: string;
  readonly degradationFlag?: boolean;
  readonly haltedAtStage?: number;
  readonly haltReason?: string;
}

const runExecutor = async (result: PipelineResult) => {
  const updates: Updated[] = [];
  const events: AnalysisEvent[] = [];

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
    prisma,
    mode: "replay",
    runPipeline: () => Promise.resolve(result),
    setTimer: () => 1,
    clearTimer: () => undefined,
    eventSink: {
      emit: (_id, event) => {
        events.push(event);
      },
    },
    now: () => new Date(0),
  });

  const outcome = await executor.execute(ANALYSIS_ID);
  return { updates, events, outcome };
};

const classification = (determinedType: string) => ({
  determinedType,
  confidence: 0.9,
  candidateTypes: [],
  wasLowConfidence: false,
  mixedDetected: false,
});

const unsupportedResult = {
  classification: classification("unsupported"),
  haltedAt: {
    stageNumber: 1,
    reason: "Input classified unsupported; no reasoning performed (FR-092)",
  },
} as unknown as PipelineResult;

const insufficientResult = {
  classification: classification("job_description"),
  haltedAt: {
    stageNumber: 3,
    reason:
      "Context insufficient; any design would be substantially invented (AI §5.4)",
  },
} as unknown as PipelineResult;

const completedResult = {
  classification: classification("job_description"),
  artifactPlan: [],
} as unknown as PipelineResult;

test("FR-092 — a Stage 1 decline persists its stage and reason", async () => {
  // The regression this whole increment exists for: the orchestrator used to
  // compute `halted`, use it for its own return value, and write none of it.
  const { updates } = await runExecutor(unsupportedResult);

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.haltedAtStage, 1);
  assert.match(updates[0]?.haltReason ?? "", /FR-092/);
});

test("AI §5.4 — a Stage 3 insufficiency persists its stage and reason", async () => {
  const { updates } = await runExecutor(insufficientResult);

  assert.equal(updates[0]?.haltedAtStage, 3);
  assert.match(updates[0]?.haltReason ?? "", /substantially invented/);
});

test("a refusal is not recorded as a failure or a degradation", async () => {
  // `API §9.3`: "not failures". The system worked correctly.
  const { updates, outcome } = await runExecutor(unsupportedResult);

  assert.equal(updates[0]?.status, "completed");
  assert.equal(updates[0]?.degradationFlag, false);
  assert.equal(outcome.outcome, "halted");
});

test("the terminal event says the run was refused", async () => {
  // A client that followed the stream and saw a plain `complete` would go on
  // to fetch an analysis the API answers with a 422.
  const { events } = await runExecutor(insufficientResult);
  const complete = events.find((event) => event.type === "complete");

  assert.ok(complete);
  assert.equal((complete as { refused?: boolean }).refused, true);
  assert.equal((complete as { haltedAtStage?: number }).haltedAtStage, 3);
});

test("an ordinary completion writes no halt columns at all", async () => {
  // Not `null` — absent. A write of null would be indistinguishable from a
  // deliberate clearing, and every historical row must stay untouched.
  const { updates, events } = await runExecutor(completedResult);

  assert.equal("haltedAtStage" in (updates[0] ?? {}), false);
  assert.equal("haltReason" in (updates[0] ?? {}), false);

  const complete = events.find((event) => event.type === "complete");
  assert.equal("refused" in (complete ?? {}), false);
});

// --- API-021: the 422 ------------------------------------------------------

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  port: 0,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

/** A stored analysis row in the shape `readAnalysis` includes. */
const storedAnalysis = (overrides: Record<string, unknown> = {}) => ({
  analysisId: ANALYSIS_ID,
  userId: null,
  status: "completed",
  createdAt: new Date("2026-09-07T11:58:00.000Z"),
  completedAt: new Date("2026-09-07T11:58:20.000Z"),
  derivedTitle: null,
  sufficiencyLevel: null,
  overallConfidenceBand: null,
  degradationFlag: false,
  timeoutFlag: false,
  haltedAtStage: null,
  haltReason: null,
  input: { characterCount: 900, sourceType: "paste" },
  classification: {
    determinedType: "job_description",
    confidence: 0.9,
    candidateTypes: null,
    wasLowConfidence: false,
    userOverrideType: null,
    overriddenAt: null,
  },
  intentRecord: null,
  contextElements: [],
  recommendations: [],
  requiredCapabilities: [],
  artifactPlanEntries: [],
  ...overrides,
});

const UNKNOWNS = [
  {
    content: "Expected peak submission rate",
    category: "constraint",
    provenance: "unknown",
    specificityScore: null,
    sourceSpanStart: null,
    sourceSpanEnd: null,
    inferenceBasis: null,
    resolutionHint: "Ask for peak submissions per hour",
  },
  {
    content: "Who owns the sheet",
    category: "constraint",
    provenance: "unknown",
    specificityScore: null,
    sourceSpanStart: null,
    sourceSpanEnd: null,
    inferenceBasis: null,
    resolutionHint: null,
  },
];

const refusedInsufficient = () =>
  storedAnalysis({
    haltedAtStage: 3,
    haltReason:
      "Context insufficient; any design would be substantially invented (AI §5.4)",
    sufficiencyLevel: "insufficient",
    contextElements: UNKNOWNS,
  });

const refusedUnsupported = () =>
  storedAnalysis({
    haltedAtStage: 1,
    haltReason: "Input classified unsupported; no reasoning performed (FR-092)",
    classification: {
      determinedType: "unsupported",
      confidence: 0.95,
      candidateTypes: null,
      wasLowConfidence: false,
      userOverrideType: null,
      overriddenAt: null,
    },
  });

const database = (analysis: unknown): Database =>
  ({
    prisma: {
      healthCheck: { findFirst: () => Promise.resolve(null) },
      session: noSessions,
      analysis: {
        findUnique: () => Promise.resolve(analysis),
        ...anonymousLookup(credential, {
          analysisId: ANALYSIS_ID,
          userId:
            (analysis as { userId?: string | null } | null)?.userId ?? null,
        }),
      },
    },
    disconnect: () => Promise.resolve(),
  }) as unknown as Database;

/** Ownership is enforced from `M-15`; these reads present the credential. */
const credential = anonymousCredential();

const get = async (analysis: unknown) => {
  const app = await buildApp({ config, database: database(analysis) });
  const res = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}`,
    headers: credential.header,
  });
  await app.close();
  return res;
};

const postExport = async (analysis: unknown, body: unknown = {}) => {
  const app = await buildApp({ config, database: database(analysis) });
  const res = await app.inject({
    method: "POST",
    url: `/analyses/${ANALYSIS_ID}/exports`,
    payload: body as Record<string, unknown>,
    headers: credential.header,
  });
  await app.close();
  return res;
};

test("API §9.3 — an unsupported input is 422, not 200 with empty sections", async () => {
  const res = await get(refusedUnsupported());
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 422);
  assert.equal(body.error.code, "unsupported_input_type");
});

test("FR-092 — the unsupported refusal names what NAIGX does analyse", async () => {
  // A refusal that does not name an alternative leaves the user nothing to try.
  const res = await get(refusedUnsupported());
  const body = JSON.parse(res.body);

  assert.deepEqual(body.error.details.supported_types, [
    "business_requirement",
    "existing_workflow",
    "job_description",
    "technical_assessment",
  ]);
  // `unsupported` is not something a user can submit; offering it back would
  // be advice to resubmit the same thing.
  assert.equal(
    body.error.details.supported_types.includes("unsupported"),
    false,
  );
  assert.ok(body.error.action.length > 0);
});

test("API §9.3 — an insufficient input is 422 carrying its unknowns", async () => {
  // "Returning a generic error here would waste the most valuable thing the
  // system determined."
  const res = await get(refusedInsufficient());
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 422);
  assert.equal(body.error.code, "insufficient_context");
  assert.deepEqual(body.error.details.unknowns, [
    {
      missing: "Expected peak submission rate",
      would_resolve: "Ask for peak submissions per hour",
    },
    { missing: "Who owns the sheet", would_resolve: null },
  ]);
});

test("a Stage 1 decline reports no unknowns rather than borrowing any", async () => {
  // It halts before context extraction, so it has none. If a row somehow
  // carried unknown elements, attributing them to a Stage 1 refusal would be
  // reporting context the run never reached.
  const res = await get(
    storedAnalysis({
      haltedAtStage: 1,
      haltReason: "Input classified unsupported; no reasoning performed",
      contextElements: UNKNOWNS,
    }),
  );

  assert.equal(res.statusCode, 422);
  assert.equal(JSON.parse(res.body).error.code, "unsupported_input_type");
});

test("the refusal message states the constraint and the corrective action", async () => {
  // `FR-005`/`FR-090` apply to a 422 exactly as to a 400.
  const res = await get(refusedInsufficient());
  const body = JSON.parse(res.body);

  assert.match(body.error.message, /does not say enough/);
  assert.match(body.error.action, /submit again/i);
});

// --- what must not change --------------------------------------------------

test("an ordinary completed analysis is unaffected and still 200", async () => {
  const res = await get(storedAnalysis());
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(body.data.refusal, null);
  assert.equal(body.data.status, "completed");
});

test("a degraded analysis is still 200 — degradation is not refusal", async () => {
  const res = await get(storedAnalysis({ degradationFlag: true }));
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(body.data.degraded, true);
  assert.equal(body.data.refusal, null);
});

test("a timed-out analysis is still 200 with what was preserved", async () => {
  // `FR-094` requires what completed to be presented. A timeout is not a
  // refusal: the system did not decline, it ran out of time.
  const res = await get(
    storedAnalysis({ status: "timed_out", timeoutFlag: true }),
  );
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(body.data.timed_out, true);
  assert.equal(body.data.refusal, null);
});

test("a historical row with null halt columns is not read as a refusal", async () => {
  // The migration is additive and backfills nothing. Null means "no refusal",
  // never "unknown", and an analysis stored before the column existed must
  // keep behaving exactly as it did.
  const res = await get(
    storedAnalysis({ haltedAtStage: null, haltReason: null }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).data.refusal, null);
});

test("a row that never carried the halt columns is not a refusal", async () => {
  // REGRESSION. The first version of the reader compared `=== null`, so a row
  // projected *without* these columns — `undefined`, not null — was reported
  // as declined, and every analysis read through such a projection came back
  // 422. A refusal must be affirmed by data that is present, never inferred
  // from a field nobody read.
  const row = storedAnalysis();
  delete (row as Record<string, unknown>)["haltedAtStage"];
  delete (row as Record<string, unknown>)["haltReason"];

  const res = await get(row);

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).data.refusal, null);
});

test("a half-written halt is not treated as a refusal", async () => {
  // The migration's CHECK constraint makes this unreachable in the database.
  // Asserted anyway: the reader must not infer a refusal from a stage with no
  // reason, because a refusal that cannot explain itself is worse than none.
  const res = await get(storedAnalysis({ haltedAtStage: 3, haltReason: null }));

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).data.refusal, null);
});

// --- export ----------------------------------------------------------------

test("a refused analysis exports as a refusal, not a hollow document", async () => {
  const res = await postExport(refusedInsufficient());

  assert.equal(res.statusCode, 200);
  // The refusal layout, not the eight-section one.
  assert.match(res.body, /^# Analysis declined/);
  assert.match(res.body, /## Why this stopped/);
  assert.match(res.body, /## What is missing/);
  assert.match(
    res.body,
    /Expected peak submission rate \| Ask for peak submissions per hour/,
  );
  // None of the ordinary sections, which would all be empty.
  assert.equal(/## 1\. The problem as understood/.test(res.body), false);
  assert.equal(/## \d+\. Artifact status/.test(res.body), false);
});

test("an unsupported refusal exports with what NAIGX does analyse", async () => {
  const res = await postExport(refusedUnsupported());

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /^# Input outside scope/);
  assert.match(res.body, /## What NAIGX does analyse/);
  assert.match(res.body, /A job description/);
});

test("a refusal export still carries the FR-051 disclaimer and metadata", async () => {
  const res = await postExport(refusedUnsupported());

  assert.match(res.body, new RegExp(ANALYSIS_ID));
  assert.match(res.body, /generated intelligence, not professional advice/);
});

test("an artifact selection over a refusal is refused with the reason", async () => {
  // The generic "none of the requested types was produced" would suggest the
  // analysis merely produced none, rather than that it was declined.
  const res = await postExport(refusedInsufficient(), {
    artifact_types: ["portfolio_suggestions"],
  });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 400);
  assert.match(body.error.message, /declined before any artifact was planned/);
  assert.equal(body.error.details.refusal_code, "insufficient_context");
});
