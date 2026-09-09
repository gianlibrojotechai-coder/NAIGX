/**
 * Integration � the recorded-mode regression runner (`AI §12.3`, `NFR-043`,
 * `FR-024`, `DB §4.5`).
 *
 * The runner drives the **production** pipeline, provider abstraction and
 * replay adapter. What is synthetic here is only the evidence: a corpus case
 * and a recorded provider answer, both built in this file.
 *
 * WHY THE FIXTURES ARE LOCAL AND NOT IN THE RECORDING STORE. A recording is
 * evidence of what a provider said when shown a corpus case. Writing an
 * invented one into `research/regression-recordings/` would manufacture exactly
 * that evidence, and a later run could not tell it from a captured one. These
 * live in the test, where their nature is obvious.
 *
 * THE MOST IMPORTANT TEST HERE IS THAT THE SUITE CAN GO RED. A gate that cannot
 * fail measures nothing � `SA AR-43` in a new costume.
 *
 * Runs entirely offline: no database, no network, no credential, no provider.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseCorpusCase,
  type CorpusCase,
} from "../../src/regression/corpus.js";
import {
  fragmentsCompositionHash,
  inputTextHash,
  recordingFileHash,
  RecordingIntegrityError,
  type CaseRecording,
  type RecordingStore,
} from "../../src/regression/recording-store.js";
import { createRecordedProvider } from "../../src/harness/recordings.js";
import { runRegression } from "../../src/regression/runner.js";
import { buildPassReference } from "../../src/regression/pass-reference.js";
import type {
  FragmentResolver,
  ResolvedFragment,
} from "../../src/nie/ports.js";

const TEXT = [
  "We need to automate our supplier invoice approval process.",
  "Invoices arrive as PDF attachments and finance keys each one into Xero by hand.",
  "Volumes run about 450 per month from 90 suppliers.",
  "Approvals take 5-9 days and we miss early-payment discounts as a result.",
].join("\n");

/** Resolves any fragment key deterministically � the pipeline-test pattern. */
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

/** Builds a corpus case through the real loader, so it is a real oracle. */
const corpusCase = (overrides: Record<string, string> = {}): CorpusCase => {
  const fields: Record<string, string> = {
    case_id: "tt-001",
    input_type: "business_requirement",
    expected_classification: "business_requirement",
    expected_confidence_band: "high",
    bound: "at_or_above_threshold",
    special_class: "null",
    ...overrides,
  };
  const yaml = [
    `case_id: ${fields["case_id"] as string}`,
    `input_type: ${fields["input_type"] as string}`,
    "content: |",
    ...TEXT.split("\n").map((l) => `  ${l}`),
    `character_count: ${String(TEXT.length)}`,
    `expected_classification: ${fields["expected_classification"] as string}`,
    "expected_artifact_set:",
    "  - architecture_recommendation",
    "expected_omissions: []",
    `expected_confidence_band: ${fields["expected_confidence_band"] as string}`,
    "expected_classification_confidence:",
    `  bound: ${fields["bound"] as string}`,
    "  threshold: 0.6",
    "  rationale: Synthetic fixture.",
    "case_character: central",
    `special_class: ${fields["special_class"] as string}`,
    "rationale: Synthetic fixture for the runner test.",
    "provenance:",
    "  origin: synthetic",
    "added: 2026-08-14",
    "frozen_at: 2026-08-14T00:00:00Z",
    "corpus_version: corpus-v1",
    "",
  ].join("\n");
  return parseCorpusCase(yaml, "tests/regression-runner.test.ts");
};

