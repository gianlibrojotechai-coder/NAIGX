/**
 * The stored analysis, read once and shaped once (`API-021`, `API-040`).
 *
 * WHY THIS EXISTS. Two things now render a completed analysis: `API-021`
 * returns it as JSON, and `M-13` export turns it into Markdown. If each held
 * its own read, the export would be a second opinion about what an analysis
 * contains — and the first field one of them forgot would be a field the
 * exported document silently drops. `FR-050` requires the export to carry
 * "all presented artifacts, rationale, provenance, and confidence", which is a
 * statement about *parity with what was presented*, not about a list somebody
 * has to keep in step by hand.
 *
 * So there is one read and one shape. `AnalysisView` is the `API-021` response
 * body, and the Markdown serialiser consumes exactly that object. Anything
 * visible through the API is exportable by construction, and a field added to
 * one appears in the other or is skipped in a renderer that can be pointed at.
 *
 * IT REPRODUCES, IT NEVER REGENERATES (`FR-060`, `SA §3.8`: "Export is a pure
 * transformation of stored artifacts. Never generates content, invokes the
 * NIE, or alters analysis substance"). Every field below is read from the
 * stored record. Nothing here calls the NIE and nothing reaches a provider.
 *
 * WHAT IT DELIBERATELY DOES NOT CARRY. `API-021` is explicit: "Contains no
 * stage traces, prompt fragments, or provider identity." Those live in the
 * separate trace store and are operator-only (`DB §8.4`), so this shape has no
 * field they could occupy — absence by construction rather than by filtering.
 * The export inherits that property for free, which matters rather more for a
 * document a user hands to somebody else than for a JSON body they never read.
 */

import type { PrismaClient } from "../generated/prisma/client.js";

export interface AnalysisInputView {
  readonly character_count: number;
  readonly source_type: string;
}

export interface ClassificationView {
  readonly determined_type: string;
  readonly confidence: number;
  readonly candidate_types: unknown;
  readonly was_low_confidence: boolean;
  readonly user_override_type: string | null;
  readonly overridden_at: string | null;
}

export interface IntentView {
  readonly primary_objective: string;
  readonly inferred_scope: string | null;
  /**
   * `{ primary, secondary[] }` — per-objective provenance, stored as a
   * document because `DB §4.2` specifies no child entity for it.
   *
   * `unknown` rather than a shape: this is jsonb written by the sink, and a
   * declared shape here would be a promise the column does not keep. Readers
   * narrow it. The frontend types it the same way.
   */
  readonly objective_provenance: unknown;
}

export interface ContextElementView {
  readonly content: string;
  readonly category: string;
  readonly provenance: string;
  readonly specificity_score: number | null;
  readonly source_span_start: number | null;
  readonly source_span_end: number | null;
  readonly inference_basis: string | null;
  readonly resolution_hint: string | null;
}

export interface UnknownView {
  readonly content: string;
  readonly resolution_hint: string | null;
}

export interface AlternativeView {
  readonly alternative: string;
  readonly rejection_reason: string;
}

export interface VerdictView {
  readonly decision: string;
  readonly rationale: string;
  readonly criteria_applied: string | null;
  readonly confidence_band: string | null;
  readonly confidence_factors: unknown;
  readonly alternatives: readonly AlternativeView[];
}

export interface MatchView {
  readonly capability_id: string;
  readonly strength: string;
  readonly evidence_ref: string | null;
}

export interface GapView {
  readonly priority: string;
  readonly why_it_matters: string;
  readonly decisive: boolean;
}

export interface RequirementView {
  readonly id: string;
  readonly name: string;
  readonly necessity: string;
  readonly provenance: string;
  readonly kind: string;
  readonly matched: readonly MatchView[];
  readonly gaps: readonly GapView[];
}

export interface ArtifactView {
  readonly artifact_type: string;
  readonly planned: boolean;
  readonly outcome: string | null;
  readonly inclusion_reason: string | null;
  readonly omission_reason: string | null;
  readonly validation_status: string | null;
  readonly content: unknown;
}

