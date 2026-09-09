/**
 * Unit — the platform recommendation parser and the unknown-disposition
 * contract (D-78).
 *
 * `FR-034` in checkable form: criteria traced to context or components, at
 * least one rejected alternative, a null recommendation accepted, every
 * component covered by a fit line, the knowledge-currency note present. And
 * D-38's remediation: every unknown element disposed of exactly once, or the
 * architecture is refused with the indices named.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ArchitectureTraceabilityError,
  type ArchitectureResult,
  type ContextResult,
} from "../../src/nie/contracts.js";
import { parseArchitecture } from "../../src/nie/stages/architecture-analysis.js";
import {
  PlatformGroundingError,
  parsePlatformRecommendation,
} from "../../src/nie/stages/platform-recommendation.js";
import { validateArtifact } from "../../src/nie/artifact-validation.js";
import { checkInternalConsistency } from "../../src/nie/stages/response-validation.js";
import { renderArtifactDocument } from "../../src/export/artifact-markdown.js";

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "Xero must remain the system of record",
      category: "constraint",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 10,
      specificityScore: 0.9,
    },
    {
      content: "No developers in-house",
      category: "constraint",
      provenance: "stated",
      sourceSpanStart: 12,
      sourceSpanEnd: 20,
      specificityScore: 0.9,
    },
    {
      content: "Which Xero edition is in use",
      category: "system",
      provenance: "unknown",
      resolutionHint: "Ask finance",
      specificityScore: 0.2,
    },
  ],
};

const architecture: ArchitectureResult = {
  summary: "Capture invoices, route approvals, post to Xero.",
  dataFlowDescription: "Mailbox → extraction → approval → Xero.",
  components: [
    {
      ordinal: 0,
      name: "Invoice Capture",
      responsibility: "Reads the mailbox",
      inputs: "Email",
      outputs: "Invoice records",
      failureHandling: "Retries, then alerts",
      groundedInContextIndices: [0],
    },
    {
      ordinal: 1,
      name: "Xero Poster",
      responsibility: "Posts approved bills",
      inputs: "Approved invoice",
      outputs: "Xero bill id",
      failureHandling: "Queues and alerts",
      externalSystem: "Xero",
      integrationDirection: "outbound",
      groundedInContextIndices: [0],
    },
  ],
  unknownDispositions: [
    {
      contextIndex: 2,
      disposition: "assumed",
      statement: "Assumes a Xero edition with API access; verify before build.",
    },
  ],
};

const wire = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    criteria_applied: [
      {
        criterion: "Xero stays the system of record",
        context_index: 0,
        component: null,
      },
      {
        criterion: "No developers in-house — a low-code platform",
        context_index: 1,
        component: null,
      },
      {
        criterion: "The poster needs a maintained Xero connector",
        context_index: null,
        component: "Xero Poster",
      },
    ],
    recommended_platform: "n8n",
    also_required: [],
    rationale:
      "A low-code platform with a maintained Xero node meets both constraints without a developer.",
    alternatives_rejected: [
      {
        platform: "Custom code",
        rejection_reason: "There is no developer to own it (criterion 2).",
      },
    ],
    fit: [
      { component: "Invoice Capture", how: "IMAP trigger node" },
      { component: "Xero Poster", how: "Xero node, create bill" },
    ],
    knowledge_currency_note:
      "Platform capabilities and pricing change; verify the Xero node's current operations before committing.",
    ...overrides,
  });

test("a grounded recommendation parses and validates", () => {
  const text = wire();
  validateArtifact("platform_recommendation", JSON.parse(text) as unknown);
  const parsed = parsePlatformRecommendation(text, architecture, context);
  assert.equal(parsed.recommendedPlatform, "n8n");
  assert.equal(parsed.criteriaApplied.length, 3);
  assert.deepEqual(parsed.criteriaApplied[2], {
    criterion: "The poster needs a maintained Xero connector",
    contextIndex: null,
    component: "Xero Poster",
  });
  assert.equal(parsed.alternativesRejected.length, 1);
  assert.equal(parsed.fit.length, 2);
});

test("no platform is a permitted outcome (FR-034)", () => {
  const text = wire({
    recommended_platform: null,
    rationale: "The volume does not justify a build; keep the manual process.",
    alternatives_rejected: [
      {
        platform: "n8n",
        rejection_reason:
          "Would cost more to run than it saves at this volume.",
      },
    ],
  });
  validateArtifact("platform_recommendation", JSON.parse(text) as unknown);
  const parsed = parsePlatformRecommendation(text, architecture, context);
  assert.equal(parsed.recommendedPlatform, null);
});

test("a criterion traced to nothing, an out-of-range index, or an unknown component is refused", () => {
  assert.throws(
    () =>
      parsePlatformRecommendation(
        wire({
          criteria_applied: [
            { criterion: "Invented", context_index: null, component: null },
          ],
        }),
        architecture,
        context,
      ),
    (e: unknown) =>
      e instanceof PlatformGroundingError &&
      /invented/.test((e as Error).message),
  );
  assert.throws(
    () =>
      parsePlatformRecommendation(
        wire({
          criteria_applied: [
            { criterion: "x", context_index: 9, component: null },
          ],
        }),
        architecture,
        context,
      ),
    (e: unknown) =>
      e instanceof PlatformGroundingError &&
      /out of range/.test((e as Error).message),
  );
  assert.throws(
    () =>
      parsePlatformRecommendation(
        wire({
          criteria_applied: [
            { criterion: "x", context_index: null, component: "Ghost" },
          ],
        }),
        architecture,
        context,
      ),
    (e: unknown) =>
      e instanceof PlatformGroundingError && /Ghost/.test((e as Error).message),
  );
});

test("at least one rejected alternative, and the recommendation cannot reject itself", () => {
  assert.throws(
    () =>
      parsePlatformRecommendation(
        wire({ alternatives_rejected: [] }),
        architecture,
        context,
      ),
    /at least one rejected alternative/,
  );
  assert.throws(
    () =>
      parsePlatformRecommendation(
        wire({
          alternatives_rejected: [{ platform: "N8N", rejection_reason: "x" }],
        }),
        architecture,
        context,
      ),
    /cannot reject itself/,
  );
});

test("every component must have exactly one fit line, and none may be invented", () => {
  assert.throws(
    () =>
      parsePlatformRecommendation(
        wire({ fit: [{ component: "Invoice Capture", how: "x" }] }),
        architecture,
        context,
      ),
    (e: unknown) =>
      e instanceof PlatformGroundingError &&
      /does not cover component "Xero Poster"/.test((e as Error).message),
  );
  assert.throws(
    () =>
      parsePlatformRecommendation(
        wire({
          fit: [
            { component: "Invoice Capture", how: "x" },
            { component: "Xero Poster", how: "y" },
            { component: "Ghost", how: "z" },
          ],
        }),
        architecture,
        context,
      ),
    (e: unknown) =>
      e instanceof PlatformGroundingError && /Ghost/.test((e as Error).message),
  );
});

test("Stage 10 re-checks the fit names and criterion references; the export leads with the criteria", () => {
  const doc = JSON.parse(wire()) as unknown;
  const ok = checkInternalConsistency("platform_recommendation", doc, {
    inputText: "",
    architecture,
    context,
  });
  assert.equal(ok.passed, true, ok.detail ?? "");
  const bad = JSON.parse(
    wire({ fit: [{ component: "Ghost", how: "x" }] }),
  ) as unknown;
  const finding = checkInternalConsistency("platform_recommendation", bad, {
    inputText: "",
    architecture,
    context,
  });
  assert.equal(finding.passed, false);
  assert.match(finding.detail ?? "", /Ghost/);

  const text = renderArtifactDocument(
    "platform_recommendation",
    doc,
  ).lines.join("\n");
  assert.ok(
    text.indexOf("The criteria applied") < text.indexOf("The recommendation"),
  );
  assert.match(text, /\*\*n8n\.\*\* A low-code platform/);
  assert.match(text, /- \*\*Custom code\*\* — There is no developer/);
  assert.match(text, /\| Xero Poster \| Xero node, create bill \|/);
  assert.match(text, /Verify before committing/);
});

// --- D-38: unknown dispositions on the Stage 6 contract ---------------------

const architectureWire = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    summary: "s",
    data_flow_description: "d",
    components: [
      {
        name: "Invoice Capture",
        responsibility: "r",
        inputs: "i",
        outputs: "o",
        failure_handling: "f",
        grounded_in_context_indices: [0],
      },
    ],
    unknown_disposition: [
      {
        context_index: 2,
        disposition: "excluded",
        statement: "Edition-specific features are left out until known.",
      },
    ],
    ...overrides,
  });

test("an architecture disposes of every unknown exactly once, or is refused with the indices named", () => {
  const parsed = parseArchitecture(architectureWire(), context);
  assert.deepEqual(parsed.unknownDispositions, [
    {
      contextIndex: 2,
      disposition: "excluded",
      statement: "Edition-specific features are left out until known.",
    },
  ]);

  assert.throws(
    () =>
      parseArchitecture(architectureWire({ unknown_disposition: [] }), context),
    (e: unknown) =>
      e instanceof ArchitectureTraceabilityError &&
      /element\(s\) 2 undisposed/.test((e as Error).message),
  );
  assert.throws(
    () =>
      parseArchitecture(
        architectureWire({
          unknown_disposition: [
            { context_index: 0, disposition: "assumed", statement: "x" },
            { context_index: 2, disposition: "assumed", statement: "y" },
          ],
        }),
        context,
      ),
    (e: unknown) =>
      e instanceof ArchitectureTraceabilityError &&
      /is not an unknown/.test((e as Error).message),
  );
  assert.throws(
    () =>
      parseArchitecture(
        architectureWire({
          unknown_disposition: [
            { context_index: 2, disposition: "assumed", statement: "x" },
            { context_index: 2, disposition: "deferred", statement: "y" },
          ],
        }),
        context,
      ),
    (e: unknown) =>
      e instanceof ArchitectureTraceabilityError &&
      /disposed of twice/.test((e as Error).message),
  );
});

test("a context set with no unknown needs no disposition, and an absent key reads as none", () => {
  const known: ContextResult = {
    ...context,
    elements: context.elements.slice(0, 2),
  };
  const parsed = parseArchitecture(
    JSON.stringify({
      summary: "s",
      data_flow_description: "d",
      components: [
        {
          name: "A",
          responsibility: "r",
          inputs: "i",
          outputs: "o",
          failure_handling: "f",
          grounded_in_context_indices: [0],
        },
      ],
    }),
    known,
  );
  assert.deepEqual(parsed.unknownDispositions, []);
});