const STAGE_OUTPUTS = {
  classification: JSON.stringify({
    determined_type: "business_requirement",
    confidence: 0.91,
    candidate_types: ["business_requirement"],
  }),
  intent: JSON.stringify({
    primary_objective: {
      content: "Automate invoice capture and approval",
      provenance: "stated",
    },
    secondary_objectives: [],
    inferred_scope: "Accounts payable",
  }),
  context: JSON.stringify({
    elements: [
      {
        id: "e1",
        content: "Invoices arrive as PDF attachments",
        category: "environment",
        provenance: "stated",
        source_quote: "Invoices arrive as PDF attachments",
        specificity_score: 0.9,
      },
      {
        id: "e2",
        content: "Roughly 450 invoices per month",
        category: "constraint",
        provenance: "stated",
        source_quote: "about 450 per month",
        specificity_score: 0.8,
      },
    ],
    sufficiency: "sufficient",
  }),
  architecture: JSON.stringify({
    summary: "Automated invoice capture with approval routing",
    data_flow_description: "Mailbox to capture to Xero",
    components: [
      {
        name: "Invoice Capture",
        responsibility: "Capture inbound invoice attachments",
        inputs: "Email messages with attachments",
        outputs: "Normalised invoice records",
        failure_handling: "Retry with backoff; quarantine unparseable files",
        grounded_in_context_indices: [0, 1],
      },
    ],
  }),
  // D-78: the requirement path's Stage 9 generator, grounded in the one
  // component above and the context's first element.
  platform: JSON.stringify({
    criteria_applied: [
      {
        criterion:
          "Invoices arrive as attachments, so capture starts from the mailbox",
        context_index: 0,
        component: null,
      },
    ],
    recommended_platform: "n8n",
    also_required: [],
    rationale:
      "A workflow platform with a mailbox trigger covers the one component.",
    alternatives_rejected: [
      {
        platform: "Custom code",
        rejection_reason: "Nothing in the context names a developer to own it.",
      },
    ],
    fit: [
      {
        component: "Invoice Capture",
        how: "IMAP trigger with attachment extraction",
      },
    ],
    knowledge_currency_note:
      "Platform capabilities and pricing change; verify before committing.",
  }),
  // D-80: five placeholder factor scores.
  complexity: JSON.stringify({
    factors: [
      "workflow",
      "integration",
      "data_logic",
      "failure_risk",
      "operational",
    ].map((factor) => ({
      factor,
      score: 2,
      justification: "A placeholder justification for this design",
    })),
  }),
  // D-79: the risk register against the one component.
  risk: JSON.stringify({
    risks: [
      {
        component: "Invoice Capture",
        description:
          "An unreadable attachment is quarantined and waits unnoticed",
        severity: 3,
        likelihood: 3,
        mitigation: "Alert finance on every quarantine",
      },
    ],
    no_risks_statement: null,
  }),
};

const ALL_STAGES = [
  { key: "input_classification", of: "classification" },
  { key: "intent_detection", of: "intent" },
  { key: "context_extraction", of: "context" },
  { key: "architecture_analysis", of: "architecture" },
  { key: "platform_recommendation", of: "platform" },
  { key: "risk_assessment", of: "risk" },
  { key: "complexity_assessment", of: "complexity" },
] as const;

/**
 * Builds a recording, including the composition hash the runner now checks.
 *
 * `upTo` truncates the recording � that is how a partial capture is expressed,
 * and the case that used to pass silently.
 */
const recordingFor = async (
  target: CorpusCase,
  options: {
    outputs?: typeof STAGE_OUTPUTS;
    upTo?: number;
    lowVarianceSampling?: boolean;
  } = {},
): Promise<CaseRecording> => {
  const outputs = options.outputs ?? STAGE_OUTPUTS;
  const tokens = { inputTokens: 500, outputTokens: 200, latencyMs: 1000 };
  const stages = ALL_STAGES.slice(0, options.upTo ?? ALL_STAGES.length).map(
    (s) => ({
      stageKey: s.key,
      ...(s.key === "input_classification"
        ? {}
        : { classifiedAs: "business_requirement" as const }),
      output: outputs[s.of],
      ...tokens,
    }),
  );

  return {
    caseId: target.caseId,
    corpusVersion: target.corpusVersion,
    inputTextHash: inputTextHash(target.inputText),
    fragmentsManifestVersion: "fragments-v1",
    fragmentsCompositionHash: await fragmentsCompositionHash(stages, resolver),
    capturedAt: "2026-08-14T00:00:00Z",
    provider: { adapter: "test", modelKey: "test-model" },
    lowVarianceSampling: options.lowVarianceSampling ?? true,
    stages,
  };
};

