/**
 * Analysis endpoints — `API-020`, `API-021`, `API-026` (`API §6.2`).
 *
 *   POST   /analyses               create, 202, returns before reasoning ends
 *   GET    /analyses/{id}          the stored analysis (`FR-060`)
 *   GET    /analyses/{id}/status   cheap polling (`SA AR-06`)
 *
 * THE READ PATH REPRODUCES, IT NEVER REGENERATES (`FR-060`, `API-021`
 * acceptance). Every field returned is read from the stored record. Nothing
 * here calls the NIE, and nothing here reaches a provider — retrieving an
 * analysis a second time cannot cost money or produce a different answer.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN. `API-021` is explicit: "Contains no
 * stage traces, prompt fragments, or provider identity." Those live in the
 * separate trace store and are operator-only (`DB §8.4`), so the shape below
 * has no field they could occupy — absence by construction rather than by
 * filtering.
 *
 * SCOPE OF THIS BUILD (`docs/12` D-37). Transport and lifecycle. Creation
 * hands the analysis to the orchestrator (`SA §3.3`), which owns execution;
 * this module never runs a stage itself. Three specified elements remain
 * absent and are named rather than stubbed:
 *
 *   · `events_url` — `API-025` (SSE) is not implemented; advertising a URL
 *     that 404s would be worse than omitting it.
 *   · `anonymous_token` — token issuance belongs to authentication, which is
 *     Sprint 5 (`M-15`).
 *   · `classification_override` — `API-020`'s design note scopes it to
 *     re-submission after an `FR-014` correction, and that flow does not
 *     exist. Accepting a field with no behaviour would be a false contract.
 *
 * ⚠️ OWNERSHIP IS NOT ENFORCED. `API-021` and `API-026` specify owner auth,
 * and no authentication layer exists until Sprint 5. Anyone holding an
 * analysis id can read it. Recorded rather than hidden; see the report
 * accompanying this file.
 */

import { randomUUID } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";

import { AppError, notFoundError } from "../http/errors.js";
import { sendSuccess } from "../http/responses.js";
import type { PrismaClient } from "../generated/prisma/client.js";

/** `FR-002` — the bounds the migration also enforces with a CHECK. */
export const CONTENT_MIN = 50;
export const CONTENT_MAX = 50_000;

export interface AnalysisRouteOptions {
  readonly prisma: PrismaClient;
  /** Injected so the content hash is testable without importing crypto here. */
  readonly hashContent: (content: string) => string;
  /**
   * Starts reasoning for a created analysis (`SA §3.3`).
   *
   * Optional, and its absence is a designed state rather than a failure: an
   * instance with no executor still accepts and stores submissions, and they
   * stay `queued`. That is what this API did before the orchestrator existed,
   * and it is what a test that only exercises the HTTP contract wants.
   *
   * **Not awaited.** `API-020` returns before reasoning completes, so the
   * request cannot block on a run that takes tens of seconds. The analysis row
   * is the durable record (`SA §12`), so a process restart loses the in-flight
   * run, not the submission.
   */
  readonly startExecution?: (analysisId: string) => void;
}

interface CreateBody {
  readonly content?: unknown;
  readonly source_type?: unknown;
}

