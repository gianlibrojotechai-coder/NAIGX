/**
 * The `docs/09` §2 risk scale, scale version `risk-v1`.
 *
 * DERIVED, NEVER STORED. Severity and likelihood are persisted on `RISK_ITEM`;
 * the score and the band are computed wherever they are shown. A stored band
 * would silently mean something different the day the scale is revised, and
 * `scale_version` exists precisely so a comparison across revisions cannot
 * happen by accident.
 *
 * ⚠️ THIS DEFINITION EXISTS TWICE. `frontend/src/format.ts` holds the same
 * scale for on-screen presentation. They are separate packages with no shared
 * module between them, so the duplication is real and is recorded here rather
 * than hidden: `docs/09` §2 is the source both copies answer to, and a change
 * there must land in both. `tests/unit/export-risk-scale.test.ts` pins every
 * boundary against the table in that section, so a drifting copy fails a test
 * rather than quietly exporting a different band than the screen showed.
 */

/** `docs/09` §2.1. */
const SEVERITY_LABELS = [
  "Minimal",
  "Low",
  "Moderate",
  "High",
  "Critical",
] as const;

/** `docs/09` §2.2. */
const LIKELIHOOD_LABELS = [
  "Rare",
  "Unlikely",
  "Possible",
  "Likely",
  "Almost certain",
] as const;

/** Out-of-range scores are reported as unrecognised, never clamped. */
export const severityLabel = (score: number): string =>
  SEVERITY_LABELS[score - 1] ?? `Unrecognised (${String(score)})`;

export const likelihoodLabel = (score: number): string =>
  LIKELIHOOD_LABELS[score - 1] ?? `Unrecognised (${String(score)})`;

export type RiskBand = "Low" | "Moderate" | "High" | "Very high" | "Critical";

/** `docs/09` §2.3 — Risk Score = Severity × Likelihood, 1 to 25. */
export const riskScore = (severity: number, likelihood: number): number =>
  severity * likelihood;

/**
 * `docs/09` §2.4 — contiguous integer ranges over that product.
 *
 * The ranges are stated as approved rather than compressed to the achievable
 * set: §2.5 records that 7, 11, 13, 14, 17–19 and 21–24 are unreachable, so
 * several boundaries here are inert by construction.
 */
export const riskBand = (score: number): RiskBand => {
  if (score <= 4) return "Low";
  if (score <= 9) return "Moderate";
  if (score <= 14) return "High";
  if (score <= 19) return "Very high";
  return "Critical";
};