/** In-memory store � the filesystem store and its gate are unit-tested. */
const storeOf = (...recordings: CaseRecording[]): RecordingStore => {
  const byKey = new Map(
    recordings.map((r) => [`${r.corpusVersion}/${r.caseId}`, r]),
  );
  return {
    read: (corpusVersion, caseId) => {
      const recording = byKey.get(`${corpusVersion}/${caseId}`);
      return recording === undefined
        ? undefined
        : {
            recording,
            contentHash: recordingFileHash(JSON.stringify(recording)),
          };
    },
    list: () => [...byKey.values()].map((r) => r.caseId),
    hashes: () => ({}),
    readManifest: () => undefined,
    writeManifest: () => undefined,
    write: () => {
      throw new Error("the runner must never write a recording");
    },
  };
};

/** A store whose evidence fails the manifest gate. */
const tamperedStore = (): RecordingStore => ({
  ...storeOf(),
  read: () => {
    throw new RecordingIntegrityError(
      "br-001.json: content hash abc does not match the manifest's def � the recording was edited after it was recorded",
    );
  },
});

const run = (cases: readonly CorpusCase[], store: RecordingStore, repeat = 1) =>
  runRegression({
    cases,
    suiteVersion: "corpus-v2",
    store,
    resolver,
    repeat,
    now: () => new Date(0),
  });

const NO_STALE = { blocked: 0, stale: 0, errored: 0 } as const;

// --- a recorded case runs and passes -------------------------------------

test("a case with a recording runs through the real pipeline and passes", async () => {
  const target = corpusCase();
  const report = await run([target], storeOf(await recordingFor(target)));

  assert.equal(report.mode, "recorded");
  assert.deepEqual(report.totals, {
    selected: 1,
    passed: 1,
    failed: 0,
    ...NO_STALE,
  });

  const outcome = report.cases[0];
  assert.ok(outcome);
  const byId = new Map(outcome.assertions.map((a) => [a.id, a]));
  assert.equal(byId.get("classification")?.status, "passed");
  assert.equal(byId.get("classification_confidence_bound")?.status, "passed");
  assert.equal(byId.get("reference_integrity")?.status, "passed");
  assert.equal(byId.get("run_completeness")?.status, "passed");
  // What the run did not measure is stated, not omitted.
  assert.equal(byId.get("artifact_set")?.status, "deferred");
  assert.equal(byId.get("confidence_band")?.status, "deferred");

  // Only what actually ran is reported as evaluated.
  assert.ok(outcome.assertionsEvaluated.includes("classification"));
  assert.ok(
    !outcome.assertionsEvaluated.includes("confidence_band"),
    "a deferred assertion measured nothing and must not count as coverage",
  );
  assert.ok(
    !outcome.assertionsEvaluated.includes("refusal_behaviour"),
    "no refusal is expected for an ordinary case, so none was evaluated",
  );
  assert.ok(outcome.evidence?.recordingHash);
});

test("a recording that lacks a stage the path now runs fails, not passes (docs/51 D-76 §4)", async () => {
  // D-76 §4 found that a stage ADDED to a path was invisible to the runner:
  // run_completeness judged against the stages the recording held. Since
  // D-77 evaluates artifact_generation, a recording with no answer for a
  // generator stage makes the replay adapter refuse the request, the
  // generator records a failed artifact, and the case fails. Confirmed live
  // on 2026-09-10 with the pre-D-80 br-001 recording; pinned here.
  const target = corpusCase();
  const report = await run(
    [target],
    storeOf(await recordingFor(target, { upTo: ALL_STAGES.length - 1 })),
  );

  assert.equal(report.totals.failed, 1, "the missing stage must fail the case");
  const outcome = report.cases[0];
  assert.ok(outcome);
  const byId = new Map(outcome.assertions.map((a) => [a.id, a]));
  assert.equal(byId.get("artifact_generation")?.status, "failed");
  assert.match(
    byId.get("artifact_generation")?.detail ?? "",
    /complexity_score/,
  );
  // The run itself completed: a failed generator does not halt the path.
  assert.equal(byId.get("run_completeness")?.status, "passed");
});

// --- the suite can go red -------------------------------------------------

test("a wrong classification expectation fails the case", async () => {
  const target = corpusCase({ expected_classification: "existing_workflow" });
  const report = await run([target], storeOf(await recordingFor(target)));

  assert.equal(report.totals.failed, 1);
  const failure = report.cases[0]?.assertions.find(
    (a) => a.id === "classification",
  );
  assert.equal(failure?.status, "failed");
  assert.match(
    failure?.detail ?? "",
    /expected existing_workflow, got business_requirement/,
  );
});

