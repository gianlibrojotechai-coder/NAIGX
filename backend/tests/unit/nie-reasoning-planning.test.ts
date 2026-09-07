/**
 * Unit — Stage 5, Reasoning Planning (`FR-017`, `AI §5`, `docs/12` D-34, D-35).
 *
 * Stage 5 is the orchestration rule set `FR-017` requires to be "explicit and
 * inspectable". These assert the rules, the single depth domain, and — as much
 * as a test can — the two things the stage deliberately does **not** do:
 * fabricate a complexity assessment, and invent a module for a path the
 * specification maps to none.
 *
 * Deterministic and offline. No provider, no database, no clock.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { CLASSIFICATION_TYPES } from "../../src/nie/contracts.js";
import type { ClassificationType } from "../../src/nie/contracts.js";
import {
  planReasoning,
  REASONING_MODULES,
} from "../../src/nie/stages/reasoning-planning.js";
import { stageByNumber } from "../../src/nie/stages.js";

// --- module selection ----------------------------------------------------

test("architecture is planned for the requirement and assessment paths", () => {
  // `AI §4.2`: "Architecture design applies to requirements and assessments."
  for (const type of [
    "business_requirement",
    "technical_assessment",
  ] as const) {
    assert.deepEqual(planReasoning(type).requiredAnalyses, [
      "architecture_analysis",
    ]);
  }
});

test("gap analysis is planned for postings, and architecture is not", () => {
  // `AI §4.2`: "gap analysis applies to postings." `AI §4.1`: "No architecture
  // generated" on this path.
  const plan = planReasoning("job_description");

  assert.deepEqual(plan.requiredAnalyses, ["recommendation_generation"]);
  assert.ok(!plan.requiredAnalyses.includes("architecture_analysis"));
});

test("only unsupported gets an empty plan", () => {
  // `unsupported` is settled — `FR-092` declines before reasoning, so there is
  // nothing to plan.
  assert.deepEqual(planReasoning("unsupported").requiredAnalyses, []);

  // `existing_workflow` was empty until `docs/15` D-40 found the mapping in
  // `AI §7.1` rather than `AI §4.2`. It routes now, and this asserts the
  // resolution rather than the gap it replaced.
  assert.deepEqual(planReasoning("existing_workflow").requiredAnalyses, [
    "workflow_review",
  ]);
});

test("every classification type produces a plan", () => {
  for (const type of CLASSIFICATION_TYPES) {
    const plan = planReasoning(type as ClassificationType);
    assert.ok(Array.isArray(plan.requiredAnalyses));
    for (const module of plan.requiredAnalyses) {
      assert.ok(
        (REASONING_MODULES as readonly string[]).includes(module),
        `${type} planned an unregistered module: ${module}`,
      );
    }
  }
});

test("planned modules name real stages, not a parallel vocabulary", () => {
  // The module vocabulary is stage keys, so a renamed stage breaks here rather
  // than drifting silently. `workflow_review` is Stage 6’s second generator
  // (`docs/15` D-40) and shares its number — the same shape Stage 9 uses for
  // per-generator prompts (`docs/12` D-29).
  assert.equal(stageByNumber(6).stageKey, "architecture_analysis");
  assert.equal(stageByNumber(7).stageKey, "recommendation_generation");
  assert.deepEqual([...REASONING_MODULES].sort(), [
    "architecture_analysis",
    "recommendation_generation",
    "workflow_review",
  ]);
});

// --- depth (`docs/12` D-34) ----------------------------------------------

test("depth_level is exactly standard for every path", () => {
  for (const type of CLASSIFICATION_TYPES) {
    assert.equal(
      planReasoning(type as ClassificationType).depthLevel,
      "standard",
      `${type} must use the single v1 depth domain`,
    );
  }
});

// --- what Stage 5 must not produce (`docs/12` D-35) ----------------------

test("no complexity assessment is fabricated", () => {
  for (const type of CLASSIFICATION_TYPES) {
    const plan = planReasoning(type as ClassificationType) as unknown as Record<
      string,
      unknown
    >;

    assert.deepEqual(
      Object.keys(plan).sort(),
      ["depthLevel", "requiredAnalyses"],
      `${type}: Stage 5 emits two outputs; the complexity pre-assessment is deferred and undefined (D-35)`,
    );
    for (const forbidden of [
      "complexity",
      "complexityScore",
      "complexityPreAssessment",
      "score",
      "factorBreakdown",
      "scaleVersion",
    ]) {
      assert.equal(
        plan[forbidden],
        undefined,
        `${type}: ${forbidden} would invent the deferred output`,
      );
    }
  }
});

test("stage 5 is registered as implemented and produces no artifact type", () => {
  const stage = stageByNumber(5);

  assert.equal(stage.stageKey, "reasoning_planning");
  assert.equal(stage.implemented, true);
  assert.deepEqual(
    stage.producesArtifactTypes,
    [],
    "planning selects reasoning; artifact generation is Stage 9",
  );
});

// --- determinism (`FR-024`, `AI` App. A) ---------------------------------

test("repeated planning is identical", () => {
  for (const type of CLASSIFICATION_TYPES) {
    const a = planReasoning(type as ClassificationType);
    const b = planReasoning(type as ClassificationType);
    assert.deepEqual(a, b);
  }
});
