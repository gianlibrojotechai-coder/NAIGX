/**
 * M-10 — classification accuracy on the golden corpus, measured offline.
 *
 *   npm run measure:classification
 *
 * Reads the Stage 1 answer on record for every corpus case — the canonical
 * recordings (`research/regression-recordings`) and the Stage 1–3
 * calibration captures (`research/confidence-calibration/stage3`) — and
 * compares each with the case's frozen `expected_classification` and its
 * frozen confidence bound. Prints the per-type table, every mismatch, the
 * bound mismatches and every case, with the model and capture date each
 * answer came from, so the aggregate's provenance is on the page. No
 * provider call, no spend, nothing written; `research/m10-classification-
 * measurement.md` is regenerated from this output.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpus } from "../src/regression/corpus.js";
import { parseClassification } from "../src/nie/stages/classification.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const SOURCES = [
  {
    name: "canonical",
    dir: path.join(ROOT, "research/regression-recordings/corpus-v1"),
  },
  {
    name: "stage3",
    dir: path.join(ROOT, "research/confidence-calibration/stage3/corpus-v1"),
  },
];

interface Row {
  caseId: string;
  frozen: string;
  determined: string;
  confidence: number;
  bound: string;
  boundMet: boolean;
  source: string;
  model: string;
  captured: string;
}

const rows: Row[] = [];
const unrecorded: string[] = [];
for (const c of [...loadCorpus()].sort((a, b) =>
  a.caseId.localeCompare(b.caseId),
)) {
  let found = false;
  for (const s of SOURCES) {
    const f = path.join(s.dir, `${c.caseId}.json`);
    if (!fs.existsSync(f)) continue;
    const rec = JSON.parse(fs.readFileSync(f, "utf8")) as {
      capturedAt: string;
      provider?: { modelKey?: string };
      stages: { stageKey: string; output: string }[];
    };
    const s1 = rec.stages.find((st) => st.stageKey === "input_classification");
    if (s1 === undefined) continue;
    const parsed = parseClassification(s1.output);
    const { bound, threshold } = c.expectedClassificationConfidence;
    const boundMet =
      bound === "below_threshold"
        ? parsed.confidence < threshold
        : parsed.confidence >= threshold;
    rows.push({
      caseId: c.caseId,
      frozen: c.expectedClassification,
      determined: parsed.determinedType,
      confidence: parsed.confidence,
      bound:
        bound === "below_threshold"
          ? `< ${String(threshold)}`
          : `≥ ${String(threshold)}`,
      boundMet,
      source: s.name,
      model: rec.provider?.modelKey ?? "unknown",
      captured: rec.capturedAt.slice(0, 10),
    });
    found = true;
    break;
  }
  if (!found) unrecorded.push(c.caseId);
}

const types = [...new Set(rows.map((r) => r.frozen))].sort();
const correct = rows.filter((r) => r.frozen === r.determined);
const pct = (n: number, d: number) =>
  d === 0 ? "—" : `${((100 * n) / d).toFixed(1)} %`;

console.log("## Per frozen type\n");
console.log("| Type | Correct | Cases | Accuracy |");
console.log("|---|---|---|---|");
for (const t of types) {
  const cases = rows.filter((r) => r.frozen === t);
  const ok = cases.filter((r) => r.determined === t);
  console.log(
    `| ${t} | ${String(ok.length)} | ${String(cases.length)} | ${pct(ok.length, cases.length)} |`,
  );
}
console.log(
  `| **All** | **${String(correct.length)}** | **${String(rows.length)}** | **${pct(correct.length, rows.length)}** |`,
);
if (unrecorded.length > 0)
  console.log(
    `\nUnrecorded (no Stage 1 answer on file): ${unrecorded.join(", ")}`,
  );

const models = new Map<string, number>();
for (const r of rows) models.set(r.model, (models.get(r.model) ?? 0) + 1);
console.log(
  `\nModels: ${[...models.entries()].map(([m, n]) => `${m} (${String(n)})`).join(", ")}`,
);

console.log("\n## Every mismatch\n");
console.log("| Case | Frozen | Determined | Confidence | Source | Captured |");
console.log("|---|---|---|---|---|---|");
for (const r of rows.filter((x) => x.frozen !== x.determined)) {
  console.log(
    `| ${r.caseId} | ${r.frozen} | ${r.determined} | ${String(r.confidence)} | ${r.source} | ${r.captured} |`,
  );
}

const boundMisses = rows.filter((r) => !r.boundMet);
console.log(
  `\n## Confidence-bound expectations: ${String(rows.length - boundMisses.length)} of ${String(rows.length)} agree\n`,
);
for (const r of boundMisses) {
  console.log(
    `- ${r.caseId}: expected ${r.bound}, got ${String(r.confidence)}${r.frozen !== r.determined ? " (and misclassified)" : ""}`,
  );
}

console.log("\n## Every case\n");
console.log(
  "| Case | Frozen type | Determined | Confidence | Frozen bound | Bound met | Source | Model | Captured |",
);
console.log("|---|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  const det = r.frozen === r.determined ? r.determined : `**${r.determined}**`;
  console.log(
    `| ${r.caseId} | ${r.frozen} | ${det} | ${r.confidence.toFixed(2)} | ${r.bound} | ${r.boundMet ? "yes" : "**no**"} | ${r.source} | ${r.model} | ${r.captured} |`,
  );
}
