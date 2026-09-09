/**
 * Unit — the requirement path's generated risk register (D-79, `FR-032`).
 *
 * The workflow path renders this artifact from findings; here it is
 * generated against the same published schema, and the parser checks what
 * the schema cannot: every risk names a component of the architecture or an
 * external system one of its components integrates, the scales are 1–5, a
 * mitigation is present, an empty register says why, and the order is by
 * severity × likelihood.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  ArchitectureResult,
  ContextResult,
} from "../../src/nie/contracts.js";
import {
  RiskGroundingError,
  parseRiskRegister,
} from "../../src/nie/stages/risk-assessment.js";
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
      externalSystem: "Xero",
      integrationDirection: "outbound",
      groundedInContextIndices: [0],
    },
  ],
};

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "x",
      category: "constraint",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 1,
      specificityScore: 0.5,
    },
  ],
};

const risk = (overrides: Record<string, unknown> = {}) => ({
  component: "Invoice Capture",
  description: "An unreadable attachment is quarantined and waits unnoticed",
  severity: 3,
  likelihood: 3,
  mitigation: "Alert finance on every quarantine",
  ...overrides,
});

// The published schema has no null: a populated register omits the statement.
// The pipeline drops a null before validating; the parser accepts both forms.
const wire = (risks: unknown[], statement: string | null = null) =>
  JSON.stringify(
    statement === null ? { risks } : { risks, no_risks_statement: statement },
  );

test("a grounded register parses, validates against the shared schema, and is ordered by score", () => {
  const text = wire([
    risk(),
    risk({
      component: "Xero",
      severity: 5,
      likelihood: 2,
      description: "Xero rejects the bill",
    }),
    risk({ component: "Xero Poster", severity: 1, likelihood: 1 }),
  ]);
  validateArtifact("risk_assessment", JSON.parse(text) as unknown);
  const parsed = parseRiskRegister(text, architecture);
  assert.deepEqual(
    parsed.risks.map((r) => r.component),
    ["Xero", "Invoice Capture", "Xero Poster"],
  );
  assert.equal(parsed.noRisksStatement, undefined);
});

test("a risk against something the design neither has nor integrates is refused (FR-032)", () => {
  assert.throws(
    () =>
      parseRiskRegister(wire([risk({ component: "The API" })]), architecture),
    (e: unknown) =>
      e instanceof RiskGroundingError && /The API/.test((e as Error).message),
  );
});

test("a shortened external-system name is a naming near-miss, not an unknown part", () => {
  const parsed = parseRiskRegister(
    wire([risk({ component: "Xero" }), risk({ component: "xero poster" })]),
    {
      ...architecture,
      components: architecture.components.map((c) =>
        c.name === "Xero Poster"
          ? { ...c, externalSystem: "Xero (accounting API)" }
          : c,
      ),
    },
  );
  assert.equal(parsed.risks.length, 2);
});

test("the scales are 1 to 5 and a mitigation is required", () => {
  assert.throws(
    () => parseRiskRegister(wire([risk({ severity: 6 })]), architecture),
    /severity must be an integer from 1 to 5/,
  );
  assert.throws(
    () => parseRiskRegister(wire([risk({ likelihood: 0 })]), architecture),
    /likelihood must be an integer from 1 to 5/,
  );
  assert.throws(
    () => parseRiskRegister(wire([risk({ mitigation: "" })]), architecture),
    /mitigation/,
  );
});

test("an empty register must say why; a populated one must not carry a statement", () => {
  assert.throws(
    () => parseRiskRegister(wire([]), architecture),
    /must say why/,
  );
  const empty = parseRiskRegister(
    wire([], "The design touches nothing outside the mailbox at this volume."),
    architecture,
  );
  assert.equal(empty.risks.length, 0);
  assert.match(empty.noRisksStatement ?? "", /mailbox/);
  assert.throws(
    () => parseRiskRegister(wire([risk()], "none"), architecture),
    /must be null when risks are listed/,
  );
});

test("Stage 10 checks a requirement-path register against the architecture, not against findings", () => {
  const good = JSON.parse(
    wire([risk(), risk({ component: "Xero" })]),
  ) as unknown;
  const ok = checkInternalConsistency("risk_assessment", good, {
    inputText: "",
    architecture,
    context,
  });
  assert.equal(ok.passed, true, ok.detail ?? "");
  const bad = JSON.parse(wire([risk({ component: "Ghost" })])) as unknown;
  const finding = checkInternalConsistency("risk_assessment", bad, {
    inputText: "",
    architecture,
    context,
  });
  assert.equal(finding.passed, false);
  assert.match(finding.detail ?? "", /Ghost/);
});
