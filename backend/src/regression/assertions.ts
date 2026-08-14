/**
 * Deterministic corpus assertions (`AI §12.3`, `docs/11` §9).
 *
 * `AI §12.3` splits the suite in two. **Deterministic assertions** —
 * classification, artifact set, confidence band, schema validity, reference
 * integrity — are hard pass/fail. **Non-deterministic content** is compared to
 * a baseline and flagged for human review, never auto-failed. This module
 * implements the deterministic half only; the baseline half needs a baseline
 * location, which `docs/11` A-4 records as still unspecified.
 *
 * WHAT IS ASSERTED IS BOUNDED BY WHAT EXISTS. `docs/11` §9 maps five
 * assertions to corpus fields, and three of them read outputs that Sprint 1
 * does not produce — artifact sets come from Stages 8-9 and the confidence band
 * from Stage 11, all Sprint 2. Those are reported as **deferred**, with the
 * stage that will satisfy them named.
 *
 * A deferred assertion is not a silent gap: it appears in the run report and in
 * the pass reference, so a run that measures less than the corpus specifies
 * says so rather than passing quietly.
 */

import { producesArchitecture } from "../nie/contracts.js";
import type { PipelineResult } from "../nie/contracts.js";
import type { CorpusCase } from "./corpus.js";

export type AssertionStatus = "passed" | "failed" | "deferred";

export interface AssertionOutcome {
  readonly id: string;
  readonly status: AssertionStatus;
  /** Why it failed, or which stage will make a deferred assertion runnable. */
  readonly detail: string;
  readonly specRef: string;
}

/**
 * The `docs/11` §9 assertion set, with the ones Sprint 1's stages cannot yet
 * answer marked and attributed.
 */
export const ASSERTION_CATALOGUE = [
  {
    id: "classification",
    specRef: "docs/11 §9, FR-011",
    supported: true,
    deferredTo: null,
  },
  {
    id: "classification_confidence_bound",
    specRef: "docs/11 §4.4, FR-011, FR-015",
    supported: true,
    deferredTo: null,
  },
  {
    id: "refusal_behaviour",
    specRef: "docs/11 §3, FR-092, AI §5.4",
    supported: true,
    deferredTo: null,
  },
  {
    id: "reference_integrity",
    specRef: "AI §12.5, FR-030, FR-013",
    supported: true,
    deferredTo: null,
  },
  {
    id: "conflict_detection",
    specRef: "docs/11 §3, AI §5.2",
    supported: true,
    deferredTo: null,
  },
  {
    id: "run_completeness",
    specRef: "AI §9.1, FR-030, docs/12 D-24",
    supported: true,
    deferredTo: null,
  },
  {
    id: "artifact_set",
    specRef: "docs/11 §9, FR-017",
    supported: false,
    deferredTo: "Stages 8-9 (artifact planning and generation), Sprint 2",
  },
  {
    id: "confidence_band",
    specRef: "docs/11 §9, AI §8",
    supported: false,
    deferredTo: "Stage 11 (confidence evaluation), Sprint 2",
  },
  {
    id: "do_not_automate_conclusion",
    specRef: "docs/11 §3, AC-013",
    supported: false,
    deferredTo: "Stage 7 (recommendation generation), Sprint 2",
  },
] as const;

export type AssertionId = (typeof ASSERTION_CATALOGUE)[number]["id"];

export const SUPPORTED_ASSERTIONS: readonly AssertionId[] =
  ASSERTION_CATALOGUE.filter((a) => a.supported).map((a) => a.id);

export const DEFERRED_ASSERTIONS: readonly AssertionId[] =
  ASSERTION_CATALOGUE.filter((a) => !a.supported).map((a) => a.id);

const spec = (id: AssertionId): string =>
  ASSERTION_CATALOGUE.find((a) => a.id === id)?.specRef ?? "";

const pass = (id: AssertionId, detail: string): AssertionOutcome => ({
  id,
  status: "passed",
  detail,
  specRef: spec(id),
});

