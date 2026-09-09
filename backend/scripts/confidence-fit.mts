/**
 * Confidence calibration — fit the v1 model's two weights and two thresholds
 * against the corpus's frozen band labels (D-31 decision 6, D-86).
 *
 *   npm run confidence:fit            fit and print
 *   npm run confidence:fit -- --write  also write research/confidence-calibration/fit.md and model.json
 *
 * Reads `research/confidence-calibration/features.json` (written by
 * `confidence:features -- --write`). Applies the ratified rules before the
 * weighted base — a halted or artifact-less analysis is `low` (D-31 decision
 * 1: `insufficient` sufficiency, `unsupported` classification), a flagged
 * conflict caps at `medium` (decision 2) — then grid-searches the clarity
 * weight (CF-2; CF-4 takes the rest) and the two thresholds for the highest
 * accuracy over the cases the weighted base decides, breaking ties by the
 * widest margin between the classes at each threshold. FITTED, NOT CHOSEN:
 * the fit is reproducible from the features file, and the record carries
 * the confusion matrix so the reader sees what the model gets wrong.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Row {
  readonly caseId: string;
  readonly band: string;
  readonly cf2: number | null;
  readonly cf4: number | null;
  readonly conflicts: number;
  readonly sufficiency: string | null;
}

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const DIR = path.join(ROOT, "research", "confidence-calibration");
const rows = JSON.parse(
  fs.readFileSync(path.join(DIR, "features.json"), "utf8"),
) as Row[];

// Cases the rules decide without the weighted base.
const ruled = rows.filter(
  (r) =>
    r.sufficiency === null ||
    r.sufficiency === "insufficient" ||
    r.caseId.startsWith("un-"),
);
const weighted = rows.filter(
  (r) => !ruled.includes(r) && r.cf2 !== null && r.cf4 !== null,
);

// The pipeline rounds the base score to three decimals before comparing it
// with the thresholds (`baseScore` in the stage module); the fit must too, or
// a case on the boundary is classified differently by the two.
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const score = (r: Row, w: number): number =>
  round3(w * (r.cf2 ?? 0) + (1 - w) * (r.cf4 ?? 0));
const bandOf = (s: number, hi: number, med: number): string =>
  s >= hi ? "high" : s >= med ? "medium" : "low";
const predict = (r: Row, w: number, hi: number, med: number): string => {
  const base = bandOf(score(r, w), hi, med);
  return r.conflicts > 0 && base === "high" ? "medium" : base;
};

let best: {
  w: number;
  hi: number;
  med: number;
  correct: number;
  margin: number;
} | null = null;
for (let w = 0; w <= 1.0001; w += 0.05) {
  const scores = weighted
    .map((r) => ({ r, s: score(r, w) }))
    .sort((a, b) => a.s - b.s);
  const candidates = [
    ...new Set(scores.map((x) => Math.round(x.s * 1000) / 1000)),
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i; j < candidates.length; j += 1) {
      const med = candidates[i] as number;
      const hi = candidates[j] as number;
      const correct = weighted.filter(
        (r) => predict(r, w, hi, med) === r.band,
      ).length;
      // margin: distance from each threshold to the nearest score on either side
      const near = (t: number): number =>
        Math.min(
          ...scores.map((x) => Math.abs(x.s - t)).filter((d) => d > 1e-9),
          1,
        );
      const margin = Math.min(near(hi), near(med));
      if (
        best === null ||
        correct > best.correct ||
        (correct === best.correct && margin > best.margin)
      ) {
        best = { w: Math.round(w * 100) / 100, hi, med, correct, margin };
      }
    }
  }
}
if (best === null) throw new Error("no weighted cases to fit against");

const model = {
  version: "confidence-v1",
  clarityWeight: best.w,
  highThreshold: best.hi,
  mediumThreshold: best.med,
  fittedAgainst: `${String(weighted.length)} corpus cases with measured Stage 3 features (${String(ruled.length)} more decided by rule), ${new Date().toISOString().slice(0, 10)}`,
};

const confusion: Record<string, Record<string, number>> = {};
const lines: string[] = [
  "| Case | Band | CF-2 | CF-4 | Conflicts | Score | Predicted | |",
  "|---|---|---|---|---|---|---|---|",
];
let allCorrect = 0;
for (const r of rows) {
  let predicted: string;
  if (ruled.includes(r)) predicted = "low";
  else if (r.cf2 === null || r.cf4 === null) predicted = "low";
  else predicted = predict(r, best.w, best.hi, best.med);
  confusion[r.band] = confusion[r.band] ?? {};
  confusion[r.band]![predicted] = (confusion[r.band]![predicted] ?? 0) + 1;
  const ok = predicted === r.band;
  if (ok) allCorrect += 1;
  lines.push(
    `| ${r.caseId} | ${r.band} | ${r.cf2 === null ? "—" : r.cf2.toFixed(3)} | ${r.cf4 === null ? "—" : r.cf4.toFixed(3)} | ${String(r.conflicts)} | ${r.cf2 === null || r.cf4 === null ? "—" : score(r, best.w).toFixed(3)} | ${predicted} | ${ok ? "✓" : "✗"} |`,
  );
}

const summary = [
  `**Model:** clarity weight ${String(best.w)} (CF-2), evidence weight ${String(Math.round((1 - best.w) * 100) / 100)} (CF-4); high at ≥ ${String(best.hi)}, medium at ≥ ${String(best.med)}, low below.`,
  `**Fit:** ${String(best.correct)} of ${String(weighted.length)} weighted cases reproduced; ${String(allCorrect)} of ${String(rows.length)} corpus cases overall with the rules applied (margin ${best.margin.toFixed(3)}).`,
  "",
  "| Frozen \\ Predicted | high | medium | low |",
  "|---|---|---|---|",
  ...["high", "medium", "low"].map(
    (b) =>
      `| ${b} | ${String(confusion[b]?.["high"] ?? 0)} | ${String(confusion[b]?.["medium"] ?? 0)} | ${String(confusion[b]?.["low"] ?? 0)} |`,
  ),
];
console.log(summary.join("\n"));
console.log("");
console.log(lines.join("\n"));

if (process.argv.includes("--write")) {
  fs.writeFileSync(
    path.join(DIR, "model.json"),
    JSON.stringify(model, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(DIR, "fit.md"),
    `# Confidence calibration — the v1 fit\n\nGenerated by \`npm run confidence:fit -- --write\` on ${new Date().toISOString().slice(0, 10)} from \`features.json\`. Rules applied before the weighted base: no artifact → low (D-31 decision 1); conflict → cap at medium (decision 2). The weight and thresholds are the grid search's best accuracy, ties broken by margin.\n\n${summary.join("\n")}\n\n${lines.join("\n")}\n`,
  );
  console.log(`\nwritten to ${DIR}`);
}
