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

// The 15 committed recordings after the 2026-09-09 admission: 9 `br-*`,
// 2 `un-*`, `ew-001`, `ta-005`, `jd-002` and `jd-008`. `br-005` halts at
// Stage 3 (`AI §5.4`) and the `un-*` cases decline at Stage 1 (`FR-092`), so
// those three compose fewer stages than the rest.
//
// ⚠️ 9 br-* rather than 11: `br-006` and `br-008` were WITHDRAWN, their
// compositions being stale against the candidate and not re-capturable. They
// are unrecorded now, not uncovered — see research/regression-withdrawn/.
const RECORDED = 15;
const ARCHITECTURE_CASES = 9; // every recorded `br-*` except br-005

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
    // The job-description path produces no architecture at all (AI §9.1).
    "jd-002",
    "jd-008",
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

  assert.equal(coverage.coveredCaseIds.length, 9);
  assert.deepEqual(
    coverage.uncoveredCaseIds,
    // ⚠️ Each of these composes its OWN type modifier — `type.workflow`,
    // `type.job_description`, `type.assessment` — which is precisely what
    // "only its own path" means. `un-*` decline at Stage 1 (`FR-092`), so no
    // type modifier is ever composed for them.
    ["ew-001", "jd-002", "jd-008", "ta-005", "un-001", "un-002"],
    "a type modifier covers its own type's cases and no others",
  );
});

// --- a fragment no recorded case includes --------------------------------

test("a fragment no case composes covers nothing, and says so", async () => {
  // ⚠️ A SYNTHETIC KEY, AND THAT IS THE POINT. Until 2026-09-09 this used
  // `stage.portfolio_suggestions`, which no recording composed. Admitting
  // jd-002’s build_first run — the first to reach Stage 9 — covered it, so
  // EVERY authored fragment is now composed by at least one recorded case.
  // The zero-coverage condition still has to be tested, so it is synthesised
  // rather than borrowed from a fragment that no longer has that property.
  const coverage = await coverageFor("foundation.does_not_exist");

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

  // ⚠️ TEN `jd-*` cases are in the corpus and every one would compose this
  // fragment — but only TWO have recordings, so only two have a composition to
  // inspect. Guessing from `expected_classification` would report ten covered
  // cases on the evidence of two.
  assert.deepEqual(
    coverage.coveredCaseIds,
    ["jd-002", "jd-008"],
    "covered means recorded and composed, never merely the right input type",
  );
  assert.ok(
    coverage.unrecordedCaseIds.filter((id) => id.startsWith("jd-")).length ===
      8,
    "the other eight jd cases are undetermined, not covered and not uncovered",
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