/**
 * Why an analysis produced no reasoning, when it produced none by design.
 *
 * `API §9.3` names two such outcomes and insists both are "not failures": the
 * request was well-formed and processed correctly, and the *content* cannot be
 * analysed. `PV §5` calls the insufficient case a defining product moment, and
 * `API §9.3` is explicit that "returning a generic error here would waste the
 * most valuable thing the system determined".
 *
 * So the unknowns travel with the refusal. They are what the caller acts on.
 */
export interface RefusalView {
  /** `unsupported_input_type` (Stage 1) or `insufficient_context` (Stage 3). */
  readonly code: "unsupported_input_type" | "insufficient_context";
  readonly halted_at_stage: number;
  readonly reason: string;
  /**
   * What is missing and what would resolve it. Populated for
   * `insufficient_context`; empty for a Stage 1 decline, which halts before
   * any context is extracted and therefore has no unknowns to report.
   */
  readonly unknowns: readonly UnknownView[];
}

/** The `API-021` response body, and the export's only source. */
export interface AnalysisView {
  readonly analysis_id: string;
  readonly status: string;
  readonly created_at: string;
  readonly completed_at: string | null;
  readonly derived_title: string | null;
  readonly sufficiency_level: string | null;
  readonly overall_confidence_band: string | null;
  readonly degraded: boolean;
  readonly timed_out: boolean;
  /**
   * Present when reasoning stopped by design; `null` otherwise (`API §9.3`).
   *
   * On the shared view rather than resolved separately by each consumer, so
   * `API-021`, the Markdown export and the PDF all decide from the same field.
   * A refused analysis rendered as an ordinary empty result is the exact
   * silence this project treats as a defect.
   */
  readonly refusal: RefusalView | null;
  readonly input: AnalysisInputView | null;
  readonly classification: ClassificationView | null;
  readonly intent: IntentView | null;
  readonly context: readonly ContextElementView[];
  readonly unknowns: readonly UnknownView[];
  readonly verdict: VerdictView | null;
  readonly requirements: readonly RequirementView[];
  readonly decisive_gaps: readonly string[];
  readonly artifacts: readonly ArtifactView[];
}

/**
 * Whether an analysis has a real authenticated owner (`D-41` §4.4, `D-42` §3.5).
 *
 * Read from the column rather than assumed. `Analysis.user_id` is null for
 * every analysis before `M-15` — `API-020` stores an `anonymousTokenHash`
 * instead — so today this always answers "anonymous", but it answers from data.
 * When authentication lands it supplies an identity to a branch that already
 * exists rather than requiring a new one.
 *
 * Kept off `AnalysisView` on purpose: ownership decides *whether* a caller may
 * export, and `API-021` "contains no" identity fields. It is returned beside
 * the view, not inside it, so it cannot be serialised into a document by
 * accident.
 */
export interface AnalysisOwnership {
  readonly ownerUserId: string | null;
}

export interface StoredAnalysis {
  readonly view: AnalysisView;
  readonly ownership: AnalysisOwnership;
}

/**
 * Reads a stored analysis, or `null` when no such analysis exists.
 *
 * The 404 is the caller's to raise: this module knows about storage, not about
 * HTTP status codes.
 */
