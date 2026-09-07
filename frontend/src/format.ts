/**
 * Presentation helpers.
 *
 * Every one of these turns stored data into readable text. None of them
 * invents a value: where the store holds null, these return null and the
 * caller says the field is unavailable.
 */

/** `must_have` → `Must have`. Used for enum-shaped columns generally. */
export const humanise = (value: string): string => {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/**
 * The verdict, in the words the tool is actually for.
 *
 * `apply_now` and `build_first` are the two the job-description path produces.
 * Anything else is passed through humanised rather than mapped to a guess —
 * the column is free text (`docs/12` D-10), so a value this list does not know
 * is a real possibility and not an error.
 */
export const verdictLabel = (decision: string): string => {
  if (decision === "apply_now") return "Apply now";
  if (decision === "build_first") return "Build first";
  return humanise(decision);
};

export const verdictMeaning = (decision: string): string | null => {
  if (decision === "apply_now")
    return "Your evidenced capabilities cover what this role requires.";
  if (decision === "build_first")
    return "At least one decisive gap should be closed with built evidence before applying.";
  return null;
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}m ${String(seconds % 60)}s`;
};

export const formatTimestamp = (iso: string | null): string | null => {
  if (iso === null) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

/** Elapsed wall-clock between two ISO instants, when both exist. */
export const formatElapsed = (
  startIso: string,
  endIso: string | null,
): string | null => {
  if (endIso === null) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return formatDuration(Math.round((end - start) / 1000));
};

// --- risk scales (`docs/09` §2, scale version `risk-v1`) --------------------
//
// Severity and likelihood are stored; the score and band are **derived at
// presentation and never stored**. That is deliberate — a stored band would
// silently mean something different the day the scale is revised, and
// `scale_version` exists precisely so a comparison across revisions cannot
// happen by accident. Deriving here keeps one definition, in one place.

const SEVERITY_LABELS = [
  "Minimal",
  "Low",
  "Moderate",
  "High",
  "Critical",
] as const;

const LIKELIHOOD_LABELS = [
  "Rare",
  "Unlikely",
  "Possible",
  "Likely",
  "Almost certain",
] as const;

/** `docs/09` §2.1. Out-of-range scores are reported, not clamped. */
export const severityLabel = (score: number): string =>
  SEVERITY_LABELS[score - 1] ?? `Unrecognised (${String(score)})`;

/** `docs/09` §2.2. */
export const likelihoodLabel = (score: number): string =>
  LIKELIHOOD_LABELS[score - 1] ?? `Unrecognised (${String(score)})`;

export type RiskBand = "Low" | "Moderate" | "High" | "Very high" | "Critical";

/** `docs/09` §2.3 — Risk Score = Severity × Likelihood, 1 to 25. */
export const riskScore = (severity: number, likelihood: number): number =>
  severity * likelihood;

/** `docs/09` §2.4 — contiguous integer ranges over that product. */
export const riskBand = (score: number): RiskBand => {
  if (score <= 4) return "Low";
  if (score <= 9) return "Moderate";
  if (score <= 14) return "High";
  if (score <= 19) return "Very high";
  return "Critical";
};

/** The badge tone a band earns. Never the only carrier of the meaning. */
export const riskTone = (
  band: RiskBand,
): "neutral" | "info" | "warning" | "danger" =>
  band === "Low"
    ? "neutral"
    : band === "Moderate"
      ? "info"
      : band === "High"
        ? "warning"
        : "danger";
