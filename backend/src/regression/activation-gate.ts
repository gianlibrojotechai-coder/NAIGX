/**
 * The fragment activation gate (`NFR-043`, `DB §4.5`, `docs/12` D-14, D-24, D-30).
 *
 * `DB §4.5` makes the quality gate a **data constraint**: "`activated_at`
 * requires a `regression_pass_reference`… a fragment version cannot become
 * active without a recorded passing regression run. The quality gate is
 * enforced by the schema, not by process discipline."
 *
 * The column has been satisfiable by any non-empty string, so the constraint
 * accepted a value the publisher manufactured for itself. `docs/12` D-14
 * recorded that stand-in — `fragment-manifest-gate:<version>` — as honest for
 * Sprint 1 and "always meant to be replaced by a reference naming a real corpus
 * run". This is that replacement: the refusal has to happen here, because
 * nothing at the database layer can tell a real reference from a plausible one.
 *
 * WHAT IT DEMANDS, AND WHY EACH PART. `docs/12` D-24 decision 4: "Fragment
 * activation requires evidence that exercised the changed fragment — a capture
 * or a live run. A `regression_pass_reference` naming a replay of the
 * *previous* fragment's responses is not a pass on the change." So a reference
 * must resolve to a real run, that run must be clean, and its cases must
 * include every case the fragment being activated composes into (`docs/12`
 * D-30 decision 3).
 *
 * IT REUSES, IT DOES NOT REIMPLEMENT. The reference format is parsed by its
 * producer's own parser (`parsePassReference`), and coverage comes from
 * `computeFragmentCoverage`. A second definition of either would be free to
 * disagree with the thing it is supposed to be checking.
 *
 * NO WRITES, NO NETWORK, NO PROVIDER. It reads two directories and decides.
 * Callers run it *before* opening a database connection, so a refusal cannot
 * leave a partially-activated fragment set behind.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FragmentResolver } from "../nie/ports.js";
import type { CorpusCase } from "./corpus.js";
import { computeFragmentCoverage } from "./coverage.js";
import { parsePassReference } from "./pass-reference.js";
import {
  fragmentsCompositionHash,
  type RecordingStore,
} from "./recording-store.js";

/** `research/regression-runs/` — where a pass reference document is written. */
export const REGRESSION_RUNS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../research/regression-runs",
);

/** Why the gate refused. Diagnosable without reading the message. */
export const REFUSAL_REASONS = [
  "missing_reference",
  "placeholder_reference",
  "unresolvable_reference",
  "run_not_clean",
  "fragment_not_covered",
  "composition_mismatch",
] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export class ActivationRefusedError extends Error {
  readonly reason: RefusalReason;
  /** The fragment the refusal concerns, when it concerns one. */
  readonly fragmentKey?: string;

  constructor(reason: RefusalReason, message: string, fragmentKey?: string) {
    super(message);
    this.name = "ActivationRefusedError";
    this.reason = reason;
    if (fragmentKey !== undefined) this.fragmentKey = fragmentKey;
  }
}

/** The stored reference document, as much of it as the gate reads. */
interface StoredReference {
  readonly suite?: unknown;
  readonly reference?: unknown;
  readonly runId?: unknown;
  readonly cases?: readonly {
    readonly caseId?: unknown;
    readonly recordingHash?: unknown;
    readonly fragmentsCompositionHash?: unknown;
    readonly assertionsEvaluated?: readonly unknown[];
  }[];
}

export interface ActivationGateInput {
  /** The reference offered for the activation, verbatim. */
  readonly reference: string | undefined;
  /** The fragment keys about to be activated. */
  readonly fragmentKeys: readonly string[];
  readonly cases: readonly CorpusCase[];
  readonly suiteVersion: string;
  readonly store: RecordingStore;
  readonly resolver: FragmentResolver;
  /** Overridable for tests; defaults to the committed runs directory. */
  readonly runsRoot?: string;
}

/**
 * Throws unless every named fragment may be activated under `reference`.
 *
 * @throws ActivationRefusedError — `reason` says which condition failed.
 */
