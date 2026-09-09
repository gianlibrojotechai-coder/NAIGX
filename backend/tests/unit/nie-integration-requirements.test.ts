/**
 * Unit — the requirement path's integration requirements (D-84, `FR-035`).
 *
 * The parser checks what the schema cannot: every integration is one the
 * architecture names, every named integration is covered, the direction
 * agrees with the component, a stated constraint cites its context element,
 * a general-knowledge one does not, and a design with no external system
 * says so. Stage 10 recomputes the grounding and the coverage.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  ArchitectureResult,
  ContextResult,
} from "../../src/nie/contracts.js";
import {
  IntegrationGroundingError,
  parseIntegrationRequirements,
  uncoveredSystems,
} from "../../src/nie/stages/integration-requirements.js";
import { validateArtifact } from "../../src/nie/artifact-validation.js";
import { checkInternalConsistency } from "../../src/nie/stages/response-validation.js";

const architecture: ArchitectureResult = {
  summary: "s",
  dataFlowDescription: "d",
  unknownDispositions: [],
  components: [
    {
      ordinal: 0,
      name: "Invoice Capture",
      responsibility: "r",
      inputs: "i",
      outputs: "o",
      failureHandling: "f",
      externalSystem: "Shared mailbox",
      integrationDirection: "inbound",
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
    {
      ordinal: 2,
      name: "Xero Poster",
      responsibility: "r",
      inputs: "i",
      outputs: "o",
      failureHandling: "f",
      externalSystem: "Xero (accounting API)",
      integrationDirection: "outbound",
      groundedInContextIndices: [0],
    },
  ],
};

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "The Xero organisation is on the Starter plan",
      category: "constraint",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 1,
      specificityScore: 0.5,
    },
  ],
};

const mailbox = (overrides: Record<string, unknown> = {}) => ({
  system: "Shared mailbox",
  component: "Invoice Capture",
  purpose: "Read inbound invoice emails and their attachments",
  direction: "inbound",
  capabilities_required: ["List unread messages", "Download attachments"],
  constraints: [],
  uncertainties: [
    "Whether the mailbox provider offers push notification on new mail",
  ],
  ...overrides,
});

const xero = (overrides: Record<string, unknown> = {}) => ({
  system: "Xero (accounting API)",
  component: "Xero Poster",
  purpose: "Create the approved bill in the ledger",
  direction: "outbound",
  capabilities_required: ["Create a bill with line items"],
  constraints: [
    {
      constraint: "Starter plan caps bills per month",
      provenance: "stated",
      context_index: 0,
    },
    {
      constraint: "60 calls per minute per tenant",
      provenance: "general_knowledge",
      context_index: null,
    },
  ],
  uncertainties: [],
  ...overrides,
});

const NOTE =
  "Platform capabilities, limits and pricing change; verify before building.";

const wire = (
  integrations: unknown[],
  statement: string | null = null,
  note: string = NOTE,
) =>
  JSON.stringify({
    integrations,
    no_integrations_statement: statement,
    knowledge_currency_note: note,
  });

/** What the pipeline validates: nulls dropped, as the published schema has none. */
const published = (text: string): unknown => {
  const doc = JSON.parse(text) as Record<string, unknown>;
  if (doc["no_integrations_statement"] === null)
    delete doc["no_integrations_statement"];
  for (const i of doc["integrations"] as Record<string, unknown>[]) {
    for (const c of i["constraints"] as Record<string, unknown>[]) {
      if (c["context_index"] === null) delete c["context_index"];
    }
  }
  return doc;
};

test("grounded, complete integration requirements parse and validate against the schema", () => {
  const text = wire([mailbox(), xero()]);
  validateArtifact("integration_requirements", published(text));
  const parsed = parseIntegrationRequirements(text, architecture, context);
  assert.deepEqual(
    parsed.integrations.map((i) => [i.system, i.component, i.direction]),
    [
      ["Shared mailbox", "Invoice Capture", "inbound"],
      ["Xero (accounting API)", "Xero Poster", "outbound"],
    ],
  );
  assert.deepEqual(parsed.integrations[1]?.constraints, [
    {
      constraint: "Starter plan caps bills per month",
      provenance: "stated",
      contextIndex: 0,
    },
    {
      constraint: "60 calls per minute per tenant",
      provenance: "general_knowledge",
    },
  ]);
  assert.equal(parsed.knowledgeCurrencyNote, NOTE);
});

test("an integration the architecture does not name is refused (FR-035)", () => {
  assert.throws(
    () =>
      parseIntegrationRequirements(
        wire([
          mailbox(),
          xero(),
          xero({ system: "Slack", component: "Approval Router" }),
        ]),
        architecture,
        context,
      ),
    (e: unknown) =>
      e instanceof IntegrationGroundingError &&
      /Slack/.test((e as Error).message),
  );
});

