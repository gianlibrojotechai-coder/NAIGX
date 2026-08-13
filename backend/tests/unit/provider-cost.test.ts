/**
 * Unit — usage cost accounting (`docs/12` D-4, `SA §3.5`, `NFR-083`).
 *
 * The decisive property is precision: per-invocation costs sit far below one
 * cent, so a calculation that loses sub-cent detail records zero and makes the
 * unit economics `TV-4` depends on silently wrong.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  COST_SCALE,
  computeEstimatedCostUsd,
  formatUsd,
  parseUsd,
  rateFor,
  type TokenRate,
} from "../../src/provider/cost.js";

/** Rates in the shape providers publish them: USD per million tokens. */
const rate: TokenRate = {
  inputUsdPerMillionTokens: "3.00",
  outputUsdPerMillionTokens: "15.00",
};

test("carries at least the six decimal places D-4 requires", () => {
  assert.ok(COST_SCALE >= 6);
});

test("computes cost from token counts against the configured rate", () => {
  // 1000 × $3/M = $0.003 ; 500 × $15/M = $0.0075 ; total $0.0105
  assert.equal(
    computeEstimatedCostUsd({ inputTokens: 1000, outputTokens: 500 }, rate),
    "0.01050000",
  );
});

test("a single token retains sub-cent precision instead of rounding to zero", () => {
  // $3 per million = $0.000003 for one token. Rounded to cents this is $0.00,
  // which is exactly the failure D-4's precision requirement exists to prevent.
  const cost = computeEstimatedCostUsd(
    { inputTokens: 1, outputTokens: 0 },
    rate,
  );
  assert.equal(cost, "0.00000300");
  assert.notEqual(Number(cost), 0);
});

test("zero usage costs zero, not a rounding artefact", () => {
  assert.equal(
    computeEstimatedCostUsd({ inputTokens: 0, outputTokens: 0 }, rate),
    "0.00000000",
  );
});

test("arithmetic is exact where binary floating point is not", () => {
  // 0.1 + 0.2 !== 0.3 in IEEE-754. The same shape of sum must be exact here.
  const tenth: TokenRate = {
    inputUsdPerMillionTokens: "0.1",
    outputUsdPerMillionTokens: "0.2",
  };
  assert.equal(
    computeEstimatedCostUsd(
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      tenth,
    ),
    "0.30000000",
  );
});

test("large volumes do not lose precision", () => {
  const cost = computeEstimatedCostUsd(
    { inputTokens: 12_345_678, outputTokens: 87_654_321 },
    rate,
  );
  // 12.345678 × 3 = 37.037034 ; 87.654321 × 15 = 1314.814815
  assert.equal(cost, "1351.85184900");
});

test("input and output are rounded independently, matching an invoice", () => {
  const odd: TokenRate = {
    inputUsdPerMillionTokens: "1",
    outputUsdPerMillionTokens: "1",
  };
  // 1 token at $1/M = $0.000001 exactly; two such lines sum to $0.000002.
  assert.equal(
    computeEstimatedCostUsd({ inputTokens: 1, outputTokens: 1 }, odd),
    "0.00000200",
  );
});

test("parseUsd and formatUsd round-trip a scaled value", () => {
  for (const value of ["0", "0.00000001", "3.5", "1351.851849"]) {
    assert.equal(Number(formatUsd(parseUsd(value))), Number(value));
  }
});

test("a malformed rate fails loudly rather than costing nothing", () => {
  for (const bad of ["", "abc", "-1", "1.2.3", "$3.00", "1e6"]) {
    assert.throws(
      () => parseUsd(bad),
      RangeError,
      `expected "${bad}" to be rejected`,
    );
  }
});

test("a negative or fractional token count is rejected", () => {
  assert.throws(
    () => computeEstimatedCostUsd({ inputTokens: -1, outputTokens: 0 }, rate),
    RangeError,
  );
  assert.throws(
    () => computeEstimatedCostUsd({ inputTokens: 1.5, outputTokens: 0 }, rate),
    RangeError,
  );
});

test("an unpriced model is a configuration error, not a free model", () => {
  const table = { "model-a": rate };
  assert.deepEqual(rateFor(table, "model-a"), rate);
  assert.throws(
    () => rateFor(table, "model-b"),
    (error: Error) =>
      error instanceof RangeError && error.message.includes("model-b"),
  );
});
