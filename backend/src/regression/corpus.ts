/**
 * The `corpus-v1` loader (`docs/11`, `AI §12.2`).
 *
 * Reads the frozen golden corpus from `research/golden-corpus/` and returns it
 * as typed cases. Nothing here writes: the corpus is **frozen** (`AI §12.2` —
 * "a suite that drifts to match output measures nothing"), so this module has a
 * read path and no other.
 *
 * WHY A REAL PARSER. `docs/11` §7.2 chose YAML precisely so the corpus is
 * "parsed by standard tooling" while staying human-reviewable. The field
 * scraping in `tests/unit/nie-classification.test.ts` was adequate for three
 * scalars and is not adequate for a regression suite that must read nested
 * expectations and fail loudly on a malformed case.
 *
 * WHY IT VALIDATES. A corpus case is an oracle. A case that silently loses a
 * field would weaken an assertion rather than fail it, which is the corpus
 * drifting to match the system — the exact failure `AI §12.2` names. So every
 * case is validated on load and a bad one raises.
 *
 * Reads the filesystem and nothing else — no database, no network, no provider.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { CLASSIFICATION_TYPES } from "../nie/contracts.js";
import type { ClassificationType } from "../nie/contracts.js";

/**
 * `research/golden-corpus/` — deliberately outside `backend/` (`docs/11` §7.1:
 * "a corpus inside `backend/` invites an import, at which point test data
 * becomes a runtime dependency"). This module is the read path §7.1's
 * ambiguity A-2 anticipated Sprint 2 would need.
 */
export const CORPUS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../research/golden-corpus",
);

/** `docs/11` §4.4 — the two bounds an expectation may state. */
export const CONFIDENCE_BOUNDS = [
  "below_threshold",
  "at_or_above_threshold",
] as const;
export type ConfidenceBound = (typeof CONFIDENCE_BOUNDS)[number];

/** `AI §8` bands, as `expected_confidence_band` records them. */
export const CONFIDENCE_BANDS = ["high", "medium", "low"] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

/** `docs/11` §3 — the four mandatory special classes. */
export const SPECIAL_CLASSES = [
  "do-not-automate",
  "insufficient",
  "contradiction",
  "unsupported",
] as const;
export type SpecialClass = (typeof SPECIAL_CLASSES)[number];

export interface ExpectedClassificationConfidence {
  readonly bound: ConfidenceBound;
  readonly threshold: number;
  readonly rationale: string;
}

export interface ExpectedOmission {
  readonly artifactType: string;
  readonly reason: string;
}

/** One corpus case, as `docs/11` §4.1 specifies its fields. */
export interface CorpusCase {
  readonly caseId: string;
  readonly inputType: string;
  /**
   * The analysable input text.
   *
   * The corpus stores `content` as a literal block scalar, which appends a
   * trailing newline. `docs/11` §7.2 states `character_count` excludes it
   * "since that newline is an artifact of the format rather than part of the
   * text `FR-002` bounds" — so the trailing newline is stripped here, and what
   * remains is exactly the text the pipeline is given.
   */
  readonly inputText: string;
  readonly characterCount: number;
  readonly expectedClassification: ClassificationType;
  readonly expectedArtifactSet: readonly string[];
  readonly expectedOmissions: readonly ExpectedOmission[];
  readonly expectedConfidenceBand: ConfidenceBand;
  readonly expectedClassificationConfidence: ExpectedClassificationConfidence;
  readonly caseCharacter: string;
  readonly specialClass: SpecialClass | null;
  readonly rationale: string;
  readonly corpusVersion: string;
  readonly frozenAt: string;
  /** Repository-relative, for review and failure messages. */
  readonly sourcePath: string;
}

/** Raised when a case cannot be read as a valid oracle. */
export class CorpusCaseError extends Error {
  readonly sourcePath: string;

  constructor(sourcePath: string, message: string) {
    super(`${sourcePath}: ${message}`);
    this.name = "CorpusCaseError";
    this.sourcePath = sourcePath;
  }
}

type Doc = Record<string, unknown>;

const fail = (sourcePath: string, message: string): never => {
  throw new CorpusCaseError(sourcePath, message);
};

const requireString = (doc: Doc, key: string, sourcePath: string): string => {
  const value = doc[key];
  if (typeof value !== "string" || value.trim() === "") {
    return fail(sourcePath, `\`${key}\` must be a non-empty string`);
  }
  return value;
};

const requireNumber = (doc: Doc, key: string, sourcePath: string): number => {
  const value = doc[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(sourcePath, `\`${key}\` must be a number`);
  }
  return value;
};

const requireMember = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  key: string,
  sourcePath: string,
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return fail(
      sourcePath,
      `\`${key}\` must be one of ${allowed.join(" | ")} (found ${JSON.stringify(value)})`,
    );
  }
  return value as T;
};

const requireStringArray = (
  doc: Doc,
  key: string,
  sourcePath: string,
): readonly string[] => {
  const value = doc[key];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    return fail(sourcePath, `\`${key}\` must be a list of strings`);
  }
  return value as readonly string[];
};

