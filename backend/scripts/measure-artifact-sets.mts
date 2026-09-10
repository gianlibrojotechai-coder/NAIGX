/**
 * M-11 and AC-037, measured offline from recordings (D-89, D-90).
 *
 *   npm run measure:artifact-sets                      # the canonical store
 *   npm run measure:artifact-sets -- --from=<dir>      # a held folder of <case>.json
 *
 * Replays every recording the folder holds through the production pipeline
 * against the authored fragments (prompts/), evaluates the runner's
 * assertions on the result, and prints — per case — the depth, the planned
 * and generated artifact set, the complexity score, and the `artifact_set`
 * verdict with its detail. No provider call, no spend, nothing written.
 *
 * The two research files (`research/m11-artifact-set-measurement.md`,
 * `research/ac-037-measurement.md`) are written from this output, so a
 * reader can regenerate their tables rather than trust them.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { readAuthoredFragments } from "../src/fragments/source.js";
import { loadCapabilityProfile } from "../src/nie/capability-profile.js";
import { createPipeline } from "../src/nie/pipeline.js";
import { createReplayProvider } from "../src/provider/adapters/replay.js";
import { createProviderInvoker } from "../src/provider/invoke.js";
import { evaluateCase } from "../src/regression/assertions.js";
import { createAuthoredResolver } from "../src/regression/authored-resolver.js";
import { loadCorpus } from "../src/regression/corpus.js";
import {
  buildRecordingManifest,
  createRecordingStore,
} from "../src/regression/recording-store.js";
import { loadReplayCorpus } from "../src/regression/replay-corpus.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const PROMPTS_ROOT = path.join(ROOT, "prompts");
const CORPUS_VERSION = "corpus-v1";

const fromArg = process.argv.find((a) => a.startsWith("--from="));

const corpus = loadCorpus();
const profile = loadCapabilityProfile();
const resolver = createAuthoredResolver(readAuthoredFragments(PROMPTS_ROOT));

// A held folder is staged into a scratch store so the store's own gate reads it.
let store = createRecordingStore();
if (fromArg !== undefined) {
  const fromRoot = path.resolve(ROOT, fromArg.slice("--from=".length));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "naigx-measure-"));
  const dir = path.join(scratch, CORPUS_VERSION);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of fs.readdirSync(fromRoot)) {
    if (/^[a-z]{2}-\d{3}\.json$/.test(file)) {
      fs.copyFileSync(path.join(fromRoot, file), path.join(dir, file));
    }
  }
  store = createRecordingStore(scratch);
  store.writeManifest(
    buildRecordingManifest(CORPUS_VERSION, store.hashes(CORPUS_VERSION)),
  );
}

const loaded = await loadReplayCorpus({
  cases: corpus,
  store,
  resolver,
  capabilityProfile: profile,
});
for (const e of loaded.excluded) {
  console.log(`⚠️  ${e.caseId} not served: ${e.reason}`);
}

const adapter = createReplayProvider({
  fixtures: loaded.fixtures,
  lowVarianceSampling: loaded.lowVarianceSampling,
});

const rows: string[] = [];
const ac037: string[] = [];
let agree = 0;
let contradict = 0;
let conflict = 0;

for (const caseId of [...loaded.served].sort()) {
  const corpusCase = corpus.find((c) => c.caseId === caseId);
  if (corpusCase === undefined) continue;
  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter,
      rate: {
        inputUsdPerMillionTokens: "0.00",
        outputUsdPerMillionTokens: "0.00",
      },
      recorder: { record: () => Promise.resolve() },
      sleep: () => Promise.resolve(),
      random: () => 0,
    }),
    resolver,
    traceSink: { record: () => Promise.resolve() },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: randomUUID(),
    modelKey: "replay",
    capabilityProfile: profile,
  });
  let result;
  try {
    result = await pipeline.run({
      analysisId: randomUUID(),
      text: corpusCase.inputText,
    });
  } catch (error) {
    console.log(
      `💥 ${caseId}: ${error instanceof Error ? error.message : String(error)}`,
    );
    continue;
  }
  const plan = result.artifactPlan ?? [];
  const planned = plan.filter((e) => e.planned);
  const generated = planned.filter((e) => e.outcome === "generated");
  // The brief is planned at standard depth on every path (D-66); the depth
  // the path ran at is on the entries Stage 8 planned.
  const depth =
    plan.find((e) => e.artifactType !== "intent_brief")?.depthLevel ?? "—";
  const outcomes = evaluateCase(corpusCase, result);
  const set = outcomes.find((o) => o.id === "artifact_set");
  const registered = caseId === "jd-008" && set?.status === "failed";
  if (set?.status === "passed") agree += 1;
  else if (registered) conflict += 1;
  else contradict += 1;
  const judgement =
    result.intent?.requestedOutcome === "understanding_only"
      ? `declined: "${result.intent.declineQuote ?? ""}"`
      : result.architecture?.automationUnwarranted !== undefined
        ? `unwarranted: ${result.architecture.automationUnwarranted.statement.slice(0, 90)}…`
        : depth === "minimal"
          ? `minimal (${String(corpusCase.inputText.length)} chars)`
          : result.haltedAt !== undefined
            ? `halted at ${String(result.haltedAt.stageNumber)}`
            : "standard";
  rows.push(
    `| ${caseId} | ${corpusCase.inputType} | ${judgement} | ${generated.map((e) => e.artifactType).join(", ")} | ${registered ? "⚖️ conflict" : (set?.status ?? "—")} | ${(set?.detail ?? "").replace(/\|/g, "/")} |`,
  );
  const score = result.complexityAssessment?.complexityScore;
  ac037.push(
    `| ${caseId} | ${corpusCase.inputType} | ${String(corpusCase.inputText.length)} | ${depth} | ${score === undefined ? "—" : String(score)} | ${String(planned.length)} | ${String(generated.length)} |`,
  );
}

console.log("\n## artifact_set per case\n");
console.log("| Case | Path | Judgement | Generated | artifact_set | Detail |");
console.log("|---|---|---|---|---|---|");
for (const r of rows) console.log(r);
console.log(
  `\n**${String(agree)} agree · ${String(contradict)} contradict · ${String(conflict)} registered conflict** of ${String(rows.length)}`,
);
console.log("\n## AC-037 — planned set size against complexity\n");
console.log(
  "| Case | Path | Characters | Depth | Complexity score | Planned (incl. brief) | Generated |",
);
console.log("|---|---|---|---|---|---|---|");
for (const r of ac037) console.log(r);
