/**
 * Integration — persisting and retrieving a job-description analysis.
 *
 * Covers the write side (`persistRecommendation`, `persistArtifactPlan`,
 * `persistArtifact`) and the read side (`API-021`) against a fake store, so no
 * database, provider or credential is involved.
 *
 * Two properties get the most attention because they are the ones a future
 * change would erode quietly:
 *
 *   · **No confidence is fabricated.** `Recommendation.confidence_band` and
 *     `confidence_factors` are nullable so a pre-Stage-11 verdict can be stored
 *     honestly (`docs/12` D-33). A write that filled them would be inventing
 *     the measurement the whole confidence thread refused to invent.
 *   · **Only valid artifacts are presentable** (`DB §4.4`), while failed ones
 *     are still *stored* — that is what turns an unexplained gap into a
 *     labelled failure (`FR-091`).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createStageResultSink } from "../../src/db/analysis-result-sink.js";
import { buildApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type {
  ContextResult,
  RecommendationResult,
} from "../../src/nie/contracts.js";

const ANALYSIS_ID = "44444444-4444-4444-8444-444444444444";

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "n8n is the automation platform",
      category: "system",
      provenance: "stated",
      specificityScore: 0.9,
      sourceSpanStart: 0,
      sourceSpanEnd: 10,
    },
    {
      content: "Team size is not stated",
      category: "environment",
      provenance: "unknown",
      specificityScore: 0.1,
      resolutionHint: "Ask how many people operate the workflows",
    },
  ],
};

const recommendation: RecommendationResult = {
  requiredCapabilities: [
    {
      id: "req-1",
      name: "HubSpot CRM integration",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      groundedInContextIndices: [0],
    },
    {
      id: "req-2",
      name: "Five years in logistics",
      necessity: "nice_to_have",
      provenance: "stated",
      kind: "domain_experience",
      groundedInContextIndices: [0, 1],
    },
  ],
  matched: [
    {
      requirementId: "req-2",
      capabilityId: "cap-001",
      strength: "partial",
      evidenceRef: "https://example.invalid/evidence",
    },
  ],
  gaps: [
    {
      requirementId: "req-1",
      priority: "high",
      whyItMatters: "Every workflow terminates in HubSpot",
    },
  ],
  verdict: {
    decision: "build_first",
    rationale: "The CRM gap is decisive and buildable.",
    decisiveGaps: ["req-1"],
  },
};

/** Records every write so the tests can assert on what was stored. */
const recordingStore = () => {
  const writes: Record<string, unknown[]> = {
    contextElement: [],
    recommendation: [],
    requiredCapability: [],
    capabilityMatch: [],
    capabilityGap: [],
    contextReference: [],
    artifactPlanEntry: [],
    artifact: [],
    planEntryUpdate: [],
  };
  let seq = 0;
  const id = (prefix: string) => `${prefix}-${String((seq += 1))}`;

  const model = (name: string, idField: string) => ({
    create: ({ data }: { data: Record<string, unknown> }) => {
      writes[name]?.push(data);
      return Promise.resolve({ [idField]: id(name) });
    },
  });

  const client = {
    contextElement: {
      ...model("contextElement", "contextElementId"),
      update: () => Promise.resolve({}),
    },
    analysis: { update: () => Promise.resolve({}) },
    recommendation: model("recommendation", "recommendationId"),
    requiredCapability: model("requiredCapability", "requiredCapabilityId"),
    capabilityMatch: model("capabilityMatch", "matchId"),
    capabilityGap: model("capabilityGap", "gapId"),
    contextReference: model("contextReference", "referenceId"),
    artifactPlanEntry: {
      ...model("artifactPlanEntry", "planEntryId"),
      update: ({ data }: { data: unknown }) => {
        writes["planEntryUpdate"]?.push(data);
        return Promise.resolve({});
      },
    },
    artifact: model("artifact", "artifactId"),
    artifactSchema: {
      findUnique: () => Promise.resolve({ schemaId: "schema-1" }),
    },
  };

  const prisma = {
    ...client,
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  } as unknown as PrismaClient;

  return { prisma, writes };
};

// --- Stage 7 persistence -------------------------------------------------

