/**
 * Unit — the export layout for the intent brief (D-66).
 *
 * The brief is the one artifact that exists before any reasoning has run, so
 * the thing the export must get right is not the layout but the standing: a
 * reader who meets it in a document must be told it is an understanding of
 * the input and not a conclusion, before the objective is read (`FR-043`,
 * D-66 §2). These tests pin that sentence, the heading, and the provenance
 * marks — the same discipline `export-markdown.test.ts` applies to the
 * reasoning sections.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  artifactTitle,
  renderArtifactDocument,
} from "../../src/export/artifact-markdown.js";
import { renderIntentBrief } from "../../src/nie/stages/derived-artifacts.js";

const brief = renderIntentBrief({
  primaryObjective: {
    content: "Stop keying supplier invoices by hand",
    provenance: "stated",
  },
  secondaryObjectives: [
    { content: "Recover early-payment discounts", provenance: "inferred" },
  ],
  inferredScope: "Accounts payable, from receipt to approval",
  requestedOutcome: "design",
});

test("the brief has a heading of its own in the export", () => {
  assert.equal(artifactTitle("intent_brief"), "Intent Brief");
});

test("the export states the brief's standing before its content", () => {
  const render = renderArtifactDocument("intent_brief", brief);
  assert.ok(render.rendered, "the export lays this artifact out");

  const text = render.lines.join("\n");
  const standing = text.indexOf("not a conclusion");
  const objective = text.indexOf("Stop keying supplier invoices");
  assert.ok(standing >= 0, "the standing sentence is present");
  assert.ok(
    standing < objective,
    "the standing is read before the objective it qualifies",
  );
});

test("FR-043 — every objective carries its provenance, and the scope is named", () => {
  const text = renderArtifactDocument("intent_brief", brief).lines.join("\n");

  assert.match(text, /\*\*Objective\*\* \(stated\)\. Stop keying/);
  assert.match(text, /- Recover early-payment discounts \*\(inferred\)\*/);
  assert.match(text, /Accounts payable, from receipt to approval/);
});

test("a brief with no secondary objectives omits the list rather than printing an empty one", () => {
  const lone = renderIntentBrief({
    primaryObjective: { content: "One aim", provenance: "inferred" },
    secondaryObjectives: [],
    inferredScope: "One team",
    requestedOutcome: "design",
  });
  const text = renderArtifactDocument("intent_brief", lone).lines.join("\n");

  assert.ok(!text.includes("Also aims to"));
  assert.match(text, /\*\*Objective\*\* \(inferred\)\. One aim/);
});

test("a document that is not a brief is reported as unrenderable, not guessed at", () => {
  const render = renderArtifactDocument("intent_brief", {
    objective: "a bare string, not an object",
  });
  assert.equal(render.rendered, false);
});

test("the same brief renders identically twice", () => {
  assert.deepEqual(
    renderArtifactDocument("intent_brief", brief),
    renderArtifactDocument("intent_brief", brief),
  );
});

// --- D-70: the node-by-node block in the portfolio export -------------------

test("D-70 — the export renders the implementation block node by node, and skips it when absent", () => {
  const project = {
    rank: 1,
    name: "Lead intake",
    complexity: "intermediate",
    primary_gaps: ["req-1"],
    secondary_capabilities: ["logging"],
    why_this_project: "why",
    business_problem: "problem",
    what_to_build: "build",
    workflow: ["Trigger: form", "Sync: CRM"],
    platforms: ["n8n", "HubSpot"],
    technical_concepts: ["webhooks"],
    evidence_to_produce: [{ type: "repo", what_it_shows: "the export" }],
    why_not_consolidated: "only one gap",
    reusability: { provenance: "inferred", basis: "b", claim: "c" },
    estimated_effort: "days",
    portfolio_value: "value",
    implementation: {
      platform: "n8n",
      steps: [
        {
          step: 1,
          node: "Webhook",
          purpose: "Receive the form",
          setup: ["HTTP method: POST"],
          credential: null,
        },
        {
          step: 2,
          node: "HubSpot",
          purpose: "Upsert the contact",
          setup: ["Resource: Contact", "Operation: Create/Update"],
          credential: "HubSpot OAuth2 API",
        },
      ],
      notes: ["Test with pinned data first"],
    },
  };
  const withBlock = renderArtifactDocument("portfolio_suggestions", {
    projects: [project],
    consolidation_rationale: "one",
  }).lines.join("\n");
  assert.match(withBlock, /How to build it in n8n — node by node/);
  assert.match(withBlock, /1\. \*\*Webhook\*\* — Receive the form/);
  assert.match(withBlock, /- HTTP method: POST/);
  assert.match(withBlock, /- Credential: none/);
  assert.match(withBlock, /- Credential: HubSpot OAuth2 API/);
  assert.match(withBlock, /Test with pinned data first/);

  const { implementation: _omit, ...plain } = project;
  const without = renderArtifactDocument("portfolio_suggestions", {
    projects: [plain],
    consolidation_rationale: "one",
  }).lines.join("\n");
  assert.ok(!without.includes("node by node"));
});
