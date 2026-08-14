/**
 * Unit — the `corpus-v1` loader (`docs/11`, `AI §12.2`).
 *
 * Two things are asserted: that the frozen corpus loads in full, and that a
 * malformed case **fails** rather than loading with a missing expectation. The
 * second matters more. A loader that quietly drops a field turns an oracle into
 * a weaker oracle, which is the corpus drifting to match the system — the
 * failure `AI §12.2` exists to prevent.
 *
 * Reads the real corpus and nothing else. No database, no provider, no network.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CorpusCaseError,
  FIRST_VERTICAL,
  loadCorpus,
  parseCorpusCase,
} from "../../src/regression/corpus.js";

const corpus = loadCorpus();

const VALID = `case_id: xx-001
input_type: business_requirement
content: |
  Twelve chars
character_count: 12
expected_classification: business_requirement
expected_artifact_set:
  - business_analysis
expected_omissions:
  - artifact_type: executive_summary
    reason: P1, excluded from v1.0
expected_confidence_band: high
expected_classification_confidence:
  bound: at_or_above_threshold
  threshold: 0.6
  rationale: No competing signal.
case_character: central
special_class: null
rationale: Baseline.
provenance:
  origin: synthetic
added: 2026-08-12
frozen_at: 2026-08-12T07:52:30Z
corpus_version: corpus-v1
`;

// --- the frozen corpus loads --------------------------------------------

test("every corpus case loads and validates", () => {
  assert.equal(corpus.length, 44, "corpus-v1 is 44 cases (docs/12 D-6)");
  assert.ok(corpus.every((c) => c.corpusVersion === "corpus-v1"));
  assert.ok(
    corpus.every((c) => c.inputText.length === c.characterCount),
    "character_count matches the text FR-002 bounds",
  );
  assert.ok(
    corpus.every((c) => c.rationale.length > 0),
    "docs/11 §4.2 — every case records why its expectations are correct",
  );
});

test("the block-scalar trailing newline is excluded, per docs/11 §7.2", () => {
  const br001 = corpus.find((c) => c.caseId === "br-001");
  assert.ok(br001);
  assert.equal(br001.characterCount, 1637);
  assert.equal(br001.inputText.length, 1637);
  assert.ok(!br001.inputText.endsWith("\n"));
});

test("nested expectations are parsed, not scraped", () => {
  const br001 = corpus.find((c) => c.caseId === "br-001");
  assert.ok(br001);
  assert.deepEqual(
    br001.expectedClassificationConfidence.bound,
    "at_or_above_threshold",
  );
  assert.equal(br001.expectedClassificationConfidence.threshold, 0.6);
  assert.equal(br001.expectedConfidenceBand, "high");
  assert.ok(br001.expectedArtifactSet.includes("architecture_recommendation"));
  assert.ok(
    br001.expectedOmissions.every((o) => o.reason.length > 0),
    "an omission without a reason cannot be reviewed",
  );
});

test("the four mandatory special classes are all present (docs/11 §3)", () => {
  const classes = new Set(
    corpus.map((c) => c.specialClass).filter((s) => s !== null),
  );
  assert.deepEqual([...classes].sort(), [
    "contradiction",
    "do-not-automate",
    "insufficient",
    "unsupported",
  ]);
});

test("the first vertical is the business-requirement path plus the special cases", () => {
  const selected = FIRST_VERTICAL(corpus);
  const ids = selected.map((c) => c.caseId);

  assert.ok(ids.includes("br-001"), "the exemplar case");
  assert.ok(ids.includes("un-001"), "an unsupported refusal case");
  assert.ok(ids.includes("br-005"), "the insufficiency case");
  assert.equal(
    new Set(ids).size,
    ids.length,
    "a case appearing in both filters is selected once",
  );
  assert.ok(
    selected.every(
      (c) => c.inputType === "business_requirement" || c.specialClass !== null,
    ),
  );
});

// --- a bad case fails ----------------------------------------------------

test("a well-formed fixture parses", () => {
  const parsed = parseCorpusCase(VALID, "fixture.yaml");
  assert.equal(parsed.caseId, "xx-001");
  assert.equal(parsed.inputText, "Twelve chars");
  assert.equal(parsed.specialClass, null);
});

test("malformed cases are rejected rather than half-loaded", () => {
  const cases: readonly [string, string][] = [
    ["not YAML at all", ":\n  - ["],
    ["a missing case_id", VALID.replace("case_id: xx-001\n", "")],
    [
      "a classification outside FR-011",
      VALID.replace(
        "expected_classification: business_requirement",
        "expected_classification: mixed",
      ),
    ],
    [
      "a confidence bound outside docs/11 §4.4",
      VALID.replace("bound: at_or_above_threshold", "bound: probably_fine"),
    ],
    [
      "a character_count that disagrees with the content",
      VALID.replace("character_count: 12", "character_count: 999"),
    ],
    [
      "an unknown special class",
      VALID.replace("special_class: null", "special_class: interesting"),
    ],
    ["a missing rationale", VALID.replace("rationale: Baseline.\n", "")],
    [
      "an omission with no reason",
      VALID.replace("    reason: P1, excluded from v1.0\n", ""),
    ],
  ];

  for (const [label, text] of cases) {
    assert.throws(
      () => parseCorpusCase(text, "fixture.yaml"),
      CorpusCaseError,
      `${label} must be rejected`,
    );
  }
});

test("CRLF and LF checkouts agree", () => {
  const lf = parseCorpusCase(VALID, "fixture.yaml");
  const crlf = parseCorpusCase(VALID.replace(/\n/g, "\r\n"), "fixture.yaml");
  assert.equal(crlf.inputText, lf.inputText);
  assert.equal(crlf.characterCount, lf.characterCount);
});
