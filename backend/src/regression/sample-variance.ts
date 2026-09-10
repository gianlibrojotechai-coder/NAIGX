/**
 * The sample-variance register and policy
 * ([D-91](../../../docs/66-D-91-Sample-Variance-Policy.md)).
 *
 * A recording is one sample of a non-deterministic model. When a case's
 * sample fails and a further sample is taken, three things must stay true:
 * the failing sample is retained and named, the samples are not pooled
 * across prompt versions, and the gate is not weakened to accept the
 * favourable draw. This module is the machine-readable half of that:
 *
 *   · `research/regression-variance.json` lists every sample of a case that
 *     is NOT its admitted recording — passing or failing — with the
 *     composition it was captured under, its outcome, the rule a failure
 *     contradicted, and where the file is;
 *   · `assessVariance` reads the entries for a case **under the admitted
 *     recording's composition only** (a different composition is a different
 *     prompt and says nothing about this one), adds the admitted recording as
 *     a passing sample, and applies the one numeric rule: **a case that
 *     failed two of its last three samples under a composition is failing**,
 *     whatever the latest sample says;
 *   · every case with a recorded failing sample under its composition is
 *     named in the pass reference (`sampleVariance`), so activation evidence
 *     carries the variance with it.
 *
 * Nothing here relabels an assertion or an outcome. The runner still
 * evaluates the admitted recording exactly as before; this adds a way to
 * fail a case on its history and a way to say so in the reference.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const VARIANCE_REGISTER_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../research/regression-variance.json",
);

export interface VarianceSample {
  readonly caseId: string;
  /** ISO timestamp of the capture. Orders the samples. */
  readonly capturedAt: string;
  /** The full composition hash the sample was captured under. */
  readonly fragmentsCompositionHash: string;
  readonly outcome: "passed" | "failed";
  /** What failed, in the runner's or the stage's own words. Empty for a pass. */
  readonly failure: string;
  /**
   * The stated rule the failing sample contradicted — the condition D-91
   * puts on a diagnostic re-run. Empty for a pass or for a contract-consistent
   * verdict (for which no re-run is permitted).
   */
  readonly ruleContradicted: string;
  /** Where the sample lives, relative to the repository root. */
  readonly file: string;
}

export interface VarianceRegister {
  readonly policy: string;
  readonly samples: readonly VarianceSample[];
}

export function loadVarianceRegister(
  file: string = VARIANCE_REGISTER_FILE,
): readonly VarianceSample[] {
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as VarianceRegister;
  if (!Array.isArray(parsed.samples)) {
    throw new Error(`${file}: "samples" must be an array`);
  }
  return parsed.samples;
}

export interface VarianceAssessment {
  /** The composition the assessment is scoped to. */
  readonly fragmentsCompositionHash: string;
  /** Samples under this composition, the admitted recording included. */
  readonly samples: number;
  /** Failing samples under this composition. */
  readonly failed: number;
  /** Failing samples among the last three, by capture time. */
  readonly failedOfLastThree: number;
  /** D-91 rule: two of the last three failed. */
  readonly failing: boolean;
  /** The rules the failing samples contradicted, deduplicated. */
  readonly rulesContradicted: readonly string[];
}

/**
 * Assesses a case's samples under one composition.
 *
 * `admittedCapturedAt` is the admitted recording's own capture time: it is a
 * passing sample by definition (the runner has just evaluated it), and it
 * takes its place in the order with the register's entries.
 */
export function assessVariance(
  caseId: string,
  fragmentsCompositionHash: string,
  admittedCapturedAt: string,
  register: readonly VarianceSample[],
): VarianceAssessment | undefined {
  const others = register.filter(
    (s) =>
      s.caseId === caseId &&
      s.fragmentsCompositionHash === fragmentsCompositionHash,
  );
  if (others.length === 0) return undefined;
  const all = [
    ...others.map((s) => ({
      at: s.capturedAt,
      failed: s.outcome === "failed",
    })),
    { at: admittedCapturedAt, failed: false },
  ].sort((a, b) => a.at.localeCompare(b.at));
  const lastThree = all.slice(-3);
  const failedOfLastThree = lastThree.filter((s) => s.failed).length;
  return {
    fragmentsCompositionHash,
    samples: all.length,
    failed: all.filter((s) => s.failed).length,
    failedOfLastThree,
    failing: failedOfLastThree >= 2,
    rulesContradicted: [
      ...new Set(
        others
          .filter((s) => s.outcome === "failed" && s.ruleContradicted !== "")
          .map((s) => s.ruleContradicted),
      ),
    ],
  };
}
