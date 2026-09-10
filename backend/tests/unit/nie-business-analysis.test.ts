/**
 * Unit — the business analysis is a projection of Stages 2 and 3 (D-77).
 *
 * Every objective, constraint and fact must be the intent record's or the
 * context set's own value with its own provenance; unknowns travel with their
 * resolution hints; the standing says it is a problem statement; and Stage 10
 * fails a rendering that disagrees with its sources.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { validateArtifact } from "../../src/nie/artifact-validation.js";
import type { ContextResult, IntentResult } from "../../src/nie/contracts.js";
import { renderBusinessAnalysis } from "../../src/nie/stages/derived-artifacts.js";
import { checkInternalConsistency } from "../../src/nie/stages/response-validation.js";
import { renderArtifactDocument } from "../../src/export/artifact-markdown.js";

const intent: IntentResult = {
  primaryObjective: {
    content: "Stop keying supplier invoices by hand",
    provenance: "stated",
  },
  secondaryObjectives: [
    { content: "Recover early-payment discounts", provenance: "inferred" },
  ],
  inferredScope: "Accounts payable, from receipt to approval",
  requestedOutcome: "design",
};

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "Xero must remain the system of record",
      category: "constraint",
      provenance: "stated",
      sourceSpanStart: 10,
      sourceSpanEnd: 48,
      specificityScore: 0.9,
    },
    {
      content: "400-500 invoices per month",
      category: "scale",
      provenance: "stated",
      sourceSpanStart: 60,
      sourceSpanEnd: 86,
      specificityScore: 0.95,
    },
    {
      content: "Approvers are reachable by email",
      category: "environment",
      provenance: "inferred",
      inferenceBasis: "Approvals are described as email replies",
      specificityScore: 0.5,
    },
    {
      content: "Which Xero edition is in use",
      category: "system",
      provenance: "unknown",
      resolutionHint: "Ask finance which Xero plan they are on",
      specificityScore: 0.2,
    },
  ],
};

test("the analysis carries the objective, scope, constraints, environment and unknowns with provenance, and validates", () => {
  const content = renderBusinessAnalysis(intent, context);
  validateArtifact("business_analysis", content);

  assert.equal(content["standing"], "problem_statement");
  assert.deepEqual(content["objective"], {
    content: "Stop keying supplier invoices by hand",
    provenance: "stated",
  });
  assert.equal(content["scope"], "Accounts payable, from receipt to approval");
  assert.deepEqual(content["constraints"], [
    {
      content: "Xero must remain the system of record",
      category: "constraint",
      provenance: "stated",
    },
  ]);
  const environment = content["environment"] as Record<string, unknown>[];
  assert.equal(environment.length, 2);
  assert.equal(
    environment[1]?.["inference_basis"],
    "Approvals are described as email replies",
  );
  assert.deepEqual(content["unknowns"], [
    {
      content: "Which Xero edition is in use",
      category: "system",
      resolution_hint: "Ask finance which Xero plan they are on",
    },
  ]);
  assert.deepEqual(content["counts"], {
    elements: 4,
    stated: 2,
    inferred: 1,
    unknown: 1,
  });
});

test("Stage 10 fails an analysis that disagrees with its sources", () => {
  const content = renderBusinessAnalysis(intent, context);
  const ok = checkInternalConsistency("business_analysis", content, {
    inputText: "",
    intent,
    context,
  });
  assert.equal(ok.passed, true, ok.detail ?? "");

  const tampered = { ...content, unknowns: [] };
  const finding = checkInternalConsistency("business_analysis", tampered, {
    inputText: "",
    intent,
    context,
  });
  assert.equal(finding.passed, false);
  assert.match(finding.detail ?? "", /0 unknowns rendered, 1 extracted/);
});

test("the export states the standing first and lists the unknowns with their hints", () => {
  const content = renderBusinessAnalysis(intent, context);
  const render = renderArtifactDocument("business_analysis", content);
  assert.ok(render.rendered);
  const text = render.lines.join("\n");
  assert.ok(
    text.indexOf("not a conclusion") < text.indexOf("Stop keying supplier"),
  );
  assert.match(text, /\*\*Objective\*\* \*\(stated\)\*\. Stop keying/);
  assert.match(text, /- Xero must remain the system of record \*\(stated\)\*/);
  assert.match(text, /\| 400-500 invoices per month \| scale \| stated \|/);
  assert.match(
    text,
    /- \*\*Which Xero edition is in use\*\* — would be resolved by: Ask finance/,
  );
  assert.match(text, /4 elements extracted: 2 stated, 1 inferred, 1 unknown/);
});
