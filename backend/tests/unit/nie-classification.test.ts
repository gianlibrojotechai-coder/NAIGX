/**
 * Unit — Stage 1, Input Classification (`FR-011`, `FR-015`, `AI §4`).
 *
 * `corpus-v1` is the behavioural oracle: its five terminal values, its 0.6
 * threshold convention, and its `below_threshold` / `at_or_above_threshold`
 * bounds are asserted here against the frozen corpus itself, so a drift in
 * either the code or the corpus surfaces as a failure rather than as agreement.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  CLASSIFICATION_TYPES,
  StageError,
} from "../../src/nie/contracts.js";
import {
  parseClassification,
  proceedsToReasoning,
} from "../../src/nie/stages/classification.js";

const CORPUS_ROOT = path.resolve(
  import.meta.dirname,
  "../../../research/golden-corpus",
);

interface CorpusCase {
  readonly caseId: string;
  readonly classification: string;
  readonly bound: string;
}

/**
 * Reads the frozen corpus. Only the few scalar fields this test asserts are
 * extracted — the corpus is a fixture, never a runtime dependency (`docs/11`).
 */
const corpusCases = (): readonly CorpusCase[] => {
  const cases: CorpusCase[] = [];
  for (const dir of fs
    .readdirSync(CORPUS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())) {
    for (const file of fs
      .readdirSync(path.join(CORPUS_ROOT, dir.name))
      .filter((f) => f.endsWith(".yaml"))) {
      const text = fs.readFileSync(
        path.join(CORPUS_ROOT, dir.name, file),
        "utf8",
      );
      const field = (re: RegExp): string => re.exec(text)?.[1]?.trim() ?? "";
      cases.push({
        caseId: field(/^case_id:\s*(.+)$/m),
        classification: field(/^expected_classification:\s*(.+)$/m),
        bound: field(
          /expected_classification_confidence:[\s\S]*?bound:\s*(.+)/,
        ),
      });
    }
  }
  return cases;
};

const response = (body: Record<string, unknown>): string =>
  JSON.stringify(body);

// --- the corpus as oracle ------------------------------------------------

test("the corpus uses exactly the five FR-011 terminal values", () => {
  const cases = corpusCases();
  assert.equal(cases.length, 44, "corpus-v1 is frozen at 44 cases");

  const used = new Set(cases.map((c) => c.classification));
  assert.deepEqual(
    [...used].sort(),
    [...CLASSIFICATION_TYPES].sort(),
    "corpus classifications must be exactly the implemented terminal set",
  );
  assert.ok(
    !used.has("mixed"),
    "mixed is never a terminal value (docs/12 D-6)",
  );
});

test("every corpus case parses at its expected classification and bound", () => {
  for (const c of corpusCases()) {
    // A confidence on the correct side of 0.6 for that case's declared bound.
    const confidence = c.bound === "below_threshold" ? 0.42 : 0.91;
    const result = parseClassification(
      response({
        determined_type: c.classification,
        confidence,
        candidate_types: [c.classification],
      }),
    );

    assert.equal(
      result.determinedType,
      c.classification,
      `${c.caseId}: classification`,
    );
    assert.equal(
      result.wasLowConfidence,
      c.bound === "below_threshold",
      `${c.caseId}: FR-015 low-confidence flag must follow the corpus bound`,
    );
  }
});

test("the corpus contains genuine near-boundary and ambiguous cases", () => {
  // If every case were central, passing this suite would prove very little.
  const cases = corpusCases();
  const below = cases.filter((c) => c.bound === "below_threshold");
  assert.equal(below.length, 4, "four ambiguous cases sit below the threshold");
  assert.deepEqual(below.map((c) => c.caseId).sort(), [
    "br-008",
    "ew-003",
    "jd-001",
    "ta-004",
  ]);
});

// --- threshold behaviour -------------------------------------------------

test("the threshold is 0.6 and is strict — exactly 0.6 is not low confidence", () => {
  assert.equal(CLASSIFICATION_CONFIDENCE_THRESHOLD, 0.6);

  const at = parseClassification(
    response({
      determined_type: "business_requirement",
      confidence: 0.6,
      candidate_types: [],
    }),
  );
  assert.equal(at.wasLowConfidence, false, "FR-011 says *below* 0.6");

  const justBelow = parseClassification(
    response({
      determined_type: "business_requirement",
      confidence: 0.5999999,
      candidate_types: [],
    }),
  );
  assert.equal(justBelow.wasLowConfidence, true);
});

