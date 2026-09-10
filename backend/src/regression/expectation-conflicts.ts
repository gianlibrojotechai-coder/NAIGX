/**
 * The expectation-conflict register
 * ([D-90](../../../docs/65-D-90-Planning-By-Judgement.md) §5).
 *
 * A corpus expectation and an accepted design decision can disagree. When
 * they do, the runner has three dishonest options — fail the case (blaming
 * the product for following its own record), change the expectation (a
 * `docs/11` §6.2 owner act, not an engineering one), or change the decision
 * (the same) — and one honest one: report the disagreement as what it is,
 * by name, and let the owner settle it.
 *
 * An entry here does not make a case pass. It makes the case `conflict`:
 * counted separately, printed separately, named in every pass reference the
 * run issues, and still measured — an entry whose contradiction stops
 * manifesting is reported as stale so the register cannot outlive the
 * disagreement. Only the assertion named may contradict; any other failure
 * on the case fails it as usual.
 *
 * Adding an entry is a recorded engineering act with the decision cited.
 * Removing one is the owner's, when the expectation or the decision changes.
 */

import type { AssertionId } from "./assertions.js";

export interface ExpectationConflict {
  readonly caseId: string;
  readonly assertion: AssertionId;
  /** The frozen expectation, as the corpus states it. */
  readonly expectation: string;
  /** The accepted decision it contradicts, by record. */
  readonly decision: string;
  /** Where the disagreement is written up for the owner. */
  readonly recordedIn: string;
}

export const EXPECTATION_CONFLICTS: readonly ExpectationConflict[] = [
  // The first entry, jd-008 (D-90 §5), was WITHDRAWN on 2026-09-10 the same
  // day it was registered. It read the corpus's "portfolio on jd-008" as a
  // disagreement with D-29's apply_now rule; the D-90 recapture returned a
  // build_first verdict for the same input, the portfolio was generated, and
  // the case passed. The corpus freezes no verdict, so what the two captures
  // measure is Stage 7 verdict variance on one input (FR-024), recorded in
  // research/m11-artifact-set-measurement.md — not a conflict with D-29.
];

export const registeredConflicts = (
  caseId: string,
): readonly ExpectationConflict[] =>
  EXPECTATION_CONFLICTS.filter((c) => c.caseId === caseId);
