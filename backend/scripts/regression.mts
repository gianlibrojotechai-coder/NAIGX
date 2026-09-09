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

import type { CapabilityProfile } from "../src/nie/capability-profile.js";
import {
  FIRST_VERTICAL,
  selectCases,
  UnknownCaseError,
  loadCorpus,
  loadSuiteVersion,
  type CorpusCase,
} from "../src/regression/corpus.js";
import {
  buildRecordingManifest,
  createRecordingStore,
  detectRecordingDrift,
  isCleanRecordingSet,
} from "../src/regression/recording-store.js";
import { runRegression } from "../src/regression/runner.js";
import { readAuthoredFragments } from "../src/fragments/source.js";
import {
  buildPassReference,
  isCleanRun,
} from "../src/regression/pass-reference.js";
import {
  DEFERRED_ASSERTIONS,
  SUPPORTED_ASSERTIONS,
} from "../src/regression/assertions.js";
import {
  computeFragmentCoverage,
  type FragmentCoverage,
} from "../src/regression/coverage.js";

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

/**
 * ⚠️ RESOLVED HERE RATHER THAN IMPORTED FROM `fragments.mts`. That module
 * dispatches on `process.argv` at import time, so importing a constant from it
 * ran its CLI and exited this one before it reached a capture.
 */
const PROMPTS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../prompts",
);

const command = process.argv[2] ?? "status";
const corpus = loadCorpus();
const selected: readonly CorpusCase[] = FIRST_VERTICAL(corpus);
const store = createRecordingStore();
const suiteVersion = loadSuiteVersion();
// Storage partition, not the suite version: recordings stay keyed on a case's
// immutable entry provenance (`docs/12` D-30 decision 8).
const corpusVersion = corpus[0]?.corpusVersion ?? "corpus-v1";
const recorded = new Set(store.list(corpusVersion));

