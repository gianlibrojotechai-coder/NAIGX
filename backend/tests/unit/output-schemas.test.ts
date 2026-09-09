/**
 * Unit — the stage output schemas sent as `output_config.format` (D-65).
 *
 * Two things are proved, both free:
 *
 *   1. Every schema is in the dialect constrained decoding accepts: every
 *      object closes `additionalProperties`, lists every property as
 *      required, and uses no keyword the documentation lists as unsupported.
 *   2. ⚠️ THE SCHEMAS ARE NOT STRICTER THAN THE PARSERS. Every recorded stage
 *      output in the canonical corpus — 54 responses a parser accepted and a
 *      passing regression run replayed — validates against its stage schema
 *      with only `additionalProperties` relaxed (Sonnet 4.5 sometimes added
 *      keys the parsers ignore). A schema that rejected a response the parser
 *      accepts would be a new failure mode introduced at the provider, which
 *      is the opposite of the point.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { Ajv2020 as Ajv } from "ajv/dist/2020.js";

import { validateArtifact } from "../../src/nie/artifact-validation.js";
import { STAGE_OUTPUT_SCHEMAS } from "../../src/nie/output-schemas.js";
import { parseStructured } from "../../src/nie/parse.js";
import { createRecordingStore } from "../../src/regression/recording-store.js";

const UNSUPPORTED = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "maxItems",
  "uniqueItems",
  "if",
  "then",
  "else",
  "not",
  "oneOf",
  "patternProperties",
  "$ref",
]);

const walk = (
  node: unknown,
  path: string,
  visit: (n: Record<string, unknown>, p: string) => void,
): void => {
  if (Array.isArray(node)) {
    node.forEach((n, i) => walk(n, `${path}[${String(i)}]`, visit));
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const record = node as Record<string, unknown>;
  visit(record, path);
  for (const [key, value] of Object.entries(record)) {
    if (key === "enum" || key === "required" || key === "const") continue;
    walk(value, `${path}.${key}`, visit);
  }
};

test("1. every stage schema is in the constrained-decoding dialect", () => {
  for (const [task, schema] of Object.entries(STAGE_OUTPUT_SCHEMAS)) {
    walk(schema, task, (node, path) => {
      for (const key of Object.keys(node)) {
        assert.ok(
          !UNSUPPORTED.has(key),
          `${path}: keyword "${key}" is not supported by structured outputs`,
        );
      }
      if (node["type"] === "object") {
        assert.equal(
          node["additionalProperties"],
          false,
          `${path}: objects must close additionalProperties`,
        );
        const props = Object.keys(
          (node["properties"] as Record<string, unknown>) ?? {},
        );
        const required = node["required"] as string[];
        // Optional properties are permitted by the dialect; every required
        // name must still be a declared property, and only the one field the
        // published artifact schema itself makes conditional is optional.
        for (const name of required) {
          assert.ok(
            props.includes(name),
            `${path}: required "${name}" is not a property`,
          );
        }
        const optional = props.filter((p) => !required.includes(p));
        assert.deepEqual(
          optional.filter((p) => p !== "why_not_consolidated"),
          [],
          `${path}: unexpected optional properties`,
        );
      }
    });
  }
  assert.deepEqual(Object.keys(STAGE_OUTPUT_SCHEMAS).sort(), [
    "architecture_analysis",
    "context_extraction",
    "input_classification",
    "intent_detection",
    "interview_guidance",
    "platform_recommendation",
    "portfolio_suggestions",
    "recommendation_generation",
    "workflow_review",
  ]);
});

/** The same schema with `additionalProperties` opened at every level. */
const relaxed = (schema: unknown): unknown => {
  if (Array.isArray(schema)) return schema.map(relaxed);
  if (typeof schema !== "object" || schema === null) return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "additionalProperties") continue;
    out[k] = k === "enum" || k === "required" ? v : relaxed(v);
  }
  return out;
};