test("the verdict, requirements, matches and gaps are all stored", async () => {
  const store = recordingStore();
  const sink = createStageResultSink(store.prisma);

  await sink.persistContext(ANALYSIS_ID, context);
  await sink.persistRecommendation?.(ANALYSIS_ID, recommendation);

  assert.equal(store.writes["recommendation"]?.length, 1);
  assert.equal(store.writes["requiredCapability"]?.length, 2);
  assert.equal(store.writes["capabilityMatch"]?.length, 1);
  assert.equal(store.writes["capabilityGap"]?.length, 1);

  const verdict = store.writes["recommendation"]?.[0] as Record<
    string,
    unknown
  >;
  assert.equal(verdict["conclusion"], "build_first");
  assert.equal(verdict["rationale"], "The CRM gap is decisive and buildable.");
  assert.equal(verdict["isNegativeConclusion"], false);
});

test("no confidence is fabricated for a pre-Stage-11 verdict", async () => {
  const store = recordingStore();
  const sink = createStageResultSink(store.prisma);

  await sink.persistContext(ANALYSIS_ID, context);
  await sink.persistRecommendation?.(ANALYSIS_ID, recommendation);

  const verdict = store.writes["recommendation"]?.[0] as Record<
    string,
    unknown
  >;
  for (const field of [
    "confidenceBand",
    "confidenceFactors",
    "criteriaApplied",
    "limits",
  ]) {
    assert.equal(
      verdict[field],
      undefined,
      `${field} must stay null — Stage 11 is deferred (docs/12 D-33)`,
    );
  }
});

test("a decisive gap is marked from the verdict, not stored twice", async () => {
  const store = recordingStore();
  const sink = createStageResultSink(store.prisma);

  await sink.persistContext(ANALYSIS_ID, context);
  await sink.persistRecommendation?.(ANALYSIS_ID, recommendation);

  const gap = store.writes["capabilityGap"]?.[0] as Record<string, unknown>;
  assert.equal(gap["decisive"], true, "req-1 is named in decisive_gaps");
  assert.equal(gap["priority"], "high");
});

test("requirement grounding resolves context indices to persisted ids", async () => {
  const store = recordingStore();
  const sink = createStageResultSink(store.prisma);

  await sink.persistContext(ANALYSIS_ID, context);
  await sink.persistRecommendation?.(ANALYSIS_ID, recommendation);

  // req-1 grounds in one element, req-2 in two.
  assert.equal(store.writes["contextReference"]?.length, 3);
  const reference = store.writes["contextReference"]?.[0] as Record<
    string,
    unknown
  >;
  assert.equal(reference["referencingType"], "recommendation");
  assert.match(String(reference["contextElementId"]), /^contextElement-/);
});

test("persisting a recommendation before its context is refused", async () => {
  const store = recordingStore();
  const sink = createStageResultSink(store.prisma);

  await assert.rejects(
    sink.persistRecommendation?.(ANALYSIS_ID, recommendation) ??
      Promise.resolve(),
    /no context elements were persisted first/,
  );
});

// --- Stage 8 and 9 persistence -------------------------------------------

const plan = [
  {
    artifactType: "portfolio_suggestions" as const,
    planned: true,
    depthLevel: "standard" as const,
    inclusionReason: "One decisive technical gap",
  },
  {
    artifactType: "interview_guidance" as const,
    planned: false,
    depthLevel: "standard" as const,
    omissionReason: "No generator yet",
    outcome: "omitted" as const,
  },
];

test("the plan is stored whole, including the omitted entries", async () => {
  const store = recordingStore();
  const sink = createStageResultSink(store.prisma);

  await sink.persistArtifactPlan?.(ANALYSIS_ID, plan);

  assert.equal(store.writes["artifactPlanEntry"]?.length, 2);
  const omitted = store.writes["artifactPlanEntry"]?.[1] as Record<
    string,
    unknown
  >;
  assert.equal(omitted["outcome"], "omitted");
  assert.equal(omitted["omissionReason"], "No generator yet");
});

test("a valid artifact is stored and its plan entry marked generated", async () => {
  const store = recordingStore();
  const sink = createStageResultSink(store.prisma);

  await sink.persistArtifactPlan?.(ANALYSIS_ID, plan);
  await sink.persistArtifact?.(ANALYSIS_ID, {
    artifactType: "portfolio_suggestions",
    content: { projects: [], consolidation_rationale: "x" },
    depthLevel: "standard",
    generationAttemptCount: 1,
    validationStatus: "valid",
  });

  const artifact = store.writes["artifact"]?.[0] as Record<string, unknown>;
  assert.equal(artifact["validationStatus"], "valid");
  assert.equal(
    artifact["schemaId"],
    "schema-1",
    "references the published row",
  );
  assert.deepEqual(store.writes["planEntryUpdate"]?.[0], {
    outcome: "generated",
  });
});

