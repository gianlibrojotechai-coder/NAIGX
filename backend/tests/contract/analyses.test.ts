/**
 * Contract — `POST /analyses`, `GET /analyses/{id}`, `GET /analyses/{id}/status`
 * (`API-020`, `API-021`, `API-026`).
 *
 * The database is injected as a fake, so these pin the *contract* — status
 * codes, envelope, validation messages, and what each endpoint may and may not
 * return — without needing Postgres, a credential, a provider or a network.
 * Nothing here spends anything.
 *
 * Two acceptance clauses get their own assertions because they are the ones a
 * refactor would quietly break:
 *
 *   · `API-026` — "Never returns artifact content."
 *   · `API-021` — "Contains no stage traces, prompt fragments, or provider
 *     identity."
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import { CONTENT_MAX, CONTENT_MIN } from "../../src/routes/analyses.js";

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  port: 0,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = new Date("2026-09-06T10:00:00.000Z");

const storedAnalysis = {
  analysisId: ANALYSIS_ID,
  status: "completed",
  createdAt: CREATED_AT,
  completedAt: new Date("2026-09-06T10:00:20.000Z"),
  derivedTitle: "Automation Engineer posting",
  sufficiencyLevel: "sufficient",
  overallConfidenceBand: null,
  degradationFlag: false,
  timeoutFlag: false,
  input: { characterCount: 420, sourceType: "paste" },
  intentRecord: null,
  contextElements: [],
  recommendations: [],
  requiredCapabilities: [],
  artifactPlanEntries: [],
  classification: {
    determinedType: "job_description",
    confidence: 0.92,
    candidateTypes: [],
    wasLowConfidence: false,
    userOverrideType: null,
    overriddenAt: null,
  },
};

interface Calls {
  create: unknown[];
  findUnique: unknown[];
}

const build = async (
  overrides: { findUnique?: (args: unknown) => Promise<unknown> } = {},
) => {
  const calls: Calls = { create: [], findUnique: [] };

  const app = await buildApp({
    config,
    database: {
      prisma: {
        healthCheck: { findFirst: () => Promise.resolve(null) },
        analysis: {
          create: (args: unknown) => {
            calls.create.push(args);
            return Promise.resolve({
              analysisId: ANALYSIS_ID,
              status: "queued",
            });
          },
          findUnique: (args: unknown) => {
            calls.findUnique.push(args);
            return (
              overrides.findUnique?.(args) ?? Promise.resolve(storedAnalysis)
            );
          },
        },
      },
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    checkProvider: () => Promise.resolve(),
    checkTemplates: () => Promise.resolve(),
    hashContent: () => "deadbeef",
  });

  return { app, calls };
};

const body = (content: string, extra: Record<string, unknown> = {}) => ({
  content,
  ...extra,
});

const valid = "x".repeat(CONTENT_MIN);

// --- API-020 — create ----------------------------------------------------

test("a valid submission is accepted with 202 and an id", async () => {
  const { app, calls } = await build();

  const response = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: body(valid),
  });

  // 202, not 201: `API-020` returns before reasoning completes.
  assert.equal(response.statusCode, 202);

  const parsed = response.json() as {
    data: { analysis_id: string; status: string };
    meta: unknown;
  };
  assert.equal(parsed.data.analysis_id, ANALYSIS_ID);
  assert.equal(parsed.data.status, "queued");
  assert.ok(parsed.meta, "the success envelope carries meta (API §10.1)");

  assert.equal(
    calls.create.length,
    1,
    "the analysis and its input are written",
  );
});

test("input below the minimum is rejected, naming the constraint and the fix", async () => {
  const { app, calls } = await build();

  const response = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: body("too short"),
  });

  assert.equal(response.statusCode, 400);
  const parsed = response.json() as {
    error: { code: string; message: string; action?: string; field?: string };
  };
  assert.equal(parsed.error.code, "content_too_short");
  assert.equal(parsed.error.field, "content");
  assert.match(parsed.error.message, new RegExp(String(CONTENT_MIN)));
  assert.ok(
    parsed.error.action,
    "FR-005 forbids a bare rejection — a corrective action is required",
  );

  assert.equal(
    calls.create.length,
    0,
    "API §6.1 — validation is the gate before any cost is incurred",
  );
});

test("input above the maximum is rejected with the actual count", async () => {
  const { app, calls } = await build();

  const response = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: body("x".repeat(CONTENT_MAX + 1)),
  });

  assert.equal(response.statusCode, 400);
  const parsed = response.json() as {
    error: { code: string; message: string };
  };
  assert.equal(parsed.error.code, "content_too_long");
  // `FR-002`: "the actual and maximum counts shown".
  assert.match(parsed.error.message, new RegExp(String(CONTENT_MAX + 1)));
  assert.match(parsed.error.message, new RegExp(String(CONTENT_MAX)));
  assert.equal(calls.create.length, 0);
});

test("a missing content field is a validation error, not a crash", async () => {
  const { app } = await build();

  const response = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: {},
  });

  assert.equal(response.statusCode, 400);
  assert.equal(
    (response.json() as { error: { code: string } }).error.code,
    "validation_failed",
  );
});

test("an unknown source_type is rejected; a known one is accepted", async () => {
  const { app } = await build();

  const bad = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: body(valid, { source_type: "carrier-pigeon" }),
  });
  assert.equal(bad.statusCode, 400);
  assert.equal(
    (bad.json() as { error: { field?: string } }).error.field,
    "source_type",
  );

  const good = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: body(valid, { source_type: "file" }),
  });
  assert.equal(good.statusCode, 202);
});

test("no input type is demanded at creation (FR-001, UX-002)", async () => {
  const { app } = await build();

  // A submission carrying nothing but content must succeed. The API never
  // asks what the text is about — that is Stage 1's job.
  const response = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: body(valid),
  });

  assert.equal(response.statusCode, 202);
});

// --- API-026 — status ----------------------------------------------------

test("status returns the lifecycle fields and never artifact content", async () => {
  const { app, calls } = await build();

  const response = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}/status`,
  });

  assert.equal(response.statusCode, 200);
  const parsed = response.json() as { data: Record<string, unknown> };

  assert.deepEqual(Object.keys(parsed.data).sort(), [
    "degraded",
    "status",
    "timed_out",
    "updated_at",
  ]);

  // `API-026`: "Never returns artifact content — that is API-021's role."
  // Enforced at the query, so there is no path by which it could.
  const args = calls.findUnique[0] as { select?: Record<string, unknown> };
  assert.ok(args.select, "status selects columns rather than fetching the row");
  assert.ok(!("include" in args), "no relations are loaded for a poll");
});

test("status on an unknown id is a 404 in the error envelope", async () => {
  const { app } = await build({ findUnique: () => Promise.resolve(null) });

  const response = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}/status`,
  });

  assert.equal(response.statusCode, 404);
  const parsed = response.json() as {
    error: { code: string; action?: string };
    meta: unknown;
  };
  assert.equal(parsed.error.code, "not_found");
  assert.ok(parsed.meta, "the error envelope carries meta too");
});

// --- API-021 — retrieve --------------------------------------------------

test("retrieval reproduces the stored record", async () => {
  const { app } = await build();

  const response = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}`,
  });

  assert.equal(response.statusCode, 200);
  const { data } = response.json() as { data: Record<string, unknown> };

  assert.equal(data["analysis_id"], ANALYSIS_ID);
  assert.equal(data["status"], "completed");
  assert.equal(data["derived_title"], "Automation Engineer posting");
  assert.equal(data["sufficiency_level"], "sufficient");
  assert.equal(data["degraded"], false);

  const classification = data["classification"] as Record<string, unknown>;
  assert.equal(classification["determined_type"], "job_description");
  assert.equal(
    classification["was_low_confidence"],
    false,
    "FR-015 — low-confidence classification is recorded on the output",
  );
  assert.equal(classification["user_override_type"], null);
});

test("retrieval exposes no trace, fragment or provider detail", async () => {
  const { app } = await build();

  const response = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}`,
  });

  // `API-021`: "Contains no stage traces, prompt fragments, or provider
  // identity." Asserted over the serialised body, so a field added to the
  // shape later cannot smuggle one in unnoticed.
  const raw = response.body.toLowerCase();
  for (const forbidden of [
    "fragment",
    "prompt",
    "provider",
    "anthropic",
    "stagetrace",
    "stage_trace",
    "model_version",
    "raw_content",
  ]) {
    assert.ok(!raw.includes(forbidden), `body must not mention "${forbidden}"`);
  }
});

test("retrieval on an unknown id is a 404", async () => {
  const { app } = await build({ findUnique: () => Promise.resolve(null) });

  const response = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}`,
  });

  assert.equal(response.statusCode, 404);
  assert.equal(
    (response.json() as { error: { code: string } }).error.code,
    "not_found",
  );
});

test("retrieval reaches no provider and cannot regenerate", async () => {
  // `FR-060` / `API-021`: "Reproduces the stored record exactly; never
  // regenerates." The app is built with no provider wired at all, so a read
  // path that tried to reason would fail rather than silently spend.
  const { app, calls } = await build();

  await app.inject({ method: "GET", url: `/analyses/${ANALYSIS_ID}` });
  await app.inject({ method: "GET", url: `/analyses/${ANALYSIS_ID}` });

  assert.equal(calls.findUnique.length, 2, "two reads, two queries");
  assert.equal(calls.create.length, 0, "a read writes nothing");
});
