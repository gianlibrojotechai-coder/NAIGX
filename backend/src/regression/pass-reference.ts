/**
 * The regression pass reference (`DB §4.5`, `NFR-043`, `docs/12` D-14).
 *
 * `DB §4.5` makes fragment activation conditional on a recorded passing
 * regression run — "the gate is a data constraint, not process discipline".
 * D-14 recorded that Sprint 1 could not satisfy the output-regression half of
 * `NFR-043`, so `regression_pass_reference` names the manifest change gate
 * instead: `fragment-manifest-gate:fragments-v1`. That was honest, and it was
 * always meant to be replaced by a reference naming a real corpus run.
 *
 * This produces that reference. Two forms, deliberately:
 *
 *   · a **string** short enough to live in the column and to be read by a human
 *     in a row — `corpus-regression:corpus-v1+fragments-v1:<runId>`
 *   · a **document** holding what the string can only point at: which cases
 *     ran, which assertions were evaluated, and which were deferred
 *
 * A reference that could not be reconstructed would be a receipt for a run
 * nobody can inspect, which is the same failure as no gate at all.
 *
 * IT IS ONLY EMITTED FOR A CLEAN RUN. Not merely "no failures" — no blocked and
 * no errored cases either. A suite with nothing captured has measured nothing,
 * and must not be able to produce a token that unlocks fragment activation.
 */

import { createHash } from "node:crypto";

import { DEFERRED_ASSERTIONS, type AssertionId } from "./assertions.js";
import type { RegressionReport } from "./runner.js";

export const SUITE_ID = "corpus-regression";

/**
 * One case's contribution to the reference: which evidence was replayed, and
 * which assertions that evidence actually answered.
 *
 * The per-case assertion list is not cosmetic. `refusal_behaviour` and
 * `conflict_detection` fire only for special-class cases, so a reference
 * naming the whole catalogue would claim coverage no case provided.
 */
export interface ReferencedCase {
  readonly caseId: string;
  readonly recordingHash: string;
  readonly capturedAt: string;
  /**
   * The composition this case's recording was captured under.
   *
   * Per case, because a suite containing designed refusals cannot share one.
   * `br-005` halts at Stage 3 (`AI §5.4`) and the `unsupported` cases decline at
   * Stage 1 (`FR-092`), so each composes fewer prompts than a full run and
   * hashes differently. Staleness is verified per case by the runner before a
   * case can pass at all (`docs/12` D-24).
   */
  readonly fragmentsCompositionHash: string;
  readonly assertionsEvaluated: readonly string[];
}

export interface RegressionPassReference {
  readonly suite: typeof SUITE_ID;
  readonly reference: string;
  readonly mode: "recorded";
  readonly corpusVersion: string;
  readonly fragmentsManifestVersion: string;
  /**
   * Every distinct composition present in the run, sorted.
   *
   * A suite that must contain refusal cases (`docs/11` §3) spans more than one
   * by construction: a case that halts early composes fewer prompts. Claiming a
   * single suite-wide composition would be false, and requiring one made a
   * green refusal-bearing suite unable to issue a reference at all.
   */
  readonly fragmentsCompositions: readonly string[];
  readonly runId: string;
  readonly completedAt: string;
  readonly cases: readonly ReferencedCase[];
  /**
   * Recorded on the reference itself, so a future reader can tell what this
   * run did **not** measure without re-deriving it from the sprint it ran in.
   */
  readonly assertionsDeferred: readonly AssertionId[];
  /**
   * What this reference does and does not attest, in the artefact itself
   * (`docs/12` D-24 decision 3).
   */
  readonly attests: string;
}

const ATTESTATION =
  "Recorded mode: the pipeline, parser and deterministic corpus expectations hold against " +
  "previously captured provider responses. This is NOT evidence that the current prompt " +
  "produces these responses — that requires a capture or live run against the fragments in " +
  "force (docs/12 D-24).";

