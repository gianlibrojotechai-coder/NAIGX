/**
 * The v1 confidence model's fitted parameters (D-86 §2).
 *
 * FITTED, NOT CHOSEN (D-31 decision 6): `npm run confidence:fit -- --write`
 * grid-searches the clarity weight and the two thresholds against the
 * corpus's 44 frozen band labels and writes
 * `research/confidence-calibration/model.json`; the values here are copied
 * from it, and `tests/unit/confidence-model.test.ts` fails if they drift.
 * Re-fit when Stage 3's fragment changes — the features are its output.
 */

import type { ConfidenceModel } from "./contracts.js";

export const CONFIDENCE_MODEL_V1: ConfidenceModel = {
  version: "confidence-v1",
  clarityWeight: 0.45,
  highThreshold: 0.846,
  mediumThreshold: 0.807,
  fittedAgainst:
    "41 corpus cases with measured Stage 3 features (3 more decided by rule), 2026-09-09",
};
