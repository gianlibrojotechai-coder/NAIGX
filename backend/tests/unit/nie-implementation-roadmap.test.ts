/**
 * Unit — the requirement path's implementation roadmap (D-82, `FR-036`).
 *
 * The parser checks what the schema cannot: phases numbered in order, a
 * dependency naming an earlier phase, every phase building a component the
 * design has, every component built by some phase, and an estimate citing
 * the context element that supplied its basis. Stage 10 recomputes the
 * grounding.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  ArchitectureResult,
  ContextResult,
} from "../../src/nie/contracts.js";
import {
  RoadmapGroundingError,
  parseImplementationRoadmap,
  unbuiltComponents,
} from "../../src/nie/stages/implementation-roadmap.js";
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
      content: "Go-live is needed before the quarter closes on 30 September",
      category: "constraint",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 1,
      specificityScore: 0.5,
    },
  ],
};

const phase = (
  ordinal: number,
  components: string[],
  dependsOn: number[],
  overrides: Record<string, unknown> = {},
) => ({
  ordinal,
  name: `Phase ${String(ordinal)}`,
  objective: "Build the named components",
  components,
  depends_on: dependsOn,
  outcome: "The named components run end to end",
  ...overrides,
});

const wire = (
  phases: unknown[],
  rationale = "Capture feeds routing feeds posting",
) => JSON.stringify({ phases, sequencing_rationale: rationale });

const GOOD = [
  phase(1, ["Invoice Capture"], []),
  phase(2, ["Approval Router"], [1]),
  phase(3, ["Xero Poster"], [2]),
];

test("a grounded, ordered roadmap parses and validates against the schema", () => {
  const text = wire(GOOD);
  validateArtifact("implementation_roadmap", JSON.parse(text) as unknown);
  const parsed = parseImplementationRoadmap(text, architecture, context);
  assert.deepEqual(
    parsed.phases.map((p) => [p.ordinal, p.dependsOn]),
    [
      [1, []],
      [2, [1]],
      [3, [2]],
    ],
  );
  assert.equal(parsed.phases[0]?.estimate, undefined);
  assert.equal(
    parsed.sequencingRationale,
    "Capture feeds routing feeds posting",
  );
});

test("a phase building something the design does not have is refused (FR-036)", () => {
  assert.throws(
    () =>
      parseImplementationRoadmap(
        wire([...GOOD, phase(4, ["Data Warehouse"], [3])]),
        architecture,
        context,
      ),
    (e: unknown) =>
      e instanceof RoadmapGroundingError &&
      /Data Warehouse/.test((e as Error).message),
  );
});

test("a roadmap that leaves a component of the design unbuilt is refused (FR-036)", () => {
  assert.throws(
    () =>
      parseImplementationRoadmap(
        wire([
          phase(1, ["Invoice Capture"], []),
          phase(2, ["Approval Router"], [1]),
        ]),
        architecture,
        context,
      ),
    (e: unknown) =>
      e instanceof RoadmapGroundingError &&
      /never builds "Xero Poster"/.test((e as Error).message),
  );
  // A naming near-miss counts as building the component, as it does for a risk.
  assert.deepEqual(
    unbuiltComponents(
      ["invoice capture", "Approval Router", "Xero"],
      architecture,
    ),
    [],
  );
});

test("phases are numbered in order and depend only on earlier phases", () => {
  assert.throws(
    () =>
      parseImplementationRoadmap(
        wire([
          phase(1, ["Invoice Capture"], []),
          phase(3, ["Approval Router", "Xero Poster"], [1]),
        ]),
        architecture,
        context,
      ),
    /ordinal 3/,
  );
  assert.throws(
    () =>
      parseImplementationRoadmap(
        wire([
          phase(1, ["Invoice Capture"], [2]),
          phase(2, ["Approval Router", "Xero Poster"], [1]),
        ]),
        architecture,
        context,
      ),
    /depends_on 2/,
  );
  assert.throws(
    () =>
      parseImplementationRoadmap(
        wire([
          phase(1, ["Invoice Capture"], []),
          phase(2, ["Approval Router", "Xero Poster"], [1, 1]),
        ]),
        architecture,
        context,
      ),
    /twice/,
  );
  assert.throws(
    () =>
      parseImplementationRoadmap(
        wire([phase(1, [], [])]),
        architecture,
        context,
      ),
    /names no component/,
  );
});

test("an estimate is accepted only with a basis the input supplied", () => {
  const withBasis = wire([
    phase(1, ["Invoice Capture", "Approval Router"], [], {
      estimate: { duration: "three weeks", basis_context_index: 0 },
    }),
    phase(2, ["Xero Poster"], [1]),
  ]);
  const parsed = parseImplementationRoadmap(withBasis, architecture, context);
  assert.deepEqual(parsed.phases[0]?.estimate, {
    duration: "three weeks",
    basisContextIndex: 0,
  });
  assert.throws(
    () =>
      parseImplementationRoadmap(
        wire([
          phase(1, ["Invoice Capture", "Approval Router"], [], {
            estimate: { duration: "three weeks", basis_context_index: 7 },
          }),
          phase(2, ["Xero Poster"], [1]),
        ]),
        architecture,
        context,
      ),
    /resolves to no context element/,
  );
});

test("Stage 10 recomputes the grounding against the architecture", () => {
  const ok = checkInternalConsistency(
    "implementation_roadmap",
    JSON.parse(wire(GOOD)) as unknown,
    { inputText: "", architecture },
  );
  assert.equal(ok.passed, true, ok.detail ?? "");
  const bad = checkInternalConsistency(
    "implementation_roadmap",
    JSON.parse(
      wire([
        phase(1, ["Invoice Capture", "Ledger"], []),
        phase(2, ["Approval Router"], [1]),
      ]),
    ) as unknown,
    { inputText: "", architecture },
  );
  assert.equal(bad.passed, false);
  assert.match(bad.detail ?? "", /Ledger/);
  assert.match(bad.detail ?? "", /Xero Poster/);
});
