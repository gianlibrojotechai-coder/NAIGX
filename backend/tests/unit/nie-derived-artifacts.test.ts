/**
 * Unit — the Stage 9 generators that make no provider call (`docs/15` D-40).
 *
 * Four artifacts on the workflow and assessment paths restate reasoning the
 * pipeline already did. Rendering them rather than asking a model to restate
 * them buys one property worth testing for: **the artifact cannot disagree
 * with the reasoning it came from.** Most of these tests assert exactly that —
 * a value in the artifact is the value in the reasoning result, not a
 * plausible-looking one.
 *
 * They also validate against the published schemas, because `FR-039` asks that
 * of a rendered artifact exactly as it does a generated one; a rendering bug
 * should surface as a schema failure and not as a malformed document nobody
 * checked.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  ArchitectureResult,
  WorkflowReviewResult,
} from "../../src/nie/contracts.js";
import { validateArtifact } from "../../src/nie/artifact-validation.js";
import {
  planDerivedArtifacts,
  planIntentBrief,
  renderIntentBrief,
  renderArchitectureRecommendation,
  renderAssessmentFeedback,
  renderMermaidDiagram,
  renderRiskAssessment,
  renderWorkflowRecommendation,
} from "../../src/nie/stages/derived-artifacts.js";

const review: WorkflowReviewResult = {
  summary: "A two-step Zapier workflow moving form responses into a sheet",
  dataFlowDescription: "Google Form → Zapier → Google Sheet",
  structure: [
    {
      name: "Form Watcher",
      responsibility: "Detect new Google Form submissions",
      inputs: "Google Form submission events",
      outputs: "Submission payload",
      failureHandling: "The submitted workflow does not state what happens",
      ordinal: 0,
      groundedInContextIndices: [0],
    },
    {
      name: "Sheet Appender",
      responsibility: "Append the submission as a row",
      inputs: "Submission payload",
      outputs: "A new sheet row",
      failureHandling: "Zapier retries the task three times, then stops",
      ordinal: 1,
      groundedInContextIndices: [1],
      externalSystem: "Google Sheets",
      integrationDirection: "outbound",
    },
  ],
  findings: [
    {
      componentIndex: 1,
      description: "A paused zap drops submissions with no record",
      severity: 4,
      likelihood: 2,
      remediation:
        "Reconcile form response count against sheet row count daily",
    },
  ],
  optimisations: ["Batch appends to stay under the Sheets write quota"],
};

const architecture: ArchitectureResult = {
  unknownDispositions: [],
  summary: "A queue-backed ingestion path with an idempotent writer",
  dataFlowDescription: "Webhook → queue → writer → warehouse",
  components: [
    {
      name: "Webhook Receiver",
      responsibility: "Accept and acknowledge inbound events",
      inputs: "HTTP POST bodies",
      outputs: "Queued messages",
      failureHandling: "Return 503 so the sender retries",
      ordinal: 0,
      groundedInContextIndices: [0],
    },
    {
      name: "Warehouse Writer",
      responsibility: 'Write the "normalised" event exactly once',
      inputs: "Queued messages",
      outputs: "Warehouse rows",
      failureHandling: "Dead-letter after five attempts",
      ordinal: 1,
      groundedInContextIndices: [1],
      externalSystem: "BigQuery",
      integrationDirection: "outbound",
    },
  ],
  tradeOffs: [
    {
      choice: "A queue between receipt and write",
      accepted: "End-to-end latency rises from milliseconds to seconds",
    },
  ],
  rejectedApproaches: [
    {
      approach: "Write to the warehouse synchronously in the request handler",
      rejectionReason:
        "A warehouse outage would then fail the sender's request, and the sender cannot retry indefinitely",
    },
  ],
};

// --- planning ------------------------------------------------------------

test("the workflow path plans its whole AI §9.1 set", () => {
  const plan = planDerivedArtifacts("existing_workflow", "because");

  assert.deepEqual(
    plan.map((entry) => entry.artifactType),
    ["workflow_recommendation", "risk_assessment"],
  );
  assert.ok(plan.every((entry) => entry.planned));
  assert.equal(plan[0]?.inclusionReason, "because");
});

test("the assessment path plans its whole AI §9.1 set", () => {
  const plan = planDerivedArtifacts("technical_assessment", "because");

  assert.deepEqual(
    plan.map((entry) => entry.artifactType),
    ["assessment_feedback", "mermaid_diagram"],
  );
  assert.ok(plan.every((entry) => entry.planned));
});

test("the requirement path plans its five artifacts in precedence order (D-73, D-77, D-78, D-79)", () => {
  // The rest of its `AI §9.1` set is reasoning work and is not declared, so
  // the plan carries no omission rows for it — nothing was deliberated over.
  const plan = planDerivedArtifacts("business_requirement", "because");

  assert.deepEqual(
    plan.map((entry) => entry.artifactType),
    [
      "business_analysis",
      "architecture_recommendation",
      "platform_recommendation",
      "risk_assessment",
      "mermaid_diagram",
    ],
  );
  assert.ok(plan.every((entry) => entry.planned));
});

test("an unsupported input plans nothing to generate", () => {
  assert.deepEqual(planDerivedArtifacts("unsupported", "because"), []);
});

// --- Architecture Recommendation (D-73) ----------------------------------

test("the architecture recommendation carries every component with inputs and outputs", () => {
  const content = renderArchitectureRecommendation(architecture);
  validateArtifact("architecture_recommendation", content);

  assert.equal(content["standing"], "recommendation");
  const components = content["components"] as Record<string, unknown>[];
  assert.equal(components.length, architecture.components.length);
  architecture.components.forEach((component, index) => {
    assert.equal(components[index]?.["name"], component.name);
    assert.equal(components[index]?.["inputs"], component.inputs);
    assert.equal(components[index]?.["outputs"], component.outputs);
    assert.equal(components[index]?.["ordinal"], component.ordinal);
  });
});

test("the architecture recommendation states absent trade-offs as empty, not invented", () => {
  const {
    tradeOffs: _t,
    rejectedApproaches: _r,
    ...requirementOnly
  } = architecture;
  const content = renderArchitectureRecommendation(requirementOnly);
  validateArtifact("architecture_recommendation", content);

  assert.deepEqual(content["trade_offs"], []);
  assert.deepEqual(content["rejected_approaches"], []);
});

// --- Workflow Recommendation ---------------------------------------------

test("the workflow recommendation restates the review it came from", () => {
  const content = renderWorkflowRecommendation(review);
  validateArtifact("workflow_recommendation", content);

  const structure = content["current_structure"] as Record<string, unknown>;
  assert.equal(structure["summary"], review.summary);
  assert.equal((structure["steps"] as unknown[]).length, 2);

  const findings = content["findings"] as Record<string, unknown>[];
  // The finding names the step by name, resolved from the index — a reader of
  // the artifact never has to count positions to know what it means.
  assert.equal(findings[0]?.["step"], "Sheet Appender");
  assert.equal(findings[0]?.["severity"], 4);
});

test("a sound workflow's recommendation carries the soundness statement", () => {
  const content = renderWorkflowRecommendation({
    ...review,
    findings: [],
    soundnessStatement: "Both steps handle their own failures",
  });
  validateArtifact("workflow_recommendation", content);

  assert.deepEqual(content["findings"], []);
  assert.equal(
    content["soundness_statement"],
    "Both steps handle their own failures",
  );
});

// --- Risk Assessment -----------------------------------------------------

test("every risk names a component and carries a mitigation", () => {
  const content = renderRiskAssessment(review);
  validateArtifact("risk_assessment", content);

  const risks = content["risks"] as Record<string, unknown>[];
  assert.equal(risks.length, 1);
  assert.equal(risks[0]?.["component"], "Sheet Appender");
  assert.equal(risks[0]?.["likelihood"], 2);
  assert.match(String(risks[0]?.["mitigation"]), /Reconcile/);
});

test("an empty risk register says so rather than being silently empty", () => {
  const content = renderRiskAssessment({
    ...review,
    findings: [],
    soundnessStatement: "No material issues found",
  });
  validateArtifact("risk_assessment", content);

  assert.deepEqual(content["risks"], []);
  assert.equal(content["no_risks_statement"], "No material issues found");
});

// --- Assessment Feedback -------------------------------------------------

test("assessment feedback carries the trade-offs and rejected approaches", () => {
  const content = renderAssessmentFeedback(architecture);
  validateArtifact("assessment_feedback", content);

  const tradeOffs = content["trade_offs"] as Record<string, unknown>[];
  assert.equal(tradeOffs[0]?.["choice"], "A queue between receipt and write");

  const rejected = content["rejected_approaches"] as Record<string, unknown>[];
  assert.equal(rejected.length, 1, "FR-023 requires at least one");
  assert.match(String(rejected[0]?.["rejection_reason"]), /warehouse outage/);
});

// --- Mermaid Diagram -----------------------------------------------------

test("diagram nodes match the architecture components, one for one", () => {
  const content = renderMermaidDiagram(architecture);
  validateArtifact("mermaid_diagram", content);

  const diagram = String(content["diagram"]);
  assert.equal(content["node_count"], architecture.components.length);
  assert.match(diagram, /^flowchart TD/);
  for (const component of architecture.components) {
    assert.ok(
      diagram.includes(component.name),
      `${component.name} is missing from the diagram`,
    );
  }
  // An external system becomes its own node with the declared direction.
  assert.match(diagram, /n1 --> ext1/);
});

test("a quoted component name does not break the node label", () => {
  const diagram = String(renderMermaidDiagram(architecture)["diagram"]);
  // Mermaid node labels are double-quoted; a name containing one would end the
  // label early and produce an unparseable diagram.
  for (const line of diagram.split("\n").slice(1)) {
    assert.equal(
      (line.match(/"/g) ?? []).length % 2,
      0,
      `unbalanced quotes: ${line}`,
    );
  }
});

test("rendering is deterministic — the same reasoning renders identically", () => {
  // This is the whole reason these four make no provider call. A renderer given
  // the same input produces the same output, so there is nothing to regenerate.
  assert.deepEqual(
    renderWorkflowRecommendation(review),
    renderWorkflowRecommendation(review),
  );
  assert.deepEqual(
    renderMermaidDiagram(architecture),
    renderMermaidDiagram(architecture),
  );
});

// --- D-66: the intent brief ------------------------------------------------

test("intent brief: a projection of the intent record that validates against its published schema", () => {
  const brief = renderIntentBrief({
    primaryObjective: {
      content: "Stop keying supplier invoices by hand",
      provenance: "stated",
    },
    secondaryObjectives: [
      {
        content: "Recover early-payment discounts",
        provenance: "inferred",
      },
    ],
    inferredScope: "Accounts payable, from receipt to approval",
  });

  // Validates as an artifact (FR-039) — a rendering bug is a schema failure.
  validateArtifact("intent_brief", brief);

  // Every field is the intent record's own value with its own provenance.
  assert.deepEqual(brief["objective"], {
    content: "Stop keying supplier invoices by hand",
    provenance: "stated",
  });
  assert.deepEqual(brief["secondary_objectives"], [
    { content: "Recover early-payment discounts", provenance: "inferred" },
  ]);
  assert.equal(
    brief["inferred_scope"],
    "Accounts payable, from receipt to approval",
  );
  // The document says what it is, in storage as on screen.
  assert.equal(brief["standing"], "understanding_only");
});

test("intent brief: an input with one aim renders with no secondary objectives, and still validates", () => {
  const brief = renderIntentBrief({
    primaryObjective: { content: "One aim", provenance: "inferred" },
    secondaryObjectives: [],
    inferredScope: "One team",
  });
  validateArtifact("intent_brief", brief);
  assert.deepEqual(brief["secondary_objectives"], []);
});

test("intent brief: the schema refuses a document that claims a different standing", () => {
  const brief = {
    ...renderIntentBrief({
      primaryObjective: { content: "x", provenance: "stated" },
      secondaryObjectives: [],
      inferredScope: "y",
    }),
    standing: "conclusion",
  };
  assert.throws(() => validateArtifact("intent_brief", brief), /standing/);
});

test("intent brief: planned once, with a reason, and not by the path planners", () => {
  const plan = planIntentBrief();
  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.artifactType, "intent_brief");
  assert.equal(plan[0]?.planned, true);
  assert.ok((plan[0]?.inclusionReason ?? "").length > 0);
  // The path planners must not plan it again at Stage 8.
  for (const path of [
    "existing_workflow",
    "technical_assessment",
    "job_description",
    "business_requirement",
  ] as const) {
    assert.ok(
      !planDerivedArtifacts(path, "r").some(
        (e) => e.artifactType === "intent_brief",
      ),
      path,
    );
  }
});

// --- D-70: the published portfolio schema and the implementation block -------

test("D-70 — the published schema accepts a project with the block, with null, and refuses a malformed one", () => {
  const base = {
    rank: 1,
    name: "Lead intake",
    complexity: "intermediate",
    primary_gaps: ["req-1", "req-2"],
    secondary_capabilities: ["logging"],
    why_this_project: "why",
    business_problem: "problem",
    what_to_build: "build",
    workflow: ["Trigger: form", "Sync: CRM"],
    platforms: ["n8n"],
    technical_concepts: ["webhooks"],
    evidence_to_produce: [{ type: "repo", what_it_shows: "the export" }],
    reusability: { provenance: "inferred", basis: "b", claim: "c" },
    estimated_effort: "days",
    portfolio_value: "value",
  };
  const doc = (project: Record<string, unknown>) => ({
    projects: [project],
    consolidation_rationale: "one",
  });
  const block = {
    platform: "n8n",
    steps: [
      {
        step: 1,
        node: "Webhook",
        purpose: "p",
        setup: ["POST"],
        credential: null,
      },
    ],
    notes: [],
  };
  validateArtifact(
    "portfolio_suggestions",
    doc({ ...base, implementation: block }),
  );
  validateArtifact(
    "portfolio_suggestions",
    doc({ ...base, implementation: null }),
  );
  validateArtifact("portfolio_suggestions", doc(base));
  assert.throws(() =>
    validateArtifact(
      "portfolio_suggestions",
      doc({
        ...base,
        implementation: { platform: "n8n", steps: [], notes: [] },
      }),
    ),
  );
  assert.throws(() =>
    validateArtifact(
      "portfolio_suggestions",
      doc({
        ...base,
        implementation: {
          ...block,
          steps: [
            {
              step: 1,
              node: "Webhook",
              purpose: "p",
              setup: [],
              credential: null,
            },
          ],
        },
      }),
    ),
  );
});