export interface PassReferenceInputs {
  readonly report: RegressionReport;
  readonly fragmentsManifestVersion: string;
  readonly completedAt?: string;
}

/**
 * Stable identity for a run: the same corpus cases, the same fragments and the
 * same assertion coverage produce the same id.
 *
 * Deliberately **not** derived from timings or a random value — two runs that
 * measured the same thing should be recognisable as such, and a reference that
 * changed every run would prove only that a run happened.
 */
export function runIdFor(inputs: PassReferenceInputs): string {
  const { report } = inputs;
  return createHash("sha256")
    .update(
      JSON.stringify([
        SUITE_ID,
        report.mode,
        report.corpusVersion,
        inputs.fragmentsManifestVersion,
        // The evidence, not merely the case list. Two runs replaying different
        // recordings of the same cases must not share an id: the reference
        // exists to identify what justified an activation.
        report.cases.map((c) => [
          c.caseId,
          c.status,
          c.evidence?.recordingHash ?? null,
          c.evidence?.fragmentsCompositionHash ?? null,
          c.assertionsEvaluated,
        ]),
      ]),
    )
    .digest("hex")
    .slice(0, 16);
}

/**
 * True when every selected case ran, passed, **and** did so against verified
 * evidence.
 *
 * The evidence clause is what stops a reference being issued for a run whose
 * recordings were missing, stale, unmanifested or hand-edited: all four leave
 * a case without an `evidence` block, and none of them may unlock activation
 * (`DB §4.5`, `docs/12` D-24).
 */
export const isCleanRun = (report: RegressionReport): boolean =>
  report.totals.selected > 0 &&
  report.totals.passed === report.totals.selected &&
  report.totals.failed === 0 &&
  report.totals.blocked === 0 &&
  report.totals.stale === 0 &&
  report.totals.errored === 0 &&
  report.cases.every(
    (c) => c.evidence !== undefined && c.assertionsEvaluated.length > 0,
  );

/**
 * Builds the reference, or `null` when the run does not qualify.
 *
 * `null` is the important half. `DB §4.5`'s CHECK accepts any non-empty string,
 * so nothing at the database layer can tell a real reference from a plausible
 * one — the refusal has to happen here.
 */
export function buildPassReference(
  inputs: PassReferenceInputs,
): RegressionPassReference | null {
  if (!isCleanRun(inputs.report)) return null;

  // Compositions are collected, not constrained. Requiring one suite-wide
  // composition was wrong: `docs/11` §3 mandates refusal cases, and a case that
  // halts early composes fewer prompts, so a green suite could never satisfy it.
  // Staleness is already enforced per case in `runner.ts` before a case passes,
  // so nothing is lost by recording the spread instead of demanding uniformity.
  const compositions = [
    ...new Set(
      inputs.report.cases.map(
        (c) => c.evidence?.fragmentsCompositionHash ?? "",
      ),
    ),
  ].sort();

  const runId = runIdFor(inputs);
  return {
    suite: SUITE_ID,
    reference: `${SUITE_ID}:${inputs.report.corpusVersion}+${inputs.fragmentsManifestVersion}:${runId}`,
    mode: inputs.report.mode,
    corpusVersion: inputs.report.corpusVersion,
    fragmentsManifestVersion: inputs.fragmentsManifestVersion,
    fragmentsCompositions: compositions,
    runId,
    completedAt: inputs.completedAt ?? inputs.report.startedAt,
    cases: inputs.report.cases.map((c) => ({
      caseId: c.caseId,
      recordingHash: c.evidence?.recordingHash ?? "",
      capturedAt: c.evidence?.capturedAt ?? "",
      fragmentsCompositionHash: c.evidence?.fragmentsCompositionHash ?? "",
      assertionsEvaluated: c.assertionsEvaluated,
    })),
    assertionsDeferred: DEFERRED_ASSERTIONS,
    attests: ATTESTATION,
  };
}
