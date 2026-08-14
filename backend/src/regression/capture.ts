/**
 * Recording capture — the paid half of `AI §12.3`.
 *
 * Recorded mode replays; something has to have recorded. This runs the
 * **production** pipeline against a real provider once per corpus case and
 * stores what the provider said, in the format `recording-store.ts` already
 * defines (`docs/12` D-24).
 *
 * IT ADDS NO REASONING AND NO SECOND PIPELINE. Capture is `createPipeline` with
 * one decorator on the invoker that remembers each response before handing it
 * back. The pipeline cannot tell it is being recorded, which is the point: a
 * recording of a *different* execution path would be evidence of nothing.
 *
 * WHAT IT REFUSES TO DO
 *
 *   · overwrite an existing recording without `force` — a capture is paid
 *     evidence, and silently replacing it destroys the baseline a regression
 *     would have been measured against;
 *   · run at all when the store already holds unmanifested or edited files —
 *     rebuilding the manifest over tampered evidence would launder it, which is
 *     the one thing the gate exists to prevent (`docs/12` D-24);
 *   · write anything for a case whose pipeline run failed. A partial capture is
 *     not evidence; it is the truncated recording the runner's completeness
 *     assertion exists to reject.
 *
 * A HALT IS NOT A FAILURE. `unsupported` declines at Stage 1 and `insufficient`
 * halts at Stage 3 (`FR-092`, `AI §5.4`), so those cases legitimately record
 * one and three stages. That is the behaviour the corpus expects of them.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPipeline } from "../nie/pipeline.js";
import { StageError, type PipelineResult } from "../nie/contracts.js";
import type { FragmentResolver } from "../nie/ports.js";
import type { StageRecording } from "../harness/recordings.js";
import type { ProviderAdapter } from "../provider/capability.js";
import {
  createProviderInvoker,
  type ProviderInvoker,
} from "../provider/invoke.js";
import type { TokenRate } from "../provider/cost.js";
import type { CorpusCase } from "./corpus.js";
import {
  buildRecordingManifest,
  detectRecordingDrift,
  fragmentsCompositionHash,
  inputTextHash,
  isCleanRecordingSet,
  parseCaseRecording,
  type CaseRecording,
  type RecordingStore,
} from "./recording-store.js";

export type CaptureStatus = "captured" | "skipped" | "failed";

export interface CaptureOutcome {
  readonly caseId: string;
  readonly status: CaptureStatus;
  readonly detail: string;
  /** Number of provider calls this case consumed, successful or not. */
  readonly providerCalls: number;
  readonly recording?: CaseRecording;
}

export interface CaptureReport {
  readonly corpusVersion: string;
  readonly cases: readonly CaptureOutcome[];
  readonly totals: {
    readonly selected: number;
    readonly captured: number;
    readonly skipped: number;
    readonly failed: number;
    readonly providerCalls: number;
  };
  /** True when the manifest was rewritten (only if something was captured). */
  readonly manifestUpdated: boolean;
  /** True when the batch stopped early on consecutive failures. */
  readonly aborted: boolean;
}

export interface CaptureOptions {
  readonly cases: readonly CorpusCase[];
  /**
   * The adapter to capture through, per case.
   *
   * A function rather than a value because the offline dry-run responder is
   * necessarily case-specific — Stage 3 must quote *this* input. The real
   * adapter ignores the argument and returns the same instance.
   */
  readonly adapterFor: (corpusCase: CorpusCase) => ProviderAdapter;
  readonly resolver: FragmentResolver;
  readonly store: RecordingStore;
  readonly rate: TokenRate;
  /** Recorded as `provider.modelKey` — the model that answered. */
  readonly modelKey: string;
  /** Recorded as `provider.adapter`. Never a raw vendor string (`AI-006`). */
  readonly adapterId: string;
  /** `prompts/fragments.manifest.json` version in force at capture. */
  readonly fragmentsManifestVersion: string;
  /** Declared, never assumed (`AI §10.6`). */
  readonly lowVarianceSampling: boolean;
  /** Re-capture cases that already have a recording. */
  readonly force?: boolean;
  /**
   * Abort the batch after this many consecutive failures. Default 2.
   *
   * A failing case has usually already been paid for — the provider answered
   * and a stage rejected the answer, or the infrastructure was unreachable.
   * Either way the second identical failure says the fault is systematic, and
   * grinding through the remaining cases would spend the whole batch's budget
   * proving the same thing eleven more times.
   */
  readonly abortAfterConsecutiveFailures?: number;
  /**
   * Where a failed capture is quarantined. Defaults to writing under
   * `research/regression-failures/`; injected in tests.
   */
  readonly quarantine?: (record: CaptureFailureRecord) => void;
  readonly now?: () => Date;
  readonly onProgress?: (message: string) => void;
}

