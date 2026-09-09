/**
 * Unit — the skill gap analysis is a projection of the recommendation (D-75).
 *
 * Rendered, not generated: every field must be the recommendation's own
 * value, the priorities must be the gaps in the order to close them, and an
 * analysis with no gaps must say so rather than vanish.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { validateArtifact } from "../../src/nie/artifact-validation.js";
import type { RecommendationResult } from "../../src/nie/contracts.js";
import { renderSkillGapAnalysis } from "../../src/nie/stages/derived-artifacts.js";
import { checkInternalConsistency } from "../../src/nie/stages/response-validation.js";
import { renderArtifactDocument } from "../../src/export/artifact-markdown.js";

const recommendation: RecommendationResult = {
  requiredCapabilities: [
    {
      id: "req-1",
      name: "Build n8n workflows against a CRM",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      groundedInContextIndices: [0],
    },
    {
      id: "req-2",
      name: "Ship an LLM-backed triage step",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      groundedInContextIndices: [1],
    },
    {
      id: "req-3",
      name: "Recruitment-agency domain experience",
      necessity: "nice_to_have",
      provenance: "inferred",
      kind: "domain_experience",
      groundedInContextIndices: [2],
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
    {
      requirementId: "req-3",
      priority: "low",
      whyItMatters: "Helps, not required.",
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

test("every requirement is carried with its necessity, evidence or gap, and validates", () => {
  const content = renderSkillGapAnalysis(recommendation);
  validateArtifact("skill_gap_analysis", content);

  assert.equal(content["standing"], "gap_analysis");
  assert.equal(content["decision"], "build_first");
  const reqs = content["requirements"] as Record<string, unknown>[];
  assert.equal(reqs.length, 3);
  assert.equal(reqs[0]?.["status"], "evidenced");
  assert.deepEqual(reqs[0]?.["evidence"], [
    {
      capability_id: "cap-n8n-crm",
      strength: "strong",
      evidence_ref: "https://github.com/example/crm-sync",
    },
  ]);
  assert.equal(reqs[0]?.["gap"], null);
  assert.deepEqual(reqs[1]?.["gap"], {
    priority: "high",
    why_it_matters: "It is the core of the role.",
    decisive: true,
    buildable: true,
  });
  assert.deepEqual(reqs[2]?.["gap"], {
    priority: "low",
    why_it_matters: "Helps, not required.",
    decisive: false,
    buildable: false,
  });
  assert.deepEqual(content["summary"], {
    requirements: 3,
    must_have: 2,
    nice_to_have: 1,
    evidenced: 1,
    gaps: 2,
    decisive_gaps: 1,
  });
});

test("the priorities are the gaps in the order to close them: decisive, then priority, then necessity", () => {
  const withMore: RecommendationResult = {
    ...recommendation,
    requiredCapabilities: [
      ...recommendation.requiredCapabilities,
      {
        id: "req-4",
        name: "Nice high",
        necessity: "nice_to_have",
        provenance: "inferred",
        kind: "technical",
        groundedInContextIndices: [0],
      },
      {
        id: "req-5",
        name: "Must high",
        necessity: "must_have",
        provenance: "stated",
        kind: "technical",
        groundedInContextIndices: [0],
      },
    ],
    gaps: [
      ...recommendation.gaps,
      { requirementId: "req-4", priority: "high", whyItMatters: "x" },
      { requirementId: "req-5", priority: "high", whyItMatters: "y" },
    ],
  };
  const content = renderSkillGapAnalysis(withMore);
  validateArtifact("skill_gap_analysis", content);
  const order = (content["priorities"] as { requirement_id: string }[]).map(
    (p) => p.requirement_id,
  );
  assert.deepEqual(order, ["req-2", "req-5", "req-4", "req-3"]);
});

test("an apply_now recommendation with no gaps renders an empty priorities list, not nothing", () => {
  const clean: RecommendationResult = {
    ...recommendation,
    matched: [
      ...recommendation.matched,
      {
        requirementId: "req-2",
        capabilityId: "cap-llm",
        strength: "partial",
        evidenceRef: "https://example.test/llm",
      },
      {
        requirementId: "req-3",
        capabilityId: "cap-agency",
        strength: "strong",
        evidenceRef: "https://example.test/agency",
      },
    ],
    gaps: [],
    verdict: {
      ...recommendation.verdict,
      decision: "apply_now",
      decisiveGaps: [],
    },
  };
  const content = renderSkillGapAnalysis(clean);
  validateArtifact("skill_gap_analysis", content);
  assert.deepEqual(content["priorities"], []);
  assert.equal((content["summary"] as { gaps: number }).gaps, 0);

  const text = renderArtifactDocument("skill_gap_analysis", content).lines.join(
    "\n",
  );
  assert.match(text, /No gaps\. Every requirement is evidenced/);
});

test("Stage 10 fails a gap analysis that disagrees with its recommendation", () => {
  const content = renderSkillGapAnalysis(recommendation);
  const consistent = checkInternalConsistency("skill_gap_analysis", content, {
    inputText: "",
    recommendation,
  });
  assert.equal(consistent.passed, true, consistent.detail ?? "");

  const tampered = {
    ...content,
    requirements: (content["requirements"] as Record<string, unknown>[]).slice(
      0,
      2,
    ),
  };
  const finding = checkInternalConsistency("skill_gap_analysis", tampered, {
    inputText: "",
    recommendation,
  });
  assert.equal(finding.passed, false);
  assert.match(finding.detail ?? "", /2 requirements rendered, 3 reasoned/);
});

test("the export leads with the priorities and lists every requirement", () => {
  const content = renderSkillGapAnalysis(recommendation);
  const render = renderArtifactDocument("skill_gap_analysis", content);
  assert.ok(render.rendered);
  const text = render.lines.join("\n");
  const first = text.indexOf("Close these first");
  const every = text.indexOf("Every requirement");
  assert.ok(first >= 0 && every > first);
  assert.match(
    text,
    /\| 1 \| Ship an LLM-backed triage step \| must have \| high \| yes \| yes \|/,
  );
  assert.match(
    text,
    /\*\*Build n8n workflows against a CRM\*\* — must have, technical, stated\. \*\*Evidenced\.\*\*/,
  );
  assert.match(
    text,
    /strong match, `cap-n8n-crm` — https:\/\/github\.com\/example\/crm-sync/,
  );
});
