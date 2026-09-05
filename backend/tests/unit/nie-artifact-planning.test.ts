/**
 * Unit — Stage 8, Artifact Planning (`FR-017`, `FR-024`, `docs/12` D-29).
 *
 * The property that matters is **determinism**. `AI` App. A makes Stage 8
 * rule-based specifically because a model-chosen artifact set "varies between
 * runs on identical input", so the first test here is that identical input
 * yields an identical plan — and the rest are the rules themselves.
 *
 * The second property is that an omission is never silence. `DB §4.4` requires
 * a reason on every unplanned entry so the reader can tell "chose not to" from
 * "tried and failed".
 *
 * No provider, no database, no filesystem.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  RecommendationResult,
  RequirementKind,
} from "../../src/nie/contracts.js";
import {
  eligibleGaps,
  isPlanned,
  planArtifacts,
} from "../../src/nie/stages/artifact-planning.js";

const requirement = (id: string, kind: RequirementKind) => ({
  id,
  name: `Requirement ${id}`,
  necessity: "must_have" as const,
  provenance: "stated" as const,
  kind,
  groundedInContextIndices: [0],
});

const gap = (requirementId: string) => ({
  requirementId,
  priority: "high" as const,
  whyItMatters: "x",
});

/** build_first with one technical decisive gap and one of each other kind. */
const recommendation = (
  overrides: Partial<RecommendationResult> = {},
): RecommendationResult => ({
  requiredCapabilities: [
    requirement("req-1", "technical"),
    requirement("req-2", "technical"),
    requirement("req-3", "disposition"),
    requirement("req-4", "domain_experience"),
    requirement("req-5", "track_record"),
  ],
  matched: [
    {
      requirementId: "req-1",
      capabilityId: "cap-001",
      strength: "strong",
      evidenceRef: "https://example.invalid/a",
    },
  ],
  gaps: [gap("req-2"), gap("req-3"), gap("req-4"), gap("req-5")],
  verdict: {
    decision: "build_first",
    rationale: "x",
    decisiveGaps: ["req-2"],
  },
  ...overrides,
});

// --- determinism (FR-024) -------------------------------------------------

test("the same input produces the same plan, every time", () => {
  const input = recommendation();
  const first = planArtifacts(input);
  for (let i = 0; i < 20; i += 1) {
    assert.deepEqual(planArtifacts(input), first);
  }
});

test("the plan names every artifact type on the path, planned or not", () => {
  const plan = planArtifacts(recommendation());
  assert.deepEqual(
    plan.map((e) => e.artifactType),
    ["skill_gap_analysis", "portfolio_suggestions", "interview_guidance"],
  );
});

test("every entry carries a reason for its decision (DB §4.4)", () => {
  for (const decision of ["build_first", "apply_now"] as const) {
    const plan = planArtifacts(
      recommendation({
        verdict: {
          decision,
          rationale: "x",
          decisiveGaps: decision === "build_first" ? ["req-2"] : [],
        },
      }),
    );
    for (const entry of plan) {
      if (entry.planned) {
        assert.ok(
          entry.inclusionReason !== undefined &&
            entry.inclusionReason.length > 0,
          `${entry.artifactType}: a planned artifact states why`,
        );
      } else {
        assert.ok(
          entry.omissionReason !== undefined && entry.omissionReason.length > 0,
          `${entry.artifactType}: an omission is a decision, not an absence`,
        );
      }
    }
  }
});

// --- eligibility: the D-28 refusals, carried forward ---------------------

test("only technical, decisive, reported gaps are eligible", () => {
  const eligible = eligibleGaps(recommendation());
  assert.deepEqual(
    eligible.map((g) => g.requirementId),
    ["req-2"],
    "the disposition, domain_experience and track_record gaps are excluded",
  );
});

test("a technical gap that is not decisive is not eligible", () => {
  const eligible = eligibleGaps(
    recommendation({
      verdict: { decision: "build_first", rationale: "x", decisiveGaps: [] },
    }),
  );
  assert.deepEqual(eligible, []);
});

test("no gap is eligible when the verdict is apply_now", () => {
  assert.deepEqual(
    eligibleGaps(
      recommendation({
        verdict: { decision: "apply_now", rationale: "x", decisiveGaps: [] },
      }),
    ),
    [],
  );
});

// --- what gets planned ----------------------------------------------------

test("build_first with an eligible gap plans portfolio_suggestions", () => {
  const plan = planArtifacts(recommendation());
  assert.equal(isPlanned(plan, "portfolio_suggestions"), true);
  const entry = plan.find((e) => e.artifactType === "portfolio_suggestions");
  assert.match(entry?.inclusionReason ?? "", /req-2/);
});

test("apply_now plans nothing, and says why", () => {
  const plan = planArtifacts(
    recommendation({
      verdict: { decision: "apply_now", rationale: "x", decisiveGaps: [] },
    }),
  );
  assert.equal(isPlanned(plan, "portfolio_suggestions"), false);
  const entry = plan.find((e) => e.artifactType === "portfolio_suggestions");
  assert.match(entry?.omissionReason ?? "", /apply_now/);
});

test("the unimplemented generators are omitted as a decision, not a failure", () => {
  const plan = planArtifacts(recommendation());
  for (const type of ["skill_gap_analysis", "interview_guidance"] as const) {
    const entry = plan.find((e) => e.artifactType === type);
    assert.equal(entry?.planned, false);
    assert.match(entry?.omissionReason ?? "", /No generator/);
  }
});

test("no artifact is planned when every decisive gap is non-technical", () => {
  // Unreachable through the Stage 7 parser, which forbids it. Handled anyway:
  // a plan that assumes an upstream invariant breaks silently when it moves.
  const plan = planArtifacts(
    recommendation({
      verdict: {
        decision: "build_first",
        rationale: "x",
        decisiveGaps: ["req-3"],
      },
    }),
  );
  assert.equal(isPlanned(plan, "portfolio_suggestions"), false);
  const entry = plan.find((e) => e.artifactType === "portfolio_suggestions");
  assert.match(entry?.omissionReason ?? "", /No decisive technical gap/);
});