test("a wrong confidence bound fails the case (FR-011, FR-015)", async () => {
  const target = corpusCase({ bound: "below_threshold" });
  const report = await run([target], storeOf(await recordingFor(target)));

  assert.equal(report.totals.failed, 1);
  assert.equal(
    report.cases[0]?.assertions.find(
      (a) => a.id === "classification_confidence_bound",
    )?.status,
    "failed",
  );
});

test("an expected refusal that does not happen fails (docs/11 §3)", async () => {
  const target = corpusCase({
    special_class: "unsupported",
    expected_classification: "unsupported",
  });
  const report = await run([target], storeOf(await recordingFor(target)));

  assert.equal(report.totals.failed, 1);
  const outcome = report.cases[0];
  assert.ok(outcome);
  const ids = outcome.assertions
    .filter((a) => a.status === "failed")
    .map((a) => a.id);
  assert.ok(ids.includes("refusal_behaviour"));
  assert.ok(ids.includes("classification"));
});

// --- a partial recording can no longer pass ------------------------------

const INSUFFICIENT_CONTEXT = JSON.stringify({
  elements: [
    {
      id: "e1",
      content: "Invoices arrive as PDF attachments",
      category: "environment",
      provenance: "stated",
      source_quote: "Invoices arrive as PDF attachments",
      specificity_score: 0.9,
    },
  ],
  sufficiency: "insufficient",
});

test("a truncated recording claiming insufficiency fails an ordinary case", async () => {
  // The hole this closes: three stages, a context output claiming
  // `insufficient`, and the run halts at Stage 3. Classification and the
  // confidence bound still passed, reference integrity passed vacuously � so
  // the case reported PASS having produced no architecture at all.
  const target = corpusCase();
  const report = await run(
    [target],
    storeOf(
      await recordingFor(target, {
        upTo: 3,
        outputs: { ...STAGE_OUTPUTS, context: INSUFFICIENT_CONTEXT },
      }),
    ),
  );

  assert.equal(report.totals.failed, 1, "a partial run must not pass");
  const completeness = report.cases[0]?.assertions.find(
    (a) => a.id === "run_completeness",
  );
  assert.equal(completeness?.status, "failed");
  assert.match(completeness?.detail ?? "", /no architecture was produced/);
  assert.equal(
    buildPassReference({ report, fragmentsManifestVersion: "fragments-v1" }),
    null,
  );
});

test("a truncated recording is still correct when the case expects a halt", async () => {
  // Symmetry matters: a rule that failed every early halt would fail br-005
  // and un-001, which are supposed to stop early.
  const target = corpusCase({ special_class: "insufficient" });
  const report = await run(
    [target],
    storeOf(
      await recordingFor(target, {
        upTo: 3,
        outputs: { ...STAGE_OUTPUTS, context: INSUFFICIENT_CONTEXT },
      }),
    ),
  );

  assert.equal(report.totals.passed, 1);
  assert.equal(
    report.cases[0]?.assertions.find((a) => a.id === "run_completeness")
      ?.status,
    "passed",
  );
});

// --- missing, stale, and tampered evidence -------------------------------

test("a case with no recording is blocked, not passed and not failed", async () => {
  const report = await run([corpusCase()], storeOf());

  assert.deepEqual(report.totals, {
    selected: 1,
    passed: 0,
    failed: 0,
    blocked: 1,
    stale: 0,
    errored: 0,
  });
  assert.match(report.cases[0]?.detail ?? "", /no recording captured/);
});

test("a recording captured against different text is blocked (docs/12 D-19)", async () => {
  const target = corpusCase();
  const wrongText: CaseRecording = {
    ...(await recordingFor(target)),
    inputTextHash: inputTextHash("some other requirement entirely"),
  };
  const report = await run([target], storeOf(wrongText));

  assert.equal(report.totals.blocked, 1);
  assert.match(report.cases[0]?.detail ?? "", /recapture required/);
});

