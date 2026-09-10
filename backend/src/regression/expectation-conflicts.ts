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
  {
    caseId: "jd-008",
    assertion: "artifact_set",
    expectation:
      "expected_artifact_set includes portfolio_suggestions on an apply_now verdict (the applicant should still be shown what would strengthen the application)",
    decision:
      "docs/12 D-29: the portfolio is planned only on build_first — an apply_now verdict has nothing to build first, and the plan records that omission",
    recordedIn:
      "research/m11-artifact-set-measurement.md; STATUS ledger, owner decisions",
  },
];

export const registeredConflicts = (
  caseId: string,
): readonly ExpectationConflict[] =>
  EXPECTATION_CONFLICTS.filter((c) => c.caseId === caseId);
