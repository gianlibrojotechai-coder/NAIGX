/**
 * Integration — job-description persistence against **real Postgres**.
 *
 * The offline suite proves the sink calls the right methods with the right
 * data. It cannot prove the database accepts them. Everything the fake could
 * not model lives here: enum values Postgres will actually take, foreign keys
 * that must resolve, the unique index on `(analysis_id, external_id)`, the
 * `RESTRICT` from `artifact.schema_id`, and — the one that already caught a
 * defect — what `jsonb` does to a document on the way back out.
 *
 * NO PROVIDER IS INVOLVED. The sink is fed decoded stage results directly, so
 * this exercises persistence and retrieval only. Nothing here costs money.
 *
 * REQUIRES THE PRIMARY DATABASE. Unreachable means skip locally and fail in
 * CI, matching `nie-real-infrastructure.test.ts` — a skip is visible, a false
 * pass is not.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client.js";
import { createStageResultSink } from "../../src/db/analysis-result-sink.js";
import {
  definitionsMatch,
  publishArtifactSchema,
  requirePublishedSchemaId,
} from "../../src/db/artifact-schema-publisher.js";
import {
  ARTIFACT_SCHEMA_VERSION,
  loadArtifactSchemaDefinition,
} from "../../src/nie/artifact-validation.js";
import { buildApp } from "../../src/app.js";
import { anonymousCredential } from "../helpers/anonymous-principal.js";

/** Ownership is enforced from `M-15`; the seeded analysis carries this. */
const credential = anonymousCredential();
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import type {
  ContextResult,
  RecommendationResult,
} from "../../src/nie/contracts.js";

const reachable = async (url: string | undefined): Promise<boolean> => {
  if (url === undefined || url === "") return false;
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
};

const DATABASE_AVAILABLE = await reachable(process.env["DATABASE_URL"]);
const DATABASE_REQUIRED =
  process.env["CI"] === "true" || process.env["REQUIRE_DB_TESTS"] === "1";

if (!DATABASE_AVAILABLE && DATABASE_REQUIRED) {
  throw new Error(
    "Database-backed persistence tests are mandatory here " +
      `(CI=${String(process.env["CI"])}, REQUIRE_DB_TESTS=${String(process.env["REQUIRE_DB_TESTS"])}) ` +
      "but DATABASE_URL is unreachable. Provision the primary store — see docker-compose.yml.",
  );
}

const skip = DATABASE_AVAILABLE
  ? false
  : "requires DATABASE_URL to be reachable (set REQUIRE_DB_TESTS=1 to make this an error)";

const clients = () => {
  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
    close: () => pool.end(),
  };
};

/** A bare analysis row. Every new table cascades from it, so cleanup is one delete. */
const seedAnalysis = async (prisma: PrismaClient): Promise<string> => {
  const analysis = await prisma.analysis.create({
    // A real credential, not a placeholder string: ownership is enforced
    // from `M-15`, so the read below has to present the token this hashes.
    data: { status: "running", anonymousTokenHash: credential.tokenHash },
  });
  return analysis.analysisId;
};

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "The team runs n8n on a self-hosted instance",
      category: "system",
      provenance: "stated",
      specificityScore: 0.9,
      sourceSpanStart: 0,
      sourceSpanEnd: 42,
    },
    {
      content: "How many people operate the workflows is not stated",
      category: "environment",
      provenance: "unknown",
      specificityScore: 0.1,
      resolutionHint: "Ask how many operators there are",
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
      provenance: "inferred",
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
    criteriaApplied:
      "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when nothing in the profile evidences it.",
    alternatives: [
      {
        alternative: "Apply now without building",
        rejectionReason: "The decisive gap has no evidence behind it.",
      },
    ],
  },
};

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
    omissionReason: "No generator exists yet",
    outcome: "omitted" as const,
  },
];

const SUGGESTIONS = {
  projects: [
    {
      rank: 1,
      name: "HubSpot contact sync",
      addresses_gaps: ["req-1"],
      why_this_closes_the_gap: "Demonstrates the integration the role requires",
      scope: "One workflow, upsert by email",
      evidence_of_completion: "A public repository and a recorded run",
    },
  ],
  consolidation_rationale: "One project closes the single decisive gap.",
};

// --- the published schema row --------------------------------------------