test("a failed artifact is stored, and its entry marked failed", async () => {
  // `DB §4.4`: "Failed artifacts are stored, not discarded."
  const store = recordingStore();
  const sink = createStageResultSink(store.prisma);

  await sink.persistArtifactPlan?.(ANALYSIS_ID, plan);
  await sink.persistArtifact?.(ANALYSIS_ID, {
    artifactType: "portfolio_suggestions",
    content: { projects: [] },
    depthLevel: "standard",
    generationAttemptCount: 2,
    validationStatus: "failed",
  });

  const artifact = store.writes["artifact"]?.[0] as Record<string, unknown>;
  assert.equal(artifact["validationStatus"], "failed");
  assert.equal(artifact["generationAttemptCount"], 2, "regeneration recorded");
  assert.deepEqual(store.writes["planEntryUpdate"]?.[0], { outcome: "failed" });
});

test("an artifact with no plan entry is refused", async () => {
  const store = recordingStore();
  const sink = createStageResultSink(store.prisma);

  await assert.rejects(
    sink.persistArtifact?.(ANALYSIS_ID, {
      artifactType: "portfolio_suggestions",
      content: {},
      depthLevel: "standard",
      generationAttemptCount: 1,
      validationStatus: "valid",
    }) ?? Promise.resolve(),
    /no plan entry was persisted/,
  );
});

// --- API-021 retrieval ----------------------------------------------------

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  port: 0,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const storedAnalysis = (
  artifactOverrides: Record<string, unknown> | null = {
    validationStatus: "valid",
    content: { projects: [{ rank: 1, name: "HubSpot sync" }] },
  },
) => ({
  analysisId: ANALYSIS_ID,
  status: "completed",
  createdAt: new Date("2026-09-06T10:00:00.000Z"),
  completedAt: new Date("2026-09-06T10:00:30.000Z"),
  derivedTitle: "Automation Engineer",
  sufficiencyLevel: "sufficient",
  overallConfidenceBand: null,
  degradationFlag: false,
  timeoutFlag: false,
  input: { characterCount: 400, sourceType: "paste" },
  classification: {
    determinedType: "job_description",
    confidence: 0.92,
    candidateTypes: [],
    wasLowConfidence: false,
    userOverrideType: null,
    overriddenAt: null,
  },
  intentRecord: {
    primaryObjective: "Understand fit for the role",
    inferredScope: "Lead capture through CRM",
    objectiveProvenance: { primary: "inferred" },
  },
  contextElements: [
    {
      content: "n8n is the platform",
      category: "system",
      provenance: "stated",
      specificityScore: 0.9,
      sourceSpanStart: 0,
      sourceSpanEnd: 10,
      inferenceBasis: null,
      resolutionHint: null,
    },
    {
      content: "Team size unknown",
      category: "environment",
      provenance: "unknown",
      specificityScore: 0.1,
      sourceSpanStart: null,
      sourceSpanEnd: null,
      inferenceBasis: null,
      resolutionHint: "Ask how many operators there are",
    },
  ],
  recommendations: [
    {
      conclusion: "build_first",
      rationale: "The CRM gap is decisive.",
      confidenceBand: null,
      confidenceFactors: null,
      alternatives: [],
    },
  ],
  requiredCapabilities: [
    {
      externalId: "req-1",
      name: "HubSpot CRM integration",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      ordinal: 0,
      matches: [],
      gaps: [
        {
          priority: "high",
          whyItMatters: "Terminates in HubSpot",
          decisive: true,
        },
      ],
    },
  ],
  artifactPlanEntries: [
    {
      artifactType: "portfolio_suggestions",
      planned: true,
      outcome: artifactOverrides === null ? "failed" : "generated",
      inclusionReason: "One decisive gap",
      omissionReason: null,
      artifact: artifactOverrides,
    },
    {
      artifactType: "interview_guidance",
      planned: false,
      outcome: "omitted",
      inclusionReason: null,
      omissionReason: "No generator yet",
      artifact: null,
    },
  ],
});

