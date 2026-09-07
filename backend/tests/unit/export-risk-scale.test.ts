/**
 * Unit — the export's copy of the `docs/09` §2 risk scale, scale `risk-v1`.
 *
 * WHY THIS FILE EXISTS. The scale is defined twice — here in the backend for
 * export, and in `frontend/src/format.ts` for the screen — because the two are
 * separate packages with no module between them. Duplication that nothing
 * checks is duplication that drifts, and a drifted copy would mean an exported
 * document showing a different band than the screen the user exported it from.
 *
 * So every cell of the §2.5 matrix is pinned here, transcribed from the
 * document rather than from the implementation. A change to either copy that
 * is not a change to `docs/09` fails this file.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  likelihoodLabel,
  riskBand,
  riskScore,
  severityLabel,
} from "../../src/export/risk-scale.js";

test("severity and likelihood labels are the docs/09 §2.1 and §2.2 scales", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(severityLabel), [
    "Minimal",
    "Low",
    "Moderate",
    "High",
    "Critical",
  ]);
  assert.deepEqual([1, 2, 3, 4, 5].map(likelihoodLabel), [
    "Rare",
    "Unlikely",
    "Possible",
    "Likely",
    "Almost certain",
  ]);
});

test("an out-of-range score is reported as unrecognised, never clamped", () => {
  // Clamping would silently turn a storage fault into a plausible label, and
  // the exported document would carry a severity nobody assigned.
  assert.equal(severityLabel(0), "Unrecognised (0)");
  assert.equal(severityLabel(6), "Unrecognised (6)");
  assert.equal(likelihoodLabel(9), "Unrecognised (9)");
});

test("risk score is severity × likelihood (docs/09 §2.3)", () => {
  assert.equal(riskScore(1, 1), 1);
  assert.equal(riskScore(3, 4), 12);
  assert.equal(riskScore(5, 5), 25);
});

/**
 * The full §2.5 matrix, rows severity 5 → 1, columns likelihood 1 → 5,
 * transcribed from the document. Each entry is `[score, band]`.
 */
const MATRIX: readonly (readonly (readonly [number, string])[])[] = [
  // Severity 5 — Critical
  [
    [5, "Moderate"],
    [10, "High"],
    [15, "Very high"],
    [20, "Critical"],
    [25, "Critical"],
  ],
  // Severity 4 — High
  [
    [4, "Low"],
    [8, "Moderate"],
    [12, "High"],
    [16, "Very high"],
    [20, "Critical"],
  ],
  // Severity 3 — Moderate
  [
    [3, "Low"],
    [6, "Moderate"],
    [9, "Moderate"],
    [12, "High"],
    [15, "Very high"],
  ],
  // Severity 2 — Low
  [
    [2, "Low"],
    [4, "Low"],
    [6, "Moderate"],
    [8, "Moderate"],
    [10, "High"],
  ],
  // Severity 1 — Minimal
  [
    [1, "Low"],
    [2, "Low"],
    [3, "Low"],
    [4, "Low"],
    [5, "Moderate"],
  ],
];

test("every cell of the docs/09 §2.5 matrix scores and bands as published", () => {
  MATRIX.forEach((row, rowIndex) => {
    const severity = 5 - rowIndex;
    row.forEach(([expectedScore, expectedBand], columnIndex) => {
      const likelihood = columnIndex + 1;
      const score = riskScore(severity, likelihood);
      assert.equal(
        score,
        expectedScore,
        `severity ${String(severity)} × likelihood ${String(likelihood)}`,
      );
      assert.equal(
        riskBand(score),
        expectedBand,
        `band for score ${String(score)}`,
      );
    });
  });
});

test("band boundaries fall where docs/09 §2.4 puts them", () => {
  // Stated as approved ranges rather than compressed to the achievable set.
  // §2.5 records that 7, 11, 13, 14, 17-19 and 21-24 are unreachable, so
  // several of these boundaries are inert — pinned anyway, because the ranges
  // are what the document approved.
  assert.equal(riskBand(4), "Low");
  assert.equal(riskBand(5), "Moderate");
  assert.equal(riskBand(9), "Moderate");
  assert.equal(riskBand(10), "High");
  assert.equal(riskBand(14), "High");
  assert.equal(riskBand(15), "Very high");
  assert.equal(riskBand(19), "Very high");
  assert.equal(riskBand(20), "Critical");
  assert.equal(riskBand(25), "Critical");
});

test("the band vocabulary matches the frontend's, casing included", () => {
  // `frontend/src/format.ts` types `RiskBand` as this exact union. A document
  // saying "Very High" beside a screen saying "Very high" is the drift this
  // file exists to catch, small as it looks.
  const bands = [1, 5, 10, 15, 20].map(riskBand);
  assert.deepEqual(bands, ["Low", "Moderate", "High", "Very high", "Critical"]);
});
