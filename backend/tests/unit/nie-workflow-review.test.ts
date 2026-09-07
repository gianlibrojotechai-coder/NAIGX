/**
 * Unit — Stage 6W, Workflow Review (`FR-021`, `docs/15` D-40).
 *
 * Three acceptance criteria in `FR-021` are the whole subject here, because
 * each one describes a way a review can look finished and be worthless:
 *
 *   1. evaluating a structure it never stated,
 *   2. issuing findings that name no step ("generic best-practice statements"),
 *   3. reporting nothing and letting silence pass for approval.
 *
 * The parser refuses all three. These tests are mostly about the refusals.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { StageError, type ContextResult } from "../../src/nie/contracts.js";
import {
  WorkflowReviewGroundingError,
  parseWorkflowReview,
} from "../../src/nie/stages/workflow-review.js";

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "A Zapier zap watches a Google Form for new submissions",
      category: "environment",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 54,
      specificityScore: 0.9,
    },
    {
      content: "Each submission is appended to a Google Sheet",
      category: "environment",
      provenance: "stated",
      sourceSpanStart: 55,
      sourceSpanEnd: 100,
      specificityScore: 0.9,
    },
  ],
};

const step = (overrides: Record<string, unknown> = {}) => ({
  name: "Form Watcher",
  responsibility: "Detect new Google Form submissions",
  inputs: "Google Form submission events",
  outputs: "Submission payload",
  failure_handling: "The submitted workflow does not state what happens here",
  grounded_in_context_indices: [0],
  ...overrides,
});

const finding = (overrides: Record<string, unknown> = {}) => ({
  component_index: 0,
  description: "The watcher silently drops a submission when the zap is paused",
  severity: 4,
  likelihood: 2,
  remediation:
    "Add a daily reconciliation that compares form response count to sheet row count and alerts on a gap",
  ...overrides,
});

const review = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    summary: "A two-step Zapier workflow moving form responses into a sheet",
    data_flow_description: "Google Form → Zapier → Google Sheet",
    structure: [step()],
    findings: [finding()],
    optimisations: [],
    ...overrides,
  });

// --- the happy path ------------------------------------------------------

test("a grounded review with a step-cited finding parses", () => {
  const result = parseWorkflowReview(
    review({
      structure: [
        step(),
        step({
          name: "Sheet Appender",
          responsibility: "Append the submission as a row",
          grounded_in_context_indices: [1],
          external_system: "Google Sheets",
          integration_direction: "outbound",
        }),
      ],
      findings: [finding(), finding({ component_index: 1, severity: 2 })],
      optimisations: ["Batch appends to stay under the Sheets write quota"],
    }),
    context,
  );

  assert.equal(result.structure.length, 2);
  assert.equal(result.findings.length, 2);
  assert.equal(result.findings[1]?.componentIndex, 1);
  assert.equal(result.structure[1]?.externalSystem, "Google Sheets");
  // Ordinal is the reviewer's stated order, which is what a finding indexes.
  assert.deepEqual(
    result.structure.map((s) => s.ordinal),
    [0, 1],
  );
});

// --- 1. structure before evaluation --------------------------------------

test("a review that states no structure is refused", () => {
  assert.throws(
    () => parseWorkflowReview(review({ structure: [] }), context),
    (error: unknown) =>
      error instanceof StageError && /current structure/.test(error.message),
    "FR-021: the structure is identified before it is evaluated",
  );
});

test("a step grounded in nothing is refused, and is worth a regeneration", () => {
  assert.throws(
    () =>
      parseWorkflowReview(
        review({ structure: [step({ grounded_in_context_indices: [] })] }),
        context,
      ),
    WorkflowReviewGroundingError,
    "a step the submission does not describe is one the reviewer invented",
  );
});

test("a step citing a context element that does not exist is refused", () => {
  assert.throws(
    () =>
      parseWorkflowReview(
        review({ structure: [step({ grounded_in_context_indices: [7] })] }),
        context,
      ),
    (error: unknown) =>
      error instanceof WorkflowReviewGroundingError &&
      /indices 0-1/.test(error.message),
  );
});

test("two steps cannot share a name", () => {
  // `DB §4.3` is unique on (architecture_id, name), and a reader resolving a
  // finding by name would not know which step it meant.
  assert.throws(
    () =>
      parseWorkflowReview(
        review({ structure: [step(), step()], findings: [finding()] }),
        context,
      ),
    (error: unknown) =>
      error instanceof StageError && /Duplicate step name/.test(error.message),
  );
});

// --- 2. no generic findings ----------------------------------------------

test("a finding naming no step is refused", () => {
  assert.throws(
    () => {
      const wire = JSON.parse(review()) as Record<string, unknown>;
      const findings = wire["findings"] as Record<string, unknown>[];
      delete findings[0]?.["component_index"];
      return parseWorkflowReview(JSON.stringify(wire), context);
    },
    (error: unknown) =>
      error instanceof StageError &&
      /component_index must be a non-negative integer/.test(error.message),
  );
});

test("a finding naming a step outside the stated structure is refused", () => {
  assert.throws(
    () =>
      parseWorkflowReview(
        review({ findings: [finding({ component_index: 3 })] }),
        context,
      ),
    (error: unknown) =>
      error instanceof WorkflowReviewGroundingError &&
      /generic/.test(error.message),
    "FR-021 rejects generic best-practice statements, and this is how one looks",
  );
});

test("severity and likelihood are rejected rather than clamped", () => {
  for (const field of ["severity", "likelihood"]) {
    for (const value of [0, 6, 2.5, "high"]) {
      assert.throws(
        () =>
          parseWorkflowReview(
            review({ findings: [finding({ [field]: value })] }),
            context,
          ),
        (error: unknown) =>
          error instanceof StageError && /integer 1-5/.test(error.message),
        `${field}=${JSON.stringify(value)} is outside the docs/09 §2 scale`,
      );
    }
  }
});

// --- 3. silence is not approval ------------------------------------------

test("no findings and no soundness statement is refused", () => {
  assert.throws(
    () => parseWorkflowReview(review({ findings: [] }), context),
    (error: unknown) =>
      error instanceof StageError &&
      /silence is not the same claim as soundness/.test(error.message),
  );
});

test("no findings with an explicit soundness statement is accepted", () => {
  const result = parseWorkflowReview(
    review({
      findings: [],
      soundness_statement:
        "Both steps handle their own failures and the data path has no unrecoverable gap",
    }),
    context,
  );

  assert.equal(result.findings.length, 0);
  assert.match(result.soundnessStatement ?? "", /unrecoverable gap/);
});

test("a blank soundness statement does not satisfy the requirement", () => {
  assert.throws(
    () =>
      parseWorkflowReview(
        review({ findings: [], soundness_statement: "   " }),
        context,
      ),
    (error: unknown) =>
      error instanceof StageError && /silence/.test(error.message),
  );
});

// --- shape ---------------------------------------------------------------

test("optimisations must be non-empty strings", () => {
  assert.throws(
    () => parseWorkflowReview(review({ optimisations: [""] }), context),
    (error: unknown) =>
      error instanceof StageError && /non-empty strings/.test(error.message),
  );
});

test("the stage reports itself as stage 6, keyed workflow_review", () => {
  try {
    parseWorkflowReview(review({ structure: [] }), context);
    assert.fail("expected a refusal");
  } catch (error) {
    assert.ok(error instanceof StageError);
    assert.equal(error.stageNumber, 6);
    assert.equal(error.stageKey, "workflow_review");
  }
});
