/**
 * Corpus regression tooling (`AI §12.3` recorded mode, `NFR-043`).
 *
 *   npm run regression:status              what can be measured, and what cannot
 *   npm run regression:recordings:check    the evidence gate (`docs/12` D-24)
 *   npm run regression:recordings:write    record captured evidence in the manifest
 *   npm run regression:capture -- --dry-run  exercise the capture path offline
 *   npm run regression:capture             ⚠️ PAID — capture real responses
 *   npm run regression:run                 run recorded mode over the first vertical
 *
 * `capture` is the only command in this repository that spends money, and it
 * spends it once per case per stage. `--dry-run` runs the identical path with
 * an offline responder and writes to a scratch directory.
 *
 * `status` needs no database, no network and no recordings — it reports what a
 * run *would* do, including how much capture is outstanding. `run` needs the
 * published fragments, because a replay fixture is keyed by the composed prompt
 * (`docs/12` D-17), so it opens the primary store exactly as the harness does.
 *
 * ONLY `capture` WITHOUT `--dry-run` CALLS A PROVIDER. `status`,
 * `recordings:*`, `run` and every dry run replay or read; none of them can
 * reach a network, and `run` has no path to a credential at all.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FIRST_VERTICAL,
  loadCorpus,
  type CorpusCase,
} from "../src/regression/corpus.js";
import {
  buildRecordingManifest,
  createRecordingStore,
  detectRecordingDrift,
  isCleanRecordingSet,
} from "../src/regression/recording-store.js";
import { runRegression } from "../src/regression/runner.js";
import {
  buildPassReference,
  isCleanRun,
} from "../src/regression/pass-reference.js";
import {
  DEFERRED_ASSERTIONS,
  SUPPORTED_ASSERTIONS,
} from "../src/regression/assertions.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const RUNS_DIR = path.join(ROOT, "research", "regression-runs");

const manifestVersion = (): string =>
  (
    JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "prompts", "fragments.manifest.json"),
        "utf8",
      ),
    ) as { version: string }
  ).version;

const command = process.argv[2] ?? "status";
const corpus = loadCorpus();
const selected: readonly CorpusCase[] = FIRST_VERTICAL(corpus);
const store = createRecordingStore();
const corpusVersion = corpus[0]?.corpusVersion ?? "corpus-v1";
const recorded = new Set(store.list(corpusVersion));

if (command === "status") {
  console.log(
    `corpus         ${corpusVersion} — ${String(corpus.length)} cases`,
  );
  console.log(
    `first vertical ${String(selected.length)} cases (business_requirement + mandatory special classes, docs/11 §8)`,
  );
  console.log(
    `recordings     ${String(selected.filter((c) => recorded.has(c.caseId)).length)}/${String(selected.length)} captured`,
  );
  console.log(`\nassertions evaluated: ${SUPPORTED_ASSERTIONS.join(", ")}`);
  console.log(`assertions deferred:  ${DEFERRED_ASSERTIONS.join(", ")}`);

  const drift = detectRecordingDrift(
    store.hashes(corpusVersion),
    store.readManifest(corpusVersion),
  );
  console.log(
    `\nevidence gate  ${isCleanRecordingSet(drift) ? "clean" : "DRIFT"} (recordings.manifest.json)`,
  );
  for (const [label, keys] of [
    ["unmanifested", drift.added],
    ["missing", drift.removed],
    ["edited", drift.changed],
  ] as const) {
    for (const key of keys) console.log(`   ${label}: ${key}`);
  }

  const missing = selected.filter((c) => !recorded.has(c.caseId));
  if (missing.length > 0) {
    console.log(
      `\n⏸  ${String(missing.length)} case(s) await recorded provider responses:`,
    );
    for (const c of missing) console.log(`   ${c.caseId}  ${c.sourcePath}`);
    console.log(
      "\n   Recorded mode cannot run until these are captured. Capture is a paid\n" +
        "   provider operation and is not performed by this tool.",
    );
  }
  process.exit(0);
}

if (command === "recordings:check" || command === "recordings:write") {
  // The evidence gate, in the same two commands the fragment gate uses
  // (`docs/12` D-14, D-24). A recording cannot enter the suite without the
  // hash appearing in a reviewed diff.
  const hashes = store.hashes(corpusVersion);
  const drift = detectRecordingDrift(hashes, store.readManifest(corpusVersion));

  if (command === "recordings:write") {
    store.writeManifest(buildRecordingManifest(corpusVersion, hashes));
    console.log(
      `Recorded ${String(Object.keys(hashes).length)} recording(s) for ${corpusVersion}.`,
    );
    process.exit(0);
  }

  if (isCleanRecordingSet(drift)) {
    console.log(
      `✅ ${String(Object.keys(hashes).length)} recording(s) match the manifest.`,
    );
    process.exit(0);
  }

  console.error(
    "❌ Recording drift — replayed evidence must be recorded and reviewed (docs/12 D-24).",
  );
  for (const [label, keys] of [
    ["unmanifested", drift.added],
    ["missing", drift.removed],
    ["edited", drift.changed],
  ] as const) {
    for (const key of keys) console.error(`   ${label}: ${key}`);
  }
  console.error(
    "\n   Review the diff, then run: npm run regression:recordings:write",
  );
  process.exit(1);
}

if (command === "capture") {
  // `--dry-run` exercises the whole capture path offline: no credential, no
  // network, no spend. It writes to a scratch directory, never to the real
  // store, because a dry-run recording is plumbing output and not evidence.
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const only = process.argv
    .filter((a) => a.startsWith("--case="))
    .map((a) => a.slice("--case=".length));

  const cases =
    only.length > 0
      ? selected.filter((c) => only.includes(c.caseId))
      : selected;
  if (cases.length === 0) {
    console.error(`No selected case matches ${only.join(", ")}.`);
    process.exit(2);
  }

  const { default: pgCapture } = await import("pg");
  const { PrismaPg: PrismaPgCapture } = await import("@prisma/adapter-pg");
  const { PrismaClient: PrismaClientCapture } =
    await import("../src/generated/prisma/client.js");
  const { createFragmentResolver: resolverFor } =
    await import("../src/db/fragment-resolver.js");
  const { captureCases, writeFailureRecord } =
    await import("../src/regression/capture.js");
  type CaptureFailureRecord = Parameters<
    NonNullable<Parameters<typeof captureCases>[0]["quarantine"]>
  >[0];
  const { createDryRunAdapter, DRY_RUN_ADAPTER_ID } =
    await import("../src/regression/dry-run-adapter.js");
  await import("dotenv/config");

  const pool = new pgCapture.Pool({
    connectionString: process.env["DATABASE_URL"],
  });
  const prisma = new PrismaClientCapture({
    adapter: new PrismaPgCapture(pool),
  });

  try {
    let adapterFor: Parameters<typeof captureCases>[0]["adapterFor"];
    let adapterId: string;
    let modelKey: string;
    let rate: {
      inputUsdPerMillionTokens: string;
      outputUsdPerMillionTokens: string;
    };
    let captureStore = store;
    let quarantine: ((record: CaptureFailureRecord) => void) | undefined;

    if (dryRun) {
      const scratch = fs.mkdtempSync(
        path.join(os.tmpdir(), "naigx-capture-dry-run-"),
      );
      captureStore = createRecordingStore(scratch);
      // A dry run's failures are scratch too — nothing it produces belongs in
      // the repository, diagnostic or otherwise.
      quarantine = (record) =>
        writeFailureRecord(record, path.join(scratch, "failures"));
      adapterFor = createDryRunAdapter;
      adapterId = DRY_RUN_ADAPTER_ID;
      modelKey = "dry-run";
      rate = {
        inputUsdPerMillionTokens: "0.00",
        outputUsdPerMillionTokens: "0.00",
      };
      console.log(
        "🧪 DRY RUN — no provider call, no spend, and nothing written to\n" +
          "   research/regression-recordings/. Output goes to:\n" +
          `   ${scratch}\n`,
      );
    } else {
      const { loadConfig } = await import("../src/config/env.js");
      const { createAnthropicProvider } =
        await import("../src/provider/adapters/anthropic.js");
      const config = loadConfig();
      const model = config.provider.model;
      const inputRate = config.provider.inputUsdPerMillionTokens;
      const outputRate = config.provider.outputUsdPerMillionTokens;
      if (
        config.provider.apiKey === undefined ||
        model === undefined ||
        inputRate === undefined ||
        outputRate === undefined
      ) {
        console.error(
          "❌ A paid capture requires ANTHROPIC_API_KEY, PROVIDER_MODEL,\n" +
            "   PROVIDER_INPUT_USD_PER_MTOK and PROVIDER_OUTPUT_USD_PER_MTOK.\n" +
            "   Cost accounting is required per call and no rate may be assumed (docs/12 D-18).",
        );
        process.exit(1);
      }
      const anthropic = createAnthropicProvider({
        apiKey: config.provider.apiKey,
        model,
      });
      adapterFor = () => anthropic;
      adapterId = "anthropic";
      modelKey = model;
      rate = {
        inputUsdPerMillionTokens: inputRate,
        outputUsdPerMillionTokens: outputRate,
      };
      console.log(
        `💳 PAID CAPTURE — ${String(cases.length)} case(s) against ${model}.\n`,
      );
    }

    const report = await captureCases({
      cases,
      adapterFor,
      resolver: resolverFor(prisma),
      store: captureStore,
      rate,
      modelKey,
      adapterId,
      fragmentsManifestVersion: manifestVersion(),
      // Declared honestly: neither adapter is configured for sampling control.
      lowVarianceSampling: dryRun,
      force,
      ...(quarantine !== undefined ? { quarantine } : {}),
      onProgress: (message) => {
        console.log(message);
      },
    });

    const t = report.totals;
    console.log(
      `\n${String(t.captured)} captured · ${String(t.skipped)} skipped · ${String(t.failed)} failed`,
    );
    console.log(`${String(t.providerCalls)} provider call(s) made`);
    const failures = report.cases.filter((o) => o.status === "failed");
    for (const outcome of failures) {
      // First line only: a Prisma or provider error is many lines long, and
      // repeating it per case buries the summary.
      console.log(
        `   ✖ ${outcome.caseId} (${String(outcome.providerCalls)} call(s) spent): ` +
          `${outcome.detail.split("\n").filter((l) => l.trim() !== "")[0] ?? ""}`,
      );
    }
    if (failures.length > 0) {
      console.log(
        dryRun
          ? "\n   Failure detail quarantined (not evidence, not in the manifest)."
          : "\n   Failure detail quarantined under research/regression-failures/ —\n" +
              "   the raw responses are there, so diagnosis costs nothing further.",
      );
    }
    if (report.aborted) {
      console.log(
        "\n⛔ Batch aborted on consecutive failures. Fix the cause and re-run;\n" +
          "   captured cases are kept and will be skipped without --force.",
      );
    }
    if (report.manifestUpdated) {
      console.log(
        dryRun
          ? "\nManifest written in the scratch directory."
          : "\n✅ recordings.manifest.json updated — review the diff before committing.",
      );
    }
    process.exit(t.failed > 0 ? 1 : 0);
  } catch (error) {
    if (error instanceof Error && error.name === "CaptureRefusedError") {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (command === "run") {
  const { default: pg } = await import("pg");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { createFragmentResolver } =
    await import("../src/db/fragment-resolver.js");
  await import("dotenv/config");

  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const report = await runRegression({
      cases: selected,
      store,
      resolver: createFragmentResolver(prisma),
      // `FR-024`: repeated runs on identical input must agree.
      repeat: 2,
    });

    for (const outcome of report.cases) {
      const mark = {
        passed: "✅",
        failed: "❌",
        blocked: "⏸ ",
        stale: "♻️ ",
        errored: "💥",
      }[outcome.status];
      console.log(
        `${mark} ${outcome.caseId}${outcome.detail === "" ? "" : ` — ${outcome.detail}`}`,
      );
      for (const a of outcome.assertions.filter((x) => x.status === "failed")) {
        console.log(`     ${a.id}: ${a.detail} (${a.specRef})`);
      }
    }

    const t = report.totals;
    console.log(
      `\n${String(t.passed)} passed · ${String(t.failed)} failed · ${String(t.blocked)} blocked · ` +
        `${String(t.stale)} stale · ${String(t.errored)} errored`,
    );
    if (t.stale > 0) {
      console.log(
        "\n♻️  Stale means the fragments changed since capture. Recorded mode cannot\n" +
          "   validate a prompt it has no answer for — re-capture or run live (docs/12 D-24).",
      );
    }

    const reference = buildPassReference({
      report,
      fragmentsManifestVersion: manifestVersion(),
    });

    if (reference === null) {
      console.error(
        "\n❌ No pass reference issued. `DB §4.5` activation requires a run in which\n" +
          "   every selected case was measured and passed.",
      );
      process.exit(1);
    }

    fs.mkdirSync(RUNS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(RUNS_DIR, `${reference.runId}.json`),
      `${JSON.stringify(reference, null, 2)}\n`,
    );
    console.log(`\n✅ ${reference.reference}`);
    console.log(
      `   recorded at research/regression-runs/${reference.runId}.json`,
    );
    process.exit(isCleanRun(report) ? 0 : 1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

console.error(
  "Usage: regression.mts <status|recordings:check|recordings:write|capture|run>\n" +
    "       capture [--dry-run] [--force] [--case=<id>]...",
);
process.exit(2);
