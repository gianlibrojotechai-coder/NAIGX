/**
 * Unit — the rendered executive summary (D-85, `FR-038`).
 *
 * Consistency with the detailed artifacts is the requirement's third
 * criterion, and rendering makes it true by construction. These pin the
 * projection, the absence of a section whose source did not generate, the
 * schema, and Stage 10's recomputation of every figure against its source.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  ArchitectureResult,
  ComplexityAssessment,
  ContextResult,
  ImplementationRoadmap,
  IntentResult,
  PlatformRecommendation,
  RiskRegister,
} from "../../src/nie/contracts.js";
import {
  complexityBand,
  renderExecutiveSummary,
} from "../../src/nie/stages/executive-summary.js";
import { validateArtifact } from "../../src/nie/artifact-validation.js";
import { checkInternalConsistency } from "../../src/nie/stages/response-validation.js";

const intent: IntentResult = {
  primaryObjective: {
    content: "Stop keying supplier invoices by hand",
    provenance: "stated",
  },
  secondaryObjectives: [],
  inferredScope: "Accounts payable, from receipt to approval",
};

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "Go-live before the quarter closes",
      category: "constraint",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 1,
      specificityScore: 0.5,
    },
    {
      content: "Number of approvers per department",
      category: "dependency",
      provenance: "unknown",
      resolutionHint: "Ask finance",
      specificityScore: 0.2,
    },
  ],
};

const architecture: ArchitectureResult = {
  summary: "Automated invoice capture with rule-based approval routing",
  dataFlowDescription: "Mailbox → capture → routing → approval",
  unknownDispositions: [],
  components: [
    {
      ordinal: 0,
      name: "Invoice Capture",
      responsibility: "r",
      inputs: "i",
      outputs: "o",
      failureHandling: "f",
      groundedInContextIndices: [0],
    },
    {
      ordinal: 1,
      name: "Approval Router",
      responsibility: "r",
      inputs: "i",
      outputs: "o",
      failureHandling: "f",
      groundedInContextIndices: [0],
    },
  ],
};

const platform: PlatformRecommendation = {
  criteriaApplied: [],
  recommendedPlatform: "Make",
  alsoRequired: [],
  rationale: "Native mailbox trigger and routing",
  alternativesRejected: [{ platform: "Zapier", rejectionReason: "cost" }],
  fit: [],
  knowledgeCurrencyNote: "verify",
};

const riskRegister: RiskRegister = {
  risks: [
    {
      component: "Invoice Capture",
      description: "Unparseable attachment",
      severity: 4,
      likelihood: 3,
      mitigation: "quarantine",
    },
    {
      component: "Approval Router",
      description: "No approver resolvable",
      severity: 3,
      likelihood: 3,
      mitigation: "escalate",
    },
    {
      component: "Invoice Capture",
      description: "Duplicate email",
      severity: 2,
      likelihood: 4,
      mitigation: "dedupe",
    },
    {
      component: "Approval Router",
      description: "Late approval",
      severity: 2,
      likelihood: 2,
      mitigation: "remind",
    },
  ],
};

const complexity: ComplexityAssessment = {
  scaleVersion: "complexity-v1",
  factors: [],
  weightedScore: 3.5,
  complexityScore: 70,
};

const roadmap: ImplementationRoadmap = {
  phases: [
    {
      ordinal: 1,
      name: "Capture",
      objective: "o",
      components: ["Invoice Capture"],
      dependsOn: [],
      outcome: "Invoices become records",
    },
    {
      ordinal: 2,
      name: "Route",
      objective: "o",
      components: ["Approval Router"],
      dependsOn: [1],
      outcome: "Invoices reach approvers",
    },
  ],
  sequencingRationale: "capture first",
};

const full = () =>
  renderExecutiveSummary({
    intent,
    context,
    architecture,
    platform,
    riskRegister,
    complexity,
    roadmap,
    notSummarised: [],
  });

test("every section is a projection of its source, and the document validates", () => {
  const doc = full();
  validateArtifact("executive_summary", doc);
  assert.equal(doc["standing"], "summary_of_detailed_artifacts");
  assert.equal(doc["headline"], "Stop keying supplier invoices by hand");
  assert.deepEqual((doc["approach"] as Record<string, unknown>)["components"], [
    "Invoice Capture",
    "Approval Router",
  ]);
  assert.deepEqual(
    (doc["problem"] as Record<string, unknown>)["key_constraints"],
    ["Go-live before the quarter closes"],
  );
  assert.equal(
    (doc["problem"] as Record<string, unknown>)["open_questions"],
    1,
  );
  assert.deepEqual(doc["platform"], {
    recommended: "Make",
    rationale: "Native mailbox trigger and routing",
  });
  // The register is already ordered by score; the summary takes its first three.
  assert.deepEqual(
    (doc["principal_risks"] as { description: string }[]).map(
      (r) => r.description,
    ),
    ["Unparseable attachment", "No approver resolvable", "Duplicate email"],
  );
  assert.deepEqual(doc["complexity"], { score: 70, band: "high" });
  assert.equal((doc["phases"] as unknown[]).length, 2);
  assert.deepEqual(doc["not_summarised"], []);
});

test("a section whose source did not generate is absent, and named as not summarised", () => {
  const doc = renderExecutiveSummary({
    intent,
    context,
    architecture,
    notSummarised: ["risk register", "complexity score"],
  });
  validateArtifact("executive_summary", doc);
  assert.equal("principal_risks" in doc, false);
  assert.equal("complexity" in doc, false);
  assert.equal("platform" in doc, false);
  assert.deepEqual(doc["not_summarised"], [
    "risk register",
    "complexity score",
  ]);
});

test("the bands match the presenter's", () => {
  assert.equal(complexityBand(20), "low");
  assert.equal(complexityBand(40), "moderate");
  assert.equal(complexityBand(60), "high");
  assert.equal(complexityBand(80), "severe");
});

test("Stage 10 recomputes every figure against its source (FR-038: contradiction is a defect)", () => {
  const ctx = {
    inputText: "",
    intent,
    context,
    architecture,
    platformRecommendation: platform,
    riskRegister,
    complexityAssessment: complexity,
    implementationRoadmap: roadmap,
  };
  const ok = checkInternalConsistency("executive_summary", full(), ctx);
  assert.equal(ok.passed, true, ok.detail ?? "");

  const tampered = {
    ...full(),
    complexity: { score: 85, band: "severe" },
    platform: { recommended: "Zapier", rationale: "x" },
  };
  const bad = checkInternalConsistency("executive_summary", tampered, ctx);
  assert.equal(bad.passed, false);
  assert.match(bad.detail ?? "", /85/);
  assert.match(bad.detail ?? "", /Zapier/);

  // A summary of a register that did not generate is a contradiction too.
  const { riskRegister: _omitted, ...withoutRegister } = ctx;
  const orphan = checkInternalConsistency(
    "executive_summary",
    full(),
    withoutRegister,
  );
  assert.equal(orphan.passed, false);
  assert.match(orphan.detail ?? "", /risk/);
});