/** `DB §4.2` SOURCE_TYPE. Mirrors the persisted enum exactly. */
const SOURCE_TYPES = ["paste", "file"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Validates before anything is written or spent (`FR-005`, `API §6.1`:
 * "Authoritative gate before any cost is incurred").
 *
 * Every message names the constraint and the corrective action. `FR-005`
 * forbids "invalid input" as a response, and `FR-002` requires the minimum to
 * be stated with its reason and the maximum with the actual count.
 */
function validateCreate(body: CreateBody): {
  content: string;
  sourceType: SourceType;
} {
  const { content } = body;

  if (typeof content !== "string" || content.trim() === "") {
    throw new AppError("validation_failed", "`content` is required.", {
      field: "content",
      action: "Send the text to analyse in the `content` field.",
    });
  }

  const characterCount = content.length;
  if (characterCount < CONTENT_MIN) {
    throw new AppError(
      "content_too_short",
      `Input is ${String(characterCount)} characters. At least ${String(CONTENT_MIN)} are needed to reason about it — below that there is not enough to analyse, and any conclusion would be invented.`,
      {
        field: "content",
        action: "Paste the full text rather than an excerpt.",
        details: { characterCount, minimum: CONTENT_MIN },
      },
    );
  }
  if (characterCount > CONTENT_MAX) {
    throw new AppError(
      "content_too_long",
      `Input is ${String(characterCount)} characters; the maximum is ${String(CONTENT_MAX)}.`,
      {
        field: "content",
        action: "Split the input, or submit the section you want analysed.",
        details: { characterCount, maximum: CONTENT_MAX },
      },
    );
  }

  // `FR-001` / `UX-002`: the API never demands a type. `source_type` describes
  // how the text arrived, not what it is about.
  const raw = body.source_type;
  if (raw !== undefined && !SOURCE_TYPES.includes(raw as SourceType)) {
    throw new AppError(
      "validation_failed",
      `\`source_type\` must be one of: ${SOURCE_TYPES.join(", ")}.`,
      {
        field: "source_type",
        action: "Omit the field to accept the default, `paste`.",
      },
    );
  }

  return { content, sourceType: (raw as SourceType | undefined) ?? "paste" };
}

export const analysisRoutes: FastifyPluginAsync<AnalysisRouteOptions> = (
  app,
  { prisma, hashContent, startExecution },
) => {
  // --- API-020 — create ---------------------------------------------------
  app.post("/analyses", async (request, reply) => {
    const { content, sourceType } = validateCreate(
      (request.body ?? {}) as CreateBody,
    );

    // One transaction: an analysis without its input is a row nothing can be
    // reasoned from, and `DB §4.2` makes the relation required.
    const analysis = await prisma.analysis.create({
      data: {
        status: "queued",
        // ⚠️ EVERY ANALYSIS NEEDS AN OWNER, AND THIS ONE HAS NO USER.
        //
        // `DB §4.2` enforces `analysis_exactly_one_owner_check` — exactly one
        // of `user_id` or `anonymous_token_hash` (`DP-8`, `FR-004`: ownership
        // is "never ambiguous and never absent"). Creating a row with neither
        // is rejected by Postgres, so `FR-004`'s anonymous analysis is not an
        // absent owner; it is an *anonymous* one, and the hash is how the
        // database is told which.
        //
        // The token itself is not issued to the client yet. `FR-004` also
        // requires an anonymous analysis to be "claimable into history if the
        // user authenticates within the same session", and that claim flow —
        // token format, transport and lifetime — belongs to authentication in
        // Sprint 5 (`M-15`). Until it exists, this owner is a placeholder
        // nobody can present, so analyses created here are **not claimable**.
        // Issuing the token at creation is what Sprint 5 must add; storing a
        // hash of one is what makes the row legal in the meantime.
        anonymousTokenHash: hashContent(randomUUID()),
        input: {
          create: {
            rawContent: content,
            contentHash: hashContent(content),
            characterCount: content.length,
            sourceType,
          },
        },
      },
    });

    // Reasoning starts once the row exists, and is deliberately not awaited:
    // the response must precede it. Where no executor is wired the analysis
    // stays `queued`, which the status endpoint reports rather than hides.
    startExecution?.(analysis.analysisId);

    // 202, not 201: reasoning has not completed. `API-020` acceptance —
    // "Returns before reasoning completes."
    return sendSuccess(
      request,
      reply,
      { analysis_id: analysis.analysisId, status: analysis.status },
      202,
    );
  });

  // --- API-026 — status ---------------------------------------------------
  app.get<{ Params: { id: string } }>(
    "/analyses/:id/status",
    async (request, reply) => {
      const analysis = await prisma.analysis.findUnique({
        where: { analysisId: request.params.id },
        // Selected, not fetched-then-trimmed. "Cheap enough to poll at a
        // few-second interval" is a property of the query, not of the
        // serialiser, and there is no path here by which artifact content
        // could reach a client.
        select: {
          status: true,
          createdAt: true,
          completedAt: true,
          degradationFlag: true,
          timeoutFlag: true,
        },
      });
      if (analysis === null) throw notFoundError();

      return sendSuccess(request, reply, {
        status: analysis.status,
        updated_at: (analysis.completedAt ?? analysis.createdAt).toISOString(),
        degraded: analysis.degradationFlag,
        timed_out: analysis.timeoutFlag,
      });
    },
  );

  // --- API-021 — retrieve -------------------------------------------------
  app.get<{ Params: { id: string } }>(
    "/analyses/:id",
    async (request, reply) => {
      const analysis = await prisma.analysis.findUnique({
        where: { analysisId: request.params.id },
        include: {
          input: { select: { characterCount: true, sourceType: true } },
          classification: true,
          intentRecord: true,
          contextElements: true,
          recommendations: { include: { alternatives: true } },
          requiredCapabilities: {
            orderBy: { ordinal: "asc" },
            include: { matches: true, gaps: true },
          },
          artifactPlanEntries: { include: { artifact: true } },
        },
      });
      if (analysis === null) throw notFoundError();

      // One verdict per job-description analysis. Indexed rather than filtered
      // by type: the column is free text (`docs/12` D-10) and a reader should
      // not have to know the string this path happens to write.
      const verdict = analysis.recommendations[0];

      return sendSuccess(request, reply, {
        analysis_id: analysis.analysisId,
        status: analysis.status,
        created_at: analysis.createdAt.toISOString(),
        completed_at: analysis.completedAt?.toISOString() ?? null,
        derived_title: analysis.derivedTitle,
        sufficiency_level: analysis.sufficiencyLevel,
        overall_confidence_band: analysis.overallConfidenceBand,
        degraded: analysis.degradationFlag,
        timed_out: analysis.timeoutFlag,
        input: analysis.input
          ? {
              character_count: analysis.input.characterCount,
              source_type: analysis.input.sourceType,
            }
          : null,
        // `FR-014` — the determined type is visible and its override recorded,
        // so a reader can tell a correction from an original. `FR-015` —
        // "the final output records that classification was low-confidence",
        // which is why `was_low_confidence` is carried rather than inferred
        // from the score.
        classification: analysis.classification
          ? {
              determined_type: analysis.classification.determinedType,
              confidence: analysis.classification.confidence,
              candidate_types: analysis.classification.candidateTypes,
              was_low_confidence: analysis.classification.wasLowConfidence,
              user_override_type: analysis.classification.userOverrideType,
              overridden_at:
                analysis.classification.overriddenAt?.toISOString() ?? null,
            }
          : null,

        // The problem as understood, which `FR-040` puts first.
        intent: analysis.intentRecord
          ? {
              primary_objective: analysis.intentRecord.primaryObjective,
              inferred_scope: analysis.intentRecord.inferredScope,
              objective_provenance: analysis.intentRecord.objectiveProvenance,
            }
          : null,

        // `FR-043` — stated and inferred are distinguished wherever displayed,
        // so provenance travels with every element rather than being derived.
        context: analysis.contextElements.map((element) => ({
          content: element.content,
          category: element.category,
          provenance: element.provenance,
          specificity_score: element.specificityScore,
          source_span_start: element.sourceSpanStart,
          source_span_end: element.sourceSpanEnd,
          inference_basis: element.inferenceBasis,
          resolution_hint: element.resolutionHint,
        })),

        // `FR-044` — unknowns are listed prominently with what would resolve
        // them, not left for a reader to filter out of the context set.
        unknowns: analysis.contextElements
          .filter((element) => element.provenance === "unknown")
          .map((element) => ({
            content: element.content,
            resolution_hint: element.resolutionHint,
          })),

        // `FR-042` — the rationale travels with the conclusion.
        //
        // `confidence_band` and `confidence_factors` are read from the row and
        // will be null: Stage 11 is deferred (`docs/12` D-33), so no measured
        // confidence exists. Null is the honest answer; a value here would be
        // invented. `FR-045` is therefore **not** satisfied.
        verdict: verdict
          ? {
              decision: verdict.conclusion,
              rationale: verdict.rationale,
              confidence_band: verdict.confidenceBand,
              confidence_factors: verdict.confidenceFactors,
              alternatives: verdict.alternatives.map((alternative) => ({
                alternative: alternative.alternative,
                rejection_reason: alternative.rejectionReason,
              })),
            }
          : null,

        // What the posting requires, what is already evidenced, and what is
        // not — grouped so a gap is never separated from the requirement it
        // belongs to (`docs/12` D-28).
        requirements: analysis.requiredCapabilities.map((requirement) => ({
          id: requirement.externalId,
          name: requirement.name,
          necessity: requirement.necessity,
          provenance: requirement.provenance,
          kind: requirement.kind,
          matched: requirement.matches.map((match) => ({
            capability_id: match.capabilityId,
            strength: match.strength,
            evidence_ref: match.evidenceRef,
          })),
          gaps: requirement.gaps.map((gap) => ({
            priority: gap.priority,
            why_it_matters: gap.whyItMatters,
            decisive: gap.decisive,
          })),
        })),

        decisive_gaps: analysis.requiredCapabilities
          .filter((requirement) => requirement.gaps.some((gap) => gap.decisive))
          .map((requirement) => requirement.externalId),

        // `FR-091` — omitted and failed stay distinguishable, and the content
        // of a failed artifact is never presented. `DB §4.4`: "only `valid`
        // artifacts are presentable."
        artifacts: analysis.artifactPlanEntries.map((entry) => ({
          artifact_type: entry.artifactType,
          planned: entry.planned,
          outcome: entry.outcome,
          inclusion_reason: entry.inclusionReason,
          omission_reason: entry.omissionReason,
          validation_status: entry.artifact?.validationStatus ?? null,
          content:
            entry.artifact?.validationStatus === "valid"
              ? entry.artifact.content
              : null,
        })),
      });
    },
  );

  return Promise.resolve();
};
