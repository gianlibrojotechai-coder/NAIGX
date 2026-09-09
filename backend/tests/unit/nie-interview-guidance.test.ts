/**
 * Unit — the interview guidance parser (D-76).
 *
 * What the published schema cannot check is checked here: every competency
 * is derived from a requirement Stage 7 extracted, cites only capabilities
 * Stage 7 matched, states a standing that agrees with its citations, and the
 * ranks are a total order from 1.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  StageError,
  type RecommendationForArtifacts,
} from "../../src/nie/contracts.js";
import {
  InterviewGroundingError,
  parseInterviewGuidance,
} from "../../src/nie/stages/interview-guidance.js";
import { validateArtifact } from "../../src/nie/artifact-validation.js";
import { checkInternalConsistency } from "../../src/nie/stages/response-validation.js";

const recommendation: RecommendationForArtifacts = {
  requiredCapabilities: [
    {
      id: "req-1",
      name: "Build n8n workflows against a CRM",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
    },
    {
      id: "req-2",
      name: "Ship an LLM-backed triage step",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
    },
  ],
  matched: [
    {
      requirementId: "req-1",
      capabilityId: "cap-n8n-crm",
      strength: "strong",
      evidenceRef: "https://github.com/example/crm-sync",
    },
  ],
  gaps: [
    {
      requirementId: "req-2",
      priority: "high",
      whyItMatters: "It is the core of the role.",
    },
  ],
  verdict: {
    decision: "build_first",
    rationale: "One decisive technical gap.",
    decisiveGaps: ["req-2"],
    criteriaApplied: "Must-have technical requirements first.",
    alternatives: [
      { alternative: "apply now", rejectionReason: "req-2 is unevidenced" },
    ],
  },
};

const competency = (overrides: Record<string, unknown> = {}) => ({
  rank: 1,
  name: "Designing idempotent CRM synchronisation",
  derived_from: ["req-1"],
  why_the_posting_implies_it:
    "The posting names HubSpot and a nightly sync of 40k contacts.",
  be_ready_to_explain: [
    "How you key on the CRM record id so a retried run cannot duplicate.",
    "What happens when the CRM rate-limits mid-run.",
  ],
  likely_question:
    "A sync fails halfway through 40k contacts — what state is the CRM in?",
  evidence_to_cite: ["cap-n8n-crm"],
  standing: "evidenced",
  how_to_handle_the_gap: null,
  ...overrides,
});

const gapCompetency = (overrides: Record<string, unknown> = {}) =>
  competency({
    rank: 2,
    name: "Placing an LLM step where its failure is contained",
    derived_from: ["req-2"],
    why_the_posting_implies_it:
      "The posting wants an LLM to triage inbound tickets before routing.",
    be_ready_to_explain: ["Where a wrong classification goes and who sees it."],
    likely_question: "What does the workflow do when the model is unsure?",
    evidence_to_cite: [],
    standing: "gap",
    how_to_handle_the_gap:
      "Say the build is in progress and describe the containment design; do not claim a shipped example.",
    ...overrides,
  });

const wire = (
  competencies: unknown[],
  framing = "This posting is testing for operational judgement around a CRM, not for tool familiarity.",
) => JSON.stringify({ competencies, framing });

test("a grounded document parses, validates, and is ordered by rank", () => {
  const text = wire([gapCompetency(), competency()]);
  validateArtifact("interview_guidance", JSON.parse(text) as unknown);
  const guidance = parseInterviewGuidance(text, recommendation);

  assert.equal(guidance.competencies.length, 2);
  assert.equal(guidance.competencies[0]?.rank, 1);
  assert.equal(guidance.competencies[0]?.standing, "evidenced");
  assert.deepEqual(guidance.competencies[0]?.evidenceToCite, ["cap-n8n-crm"]);
  assert.equal(guidance.competencies[0]?.howToHandleTheGap, undefined);
  assert.equal(guidance.competencies[1]?.standing, "gap");
  assert.match(
    guidance.competencies[1]?.howToHandleTheGap ?? "",
    /in progress/,
  );
  assert.match(guidance.framing, /operational judgement/);
});

test("a competency derived from a requirement Stage 7 did not extract is refused (not derived from the posting)", () => {
  assert.throws(
    () =>
      parseInterviewGuidance(
        wire([competency({ derived_from: ["req-9"] })]),
        recommendation,
      ),
    (error: unknown) =>
      error instanceof InterviewGroundingError && /req-9/.test(error.message),
  );
});

test("citing a capability Stage 7 did not match is refused (unsupported claim)", () => {
  assert.throws(
    () =>
      parseInterviewGuidance(
        wire([competency({ evidence_to_cite: ["cap-unknown"] })]),
        recommendation,
      ),
    (error: unknown) =>
      error instanceof InterviewGroundingError &&
      /cap-unknown/.test(error.message),
  );
});

test("standing must agree with the citations, and a gap must say how to handle it", () => {
  assert.throws(
    () =>
      parseInterviewGuidance(
        wire([competency({ standing: "gap" })]),
        recommendation,
      ),
    /standing is gap but evidence_to_cite is not empty/,
  );
  assert.throws(
    () =>
      parseInterviewGuidance(
        wire([competency({ evidence_to_cite: [], standing: "evidenced" })]),
        recommendation,
      ),
    /standing is evidenced but evidence_to_cite is empty/,
  );
  assert.throws(
    () =>
      parseInterviewGuidance(
        wire([gapCompetency({ how_to_handle_the_gap: null })]),
        recommendation,
      ),
    /a gap must say how to handle it/,
  );
});

test("rank is a total order from 1 with no ties", () => {
  assert.throws(
    () =>
      parseInterviewGuidance(
        wire([competency({ rank: 1 }), gapCompetency({ rank: 1 })]),
        recommendation,
      ),
    (error: unknown) =>
      error instanceof StageError && /total order/.test(error.message),
  );
  assert.throws(
    () =>
      parseInterviewGuidance(wire([competency({ rank: 2 })]), recommendation),
    /total order/,
  );
});

test("an empty competency list is refused", () => {
  assert.throws(
    () => parseInterviewGuidance(wire([]), recommendation),
    /competencies is empty/,
  );
});

test("Stage 10 re-checks the grounding against the recommendation", () => {
  const good = JSON.parse(wire([competency(), gapCompetency()])) as unknown;
  const passed = checkInternalConsistency("interview_guidance", good, {
    inputText: "",
    recommendation: {
      ...recommendation,
      requiredCapabilities: recommendation.requiredCapabilities.map((r) => ({
        ...r,
        groundedInContextIndices: [0],
      })),
    },
  });
  assert.equal(passed.passed, true, passed.detail ?? "");

  const bad = JSON.parse(
    wire([
      competency({ derived_from: ["req-7"], evidence_to_cite: ["cap-x"] }),
    ]),
  ) as unknown;
  const finding = checkInternalConsistency("interview_guidance", bad, {
    inputText: "",
    recommendation: {
      ...recommendation,
      requiredCapabilities: recommendation.requiredCapabilities.map((r) => ({
        ...r,
        groundedInContextIndices: [0],
      })),
    },
  });
  assert.equal(finding.passed, false);
  assert.match(finding.detail ?? "", /req-7/);
  assert.match(finding.detail ?? "", /cap-x/);
});