if (command === "status") {
  console.log(
    `corpus         suite ${suiteVersion} — ${String(corpus.length)} cases, recordings under ${corpusVersion}`,
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

  // --- `--out=<dir>` — capture WITHOUT touching the canonical store --------
  //
  // ⚠️ WHY THIS EXISTS. A re-capture of a case that already has a recording had
  // exactly two outcomes before this: skipped (`capture.ts` refuses to
  // overwrite without `--force`), or `--force`, which **destroys the existing
  // recording in place**. Neither is usable for a pilot whose whole purpose is
  // to find out whether a new capture is valid *before* anything is admitted —
  // the first cannot run, and the second spends the evidence it is testing.
  //
  // So a paid capture may be directed at a root outside the store, which is
  // what `research/regression-pending/` is for: held evidence, invisible to
  // `createRecordingStore`, the manifest gate, coverage and the activation
  // gate. Admission stays a separate, deliberate decision — the same route
  // `ew-001` took.
  //
  // ⚠️ IT LOWERS NOTHING. The pipeline, the assertions, the authored resolver
  // and the validation a capture must satisfy are all untouched; only the
  // destination directory moves.
  // ⚠️ REQUIRED FOR ANY PAID BATCH. A ceiling that is only checked afterwards
  // is a receipt. This is passed into captureCases, which tests it BEFORE each
  // case and refuses to start one once the ceiling is reached.
  const budgetArg = process.argv.find((a) => a.startsWith("--budget="));
  const budgetUsd = budgetArg?.slice("--budget=".length);

  // D-86: `--through=3` captures Stages 1–3 only — the confidence features —
  // and is refused without `--out=`, because such a recording is not corpus
  // evidence and must never land in the canonical store.
  const throughArg = process.argv.find((a) => a.startsWith("--through="));
  const stopAfterStage =
    throughArg === undefined
      ? undefined
      : Number(throughArg.slice("--through=".length));
  if (stopAfterStage !== undefined && stopAfterStage !== 3) {
    console.error(
      "❌ --through accepts only 3 (the confidence-feature capture, D-86).",
    );
    process.exit(1);
  }
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  if (stopAfterStage !== undefined && outArg === undefined) {
    console.error(
      "❌ --through=3 requires --out=<dir>: a Stage 1–3 recording is calibration evidence, not corpus evidence.",
    );
    process.exit(1);
  }
  const outRoot =
    outArg === undefined
      ? undefined
      : path.resolve(ROOT, outArg.slice("--out=".length));
  const only = process.argv
    .filter((a) => a.startsWith("--case="))
    .map((a) => a.slice("--case=".length));

  // An explicit `--case=` is resolved against the whole corpus, not just the
  // first vertical. Without this the job-description path is unreachable from
  // the CLI in any mode — `FIRST_VERTICAL` is business requirements plus the
  // special classes, so no `jd-*` case is ever selectable, dry run included.
  //
  // The default is deliberately unchanged: with no `--case=` the suite is the
  // same set it has always been, so the frozen pass reference still describes
  // the same run.
  const cases =
    only.length > 0 ? corpus.filter((c) => only.includes(c.caseId)) : selected;
  if (cases.length === 0) {
    console.error(`No selected case matches ${only.join(", ")}.`);
    process.exit(2);
  }

  const { default: pgCapture } = await import("pg");
  const { PrismaPg: PrismaPgCapture } = await import("@prisma/adapter-pg");
  const { PrismaClient: PrismaClientCapture } =
    await import("../src/generated/prisma/client.js");
  // D-63: capture composes the CANDIDATE fragments, not the active ones. A
  // fragment that has never been active could not otherwise be exercised, and
  // a change gate that tested the content already in force would not be
  // testing the change.
  const { createAuthoredResolver: resolverFor } =
    await import("../src/regression/authored-resolver.js");
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

    // ⚠️ LOADED FOR BOTH PATHS, NOT JUST THE DRY RUN.
    //
    // Stage 7 refuses to run without an inventory to compare against
    // (`FR-022`), so a job-description case captured without one halts after
    // Stage 3 — no verdict, no criteria, no artifact plan. It records
    // *something*, which is what makes the failure expensive: a paid capture
    // would bill for three stages and produce a recording that cannot support
    // the evidence it was bought for.
    //
    // This was gated on `dryRun` until 2026-09-07 and never noticed, because
    // no job-description case had ever been captured. Loading it here means
    // the paid path cannot diverge from the rehearsal that approved it.
    const { loadCapabilityProfile } =
      await import("../src/nie/capability-profile.js");
    const capabilityProfile: CapabilityProfile = loadCapabilityProfile();

    if (dryRun) {
      const scratch = fs.mkdtempSync(
        path.join(os.tmpdir(), "naigx-capture-dry-run-"),
      );
      captureStore = createRecordingStore(scratch);
      // A dry run's failures are scratch too — nothing it produces belongs in
      // the repository, diagnostic or otherwise.
      quarantine = (record) =>
        writeFailureRecord(record, path.join(scratch, "failures"));
      // The dry-run adapter answers from the same inventory the pipeline is
      // given, so a rehearsal exercises the real matching rules.
      adapterFor = (corpusCase) =>
        createDryRunAdapter(corpusCase, capabilityProfile);
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
      const { STAGE_OUTPUT_SCHEMAS } =
        await import("../src/nie/output-schemas.js");
      // D-65: capture is built exactly as production builds its adapter —
      // schemas by task, configured effort — or a recording would be an
      // answer to a request production never sends.
      const anthropic = createAnthropicProvider({
        apiKey: config.provider.apiKey,
        model,
        outputSchemas: STAGE_OUTPUT_SCHEMAS,
        ...(config.provider.effort !== undefined
          ? { effort: config.provider.effort }
          : {}),
        ...(config.provider.effortByTask !== undefined
          ? { effortByTask: config.provider.effortByTask }
          : {}),
      });
      adapterFor = () => anthropic;
      adapterId = "anthropic";
      modelKey = model;
      rate = {
        inputUsdPerMillionTokens: inputRate,
        outputUsdPerMillionTokens: outputRate,
      };
      if (outRoot !== undefined) {
        // Held evidence, not admitted evidence. Failures go beside it rather
        // than into the repository's committed failure record, because a
        // pilot's diagnostics are not a corpus artefact until someone says so.
        captureStore = createRecordingStore(outRoot);
        quarantine = (record) =>
          writeFailureRecord(record, path.join(outRoot, "failures"));
      }

      console.log(
        `💳 PAID CAPTURE — ${String(cases.length)} case(s) against ${model}.\n`,
      );
      console.log(
        outRoot === undefined
          ? "   ⚠️  Writing to the CANONICAL store.\n"
          : `   Held output (canonical store untouched): ${path.relative(ROOT, outRoot)}\n`,
      );
    }

    const report = await captureCases({
      cases,
      adapterFor,
      capabilityProfile,
      resolver: resolverFor(readAuthoredFragments(PROMPTS_ROOT)),
      store: captureStore,
      rate,
      modelKey,
      adapterId,
      fragmentsManifestVersion: manifestVersion(),
      // Declared honestly: neither adapter is configured for sampling control.
      lowVarianceSampling: dryRun,
      // D-63: capture composes the candidate fragments, and the recording says so.
      captureResolution: "authored",
      ...(budgetUsd !== undefined ? { budgetUsd } : {}),
      force,
      ...(stopAfterStage === 3 ? { stopAfterStage: 3 as const } : {}),
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

    // ⚠️ EVERY CASE, INCLUDING FAILURES. A failed capture is billed and its
    // cost belongs in the total; omitting it is what made a batch look
    // cheaper than it was.
    {
      const spent = report.cases.reduce((a, o) => a + Number(o.costUsd), 0);
      console.log("\ncost by case:");
      for (const o of report.cases) {
        if (o.status === "skipped" && Number(o.costUsd) === 0) continue;
        console.log(
          `   ${o.caseId.padEnd(10)}$${Number(o.costUsd).toFixed(4)}  ${o.status}` +
            `${o.status === "failed" ? " (billed anyway)" : ""}`,
        );
      }
      console.log(`   ${"TOTAL".padEnd(10)}$${spent.toFixed(4)}`);
      if (budgetUsd !== undefined) {
        console.log(
          `   ${"BUDGET".padEnd(10)}$${Number(budgetUsd).toFixed(4)}` +
            `${spent > Number(budgetUsd) ? "   ⚠️ EXCEEDED" : "   ok"}`,
        );
      }
    }
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
  // D-63 AMENDMENT, as corrected by D-64 §4.2: recordings that carry their
  // captured composition replay against that and never consult a resolver.
  // Recordings that do not are matched against BOTH candidates below, because
  // "no persisted composition" does not mean "captured under active".
  const { createFragmentResolver } =
    await import("../src/db/fragment-resolver.js");
  const { createAuthoredResolver: createAuthoredResolverForRun } =
    await import("../src/regression/authored-resolver.js");
  await import("dotenv/config");

  // `--case=` resolves against the whole corpus, exactly as `capture` does. The
  // default is unchanged: with no flag this is `FIRST_VERTICAL`, so the frozen
  // pass reference still describes the same run.
  const runIds = process.argv
    .filter((a) => a.startsWith("--case="))
    .map((a) => a.slice("--case=".length));

  let runCases: readonly CorpusCase[];
  try {
    runCases = selectCases(corpus, runIds, selected);
  } catch (error) {
    if (error instanceof UnknownCaseError) {
      console.error(`❌ ${error.message}`);
      process.exit(2);
    }
    throw error;
  }

  if (runIds.length > 0) {
    console.log(
      `▶  case-named run — ${String(runCases.length)} case(s): ${runCases.map((c) => c.caseId).join(", ")}`,
    );
    console.log(
      `   selectionScope will be "partial" — naming ids is not a proved coverage basis (D-64 §4.4)\n`,
    );
  }

  // --- D-64 §4.4 — the D-30 dec. 3 targeted path, made reachable -----------
  //
  // ⚠️ `--fragment=` AND `--case=` MEAN DIFFERENT THINGS, DELIBERATELY.
  // D-30 dec. 3 defines a targeted run as one whose cases were selected
  // BECAUSE they compose the named fragment, with the coverage computed
  // offline and named in the reference. An operator naming case ids has proved
  // no such thing, so `--case=` stays `partial` however few cases it selects.
  // Letting it claim `targeted` would let an arbitrary subset present itself
  // as a coverage basis, which is the one thing D-30 dec. 3 guards.
  const fragmentArg = process.argv.find((a) => a.startsWith("--fragment="));
  const targetFragment = fragmentArg?.slice("--fragment=".length);

  let targetCoverage: FragmentCoverage | undefined;
  if (targetFragment !== undefined) {
    if (runIds.length > 0) {
      console.error(
        "❌ --fragment= and --case= select on different bases and cannot be combined.\n" +
          "   --fragment= selects the cases that compose a fragment (targeted, D-30 dec. 3);\n" +
          "   --case= names ids directly (partial). Pick one.",
      );
      process.exit(2);
    }
    // Computed with the AUTHORED resolver — the same authority the activation
    // gate uses, so the coverage named in the reference is the coverage the
    // gate will recompute rather than a second opinion about it.
    targetCoverage = await computeFragmentCoverage({
      fragmentKey: targetFragment,
      cases: corpus,
      suiteVersion,
      store,
      resolver: createAuthoredResolverForRun(
        readAuthoredFragments(PROMPTS_ROOT),
      ),
    });
    if (targetCoverage.coveredCaseIds.length === 0) {
      console.error(
        `❌ No recorded case composes ${targetFragment}, so no run can exercise it.\n` +
          "   Capture evidence for the cases it composes into first.",
      );
      process.exit(2);
    }
    const byId = new Map(corpus.map((c) => [c.caseId, c]));
    runCases = targetCoverage.coveredCaseIds
      .map((id) => byId.get(id))
      .filter((c): c is CorpusCase => c !== undefined);
    console.log(
      `▶  targeted run — ${targetFragment} composes ${String(runCases.length)} recorded case(s): ` +
        `${runCases.map((c) => c.caseId).join(", ")}\n`,
    );
  }

  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const activeResolver = createFragmentResolver(prisma);
    // Capture/replay parity: capture composes Stage 7 against the operator
    // inventory, so replay must too. Without it a job_description recording
    // halts at Stage 7 and reports the profile it was captured with as missing.
    const { loadCapabilityProfile: loadProfileForRun } =
      await import("../src/nie/capability-profile.js");
    const report = await runRegression({
      cases: runCases,
      suiteVersion,
      store,
      resolver: activeResolver,
      capabilityProfile: loadProfileForRun(),
      // D-64 §4.2. ⚠️ BOTH CANDIDATES, ACTIVE FIRST. A legacy recording has no
      // persisted composition, so which one it was captured under is settled
      // by which one REPRODUCES its recorded hash — not by the absence of a
      // field. Active leads so a recording reproducible under both keeps the
      // provenance it has always had (D-63 §5 rejected relabelling history);
      // only a recording active cannot reproduce is labelled authored.
      legacyResolvers: [
        { resolution: "active", resolver: activeResolver },
        {
          resolution: "authored",
          resolver: createAuthoredResolverForRun(
            readAuthoredFragments(PROMPTS_ROOT),
          ),
        },
      ],
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
        console.log(
          `     ${a.advisory === true ? "⚠ advisory " : ""}${a.id}: ${a.detail} (${a.specRef})`,
        );
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
      // D-63 §4, §7 and D-64 §4.1: the artefact says which composition it
      // exercised, so a reader cannot mistake candidate evidence for evidence
      // about what production is serving.
      //
      // ⚠️ `fragmentResolution` IS NO LONGER PASSED. It is derived inside
      // `buildPassReference` from what each case actually replayed. Passing it
      // is how a run that had replayed thirteen legacy recordings through the
      // active resolver once got stamped `authored` — a label asserting the
      // opposite of what happened. A field describing how a run resolved is
      // evidence about the run; it cannot be an argument.
      //
      // D-64 §4.4: `coverage` is present only for a `--fragment=` run, which is
      // the only selection that proves *why* these cases. `corpusSize` lets the
      // `entire_corpus` branch be reachable and truthful.
      ...(targetCoverage !== undefined ? { coverage: targetCoverage } : {}),
      corpusSize: corpus.length,
    });

    if (reference === null) {
      console.error(
        "\n❌ No pass reference issued. `DB §4.5` activation requires a run in which\n" +
          "   every selected case was measured and passed.",
      );
      process.exit(1);
    }

    // --- D-64 §4.5 — run records are WRITE-ONCE ----------------------------
    //
    // ⚠️ `runId` is deterministic by design: the same cases, evidence and
    // assertions produce the same id, so "two runs that measured the same
    // thing are recognisable as such". A re-run therefore lands on an existing
    // filename — and rewriting it changes only `completedAt`, leaving two
    // documents that claim to be the same run with different timestamps. That
    // is precisely the "the document and the reference disagree" condition
    // `assertActivationPermitted` refuses on.
    //
    // A verification run overwrote 35af47fbdabae5eb.json this way and was
    // caught only by `git status`. Reproduction is the good outcome here, so it
    // is reported rather than written.
    fs.mkdirSync(RUNS_DIR, { recursive: true });
    const runFile = path.join(RUNS_DIR, `${reference.runId}.json`);
    const reproduced = fs.existsSync(runFile);
    if (!reproduced) {
      fs.writeFileSync(runFile, `${JSON.stringify(reference, null, 2)}\n`);
    }
    console.log(`\n✅ ${reference.reference}`);
    console.log(
      reproduced
        ? `   REPRODUCED an existing run record — research/regression-runs/${reference.runId}.json left unmodified`
        : `   recorded at research/regression-runs/${reference.runId}.json`,
    );
    process.exit(isCleanRun(report) ? 0 : 1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

/**
 * `evaluate` — READ-ONLY INSPECTION OF HELD EVIDENCE. NOT A GATE COMMAND.
 *
 * WHY IT EXISTS. A recording captured but never admitted to the store cannot
 * be evaluated by `run`, because `run` reads the canonical store and a file
 * outside it is invisible there by construction. That leaves a real question
 * unanswerable: `research/regression-pending/ew-001.json` cost $0.1072 of
 * provider spend, and whether its assertions pass was unknowable without first
 * admitting it — which is precisely the decision the answer is supposed to
 * inform.
 *
 * ⚠️ EVALUATION IS NOT ADMISSION, AND THIS COMMAND MUST NEVER BLUR THEM.
 * `assertActivationPermitted` recomputes coverage against the canonical store,
 * so nothing produced here can widen what any pass reference is sufficient to
 * activate. That separation is deliberate (`DB §4.5`, D-24 dec. 4, D-30 dec. 3)
 * and this command is built to be incapable of collapsing it:
 *
 *   · it copies into a scratch root and reads only from there — the canonical
 *     store and its manifest are never opened for writing;
 *   · it writes NO run record to `research/regression-runs/`;
 *   · it builds NO pass reference. `buildPassReference` is not even imported
 *     into this block, so a later edit cannot reach for it by accident.
 *
 * Admitting evidence stays a decision made by a person, expressed as
 * `recordings:write` against the canonical store.
 *
 * THE AUTHORED RESOLVER, FOR THE SAME REASON `capture` USES IT (D-63). A held
 * recording may exercise a fragment that has no active published version — for
 * ew-001, `stage.workflow_review` has no row in `prompt_fragment` at all. The
 * active resolver throws before any staleness comparison, which `run` reports
 * as `errored`. Composing against `prompts/` is what makes such a case
 * resolvable, and it is the same composition capture was made under.
 */
if (command === "evaluate") {
  const { createAuthoredResolver } =
    await import("../src/regression/authored-resolver.js");

  const evalIds = process.argv
    .filter((a) => a.startsWith("--case="))
    .map((a) => a.slice("--case=".length));

  // No fallback suite. `run` defaults to FIRST_VERTICAL because it issues a
  // reference describing a fixed suite; this inspects named evidence, and a
  // default would silently evaluate cases nobody asked about.
  if (evalIds.length === 0) {
    console.error(
      "❌ evaluate requires at least one --case=<id>. It inspects named held\n" +
        "   evidence and has no default suite.",
    );
    process.exit(2);
  }

  const fromArg = process.argv.find((a) => a.startsWith("--from="));
  const fromRoot = path.resolve(
    ROOT,
    fromArg === undefined
      ? path.join("research", "regression-pending")
      : fromArg.slice("--from=".length),
  );

  // Same rule as `run` and `capture`: resolved against the WHOLE corpus, and an
  // unknown id is a hard error rather than a quietly smaller run.
  let evalCases: readonly CorpusCase[];
  try {
    evalCases = selectCases(corpus, evalIds, []);
  } catch (error) {
    if (error instanceof UnknownCaseError) {
      console.error(`❌ ${error.message}`);
      process.exit(2);
    }
    throw error;
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "naigx-evaluate-"));
  const scratchVersionDir = path.join(scratch, corpusVersion);
  fs.mkdirSync(scratchVersionDir, { recursive: true });

  const missing: string[] = [];
  for (const corpusCase of evalCases) {
    const source = path.join(fromRoot, `${corpusCase.caseId}.json`);
    if (!fs.existsSync(source)) {
      missing.push(`${corpusCase.caseId} (expected ${source})`);
      continue;
    }
    fs.copyFileSync(
      source,
      path.join(scratchVersionDir, `${corpusCase.caseId}.json`),
    );
  }
  if (missing.length > 0) {
    console.error(
      `❌ No held recording for: ${missing.join(", ")}\n` +
        "   evaluate reads held evidence, not the canonical store. Use `run` for admitted cases.",
    );
    process.exit(2);
  }

  const scratchStore = createRecordingStore(scratch);
  // The manifest is generated from what was just copied, so integrity
  // verification still runs over this evidence — a hand-edited held recording
  // is not waved through just because it sits outside the store.
  scratchStore.writeManifest(
    buildRecordingManifest(corpusVersion, scratchStore.hashes(corpusVersion)),
  );

  console.log(
    `▶  read-only evaluation — ${String(evalCases.length)} case(s): ${evalCases.map((c) => c.caseId).join(", ")}`,
  );
  console.log(`   held evidence   ${path.relative(ROOT, fromRoot)}`);
  console.log(`   resolver        authored (prompts/), D-63`);
  console.log(
    `   ⚠️  no run record, no pass reference, canonical store untouched\n`,
  );

  const { loadCapabilityProfile: loadProfileForEval } =
    await import("../src/nie/capability-profile.js");
  const report = await runRegression({
    cases: evalCases,
    suiteVersion,
    store: scratchStore,
    resolver: createAuthoredResolver(readAuthoredFragments(PROMPTS_ROOT)),
    // Same capture/replay parity requirement as `run`.
    capabilityProfile: loadProfileForEval(),
    // `FR-024`, exactly as `run` asks it.
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
    if (outcome.evidence !== undefined) {
      console.log(
        `     composition ${outcome.evidence.fragmentsCompositionHash.slice(0, 16)} · captured ${outcome.evidence.capturedAt}`,
      );
    }
    // Every assertion, not just the failures. This command exists to report a
    // verdict on held evidence, and a reader deciding admission needs to see
    // what was actually evaluated — including what was deferred and therefore
    // judged nothing.
    for (const a of outcome.assertions) {
      const status =
        a.status === "failed" && a.advisory === true
          ? "warn"
          : { passed: "  ok", failed: "FAIL", deferred: "  --" }[a.status];
      console.log(
        `     ${status} ${a.id}${a.detail === "" ? "" : ` — ${a.detail}`}`,
      );
    }
  }

  const t = report.totals;
  console.log(
    `\n${String(t.passed)} passed · ${String(t.failed)} failed · ${String(t.blocked)} blocked · ` +
      `${String(t.stale)} stale · ${String(t.errored)} errored`,
  );
  console.log(
    "\n⚠️  This is an inspection, not a gate result. No pass reference was issued\n" +
      "   and coverage is unchanged — activation still requires admitted evidence.",
  );

  // Three outcomes told apart, because they mean different things to the
  // admission decision: 0 the evidence answers and passes, 1 it answers and
  // fails, 2 it could not be evaluated at all.
  const unevaluated = t.blocked + t.stale + t.errored;
  process.exit(unevaluated > 0 ? 2 : t.failed > 0 ? 1 : 0);
}

console.error(
  "Usage: regression.mts <status|recordings:check|recordings:write|capture|run|evaluate>\n" +
    "       capture  [--dry-run] [--force] [--case=<id>]...\n" +
    "       run      [--case=<id>]...\n" +
    "       evaluate --case=<id>... [--from=<dir>]   read-only; issues no reference",
);
process.exit(2);