test(
  "the declared-version portfolio_suggestions schema is published",
  { skip },
  async () => {
    const { prisma, close } = clients();
    try {
      // Publication is idempotent, so this is safe to run against a store that
      // already has the row — and proves it either way.
      await publishArtifactSchema(prisma, "portfolio_suggestions");

      const row = await prisma.artifactSchema.findUnique({
        where: {
          artifactType_version: {
            artifactType: "portfolio_suggestions",
            version: ARTIFACT_SCHEMA_VERSION,
          },
        },
      });

      assert.ok(row, "the row an ARTIFACT references must exist");
      // D-70: the declared version, not a literal — it moved to "2" when the
      // portfolio schema gained `implementation`.
      assert.equal(row.version, ARTIFACT_SCHEMA_VERSION);
      assert.ok(
        definitionsMatch(
          row.definition,
          loadArtifactSchemaDefinition("portfolio_suggestions"),
        ),
        "the stored definition still says what the authored file says",
      );
    } finally {
      await close();
    }
  },
);

test(
  "a jsonb round-trip reorders keys without changing content",
  { skip },
  async () => {
    // The defect this file caught. Postgres normalises `jsonb` objects, so the
    // definition returns with its keys sorted by length then bytewise. Content
    // is preserved; byte-for-byte ordering is not, and a comparison that
    // assumed otherwise reported a false immutability violation on the very
    // first publication.
    const { prisma, close } = clients();
    try {
      const row = await prisma.artifactSchema.findUnique({
        where: {
          artifactType_version: {
            artifactType: "portfolio_suggestions",
            version: ARTIFACT_SCHEMA_VERSION,
          },
        },
      });
      const authored = loadArtifactSchemaDefinition("portfolio_suggestions");

      assert.ok(row);
      assert.deepEqual(
        row.definition,
        authored,
        "semantically identical — this is what matters",
      );
      assert.ok(
        definitionsMatch(row.definition, authored),
        "and the comparison the publisher uses agrees",
      );
    } finally {
      await close();
    }
  },
);

// --- Stage 7 -------------------------------------------------------------

test(
  "requirements, matches, gaps and grounding all land in Postgres",
  { skip },
  async () => {
    const { prisma, close } = clients();
    const analysisId = await seedAnalysis(prisma);
    try {
      const sink = createStageResultSink(prisma);
      await sink.persistContext(analysisId, context);
      await sink.persistRecommendation?.(analysisId, recommendation);

      const requirements = await prisma.requiredCapability.findMany({
        where: { analysisId },
        orderBy: { ordinal: "asc" },
        include: { matches: true, gaps: true },
      });

      assert.equal(requirements.length, 2);
      assert.deepEqual(
        requirements.map((r) => r.externalId),
        ["req-1", "req-2"],
        "ordinal survives the round trip, so the order is recoverable",
      );

      // Every enum value the domain uses is one Postgres actually accepts —
      // a mismatch the fake could not have caught.
      assert.equal(requirements[0]?.necessity, "must_have");
      assert.equal(requirements[0]?.kind, "technical");
      assert.equal(requirements[0]?.provenance, "stated");
      assert.equal(requirements[1]?.necessity, "nice_to_have");
      assert.equal(requirements[1]?.kind, "domain_experience");
      assert.equal(requirements[1]?.provenance, "inferred");

      const gap = requirements[0]?.gaps[0];
      assert.equal(gap?.priority, "high");
      assert.equal(gap?.decisive, true, "named in decisive_gaps");
      assert.equal(requirements[0]?.matches.length, 0);

      const match = requirements[1]?.matches[0];
      assert.equal(match?.capabilityId, "cap-001");
      assert.equal(match?.strength, "partial");
      assert.equal(requirements[1]?.gaps.length, 0);

      // Grounding: req-1 in one element, req-2 in two, resolved to real ids.
      const elementIds = (
        await prisma.contextElement.findMany({
          where: { analysisId },
          select: { contextElementId: true },
        })
      ).map((e) => e.contextElementId);
      const references = await prisma.contextReference.findMany({
        where: { contextElementId: { in: elementIds } },
      });

      assert.equal(references.length, 3);
      assert.ok(
        references.every((r) => r.referencingType === "recommendation"),
        "grounding points back at the recommendation it justifies",
      );
      assert.ok(
        references.every((r) => elementIds.includes(r.contextElementId)),
        "every reference resolves to a persisted element (FR-030)",
      );
    } finally {
      await prisma.analysis.delete({ where: { analysisId } });
      await close();
    }
  },
);

