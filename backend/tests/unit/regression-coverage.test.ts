/**
 * Unit — fragment → case coverage (`docs/12` D-30 decision 3).
 *
 * D-30 targets capture at "the cases whose composition includes the changed
 * fragment", with coverage "computed offline". These assert that the computation
 * is real: it runs against the **committed corpus and the committed recordings**,
 * so a change to either moves the numbers here rather than leaving a stub green.
 *
 * The distinctions under test are the ones that make a coverage result safe to
 * act on: covered versus uncovered versus *undetermined*, and a subset result
 * that cannot be mistaken for the whole corpus.
 *
 * Offline by construction — composition only. No provider, no credential, no
 * network, no spend.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  FragmentResolver,
  ResolvedFragment,
} from "../../src/nie/ports.js";
import { loadCorpus, loadSuiteVersion } from "../../src/regression/corpus.js";
import { createRecordingStore } from "../../src/regression/recording-store.js";
import { computeFragmentCoverage } from "../../src/regression/coverage.js";

/** Resolves any key deterministically — the pipeline-test pattern. */
const resolver: FragmentResolver = {
  resolve: (keys: readonly string[]): Promise<readonly ResolvedFragment[]> =>
    Promise.resolve(
      keys.map((fragmentKey): ResolvedFragment => ({
        fragmentKey,
        fragmentVersionId: `${fragmentKey}@v1`,
        version: "1",
        content: `[${fragmentKey}]`,
      })),
    ),
};

const corpus = loadCorpus();
const suiteVersion = loadSuiteVersion();
const store = createRecordingStore();

const coverageFor = (fragmentKey: string) =>
  computeFragmentCoverage({
    fragmentKey,
    cases: corpus,
    suiteVersion,
    store,
    resolver,
  });

// The 14 committed recordings: 11 `br-*`, 2 `un-*` and `ew-001`. `br-005` halts
// at Stage 3 (`AI §5.4` insufficiency) and the `un-*` cases decline at Stage 1
// (`FR-092`), so the three of them compose fewer stages than the rest.
//
// ⚠️ `ew-001` was ADMITTED 2026-09-09 and is why this is 14 rather than 13. It
// is an `existing_workflow` case, so Stage 6 routes it to `workflow_review` and
// **not** to architecture design (`FR-021` via `AI §7.1`, D-40) — which is why
// it raises the foundation counts but not `ARCHITECTURE_CASES`.
const RECORDED = 14;
const ARCHITECTURE_CASES = 10; // every `br-*` except br-005

// --- a fragment every composition includes -------------------------------

test("a foundation fragment covers every recorded case", async () => {
  const coverage = await coverageFor("foundation.system_frame");

  assert.equal(coverage.coveredCaseIds.length, RECORDED);
  assert.equal(coverage.uncoveredCaseIds.length, 0);
  assert.equal(coverage.determinedCases, RECORDED);
  assert.equal(coverage.corpusSize, corpus.length);
});

// --- a fragment a subset includes ----------------------------------------

test("a stage fragment covers only the cases that reached that stage", async () => {
  const coverage = await coverageFor("stage.architecture_analysis");

  assert.equal(coverage.coveredCaseIds.length, ARCHITECTURE_CASES);
  assert.ok(
    !coverage.coveredCaseIds.includes("br-005"),
    "br-005 halts at Stage 3",
  );
  assert.deepEqual(coverage.uncoveredCaseIds, [
    "br-005",
    // Stage 6 sends an existing_workflow case to workflow_review, never to
    // architecture design (D-40). Its absence here is the routing, not a gap.
    "ew-001",
    "un-001",
    "un-002",
  ]);
  assert.equal(
    coverage.coveredCaseIds.length + coverage.uncoveredCaseIds.length,
    coverage.determinedCases,
    "covered and uncovered partition the determined set exactly",
  );
});

test("a type modifier covers only its own path", async () => {
  const coverage = await coverageFor("type.business_requirement");

  assert.equal(coverage.coveredCaseIds.length, 11);
  assert.deepEqual(
    coverage.uncoveredCaseIds,
    // ⚠️ `ew-001` composes `type.workflow` instead — which is precisely what
    // "only its own path" means. `un-*` decline at Stage 1 (`FR-092`), so no
    // type modifier is ever composed for them.
    ["ew-001", "un-001", "un-002"],
    "a type modifier covers its own type's cases and no others",
  );
});

