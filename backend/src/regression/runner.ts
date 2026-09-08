/**
 * The recorded-mode regression runner (`NFR-043`, `FR-024`, `AI §12.3`).
 *
 * `AI §12.3` — resolved 2026-08-12 — makes recorded mode the gate: every code
 * change must pass it before merge, against frozen expectations from the golden
 * corpus, with **no live provider call**. This runs that mode.
 *
 * IT IS A COMPOSITION ROOT, NOT A SECOND PIPELINE. Every case goes through the
 * production `createPipeline`, the production provider abstraction, and the
 * replay adapter primed by the harness's own `createRecordedProvider`. There is
 * no reasoning, no parsing and no stage logic here — boundary check 6 forbids
 * re-implementing a stage, and this file must not want to.
 *
 * NO DATABASE. The sinks are in-memory: a regression run measures reasoning,
 * not persistence, and Sprint 1's persistence is covered by its own tests. The
 * one port it cannot fake is `FragmentResolver` — fixtures are keyed by the
 * composed prompt (`docs/12` D-17), so the fragments must be the real ones. It
 * is injected, exactly as the harness injects it.
 *
 * A MISSING RECORDING IS NOT A FAILURE, AND NOT A PASS. It is `blocked`: the
 * case was never measured. Counting it either way would be a lie — a failure
 * would blame the system for evidence nobody captured, and a pass would let a
 * suite of zero recordings report green.
 */

import { randomUUID } from "node:crypto";

import { createPipeline } from "../nie/pipeline.js";
import type { PipelineResult } from "../nie/contracts.js";
import type { FragmentResolver } from "../nie/ports.js";
import { createRecordedProvider } from "../harness/recordings.js";
import { createPinnedResolver } from "./pinned-resolver.js";
import { createProviderInvoker } from "../provider/invoke.js";
import type { TokenRate } from "../provider/cost.js";
import {
  caseFailed,
  evaluateCase,
  type AssertionOutcome,
} from "./assertions.js";
import type { CorpusCase } from "./corpus.js";
import {
  fragmentsCompositionHash,
  inputTextHash,
  RecordingIntegrityError,
  type RecordingStore,
} from "./recording-store.js";

/**
 * ⚠️ Placeholder rate. `docs/12` D-10 item 5: no persistent token-rate surface
 * is defined. A regression run reports no cost — it spends nothing — so this
 * only keeps the accounting path exercised.
 */
const REPLAY_RATE: TokenRate = {
  inputUsdPerMillionTokens: "0.00",
  outputUsdPerMillionTokens: "0.00",
};

/**
 * `stale` is separate from `blocked` and from `errored` on purpose
 * (`docs/12` D-24 decision 2). A fragment change invalidating a recording is
 * the keying mechanism working as D-17 designed it — not a missing capture, and
 * certainly not a provider fault. Reporting it as either would blame the system
 * for a state the design intends, and would hide the one thing the operator
 * needs to know: this case needs re-capture, not debugging.
 */
export type CaseStatus = "passed" | "failed" | "blocked" | "stale" | "errored";

/** What was replayed, so the pass reference can name the evidence. */
export interface CaseEvidence {
  readonly recordingHash: string;
  readonly fragmentsCompositionHash: string;
  readonly capturedAt: string;
}

export interface CaseOutcome {
  readonly caseId: string;
  readonly status: CaseStatus;
  readonly assertions: readonly AssertionOutcome[];
  /** Assertion ids actually evaluated for this case — never the catalogue. */
  readonly assertionsEvaluated: readonly string[];
  /** Absent unless verified evidence was replayed. */
  readonly evidence?: CaseEvidence;
  /** Why a case was blocked, stale or errored — empty when it ran. */
  readonly detail: string;
}

