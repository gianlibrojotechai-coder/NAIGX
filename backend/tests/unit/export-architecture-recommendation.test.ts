/**
 * Unit — the export layout for the architecture recommendation (D-73).
 *
 * The artifact is the requirement path's design to build from, so the export
 * must say what it is before what it contains (a recommendation, not an
 * assessment of something submitted), lay out inputs and outputs per
 * component (the reader is about to build it), and state absent trade-offs
 * as absent rather than inventing one — `FR-020` does not require them.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  artifactTitle,
  renderArtifactDocument,
} from "../../src/export/artifact-markdown.js";
import { renderArchitectureRecommendation } from "../../src/nie/stages/derived-artifacts.js";
import type { ArchitectureResult } from "../../src/nie/contracts.js";

const architecture: ArchitectureResult = {
  unknownDispositions: [],
  summary:
    "Capture invoices from the mailbox, route approvals by amount, post to Xero.",
  dataFlowDescription:
    "Mailbox → extraction → approval routing → Xero, with a duplicate check before posting.",
  components: [
    {
      ordinal: 0,
      name: "Mailbox Watcher",
      responsibility: "Polls the accounts mailbox for PDF attachments.",
      inputs: "New messages in accounts@ourcompany.com",
      outputs: "One invoice PDF per message",
      failureHandling:
        "Retries the poll; a message that cannot be read is flagged.",
      externalSystem: "Google Workspace",
      integrationDirection: "inbound",
      groundedInContextIndices: [0],
    },
    {
      ordinal: 1,
      name: "Xero Poster",
      responsibility: "Creates the bill in Xero once approved.",
      inputs: "An approved invoice record",
      outputs: "A Xero bill id",
      failureHandling:
        "Queues the record and alerts finance on repeated failure.",
      externalSystem: "Xero",
      integrationDirection: "outbound",
      groundedInContextIndices: [1],
    },
  ],
};

const document = renderArchitectureRecommendation(architecture);

test("the recommendation has a heading of its own in the export", () => {
  assert.equal(
    artifactTitle("architecture_recommendation"),
    "Architecture Recommendation",
  );
});

test("the export states the standing before the approach", () => {
  const render = renderArtifactDocument(
    "architecture_recommendation",
    document,
  );
  assert.ok(render.rendered, "the export lays this artifact out");

  const text = render.lines.join("\n");
  const standing = text.indexOf("not an assessment of a submitted design");
  const approach = text.indexOf("Capture invoices from the mailbox");
  assert.ok(standing >= 0, "the standing sentence is present");
  assert.ok(standing < approach, "the standing is read before the approach");
});

test("every component is laid out with inputs, outputs and its integration", () => {
  const text = renderArtifactDocument(
    "architecture_recommendation",
    document,
  ).lines.join("\n");

  assert.match(
    text,
    /\| # \| Component \| Responsibility \| Inputs \| Outputs \| On failure \| Integrates with \|/,
  );
  assert.match(
    text,
    /\| 0 \| Mailbox Watcher \| .* \| New messages in accounts@ourcompany.com \| One invoice PDF per message \| .* \| Google Workspace \(inbound\) \|/,
  );
  assert.match(text, /\| 1 \| Xero Poster \| .* \| Xero \(outbound\) \|/);
});

test("absent trade-offs and alternatives are stated as absent, not invented", () => {
  const text = renderArtifactDocument(
    "architecture_recommendation",
    document,
  ).lines.join("\n");

  assert.match(text, /No trade-offs were stated for this recommendation/);
  assert.match(text, /No rejected alternative was stated/);
});

test("a document without the recommendation standing is reported unrenderable", () => {
  const render = renderArtifactDocument("architecture_recommendation", {
    ...document,
    standing: "assessment",
  });
  assert.equal(render.rendered, false);
});
