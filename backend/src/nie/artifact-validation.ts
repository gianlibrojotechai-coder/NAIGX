/**
 * Artifact schema validation (`FR-039`, `AD-08`, `docs/12` D-1).
 *
 * `FR-039`: "Every artifact must validate against its schema before
 * presentation." Boundary check 5 asserts a schema *exists* for every declared
 * artifact type; this is what makes it load-bearing.
 *
 * ONE SCHEMA, TWO USES. `AI §9.3` is the governing rule — "the same schema
 * drives generation guidance and validation — they cannot disagree." The file
 * read here is the same repository-authored JSON Schema published to
 * `ARTIFACT_SCHEMA.definition` (`DB §4.4`) and injected as the Output Contract
 * fragment (`AI §6.1`). No rule from it is restated in TypeScript, because a
 * restatement is a second schema that drifts.
 *
 * WHY AJV RATHER THAN A HAND-ROLLED CHECK. `docs/12` D-1 fixed JSON Schema
 * draft 2020-12 as the authoritative representation. A bespoke validator that
 * diverged from 2020-12 semantics — on `$ref`, `if`/`then`, `const` — would
 * break exactly the "cannot disagree" property the choice exists to protect.
 *
 * IT VALIDATES THE WIRE SHAPE. The schema describes the *response* a generator
 * returns (snake_case), not the camelCase domain object the parser builds. So
 * this runs against the parsed JSON record, before the structural parser turns
 * it into a typed result.
 *
 * SCHEMA-VALID IS NECESSARY, NOT SUFFICIENT. Three Stage 9 rules are not
 * expressible in JSON Schema and stay in `parsePortfolioSuggestions`: gap
 * coverage, project redundancy, and the rank total order (`docs/12` D-29).
 *
 * Reads one file per artifact type and nothing else. No database, no network,
 * no provider.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";

import type { ArtifactType } from "./contracts.js";

/** `backend/schemas/` — the path boundary check 5 also reads. */
export const ARTIFACT_SCHEMA_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../schemas",
);

/**
 * Raised when a generated artifact does not satisfy its registered schema.
 *
 * Distinct from `StageError` so the pipeline can grant it the one regeneration
 * `FR-039` specifies and nothing else. `AI §3.2`'s regeneration budget is one
 * attempt; a second failure is a stage failure like any other.
 */
export class ArtifactSchemaError extends Error {
  readonly artifactType: string;
  /** Schema paths that failed, for a reader who has to fix the generator. */
  readonly violations: readonly string[];

  constructor(artifactType: string, violations: readonly string[]) {
    super(
      `Artifact "${artifactType}" failed schema validation: ${violations.join("; ")}`,
    );
    this.name = "ArtifactSchemaError";
    this.artifactType = artifactType;
    this.violations = violations;
  }
}

// The 2020-12 dialect entry point specifically — `docs/12` D-1 fixed draft
// 2020-12, and Ajv's default export validates draft-07.
const ajv = new Ajv2020({ allErrors: true, strict: false });
const compiled = new Map<string, ValidateFunction>();

/**
 * Compiles and caches the registered schema for an artifact type.
 *
 * A missing schema raises rather than skipping. Boundary check 5 makes that
 * unreachable in a healthy tree; treating it as "nothing to validate" would
 * turn a registration failure into silently unvalidated output.
 */
function validatorFor(artifactType: ArtifactType): ValidateFunction {
  const cached = compiled.get(artifactType);
  if (cached !== undefined) return cached;

  const file = path.join(ARTIFACT_SCHEMA_ROOT, `${artifactType}.schema.json`);
  let source: string;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(
      `No registered schema for artifact type "${artifactType}" at schemas/${artifactType}.schema.json (FR-039, AD-08)`,
    );
  }

  const validate = ajv.compile(JSON.parse(source) as object);
  compiled.set(artifactType, validate);
  return validate;
}

/**
 * Validates a generated artifact against its registered schema.
 *
 * @throws ArtifactSchemaError when the document does not conform.
 */
export function validateArtifact(
  artifactType: ArtifactType,
  content: unknown,
): void {
  const validate = validatorFor(artifactType);
  if (validate(content)) return;

  const violations = (validate.errors ?? []).map((e) => {
    const where = e.instancePath === "" ? "(root)" : e.instancePath;
    return `${where} ${e.message ?? "is invalid"}`;
  });
  throw new ArtifactSchemaError(
    artifactType,
    violations.length > 0 ? violations : ["did not conform to its schema"],
  );
}

/** `DB §4.4` — "only `valid` artifacts are presentable". */
export type ValidationStatus = "valid" | "failed";

/**
 * The `DB §4.4` status for a document, without throwing.
 *
 * Provided for callers that record an outcome rather than gate on one. It does
 * **not** persist: `ARTIFACT` is not modelled, so `validation_status` has no
 * column to live in yet. Enforcement in this build is structural — a failing
 * artifact never reaches the pipeline result.
 */
export function validationStatusOf(
  artifactType: ArtifactType,
  content: unknown,
): ValidationStatus {
  try {
    validateArtifact(artifactType, content);
    return "valid";
  } catch (error) {
    if (error instanceof ArtifactSchemaError) return "failed";
    throw error;
  }
}
