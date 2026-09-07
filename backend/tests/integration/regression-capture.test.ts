/**
 * Integration — the recording capture path (`AI §12.3`, `docs/12` D-24).
 *
 * Capture is the one operation in this repository that spends money, so its
 * plumbing is proved offline first: the production pipeline runs against the
 * dry-run responder, and every hash, validation, refusal and manifest update
 * is asserted without a credential, a network call or a cent.
 *
 * The strongest assertions here are the refusals — capture must not overwrite
 * paid evidence, must not launder tampered evidence by rebuilding the manifest
 * over it, and must not write a recording for a run that failed.
 *
 * ZERO PROVIDER CALLS. The only adapter used is `createDryRunAdapter`, which
 * returns canned strings; a test that reached a network would fail here with no
 * credential configured.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  captureCase,
  captureCases,
  CaptureRefusedError,
  writeFailureRecord,
  type CaptureFailureRecord,
} from "../../src/regression/capture.js";
import {
  createDryRunAdapter,
  DRY_RUN_ADAPTER_ID,
} from "../../src/regression/dry-run-adapter.js";
import {
  parseCorpusCase,
  type CorpusCase,
} from "../../src/regression/corpus.js";
import {
  createRecordingStore,
  detectRecordingDrift,
  fragmentsCompositionHash,
  inputTextHash,
  isCleanRecordingSet,
  MANIFEST_FILENAME,
} from "../../src/regression/recording-store.js";
import { runRegression } from "../../src/regression/runner.js";
import { buildPassReference } from "../../src/regression/pass-reference.js";
import type {
  FragmentResolver,
  ResolvedFragment,
} from "../../src/nie/ports.js";
import type { ProviderAdapter } from "../../src/provider/capability.js";

const TEXT = [
  "We need to automate our supplier invoice approval process.",
  "Invoices arrive as PDF attachments and finance keys each one into Xero.",
  "Volumes run about 450 per month from 90 suppliers.",
].join("\n");

const resolver: FragmentResolver = {
  resolve: (keys: readonly string[]): Promise<readonly ResolvedFragment[]> =>
    Promise.resolve(
      keys.map((fragmentKey, i): ResolvedFragment => ({
        fragmentKey,
        fragmentVersionId: `version-${String(i)}`,
        version: "1",
        content: `[${fragmentKey}]`,
      })),
    ),
};

const corpusCase = (overrides: Record<string, string> = {}): CorpusCase => {
  const fields = {
    case_id: "cc-001",
    input_type: "business_requirement",
    expected_classification: "business_requirement",
    special_class: "null",
    bound: "at_or_above_threshold",
    ...overrides,
  };
  return parseCorpusCase(
    [
      `case_id: ${fields["case_id"] as string}`,
      `input_type: ${fields["input_type"] as string}`,
      "content: |",
      ...TEXT.split("\n").map((l) => `  ${l}`),
      `character_count: ${String(TEXT.length)}`,
      `expected_classification: ${fields["expected_classification"] as string}`,
      "expected_artifact_set:",
      "  - architecture_recommendation",
      "expected_omissions: []",
      "expected_confidence_band: high",
      "expected_classification_confidence:",
      `  bound: ${fields["bound"] as string}`,
      "  threshold: 0.6",
      "  rationale: Synthetic fixture.",
      "case_character: central",
      `special_class: ${fields["special_class"] as string}`,
      "rationale: Synthetic fixture for the capture test.",
      "provenance:",
      "  origin: synthetic",
      "added: 2026-08-14",
      "frozen_at: 2026-08-14T00:00:00Z",
      "corpus_version: corpus-v1",
      "",
    ].join("\n"),
    "tests/regression-capture.test.ts",
  );
};

const tempRoot = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "naigx-capture-"));

const options = (
  root: string,
  cases: readonly CorpusCase[],
  overrides: Partial<Parameters<typeof captureCases>[0]> = {},
) => ({
  cases,
  adapterFor: createDryRunAdapter,
  resolver,
  store: createRecordingStore(root),
  rate: {
    inputUsdPerMillionTokens: "0.00",
    outputUsdPerMillionTokens: "0.00",
  },
  modelKey: "dry-run",
  adapterId: DRY_RUN_ADAPTER_ID,
  fragmentsManifestVersion: "fragments-v1",
  lowVarianceSampling: true,
  now: () => new Date(0),
  // Quarantine into the temp root by default. Without this the default writer
  // files under `research/regression-failures/`, and a test suite must not
  // leave artefacts in the repository.
  quarantine: (record: CaptureFailureRecord) =>
    writeFailureRecord(record, path.join(root, "failures")),
  ...overrides,
});

const withRoot = async (fn: (root: string) => Promise<void>): Promise<void> => {
  const root = tempRoot();
  try {
    await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

// --- the happy path -------------------------------------------------------

test("capture runs the production pipeline and writes a valid recording", async () => {
  await withRoot(async (root) => {
    const target = corpusCase();
    const report = await captureCases(options(root, [target]));

    assert.deepEqual(report.totals, {
      selected: 1,
      captured: 1,
      skipped: 0,
      failed: 0,
      providerCalls: 4,
    });

    const store = createRecordingStore(root);
    const verified = store.read("corpus-v1", "cc-001");
    assert.ok(
      verified,
      "the recording is written and passes the manifest gate",
    );

    const { recording } = verified;
    assert.equal(recording.provider.adapter, DRY_RUN_ADAPTER_ID);
    assert.equal(recording.fragmentsManifestVersion, "fragments-v1");
    assert.equal(recording.inputTextHash, inputTextHash(target.inputText));
    assert.equal(
      recording.fragmentsCompositionHash,
      await fragmentsCompositionHash(recording.stages, resolver),
      "the composition hash is computed from the fragments actually composed",
    );

    // All four implemented stages, in pipeline order, with the classification
    // in force carried on every stage after the first.
    assert.deepEqual(
      recording.stages.map((s) => s.stageKey),
      [
        "input_classification",
        "intent_detection",
        "context_extraction",
        "architecture_analysis",
      ],
    );
    assert.equal(recording.stages[0]?.classifiedAs, undefined);
    assert.ok(
      recording.stages
        .slice(1)
        .every((s) => s.classifiedAs === "business_requirement"),
    );
  });
});

test("the manifest is updated so the evidence gate is clean afterwards", async () => {
  await withRoot(async (root) => {
    const report = await captureCases(options(root, [corpusCase()]));
    assert.equal(report.manifestUpdated, true);

    const store = createRecordingStore(root);
    assert.ok(
      isCleanRecordingSet(
        detectRecordingDrift(
          store.hashes("corpus-v1"),
          store.readManifest("corpus-v1"),
        ),
      ),
      "capture leaves the store in the state the gate expects",
    );
    assert.ok(fs.existsSync(path.join(root, "corpus-v1", MANIFEST_FILENAME)));
  });
});

test("what capture writes is what the runner can replay", async () => {
  // The end-to-end proof that the two halves agree: capture, then run recorded
  // mode over the result and issue a pass reference — all offline.
  await withRoot(async (root) => {
    const target = corpusCase();
    await captureCases(options(root, [target]));

    const report = await runRegression({
      cases: [target],
      suiteVersion: "corpus-v2",
      store: createRecordingStore(root),
      resolver,
      repeat: 2,
    });

    assert.equal(report.totals.passed, 1, "the captured evidence replays");
    assert.equal(report.totals.stale, 0);
    assert.ok(
      buildPassReference({ report, fragmentsManifestVersion: "fragments-v1" }),
    );
  });
});

// --- halts capture fewer stages, and that is correct ---------------------

test("an expected refusal records only the stages that ran", async () => {
  await withRoot(async (root) => {
    const target = corpusCase({
      case_id: "cc-002",
      expected_classification: "unsupported",
      special_class: "unsupported",
    });
    const report = await captureCases(options(root, [target]));

    assert.equal(report.totals.captured, 1);
    assert.equal(
      report.cases[0]?.providerCalls,
      1,
      "an unsupported input declines at Stage 1 (FR-092), so one call",
    );

    const verified = createRecordingStore(root).read("corpus-v1", "cc-002");
    assert.deepEqual(
      verified?.recording.stages.map((s) => s.stageKey),
      ["input_classification"],
    );
  });
});

test("an insufficiency halt records three stages (AI §5.4)", async () => {
  await withRoot(async (root) => {
    const target = corpusCase({
      case_id: "cc-003",
      special_class: "insufficient",
    });
    const report = await captureCases(options(root, [target]));

    assert.equal(report.cases[0]?.providerCalls, 3);
    const verified = createRecordingStore(root).read("corpus-v1", "cc-003");
    assert.equal(verified?.recording.stages.length, 3);
  });
});

// --- the refusals ---------------------------------------------------------

test("capture will not overwrite existing evidence without --force", async () => {
  await withRoot(async (root) => {
    const target = corpusCase();
    await captureCases(options(root, [target]));
    const first = createRecordingStore(root).read("corpus-v1", "cc-001");

    const second = await captureCases(
      options(root, [target], { now: () => new Date(86_400_000) }),
    );

    assert.equal(second.totals.skipped, 1);
    assert.equal(second.totals.captured, 0);
    assert.equal(
      second.totals.providerCalls,
      0,
      "a skip must not spend anything",
    );
    assert.match(second.cases[0]?.detail ?? "", /--force/);
    assert.equal(
      createRecordingStore(root).read("corpus-v1", "cc-001")?.recording
        .capturedAt,
      first?.recording.capturedAt,
      "the paid baseline is untouched",
    );
  });
});

test("--force re-captures deliberately", async () => {
  await withRoot(async (root) => {
    const target = corpusCase();
    await captureCases(options(root, [target]));

    const again = await captureCases(
      options(root, [target], { force: true, now: () => new Date(86_400_000) }),
    );

    assert.equal(again.totals.captured, 1);
    assert.equal(
      createRecordingStore(root).read("corpus-v1", "cc-001")?.recording
        .capturedAt,
      new Date(86_400_000).toISOString(),
    );
  });
});

test("capture refuses to start when the store disagrees with its manifest", async () => {
  await withRoot(async (root) => {
    const target = corpusCase();
    await captureCases(options(root, [target]));

    // Someone edits captured evidence. Rebuilding the manifest over it would
    // launder the edit, so capture must refuse rather than proceed.
    const file = path.join(root, "corpus-v1", "cc-001.json");
    fs.writeFileSync(
      file,
      fs.readFileSync(file, "utf8").replace("Dry Run Component", "Edited"),
    );

    await assert.rejects(
      captureCases(
        options(root, [corpusCase({ case_id: "cc-004" })], { force: true }),
      ),
      CaptureRefusedError,
    );
  });
});

test("a failed pipeline run writes no recording", async () => {
  await withRoot(async (root) => {
    const target = corpusCase();
    // An adapter whose Stage 1 answer no stage can parse.
    const broken: ProviderAdapter = {
      capabilities: {
        structuredOutput: false,
        extendedContext: false,
        lowVarianceSampling: true,
        costLatencyTier: "test",
      },
      invoke: () =>
        Promise.resolve({
          output: "not JSON at all",
          usage: { inputTokens: 1, outputTokens: 1, latencyMs: 1 },
          degradations: [],
        }),
    };

    const report = await captureCases(
      options(root, [target], { adapterFor: () => broken }),
    );

    assert.equal(report.totals.failed, 1);
    assert.equal(report.totals.captured, 0);
    assert.equal(report.manifestUpdated, false);
    assert.equal(
      createRecordingStore(root).list("corpus-v1").length,
      0,
      "a partial capture is not evidence",
    );
  });
});

test("a systematic failure aborts the batch instead of spending it", async () => {
  // What the first dry run showed: every case failed for the same
  // infrastructure reason, and the batch worked through all thirteen. On a
  // paid run that is thirteen charges to learn one fact.
  await withRoot(async (root) => {
    const cases = [
      corpusCase({ case_id: "cc-020" }),
      corpusCase({ case_id: "cc-021" }),
      corpusCase({ case_id: "cc-022" }),
      corpusCase({ case_id: "cc-023" }),
    ];
    const unreachable: ProviderAdapter = {
      capabilities: {
        structuredOutput: false,
        extendedContext: false,
        lowVarianceSampling: true,
        costLatencyTier: "test",
      },
      invoke: () => Promise.reject(new Error("ECONNREFUSED")),
    };

    const report = await captureCases(
      options(root, cases, { adapterFor: () => unreachable }),
    );

    assert.equal(report.aborted, true);
    assert.equal(report.totals.failed, 2, "stops at the second failure");
    assert.equal(report.totals.skipped, 2, "the rest are not attempted");
    assert.deepEqual(
      report.cases.slice(2).map((c) => c.status),
      ["skipped", "skipped"],
    );
    assert.match(report.cases[3]?.detail ?? "", /not attempted/);
  });
});

test("a single failure does not abort a batch that is otherwise working", async () => {
  await withRoot(async (root) => {
    const good = corpusCase({ case_id: "cc-030" });
    const bad = corpusCase({ case_id: "cc-031" });
    const alsoGood = corpusCase({ case_id: "cc-032" });

    const brokenOnce: ProviderAdapter = {
      capabilities: {
        structuredOutput: false,
        extendedContext: false,
        lowVarianceSampling: true,
        costLatencyTier: "test",
      },
      invoke: () =>
        Promise.resolve({
          output: "not JSON",
          usage: { inputTokens: 1, outputTokens: 1, latencyMs: 1 },
          degradations: [],
        }),
    };

    const report = await captureCases(
      options(root, [good, bad, alsoGood], {
        adapterFor: (c) =>
          c.caseId === "cc-031" ? brokenOnce : createDryRunAdapter(c),
      }),
    );

    assert.equal(report.aborted, false);
    assert.equal(report.totals.captured, 2);
    assert.equal(report.totals.failed, 1);
  });
});

// --- selection ------------------------------------------------------------

test("capture takes the selection it is given, case by case", async () => {
  await withRoot(async (root) => {
    const cases = [
      corpusCase({ case_id: "cc-010" }),
      corpusCase({ case_id: "cc-011" }),
      corpusCase({ case_id: "cc-012" }),
    ];
    const report = await captureCases(options(root, cases));

    assert.equal(report.totals.captured, 3);
    assert.equal(report.totals.providerCalls, 12, "four stages per case");
    assert.deepEqual(createRecordingStore(root).list("corpus-v1"), [
      "cc-010",
      "cc-011",
      "cc-012",
    ]);
  });
});

// --- the dry-run responder is honest about what it is --------------------

test("captureCase reports the calls it made and the adapter that answered", async () => {
  const target = corpusCase();
  const { recording, providerCalls } = await captureCase(
    target,
    options(tempRoot(), [target]),
  );

  assert.equal(providerCalls, 4);
  assert.equal(recording.provider.adapter, DRY_RUN_ADAPTER_ID);
  assert.equal(
    recording.stages.every((s) => s.inputTokens === 0),
    true,
    "the dry run spends nothing and records no fictional token counts",
  );
});

test("the dry-run adapter refuses stages it has no answer for", async () => {
  const adapter = createDryRunAdapter(corpusCase());
  await assert.rejects(
    adapter.invoke({
      task: "knowledge_assembly",
      input: "x",
      preferLowVariance: true,
    }),
    /no answer for stage knowledge_assembly/,
  );
});

// --- paid-call accounting and failure quarantine -------------------------

/** An adapter that answers Stage 1 and then breaks, as the br-001 run did. */
const failsAfter = (goodStages: number): ProviderAdapter => {
  let call = 0;
  return {
    capabilities: {
      structuredOutput: false,
      extendedContext: false,
      lowVarianceSampling: true,
      costLatencyTier: "test",
    },
    invoke: (request) => {
      call += 1;
      if (call > goodStages) {
        return Promise.resolve({
          output: "the model wrote prose instead of JSON",
          usage: { inputTokens: 2200, outputTokens: 180, latencyMs: 900 },
          degradations: [],
        });
      }
      return createDryRunAdapter(corpusCase()).invoke(request);
    },
  };
};