export interface RegressionReport {
  readonly mode: "recorded";
  /**
   * The **suite** version the run measured against (`docs/11` §6.3).
   *
   * Supplied by the caller from `corpus.manifest.json`, never derived from a
   * case: a case's `corpus_version` is immutable entry provenance, so reading it
   * here reported the wrong version entirely (`docs/12` D-30).
   */
  readonly suiteVersion: string;
  readonly startedAt: string;
  readonly cases: readonly CaseOutcome[];
  readonly totals: {
    readonly selected: number;
    readonly passed: number;
    readonly failed: number;
    readonly blocked: number;
    readonly stale: number;
    readonly errored: number;
  };
}

export interface RegressionRunOptions {
  readonly cases: readonly CorpusCase[];
  /** From `corpus.manifest.json` — see `RegressionReport.suiteVersion`. */
  readonly suiteVersion: string;
  readonly store: RecordingStore;
  /** The real resolver — fixtures key on the published fragment composition. */
  readonly resolver: FragmentResolver;
  readonly modelVersionId?: string;
  readonly modelKey?: string;
  /**
   * `FR-024` — "repeated runs on identical input must produce materially
   * consistent output". Replay makes this near-tautological today; it stops
   * being so the moment live mode exists, and asserting it now means the check
   * is already in place rather than added after it could have caught something.
   */
  readonly repeat?: number;
  readonly now?: () => Date;
}

/** The deterministic projection compared across repeats (`FR-024`). */
const projection = (result: PipelineResult): string =>
  JSON.stringify({
    classification: result.classification.determinedType,
    confidence: result.classification.confidence,
    sufficiency: result.context?.sufficiency ?? null,
    elements: result.context?.elements.length ?? 0,
    components: result.architecture?.components.map((c) => c.name) ?? [],
    haltedAt: result.haltedAt?.stageNumber ?? null,
  });

interface RunnableCase {
  readonly result: PipelineResult;
  readonly evidence: CaseEvidence;
}

async function runOne(
  corpusCase: CorpusCase,
  options: RegressionRunOptions,
): Promise<RunnableCase> {
  // Throws `RecordingIntegrityError` when the file is unmanifested or edited.
  const verified = options.store.read(
    corpusCase.corpusVersion,
    corpusCase.caseId,
  );
  if (verified === undefined) {
    throw new BlockedError(
      `no recording captured for ${corpusCase.caseId} (${corpusCase.corpusVersion})`,
    );
  }
  const { recording, contentHash } = verified;

  // `docs/12` D-19: Stage 3 verifies quotes against the input, so a recording
  // is only valid against the text it was captured from.
  const expectedHash = inputTextHash(corpusCase.inputText);
  if (recording.inputTextHash !== expectedHash) {
    throw new BlockedError(
      `recording for ${corpusCase.caseId} was captured against different input text ` +
        `(recorded ${recording.inputTextHash.slice(0, 12)}, corpus ${expectedHash.slice(0, 12)}) — recapture required`,
    );
  }

  // --- which composition does this recording replay against? ---------------
  //
  // D-63 amendment. ⚠️ REPLAYABILITY AND EVIDENTIAL CURRENCY ARE DIFFERENT
  // QUESTIONS, and conflating them is what invalidated ten recordings the
  // moment authored content drifted from active content.
  //
  //   · A recording carrying its captured composition replays against THAT.
  //     It always answers the prompt it was captured against, so it is never
  //     stale for *replay* purposes. Whether it still evidences a newer
  //     candidate composition is the activation gate's question, asked with
  //     authored resolution, and not this function's.
  //   · A LEGACY recording — captured before compositions were persisted —
  //     has no such record and its composed text is gone. It falls back to the
  //     injected resolver, and `docs/12` D-24's staleness check still applies
  //     to it exactly as before.
  const pinned = recording.composition;
  const effectiveResolver =
    pinned !== undefined ? createPinnedResolver(pinned) : options.resolver;

  if (pinned === undefined) {
    // Legacy compatibility path, explicit rather than implied.
    const composition = await fragmentsCompositionHash(
      recording.stages,
      options.resolver,
    );
    if (recording.fragmentsCompositionHash !== composition) {
      throw new StaleError(
        `the fragments have changed since ${corpusCase.caseId} was captured ` +
          `(recorded ${recording.fragmentsCompositionHash.slice(0, 12)}, current ${composition.slice(0, 12)}) — ` +
          `this is a LEGACY recording with no captured composition, so recorded ` +
          `mode cannot validate a prompt it has no answer for; re-capture or run live`,
      );
    }
  }

  const adapter = await createRecordedProvider(
    recording.stages,
    effectiveResolver,
    corpusCase.inputText,
    // Declared by the recording, never assumed (`AI §10.6`).
    { lowVarianceSampling: recording.lowVarianceSampling },
  );

  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter,
      rate: REPLAY_RATE,
      // A regression run writes no trace: it is not an analysis, and there is
      // no trace store in scope for it.
      recorder: { record: () => Promise.resolve() },
      sleep: () => Promise.resolve(),
      random: () => 0,
    }),
    resolver: effectiveResolver,
    traceSink: { record: () => Promise.resolve() },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: options.modelVersionId ?? randomUUID(),
    modelKey: options.modelKey ?? recording.provider.modelKey,
  });

  return {
    result: await pipeline.run({
      analysisId: randomUUID(),
      text: corpusCase.inputText,
    }),
    evidence: {
      recordingHash: contentHash,
      fragmentsCompositionHash: recording.fragmentsCompositionHash,
      capturedAt: recording.capturedAt,
    },
  };
}

