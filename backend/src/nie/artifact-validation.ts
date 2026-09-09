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

/**
 * The version this build validates against, and the version an ARTIFACT row
 * references (`DB §4.4`).
 *
 * Explicitly assigned, never derived from content: a changed schema is a
 * deliberate new version, not an automatic one. Declared here so validation
 * and persistence cannot drift onto two different sources of truth.
 */
// "2" since D-70: portfolio_suggestions gained `implementation`. A changed
// schema is a new version, never an overwrite (artifact-schema-publisher).
export const ARTIFACT_SCHEMA_VERSION = "3";

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

/**
 * The violations, addressed to the generator that produced them.
 *
 * WHY THIS EXISTS. `FR-039` grants one regeneration after a validation
 * failure, and until now that attempt re-sent a byte-identical request: the
 * model was asked again without being told what was wrong, and answered the
 * same way. Analysis `d797492d` is the evidence — both Stage 9 attempts
 * consumed exactly 3,469 input and 2,907 output tokens, and both omitted the
 * same conditionally-required field. The retry re-purchased the mistake.
 *
 * WHAT IT IS NOT. Not a prompt fragment, and not a schema. The instruction
 * text a stage is composed from is unchanged and still comes wholly from
 * published fragments; this is per-attempt data about *this* response,
 * carried alongside the handoff the stage was already sending. It exists only
 * on the second attempt and never reaches the first.
 *
 * The violations are reproduced verbatim from Ajv rather than reworded. They
 * name an instance path and a failed keyword, which is exactly what a
 * corrective instruction needs, and a paraphrase could only lose precision.
 */
export function correctionFor(error: ArtifactSchemaError): string {
  const numbered = error.violations
    .map((violation, index) => `${String(index + 1)}. ${violation}`)
    .join("\n");

  return [
    "CORRECTION REQUIRED — your previous response did not satisfy the output contract.",
    "",
    `It was rejected by the ${error.artifactType} schema for these reasons:`,
    numbered,
    "",
    "Produce the document again, complete and self-contained, with exactly these",
    "problems fixed. Paths are JSON Pointers into the document you returned, so",
    "`/projects/1` is the second entry of `projects`. Change nothing else: keep the",
    "same analysis and the same recommendations, and do not drop content to satisfy",
    "a rule. Return the corrected document only.",
  ].join("\n");
}

// The 2020-12 dialect entry point specifically — `docs/12` D-1 fixed draft
// 2020-12, and Ajv's default export validates draft-07.
const ajv = new Ajv2020({ allErrors: true, strict: false });
const compiled = new Map<string, ValidateFunction>();

/**
 * The authored schema document for an artifact type.
 *
 * The one read path. Validation compiles this, and publication stores it
 * verbatim, so an `ARTIFACT` row references the definition its content was
 * actually checked against rather than a second copy that could drift
 * (`AI §9.3`).
 *
 * A missing schema raises rather than returning nothing. Boundary check 5
 * makes that unreachable in a healthy tree; treating it as "nothing to
 * validate" would turn a registration failure into silently unvalidated
 * output.
 */
export function loadArtifactSchemaDefinition(
  artifactType: ArtifactType,
): Record<string, unknown> {
  const file = path.join(ARTIFACT_SCHEMA_ROOT, `${artifactType}.schema.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    throw new Error(
      `No registered schema for artifact type "${artifactType}" at schemas/${artifactType}.schema.json (FR-039, AD-08)`,
    );
  }
}

/** Compiles and caches the validator, from that same definition. */
function validatorFor(artifactType: ArtifactType): ValidateFunction {
  const cached = compiled.get(artifactType);
  if (cached !== undefined) return cached;

  const validate = ajv.compile(loadArtifactSchemaDefinition(artifactType));
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
 * Used by the persistence layer, which stores failed artifacts rather than
 * discarding them (`DB §4.4`) so a reader sees a labelled failure instead of
 * an unexplained gap. The pipeline still gates: a failing artifact never
 * reaches the result, and `only valid artifacts are presentable`.
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
