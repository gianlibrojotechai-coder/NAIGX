/**
 * Confidence features — the Stage 3 measurements CF-2 and CF-4 are computed
 * from (`AI §8.2`), for every corpus case that has a Stage 3 answer on
 * record, paired with its frozen band (D-86, closing D-33 §3).
 *
 *   npm run confidence:features            print the table
 *   npm run confidence:features -- --write  also write research/confidence-calibration/features.json and .md
 *
 * Sources, in order: the canonical recordings (`research/regression-recordings`)
 * and the Stage 1–3 feature captures (`research/confidence-calibration/stage3`,
 * written by `regression:capture --through=3 --out=…`). A case in both is read
 * from the canonical store. No provider, no spend.
 *
 * Definitions — the ones D-33 computed and tabulated, restated so the fit is
 * reproducible:
 *   · CF-2 (requirement clarity): stated ÷ (stated + inferred) over the
 *     context elements; unknowns are not in the ratio.
 *   · CF-4 (evidence quality): mean `specificity_score` of the `stated`
 *     elements; null when there are none.
 *   · conflicts: elements carrying `conflicts_with_index`.
 *   · sufficiency: Stage 3's own judgement.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpus, CORPUS_ROOT } from "../src/regression/corpus.js";
import { parseContext } from "../src/nie/stages/context-extraction.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const CANONICAL = path.join(
  ROOT,
  "research",
  "regression-recordings",
  "corpus-v1",
);
const FEATURES = path.join(
  ROOT,
  "research",
  "confidence-calibration",
  "stage3",
  "corpus-v1",
);
const OUT_DIR = path.join(ROOT, "research", "confidence-calibration");

interface Row {
  readonly caseId: string;
  readonly band: string;
  readonly source: "canonical" | "stage3";
  readonly cf2: number | null;
  readonly cf4: number | null;
  readonly stated: number;
  readonly inferred: number;
  readonly unknown: number;
  readonly conflicts: number;
  readonly sufficiency: string | null;
  readonly haltedAtStage1: boolean;
}

const readStage3 = (dir: string, caseId: string): string | null => {
  const file = path.join(dir, `${caseId}.json`);
  if (!fs.existsSync(file)) return null;
  const recording = JSON.parse(fs.readFileSync(file, "utf8")) as {
    stages: { stageKey: string; output: string }[];
  };
  const stage = recording.stages.find(
    (s) => s.stageKey === "context_extraction",
  );
  return stage?.output ?? null;
};

const rows: Row[] = [];
for (const c of loadCorpus(CORPUS_ROOT)) {
  const band = c.expectedConfidenceBand ?? "?";
  const canonical = readStage3(CANONICAL, c.caseId);
  const source: Row["source"] = canonical !== null ? "canonical" : "stage3";
  const output = canonical ?? readStage3(FEATURES, c.caseId);
  if (output === null) {
    const recorded = fs.existsSync(path.join(CANONICAL, `${c.caseId}.json`));
    rows.push({
      caseId: c.caseId,
      band,
      source,
      cf2: null,
      cf4: null,
      stated: 0,
      inferred: 0,
      unknown: 0,
      conflicts: 0,
      sufficiency: null,
      haltedAtStage1: recorded,
    });
    continue;
  }
  const context = parseContext(output, c.inputText);
  const stated = context.elements.filter((e) => e.provenance === "stated");
  const inferred = context.elements.filter((e) => e.provenance === "inferred");
  const unknown = context.elements.filter((e) => e.provenance === "unknown");
  const conflicts = context.elements.filter(
    (e) => e.conflictsWithIndex !== undefined,
  ).length;
  const cf2 =
    stated.length + inferred.length === 0
      ? null
      : stated.length / (stated.length + inferred.length);
  const cf4 =
    stated.length === 0
      ? null
      : stated.reduce((a, e) => a + e.specificityScore, 0) / stated.length;
  rows.push({
    caseId: c.caseId,
    band,
    source,
    cf2,
    cf4,
    stated: stated.length,
    inferred: inferred.length,
    unknown: unknown.length,
    conflicts,
    sufficiency: context.sufficiency,
    haltedAtStage1: false,
  });
}

const f = (n: number | null): string => (n === null ? "—" : n.toFixed(3));
const lines = [
  "| Case | Band | Source | CF-2 stated ratio | CF-4 mean specificity | stated / inferred / unknown | Conflicts | Sufficiency |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) =>
    r.sufficiency === null
      ? `| ${r.caseId} | ${r.band} | — | — | — | — | — | ${r.haltedAtStage1 ? "no Stage 3 (halted at Stage 1)" : "no Stage 3 answer on record"} |`
      : `| ${r.caseId} | ${r.band} | ${r.source} | ${f(r.cf2)} | ${f(r.cf4)} | ${r.stated} / ${r.inferred} / ${r.unknown} | ${r.conflicts} | ${r.sufficiency} |`,
  ),
];
console.log(lines.join("\n"));
const measured = rows.filter((r) => r.sufficiency !== null);
console.log(
  `\n${measured.length} of ${rows.length} cases measured (${rows.filter((r) => r.source === "canonical" && r.sufficiency !== null).length} canonical, ${measured.filter((r) => r.source === "stage3").length} stage3).`,
);

if (process.argv.includes("--write")) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "features.json"),
    JSON.stringify(rows, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "features.md"),
    `# Confidence features — CF-2 and CF-4 per corpus case\n\nGenerated by \`npm run confidence:features -- --write\` on ${new Date().toISOString().slice(0, 10)}. Definitions in the script header. ${measured.length} of ${rows.length} cases measured.\n\n${lines.join("\n")}\n`,
  );
  console.log(`written to ${OUT_DIR}`);
}