test("an external system the architecture names must be covered (FR-035)", () => {
  assert.throws(
    () =>
      parseIntegrationRequirements(wire([mailbox()]), architecture, context),
    (e: unknown) =>
      e instanceof IntegrationGroundingError &&
      /Xero \(accounting API\) \(via Xero Poster\)/.test((e as Error).message),
  );
  // A shortened system name is a naming near-miss, and covers it.
  assert.deepEqual(
    uncoveredSystems(
      [
        { system: "Shared mailbox", component: "Invoice Capture" },
        { system: "Xero", component: "Xero Poster" },
      ],
      architecture,
    ),
    [],
  );
});

test("the direction agrees with the component; a stated constraint cites the context; general knowledge does not", () => {
  assert.throws(
    () =>
      parseIntegrationRequirements(
        wire([mailbox({ direction: "outbound" }), xero()]),
        architecture,
        context,
      ),
    /contradicts the architecture/,
  );
  assert.throws(
    () =>
      parseIntegrationRequirements(
        wire([
          mailbox(),
          xero({
            constraints: [
              { constraint: "c", provenance: "stated", context_index: 4 },
            ],
          }),
        ]),
        architecture,
        context,
      ),
    /resolves to no context element/,
  );
  assert.throws(
    () =>
      parseIntegrationRequirements(
        wire([
          mailbox(),
          xero({
            constraints: [
              {
                constraint: "c",
                provenance: "general_knowledge",
                context_index: 0,
              },
            ],
          }),
        ]),
        architecture,
        context,
      ),
    /only a stated constraint cites the context/,
  );
  assert.throws(
    () =>
      parseIntegrationRequirements(
        wire([mailbox({ capabilities_required: [] }), xero()]),
        architecture,
        context,
      ),
    /names no required capability/,
  );
});

test("two components integrating the same system resolve by component name, not by the system (D-84 §4)", () => {
  const twoXero: ArchitectureResult = {
    ...architecture,
    components: [
      ...architecture.components,
      {
        ordinal: 3,
        name: "Duplicate Check",
        responsibility: "r",
        inputs: "i",
        outputs: "o",
        failureHandling: "f",
        externalSystem: "Xero (accounting API)",
        integrationDirection: "inbound",
        groundedInContextIndices: [0],
      },
    ],
  };
  const parsed = parseIntegrationRequirements(
    wire([
      mailbox(),
      xero(),
      xero({
        component: "Duplicate Check",
        direction: "inbound",
        constraints: [],
      }),
    ]),
    twoXero,
    context,
  );
  assert.deepEqual(
    parsed.integrations.map((i) => [i.component, i.direction]),
    [
      ["Invoice Capture", "inbound"],
      ["Xero Poster", "outbound"],
      ["Duplicate Check", "inbound"],
    ],
  );
  assert.throws(
    () =>
      parseIntegrationRequirements(
        wire([
          mailbox(),
          xero({
            constraints: [
              { constraint: "c", provenance: "stated", context_index: null },
            ],
          }),
        ]),
        architecture,
        context,
      ),
    /labelled stated but cites no context_index/,
  );
});

test("a design with no external system says so, and only then", () => {
  const standalone: ArchitectureResult = {
    ...architecture,
    components: architecture.components.filter(
      (c) => c.externalSystem === undefined,
    ),
  };
  assert.throws(
    () => parseIntegrationRequirements(wire([]), standalone, context),
    /no_integrations_statement is absent/,
  );
  const parsed = parseIntegrationRequirements(
    wire(
      [],
      "Every component reads and writes its own store; nothing external is touched",
    ),
    standalone,
    context,
  );
  assert.equal(parsed.integrations.length, 0);
  assert.match(parsed.noIntegrationsStatement ?? "", /nothing external/);
  assert.throws(
    () =>
      parseIntegrationRequirements(
        wire([mailbox(), xero()], "none"),
        architecture,
        context,
      ),
    /must be null when integrations are listed/,
  );
});

test("Stage 10 recomputes the grounding and the coverage", () => {
  const ok = checkInternalConsistency(
    "integration_requirements",
    published(wire([mailbox(), xero()])),
    { inputText: "", architecture },
  );
  assert.equal(ok.passed, true, ok.detail ?? "");
  const bad = checkInternalConsistency(
    "integration_requirements",
    published(
      wire([mailbox({ system: "Gmail", component: "Approval Router" })]),
    ),
    { inputText: "", architecture },
  );
  assert.equal(bad.passed, false);
  assert.match(bad.detail ?? "", /Gmail/);
  assert.match(bad.detail ?? "", /Xero/);
});