test("2. every recorded stage output in the canonical corpus satisfies its stage schema (shape, enums, nesting)", () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validators = Object.fromEntries(
    Object.entries(STAGE_OUTPUT_SCHEMAS).map(([task, schema]) => [
      task,
      ajv.compile(relaxed(schema) as object),
    ]),
  );
  const store = createRecordingStore();
  const cases = Object.keys(store.readManifest("corpus-v1")?.recordings ?? {});
  assert.ok(cases.length >= 15, "the canonical store is present");

  let checked = 0;
  const problems: string[] = [];
  for (const caseId of cases) {
    const recording = store.read("corpus-v1", caseId)?.recording;
    assert.ok(recording);
    for (const stage of recording.stages) {
      const validate = validators[stage.stageKey];
      if (validate === undefined) continue;
      const parsed = parseStructured(0, stage.stageKey, stage.output);
      // Optional fields absent in a recording are present-and-null under the
      // schema; absence is what the parsers accept, so it is filled in here.
      const filled = fillNulls(parsed, STAGE_OUTPUT_SCHEMAS[stage.stageKey]);
      if (!validate(filled)) {
        problems.push(
          `${caseId}/${stage.stageKey}: ${ajv.errorsText(validate.errors)}`,
        );
      }
      checked += 1;
    }
  }
  assert.equal(problems.length, 0, problems.join("\n"));
  assert.ok(checked >= 50, `checked ${String(checked)} recorded outputs`);
});

test("3. why_not_consolidated: optional in the request schema, and the authoritative contract still enforces it", () => {
  // The authoritative contract is the PUBLISHED artifact schema
  // (`schemas/portfolio_suggestions.schema.json`, `DB §4.4`) plus the parser
  // rule in `docs/12` D-29: required for a single-gap project, non-empty when
  // present. The request schema only states the shape; it must not be the
  // thing that makes the field mandatory, and it must not weaken the rule.
  const projects = STAGE_OUTPUT_SCHEMAS["portfolio_suggestions"] as {
    properties: {
      projects: {
        items: { required: string[]; properties: Record<string, unknown> };
      };
    };
  };
  const project = projects.properties.projects.items;
  assert.ok("why_not_consolidated" in project.properties, "declared");
  assert.ok(!project.required.includes("why_not_consolidated"), "optional");

  const base = {
    rank: 1,
    name: "Salesforce lead sync",
    complexity: "intermediate",
    secondary_capabilities: ["error handling"],
    why_this_project: "closes the named gap",
    business_problem: "leads are re-keyed",
    what_to_build: "a sync",
    workflow: ["trigger", "sync", "verify"],
    platforms: ["n8n"],
    technical_concepts: ["idempotency"],
    evidence_to_produce: [{ type: "repo", what_it_shows: "the sync" }],
    reusability: {
      provenance: "inferred",
      basis: "common shape",
      claim: "reusable",
    },
    estimated_effort: "days",
    portfolio_value: "demonstrates the gap closed",
  };
  const wire = (project: Record<string, unknown>) => ({
    projects: [project],
    consolidation_rationale: "one project",
  });

  // Single-gap project, field absent → refused (the published schema's if/then).
  assert.throws(
    () =>
      validateArtifact(
        "portfolio_suggestions",
        wire({ ...base, primary_gaps: ["req-1"] }),
      ),
    /why_not_consolidated/,
  );
  // Present but empty → refused (nonEmptyString), the exact live failure.
  assert.throws(
    () =>
      validateArtifact(
        "portfolio_suggestions",
        wire({ ...base, primary_gaps: ["req-1"], why_not_consolidated: "" }),
      ),
    /why_not_consolidated/,
  );
  // Single-gap with a real explanation → accepted.
  validateArtifact(
    "portfolio_suggestions",
    wire({
      ...base,
      primary_gaps: ["req-1"],
      why_not_consolidated: "it cannot fold into another",
    }),
  );
  // Multi-gap project, field absent → accepted: the explanation is not required.
  validateArtifact(
    "portfolio_suggestions",
    wire({ ...base, primary_gaps: ["req-1", "req-2"] }),
  );
});

