/**
 * Unit — Stage 11, the reduced v1 confidence model (D-86, `AI §8`, `FR-045`).
 *
 * Deterministic and rule-first: no artifact → low; a conflict caps at
 * medium; otherwise the weighted CF-2/CF-4 base against the fitted
 * thresholds. Every one of the seven factors is exposed, the unmeasured
 * ones as such.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  ArtifactPlanEntry,
  ContextResult,
} from "../../src/nie/contracts.js";
import {
  baseScore,
  evaluateConfidence,
  evidenceQuality,
  renderConfidence,
  requirementClarity,
  type ConfidenceModel,
} from "../../src/nie/stages/confidence-evaluation.js";

const MODEL: ConfidenceModel = {
  version: "test-model",
  clarityWeight: 0.5,
  highThreshold: 0.8,
  mediumThreshold: 0.6,
  fittedAgainst: "the test",
};

const element = (
  provenance: "stated" | "inferred" | "unknown",
  specificityScore: number,
  conflictsWithIndex?: number,
): ContextResult["elements"][number] => ({
  content: "c",
  category: "constraint",
  provenance,
  specificityScore,
  ...(provenance === "stated" ? { sourceSpanStart: 0, sourceSpanEnd: 1 } : {}),
  ...(provenance === "inferred" ? { inferenceBasis: "b" } : {}),
  ...(provenance === "unknown" ? { resolutionHint: "h" } : {}),
  ...(conflictsWithIndex !== undefined ? { conflictsWithIndex } : {}),
});

const context = (elements: ContextResult["elements"]): ContextResult => ({
  sufficiency: "sufficient",
  elements,
});

const generated = (...types: string[]): ArtifactPlanEntry[] =>
  types.map((artifactType) => ({
    artifactType: artifactType as ArtifactPlanEntry["artifactType"],
    planned: true,
    depthLevel: "standard",
    outcome: "generated",
    inclusionReason: "because",
  }));

test("CF-2 and CF-4 are measured as D-33 tabulated them", () => {
  const ctx = context([
    element("stated", 0.9),
    element("stated", 0.7),
    element("inferred", 0.4),
    element("unknown", 0.1),
  ]);
  assert.equal(requirementClarity(ctx), 2 / 3);
  assert.equal(evidenceQuality(ctx), 0.8);
  assert.equal(baseScore(2 / 3, 0.8, MODEL), 0.733);
  assert.equal(requirementClarity(context([element("unknown", 0.1)])), null);
  assert.equal(evidenceQuality(context([element("inferred", 0.5)])), null);
});

test("the weighted base decides the band against the thresholds", () => {
  const high = evaluateConfidence(
    {
      context: context([element("stated", 0.9), element("stated", 0.9)]),
      artifactPlan: generated("intent_brief", "business_analysis"),
    },
    MODEL,
  );
  assert.equal(high.band, "high");
  assert.equal(high.decidedBy, "weighted_base");
  assert.equal(high.baseScore, 0.95);
  const medium = evaluateConfidence(
    {
      context: context([element("stated", 0.7), element("inferred", 0.5)]),
      artifactPlan: generated("intent_brief", "business_analysis"),
    },
    MODEL,
  );
  // CF-2 = 1 of 2 = 0.5; CF-4 = 0.7; base = 0.5 × 0.5 + 0.5 × 0.7 = 0.6.
  assert.equal(medium.band, "medium");
  assert.equal(medium.baseScore, 0.6);
  const low = evaluateConfidence(
    {
      context: context([
        element("stated", 0.2),
        element("inferred", 0.2),
        element("inferred", 0.2),
      ]),
      artifactPlan: generated("intent_brief", "business_analysis"),
    },
    MODEL,
  );
  assert.equal(low.band, "low");
});

test("a conflict caps a high base at medium, and never raises (D-31 decision 2)", () => {
  const capped = evaluateConfidence(
    {
      context: context([element("stated", 0.95, 1), element("stated", 0.95)]),
      artifactPlan: generated("intent_brief", "business_analysis"),
    },
    MODEL,
  );
  assert.equal(capped.band, "medium");
  assert.equal(capped.decidedBy, "conflict_cap");
  const alreadyLow = evaluateConfidence(
    {
      context: context([
        element("stated", 0.2, 1),
        element("inferred", 0.2),
        element("inferred", 0.2),
      ]),
      artifactPlan: generated("intent_brief", "business_analysis"),
    },
    MODEL,
  );
  assert.equal(alreadyLow.band, "low");
  assert.equal(alreadyLow.decidedBy, "weighted_base");
});

test("an analysis with no artifact beyond the brief is low (D-31 decision 1), whatever the base", () => {
  const halted = evaluateConfidence(
    {
      context: context([element("stated", 0.95), element("stated", 0.95)]),
      artifactPlan: generated("intent_brief"),
    },
    MODEL,
  );
  assert.equal(halted.band, "low");
  assert.equal(halted.decidedBy, "no_artifacts");
  const refused = evaluateConfidence({ artifactPlan: [] }, MODEL);
  assert.equal(refused.band, "low");
  assert.equal(refused.baseScore, null);
});

test("all seven factors are exposed, the unmeasured ones as such, and the wire form carries them", () => {
  const evaluation = evaluateConfidence(
    {
      context: context([element("stated", 0.9)]),
      artifactPlan: generated("intent_brief", "business_analysis"),
    },
    MODEL,
  );
  assert.deepEqual(
    evaluation.factors.map((f) => f.id),
    ["CF-1", "CF-2", "CF-3", "CF-4", "CF-5", "CF-6", "CF-7"],
  );
  assert.deepEqual(
    evaluation.factors.filter((f) => f.role === "unmeasured").map((f) => f.id),
    ["CF-1", "CF-5", "CF-6", "CF-7"],
  );
  assert.equal(evaluation.factors.find((f) => f.id === "CF-2")?.weight, 0.5);
  assert.equal(evaluation.factors.find((f) => f.id === "CF-3")?.role, "cap");
  const wire = renderConfidence(evaluation);
  assert.equal(wire["band"], "high");
  assert.equal(wire["model_version"], "test-model");
  assert.equal((wire["factors"] as unknown[]).length, 7);
});
