/**
 * Unit — the requirement path's edge cases and practices (D-83, `FR-037`).
 *
 * The parser checks what the schema cannot: every edge case and every
 * practice names a part the design has. Stage 10 recomputes it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { ArchitectureResult } from "../../src/nie/contracts.js";
import {
  EdgeCaseGroundingError,
  parseEdgeCaseAnalysis,
} from "../../src/nie/stages/edge-case-analysis.js";
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
      groundedInContextIndices: [0],
    },
    {
      ordinal: 1,
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

const edgeCase = (overrides: Record<string, unknown> = {}) => ({
  component: "Invoice Capture",
  scenario:
    "An email carries two PDFs, one an invoice and one a remittance advice",
  consequence: "The remittance advice is captured as a second invoice",
  handling:
    "Capture classifies attachments and quarantines any it cannot classify",
  ...overrides,
});

const practice = (overrides: Record<string, unknown> = {}) => ({
  applies_to: "Xero Poster",
  practice:
    "Key each bill on the supplier invoice number so a retried post cannot duplicate it",
  rationale:
    "The poster retries on transient Xero errors, and Xero accepts duplicate bills",
  ...overrides,
});

const wire = (edgeCases: unknown[], practices: unknown[] = []) =>
  JSON.stringify({ edge_cases: edgeCases, practices });

test("grounded edge cases and practices parse and validate against the schema", () => {
  const text = wire(
    [edgeCase(), edgeCase({ component: "Xero" })],
    [practice()],
  );
  validateArtifact("edge_cases_and_practices", JSON.parse(text) as unknown);
  const parsed = parseEdgeCaseAnalysis(text, architecture);
  assert.equal(parsed.edgeCases.length, 2);
  assert.equal(parsed.practices[0]?.appliesTo, "Xero Poster");
});

test("an edge case in something the design neither has nor integrates is refused (FR-037)", () => {
  assert.throws(
    () =>
      parseEdgeCaseAnalysis(
        wire([edgeCase({ component: "The database" })]),
        architecture,
      ),
    (e: unknown) =>
      e instanceof EdgeCaseGroundingError &&
      /The database/.test((e as Error).message),
  );
});

test("a practice not tied to a part of the design is refused as generic advice (FR-037)", () => {
  assert.throws(
    () =>
      parseEdgeCaseAnalysis(
        wire([edgeCase()], [practice({ applies_to: "All services" })]),
        architecture,
      ),
    (e: unknown) =>
      e instanceof EdgeCaseGroundingError &&
      /All services/.test((e as Error).message),
  );
});

test("at least one edge case; every field non-empty; practices may be empty", () => {
  assert.throws(
    () => parseEdgeCaseAnalysis(wire([]), architecture),
    /edge_cases is empty/,
  );
  assert.throws(
    () =>
      parseEdgeCaseAnalysis(
        wire([edgeCase({ consequence: "" })]),
        architecture,
      ),
    /consequence/,
  );
  assert.equal(
    parseEdgeCaseAnalysis(wire([edgeCase()]), architecture).practices.length,
    0,
  );
});

test("Stage 10 recomputes the grounding against the architecture", () => {
  const ok = checkInternalConsistency(
    "edge_cases_and_practices",
    JSON.parse(wire([edgeCase()], [practice()])) as unknown,
    { inputText: "", architecture },
  );
  assert.equal(ok.passed, true, ok.detail ?? "");
  const bad = checkInternalConsistency(
    "edge_cases_and_practices",
    JSON.parse(
      wire(
        [edgeCase({ component: "Ledger" })],
        [practice({ applies_to: "Everything" })],
      ),
    ) as unknown,
    { inputText: "", architecture },
  );
  assert.equal(bad.passed, false);
  assert.match(bad.detail ?? "", /Ledger/);
  assert.match(bad.detail ?? "", /Everything/);
});