test("4. minItems: the request schema requires a non-empty list exactly where the PUBLISHED schema does, and nowhere else", () => {
  // The authoritative contract is the published file. Its `nonEmptyStringList`
  // and the two explicit `minItems: 1` arrays are the complete set; the
  // request schema must carry the same set — no more (it would be stricter
  // than the validator, which AI §9.3 forbids) and no less (the one degraded
  // run in the Sonnet 5 sample was an empty `platforms` list).
  const published = JSON.parse(
    fs.readFileSync(
      path.resolve(
        path.dirname(new URL(import.meta.url).pathname.slice(1)),
        "../../schemas/portfolio_suggestions.schema.json",
      ),
      "utf8",
    ),
  ) as {
    properties: Record<string, Record<string, unknown>>;
    $defs: Record<string, Record<string, unknown>>;
  };
  const nonEmptyRefs = new Set(["#/$defs/nonEmptyStringList"]);
  const publishedNonEmpty = new Set<string>();
  const scan = (
    props: Record<string, Record<string, unknown>>,
    prefix: string,
  ): void => {
    for (const [name, def] of Object.entries(props)) {
      const ref = def["$ref"];
      const allOf = def["allOf"] as { $ref?: string }[] | undefined;
      const viaAllOf = allOf?.some((a) => nonEmptyRefs.has(a.$ref ?? ""));
      if (
        (typeof ref === "string" && nonEmptyRefs.has(ref)) ||
        viaAllOf === true ||
        (def["type"] === "array" && def["minItems"] === 1)
      ) {
        publishedNonEmpty.add(`${prefix}${name}`);
      }
    }
  };
  scan(published.properties, "");
  scan(
    (published.$defs["project"]?.["properties"] ?? {}) as Record<
      string,
      Record<string, unknown>
    >,
    "projects.",
  );

  const request = STAGE_OUTPUT_SCHEMAS["portfolio_suggestions"] as {
    properties: Record<string, Record<string, unknown>>;
  };
  const requestNonEmpty = new Set<string>();
  const items = (request.properties["projects"]?.["items"] ?? {}) as {
    properties: Record<string, Record<string, unknown>>;
  };
  for (const [name, def] of Object.entries(request.properties)) {
    if (def["minItems"] === 1) requestNonEmpty.add(name);
  }
  for (const [name, def] of Object.entries(items.properties)) {
    if (def["minItems"] === 1) requestNonEmpty.add(`projects.${name}`);
  }

  assert.deepEqual([...requestNonEmpty].sort(), [...publishedNonEmpty].sort());
  assert.ok(requestNonEmpty.has("projects.platforms"), "the observed failure");
  // Dialect: constrained decoding supports minItems 0 and 1 only.
  walk(STAGE_OUTPUT_SCHEMAS, "", (node) => {
    if ("minItems" in node)
      assert.ok([0, 1].includes(node["minItems"] as number));
  });
});

/**
 * Arrays the parser reads as optional (absent ⇒ empty) but the schema requires
 * so the provider always emits them. Named explicitly: anything else missing
 * must still fail.
 */
const OPTIONAL_ARRAYS = new Set(["trade_offs", "rejected_approaches"]);

/**
 * Adds `null` for any required-but-nullable property the response omitted,
 * and `[]` for the named optional arrays. Only those are filled: a genuinely
 * missing required field still fails, which is the check.
 */
function fillNulls(value: unknown, schema: unknown): unknown {
  if (typeof schema !== "object" || schema === null) return value;
  const s = schema as Record<string, unknown>;
  if (
    s["type"] === "object" &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const props = (s["properties"] as Record<string, unknown>) ?? {};
    const out: Record<string, unknown> = {
      ...(value as Record<string, unknown>),
    };
    for (const [name, propSchema] of Object.entries(props)) {
      const nullable = Array.isArray(
        (propSchema as Record<string, unknown>)["anyOf"],
      );
      if (!(name in out) && nullable) out[name] = null;
      else if (!(name in out) && OPTIONAL_ARRAYS.has(name)) out[name] = [];
      else if (name in out) out[name] = fillNulls(out[name], propSchema);
    }
    return out;
  }
  if (s["type"] === "array" && Array.isArray(value)) {
    return value.map((v) => fillNulls(v, s["items"]));
  }
  return value;
}
