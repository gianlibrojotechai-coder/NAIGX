/**
 * Unit — what a pass reference says about its own selection and composition
 * ([D-64](../../../docs/39-D-64-Pass-Reference-Composition-Contract.md) §4.1,
 * §4.4; `docs/12` D-30 dec. 3).
 *
 * ⚠️ A REFERENCE MUST NEVER READ AS MORE THAN IT IS. `selectionScope` is the
 * field a future reader uses to decide how much a reference proves, and D-30
 * dec. 3 draws the line at *why* the cases were selected: `targeted` means they
 * ran BECAUSE they compose a named fragment, with the coverage computed
 * offline. An operator naming ids has proved no such thing, so that stays
 * `partial` however small the selection.
 *
 * No database, no provider, no writes.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPassReference,
  FRAGMENT_RESOLUTIONS,
} from "../../src/regression/pass-reference.js";
import type { RegressionReport } from "../../src/regression/runner.js";
import type { FragmentCoverage } from "../../src/regression/coverage.js";

type Resolution = (typeof FRAGMENT_RESOLUTIONS)[number];

const caseOutcome = (caseId: string, fragmentResolution: Resolution) => ({
  caseId,
  status: "passed",
  assertions: [],
  assertionsEvaluated: ["classification"],
  detail: "",
  evidence: {
    recordingHash: "a".repeat(64),
    capturedAt: "2026-09-08T00:00:00.000Z",
    fragmentsCompositionHash: `${fragmentResolution}-composition`,
    fragmentResolution,
  },
});

const reportOf = (
  cases: readonly ReturnType<typeof caseOutcome>[],
): RegressionReport =>
  ({
    suiteVersion: "corpus-v2",
    mode: "recorded",
    startedAt: "2026-09-08T00:00:00.000Z",
    cases,
    totals: {
      selected: cases.length,
      passed: cases.length,
      failed: 0,
      conflict: 0,
      blocked: 0,
      stale: 0,
      errored: 0,
    },
  }) as unknown as RegressionReport;

const coverage: FragmentCoverage = {
  fragmentKey: "stage.workflow_review",
  coveredCaseIds: ["ew-001"],
  uncoveredCaseIds: [],
  unrecordedCaseIds: [],
  cases: [],
} as unknown as FragmentCoverage;

// --- selection scope ------------------------------------------------------

test("a fragment-targeted run reports `targeted` and names its coverage", () => {
  const reference = buildPassReference({
    report: reportOf([caseOutcome("ew-001", "authored")]),
    fragmentsManifestVersion: "fragments-v1",
    coverage,
    corpusSize: 44,
  });

  assert.equal(reference?.selectionScope, "targeted");
  assert.equal(reference?.coverage?.fragmentKey, "stage.workflow_review");
});

test("a case-named run stays `partial`, however few cases it selected", () => {
  // ⚠️ D-64 §4.4. One case, no coverage basis — indistinguishable in size from
  // the targeted run above and entirely different in what it proves.
  const reference = buildPassReference({
    report: reportOf([caseOutcome("ew-001", "authored")]),
    fragmentsManifestVersion: "fragments-v1",
    corpusSize: 44,
  });

  assert.equal(reference?.selectionScope, "partial");
  assert.equal(reference?.coverage, undefined);
});

test("the default FIRST_VERTICAL selection is unchanged: 13 of 44 is `partial`", () => {
  const cases = [
    "br-001",
    "br-002",
    "br-003",
    "br-004",
    "br-005",
    "br-006",
    "br-007",
    "br-008",
    "br-009",
    "br-010",
    "br-011",
    "un-001",
    "un-002",
  ].map((id) => caseOutcome(id, "active"));

  const reference = buildPassReference({
    report: reportOf(cases),
    fragmentsManifestVersion: "fragments-v1",
    corpusSize: 44,
  });

  assert.equal(reference?.selectionScope, "partial");
  assert.equal(reference?.cases.length, 13);
  assert.equal(reference?.fragmentResolution, "active");
});

test("a run over the whole corpus reports `entire_corpus`", () => {
  const cases = Array.from({ length: 3 }, (_, i) =>
    caseOutcome(`c-${String(i)}`, "active"),
  );

  const reference = buildPassReference({
    report: reportOf(cases),
    fragmentsManifestVersion: "fragments-v1",
    corpusSize: 3,
  });

  assert.equal(reference?.selectionScope, "entire_corpus");
});

// --- resolution is derived, and can be mixed ------------------------------

test("a run whose cases resolved differently is reported as `mixed`", () => {
  // ⚠️ THE ew-001 SUITE SHAPE. Thirteen legacy recordings replay active, one
  // replays authored. A single scalar cannot describe that, and the honest
  // answer is neither of the two it is built from.
  const reference = buildPassReference({
    report: reportOf([
      caseOutcome("br-001", "active"),
      caseOutcome("ew-001", "authored"),
    ]),
    fragmentsManifestVersion: "fragments-v1",
  });

  assert.equal(reference?.fragmentResolution, "mixed");
  assert.match(reference?.attests ?? "", /MIXED/);
  assert.match(reference?.attests ?? "", /per-case/);
  // D-24 dec. 3's caveat must survive the added clause.
  assert.match(
    reference?.attests ?? "",
    /NOT evidence that the current prompt/,
  );
});

test("every case carries its own resolution, not the run's summary", () => {
  const reference = buildPassReference({
    report: reportOf([
      caseOutcome("br-001", "active"),
      caseOutcome("ew-001", "authored"),
    ]),
    fragmentsManifestVersion: "fragments-v1",
  });

  assert.deepEqual(
    reference?.cases.map((c) => [c.caseId, c.fragmentResolution]),
    [
      ["br-001", "active"],
      ["ew-001", "authored"],
    ],
  );
});

test("a uniformly authored run is not reported as mixed", () => {
  const reference = buildPassReference({
    report: reportOf([
      caseOutcome("ew-001", "authored"),
      caseOutcome("ew-002", "authored"),
    ]),
    fragmentsManifestVersion: "fragments-v1",
  });

  assert.equal(reference?.fragmentResolution, "authored");
  assert.match(reference?.attests ?? "", /AUTHORED/);
});
