/**
 * Unit — Stage 10 response validation and Stage 12 response assembly (D-72).
 *
 * Every test is a case where a defect would otherwise reach a reader: a
 * diagram with the wrong node count, a citation to nothing, an inference
 * without a basis, a plan entry with no outcome. And one where the advisory
 * class must NOT fail anything, because it is a heuristic.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  ArchitectureResult,
  ContextResult,
  PipelineResult,
  PortfolioSuggestions,
  RecommendationResult,
} from "../../src/nie/contracts.js";
import {
  AssemblyError,
  assembleResponse,
} from "../../src/nie/stages/response-assembly.js";
import {
  checkInternalConsistency,
  checkProvenanceIntegrity,
  checkRationaleCompleteness,
  checkReferenceIntegrity,
  checkUnsupportedClaims,
  validateReasoning,
} from "../../src/nie/stages/response-validation.js";

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "Invoices arrive by email",
      category: "environment",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 24,
      specificityScore: 0.9,
    },
    {
      content: "Approvals are informal",
      category: "constraint",
      provenance: "inferred",
      inferenceBasis: "no approver named",
      specificityScore: 0.5,
    },
    {
      content: "Volume per month",
      category: "environment",
      provenance: "unknown",
      resolutionHint: "state the monthly count",
      specificityScore: 0.2,
    },
  ],
} as ContextResult;

const architecture: ArchitectureResult = {
  summary: "Queue-backed ingestion",
  dataFlowDescription: "Mail → queue → writer",
  components: [
    {
      name: "Mail Receiver",
      responsibility: "Accept mail",
      inputs: "mail",
      outputs: "messages",
      failureHandling: "retry",
      ordinal: 0,
      groundedInContextIndices: [0],
    },
    {
      name: "Writer",
      responsibility: "Write rows",
      inputs: "messages",
      outputs: "rows",
      failureHandling: "dead-letter",
      ordinal: 1,
      groundedInContextIndices: [1],
    },
  ],
  tradeOffs: [{ choice: "a queue", accepted: "latency" }],
  rejectedApproaches: [
    { approach: "sync write", rejectionReason: "outage fails the sender" },
  ],
} as ArchitectureResult;

const recommendation: RecommendationResult = {
  requiredCapabilities: [
    {
      id: "req-1",
      name: "Zapier",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      groundedInContextIndices: [0],
    },
    {
      id: "req-2",
      name: "HubSpot",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      groundedInContextIndices: [1],
    },
  ],
  matched: [
    {
      requirementId: "req-1",
      capabilityId: "cap-1",
      strength: "partial",
      evidenceRef: "repo",
    },
  ],
  gaps: [
    {
      requirementId: "req-2",
      priority: "high",
      whyItMatters: "core",
      decisive: true,
    },
  ],
  verdict: {
    decision: "build_first",
    rationale: "one gap is decisive",
    criteriaApplied: "must-haves weigh most",
    decisiveGaps: ["req-2"],
    alternatives: [
      { alternative: "apply now", rejectionReason: "blank on req-2" },
    ],
  },
} as unknown as RecommendationResult;

const portfolio: PortfolioSuggestions = {
  consolidationRationale: "one",
  projects: [
    {
      rank: 1,
      name: "Lead sync",
      complexity: "intermediate",
      primaryGaps: ["req-2"],
      secondaryCapabilities: ["x"],
      whyThisProject: "w",
      businessProblem: "b",
      whatToBuild: "t",
      workflow: ["Trigger", "Sync"],
      platforms: ["HubSpot", "n8n", "Marketo"],
      technicalConcepts: ["webhooks"],
      evidenceToProduce: [{ type: "repo", whatItShows: "code" }],
      reusability: {
        provenance: "inferred",
        basis: "the posting names HubSpot",
        claim: "transfers",
      },
      estimatedEffort: "days",
      portfolioValue: "v",
      implementation: {
        platform: "n8n",
        steps: [
          {
            step: 1,
            node: "Webhook",
            purpose: "p",
            setup: ["s"],
            credential: null,
          },
          {
            step: 2,
            node: "HubSpot",
            purpose: "p",
            setup: ["s"],
            credential: "HubSpot OAuth2 API",
          },
        ],
        notes: [],
      },
    },
  ],
} as PortfolioSuggestions;

const ctx = {
  inputText: "We use Zapier and HubSpot. Invoices arrive by email.",
  context,
  architecture,
  recommendation,
  portfolio,
  knownPlatforms: ["n8n"],
};

test("D-72 — a consistent run passes every enforced class", () => {
  const findings = validateReasoning(ctx);
  for (const f of findings.filter((x) => !x.advisory))
    assert.ok(f.passed, f.detail ?? "");
});

test("D-72 — rationale completeness fails a finding without remediation and a verdict without an alternative", () => {
  const review = {
    summary: "s",
    dataFlowDescription: "d",
    structure: architecture.components,
    findings: [
      {
        componentIndex: 0,
        description: "bad",
        severity: 3,
        likelihood: 2,
        remediation: "",
      },
    ],
  };
  const f = checkRationaleCompleteness({
    ...ctx,
    workflowReview: review as never,
  });
  assert.equal(f.passed, false);
  assert.match(f.detail ?? "", /finding 0 has no remediation/);
  const g = checkRationaleCompleteness({
    ...ctx,
    recommendation: {
      ...recommendation,
      verdict: { ...recommendation.verdict, alternatives: [] },
    },
  });
  assert.match(g.detail ?? "", /no rejected alternative/);
});

test("D-72 — reference integrity fails a citation to a context element that does not exist, a gap outside the requirements, and an implementation step outside the workflow", () => {
  const badArch = {
    ...architecture,
    components: [
      { ...architecture.components[0]!, groundedInContextIndices: [7] },
    ],
  };
  assert.match(
    checkReferenceIntegrity({ ...ctx, architecture: badArch }).detail ?? "",
    /cites context element 7 of 3/,
  );
  const badRec = {
    ...recommendation,
    verdict: { ...recommendation.verdict, decisiveGaps: ["req-9"] },
  };
  assert.match(
    checkReferenceIntegrity({ ...ctx, recommendation: badRec }).detail ?? "",
    /decisive gap req-9/,
  );
  const badImpl = {
    ...portfolio,
    projects: [
      {
        ...portfolio.projects[0]!,
        implementation: {
          platform: "n8n",
          steps: [
            {
              step: 5,
              node: "Webhook",
              purpose: "p",
              setup: ["s"],
              credential: null,
            },
          ],
          notes: [],
        },
      },
    ],
  };
  assert.match(
    checkReferenceIntegrity({
      ...ctx,
      portfolio: badImpl as PortfolioSuggestions,
    }).detail ?? "",
    /step 5 points outside/,
  );
});

test("D-72 — provenance integrity fails an inference with no basis and a reusability claim that is not inferred", () => {
  const badContext = {
    ...context,
    elements: [{ ...context.elements[1]!, inferenceBasis: "" }],
  } as ContextResult;
  assert.match(
    checkProvenanceIntegrity({ ...ctx, context: badContext }).detail ?? "",
    /inferred without a basis/,
  );
  const badPortfolio = {
    ...portfolio,
    projects: [
      {
        ...portfolio.projects[0]!,
        reusability: { provenance: "stated", basis: "b", claim: "c" },
      },
    ],
  } as unknown as PortfolioSuggestions;
  assert.match(
    checkProvenanceIntegrity({ ...ctx, portfolio: badPortfolio }).detail ?? "",
    /can only be inferred/,
  );
});

test("D-72 — unsupported-claim detection is advisory: it names the platform and never fails anything", () => {
  const f = checkUnsupportedClaims(ctx);
  assert.equal(f.advisory, true);
  assert.equal(f.passed, false);
  assert.match(f.detail ?? "", /^advisory:/);
  assert.match(f.detail ?? "", /Marketo/);
  assert.ok(!(f.detail ?? "").includes("HubSpot"), "named in the input");
  assert.ok(!(f.detail ?? "").includes("n8n"), "an evidenced capability");
});

test("D-72 — internal consistency fails a diagram whose node count or names disagree with the architecture", () => {
  const good = {
    diagram: 'flowchart TD\n n0["Mail Receiver"] --> n1["Writer"]',
    node_count: 2,
  };
  assert.equal(
    checkInternalConsistency("mermaid_diagram", good, ctx).passed,
    true,
  );
  const bad = { diagram: 'flowchart TD\n n0["Mail Receiver"]', node_count: 1 };
  const f = checkInternalConsistency("mermaid_diagram", bad, ctx);
  assert.equal(f.passed, false);
  assert.match(f.detail ?? "", /node_count 1 ≠ 2/);
  assert.match(f.detail ?? "", /"Writer" is not in the diagram/);
});

test("D-72 — internal consistency checks the n8n scaffold against the implementation it renders", () => {
  const nodes = [
    { type: "n8n-nodes-base.stickyNote" },
    { type: "n8n-nodes-base.webhook" },
  ];
  assert.equal(
    checkInternalConsistency("n8n_workflow", { nodes }, ctx).passed,
    false,
  );
  nodes.push({ type: "n8n-nodes-base.hubspot" });
  assert.equal(
    checkInternalConsistency("n8n_workflow", { nodes }, ctx).passed,
    true,
  );
});

const base: PipelineResult = {
  classification: {
    determinedType: "job_description",
    confidence: 0.9,
    candidateTypes: [],
  } as never,
  intent: {
    primaryObjective: { content: "x", provenance: "stated" },
    secondaryObjectives: [],
    inferredScope: "s",
  },
  context,
  recommendation,
  artifactPlan: [
    {
      artifactType: "intent_brief",
      planned: true,
      depthLevel: "standard",
      inclusionReason: "r",
      outcome: "generated",
    },
    {
      artifactType: "skill_gap_analysis",
      planned: false,
      depthLevel: "standard",
      omissionReason: "no generator",
    },
    {
      artifactType: "portfolio_suggestions",
      planned: true,
      depthLevel: "standard",
      inclusionReason: "r",
      outcome: "failed",
    },
  ],
};

test("D-72 — assembly accepts a complete response and reports its counts", () => {
  const report = assembleResponse(base);
  assert.deepEqual(report, {
    planned: 2,
    generated: 1,
    failed: 1,
    omitted: 1,
    halted: false,
  });
});

test("D-72 — assembly refuses a planned artifact with no outcome, an omission with no reason, a duplicate plan entry, and a halt with no reason", () => {
  const noOutcome = {
    ...base,
    artifactPlan: [
      {
        artifactType: "intent_brief",
        planned: true,
        depthLevel: "standard",
        inclusionReason: "r",
      },
    ],
  } as PipelineResult;
  assert.throws(
    () => assembleResponse(noOutcome),
    (e: unknown) =>
      e instanceof AssemblyError &&
      e.problems.some((p) => p.includes("no outcome")),
  );
  const noReason = {
    ...base,
    artifactPlan: [
      {
        artifactType: "skill_gap_analysis",
        planned: false,
        depthLevel: "standard",
      },
    ],
  } as PipelineResult;
  assert.throws(() => assembleResponse(noReason), /omitted without a reason/);
  const dup = {
    ...base,
    artifactPlan: [...(base.artifactPlan ?? []), base.artifactPlan![0]!],
  } as PipelineResult;
  assert.throws(() => assembleResponse(dup), /planned twice/);
  const halt = {
    ...base,
    artifactPlan: [],
    haltedAt: { stageNumber: 3, reason: "" },
  } as PipelineResult;
  assert.throws(() => assembleResponse(halt), /halted without a stated reason/);
});

test("D-72 — assembly refuses an artifact that arrives without the reasoning it rests on", () => {
  const { recommendation: _drop, ...without } = base;
  const orphan = {
    ...without,
    artifactPlan: [
      {
        artifactType: "portfolio_suggestions",
        planned: true,
        depthLevel: "standard",
        inclusionReason: "r",
        outcome: "generated",
      },
    ],
  } as PipelineResult;
  assert.throws(
    () => assembleResponse(orphan),
    /without the recommendation it rests on/,
  );
});
