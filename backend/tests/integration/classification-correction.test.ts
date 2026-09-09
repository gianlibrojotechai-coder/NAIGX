/**
 * Integration — classification correction (`FR-014`, `API §7.5`).
 *
 * THE PROPERTY THAT MATTERS IS THAT NOTHING IS MUTATED. `API §7.5`: "The
 * contract deliberately does **not** mutate the original analysis" — `DB DP-3`
 * makes analyses immutable, and re-running reasoning under a different frame
 * produces a genuinely different analysis. An endpoint that updated the
 * original "would destroy both the record of what the system originally
 * concluded and the accuracy signal".
 *
 * So these tests check the four steps of §7.5 in order: the submission carries
 * an override, a **new** analysis is created with the type fixed, the override
 * is recorded, and the original is untouched and still retrievable.
 *
 * NO PROVIDER IS INVOLVED. A corrected run skips Stage 1 entirely — the type
 * was decided by the user, so asking a model to determine it would spend a
 * request to produce an answer that is then discarded.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import { createPipeline } from "../../src/nie/pipeline.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import type { ClassificationType } from "../../src/nie/contracts.js";

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

const ORIGINAL_ID = "11111111-aaaa-4aaa-8aaa-111111111111";
const NEW_ID = "22222222-bbbb-4bbb-8bbb-222222222222";

const CONTENT =
  "A long enough submission to pass the fifty character minimum that FR-002 sets.";

interface Recorded {
  readonly created: Record<string, unknown>[];
  readonly started: { id: string; override?: string }[];
}

const harness = (options: { originalExists?: boolean } = {}) => {
  const recorded: Recorded = { created: [], started: [] };

  const database = {
    prisma: {
      healthCheck: { findFirst: () => Promise.resolve(null) },
      analysis: {
        create: ({ data }: { data: Record<string, unknown> }) => {
          recorded.created.push(data);
          return Promise.resolve({ analysisId: NEW_ID, status: "queued" });
        },
        findUnique: () =>
          Promise.resolve(
            options.originalExists === false
              ? null
              : { analysisId: ORIGINAL_ID },
          ),
      },
    },
    disconnect: () => Promise.resolve(),
  } as unknown as Database;

  return { recorded, database };
};

const post = async (
  body: Record<string, unknown>,
  options: { originalExists?: boolean } = {},
) => {
  const { recorded, database } = harness(options);
  const app = await buildApp({
    config,
    database,
    startExecution: (id, override) => {
      recorded.started.push({
        id,
        ...(override !== undefined ? { override } : {}),
      });
    },
  });
  const res = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: body,
  });
  await app.close();
  return { res, recorded };
};

// --- API §7.5 steps 1-4 -----------------------------------------------------

test("§7.5 step 1-2 — an override creates a new analysis with the type fixed", async () => {
  const { res, recorded } = await post({
    content: CONTENT,
    classification_override: "existing_workflow",
    supersedes_analysis_id: ORIGINAL_ID,
  });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 202);
  // A *new* id, never the original.
  assert.equal(body.data.analysis_id, NEW_ID);
  assert.notEqual(body.data.analysis_id, ORIGINAL_ID);
  assert.equal(body.data.classification_override, "existing_workflow");

  // The type reaches execution, which is what fixes Stage 1.
  assert.deepEqual(recorded.started, [
    { id: NEW_ID, override: "existing_workflow" },
  ]);
});

test("§7.5 step 4 — the original is never written to", async () => {
  // The whole point of the contract. Only one row is created, and no update of
  // any kind is issued: the harness would have thrown on `update`, which it
  // does not implement.
  const { recorded } = await post({
    content: CONTENT,
    classification_override: "job_description",
    supersedes_analysis_id: ORIGINAL_ID,
  });

  assert.equal(recorded.created.length, 1);
  assert.notEqual(recorded.created[0]?.["analysisId"], ORIGINAL_ID);
});

test("FR-064 — the correction records which analysis it supersedes", async () => {
  const { recorded } = await post({
    content: CONTENT,
    classification_override: "technical_assessment",
    supersedes_analysis_id: ORIGINAL_ID,
  });

  assert.equal(recorded.created[0]?.["supersedesAnalysisId"], ORIGINAL_ID);
});

test("a correction without a lineage id is still accepted", async () => {
  // `API §7.5` describes only "the same content" plus the override; the
  // lineage pointer is additional, not required.
  const { res, recorded } = await post({
    content: CONTENT,
    classification_override: "business_requirement",
  });

  assert.equal(res.statusCode, 202);
  assert.equal("supersedesAnalysisId" in (recorded.created[0] ?? {}), false);
  assert.equal(JSON.parse(res.body).data.supersedes_analysis_id, undefined);
});

// --- validation -------------------------------------------------------------

test("an unrecognised override is refused with the correctable set", async () => {
  const { res } = await post({
    content: CONTENT,
    classification_override: "invoice",
  });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 400);
  assert.equal(body.error.code, "validation_failed");
  assert.equal(body.error.field, "classification_override");
  assert.deepEqual(body.error.details.correctable_types, [
    "business_requirement",
    "existing_workflow",
    "job_description",
    "technical_assessment",
  ]);
});

test("`unsupported` cannot be chosen as a correction", async () => {
  // It is a refusal outcome (`FR-092`), not a frame anything reasons under.
  // Accepting it would ask the pipeline to decline on the user's instruction.
  const { res } = await post({
    content: CONTENT,
    classification_override: "unsupported",
  });

  assert.equal(res.statusCode, 400);
  assert.equal(
    JSON.parse(res.body).error.details.correctable_types.includes(
      "unsupported",
    ),
    false,
  );
});

test("a lineage id naming no analysis is refused", async () => {
  // A pointer to an analysis nobody can retrieve claims a history that does
  // not exist.
  const { res } = await post(
    {
      content: CONTENT,
      classification_override: "job_description",
      supersedes_analysis_id: "33333333-cccc-4ccc-8ccc-333333333333",
    },
    { originalExists: false },
  );
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 400);
  assert.equal(body.error.field, "supersedes_analysis_id");
  assert.match(body.error.action, /omit the field/i);
});

test("content validation still applies to a correction", async () => {
  const { res } = await post({
    content: "too short",
    classification_override: "job_description",
  });

  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, "content_too_short");
});

// --- what must not change ---------------------------------------------------

test("an ordinary submission is unchanged and carries no override", async () => {
  const { res, recorded } = await post({ content: CONTENT });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 202);
  assert.equal(body.data.classification_override, undefined);
  assert.deepEqual(recorded.started, [{ id: NEW_ID }]);
});

// --- the pipeline seam ------------------------------------------------------

test("FR-014 — an overridden run fixes Stage 1 instead of calling a provider", async () => {
  // "Reclassification re-runs the pipeline from FR-011 with the user's type
  // fixed." Asserted with an invoker that records every call and then fails:
  // the run cannot complete without fixtures, and that is fine — the claim is
  // about which stages reached a provider, not about finishing.
  const called: string[] = [];

  const pipeline = createPipeline({
    invoker: {
      invoke: (request: { readonly task: string }) => {
        called.push(request.task);
        return Promise.reject(new Error("no fixtures beyond Stage 1"));
      },
    },
    resolver: {
      resolve: (keys: readonly string[]) =>
        Promise.resolve(
          keys.map((fragmentKey) => ({
            fragmentKey,
            fragmentVersionId: `ver-${fragmentKey}`,
            version: "1.0",
            content: `[${fragmentKey}]`,
          })),
        ),
    },
    traceSink: { record: () => Promise.resolve() },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    modelKey: "replay-model",
    now: () => new Date(0),
    newId: () => "trace-1",
  } as never);

  await assert.rejects(
    pipeline.run({
      analysisId: NEW_ID,
      text: CONTENT,
      classificationOverride: "existing_workflow" as ClassificationType,
    }),
  );

  // The point: Stage 1 never asked. The first provider call the run made was
  // for a *later* stage, so the classification came from the user.
  assert.equal(
    called.includes("input_classification"),
    false,
    `classification reached a provider despite an override: ${called.join(", ")}`,
  );
  assert.ok(called.length > 0, "the run stopped before any stage ran at all");
});

test("without an override, Stage 1 does ask a provider", async () => {
  // The control for the test above. If classification never called a provider
  // in either case, that test would pass for the wrong reason.
  const called: string[] = [];

  const pipeline = createPipeline({
    invoker: {
      invoke: (request: { readonly task: string }) => {
        called.push(request.task);
        return Promise.reject(new Error("no fixtures"));
      },
    },
    resolver: {
      resolve: (keys: readonly string[]) =>
        Promise.resolve(
          keys.map((fragmentKey) => ({
            fragmentKey,
            fragmentVersionId: `ver-${fragmentKey}`,
            version: "1.0",
            content: `[${fragmentKey}]`,
          })),
        ),
    },
    traceSink: { record: () => Promise.resolve() },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    modelKey: "replay-model",
    now: () => new Date(0),
    newId: () => "trace-1",
  } as never);

  await assert.rejects(pipeline.run({ analysisId: NEW_ID, text: CONTENT }));

  assert.equal(called[0], "input_classification");
});
