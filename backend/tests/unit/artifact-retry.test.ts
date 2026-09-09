/**
 * Unit — the per-path retry decision (D-81, `API-032`, `FR-091`).
 *
 * A type that is generated on one path and rendered on another cannot be
 * judged retryable by its name alone. These pin the predicate both ways.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  GENERATED_ARTIFACT_TYPES,
  PATH_GENERATED_ARTIFACT_TYPES,
  isRetryableArtifact,
  isRetryableArtifactType,
} from "../../src/nie/contracts.js";

test("types generated on every path stay retryable on every path", () => {
  for (const type of GENERATED_ARTIFACT_TYPES) {
    assert.equal(isRetryableArtifactType(type), true);
    assert.equal(isRetryableArtifact(type, "job_description"), true);
    assert.equal(isRetryableArtifact(type, undefined), true);
  }
});

test("the register is retryable where it is generated and not where it is rendered", () => {
  assert.equal(isRetryableArtifactType("risk_assessment"), false);
  assert.equal(
    isRetryableArtifact("risk_assessment", "business_requirement"),
    true,
  );
  assert.equal(
    isRetryableArtifact("risk_assessment", "existing_workflow"),
    false,
  );
  assert.equal(isRetryableArtifact("risk_assessment", undefined), false);
});

test("the score is retryable on both paths that generate it, and nowhere else", () => {
  assert.deepEqual(PATH_GENERATED_ARTIFACT_TYPES.complexity_score, [
    "business_requirement",
    "existing_workflow",
  ]);
  assert.equal(
    isRetryableArtifact("complexity_score", "business_requirement"),
    true,
  );
  assert.equal(
    isRetryableArtifact("complexity_score", "existing_workflow"),
    true,
  );
  assert.equal(
    isRetryableArtifact("complexity_score", "technical_assessment"),
    false,
  );
});

test("rendered-only types are never retryable, on any path", () => {
  for (const type of [
    "mermaid_diagram",
    "architecture_recommendation",
    "business_analysis",
    "workflow_recommendation",
    "assessment_feedback",
    "intent_brief",
  ]) {
    for (const path of [
      "business_requirement",
      "job_description",
      "existing_workflow",
      "technical_assessment",
    ] as const) {
      assert.equal(
        isRetryableArtifact(type, path),
        false,
        `${type} on ${path}`,
      );
    }
  }
});
