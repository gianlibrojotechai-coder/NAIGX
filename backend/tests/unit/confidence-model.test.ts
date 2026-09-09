/**
 * Unit — the v1 confidence model's constants are the fitted ones (D-86 §2).
 *
 * `research/confidence-calibration/model.json` is what `confidence:fit`
 * wrote from the corpus's frozen labels; `CONFIDENCE_MODEL_V1` is the copy
 * the pipeline runs. FITTED, NOT CHOSEN means the two cannot drift apart
 * unnoticed, and this is the notice.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CONFIDENCE_MODEL_V1 } from "../../src/nie/confidence-model.js";

const MODEL_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "research",
  "confidence-calibration",
  "model.json",
);

test("the pipeline's model is the fitted model, parameter for parameter", () => {
  const fitted = JSON.parse(fs.readFileSync(MODEL_FILE, "utf8")) as Record<
    string,
    unknown
  >;
  assert.equal(CONFIDENCE_MODEL_V1.version, fitted["version"]);
  assert.equal(CONFIDENCE_MODEL_V1.clarityWeight, fitted["clarityWeight"]);
  assert.equal(CONFIDENCE_MODEL_V1.highThreshold, fitted["highThreshold"]);
  assert.equal(CONFIDENCE_MODEL_V1.mediumThreshold, fitted["mediumThreshold"]);
  assert.equal(CONFIDENCE_MODEL_V1.fittedAgainst, fitted["fittedAgainst"]);
});

test("the thresholds are ordered and the weight is a share", () => {
  assert.ok(
    CONFIDENCE_MODEL_V1.highThreshold >= CONFIDENCE_MODEL_V1.mediumThreshold,
  );
  assert.ok(
    CONFIDENCE_MODEL_V1.clarityWeight >= 0 &&
      CONFIDENCE_MODEL_V1.clarityWeight <= 1,
  );
});