test("a fragment change reports stale, not a provider error (docs/12 D-24)", async () => {
  const target = corpusCase();
  const afterEdit: CaseRecording = {
    ...(await recordingFor(target)),
    fragmentsCompositionHash: "0".repeat(64),
  };
  const report = await run([target], storeOf(afterEdit));

  assert.equal(report.totals.stale, 1, "stale is its own status");
  assert.equal(report.totals.errored, 0, "and is not a provider fault");
  assert.equal(report.totals.blocked, 0);
  assert.match(report.cases[0]?.detail ?? "", /fragments have changed/);
  assert.match(
    report.cases[0]?.detail ?? "",
    /re-capture or run live/,
    "the report says what to do about it",
  );
  assert.equal(
    buildPassReference({ report, fragmentsManifestVersion: "fragments-v1" }),
    null,
  );
});

test("hand-edited evidence is blocked by the manifest gate", async () => {
  const report = await run([corpusCase()], tamperedStore());

  assert.equal(report.totals.blocked, 1);
  assert.equal(report.totals.errored, 0);
  assert.match(report.cases[0]?.detail ?? "", /does not match the manifest/);
  assert.equal(
    buildPassReference({ report, fragmentsManifestVersion: "fragments-v1" }),
    null,
    "unreviewed evidence must not unlock activation (DB §4.5)",
  );
});

// --- lowVarianceSampling is declared, not assumed (AI §10.6) -------------

test("a recording's sampling declaration reaches the replay adapter", async () => {
  const target = corpusCase();
  const honest = await recordingFor(target, { lowVarianceSampling: false });

  const declared = await createRecordedProvider(
    honest.stages,
    resolver,
    target.inputText,
    { lowVarianceSampling: honest.lowVarianceSampling },
  );
  assert.equal(
    declared.capabilities.lowVarianceSampling,
    false,
    "a recording captured at default sampling must not claim determinism",
  );

  const lowVariance = await createRecordedProvider(
    honest.stages,
    resolver,
    target.inputText,
    { lowVarianceSampling: true },
  );
  assert.equal(lowVariance.capabilities.lowVarianceSampling, true);

  // The harness default is unchanged for callers that pass no option.
  const harnessDefault = await createRecordedProvider(
    honest.stages,
    resolver,
    target.inputText,
  );
  assert.equal(harnessDefault.capabilities.lowVarianceSampling, true);
});

// --- FR-024 consistency ---------------------------------------------------

test("repeated runs on identical input agree (FR-024)", async () => {
  const target = corpusCase();
  const report = await run([target], storeOf(await recordingFor(target)), 3);

  assert.equal(report.totals.passed, 1);
});

// --- the pass reference (DB §4.5) ----------------------------------------

test("a clean run issues a reference naming the evidence it used", async () => {
  const target = corpusCase();
  const recording = await recordingFor(target);
  const report = await run([target], storeOf(recording));

  const reference = buildPassReference({
    report,
    fragmentsManifestVersion: "fragments-v1",
  });
  assert.ok(reference);
  assert.equal(reference.suite, "corpus-regression");
  assert.match(
    reference.reference,
    /^corpus-regression:corpus-v2\+fragments-v1:[0-9a-f]{16}$/,
  );

  // `docs/12` D-30: the reference names the **suite** version, while the case
  // it replayed still carries its immutable entry marker. Deriving one from the
  // other is the defect this separation exists to prevent.
  assert.equal(reference.suiteVersion, "corpus-v2");
  assert.equal(report.suiteVersion, "corpus-v2");
  assert.equal(target.corpusVersion, "corpus-v1", "entry provenance is intact");

  // `docs/12` D-30 dec. 3: a reference that cannot prove it covered everything
  // must not read as though it did. No `corpusSize` was supplied, so it does
  // not claim completeness.
  assert.equal(reference.selectionScope, "partial");
  assert.equal(reference.coverage, undefined);

  const entry = reference.cases[0];
  assert.ok(entry);
  assert.equal(entry.caseId, "tt-001");
  assert.equal(
    entry.recordingHash,
    recordingFileHash(JSON.stringify(recording)),
    "the reference names the exact evidence replayed",
  );
  assert.ok(entry.assertionsEvaluated.includes("run_completeness"));
  assert.ok(
    !entry.assertionsEvaluated.includes("artifact_set"),
    "per-case coverage, not the static catalogue",
  );
  assert.ok(reference.assertionsDeferred.includes("confidence_band"));
  assert.match(reference.attests, /NOT evidence that the current prompt/);
  assert.equal(
    entry.fragmentsCompositionHash,
    recording.fragmentsCompositionHash,
    "each case names the composition its own recording was captured under",
  );
  assert.deepEqual(reference.fragmentsCompositions, [
    recording.fragmentsCompositionHash,
  ]);
});