test("a failure after provider calls reports the calls actually made", async () => {
  await withRoot(async (root) => {
    const quarantined: unknown[] = [];
    const report = await captureCases(
      options(root, [corpusCase()], {
        adapterFor: () => failsAfter(2),
        quarantine: (record) => quarantined.push(record),
      }),
    );

    assert.equal(report.totals.failed, 1);
    assert.equal(
      report.cases[0]?.providerCalls,
      3,
      "three calls completed and were billed — the third returned successfully " +
        "and only then failed to parse, which is still a call that was paid for",
    );
    assert.equal(
      report.totals.providerCalls,
      3,
      "the batch total counts spend on failed cases too",
    );
    assert.notEqual(
      report.cases[0]?.providerCalls,
      0,
      "reporting 0 after real spend is what made the first paid run look free",
    );
    assert.equal(quarantined.length, 1);
  });
});

test("a failed capture is quarantined with the raw responses that were paid for", async () => {
  await withRoot(async (root) => {
    const quarantined: CaptureFailureRecord[] = [];
    await captureCases(
      options(root, [corpusCase()], {
        adapterFor: () => failsAfter(2),
        quarantine: (record) => quarantined.push(record),
      }),
    );

    const record = quarantined[0];
    assert.ok(record);
    assert.equal(record.caseId, "cc-001");
    assert.equal(record.providerCalls, 3);
    assert.equal(record.failure.stageNumber, 3);
    assert.equal(record.failure.stageKey, "context_extraction");
    assert.equal(record.responses.length, 3);
    assert.deepEqual(
      record.responses.map((r) => r.task),
      ["input_classification", "intent_detection", "context_extraction"],
    );
    assert.ok(
      record.responses[0]?.output.includes("determined_type"),
      "the raw response is retained, so diagnosis costs nothing further",
    );
    assert.match(
      record.responses[2]?.output ?? "",
      /prose instead of JSON/,
      "the response that FAILED is retained — the whole point of the quarantine",
    );
  });
});

