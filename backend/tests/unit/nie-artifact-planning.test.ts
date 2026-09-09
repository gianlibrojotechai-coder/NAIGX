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
  withOutcome,
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
    criteriaApplied:
      "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when nothing in the profile evidences it.",
    alternatives: [
      {
        alternative: "Apply now without building",
        rejectionReason: "The decisive gap has no evidence behind it.",
      },
    ],
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
          criteriaApplied:
            "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when nothing in the profile evidences it.",
          alternatives: [
            {
              alternative: "Apply now without building",
              rejectionReason: "The decisive gap has no evidence behind it.",
            },
          ],
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
      verdict: {
        decision: "build_first",
        rationale: "x",
        decisiveGaps: [],
        criteriaApplied:
          "Evidenced capability against every must-have requirement.",
        alternatives: [
          { alternative: "The opposite verdict", rejectionReason: "x" },
        ],
      },
    }),
  );
  assert.deepEqual(eligible, []);
});

test("no gap is eligible when the verdict is apply_now", () => {
  assert.deepEqual(
    eligibleGaps(
      recommendation({
        verdict: {
          decision: "apply_now",
          rationale: "x",
          decisiveGaps: [],
          criteriaApplied:
            "Evidenced capability against every must-have requirement.",
          alternatives: [
            { alternative: "The opposite verdict", rejectionReason: "x" },
          ],
        },
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
      verdict: {
        decision: "apply_now",
        rationale: "x",
        decisiveGaps: [],
        criteriaApplied:
          "Evidenced capability against every must-have requirement.",
        alternatives: [
          { alternative: "The opposite verdict", rejectionReason: "x" },
        ],
      },
    }),
  );
  assert.equal(isPlanned(plan, "portfolio_suggestions"), false);
  const entry = plan.find((e) => e.artifactType === "portfolio_suggestions");
  assert.match(entry?.omissionReason ?? "", /apply_now/);
});

test("the unimplemented generator is omitted as a decision, not a failure", () => {
  const plan = planArtifacts(recommendation());
  const entry = plan.find((e) => e.artifactType === "interview_guidance");
  assert.equal(entry?.planned, false);
  assert.match(entry?.omissionReason ?? "", /No generator/);
});

test("the gap analysis is planned whichever way the verdict went (D-75)", () => {
  for (const decision of ["build_first", "apply_now"] as const) {
    const plan = planArtifacts(
      recommendation({
        verdict: {
          decision,
          rationale: "x",
          decisiveGaps: decision === "build_first" ? ["req-2"] : [],
          criteriaApplied:
            "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when nothing in the profile evidences it.",
          alternatives: [
            { alternative: "apply now", rejectionReason: "a decisive gap" },
          ],
        },
      }),
    );
    const entry = plan.find((e) => e.artifactType === "skill_gap_analysis");
    assert.equal(entry?.planned, true, decision);
    assert.match(entry?.inclusionReason ?? "", /Rendered from the Stage 7/);
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
        criteriaApplied:
          "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when nothing in the profile evidences it.",
        alternatives: [
          {
            alternative: "Apply now without building",
            rejectionReason: "The decisive gap has no evidence behind it.",
          },
        ],
      },
    }),
  );
  assert.equal(isPlanned(plan, "portfolio_suggestions"), false);
  const entry = plan.find((e) => e.artifactType === "portfolio_suggestions");
  assert.match(entry?.omissionReason ?? "", /No decisive technical gap/);
});

// --- outcome (DB §4.4, FR-091) -------------------------------------------

test("every unplanned entry is outcome `omitted`, keeping its reason", () => {
  // `FR-091`: "Failed artifacts are labelled as failed, distinct from omitted."
  // An entry planned out at Stage 8 was never attempted, so its outcome is
  // final the moment it is written.
  const plan = planArtifacts(
    recommendation({
      verdict: {
        decision: "apply_now",
        rationale: "x",
        decisiveGaps: [],
        criteriaApplied:
          "Evidenced capability against every must-have requirement.",
        alternatives: [
          { alternative: "The opposite verdict", rejectionReason: "x" },
        ],
      },
    }),
  );

  // D-75: the gap analysis is planned on every verdict; the rest are
  // planned out here, and each of those is final the moment it is written.
  for (const entry of plan) {
    if (entry.artifactType === "skill_gap_analysis") {
      assert.equal(entry.planned, true);
      continue;
    }
    assert.equal(entry.planned, false);
    assert.equal(entry.outcome, "omitted", entry.artifactType + " is omitted");
    assert.ok(
      entry.omissionReason !== undefined && entry.omissionReason.length > 0,
      "the reason survives alongside the outcome",
    );
    assert.equal(entry.inclusionReason, undefined);
  }
});

test("a planned entry carries no outcome until Stage 9 sets one", () => {
  // `DB §4.4`: "Written at Stage 8; `outcome` set at Stage 9-10." Stage 8 has
  // not run the generator, so it cannot know what became of the artifact.
  const plan = planArtifacts(recommendation());
  const entry = plan.find((e) => e.artifactType === "portfolio_suggestions");

  assert.equal(entry?.planned, true);
  assert.equal(entry?.outcome, undefined);
  assert.ok(entry?.inclusionReason);
});

test("withOutcome touches only the planned entry it names", () => {
  const plan = planArtifacts(recommendation());
  const after = withOutcome(plan, "portfolio_suggestions", "failed");

  assert.equal(
    after.find((e) => e.artifactType === "portfolio_suggestions")?.outcome,
    "failed",
  );
  for (const entry of after.filter((e) => !e.planned)) {
    assert.equal(entry.outcome, "omitted", "unplanned entries are untouched");
  }
  assert.equal(
    after.find((e) => e.artifactType === "skill_gap_analysis")?.outcome,
    undefined,
    "the other planned entry is untouched too (D-75)",
  );
  assert.notEqual(plan, after, "the Stage 8 plan is not mutated");
});
