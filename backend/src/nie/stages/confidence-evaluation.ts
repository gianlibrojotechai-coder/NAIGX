/**
 * Stage 11 — Confidence Evaluation (`AI §8`, `FR-045`, `AIP-2`),
 * [D-86](../../../../docs/61-D-86-Stage-11-Confidence.md).
 *
 * Fully deterministic (`AI §3.3`): computed from measured factors, never
 * model-self-reported. v1 is the REDUCED model `AI §8.2`'s note describes
 * and D-31/D-32/D-33 ratified:
 *
 *   · the weighted base is CF-2 (requirement clarity: the stated share of
 *     the stated-or-inferred context elements) and CF-4 (evidence quality:
 *     the mean specificity of the stated elements); CF-1, CF-5 and CF-6 carry
 *     weight 0, versioned, and are listed as such so the exposed factors say
 *     what was and was not measured;
 *   · conflicts (CF-3) cap the band at `medium` (D-31 decision 2); CF-7's
 *     cap has no computable trigger (D-33 §1) and is listed as unmeasured;
 *   · an analysis that produced no artifact carries `low` (D-31 decision 1);
 *   · the thresholds and the two weights are FITTED to the corpus's frozen
 *     band labels (D-31 decision 6, D-33 §3 unblocked by D-86's Stage 3
 *     feature captures), never chosen — `CONFIDENCE_MODEL_V1` records them
 *     with the fit they came from;
 *   · per-recommendation adjustment stays deferred (D-31 decision 5): one
 *     band per analysis, with its factors always exposed (`AI §8.4`).
 *
 * "Absence lowers, never raises": a factor that cannot be measured takes
 * the conservative value 0 and says so.
 */

import type {
  ArtifactPlanEntry,
  ConfidenceBand,
  ConfidenceEvaluation,
  ConfidenceFactor,
  ConfidenceModel,
  ContextResult,
} from "../contracts.js";

export type {
  ConfidenceBand,
  ConfidenceEvaluation,
  ConfidenceFactor,
  ConfidenceModel,
};

/** CF-2: the stated share of the stated-or-inferred elements; null when neither exists. */
export const requirementClarity = (context: ContextResult): number | null => {
  const stated = context.elements.filter(
    (e) => e.provenance === "stated",
  ).length;
  const inferred = context.elements.filter(
    (e) => e.provenance === "inferred",
  ).length;
  return stated + inferred === 0 ? null : stated / (stated + inferred);
};

/** CF-4: the mean specificity of the stated elements; null when there are none. */
export const evidenceQuality = (context: ContextResult): number | null => {
  const stated = context.elements.filter((e) => e.provenance === "stated");
  return stated.length === 0
    ? null
    : stated.reduce((sum, e) => sum + e.specificityScore, 0) / stated.length;
};

/** CF-3: the elements Stage 3 flagged as conflicting with another. */
export const conflictCount = (context: ContextResult): number =>
  context.elements.filter((e) => e.conflictsWithIndex !== undefined).length;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** The base score the thresholds are applied to: the weighted CF-2/CF-4 mean. */
export const baseScore = (
  clarity: number | null,
  quality: number | null,
  model: ConfidenceModel,
): number | null => {
  if (clarity === null && quality === null) return null;
  // Absence lowers, never raises: a missing factor contributes 0.
  const c = clarity ?? 0;
  const q = quality ?? 0;
  return round3(model.clarityWeight * c + (1 - model.clarityWeight) * q);
};

export const bandOf = (
  score: number,
  model: ConfidenceModel,
): ConfidenceBand =>
  score >= model.highThreshold
    ? "high"
    : score >= model.mediumThreshold
      ? "medium"
      : "low";

export function evaluateConfidence(
  input: {
    readonly context?: ContextResult;
    readonly artifactPlan?: readonly ArtifactPlanEntry[];
  },
  model: ConfidenceModel,
): ConfidenceEvaluation {
  const context = input.context;
  const clarity = context === undefined ? null : requirementClarity(context);
  const quality = context === undefined ? null : evidenceQuality(context);
  const conflicts = context === undefined ? 0 : conflictCount(context);
  const generated = (input.artifactPlan ?? []).filter(
    (e) => e.planned && e.outcome === "generated",
  ).length;
  // The intent brief (D-66) is rendered before reasoning and is not "a
  // recommendation"; an analysis whose only generated artifact is the brief
  // produced no artifact in D-31 decision 1's sense.
  const substantive = (input.artifactPlan ?? []).filter(
    (e) =>
      e.planned &&
      e.outcome === "generated" &&
      e.artifactType !== "intent_brief",
  ).length;
  const score = baseScore(clarity, quality, model);

  const factors: ConfidenceFactor[] = [
    {
      id: "CF-1",
      label: "Input completeness",
      value: null,
      weight: 0,
      role: "unmeasured",
      note: "No per-type expected-context schema exists to measure against (D-32); excluded from v1, weight 0.",
    },
    {
      id: "CF-2",
      label: "Requirement clarity",
      value: clarity === null ? null : round3(clarity),
      weight: model.clarityWeight,
      role: "weighted",
      note:
        clarity === null
          ? "No stated or inferred context element to measure; taken as 0."
          : `${String(context?.elements.filter((e) => e.provenance === "stated").length ?? 0)} stated of ${String(context?.elements.filter((e) => e.provenance !== "unknown").length ?? 0)} stated-or-inferred elements.`,
    },
    {
      id: "CF-3",
      label: "Conflicting information",
      value: conflicts === 0 ? 1 : 0,
      weight: 0,
      role: "cap",
      note:
        conflicts === 0
          ? "No contradiction flagged by Stage 3."
          : `${String(conflicts)} element(s) flagged as conflicting; the band is capped at medium (D-31).`,
    },
    {
      id: "CF-4",
      label: "Evidence quality",
      value: quality === null ? null : round3(quality),
      weight: round3(1 - model.clarityWeight),
      role: "weighted",
      note:
        quality === null
          ? "No stated element to measure specificity on; taken as 0."
          : "Mean specificity of the stated elements.",
    },
    {
      id: "CF-5",
      label: "Platform certainty",
      value: null,
      weight: 0,
      role: "unmeasured",
      note: "Stage 4 (knowledge assembly) is not built (D-31); excluded from v1, weight 0.",
    },
    {
      id: "CF-6",
      label: "Reasoning consistency",
      value: null,
      weight: 0,
      role: "unmeasured",
      note: "A runtime property with no corpus signal (D-33); excluded from v1, weight 0.",
    },
    {
      id: "CF-7",
      label: "Unknown materiality",
      value: null,
      weight: 0,
      role: "unmeasured",
      note: "No field represents an unknown that blocks a recommendation (D-33); the cap has no trigger in v1.",
    },
  ];

  if (substantive === 0 || generated === 0) {
    return {
      band: "low",
      modelVersion: model.version,
      decidedBy: "no_artifacts",
      baseScore: score,
      factors,
    };
  }
  const base = bandOf(score ?? 0, model);
  if (conflicts > 0 && base === "high") {
    return {
      band: "medium",
      modelVersion: model.version,
      decidedBy: "conflict_cap",
      baseScore: score,
      factors,
    };
  }
  return {
    band: base,
    modelVersion: model.version,
    decidedBy: "weighted_base",
    baseScore: score,
    factors,
  };
}

export { renderConfidence } from "../confidence-wire.js";