test(
  "no confidence is stored, and Postgres accepts that",
  { skip },
  async () => {
    // The four columns this migration made nullable. If any were still NOT NULL
    // the insert would fail here rather than pass silently.
    const { prisma, close } = clients();
    const analysisId = await seedAnalysis(prisma);
    try {
      const sink = createStageResultSink(prisma);
      await sink.persistContext(analysisId, context);
      await sink.persistRecommendation?.(analysisId, recommendation);

      const stored = await prisma.recommendation.findFirst({
        where: { analysisId },
      });

      assert.ok(stored);
      assert.equal(stored.conclusion, "build_first");
      assert.equal(stored.confidenceBand, null, "Stage 11 is deferred (D-33)");
      assert.equal(stored.confidenceFactors, null);
      assert.equal(stored.limits, null);

      // Criteria are NOT deferred. The column is non-nullable again
      // (`AIP-4`/`DD-04`), so a criteria-less recommendation is now
      // unrepresentable rather than merely discouraged.
      assert.equal(
        stored.criteriaApplied,
        recommendation.verdict.criteriaApplied,
      );

      const alternatives = await prisma.recommendationAlternative.findMany({
        where: { recommendationId: stored.recommendationId },
        orderBy: { ordinal: "asc" },
      });
      assert.ok(
        alternatives.length >= 1,
        "FR-034 — at least one rejected alternative, stored countably",
      );
      assert.equal(
        alternatives[0]?.alternative,
        recommendation.verdict.alternatives[0]?.alternative,
      );
      assert.equal(
        alternatives[0]?.rejectionReason,
        recommendation.verdict.alternatives[0]?.rejectionReason,
      );
    } finally {
      await prisma.analysis.delete({ where: { analysisId } });
      await close();
    }
  },
);

test(
  "a duplicate requirement id is rejected by the index",
  { skip },
  async () => {
    // `@@unique([analysisId, externalId])` — a requirement id is how gaps and
    // matches are addressed, so two of them within one analysis is a corruption
    // the database refuses rather than a duplicate the reader has to notice.
    const { prisma, close } = clients();
    const analysisId = await seedAnalysis(prisma);
    try {
      await prisma.requiredCapability.create({
        data: {
          analysisId,
          externalId: "req-1",
          name: "First",
          necessity: "must_have",
          provenance: "stated",
          kind: "technical",
          ordinal: 0,
        },
      });

      await assert.rejects(
        prisma.requiredCapability.create({
          data: {
            analysisId,
            externalId: "req-1",
            name: "Second",
            necessity: "must_have",
            provenance: "stated",
            kind: "technical",
            ordinal: 1,
          },
        }),
        /Unique constraint/,
      );
    } finally {
      await prisma.analysis.delete({ where: { analysisId } });
      await close();
    }
  },
);

// --- Stages 8 and 9 -------------------------------------------------------

test(
  "the plan, the artifact and its schema reference all persist",
  { skip },
  async () => {
    const { prisma, close } = clients();
    const analysisId = await seedAnalysis(prisma);
    try {
      const sink = createStageResultSink(prisma);
      await sink.persistArtifactPlan?.(analysisId, plan);
      await sink.persistArtifact?.(analysisId, {
        artifactType: "portfolio_suggestions",
        content: SUGGESTIONS,
        depthLevel: "standard",
        generationAttemptCount: 1,
        validationStatus: "valid",
      });

      const entries = await prisma.artifactPlanEntry.findMany({
        where: { analysisId },
        orderBy: { artifactType: "asc" },
        include: { artifact: true },
      });

      const guidance = entries.find(
        (e) => e.artifactType === "interview_guidance",
      );
      assert.equal(guidance?.planned, false);
      assert.equal(guidance?.outcome, "omitted");
      assert.match(String(guidance?.omissionReason), /No generator/);
      assert.equal(
        guidance?.artifact,
        null,
        "an omission has no artifact, and that is the distinction FR-091 needs",
      );

      const suggestions = entries.find(
        (e) => e.artifactType === "portfolio_suggestions",
      );
      assert.equal(suggestions?.planned, true);
      assert.equal(
        suggestions?.outcome,
        "generated",
        "the plan entry is updated by the artifact write",
      );

      const artifact = suggestions?.artifact;
      assert.ok(artifact, "the artifact row exists");
      assert.equal(artifact.validationStatus, "valid");
      assert.equal(artifact.generationAttemptCount, 1);
      assert.deepEqual(
        artifact.content,
        SUGGESTIONS,
        "the wire document is retrieved whole (DP-1)",
      );

      // The durable reference: the id on the row is the id of the published
      // schema, not a value invented at write time.
      assert.equal(
        artifact.schemaId,
        await requirePublishedSchemaId(prisma, "portfolio_suggestions"),
      );
    } finally {
      await prisma.analysis.delete({ where: { analysisId } });
      await close();
    }
  },
);

