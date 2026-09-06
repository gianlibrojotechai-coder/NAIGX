/**
 * Unit — the registered artifact schemas (`FR-039`, `AD-08`, `docs/12` D-1).
 *
 * Boundary check 5 asserts a schema *exists* for every declared artifact type.
 * Existence is not agreement. `AI §9.3` states the governing rule — "the same
 * schema drives generation guidance and validation — they cannot disagree" —
 * and nothing enforces that if the schema is a file nobody compares to the code.
 *
 * So this asserts the two halves agree where they can be compared mechanically:
 * every closed vocabulary in the schema is exactly the vocabulary the contracts
 * export, and every field the parser requires is required by the schema. A
 * value added to `PORTFOLIO_EVIDENCE_TYPES` and not to the schema now fails here
 * rather than at a provider call.
 *
 * Reads two files and nothing else. No database, no provider, no network.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BUILD_EFFORT,
  PORTFOLIO_COMPLEXITY,
  PORTFOLIO_EVIDENCE_TYPES,
} from "../../src/nie/contracts.js";
import { STAGES } from "../../src/nie/stages.js";

const SCHEMA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../schemas",
);

const readSchema = (type: string): Record<string, unknown> =>
  JSON.parse(
    fs.readFileSync(path.join(SCHEMA_DIR, `${type}.schema.json`), "utf8"),
  ) as Record<string, unknown>;

const declaredTypes = [
  ...new Set(STAGES.flatMap((s) => s.producesArtifactTypes)),
];

// --- registration --------------------------------------------------------

test("every declared artifact type has a well-formed schema", () => {
  assert.ok(
    declaredTypes.length > 0,
    "stage 9 declares portfolio_suggestions — if this is empty the registry regressed",
  );

  for (const type of declaredTypes) {
    const schema = readSchema(type);
    assert.equal(
      schema["$schema"],
      "https://json-schema.org/draft/2020-12/schema",
      `${type}: docs/12 D-1 fixed draft 2020-12 as the authoritative representation`,
    );
    assert.equal(typeof schema["$id"], "string", `${type}: needs an $id`);
    assert.equal(typeof schema["description"], "string");
  }
});

// --- the schema and the contracts share one vocabulary -------------------

const defs = (): Record<string, Record<string, unknown>> =>
  readSchema("portfolio_suggestions")["$defs"] as Record<
    string,
    Record<string, unknown>
  >;

test("closed vocabularies match the exported constants exactly", () => {
  const project = defs()["project"]?.["properties"] as Record<
    string,
    Record<string, unknown>
  >;
  const evidence = defs()["evidence"]?.["properties"] as Record<
    string,
    Record<string, unknown>
  >;

  assert.deepEqual(project["complexity"]?.["enum"], [...PORTFOLIO_COMPLEXITY]);
  assert.deepEqual(project["estimated_effort"]?.["enum"], [...BUILD_EFFORT]);
  assert.deepEqual(evidence["type"]?.["enum"], [...PORTFOLIO_EVIDENCE_TYPES]);
});

test("reusability provenance is pinned to the single value D-29 allows", () => {
  const reusability = defs()["reusability"] as Record<string, unknown>;
  const properties = reusability["properties"] as Record<
    string,
    Record<string, unknown>
  >;

  assert.equal(
    properties["provenance"]?.["const"],
    "inferred",
    "a model must not be able to declare its own claim `stated` (docs/12 D-29)",
  );
  assert.deepEqual(reusability["required"], ["provenance", "basis", "claim"]);
});

test("every field the parser requires is required by the schema", () => {
  // Mirrors the `requireString` / `requireStringList` / `requireMember` calls in
  // parseProject. Listed literally rather than derived: a test that computed
  // this from the same source it checks would assert nothing.
  const parserRequires = [
    "rank",
    "name",
    "complexity",
    "primary_gaps",
    "secondary_capabilities",
    "why_this_project",
    "business_problem",
    "what_to_build",
    "workflow",
    "platforms",
    "technical_concepts",
    "evidence_to_produce",
    "reusability",
    "estimated_effort",
    "portfolio_value",
  ];

  const required = defs()["project"]?.["required"] as string[];
  for (const field of parserRequires) {
    assert.ok(
      required.includes(field),
      `${field} is required by parseProject but optional in the schema`,
    );
  }

  assert.ok(
    !required.includes("why_not_consolidated"),
    "why_not_consolidated is conditionally required, expressed as if/then",
  );
  const then = defs()["project"]?.["then"] as Record<string, string[]>;
  assert.deepEqual(
    then["required"],
    ["why_not_consolidated"],
    "a single-gap project must state why it cannot fold into another",
  );
});

test("the top level requires both fields the parser reads", () => {
  const schema = readSchema("portfolio_suggestions");
  assert.deepEqual(schema["required"], ["projects", "consolidation_rationale"]);
  const properties = schema["properties"] as Record<
    string,
    Record<string, unknown>
  >;
  assert.equal(
    properties["projects"]?.["minItems"],
    1,
    "a build_first verdict with no project says nothing",
  );
});
