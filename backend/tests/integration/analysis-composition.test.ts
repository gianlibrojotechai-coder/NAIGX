/**
 * Integration — the composed path: `POST /analyses` → executor → pipeline →
 * terminal status → `GET /analyses/{id}` and `/status`.
 *
 * Everything is wired the way the composition root wires it, with two
 * substitutions and no others: the store is a fake, and the pipeline is a
 * local function. **No adapter is constructed and no credential is read**, so
 * this suite cannot reach a provider even if one were configured on the
 * machine running it.
 *
 * What it proves that the unit tests cannot: that the seam between HTTP and
 * the orchestrator actually closes — a submission really does reach execution,
 * and the state it produces really is what retrieval reports.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import { createAnalysisExecutor } from "../../src/orchestrator/execute-analysis.js";
import { resolveExecutionMode } from "../../src/orchestrator/execution-mode.js";
import type { PipelineResult } from "../../src/nie/contracts.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  port: 0,
  host: "127.0.0.1",
  trustProxy: false,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const ANALYSIS_ID = "33333333-3333-4333-8333-333333333333";
const CONTENT = "A job posting with enough substance to be worth analysing.";

interface Row {
  analysisId: string;
  /** The issued anonymous credential's hash, so reads can be authorized. */
  anonymousTokenHash: string | null;
  userId: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  derivedTitle: string | null;
  sufficiencyLevel: string | null;
  overallConfidenceBand: string | null;
  degradationFlag: boolean;
  timeoutFlag: boolean;
}

/** One in-memory analysis, shared by the routes and the executor. */
const store = () => {
  let row: Row | null = null;

  const prisma = {
    healthCheck: { findFirst: () => Promise.resolve(null) },
    // Ownership is enforced from `M-15`, so the store must answer the two
    // queries the principal resolver makes. This stub models the real
    // predicates rather than returning the row unconditionally: the anonymous
    // lookup matches on the stored hash and on `userId: null`, exactly as
    // Postgres does.
    session: { findFirst: () => Promise.resolve(null) },
    analysis: {
      findFirst: ({
        where,
      }: {
        where: { anonymousTokenHash: string; userId: null };
      }) =>
        Promise.resolve(
          row !== null && row.anonymousTokenHash === where.anonymousTokenHash
            ? { analysisId: row.analysisId, createdAt: row.createdAt }
            : null,
        ),
      create: ({ data }: { data: { anonymousTokenHash?: string } }) => {
        row = {
          analysisId: ANALYSIS_ID,
          // Stored so the anonymous lookup above can match the issued token.
          anonymousTokenHash: data.anonymousTokenHash ?? null,
          userId: null,
          status: "queued",
          // `new Date()`, as a real create does. A fixed past instant would
          // put the issued anonymous token beyond its 24-hour lifetime (D-45)
          // the moment the wall clock moved past it, and the reads below would
          // 404 for a reason that has nothing to do with what they test.
          createdAt: new Date(),
          completedAt: null,
          derivedTitle: null,
          sufficiencyLevel: null,
          overallConfidenceBand: null,
          degradationFlag: false,
          timeoutFlag: false,
        };
        return Promise.resolve(row);
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { status?: string };
        data: Partial<Row>;
      }) => {
        if (row === null || (where.status && row.status !== where.status)) {
          return Promise.resolve({ count: 0 });
        }
        Object.assign(row, data);
        return Promise.resolve({ count: 1 });
      },
      update: ({ data }: { data: Partial<Row> }) => {
        if (row !== null) Object.assign(row, data);
        return Promise.resolve(row);
      },
      findUnique: () =>
        Promise.resolve(
          row === null
            ? null
            : {
                ...row,
                input: {
                  rawContent: CONTENT,
                  characterCount: CONTENT.length,
                  sourceType: "paste",
                },
                classification: null,
                intentRecord: null,
                contextElements: [],
                recommendations: [],
                requiredCapabilities: [],
                artifactPlanEntries: [],
              },
        ),
    },
  } as unknown as PrismaClient;

  return { prisma, current: () => row };
};

/**
 * Composes the application the way `index.ts` does — routes, executor and a
 * pipeline — differing only in that the pipeline is supplied rather than built
 * from an adapter.
 */