test(
  "a failed artifact is stored rather than discarded",
  { skip },
  async () => {
    const { prisma, close } = clients();
    const analysisId = await seedAnalysis(prisma);
    try {
      const sink = createStageResultSink(prisma);
      await sink.persistArtifactPlan?.(analysisId, plan);
      await sink.persistArtifact?.(analysisId, {
        artifactType: "portfolio_suggestions",
        // Missing `consolidation_rationale` — the document that failed.
        content: { projects: [] },
        depthLevel: "standard",
        generationAttemptCount: 2,
        validationStatus: "failed",
      });

      const entry = await prisma.artifactPlanEntry.findFirst({
        where: { analysisId, artifactType: "portfolio_suggestions" },
        include: { artifact: true },
      });

      assert.equal(entry?.outcome, "failed", "distinguishable from omitted");
      assert.ok(entry?.artifact, "DB §4.4 — failed artifacts are stored");
      assert.equal(entry.artifact.validationStatus, "failed");
      assert.equal(
        entry.artifact.generationAttemptCount,
        2,
        "the regeneration attempt is recorded",
      );
    } finally {
      await prisma.analysis.delete({ where: { analysisId } });
      await close();
    }
  },
);

test(
  "a published schema cannot be deleted while an artifact cites it",
  { skip },
  async () => {
    // `ON DELETE RESTRICT` on `artifact.schema_id`. Without it, deleting a schema
    // would orphan every `validation_status` that referenced it.
    const { prisma, close } = clients();
    const analysisId = await seedAnalysis(prisma);
    try {
      const sink = createStageResultSink(prisma);
      await sink.persistArtifactPlan?.(analysisId, plan);
      await sink.persistArtifact?.(analysisId, {
        artifactType: "portfolio_suggestions",
        content: SUGGESTIONS,
        depthLevel: "standard",
        generationAttemptCount: 1,
        validationStatus: "valid",
      });

      const schemaId = await requirePublishedSchemaId(
        prisma,
        "portfolio_suggestions",
      );

      await assert.rejects(
        prisma.artifactSchema.delete({ where: { schemaId } }),
        /Foreign key constraint|violates foreign key/,
      );
    } finally {
      await prisma.analysis.delete({ where: { analysisId } });
      await close();
    }
  },
);

// --- API-021 over real rows ----------------------------------------------

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

/** Writes a full job-description analysis and returns it through API-021. */
const persistAndRetrieve = async (
  prisma: PrismaClient,
  validationStatus: "valid" | "failed",
) => {
  const analysisId = await seedAnalysis(prisma);
  const sink = createStageResultSink(prisma);

  await sink.persistContext(analysisId, context);
  await sink.persistRecommendation?.(analysisId, recommendation);
  await sink.persistArtifactPlan?.(analysisId, plan);
  await sink.persistArtifact?.(analysisId, {
    artifactType: "portfolio_suggestions",
    content: SUGGESTIONS,
    depthLevel: "standard",
    generationAttemptCount: 1,
    validationStatus,
  });

  const app = await buildApp({
    config,
    database: {
      prisma,
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    hashContent: () => "unused",
  });
  const response = await app.inject({
    method: "GET",
    url: `/analyses/${analysisId}`,
    headers: credential.header,
  });
  await app.close();

  return { analysisId, response };
};

test(
  "API-021 reproduces the stored analysis as a complete answer",
  { skip },
  async () => {
    const { prisma, close } = clients();
    const { analysisId, response } = await persistAndRetrieve(prisma, "valid");
    try {
      assert.equal(response.statusCode, 200);
      const { data } = response.json() as { data: Record<string, unknown> };

      const verdict = data["verdict"] as Record<string, unknown>;
      assert.equal(verdict["decision"], "build_first");
      assert.match(String(verdict["rationale"]), /decisive/);
      assert.equal(verdict["confidence_band"], null, "not fabricated");

      assert.deepEqual(data["decisive_gaps"], ["req-1"]);
      assert.equal((data["requirements"] as unknown[]).length, 2);
      assert.equal((data["context"] as unknown[]).length, 2);
      assert.equal(
        (data["unknowns"] as unknown[]).length,
        1,
        "FR-044 — the unknown is surfaced, not buried in the context set",
      );
      assert.equal(data["sufficiency_level"], "sufficient");

      // The whole point of the increment: the suggestions survive the round
      // trip and come back through the API.
      const artifacts = data["artifacts"] as Record<string, unknown>[];
      const suggestions = artifacts.find(
        (a) => a["artifact_type"] === "portfolio_suggestions",
      );
      assert.equal(suggestions?.["outcome"], "generated");
      assert.deepEqual(suggestions?.["content"], SUGGESTIONS);

      const omitted = artifacts.find(
        (a) => a["artifact_type"] === "interview_guidance",
      );
      assert.equal(omitted?.["outcome"], "omitted");
      assert.equal(omitted?.["content"], null);
      assert.equal(omitted?.["validation_status"], null);
    } finally {
      await prisma.analysis.delete({ where: { analysisId } });
      await close();
    }
  },
);

test("a failed artifact's content is never presented", { skip }, async () => {
  const { prisma, close } = clients();
  const { analysisId, response } = await persistAndRetrieve(prisma, "failed");
  try {
    const { data } = response.json() as {
      data: { artifacts: Record<string, unknown>[] };
    };
    const suggestions = data.artifacts.find(
      (a) => a["artifact_type"] === "portfolio_suggestions",
    );

    assert.equal(suggestions?.["outcome"], "failed");
    assert.equal(suggestions?.["validation_status"], "failed");
    assert.equal(
      suggestions?.["content"],
      null,
      "DB §4.4 — only valid artifacts are presentable, even though the row exists",
    );

    // Stored, though. The failure is visible in the database even while it is
    // withheld from the client.
    const row = await prisma.artifact.findFirst({ where: { analysisId } });
    assert.ok(row, "the failed document is retained for diagnosis");
  } finally {
    await prisma.analysis.delete({ where: { analysisId } });
    await close();
  }
});

test(
  "the response carries no trace, fragment or provider detail",
  { skip },
  async () => {
    const { prisma, close } = clients();
    const { analysisId, response } = await persistAndRetrieve(prisma, "valid");
    try {
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
        "required_capability_id",
      ]) {
        assert.ok(
          !raw.includes(forbidden),
          `API-021 must not expose "${forbidden}"`,
        );
      }
    } finally {
      await prisma.analysis.delete({ where: { analysisId } });
      await close();
    }
  },
);

