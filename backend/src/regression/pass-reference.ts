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
import type { FragmentCoverage } from "./coverage.js";
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
  /**
   * The suite version measured against, from `corpus.manifest.json`.
   *
   * Named in the reference string so a row in `regression_pass_reference`
   * identifies the oracle, not the entry marker of an arbitrary case
   * (`docs/11` §6.3, `docs/12` D-30).
   */
  readonly suiteVersion: string;
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
  /**
   * Whether this reference speaks for the whole corpus.
   *
   * `entire_corpus` requires every corpus case to have run; `targeted` names the
   * fragment that selected the subset; `partial` is any other incomplete
   * selection. A reference must never be readable as suite-wide evidence when it
   * is not (`docs/12` D-30 dec. 3, and the per-case reasoning already applied to
   * `assertionsEvaluated`).
   */
  readonly selectionScope: "entire_corpus" | "targeted" | "partial";
  /** Present only when `selectionScope` is `targeted`. */
  readonly coverage?: FragmentCoverage;
  readonly runId: string;
  readonly completedAt: string;
  readonly cases: readonly ReferencedCase[];
  /**
   * Which fragment versions the prompt under test was composed from
   * ([D-63](../../../docs/38-D-63-Authored-Fragment-Resolution-For-Regression.md) §4).
   *
   * ⚠️ Absent on evidence recorded before D-63. That evidence was necessarily
   * composed from active fragments, but it is left **unlabelled rather than
   * back-filled**: relabelling a historical artefact to tidy a schema would
   * assert something about a run nobody re-examined.
   */
  readonly fragmentResolution?: FragmentResolution;
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

/**
 * How the prompt under test was composed
 * ([D-63](../../../docs/38-D-63-Authored-Fragment-Resolution-For-Regression.md) §4).
 *
 * ⚠️ A READER MUST BE ABLE TO TELL THESE APART WITHOUT KNOWING WHEN THE RUN
 * HAPPENED. A run against authored fragments proves something narrower than one
 * against published fragments, and an artefact that blurred them would
 * overstate its own evidence.
 */
export const FRAGMENT_RESOLUTIONS = ["active", "authored"] as const;
export type FragmentResolution = (typeof FRAGMENT_RESOLUTIONS)[number];

const RECORDED_MODE =
  "Recorded mode: the pipeline, parser and deterministic corpus expectations hold against " +
  "previously captured provider responses. This is NOT evidence that the current prompt " +
  "produces these responses — that requires a capture or live run against the fragments in " +
  "force (docs/12 D-24).";

const RESOLUTION_CLAUSE: Readonly<Record<FragmentResolution, string>> = {
  // The pre-D-63 meaning, preserved verbatim in effect so historical evidence
  // is not retroactively re-described.
  active:
    " Fragment resolution: ACTIVE — composed from the fragment versions published " +
    "and active at run time.",
  authored:
    " Fragment resolution: AUTHORED — composed from the authored fragment versions " +
    "on disk, which MAY DIFFER from the versions active in any database. This is " +
    "evidence about a candidate composition, not about what production is serving " +
    "(docs/38 D-63 §4).",
};

const attestationFor = (resolution: FragmentResolution): string =>
  RECORDED_MODE + RESOLUTION_CLAUSE[resolution];

/** The parts encoded in a reference string. */
export interface ParsedPassReference {
  readonly suiteVersion: string;
  readonly fragmentsManifestVersion: string;
  readonly runId: string;
}

/**
 * Reads a reference string back into its parts, or `null` if it is not one.
 *
 * The format is written in exactly one place — `buildPassReference` — and read
 * in exactly this one. A consumer that parsed it itself would be a second
 * definition of the same identity, free to drift from the producer.
 *
 * `fragment-manifest-gate:` references are **not** accepted here. `docs/12`
 * D-14 recorded that value as the honest stand-in for Sprint 1, "always meant
 * to be replaced by a reference naming a real corpus run" — so it parses as
 * what it is, a non-corpus reference, and the caller refuses it by name.
 */
export function parsePassReference(
  reference: string,
): ParsedPassReference | null {
  const match = /^corpus-regression:(.+)\+([^:+]+):([0-9a-f]{16})$/.exec(
    reference,
  );
  if (match === null) return null;

  const [, suiteVersion, fragmentsManifestVersion, runId] = match;
  if (
    suiteVersion === undefined ||
    fragmentsManifestVersion === undefined ||
    runId === undefined
  ) {
    return null;
  }
  return { suiteVersion, fragmentsManifestVersion, runId };
}

export interface PassReferenceInputs {
  readonly report: RegressionReport;
  readonly fragmentsManifestVersion: string;
  readonly completedAt?: string;
  /**
   * Total cases in the suite, when the caller knows it.
   *
   * Omitting it means the reference **declines to claim completeness** and
   * records `partial`. That is the safe direction: a reference that cannot
   * prove it covered everything must not imply it did.
   */
  readonly corpusSize?: number;
  /**
   * The targeting basis, when this run covered a subset (`docs/12` D-30 dec. 3).
   *
   * Present means: these cases ran **because** they compose the named fragment.
   * Absent means the selection was not fragment-targeted — it does **not** mean
   * the run was suite-wide. Either way the reference states `selectionScope`
   * rather than leaving a reader to infer it.
   */
  readonly coverage?: FragmentCoverage;
  /** Defaults to `active`, preserving pre-D-63 behaviour for existing callers. */
  readonly fragmentResolution?: FragmentResolution;
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
        report.suiteVersion,
        inputs.fragmentsManifestVersion,
        // A targeted run and a full run over the same cases measured different
        // things and must not share an id.
        inputs.coverage?.fragmentKey ?? null,
        inputs.coverage?.fragmentVersionId ?? null,
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

  const resolution: FragmentResolution = inputs.fragmentResolution ?? "active";
  const runId = runIdFor(inputs);
  return {
    suite: SUITE_ID,
    reference: `${SUITE_ID}:${inputs.report.suiteVersion}+${inputs.fragmentsManifestVersion}:${runId}`,
    mode: inputs.report.mode,
    suiteVersion: inputs.report.suiteVersion,
    fragmentsManifestVersion: inputs.fragmentsManifestVersion,
    fragmentsCompositions: compositions,
    selectionScope:
      inputs.coverage !== undefined
        ? "targeted"
        : inputs.corpusSize !== undefined &&
            inputs.report.cases.length === inputs.corpusSize
          ? "entire_corpus"
          : "partial",
    ...(inputs.coverage !== undefined ? { coverage: inputs.coverage } : {}),
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
    fragmentResolution: resolution,
    attests: attestationFor(resolution),
  };
}