export async function assertActivationPermitted(
  input: ActivationGateInput,
): Promise<void> {
  const { reference, fragmentKeys, cases, suiteVersion, store, resolver } =
    input;
  const runsRoot = input.runsRoot ?? REGRESSION_RUNS_ROOT;

  if (reference === undefined || reference.trim() === "") {
    throw new ActivationRefusedError(
      "missing_reference",
      "No regression pass reference supplied. `DB §4.5` makes activation conditional on " +
        "a recorded passing regression run; there is nothing here to check.",
    );
  }

  if (reference.startsWith("fragment-manifest-gate:")) {
    throw new ActivationRefusedError(
      "placeholder_reference",
      `"${reference}" is the Sprint 1 manifest-gate stand-in (docs/12 D-14), not a corpus run. ` +
        "It attests that the fragments match their manifest, which is not evidence that any " +
        "fragment was exercised. Supply a corpus-regression reference.",
    );
  }

  const parsed = parsePassReference(reference);
  if (parsed === null) {
    throw new ActivationRefusedError(
      "unresolvable_reference",
      `"${reference}" is not a corpus-regression reference. Expected ` +
        "`corpus-regression:<suite>+<fragments>:<runId>`.",
    );
  }

  const file = path.join(runsRoot, `${parsed.runId}.json`);
  let stored: StoredReference;
  try {
    stored = JSON.parse(fs.readFileSync(file, "utf8")) as StoredReference;
  } catch {
    throw new ActivationRefusedError(
      "unresolvable_reference",
      `No regression run recorded at regression-runs/${parsed.runId}.json. ` +
        "A reference naming a run nobody can inspect is a receipt, not evidence.",
    );
  }

  if (stored.suite !== "corpus-regression" || stored.reference !== reference) {
    throw new ActivationRefusedError(
      "unresolvable_reference",
      `regression-runs/${parsed.runId}.json does not identify itself as ${reference}. ` +
        "The document and the reference disagree about which run this is.",
    );
  }

  // Re-verified rather than assumed. `buildPassReference` emits a document only
  // for a clean run, but a file on disk is not proof that it did — and this
  // gate exists precisely because a plausible-looking value used to be enough.
  const runCases = stored.cases ?? [];
  if (runCases.length === 0) {
    throw new ActivationRefusedError(
      "run_not_clean",
      `Run ${parsed.runId} names no cases. A suite that measured nothing cannot unlock activation.`,
    );
  }
  for (const entry of runCases) {
    const evaluated = entry.assertionsEvaluated ?? [];
    if (
      typeof entry.caseId !== "string" ||
      typeof entry.recordingHash !== "string" ||
      entry.recordingHash === "" ||
      evaluated.length === 0
    ) {
      throw new ActivationRefusedError(
        "run_not_clean",
        `Run ${parsed.runId} contains a case with no evidence or no evaluated assertion ` +
          `(${String(entry.caseId ?? "unnamed")}). Missing, stale or unmanifested recordings ` +
          "leave a case without evidence, and none of them may unlock activation (docs/12 D-24).",
      );
    }
  }
  const ranCaseIds = new Set(runCases.map((c) => c.caseId as string));
  const ranComposition = new Map(
    runCases.map((c) => [
      c.caseId as string,
      typeof c.fragmentsCompositionHash === "string"
        ? c.fragmentsCompositionHash
        : "",
    ]),
  );
  const caseByIdName = new Map(cases.map((c) => [c.caseId, c]));

  for (const fragmentKey of fragmentKeys) {
    const coverage = await computeFragmentCoverage({
      fragmentKey,
      cases,
      suiteVersion,
      store,
      resolver,
    });

    if (coverage.coveredCaseIds.length === 0) {
      throw new ActivationRefusedError(
        "fragment_not_covered",
        `No recorded case composes ${fragmentKey}, so no run can have exercised it. ` +
          "Capture evidence for the cases it composes into before activating it.",
        fragmentKey,
      );
    }

    const missing = coverage.coveredCaseIds.filter((id) => !ranCaseIds.has(id));
    if (missing.length > 0) {
      throw new ActivationRefusedError(
        "fragment_not_covered",
        `Run ${parsed.runId} did not exercise ${fragmentKey}: it composes into ` +
          `${String(coverage.coveredCaseIds.length)} recorded case(s), and ${String(missing.length)} ` +
          `of them did not run (${missing.join(", ")}). A pass on cases the fragment does not ` +
          "reach is not a pass on the change (docs/12 D-24 decision 4).",
        fragmentKey,
      );
    }

    // --- D-64 §4.3 — the run must have exercised THIS composition -----------
    //
    // ⚠️ `docs/12` D-24 decision 4 in full: "A `regression_pass_reference`
    // naming a replay of the PREVIOUS fragment's responses is not a pass on
    // the change." Coverage alone cannot enforce that — it establishes which
    // cases reach the fragment, never which content they reached it with. So a
    // run that replayed every case against the ACTIVE composition satisfied
    // every check above while evidencing content the activation would replace.
    // That was measured, not imagined: reference 35af47fbdabae5eb permitted
    // activating a drifted `stage.architecture_analysis`.
    //
    // The comparison is per case and against the AUTHORED composition, because
    // `resolver` here is the authored one — the content about to be activated.
    // It reuses `fragmentsCompositionHash`, the same function the runner and
    // the recordings use, so there is no second notion of composition free to
    // disagree with the one being attested.
    for (const caseId of coverage.coveredCaseIds) {
      const corpusCase = caseByIdName.get(caseId);
      if (corpusCase === undefined) continue;
      const verified = store.read(corpusCase.corpusVersion, caseId);
      if (verified === undefined) continue;

      const candidate = await fragmentsCompositionHash(
        verified.recording.stages,
        resolver,
      );
      const exercised = ranComposition.get(caseId) ?? "";

      if (exercised !== candidate) {
        throw new ActivationRefusedError(
          "composition_mismatch",
          `Run ${parsed.runId} did not exercise the composition being activated for ${fragmentKey}: ` +
            `case ${caseId} replayed ${exercised.slice(0, 12) || "(none)"}, and the authored ` +
            `composition about to be activated hashes to ${candidate.slice(0, 12)}. A replay of the ` +
            "previous fragment's responses is not a pass on the change (docs/12 D-24 decision 4, " +
            "docs/39 D-64 §4.3). Re-capture the covered cases against the authored fragments.",
          fragmentKey,
        );
      }
    }
  }
}