const appWith = async (analysis: unknown) =>
  buildApp({
    config,
    database: {
      prisma: {
        healthCheck: { findFirst: () => Promise.resolve(null) },
        analysis: { findUnique: () => Promise.resolve(analysis) },
      },
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    checkProvider: () => Promise.resolve(),
    checkTemplates: () => Promise.resolve(),
    hashContent: () => "deadbeef",
  });

test("API-021 returns the complete job-description answer", async () => {
  const app = await appWith(storedAnalysis());
  const response = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}`,
  });

  assert.equal(response.statusCode, 200);
  const { data } = response.json() as { data: Record<string, unknown> };

  assert.equal(
    (data["verdict"] as Record<string, unknown>)["decision"],
    "build_first",
  );
  assert.match(
    String((data["verdict"] as Record<string, unknown>)["rationale"]),
    /decisive/,
  );
  assert.deepEqual(data["decisive_gaps"], ["req-1"]);
  assert.equal((data["requirements"] as unknown[]).length, 1);
  assert.equal((data["context"] as unknown[]).length, 2);
  assert.equal(
    (data["unknowns"] as unknown[]).length,
    1,
    "FR-044 — unknowns surfaced, not left to be filtered out",
  );
  assert.ok(data["intent"], "the problem as understood leads (FR-040)");
});

test("API-021 exposes provenance and resolution hints", async () => {
  const app = await appWith(storedAnalysis());
  const { data } = (
    await app.inject({ method: "GET", url: `/analyses/${ANALYSIS_ID}` })
  ).json() as { data: Record<string, unknown> };

  const elements = data["context"] as Record<string, unknown>[];
  assert.deepEqual(
    elements.map((e) => e["provenance"]),
    ["stated", "unknown"],
    "FR-043 — stated and inferred are distinguished wherever displayed",
  );
  const unknown = (data["unknowns"] as Record<string, unknown>[])[0];
  assert.match(String(unknown?.["resolution_hint"]), /how many operators/);
});

test("API-021 reports null confidence rather than a fabricated band", async () => {
  const app = await appWith(storedAnalysis());
  const { data } = (
    await app.inject({ method: "GET", url: `/analyses/${ANALYSIS_ID}` })
  ).json() as { data: Record<string, unknown> };

  const verdict = data["verdict"] as Record<string, unknown>;
  assert.equal(verdict["confidence_band"], null);
  assert.equal(verdict["confidence_factors"], null);
  assert.equal(data["overall_confidence_band"], null);
});

test("only a valid artifact's content is presentable", async () => {
  const valid = await appWith(storedAnalysis());
  const shown = (
    await valid.inject({ method: "GET", url: `/analyses/${ANALYSIS_ID}` })
  ).json() as { data: { artifacts: Record<string, unknown>[] } };

  const generated = shown.data.artifacts[0];
  assert.equal(generated?.["outcome"], "generated");
  assert.ok(generated?.["content"], "a valid artifact is returned");

  // The same analysis, but the artifact failed validation.
  const failedApp = await appWith(
    storedAnalysis({ validationStatus: "failed", content: { projects: [] } }),
  );
  const hidden = (
    await failedApp.inject({ method: "GET", url: `/analyses/${ANALYSIS_ID}` })
  ).json() as { data: { artifacts: Record<string, unknown>[] } };

  const failed = hidden.data.artifacts[0];
  assert.equal(failed?.["validation_status"], "failed");
  assert.equal(
    failed?.["content"],
    null,
    "DB §4.4 — only valid artifacts are presentable",
  );
});

test("omitted and failed artifacts stay distinguishable", async () => {
  const app = await appWith(storedAnalysis());
  const { data } = (
    await app.inject({ method: "GET", url: `/analyses/${ANALYSIS_ID}` })
  ).json() as { data: { artifacts: Record<string, unknown>[] } };

  const omitted = data.artifacts[1];
  assert.equal(omitted?.["outcome"], "omitted");
  assert.equal(omitted?.["planned"], false);
  assert.match(String(omitted?.["omission_reason"]), /No generator/);
  assert.equal(
    omitted?.["validation_status"],
    null,
    "FR-091 — an omission is a decision, not a failed generation",
  );
});

test("the widened response still exposes no trace, fragment or provider detail", async () => {
  const app = await appWith(storedAnalysis());
  const response = await app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}`,
  });

  const raw = response.body.toLowerCase();
  for (const forbidden of [
    "fragment",
    "prompt",
    "provider",
    "anthropic",
    "stage_trace",
    "stagetrace",
    "model_version",
    "raw_content",
    "schema_id",
  ]) {
    assert.ok(!raw.includes(forbidden), `body must not mention "${forbidden}"`);
  }
});