test("a suite spanning several compositions still issues a reference", async () => {
  // `docs/11` §3 mandates refusal cases, and a case that halts early composes
  // fewer prompts — so a green suite spans more than one composition by
  // construction. Requiring a single suite-wide composition made a passing
  // refusal-bearing suite unable to issue a reference at all.
  const full = corpusCase({ case_id: "tt-full" });
  const halting = corpusCase({
    case_id: "tt-halt",
    special_class: "unsupported",
    expected_classification: "unsupported",
  });

  const fullRecording = await recordingFor(full);
  const haltingRecording = await recordingFor(halting, {
    upTo: 1,
    outputs: {
      ...STAGE_OUTPUTS,
      classification: JSON.stringify({
        determined_type: "unsupported",
        confidence: 0.95,
        candidate_types: [],
      }),
    },
  });

  const report = await run(
    [full, halting],
    storeOf(fullRecording, haltingRecording),
  );
  assert.equal(report.totals.passed, 2, "both cases pass");

  const reference = buildPassReference({
    report,
    fragmentsManifestVersion: "fragments-v1",
  });
  assert.ok(reference, "a green suite must be able to issue a reference");

  assert.notEqual(
    fullRecording.fragmentsCompositionHash,
    haltingRecording.fragmentsCompositionHash,
    "the two cases genuinely differ in composition",
  );
  assert.deepEqual(
    reference.fragmentsCompositions,
    [
      fullRecording.fragmentsCompositionHash,
      haltingRecording.fragmentsCompositionHash,
    ].sort(),
    "every distinct composition is recorded, sorted",
  );
  assert.deepEqual(
    reference.cases.map((c) => c.fragmentsCompositionHash),
    [
      fullRecording.fragmentsCompositionHash,
      haltingRecording.fragmentsCompositionHash,
    ],
    "and each case names its own",
  );
});

test("multiple compositions do not weaken the staleness refusal", async () => {
  // Staleness is enforced per case in the runner, before a case can pass.
  // Collecting compositions instead of demanding one must not let a stale
  // recording through.
  const full = corpusCase({ case_id: "tt-full" });
  const stale = corpusCase({ case_id: "tt-stale" });

  const report = await run(
    [full, stale],
    storeOf(await recordingFor(full), {
      ...(await recordingFor(stale)),
      fragmentsCompositionHash: "0".repeat(64),
    }),
  );

  assert.equal(report.totals.stale, 1);
  assert.equal(
    buildPassReference({ report, fragmentsManifestVersion: "fragments-v1" }),
    null,
    "one stale case still blocks the reference",
  );
});

test("different evidence for the same cases produces a different runId", async () => {
  const target = corpusCase();

  const first = await run([target], storeOf(await recordingFor(target)));
  const second = await run(
    [target],
    storeOf(
      await recordingFor(target, {
        outputs: {
          ...STAGE_OUTPUTS,
          classification: JSON.stringify({
            determined_type: "business_requirement",
            confidence: 0.88,
            candidate_types: ["business_requirement"],
          }),
        },
      }),
    ),
  );

  const idOf = (report: Awaited<ReturnType<typeof run>>): string | undefined =>
    buildPassReference({ report, fragmentsManifestVersion: "fragments-v1" })
      ?.runId;

  assert.ok(idOf(first));
  assert.ok(idOf(second));
  assert.notEqual(
    idOf(first),
    idOf(second),
    "a reference must identify the evidence, not merely the case list",
  );
});

test("a blocked or failed run issues no pass reference at all", async () => {
  const failing = corpusCase({ expected_classification: "job_description" });

  const blocked = await run([corpusCase()], storeOf());
  const failed = await run([failing], storeOf(await recordingFor(failing)));

  for (const [label, report] of [
    ["blocked", blocked],
    ["failed", failed],
  ] as const) {
    assert.equal(
      buildPassReference({ report, fragmentsManifestVersion: "fragments-v1" }),
      null,
      `a ${label} run must not unlock fragment activation (DB §4.5)`,
    );
  }
});
