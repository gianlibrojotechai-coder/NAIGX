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
import type { RecordingSet } from "../harness/recordings.js";
import {
  createPinnedResolver,
  type CaptureResolution,
} from "./pinned-resolver.js";
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
  /**
   * How the composition this case replayed was resolved
   * ([D-64](../../../docs/39-D-64-Pass-Reference-Composition-Contract.md) §4.1).
   *
   * ⚠️ DERIVED FROM THE EVIDENCE, NEVER ASSUMED. For a pinned recording it is
   * what the recording states. For a legacy one it is the candidate that
   * actually reproduced the recorded composition hash — the recording's own
   * hash is the oracle, so this cannot be a guess.
   */
  readonly fragmentResolution: CaptureResolution;
}

/**
 * A candidate composition a legacy recording might have been captured under
 * ([D-64](../../../docs/39-D-64-Pass-Reference-Composition-Contract.md) §4.2).
 *
 * ⚠️ ORDER IS PROVENANCE-PRESERVING, NOT ARBITRARY. `active` is tried first so
 * that a recording reproducible under *both* keeps the label it has always
 * had. Where both reproduce, the composed bytes are identical by definition —
 * the hash is equal — so the label is the only thing at stake, and D-63 §5
 * rejected relabelling historical evidence as `authored`.
 */
export interface LegacyCompositionCandidate {
  readonly resolution: CaptureResolution;
  readonly resolver: FragmentResolver;
}

/**
 * Which candidate composition a legacy recording was captured under
 * ([D-64](../../../docs/39-D-64-Pass-Reference-Composition-Contract.md) §4.2).
 *
 * ⚠️ THE RECORDING'S OWN HASH IS THE ORACLE. A candidate is accepted only when
 * it reproduces `recordedHash` exactly — never because it was the only one
 * supplied, and never because a field was absent. That is what makes this
 * *derivation from evidence* rather than a fallback: a resolver that cannot
 * reproduce the hash is rejected, including one that throws because the
 * recording composes a fragment it has never published.
 *
 * Exported for its own tests. It is the one place the question is decided, so
 * a test that re-implemented the search could not disagree with it — the
 * failure mode `nie-m11-paths.test.ts` had.
 */
export async function resolveLegacyComposition(
  stages: RecordingSet,
  recordedHash: string,
  candidates: readonly LegacyCompositionCandidate[],
): Promise<{
  readonly matched?: LegacyCompositionCandidate;
  readonly tried: readonly string[];
}> {
  const tried: string[] = [];
  for (const candidate of candidates) {
    let composition: string;
    try {
      composition = await fragmentsCompositionHash(stages, candidate.resolver);
    } catch {
      // Unresolvable is an ANSWER — this candidate is not what the recording
      // was captured under — not an error to propagate.
      tried.push(`${candidate.resolution}=unresolvable`);
      continue;
    }
    tried.push(`${candidate.resolution}=${composition.slice(0, 12)}`);
    if (composition === recordedHash) {
      return { matched: candidate, tried };
    }
  }
  return { tried };
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
  /**
   * Candidate compositions for LEGACY recordings, in order
   * ([D-64](../../../docs/39-D-64-Pass-Reference-Composition-Contract.md) §4.2).
   *
   * ⚠️ Defaults to `[{ active, resolver }]`, which is exactly the pre-D-64
   * behaviour — so an existing caller that supplies only `resolver` is
   * unchanged. Supplying both candidates is what lets a recording captured
   * under authored resolution replay against the composition it was actually
   * captured with, rather than being declared stale against one it never saw.
   */
  readonly legacyResolvers?: readonly LegacyCompositionCandidate[];
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
  //     has no such record and its composed text is gone. Its composition is
  //     therefore DETERMINED FROM THE EVIDENCE below, and `docs/12` D-24's
  //     staleness check still applies to it exactly as before.
  //
  // ⚠️ D-64 §4.2 — ABSENCE OF `composition` IS NOT EVIDENCE OF ACTIVE CAPTURE.
  // The D-63 §7 amendment sent every unpinned recording to the injected
  // (active) resolver, justified as "which is what they were captured under".
  // That was true of the thirteen recordings that existed when it was written
  // and false the moment D-63 §2 moved capture to the authored resolver while
  // §7 did not yet persist compositions — the window `ew-001` was captured in.
  // §7's own principle is "whatever it was captured under", and the recording's
  // recorded composition hash is what establishes that.
  const pinned = recording.composition;
  let effectiveResolver: FragmentResolver;
  let fragmentResolution: CaptureResolution;

  if (pinned !== undefined) {
    effectiveResolver = createPinnedResolver(pinned);
    fragmentResolution = pinned.resolution;
  } else {
    // Legacy path, explicit rather than implied. A candidate is accepted only
    // when it REPRODUCES the recorded hash — never because it is the only one
    // to hand. A resolver that throws (an unpublished fragment, say) simply
    // does not reproduce it; that is an answer, not a failure.
    const candidates: readonly LegacyCompositionCandidate[] =
      options.legacyResolvers ?? [
        { resolution: "active", resolver: options.resolver },
      ];

    const { matched, tried } = await resolveLegacyComposition(
      recording.stages,
      recording.fragmentsCompositionHash,
      candidates,
    );

    if (matched === undefined) {
      throw new StaleError(
        `the fragments have changed since ${corpusCase.caseId} was captured ` +
          `(recorded ${recording.fragmentsCompositionHash.slice(0, 12)}; tried ${tried.join(", ")}) — ` +
          `this is a LEGACY recording with no captured composition, so recorded ` +
          `mode cannot validate a prompt it has no answer for; re-capture or run live`,
      );
    }
    effectiveResolver = matched.resolver;
    fragmentResolution = matched.resolution;
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
      fragmentResolution,
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
