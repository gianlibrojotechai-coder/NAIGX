/**
 * D-91 — the sample-variance policy: samples scoped to one composition,
 * two failures of the last three fail the case, and every recorded failing
 * sample is carried into the reference.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assessVariance,
  type VarianceSample,
} from "../../src/regression/sample-variance.js";

/** The admitted recording composed the sample's fragments and one more stage. */
const ADMITTED = {
  "stage.classification": "v1",
  "stage.intent": "v1",
  "stage.context_extraction": "v1",
};

const sample = (
  overrides: Partial<VarianceSample> & { capturedAt: string },
): VarianceSample => ({
  caseId: "br-004",
  fragments: { "stage.classification": "v1", "stage.intent": "v1" },
  outcome: "failed",
  failure: "Stage 3 judged the input insufficient",
  ruleContradicted:
    "stage.context_extraction: brevity on its own is never a reason to report insufficient (AI §5.4)",
  file: "research/regression-superseded/br-004-x.json",
  ...overrides,
});

test("D-91: an admitted recording with no known composition assesses nothing", () => {
  assert.equal(
    assessVariance("br-004", undefined, "2026-09-10T10:00:00Z", [
      sample({ capturedAt: "2026-09-10T08:00:00Z" }),
    ]),
    undefined,
  );
});

test("D-91: no register entries under the composition means no assessment", () => {
  assert.equal(
    assessVariance("br-004", ADMITTED, "2026-09-10T10:00:00Z", []),
    undefined,
  );
  // A sample under another composition is another prompt's evidence.
  assert.equal(
    assessVariance("br-004", ADMITTED, "2026-09-10T10:00:00Z", [
      sample({
        capturedAt: "2026-09-10T08:00:00Z",
        fragments: { "stage.classification": "v2", "stage.intent": "v1" },
      }),
    ]),
    undefined,
  );
});

test("D-91: one failing sample and a passing admitted recording is variance, not failure", () => {
  const v = assessVariance("br-004", ADMITTED, "2026-09-10T10:00:00Z", [
    sample({ capturedAt: "2026-09-10T08:00:00Z" }),
  ]);
  assert.ok(v);
  assert.equal(v.samples, 2);
  assert.equal(v.failed, 1);
  assert.equal(v.failedOfLastThree, 1);
  assert.equal(v.failing, false);
  assert.deepEqual(v.rulesContradicted, [
    "stage.context_extraction: brevity on its own is never a reason to report insufficient (AI §5.4)",
  ]);
});

test("D-91: two failures among the last three samples fail the case whatever the latest says", () => {
  const v = assessVariance("br-004", ADMITTED, "2026-09-10T10:00:00Z", [
    sample({ capturedAt: "2026-09-10T08:00:00Z" }),
    sample({ capturedAt: "2026-09-10T09:00:00Z" }),
  ]);
  assert.ok(v);
  assert.equal(v.failedOfLastThree, 2);
  assert.equal(v.failing, true);
});

test("D-91: the window is the last three by capture time — old failures age out, recent ones do not", () => {
  const aged = assessVariance("br-004", ADMITTED, "2026-09-10T12:00:00Z", [
    sample({ capturedAt: "2026-09-10T07:00:00Z" }),
    sample({ capturedAt: "2026-09-10T08:00:00Z" }),
    sample({
      capturedAt: "2026-09-10T09:00:00Z",
      outcome: "passed",
      failure: "",
      ruleContradicted: "",
    }),
    sample({
      capturedAt: "2026-09-10T10:00:00Z",
      outcome: "passed",
      failure: "",
      ruleContradicted: "",
    }),
  ]);
  assert.ok(aged);
  assert.equal(aged.failed, 2, "history is kept");
  assert.equal(aged.failedOfLastThree, 0, "but the window has moved on");
  assert.equal(aged.failing, false);
});
