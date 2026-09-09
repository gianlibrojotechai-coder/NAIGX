/**
 * The wire form of Stage 11's evaluation — what Stage 12 assembles, the sink
 * stores beside the band, and `API-021` returns as `overall_confidence`
 * (D-86). Separate from the stage module so the store can render it without
 * importing a stage (boundary check 6).
 */

import type { ConfidenceEvaluation } from "./contracts.js";

export const renderConfidence = (
  evaluation: ConfidenceEvaluation,
): Record<string, unknown> => ({
  band: evaluation.band,
  model_version: evaluation.modelVersion,
  decided_by: evaluation.decidedBy,
  base_score: evaluation.baseScore,
  factors: evaluation.factors.map((f) => ({
    id: f.id,
    label: f.label,
    value: f.value,
    weight: f.weight,
    role: f.role,
    note: f.note,
  })),
});