const readOmissions = (
  doc: Doc,
  sourcePath: string,
): readonly ExpectedOmission[] => {
  const value = doc["expected_omissions"];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    return fail(sourcePath, "`expected_omissions` must be a list");
  }
  return value.map((entry) => {
    const row = entry as Doc;
    return {
      artifactType: requireString(row, "artifact_type", sourcePath),
      // `docs/11` §4.1: an omission without a reason cannot be reviewed, and
      // over-production is a defect (`FR-017`, `AC-037`).
      reason: requireString(row, "reason", sourcePath),
    };
  });
};

/** Parses one case document. Exported for focused tests over fixture text. */
export function parseCorpusCase(raw: string, sourcePath: string): CorpusCase {
  // Line endings normalised before anything else, for the reason
  // `fragments/source.ts` already normalises them: a Windows checkout must
  // agree with a Linux one, or `character_count` fails for half the
  // contributors over something unrelated to reasoning.
  const text = raw.replace(/\r\n/g, "\n");

  let parsed: unknown;
  try {
    parsed = YAML.parse(text) as unknown;
  } catch (error) {
    return fail(
      sourcePath,
      `not valid YAML — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fail(sourcePath, "expected a YAML mapping at the document root");
  }
  const doc = parsed as Doc;

  const content = requireString(doc, "content", sourcePath);
  // Exactly one trailing newline is the block-scalar artifact (`docs/11` §7.2).
  const inputText = content.replace(/\n$/, "");
  const characterCount = requireNumber(doc, "character_count", sourcePath);
  if (inputText.length !== characterCount) {
    // Not pedantry: `character_count` is what `FR-002` boundary cases are
    // authored against, so a drift between it and the text means the case no
    // longer tests the boundary it claims to.
    fail(
      sourcePath,
      `\`character_count\` is ${String(characterCount)} but \`content\` holds ${String(inputText.length)} characters`,
    );
  }

  const confidence = doc["expected_classification_confidence"];
  if (confidence === null || typeof confidence !== "object") {
    fail(sourcePath, "`expected_classification_confidence` must be a mapping");
  }
  const confidenceDoc = confidence as Doc;

  const specialClassRaw = doc["special_class"];

  return {
    caseId: requireString(doc, "case_id", sourcePath),
    inputType: requireString(doc, "input_type", sourcePath),
    inputText,
    characterCount,
    expectedClassification: requireMember(
      doc["expected_classification"],
      CLASSIFICATION_TYPES,
      "expected_classification",
      sourcePath,
    ),
    expectedArtifactSet: requireStringArray(
      doc,
      "expected_artifact_set",
      sourcePath,
    ),
    expectedOmissions: readOmissions(doc, sourcePath),
    expectedConfidenceBand: requireMember(
      doc["expected_confidence_band"],
      CONFIDENCE_BANDS,
      "expected_confidence_band",
      sourcePath,
    ),
    expectedClassificationConfidence: {
      bound: requireMember(
        confidenceDoc["bound"],
        CONFIDENCE_BOUNDS,
        "expected_classification_confidence.bound",
        sourcePath,
      ),
      threshold: requireNumber(confidenceDoc, "threshold", sourcePath),
      rationale: requireString(confidenceDoc, "rationale", sourcePath),
    },
    caseCharacter: requireString(doc, "case_character", sourcePath),
    specialClass:
      specialClassRaw === null || specialClassRaw === undefined
        ? null
        : requireMember(
            specialClassRaw,
            SPECIAL_CLASSES,
            "special_class",
            sourcePath,
          ),
    // `docs/11` §4.2: without it a maintainer cannot tell a regression from an
    // expectation that was always wrong.
    rationale: requireString(doc, "rationale", sourcePath),
    corpusVersion: requireString(doc, "corpus_version", sourcePath),
    frozenAt: requireString(doc, "frozen_at", sourcePath),
    sourcePath,
  };
}

/**
 * Loads every case, in a stable order (directory, then file name).
 *
 * Stable because a run reference is computed over the case set: an ordering
 * that varied by filesystem would make two identical runs produce two
 * different references.
 */
export function loadCorpus(root: string = CORPUS_ROOT): readonly CorpusCase[] {
  const cases: CorpusCase[] = [];

  for (const dirent of fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = path.join(root, dirent.name);
    for (const file of fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".yaml"))
      .sort()) {
      const sourcePath = `research/golden-corpus/${dirent.name}/${file}`;
      cases.push(
        parseCorpusCase(
          fs.readFileSync(path.join(dir, file), "utf8"),
          sourcePath,
        ),
      );
    }
  }

  const seen = new Set<string>();
  for (const c of cases) {
    if (seen.has(c.caseId)) {
      throw new CorpusCaseError(c.sourcePath, `duplicate case_id ${c.caseId}`);
    }
    seen.add(c.caseId);
  }

  return cases;
}

/**
 * The first vertical (`docs/11` §8 steps 1-3): the `business_requirement` path
 * plus every case carrying a mandatory special class.
 *
 * §8 calls these "the minimum for Sprint 1 to proceed on the business
 * requirement path", and they are the cases whose expectations the implemented
 * stages can actually be measured against today. The remaining paths join when
 * the assertions they carry are implementable.
 */
export const FIRST_VERTICAL = (
  cases: readonly CorpusCase[],
): readonly CorpusCase[] =>
  cases.filter(
    (c) => c.inputType === "business_requirement" || c.specialClass !== null,
  );
