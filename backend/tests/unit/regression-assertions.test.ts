/**
 * Unit — the deterministic assertions, over synthetic pipeline results.
 *
 * The runner test drives these through a real pipeline, which is the honest
 * end-to-end check but cannot construct every shape: the stage parsers reject
 * an ungrounded component or an empty context set long before the assertions
 * see one. Those are exactly the shapes that would make `AI §12.5`'s "100%"
 * a figure reported against nothing, so they are asserted directly here.
 *
 * No pipeline, no provider, no filesystem.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluateCase } from "../../src/regression/assertions.js";
import { parseCorpusCase } from "../../src/regression/corpus.js";
import type {
  ArchitectureResult,
  ClassificationResult,
  ClassificationType,
  ContextElement,
  ContextResult,
  PipelineResult,
} from "../../src/nie/contracts.js";

const TEXT = "Invoices arrive by email and finance keys them in by hand.";

const corpusCase = (overrides: Record<string, string> = {}) => {
  const fields = {
    expected_classification: "business_requirement",
    special_class: "null",
    ...overrides,
  };
  return parseCorpusCase(
    [
      "case_id: tt-002",
      "input_type: business_requirement",
      "content: |",
      `  ${TEXT}`,
      `character_count: ${String(TEXT.length)}`,
      `expected_classification: ${fields.expected_classification}`,
      "expected_artifact_set:",
      "  - architecture_recommendation",
      "expected_omissions: []",
      "expected_confidence_band: high",
      "expected_classification_confidence:",
      "  bound: at_or_above_threshold",
      "  threshold: 0.6",
      "  rationale: Synthetic.",
      "case_character: central",
      `special_class: ${fields.special_class}`,
      "rationale: Synthetic fixture.",
      "provenance:",
      "  origin: synthetic",
      "added: 2026-08-14",
      "frozen_at: 2026-08-14T00:00:00Z",
      "corpus_version: corpus-v1",
      "",
    ].join("\n"),
    "tests/regression-assertions.test.ts",
  );
};

const element: ContextElement = {
  content: "Invoices arrive by email",
  category: "environment",
  provenance: "stated",
  specificityScore: 0.9,
  sourceSpanStart: 0,
  sourceSpanEnd: 24,
};

const classification = (
  determinedType: ClassificationType = "business_requirement",
): ClassificationResult => ({
  determinedType,
  confidence: 0.9,
  candidateTypes: [determinedType],
  wasLowConfidence: false,
  mixedDetected: false,
});

const architecture: ArchitectureResult = {
  unknownDispositions: [],
  summary: "Automated capture",
  dataFlowDescription: "Mailbox to ledger",
  components: [
    {
      name: "Invoice Capture",
      responsibility: "Capture invoices",
      inputs: "Email",
      outputs: "Records",
      failureHandling: "Retry then quarantine",
      ordinal: 0,
      groundedInContextIndices: [0],
    },
  ],
};

/** `architecture: null` omits it — `exactOptionalPropertyTypes` is on. */
const result = (
  overrides: {
    classification?: ClassificationResult;
    context?: ContextResult;
    architecture?: ArchitectureResult | null;
    haltedAt?: { stageNumber: number; reason: string };
  } = {},
): PipelineResult => {
  const arch =
    overrides.architecture === null
      ? undefined
      : (overrides.architecture ?? architecture);
  return {
    classification: overrides.classification ?? classification(),
    intent: {
      primaryObjective: { content: "Automate invoicing", provenance: "stated" },
      secondaryObjectives: [],
      inferredScope: "Accounts payable",
    },
    context: overrides.context ?? {
      elements: [element],
      sufficiency: "sufficient",
    },
    ...(arch !== undefined ? { architecture: arch } : {}),
    ...(overrides.haltedAt !== undefined
      ? { haltedAt: overrides.haltedAt }
      : {}),
  };
};

const statusOf = (
  outcomes: ReturnType<typeof evaluateCase>,
  id: string,
): string | undefined => outcomes.find((o) => o.id === id)?.status;

test("a complete, grounded run passes both structural assertions", () => {
  const outcomes = evaluateCase(corpusCase(), result());
  assert.equal(statusOf(outcomes, "run_completeness"), "passed");
  assert.equal(statusOf(outcomes, "reference_integrity"), "passed");
});

// --- vacuity is a failure, not a pass ------------------------------------

test("an empty context set fails reference integrity rather than passing it", () => {
  const outcomes = evaluateCase(
    corpusCase(),
    result({
      context: { elements: [], sufficiency: "sufficient" },
      architecture: null,
    }),
  );

  assert.equal(statusOf(outcomes, "reference_integrity"), "failed");
  assert.match(
    outcomes.find((o) => o.id === "reference_integrity")?.detail ?? "",
    /asserted over nothing/,
  );
});

test("a component citing no context element fails (FR-030)", () => {
  const component = architecture.components[0];
  assert.ok(component);
  const outcomes = evaluateCase(
    corpusCase(),
    result({
      architecture: {
        ...architecture,
        components: [{ ...component, groundedInContextIndices: [] }],
      },
    }),
  );

  assert.equal(statusOf(outcomes, "reference_integrity"), "failed");
  assert.match(
    outcomes.find((o) => o.id === "reference_integrity")?.detail ?? "",
    /cites no context element/,
  );
});

test("a grounding index outside the context set fails", () => {
  const component = architecture.components[0];
  assert.ok(component);
  const outcomes = evaluateCase(
    corpusCase(),
    result({
      architecture: {
        ...architecture,
        components: [{ ...component, groundedInContextIndices: [7] }],
      },
    }),
  );

  assert.equal(statusOf(outcomes, "reference_integrity"), "failed");
});

// --- completeness ---------------------------------------------------------

test("an unexpected halt fails completeness", () => {
  const outcomes = evaluateCase(
    corpusCase(),
    result({
      architecture: null,
      haltedAt: { stageNumber: 3, reason: "Context insufficient" },
    }),
  );

  assert.equal(statusOf(outcomes, "run_completeness"), "failed");
});

test("an expected halt does not fail completeness", () => {
  const outcomes = evaluateCase(
    corpusCase({ special_class: "insufficient" }),
    result({
      architecture: null,
      context: { elements: [element], sufficiency: "insufficient" },
      haltedAt: { stageNumber: 3, reason: "Context insufficient" },
    }),
  );

  assert.equal(statusOf(outcomes, "run_completeness"), "passed");
  assert.equal(statusOf(outcomes, "refusal_behaviour"), "passed");
});

test("a non-architecture path is complete without an architecture (AI §9.1)", () => {
  const outcomes = evaluateCase(
    corpusCase({ expected_classification: "job_description" }),
    result({
      classification: classification("job_description"),
      architecture: null,
    }),
  );

  assert.equal(statusOf(outcomes, "run_completeness"), "passed");
  assert.equal(statusOf(outcomes, "reference_integrity"), "passed");
});