// --- a fragment no recorded case includes --------------------------------

test("a fragment no case composes covers nothing, and says so", async () => {
  const coverage = await coverageFor("stage.portfolio_suggestions");

  assert.equal(coverage.coveredCaseIds.length, 0);
  assert.equal(coverage.uncoveredCaseIds.length, RECORDED);
  assert.equal(
    coverage.fragmentVersionId,
    undefined,
    "no case resolved it, so no version answered for it",
  );
  assert.equal(coverage.coversEntireCorpus, false);
});

// --- coverage is composition-derived, not path-guessed --------------------

test("coverage reflects the composed set, not assumed path membership", async () => {
  const coverage = await coverageFor("type.job_description");

  // Every `jd-*` case is in the corpus and would compose this fragment — but
  // none has a recording, so none has a composition to inspect. Guessing from
  // `expected_classification` would report ten covered cases on no evidence.
  assert.equal(coverage.coveredCaseIds.length, 0);
  assert.ok(
    coverage.unrecordedCaseIds.some((id) => id.startsWith("jd-")),
    "the jd cases are undetermined, not covered",
  );

  const architecture = await coverageFor("stage.architecture_analysis");
  const br001 = architecture.cases.find((c) => c.caseId === "br-001");
  assert.ok(br001);
  assert.deepEqual(
    br001.stageKeys,
    [
      "input_classification",
      "intent_detection",
      "context_extraction",
      "architecture_analysis",
    ],
    "stage sequence is read from the recording, not inferred from the type",
  );
  assert.ok(br001.fragmentKeys.includes("foundation.provenance_rules"));
  assert.equal(
    br001.corpusVersion,
    "corpus-v1",
    "entry provenance is preserved",
  );
});

// --- a subset result cannot read as suite-wide ---------------------------

test("full recorded coverage is still not entire-corpus coverage", async () => {
  const coverage = await coverageFor("foundation.system_frame");

  assert.equal(
    coverage.coveredCaseIds.length,
    coverage.determinedCases,
    "every determined case is covered",
  );
  assert.equal(
    coverage.coversEntireCorpus,
    false,
    "31 of 44 cases have no recording — this cannot speak for the corpus",
  );
  assert.equal(
    coverage.unrecordedCaseIds.length,
    corpus.length - RECORDED,
    "the undetermined cases are counted, not silently dropped",
  );
  assert.ok(
    coverage.coveredCaseIds.length < coverage.corpusSize,
    "covered count must never be read against the recorded set alone",
  );
});

test("unrecorded cases are undetermined, never counted as uncovered", async () => {
  const coverage = await coverageFor("stage.architecture_analysis");

  for (const id of coverage.unrecordedCaseIds) {
    assert.ok(!coverage.coveredCaseIds.includes(id));
    assert.ok(!coverage.uncoveredCaseIds.includes(id));
  }
  assert.equal(
    coverage.coveredCaseIds.length +
      coverage.uncoveredCaseIds.length +
      coverage.unrecordedCaseIds.length,
    coverage.corpusSize,
    "the three states partition the corpus exactly",
  );
});

// --- determinism ---------------------------------------------------------

test("repeated computation is identical", async () => {
  const a = await coverageFor("stage.context_extraction");
  const b = await coverageFor("stage.context_extraction");

  assert.deepEqual(a, b);
  assert.deepEqual(
    [...a.coveredCaseIds].sort(),
    a.coveredCaseIds,
    "case lists are sorted, so two results compare by value",
  );
});

// --- identity ------------------------------------------------------------

test("the resolved fragment version is recorded for audit", async () => {
  const coverage = await coverageFor("stage.classification");

  assert.equal(coverage.fragmentKey, "stage.classification");
  assert.equal(coverage.fragmentVersionId, "stage.classification@v1");
  assert.equal(coverage.fragmentVersion, "1");
  assert.equal(coverage.fragmentVersion, "1");
  assert.equal(coverage.suiteVersion, suiteVersion);
});