const failed = (id: AssertionId, detail: string): AssertionOutcome => ({
  id,
  status: "failed",
  detail,
  specRef: spec(id),
});

const deferred = (id: AssertionId): AssertionOutcome => ({
  id,
  status: "deferred",
  detail:
    ASSERTION_CATALOGUE.find((a) => a.id === id)?.deferredTo ??
    "not yet implementable",
  specRef: spec(id),
});

/**
 * Evaluates one completed run against one corpus case.
 *
 * Takes the `PipelineResult` rather than reaching into the pipeline: a halt is
 * a designed outcome carried on the result (`FR-092`, `AI §5.4`), not an
 * exception, so the refusal assertions read the same value the product does.
 */
export function evaluateCase(
  corpusCase: CorpusCase,
  result: PipelineResult,
): readonly AssertionOutcome[] {
  const outcomes: AssertionOutcome[] = [];

  // --- classification (`FR-011`) ------------------------------------------
  const determined = result.classification.determinedType;
  outcomes.push(
    determined === corpusCase.expectedClassification
      ? pass("classification", determined)
      : failed(
          "classification",
          `expected ${corpusCase.expectedClassification}, got ${determined}`,
        ),
  );

  // --- confidence bound (`FR-011` 0.6, `FR-015`) --------------------------
  // The corpus states a *bound*, not a value: `docs/11` §4.4 keeps this a
  // threshold-relative expectation precisely because a specific confidence
  // number is a reasoning output and would drift.
  const { bound, threshold } = corpusCase.expectedClassificationConfidence;
  const confidence = result.classification.confidence;
  const satisfiesBound =
    bound === "below_threshold"
      ? confidence < threshold
      : confidence >= threshold;
  outcomes.push(
    satisfiesBound
      ? pass(
          "classification_confidence_bound",
          `${String(confidence)} is ${bound.replace(/_/g, " ")} ${String(threshold)}`,
        )
      : failed(
          "classification_confidence_bound",
          `expected ${bound} ${String(threshold)}, got ${String(confidence)}`,
        ),
  );

  // --- refusal behaviour (`docs/11` §3) -----------------------------------
  // Two of the four special classes have a Sprint 1 consequence that is
  // observable today, and both are refusals rather than outputs.
  if (corpusCase.specialClass === "unsupported") {
    const declined =
      determined === "unsupported" && result.haltedAt?.stageNumber === 1;
    outcomes.push(
      declined
        ? pass("refusal_behaviour", "declined at Stage 1 (FR-092)")
        : failed(
            "refusal_behaviour",
            `expected a Stage 1 decline (FR-092), got ${determined} halted at ${String(result.haltedAt?.stageNumber ?? "no halt")}`,
          ),
    );
  } else if (corpusCase.specialClass === "insufficient") {
    // `AI §5.4`: "Analysis does not proceed to reasoning."
    const halted =
      result.context?.sufficiency === "insufficient" &&
      result.haltedAt?.stageNumber === 3;
    outcomes.push(
      halted
        ? pass(
            "refusal_behaviour",
            "halted at Stage 3 as insufficient (AI §5.4)",
          )
        : failed(
            "refusal_behaviour",
            `expected a Stage 3 insufficiency halt (AI §5.4), got sufficiency ${String(result.context?.sufficiency ?? "none")} halted at ${String(result.haltedAt?.stageNumber ?? "no halt")}`,
          ),
    );
  }

  // --- conflict detection (`AI §5.2`, CF-3) -------------------------------
  if (corpusCase.specialClass === "contradiction") {
    const conflicts =
      result.context?.elements.some(
        (e) => e.conflictsWithIndex !== undefined,
      ) ?? false;
    outcomes.push(
      conflicts
        ? pass(
            "conflict_detection",
            "a conflicting context element is recorded",
          )
        : failed(
            "conflict_detection",
            "no context element records a conflict, but the case is a contradiction case",
          ),
    );
  }

  // --- run completeness ---------------------------------------------------
  // A case that halts is only correct when a halt was expected. Without this,
  // a truncated recording whose context claims `insufficient` would satisfy
  // classification, the confidence bound and (vacuously) reference integrity,
  // and report PASS for a case that never produced an architecture at all.
  const expectsHalt =
    corpusCase.specialClass === "unsupported" ||
    corpusCase.specialClass === "insufficient";
  if (!expectsHalt) {
    const expectsArchitecture = producesArchitecture(
      corpusCase.expectedClassification,
    );
    const reasons: string[] = [];
    if (result.haltedAt !== undefined) {
      reasons.push(
        `halted at stage ${String(result.haltedAt.stageNumber)} but no halt is expected: ${result.haltedAt.reason}`,
      );
    }
    if (result.context === undefined) {
      reasons.push("no context was extracted");
    }
    if (expectsArchitecture && result.architecture === undefined) {
      reasons.push(
        `${corpusCase.expectedClassification} is an architecture-producing path (AI §9.1) but no architecture was produced`,
      );
    }
    if (
      expectsArchitecture &&
      (result.architecture?.components.length ?? 0) === 0
    ) {
      reasons.push("the architecture carries no components (FR-030)");
    }
    outcomes.push(
      reasons.length === 0
        ? pass("run_completeness", "the run reached its terminal stage")
        : failed("run_completeness", reasons.join("; ")),
    );
  } else {
    outcomes.push(
      pass("run_completeness", "a halt is expected for this case (docs/11 §3)"),
    );
  }

  // --- reference integrity (`AI §12.5` — 100%) ----------------------------
  // Structural, not corpus-derived (`docs/11` §9). Every architecture component
  // must ground in a context element that exists, and every `stated` element
  // must carry the span `FR-013` requires. The stages enforce both; asserting
  // them here is what makes "100%" a measured figure rather than a claim.
  const elementCount = result.context?.elements.length ?? 0;
  const danglingGrounding = (result.architecture?.components ?? []).flatMap(
    (component) =>
      component.groundedInContextIndices
        .filter((i) => i < 0 || i >= elementCount)
        .map((i) => `${component.name} → context[${String(i)}]`),
  );
  const spanless = (result.context?.elements ?? []).filter(
    (e) =>
      e.provenance === "stated" &&
      (e.sourceSpanStart === undefined || e.sourceSpanEnd === undefined),
  );
  // Vacuity is a failure, not a pass. Zero elements and zero components
  // satisfy "no dangling reference" trivially, and `AI §12.5`'s 100% would be
  // reported against nothing — the emptiest possible green.
  const ungrounded = (result.architecture?.components ?? []).filter(
    (c) => c.groundedInContextIndices.length === 0,
  );
  const vacuous: string[] = [];
  if (result.context !== undefined && elementCount === 0) {
    vacuous.push(
      "the context set is empty, so integrity is asserted over nothing",
    );
  }
  for (const component of ungrounded) {
    vacuous.push(
      `component "${component.name}" cites no context element (FR-030)`,
    );
  }

  const integrityProblems = [
    ...danglingGrounding.map((d) => `dangling grounding: ${d}`),
    ...spanless.map(
      (e) => `stated element without a source span: ${e.content}`,
    ),
    ...vacuous,
  ];
  outcomes.push(
    integrityProblems.length === 0
      ? pass(
          "reference_integrity",
          `${String(elementCount)} context element(s), ${String(result.architecture?.components.length ?? 0)} component(s), every grounding resolved`,
        )
      : failed("reference_integrity", integrityProblems.join("; ")),
  );

  // --- what this run does not measure -------------------------------------
  for (const id of DEFERRED_ASSERTIONS) {
    if (
      id === "do_not_automate_conclusion" &&
      corpusCase.specialClass !== "do-not-automate"
    ) {
      continue;
    }
    outcomes.push(deferred(id));
  }

  return outcomes;
}

export const caseFailed = (outcomes: readonly AssertionOutcome[]): boolean =>
  outcomes.some((o) => o.status === "failed");