test("quarantined failures never become evidence", async () => {
  await withRoot(async (root) => {
    const report = await captureCases(
      options(root, [corpusCase()], {
        adapterFor: () => failsAfter(2),
        quarantine: () => undefined,
      }),
    );

    const store = createRecordingStore(root);
    assert.equal(report.manifestUpdated, false);
    assert.deepEqual(store.list("corpus-v1"), []);
    assert.equal(store.readManifest("corpus-v1"), undefined);
    assert.equal(store.read("corpus-v1", "cc-001"), undefined);
  });
});

test("the quarantine writer files outside the recording store entirely", async () => {
  await withRoot(async (root) => {
    const failureRoot = path.join(root, "failures");
    writeFailureRecord(
      {
        caseId: "cc-001",
        corpusVersion: "corpus-v1",
        failedAt: "2026-08-14T00:00:00.000Z",
        provider: { adapter: "test", modelKey: "test" },
        failure: {
          stageNumber: 6,
          stageKey: "architecture_analysis",
          message: "x",
        },
        providerCalls: 4,
        responses: [],
      },
      failureRoot,
    );

    const written = fs.readdirSync(path.join(failureRoot, "corpus-v1"));
    assert.equal(written.length, 1);
    assert.match(written[0] ?? "", /^cc-001-/);
    // The recording store sees nothing: different root, and the gate only ever
    // reads `<recording root>/<corpus version>/*.json`.
    assert.deepEqual(createRecordingStore(root).list("corpus-v1"), []);
  });
});