/**
 * `research/regression-failures/` — a **sibling** of the recording store, never
 * a subdirectory of it.
 *
 * The separation is the guarantee: `RecordingStore.list()` and `hashes()` only
 * ever read `<recording root>/<corpus version>/*.json`, so nothing here is
 * reachable by the runner, by the manifest, or by the pass reference. A failed
 * capture is diagnostic material, and diagnostic material must not be able to
 * become evidence.
 */
export const FAILURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../research/regression-failures",
);

/** Writes one quarantined failure. Timestamped, so retries do not overwrite. */
export function writeFailureRecord(
  record: CaptureFailureRecord,
  root: string = FAILURE_ROOT,
): void {
  const dir = path.join(root, record.corpusVersion);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = record.failedAt.replace(/[:.]/g, "-");
  fs.writeFileSync(
    path.join(dir, `${record.caseId}-${stamp}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}

/** Raised before any provider call when the store is not in a safe state. */
export class CaptureRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureRefusedError";
  }
}

export interface CapturedCall {
  readonly task: string;
  readonly output: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
}

/**
 * What a failed capture leaves behind (`DB §8.2`, `FR-100`, `docs/12` D-20).
 *
 * D-20 established the principle at the pipeline layer: "a failed analysis
 * retains everything up to the failure point". Capture ignored it, so the first
 * paid `br-001` run spent real money, failed at Stage 6, and stored nothing —
 * the raw response that would have explained why was discarded. Diagnosing it
 * would have meant paying again.
 *
 * QUARANTINE, NOT EVIDENCE. This is written to a **separate root** from the
 * recording store, so it is outside every path `list()`, `hashes()` and the
 * manifest gate look at. A failure artefact can therefore never be replayed,
 * never enter `recordings.manifest.json`, and never be mistaken for a capture.
 */
export interface CaptureFailureRecord {
  readonly caseId: string;
  readonly corpusVersion: string;
  readonly failedAt: string;
  readonly provider: { readonly adapter: string; readonly modelKey: string };
  readonly failure: {
    readonly stageNumber: number | null;
    readonly stageKey: string | null;
    readonly message: string;
  };
  /** Provider calls that completed before the failure — the paid ones. */
  readonly providerCalls: number;
  /**
   * Every response captured before the failure, raw. This is the diagnostic
   * payload: the run that failed at Stage 6 had four of these, and the fourth
   * held the out-of-range grounding nobody could see.
   */
  readonly responses: readonly CapturedCall[];
}

/**
 * Remembers the response of every successful invocation.
 *
 * Only successful calls return, so a retried stage records the answer the
 * pipeline actually used rather than the attempt that failed. A stage that ran
 * twice — Stage 6's single traceability regeneration (`AI §3.2`) — is recorded
 * once, keeping the last response, because that is the one the run proceeded
 * with.
 */
const capturingInvoker = (
  inner: ProviderInvoker,
  calls: CapturedCall[],
): ProviderInvoker => ({
  invoke: async (request, context) => {
    const response = await inner.invoke(request, context);
    calls.push({
      task: request.task,
      output: response.output,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      latencyMs: response.usage.latencyMs,
    });
    return response;
  },
});

/** Last response per stage, in the order the stages first ran (`FR-010`). */
const toStageRecordings = (
  calls: readonly CapturedCall[],
  result: PipelineResult,
): readonly StageRecording[] => {
  const order: string[] = [];
  const latest = new Map<string, CapturedCall>();
  for (const call of calls) {
    if (!latest.has(call.task)) order.push(call.task);
    latest.set(call.task, call);
  }

  return order.map((task) => {
    const call = latest.get(task) as CapturedCall;
    return {
      stageKey: task,
      // Every stage after Stage 1 is composed with the classification in force
      // — the same value `pipeline.ts` passes as `classifiedAs`. The replay key
      // is built from that composition, so it must match exactly.
      ...(task === "input_classification"
        ? {}
        : { classifiedAs: result.classification.determinedType }),
      output: call.output,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      latencyMs: call.latencyMs,
    };
  });
};

/**
 * Captures one case. Exported so a test can drive it with an offline adapter.
 *
 * @throws whatever the pipeline throws — the caller decides whether a failed
 * case aborts the batch.
 */
export async function captureCase(
  corpusCase: CorpusCase,
  options: CaptureOptions,
  /**
   * Filled as calls complete, and **owned by the caller** so it survives a
   * throw. Previously this array was local, so a failed case could not report
   * what it had already spent and the catch block reported zero — a paid
   * command claiming it had paid nothing.
   */
  calls: CapturedCall[] = [],
): Promise<{ recording: CaseRecording; providerCalls: number }> {
  const now = options.now ?? (() => new Date());

  const pipeline = createPipeline({
    invoker: capturingInvoker(
      createProviderInvoker({
        adapter: options.adapterFor(corpusCase),
        rate: options.rate,
        // Capture writes no trace: there is no trace store in scope, and the
        // run is not an analysis anyone will retrieve.
        recorder: { record: () => Promise.resolve() },
      }),
      calls,
    ),
    resolver: options.resolver,
    traceSink: { record: () => Promise.resolve() },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: randomUUID(),
    modelKey: options.modelKey,
  });

  const result = await pipeline.run({
    analysisId: randomUUID(),
    text: corpusCase.inputText,
  });

  const stages = toStageRecordings(calls, result);
  if (stages.length === 0) {
    throw new Error(
      `no provider response was captured for ${corpusCase.caseId}`,
    );
  }

  const recording: CaseRecording = {
    caseId: corpusCase.caseId,
    corpusVersion: corpusCase.corpusVersion,
    inputTextHash: inputTextHash(corpusCase.inputText),
    fragmentsManifestVersion: options.fragmentsManifestVersion,
    fragmentsCompositionHash: await fragmentsCompositionHash(
      stages,
      options.resolver,
    ),
    capturedAt: now().toISOString(),
    provider: { adapter: options.adapterId, modelKey: options.modelKey },
    lowVarianceSampling: options.lowVarianceSampling,
    stages,
  };

  return { recording, providerCalls: calls.length };
}

/**
 * Captures a selection of cases and updates the manifest once at the end.
 *
 * The manifest is rewritten from what is on disk — the same derivation
 * `regression:recordings:write` uses — so capture and the gate can never
 * disagree about what the evidence is.
 */
export async function captureCases(
  options: CaptureOptions,
): Promise<CaptureReport> {
  const corpusVersion = options.cases[0]?.corpusVersion ?? "corpus-v1";
  const report = (message: string): void => options.onProgress?.(message);

  // Refuse before spending anything: rebuilding the manifest over evidence
  // that was edited or never recorded would launder it.
  const drift = detectRecordingDrift(
    options.store.hashes(corpusVersion),
    options.store.readManifest(corpusVersion),
  );
  if (!isCleanRecordingSet(drift)) {
    throw new CaptureRefusedError(
      "the recording store does not match its manifest — " +
        [
          ...drift.added.map((k) => `unmanifested: ${k}`),
          ...drift.changed.map((k) => `edited: ${k}`),
          ...drift.removed.map((k) => `missing: ${k}`),
        ].join(", ") +
        ". Resolve this before capturing: `npm run regression:recordings:check`.",
    );
  }

  const outcomes: CaptureOutcome[] = [];
  const abortAfter = Math.max(1, options.abortAfterConsecutiveFailures ?? 2);
  let consecutiveFailures = 0;
  let aborted = false;

  for (const corpusCase of options.cases) {
    if (aborted) {
      outcomes.push({
        caseId: corpusCase.caseId,
        status: "skipped",
        detail: `not attempted — capture aborted after ${String(abortAfter)} consecutive failures`,
        providerCalls: 0,
      });
      continue;
    }

    const existing = options.store
      .list(corpusVersion)
      .includes(corpusCase.caseId);
    if (existing && options.force !== true) {
      report(`⏭  ${corpusCase.caseId} already captured`);
      outcomes.push({
        caseId: corpusCase.caseId,
        status: "skipped",
        detail: "a recording already exists; pass --force to re-capture",
        providerCalls: 0,
      });
      continue;
    }

    // Owned here so a throw does not take the call count with it.
    const calls: CapturedCall[] = [];

    try {
      report(`▶  ${corpusCase.caseId}`);
      const { recording: complete, providerCalls } = await captureCase(
        corpusCase,
        options,
        calls,
      );

      // Round-trip through the store's own validator before writing, so an
      // unreadable recording fails here rather than on the first regression
      // run — after the money is spent.
      parseCaseRecording(JSON.stringify(complete), `${corpusCase.caseId}.json`);
      options.store.write(complete);
      consecutiveFailures = 0;

      outcomes.push({
        caseId: corpusCase.caseId,
        status: "captured",
        detail: `${String(complete.stages.length)} stage(s)`,
        providerCalls,
        recording: complete,
      });
    } catch (error) {
      // A failed case is not written. `StageError` is the common one: the model
      // produced something the stage could not parse, which is a finding about
      // the prompt, not evidence to replay.
      const detail =
        error instanceof StageError
          ? `stage ${String(error.stageNumber)} (${error.stageKey}): ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      // Quarantined before anything else: the responses already paid for are
      // the only diagnostic material this run will ever produce.
      const quarantine = options.quarantine ?? writeFailureRecord;
      quarantine({
        caseId: corpusCase.caseId,
        corpusVersion: corpusCase.corpusVersion,
        failedAt: (options.now ?? (() => new Date()))().toISOString(),
        provider: { adapter: options.adapterId, modelKey: options.modelKey },
        failure: {
          stageNumber: error instanceof StageError ? error.stageNumber : null,
          stageKey: error instanceof StageError ? error.stageKey : null,
          message: detail,
        },
        providerCalls: calls.length,
        responses: [...calls],
      });

      report(
        `✖  ${corpusCase.caseId} — ${detail} (${String(calls.length)} provider call(s) already made)`,
      );
      outcomes.push({
        caseId: corpusCase.caseId,
        status: "failed",
        detail,
        // The calls happened and were billed. Reporting 0 here is what made
        // the first paid run look free.
        providerCalls: calls.length,
      });

      consecutiveFailures += 1;
      if (consecutiveFailures >= abortAfter) {
        aborted = true;
        report(
          `⛔ aborting after ${String(consecutiveFailures)} consecutive failures — the fault looks systematic, not per-case`,
        );
      }
    }
  }

  const count = (status: CaptureStatus): number =>
    outcomes.filter((o) => o.status === status).length;
  const captured = count("captured");

  if (captured > 0) {
    options.store.writeManifest(
      buildRecordingManifest(
        corpusVersion,
        options.store.hashes(corpusVersion),
      ),
    );
  }

  return {
    corpusVersion,
    cases: outcomes,
    totals: {
      selected: outcomes.length,
      captured,
      skipped: count("skipped"),
      failed: count("failed"),
      providerCalls: outcomes.reduce((n, o) => n + o.providerCalls, 0),
    },
    manifestUpdated: captured > 0,
    aborted,
  };
}
