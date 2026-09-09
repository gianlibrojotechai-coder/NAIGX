/**
 * Stage 9 — Complexity Assessment (`FR-033`, `docs/09` §1, `complexity-v1`),
 * [D-80](../../../../docs/55-D-80-Complexity-Score.md).
 *
 * `docs/09` scores five factors on a shared 1–5 scale with fixed weights and
 * derives a 20–100 score by arithmetic; `FR-033` requires that a reader can
 * reconstruct the score from what is displayed and that identical inputs
 * score identically. D-36 left one gap open — *which stage scores the
 * factors* — and this module closes it the way `AI §9.1` implies: the factor
 * scores are the generator's judgement at Stage 9, against the anchors the
 * fragment states in full; everything after the factor scores is arithmetic
 * done here, never by the model, so the table `FR-033` requires is always
 * present and always correct.
 *
 * The parser accepts exactly the five factors, each once, integer 1–5, each
 * with a justification. The renderer computes contribution, weighted score
 * and complexity score per `docs/09` §1.3; Stage 10 recomputes them.
 */

import {
  StageError,
  COMPLEXITY_FACTORS,
  type ComplexityAssessment,
  type ComplexityFactorKey,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireMember,
  requireNumber,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 9;
const STAGE_KEY = "complexity_assessment";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

const FACTOR_KEYS = COMPLEXITY_FACTORS.map(
  (f) => f.key,
) as readonly ComplexityFactorKey[];

/** Two-decimal rounding, half away from zero, as `docs/09` §1.3 retains it. */
const round2 = (n: number): number =>
  Math.round(n * 100 + Number.EPSILON) / 100;

/** `docs/09` §1.3 — the arithmetic, in one place, used by the renderer and Stage 10. */
export const scoreComplexity = (
  scores: ReadonlyMap<ComplexityFactorKey, number>,
): { weightedScore: number; complexityScore: number } => {
  let weighted = 0;
  for (const factor of COMPLEXITY_FACTORS) {
    weighted += (scores.get(factor.key) ?? 0) * factor.weight;
  }
  const weightedScore = round2(weighted);
  return { weightedScore, complexityScore: Math.round(weightedScore * 20) };
};

export function parseComplexityFactors(
  responseText: string,
): ComplexityAssessment {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);
  const raw = requireArray(CTX, record, "factors");
  const seen = new Map<
    ComplexityFactorKey,
    { score: number; justification: string }
  >();
  raw.forEach((value, index) => {
    const where = `factors[${String(index)}]`;
    const entry = asRecord(CTX, value, where);
    const factor = requireMember(CTX, entry, "factor", FACTOR_KEYS);
    if (seen.has(factor)) fail(`${where}: factor "${factor}" is scored twice`);
    const score = requireNumber(CTX, entry, "score");
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      fail(`${where}: score must be an integer from 1 to 5 (docs/09 §1.2)`);
    }
    seen.set(factor, {
      score,
      justification: requireString(CTX, entry, "justification"),
    });
  });
  const missing = FACTOR_KEYS.filter((k) => !seen.has(k));
  if (missing.length > 0) {
    fail(`factors must score all five: missing ${missing.join(", ")}`);
  }
  const scores = new Map<ComplexityFactorKey, number>(
    [...seen].map(([k, v]) => [k, v.score]),
  );
  const { weightedScore, complexityScore } = scoreComplexity(scores);
  return {
    scaleVersion: "complexity-v1",
    factors: COMPLEXITY_FACTORS.map((factor) => {
      const scored = seen.get(factor.key) as {
        score: number;
        justification: string;
      };
      return {
        factor: factor.key,
        label: factor.label,
        score: scored.score,
        weight: factor.weight,
        contribution: round2(scored.score * factor.weight),
        justification: scored.justification,
      };
    }),
    weightedScore,
    complexityScore,
  };
}

/** The artifact document, exactly as the published schema has it. */
export const renderComplexityScore = (
  assessment: ComplexityAssessment,
): Record<string, unknown> => ({
  scale_version: assessment.scaleVersion,
  factors: assessment.factors.map((f) => ({
    factor: f.factor,
    label: f.label,
    score: f.score,
    weight: f.weight,
    contribution: f.contribution,
    justification: f.justification,
  })),
  weighted_score: assessment.weightedScore,
  complexity_score: assessment.complexityScore,
});