test(
  "deleting the analysis removes every new row it owns",
  { skip },
  async () => {
    // `ON DELETE CASCADE` across all five new tables, which is what makes the
    // `DB §8.3` retention sweep able to purge an analysis in one statement.
    const { prisma, close } = clients();
    const { analysisId } = await persistAndRetrieve(prisma, "valid");
    try {
      await prisma.analysis.delete({ where: { analysisId } });

      assert.equal(
        await prisma.requiredCapability.count({ where: { analysisId } }),
        0,
      );
      assert.equal(
        await prisma.artifactPlanEntry.count({ where: { analysisId } }),
        0,
      );
      assert.equal(await prisma.artifact.count({ where: { analysisId } }), 0);
      assert.equal(
        await prisma.recommendation.count({ where: { analysisId } }),
        0,
      );
    } finally {
      await close();
    }
  },
);

// --- API-020 against the real constraints ---------------------------------

test(
  "API-020 creates an analysis Postgres will actually accept",
  { skip },
  async () => {
    // ⚠️ REGRESSION. `analysis_exactly_one_owner_check` (`DP-8`, `FR-004`)
    // requires exactly one of `user_id` / `anonymous_token_hash`, and the
    // create handler set neither — so every submission returned 500 against a
    // real database while the fake-Prisma contract tests passed. The route now
    // stores an anonymous owner. This test exists because only a real database
    // has the constraint that catches it.
    const { prisma, close } = clients();
    const app = await buildApp({
      config,
      database: {
        prisma,
        disconnect: () => Promise.resolve(),
      } as unknown as Database,
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyses",
      payload: {
        content:
          "We are hiring an Automation Engineer to own the lead-to-CRM pipeline, building n8n workflows that sync inbound leads into HubSpot with retries.",
        source_type: "paste",
      },
    });
    await app.close();

    assert.equal(response.statusCode, 202, response.body);
    const { data } = response.json() as { data: { analysis_id: string } };

    try {
      const stored = await prisma.analysis.findUnique({
        where: { analysisId: data.analysis_id },
        include: { input: true },
      });

      assert.ok(stored, "the row was committed");
      assert.equal(stored.status, "queued");
      assert.equal(stored.userId, null, "no user is authenticated yet");
      assert.notEqual(
        stored.anonymousTokenHash,
        null,
        "an anonymous owner satisfies the exactly-one-owner constraint",
      );
      assert.ok(stored.input, "the input landed in the same transaction");
    } finally {
      await prisma.analysis.delete({ where: { analysisId: data.analysis_id } });
      await close();
    }
  },
);