// --- the capability profile reaches both capture paths --------------------

test("the capture script loads the capability profile before the dry-run branch", () => {
  // ⚠️ REGRESSION, and the expensive kind. `capabilityProfile` was loaded only
  // inside `if (dryRun)`, so a *paid* job-description capture ran with none —
  // and Stage 7 refuses without an inventory to compare against (`FR-022`).
  // The run would have billed three stages per case and produced recordings
  // with no verdict, no criteria and no artifact plan: exactly the evidence
  // the capture would have been bought for.
  //
  // Asserted against the source because the seam is a CLI entry point. The
  // behavioural half is the test below, which shows what its absence costs.
  const script = fs.readFileSync(
    path.join(process.cwd(), "scripts", "regression.mts"),
    "utf8",
  );

  const load = script.indexOf("loadCapabilityProfile()");
  const branch = script.indexOf("if (dryRun) {");

  assert.ok(load > 0, "the script loads a capability profile");
  assert.ok(branch > 0, "the dry-run branch exists");
  assert.ok(
    load < branch,
    "the profile must load before the dry-run branch, or the paid path runs without one",
  );
  assert.ok(
    !script.includes("dryRunProfile"),
    "a dry-run-only profile variable is what caused this defect",
  );
  assert.match(
    script,
    /capabilityProfile,/,
    "and it must be passed to captureCases unconditionally",
  );
});

test("without a profile a job-description case never reaches Stage 7", async () => {
  // The behaviour the assertion above protects. Stage 7 is where the JD path
  // earns C-6's evidence, and it does not start without an inventory.
  await withRoot(async (root) => {
    const target = corpusCase({
      case_id: "jd-profile-check",
      input_type: "job_description",
      expected_classification: "job_description",
    });

    await captureCases(options(root, [target]));

    const verified = createRecordingStore(root).read(
      "corpus-v1",
      "jd-profile-check",
    );
    const stages = verified?.recording.stages.map((s) => s.stageKey) ?? [];

    assert.ok(
      !stages.includes("recommendation_generation"),
      "a capture with no capability profile cannot produce a verdict",
    );
    assert.ok(
      !stages.includes("portfolio_suggestions"),
      "and therefore no artifact either — C-3 and C-6 would both be starved",
    );
  });
});