/** A case that could not be measured, as distinct from one that failed. */
class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedError";
  }
}

/** Evidence exists but no longer applies to the current fragments (D-24). */
class StaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleError";
  }
}

export async function runRegression(
  options: RegressionRunOptions,
): Promise<RegressionReport> {
  const now = options.now ?? (() => new Date());
  const repeat = Math.max(1, options.repeat ?? 1);
  const outcomes: CaseOutcome[] = [];

  for (const corpusCase of options.cases) {
    try {
      const runs: RunnableCase[] = [];
      for (let i = 0; i < repeat; i += 1) {
        runs.push(await runOne(corpusCase, options));
      }

      const first = runs[0] as RunnableCase;
      const divergent = runs
        .slice(1)
        .findIndex((r) => projection(r.result) !== projection(first.result));
      if (divergent !== -1) {
        outcomes.push({
          caseId: corpusCase.caseId,
          status: "failed",
          assertions: [],
          assertionsEvaluated: [],
          evidence: first.evidence,
          detail: `FR-024: repeat ${String(divergent + 2)} diverged from the first run`,
        });
        continue;
      }

      const assertions = evaluateCase(corpusCase, first.result);
      outcomes.push({
        caseId: corpusCase.caseId,
        status: caseFailed(assertions) ? "failed" : "passed",
        assertions,
        // Only what ran: `refusal_behaviour` and `conflict_detection` fire for
        // special-class cases alone, and a deferred assertion measured nothing.
        assertionsEvaluated: assertions
          .filter((a) => a.status !== "deferred")
          .map((a) => a.id),
        evidence: first.evidence,
        detail: "",
      });
    } catch (error) {
      const status: CaseStatus =
        error instanceof BlockedError
          ? "blocked"
          : error instanceof StaleError
            ? "stale"
            : error instanceof RecordingIntegrityError
              ? "blocked"
              : "errored";
      outcomes.push({
        caseId: corpusCase.caseId,
        status,
        assertions: [],
        assertionsEvaluated: [],
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const count = (status: CaseStatus): number =>
    outcomes.filter((o) => o.status === status).length;

  return {
    mode: "recorded",
    suiteVersion: options.suiteVersion,
    startedAt: now().toISOString(),
    cases: outcomes,
    totals: {
      selected: outcomes.length,
      passed: count("passed"),
      failed: count("failed"),
      blocked: count("blocked"),
      stale: count("stale"),
      errored: count("errored"),
    },
  };
}
