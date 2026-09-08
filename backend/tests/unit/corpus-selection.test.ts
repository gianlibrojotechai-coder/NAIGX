/**
 * Targeted case selection for `regression:run`.
 *
 * ⚠️ THE ASYMMETRY THIS CLOSES COST REAL MONEY. `capture` resolved `--case=`
 * against the whole corpus; `run` selected `FIRST_VERTICAL` unconditionally. So
 * `ew-001` could be captured — and was, for $0.1072 — and then never evaluated,
 * because an `existing_workflow` case with no special class is excluded from
 * that vertical by construction.
 *
 * These assert the selection rule only. `runRegression` is untouched: it always
 * accepted an arbitrary case list, which is why exposing this needed no change
 * to run semantics.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FIRST_VERTICAL,
  loadCorpus,
  selectCases,
  UnknownCaseError,
} from "../../src/regression/corpus.js";

const corpus = loadCorpus();
const firstVertical = FIRST_VERTICAL(corpus);

test("1. no --case leaves the default selection exactly as it was", () => {
  const selected = selectCases(corpus, [], firstVertical);

  // Identity, not merely equality: the default must be handed through
  // untouched so the frozen pass reference still describes the same run.
  assert.equal(selected, firstVertical);
  assert.equal(selected.length, 13);
  assert.ok(
    selected.every(
      (c) => c.inputType === "business_requirement" || c.specialClass !== null,
    ),
  );
});

test("2. --case=ew-001 selects exactly that case, from outside the first vertical", () => {
  // The case the asymmetry stranded. It is in the corpus and not in the
  // default selection — both halves matter.
  assert.ok(corpus.some((c) => c.caseId === "ew-001"));
  assert.ok(!firstVertical.some((c) => c.caseId === "ew-001"));

  const selected = selectCases(corpus, ["ew-001"], firstVertical);

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.caseId, "ew-001");
  assert.equal(selected[0]?.inputType, "existing_workflow");
});

test("3. an unknown case is a clean deterministic error, not an empty run", () => {
  // ⚠️ Filtering a typo down to a smaller set would run a different suite than
  // the operator asked for — and still issue a reference for it.
  let error: UnknownCaseError | undefined;
  try {
    selectCases(corpus, ["no-such-case"], firstVertical);
  } catch (caught) {
    error = caught as UnknownCaseError;
  }

  assert.ok(error instanceof UnknownCaseError, "must throw UnknownCaseError");

  assert.deepEqual(error.unknownIds, ["no-such-case"]);
  assert.match(error.message, /No such corpus case: no-such-case/);
});

test("3b. one unknown id among valid ones still fails, naming only the unknown", () => {
  let error: UnknownCaseError | undefined;
  try {
    selectCases(corpus, ["br-001", "nope", "ew-001"], firstVertical);
  } catch (caught) {
    error = caught as UnknownCaseError;
  }

  assert.ok(error instanceof UnknownCaseError);

  assert.deepEqual(error.unknownIds, ["nope"]);
});

test("4. multiple --case flags select all of them, matching capture's convention", () => {
  const selected = selectCases(corpus, ["br-001", "ew-001"], firstVertical);

  assert.deepEqual(
    selected.map((c) => c.caseId),
    ["br-001", "ew-001"],
  );
});

test("4b. argument order does not change the selection", () => {
  // Corpus order, not argument order: two runs naming the same cases must
  // measure the same thing and therefore share a run id.
  const forwards = selectCases(corpus, ["br-001", "ew-001"], firstVertical);
  const backwards = selectCases(corpus, ["ew-001", "br-001"], firstVertical);

  assert.deepEqual(
    forwards.map((c) => c.caseId),
    backwards.map((c) => c.caseId),
  );
});

test("6. the default selection is unchanged by this feature existing", () => {
  // A guard against the default quietly widening: FIRST_VERTICAL is still
  // business_requirement plus mandatory special classes, and nothing else.
  const ids = firstVertical.map((c) => c.caseId);

  assert.equal(ids.length, 13);
  assert.ok(ids.every((id) => id.startsWith("br-") || id.startsWith("un-")));
  assert.ok(!ids.some((id) => id.startsWith("ew-")));
  assert.ok(!ids.some((id) => id.startsWith("jd-")));
  assert.ok(!ids.some((id) => id.startsWith("ta-")));
});

test("selection returns real frozen corpus cases, not fabricated ones", () => {
  const [selected] = selectCases(corpus, ["ew-001"], firstVertical);
  const fromCorpus = corpus.find((c) => c.caseId === "ew-001");

  assert.equal(selected, fromCorpus, "the same object, not a copy or a stub");
  assert.equal(selected?.corpusVersion, "corpus-v1");
});