const compose = async (
  runPipeline: () => Promise<PipelineResult>,
  overrides: { mode?: "replay" | "live" } = {},
) => {
  const db = store();

  // Resolved the same way the composition root resolves it, from an
  // environment that names nothing.
  const mode =
    overrides.mode ??
    resolveExecutionMode({
      requested: undefined,
      hasProviderCredentials: false,
    });

  const executor = createAnalysisExecutor({
    prisma: db.prisma,
    mode,
    runPipeline,
    now: () => new Date("2026-09-06T12:00:30.000Z"),
  });

  // Awaited in the test so assertions are deterministic; the composition root
  // deliberately does not await it (`API-020` returns first).
  let pending: Promise<unknown> = Promise.resolve();

  const app = await buildApp({
    config,
    database: {
      prisma: db.prisma,
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    checkProvider: () => Promise.resolve(),
    checkTemplates: () => Promise.resolve(),
    hashContent: () => "deadbeef",
    startExecution: (analysisId) => {
      pending = executor.execute(analysisId);
    },
  });

  return { app, db, mode, settled: () => pending };
};

const result = (overrides: Partial<PipelineResult> = {}): PipelineResult =>
  ({
    classification: { determinedType: "job_description", confidence: 0.9 },
    ...overrides,
  }) as PipelineResult;

// --- composition ---------------------------------------------------------

test("the application composes in replay mode with no credentials", async () => {
  const { app, mode } = await compose(() => Promise.resolve(result()));

  assert.equal(mode, "replay", "the safe default, with nothing configured");
  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200, "the composed app serves");
});

// --- the full path -------------------------------------------------------

test("a submission runs through to a terminal state and is retrievable", async () => {
  const { app, db, settled } = await compose(() => Promise.resolve(result()));

  const created = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: { content: CONTENT },
  });
  assert.equal(created.statusCode, 202);
  // `FR-004` — the token is issued once, at creation, and is the only way to
  // reach an anonymous analysis afterwards. Capturing it here is what a real
  // client does; before `M-15` the id alone was enough, which was the defect.
  const { analysis_id, anonymous_token } = (
    created.json() as {
      data: { analysis_id: string; anonymous_token: string };
    }
  ).data;
  assert.ok(anonymous_token, "no anonymous token was issued");
  const auth = { authorization: `Bearer ${anonymous_token}` };

  // The response precedes the run, so the assertions wait for it.
  await settled();

  assert.equal(db.current()?.status, "completed");

  const retrieved = await app.inject({
    method: "GET",
    url: `/analyses/${analysis_id}`,
    headers: auth,
  });
  assert.equal(retrieved.statusCode, 200);
  assert.equal(
    (retrieved.json() as { data: { status: string } }).data.status,
    "completed",
    "retrieval reports the state execution produced",
  );

  const status = await app.inject({
    method: "GET",
    url: `/analyses/${analysis_id}/status`,
    headers: auth,
  });
  assert.equal(
    (status.json() as { data: { status: string } }).data.status,
    "completed",
  );
});

test("a degraded run is reported as degraded, not as success", async () => {
  const { app, db, settled } = await compose(() =>
    Promise.resolve(
      result({
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
  );

  const created = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: { content: CONTENT },
  });
  // The issued credential is the only way to read the analysis afterwards.
  const token = (created.json() as { data: { anonymous_token: string } }).data
    .anonymous_token;
  const auth = { authorization: `Bearer ${token}` };
  await settled();

  assert.equal(db.current()?.status, "completed");
  assert.equal(db.current()?.degradationFlag, true);

  const status = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}/status`,
    headers: auth,
  });
  assert.equal(
    (status.json() as { data: { degraded: boolean } }).data.degraded,
    true,
    "FR-091 — the degradation is visible to a poller",
  );
});

test("a failing run does not leave the analysis queued", async () => {
  const { app, db, settled } = await compose(() =>
    Promise.reject(new Error("No recorded response for request key abc")),
  );

  const created = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: { content: CONTENT },
  });
  // The issued credential is the only way to read the analysis afterwards.
  const token = (created.json() as { data: { anonymous_token: string } }).data
    .anonymous_token;
  const auth = { authorization: `Bearer ${token}` };
  await settled();

  assert.equal(db.current()?.status, "failed");
  const status = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}/status`,
    headers: auth,
  });
  assert.equal(
    (status.json() as { data: { status: string } }).data.status,
    "failed",
  );
});

// --- an unwired instance still queues ------------------------------------

test("with no executor the submission is stored and stays queued", async () => {
  const db = store();
  const app = await buildApp({
    config,
    database: {
      prisma: db.prisma,
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    checkProvider: () => Promise.resolve(),
    checkTemplates: () => Promise.resolve(),
    hashContent: () => "deadbeef",
  });

  const created = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: { content: CONTENT },
  });

  assert.equal(created.statusCode, 202);
  assert.equal(
    db.current()?.status,
    "queued",
    "queued and visible, rather than silently dropped",
  );
});

// --- live stays explicit --------------------------------------------------

test("this suite composes nothing that can reach a provider", async () => {
  // The mode resolves to replay from an environment naming nothing, and the
  // pipeline is a local function — no adapter is constructed anywhere in this
  // file. A credential present on the host cannot change either fact.
  const { mode } = await compose(() => Promise.resolve(result()));
  assert.equal(mode, "replay");

  assert.equal(
    resolveExecutionMode({
      requested: undefined,
      hasProviderCredentials: true,
    }),
    "replay",
    "credentials alone never select live",
  );
});