test("confidence outside [0,1] is rejected", () => {
  for (const confidence of [-0.01, 1.01, Number.NaN]) {
    assert.throws(
      () =>
        parseClassification(
          response({
            determined_type: "business_requirement",
            confidence,
            candidate_types: [],
          }),
        ),
      StageError,
    );
  }
});

// --- mixed is intermediate only (docs/12 D-6) ----------------------------

test("a mixed detection resolves to its dominant type and never surfaces mixed", () => {
  const result = parseClassification(
    response({
      determined_type: "mixed",
      dominant_type: "existing_workflow",
      confidence: 0.72,
      candidate_types: ["business_requirement"],
    }),
  );

  assert.equal(result.determinedType, "existing_workflow");
  assert.ok(
    (CLASSIFICATION_TYPES as readonly string[]).includes(result.determinedType),
    "the terminal value is always one of the FR-011 five",
  );
  assert.equal(result.mixedDetected, true, "the detection is still recorded");
  // `AI §4.3` — the secondary is disclosed, via the existing candidate set.
  assert.deepEqual([...result.candidateTypes].sort(), [
    "business_requirement",
    "existing_workflow",
  ]);
});

test("a mixed detection without a dominant type is rejected", () => {
  // `AI §4.1` gives mixed no downstream path, so it cannot stand alone.
  assert.throws(
    () =>
      parseClassification(
        response({
          determined_type: "mixed",
          confidence: 0.8,
          candidate_types: ["business_requirement", "existing_workflow"],
        }),
      ),
    StageError,
  );
});

test("a mixed detection must disclose a secondary type", () => {
  assert.throws(
    () =>
      parseClassification(
        response({
          determined_type: "mixed",
          dominant_type: "job_description",
          confidence: 0.8,
          candidate_types: [],
        }),
      ),
    (error: unknown) =>
      error instanceof StageError && /secondary/.test(error.message),
  );
});

test("mixed is rejected inside candidate_types", () => {
  // `FR-014` lets a user reclassify "to any supported type"; mixed is not one.
  assert.throws(
    () =>
      parseClassification(
        response({
          determined_type: "business_requirement",
          confidence: 0.9,
          candidate_types: ["mixed"],
        }),
      ),
    StageError,
  );
});

// --- unsupported (FR-092) ------------------------------------------------

test("unsupported is terminal and stops reasoning", () => {
  const result = parseClassification(
    response({
      determined_type: "unsupported",
      confidence: 0.95,
      candidate_types: [],
    }),
  );
  assert.equal(result.determinedType, "unsupported");
  assert.equal(
    proceedsToReasoning(result),
    false,
    "FR-011: unsupported does not proceed to reasoning",
  );
});

test("low confidence does not stop the pipeline", () => {
  // `FR-015` lets the user "allow the best guess to proceed"; the flag travels
  // with the analysis instead of halting it.
  const result = parseClassification(
    response({
      determined_type: "technical_assessment",
      confidence: 0.31,
      candidate_types: ["technical_assessment", "business_requirement"],
    }),
  );
  assert.equal(result.wasLowConfidence, true);
  assert.equal(proceedsToReasoning(result), true);
});

// --- malformed output ----------------------------------------------------

test("unparseable or off-enumeration output fails the stage", () => {
  for (const body of [
    "not json at all",
    JSON.stringify([1, 2, 3]),
    response({
      determined_type: "sales_lead",
      confidence: 0.9,
      candidate_types: [],
    }),
    response({ determined_type: "business_requirement", candidate_types: [] }),
    response({ determined_type: "business_requirement", confidence: 0.9 }),
  ]) {
    assert.throws(() => parseClassification(body), StageError);
  }
});

test("a fenced code block is tolerated", () => {
  const result = parseClassification(
    '```json\n{"determined_type":"job_description","confidence":0.88,"candidate_types":[]}\n```',
  );
  assert.equal(result.determinedType, "job_description");
});
