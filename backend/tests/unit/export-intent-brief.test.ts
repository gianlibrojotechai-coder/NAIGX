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