export async function readAnalysis(
  prisma: PrismaClient,
  analysisId: string,
): Promise<StoredAnalysis | null> {
  const analysis = await prisma.analysis.findUnique({
    where: { analysisId },
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
  if (analysis === null) return null;

  // One verdict per job-description analysis. Indexed rather than filtered by
  // type: the column is free text (`docs/12` D-10) and a reader should not have
  // to know the string this path happens to write.
  const verdict = analysis.recommendations[0];

  // `FR-044` — unknowns with what would resolve them. Built before the refusal
  // because `insufficient_context` carries them (`API §9.3`).
  const unknowns: readonly UnknownView[] = analysis.contextElements
    .filter((element) => element.provenance === "unknown")
    .map((element) => ({
      content: element.content,
      resolution_hint: element.resolutionHint,
    }));

  // The refusal, derived from the persisted halt rather than guessed from
  // absences. `haltedAtStage` is null for every analysis that was not refused,
  // including every analysis stored before the column existed — null means "no
  // refusal", never "unknown", so nothing here fabricates one.
  //
  // The stage number is what distinguishes the two: `FR-092` declines at
  // Stage 1 before any context exists, `AI §5.4` stops at Stage 3 after
  // extraction. A halt at any other stage would be a defect rather than a
  // designed refusal, so it is reported as insufficiency only when Stage 3
  // actually produced it.
  //
  // ⚠️ NULLISH, NOT `=== null`. A strict null check treats an *absent* field as
  // a refusal, because `undefined !== null` — and a caller that projected the
  // row without these columns would have every analysis reported as declined.
  // A refusal must be affirmed by data that is actually present, never
  // inferred from a field nobody read.
  const refusal: RefusalView | null =
    analysis.haltedAtStage == null || analysis.haltReason == null
      ? null
      : {
          code:
            analysis.haltedAtStage === 1
              ? "unsupported_input_type"
              : "insufficient_context",
          halted_at_stage: analysis.haltedAtStage,
          reason: analysis.haltReason,
          // A Stage 1 decline halts before context extraction, so it has no
          // unknowns to report and says so with an empty list rather than
          // borrowing whatever happens to be on the row.
          unknowns: analysis.haltedAtStage === 1 ? [] : unknowns,
        };

  const view: AnalysisView = {
    analysis_id: analysis.analysisId,
    status: analysis.status,
    created_at: analysis.createdAt.toISOString(),
    completed_at: analysis.completedAt?.toISOString() ?? null,
    derived_title: analysis.derivedTitle,
    sufficiency_level: analysis.sufficiencyLevel,
    overall_confidence_band: analysis.overallConfidenceBand,
    degraded: analysis.degradationFlag,
    timed_out: analysis.timeoutFlag,
    refusal,
    input: analysis.input
      ? {
          character_count: analysis.input.characterCount,
          source_type: analysis.input.sourceType,
        }
      : null,
    // `FR-014` — the determined type is visible and its override recorded, so a
    // reader can tell a correction from an original. `FR-015` — "the final
    // output records that classification was low-confidence", which is why
    // `was_low_confidence` is carried rather than inferred from the score.
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

    // `FR-043` — stated and inferred are distinguished wherever displayed, so
    // provenance travels with every element rather than being derived.
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

    // `FR-044` — unknowns are listed prominently with what would resolve them,
    // not left for a reader to filter out of the context set. Computed above,
    // because a refusal reports the same list (`API §9.3`).
    unknowns,

    // `FR-042` — the rationale travels with the conclusion.
    //
    // `confidence_band` and `confidence_factors` are read from the row and will
    // be null: Stage 11 is deferred (`docs/12` D-33), so no measured confidence
    // exists. Null is the honest answer; a value here would be invented.
    // `FR-045` is therefore **not** satisfied.
    verdict: verdict
      ? {
          decision: verdict.conclusion,
          rationale: verdict.rationale,
          // `FR-034` — the criteria the decision was weighed against, and what
          // was rejected. `FR-042` puts the rationale beside the conclusion;
          // these are what let a reader disagree with the standard rather than
          // only with the verdict.
          criteria_applied: verdict.criteriaApplied,
          confidence_band: verdict.confidenceBand,
          confidence_factors: verdict.confidenceFactors,
          alternatives: verdict.alternatives.map((alternative) => ({
            alternative: alternative.alternative,
            rejection_reason: alternative.rejectionReason,
          })),
        }
      : null,

    // What the posting requires, what is already evidenced, and what is not —
    // grouped so a gap is never separated from the requirement it belongs to
    // (`docs/12` D-28).
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

    // `FR-091` — omitted and failed stay distinguishable, and the content of a
    // failed artifact is never presented. `DB §4.4`: "only `valid` artifacts
    // are presentable."
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
  };

  return { view, ownership: { ownerUserId: analysis.userId } };
}
