/**
 * Unit — Stage 6, Architecture Analysis (`FR-030`, `AI §3.2`).
 *
 * The property that matters is grounding. `FR-030`: "components addressing no
 * stated or inferred requirement are a defect." A design that looks complete
 * but cites nothing is precisely the failure this stage exists to prevent, so
 * most of these tests are about rejecting one.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ArchitectureTraceabilityError,
  StageError,
  producesArchitecture,
  type ContextResult,
} from "../../src/nie/contracts.js";
import { parseArchitecture } from "../../src/nie/stages/architecture-analysis.js";

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
      content: "Xero must remain the system of record",
      category: "constraint",
      provenance: "stated",
      sourceSpanStart: 25,
      sourceSpanEnd: 60,
      specificityScore: 0.95,
    },
  ],
};

const component = (overrides: Record<string, unknown> = {}) => ({
  name: "Invoice Ingestion",
  responsibility: "Capture inbound invoice attachments",
  inputs: "Email messages with PDF attachments",
  outputs: "Normalised invoice records",
  failure_handling: "Retry with backoff; quarantine unparseable attachments",
  grounded_in_context_indices: [0],
  ...overrides,
});

const architecture = (components: unknown[]) =>
  JSON.stringify({
    summary: "Automated invoice capture and approval routing",
    data_flow_description: "Email → ingestion → validation → Xero",
    components,
  });

test("architecture is produced for the requirement and assessment paths only", () => {
  // `AI §9.1` scopes the Architecture Recommendation to "Requirement, assessment".
  assert.equal(producesArchitecture("business_requirement"), true);
  assert.equal(producesArchitecture("technical_assessment"), true);
  assert.equal(producesArchitecture("job_description"), false);
  assert.equal(producesArchitecture("existing_workflow"), false);
  assert.equal(producesArchitecture("unsupported"), false);
});

test("a well-formed grounded architecture parses", () => {
  const result = parseArchitecture(
    architecture([
      component(),
      component({
        name: "Xero Sync",
        grounded_in_context_indices: [1],
        external_system: "Xero",
        integration_direction: "outbound",
      }),
    ]),
    context,
  );

  assert.equal(result.components.length, 2);
  assert.equal(result.summary.length > 0, true);
  assert.equal(result.dataFlowDescription.length > 0, true);
  assert.deepEqual(result.components[0]?.groundedInContextIndices, [0]);
  assert.equal(result.components[1]?.externalSystem, "Xero");
  assert.equal(result.components[1]?.integrationDirection, "outbound");
  assert.deepEqual(
    result.components.map((c) => c.ordinal),
    [0, 1],
  );
});

// --- traceability (FR-030) ----------------------------------------------

test("a component grounded in nothing is a traceability failure", () => {
  assert.throws(
    () =>
      parseArchitecture(
        architecture([component({ grounded_in_context_indices: [] })]),
        context,
      ),
    (error: unknown) =>
      error instanceof ArchitectureTraceabilityError &&
      /grounded in no context element/.test(error.message),
  );
});

test("a component citing a context element that does not exist fails", () => {
  // Dangling grounding is worse than none: it looks traceable and is not.
  assert.throws(
    () =>
      parseArchitecture(
        architecture([component({ grounded_in_context_indices: [0, 7] })]),
        context,
      ),
    (error: unknown) =>
      error instanceof ArchitectureTraceabilityError &&
      /only 2 were extracted/.test(error.message),
  );
});

test("traceability failures are the only ones marked regenerable", () => {
  // `AI §3.2` grants one regeneration for traceability and nothing else.
  const traceability = (() => {
    try {
      parseArchitecture(
        architecture([component({ grounded_in_context_indices: [] })]),
        context,
      );
    } catch (error) {
      return error;
    }
    return null;
  })();
  assert.ok(traceability instanceof ArchitectureTraceabilityError);

  const malformed = (() => {
    try {
      parseArchitecture("not json", context);
    } catch (error) {
      return error;
    }
    return null;
  })();
  assert.ok(malformed instanceof StageError);
  assert.ok(
    !(malformed instanceof ArchitectureTraceabilityError),
    "a malformed design does not earn a regeneration",
  );
});

test("duplicate grounding indices are collapsed, not counted twice", () => {
  const result = parseArchitecture(
    architecture([component({ grounded_in_context_indices: [0, 0, 1] })]),
    context,
  );
  assert.deepEqual(result.components[0]?.groundedInContextIndices, [0, 1]);
});

// --- FR-030 structural requirements --------------------------------------

test("every component states responsibility, inputs, outputs and failure handling", () => {
  for (const field of [
    "name",
    "responsibility",
    "inputs",
    "outputs",
    "failure_handling",
  ]) {
    assert.throws(
      () =>
        parseArchitecture(architecture([component({ [field]: "" })]), context),
      StageError,
      `empty ${field} must be rejected`,
    );
  }
});

test("an integration point names both the system and the direction", () => {
  // `FR-030`: "Integration points name the systems involved and the direction
  // of data flow." Half an integration point is unreadable.
  assert.throws(
    () =>
      parseArchitecture(
        architecture([component({ external_system: "Xero" })]),
        context,
      ),
    (error: unknown) =>
      error instanceof StageError &&
      /integration_direction/.test(error.message),
  );
  assert.throws(
    () =>
      parseArchitecture(
        architecture([component({ integration_direction: "outbound" })]),
        context,
      ),
    (error: unknown) =>
      error instanceof StageError && /external_system/.test(error.message),
  );
});

test("component names are unique within an architecture", () => {
  // `DB §4.3` uniqueness is what lets other artifacts reference components by
  // name and stay consistent (`AI §9.4`).
  assert.throws(
    () =>
      parseArchitecture(
        architecture([component(), component({ responsibility: "Other" })]),
        context,
      ),
    (error: unknown) =>
      error instanceof StageError &&
      /Duplicate component name/.test(error.message),
  );
  assert.throws(
    () =>
      parseArchitecture(
        architecture([component(), component({ name: "invoice ingestion" })]),
        context,
      ),
    StageError,
    "uniqueness ignores case",
  );
});

test("an architecture with no components is rejected", () => {
  assert.throws(() => parseArchitecture(architecture([]), context), StageError);
});

test("a summary or data flow description is required", () => {
  for (const field of ["summary", "data_flow_description"]) {
    const body = JSON.parse(architecture([component()])) as Record<
      string,
      unknown
    >;
    delete body[field];
    assert.throws(
      () => parseArchitecture(JSON.stringify(body), context),
      StageError,
      `missing ${field} must be rejected`,
    );
  }
});
