/**
 * Analysis execution — the job lifecycle (`SA §3.3`, `FR-094`, `FR-091`).
 *
 * `SA §3.3` gives the orchestrator "the lifecycle of an analysis job: accept,
 * enqueue, execute, complete, fail, time out", and forbids it three things:
 * it "never reasons about content, calls a provider directly, or decides
 * *which* artifacts to generate". This module holds exactly the lifecycle.
 *
 * WHY IT TAKES A FUNCTION, NOT A PIPELINE. Reasoning arrives as
 * `runPipeline` — the narrowest possible seam. The orchestrator therefore
 * cannot name a provider, cannot compose a prompt, and cannot be tested into
 * doing either. Which adapter sits behind that function is the composition
 * root's business, and the mode it was chosen under is passed in already
 * resolved (`execution-mode.ts`).
 *
 * WHY THE NIE STAYS CLEAN. `SA §3.4`: the NIE "never touches the database or
 * persists anything". It doesn't here either — status transitions are written
 * by this module, and per-stage results by the sink the pipeline was
 * constructed with. Boundary checks 2 and 4 hold.
 *
 * NO QUEUE INFRASTRUCTURE. `SA §12` row 4 makes the durable record the job:
 * "Job creation | Durable record before work starts | Job id, status queued".
 * The `ANALYSIS` row *is* the queue entry, so no broker, table or dependency
 * is introduced. `API §14` settles the related question: "`POST /analyses` is
 * not [idempotent]; duplicate submission creates a distinct analysis by
 * design" — so no idempotency system is built, only a claim guard so one
 * analysis is not executed twice concurrently.
 */

import type { ClassificationType, PipelineResult } from "../nie/contracts.js";
import type { AnalysisEvent } from "../nie/events.js";
import type { AnalysisEventSink } from "../nie/ports.js";
import type { FieldCipher } from "../crypto/data-key.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { ExecutionMode } from "./execution-mode.js";

/** What the run did, from the lifecycle's point of view. */
export type ExecutionOutcome =
  | "completed"
  | "degraded"
  | "halted"
  | "failed"
  | "timed_out"
  | "not_claimable";

/**
 * `FR-094` maximum analysis duration.
 *
 * Derived from `NFR-002`, which targets full completion at ≤ 60s p50 and
 * ≤ 120s p95. The cutoff is set beyond p95 rather than at it: a run that
 * exceeds the p95 target is slow, and a run that exceeds this has stopped
 * making progress. Cutting at the target would convert a latency miss into a
 * failed analysis, which is a worse outcome than a slow one.
 */
export const DEFAULT_ANALYSIS_TIMEOUT_MS = 180_000;

export interface ExecutionReport {
  readonly analysisId: string;
  readonly mode: ExecutionMode;
  readonly outcome: ExecutionOutcome;
  /** Present when the pipeline ran to a result. */
  readonly result?: PipelineResult;
  /** Present when the run failed. Never provider-specific (`SA §3.5`). */
  readonly failureReason?: string;
}

export interface AnalysisExecutorDependencies {
  readonly prisma: PrismaClient;
  readonly mode: ExecutionMode;
  /**
   * Opens the stored `raw_content`
   * ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §2).
   *
   * The executor reads it and hands plaintext to the pipeline; the NIE itself
   * never sees a cipher, because `AD-02`/`AP-3` keep persistence — and how
   * persistence protects itself — outside it.
   */
  readonly cipher: FieldCipher;
  /**
   * Runs the reasoning. Supplied by the composition root already wired to an
   * adapter, the fragment resolver and the persistence sinks.
   */
  readonly runPipeline: (input: {
    readonly classificationOverride?: ClassificationType;
    readonly analysisId: string;
    readonly text: string;
  }) => Promise<PipelineResult>;
  readonly now?: () => Date;
  /** Surfaces a failure to the log without failing the run twice over. */
  readonly onError?: (error: unknown) => void;
  /** Publishes terminal events (`API §7.4`). Absent means nothing is watching. */
  readonly eventSink?: AnalysisEventSink;
  /**
   * `FR-094` maximum analysis duration in milliseconds. Defaults to
   * `DEFAULT_ANALYSIS_TIMEOUT_MS`; a test supplies a small one.
   */
  readonly timeoutMs?: number;
  /** Injected so a test need not wait out a real duration. */
  readonly setTimer?: (fn: () => void, ms: number) => TimerHandle;
  readonly clearTimer?: (handle: TimerHandle) => void;
}

/** Whatever the injected timer returns. Node gives a `Timeout`; a test may give a number. */
export type TimerHandle = unknown;

/** Resolves when the deadline passes. Never rejects — the race reads the flag. */
const DEADLINE = Symbol("analysis-deadline");

export interface AnalysisExecutor {
  /**
   * @param classificationOverride - a user-corrected type (`FR-014`).
   * Forwarded to the pipeline, which fixes Stage 1 rather than running it.
   */
  execute(
    analysisId: string,
    classificationOverride?: ClassificationType,
  ): Promise<ExecutionReport>;
}

/**
 * `FR-091` — a partial failure is degradation, not success.
 *
 * Read from the artifact plan the NIE already produced: an entry whose outcome
 * is `failed` was planned, attempted and did not generate. This reuses the
 * distinction `DB §4.4` exists to preserve rather than inventing a second one.
 */
const wasDegraded = (result: PipelineResult): boolean =>
  (result.artifactPlan ?? []).some((entry) => entry.outcome === "failed");

export function createAnalysisExecutor(
  deps: AnalysisExecutorDependencies,
): AnalysisExecutor {
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? DEFAULT_ANALYSIS_TIMEOUT_MS;
  const setTimer =
    deps.setTimer ??
    ((fn, ms): TimerHandle => {
      const handle = setTimeout(fn, ms);
      // Unreferenced so a pending deadline cannot by itself hold the process
      // open at shutdown. The timer exists to stop waiting, not to keep the
      // server alive waiting.
      handle.unref();
      return handle;
    });
  const clearTimer =
    deps.clearTimer ??
    ((handle) => {
      clearTimeout(handle as NodeJS.Timeout);
    });

  /**
   * Resolves with the pipeline's result, or with `DEADLINE` if time runs out.
   *
   * The timer is always cleared, so a fast run leaves nothing pending; and the
   * pipeline's own rejection still propagates, so a genuine failure inside the
   * deadline is reported as a failure rather than disguised as a timeout.
   */
  const raceDeadline = <T>(work: Promise<T>): Promise<T | typeof DEADLINE> => {
    let handle: TimerHandle;
    const deadline = new Promise<typeof DEADLINE>((resolve) => {
      handle = setTimer(() => {
        resolve(DEADLINE);
      }, timeoutMs);
    });
    return Promise.race([work, deadline]).finally(() => {
      clearTimer(handle);
    });
  };

  /** Delivery never fails the lifecycle (`API-025`). */
  const emit = (analysisId: string, event: AnalysisEvent): void => {
    try {
      deps.eventSink?.emit(analysisId, event);
    } catch (error) {
      deps.onError?.(error);
    }
  };

  /** Counted from the plan, so omitted and failed stay distinguishable. */
  const artifactCounts = (
    result: PipelineResult,
  ): { generated: number; failed: number; omitted: number } => {
    const plan = result.artifactPlan ?? [];
    return {
      generated: plan.filter((e) => e.outcome === "generated").length,
      failed: plan.filter((e) => e.outcome === "failed").length,
      omitted: plan.filter((e) => e.outcome === "omitted").length,
    };
  };

  return {
    async execute(analysisId, classificationOverride) {
      // Claim it. A conditional update is a compare-and-set on the column that
      // already models the lifecycle: whoever moves it out of `queued` owns the
      // run, and a second caller finds nothing to claim. This is a guard
      // against double execution, not a distributed lock.
      const claimed = await deps.prisma.analysis.updateMany({
        where: { analysisId, status: "queued" },
        data: { status: "running" },
      });
      if (claimed.count === 0) {
        return { analysisId, mode: deps.mode, outcome: "not_claimable" };
      }

      const analysis = await deps.prisma.analysis.findUnique({
        where: { analysisId },
        include: { input: { select: { rawContent: true } } },
      });
      // Opened before reasoning ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §2).
      // The NIE receives plaintext and never learns that storage is encrypted —
      // `AD-02`/`AP-3` keep persistence out of it, and that includes knowing
      // how persistence protects itself.
      const stored = analysis?.input?.rawContent;
      const text = stored === undefined ? undefined : deps.cipher.open(stored);

      if (text === undefined) {
        // Claimed but unrunnable. Failing loudly is the point: `FR-091` calls
        // silent omission a defect, and leaving it `running` forever would be
        // exactly that.
        return await fail(
          analysisId,
          "The analysis has no stored input to reason about.",
        );
      }

      try {
        // `FR-094` — "a maximum analysis duration is enforced".
        //
        // WHAT A TIMEOUT DOES AND DOES NOT DO. It abandons *waiting*; it does
        // not roll anything back. `DB §6.2` writes each stage's results as
        // that stage completes, so everything finished before the cutoff is
        // already committed and stays committed. That is precisely what
        // `FR-094` means by "completed artifacts are presented and incomplete
        // ones labelled" — the preservation is a property of progressive
        // persistence, and this cutoff inherits it rather than implementing it.
        //
        // The pipeline promise is not cancellable and is deliberately left to
        // settle on its own. Its later writes are still legitimate records of
        // work that genuinely happened, and `runStage` traces them either way;
        // what changes is that nobody is waiting on the answer.
        const result = await raceDeadline(
          deps.runPipeline({
            analysisId,
            text,
            ...(classificationOverride !== undefined
              ? { classificationOverride }
              : {}),
          }),
        );

        if (result === DEADLINE) return await timeOut(analysisId);

        const degraded = wasDegraded(result);

        // A designed halt is not a failure. `AI §5.4`: "the insufficient case
        // is a designed outcome, not an error", and `API §9.3` classes it
        // explicitly as "not a failure".
        //
        // ⚠️ IT IS ALSO NOT A COMPLETION, AND THIS IS WHERE THAT WAS LOST.
        // `halted` used to be computed here, used for the returned `outcome`,
        // and then dropped: the row was written as a plain `completed` with no
        // record of the refusal, so `API-021` served an analysis that looked
        // ordinary and happened to be empty. Stage 3's `sufficiencyLevel` was
        // the only trace, and it says nothing at all about a Stage 1 decline.
        // The stage and the reason are now persisted, which is what lets the
        // read path answer `API §9.3` instead of guessing from absences.
        const haltedAt = result.haltedAt;

        await deps.prisma.analysis.update({
          where: { analysisId },
          data: {
            // The status enum has no `refused` member and none is being
            // invented: `DB §4.2` defines the set, adding to it would change
            // what every existing reader means by "terminal", and `API §9.3`
            // asks for a 422 on retrieval rather than a new lifecycle state.
            // The refusal is carried by the halt columns beside the status.
            status: "completed",
            completedAt: now(),
            degradationFlag: degraded,
            ...(haltedAt !== undefined
              ? {
                  haltedAtStage: haltedAt.stageNumber,
                  haltReason: haltedAt.reason,
                }
              : {}),
          },
        });

        // `API §7.4`: a terminal event is always emitted before the stream
        // closes, so a closed stream with no terminal event is a fault the
        // client can detect. The orchestrator owns the lifecycle, so it owns
        // this — the pipeline does not know when the job is done.
        //
        // A refusal says so in its terminal event too. A client that followed
        // the stream and saw a plain `complete` would go on to fetch an
        // analysis the API is about to refuse with a 422.
        emit(analysisId, {
          type: "complete",
          status: "completed",
          degraded,
          timedOut: false,
          artifactCounts: artifactCounts(result),
          ...(haltedAt !== undefined
            ? {
                refused: true,
                haltedAtStage: haltedAt.stageNumber,
                haltReason: haltedAt.reason,
              }
            : {}),
        });

        const halted = haltedAt !== undefined;

        return {
          analysisId,
          mode: deps.mode,
          outcome: degraded ? "degraded" : halted ? "halted" : "completed",
          result,
        };
      } catch (error) {
        deps.onError?.(error);
        return await fail(
          analysisId,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };

  /**
   * `FR-094` terminal timeout — distinct from failure, and deliberately so.
   *
   * A failure means the run could not produce an answer. A timeout means it
   * did not produce one *in time*, and `FR-094` requires what it did produce
   * to be presented rather than discarded. The status enum has carried
   * `timed_out` since the schema was written and `timeoutFlag` has been
   * readable through `API-021` and `API-026` all along; until now nothing set
   * either, so every over-long run was reported as a plain completion.
   *
   * `degradationFlag` is set too: an analysis cut short is partial by
   * definition, and `FR-091` treats an unlabelled partial result as the defect
   * worth preventing. Every artifact committed before the cutoff remains
   * retrievable, and the plan entries already distinguish what was generated
   * from what was never reached.
   */
  async function timeOut(analysisId: string): Promise<ExecutionReport> {
    await deps.prisma.analysis.update({
      where: { analysisId },
      data: {
        status: "timed_out",
        completedAt: now(),
        timeoutFlag: true,
        degradationFlag: true,
      },
    });

    // `API §7.4` — a terminal event before the stream closes, in every
    // terminal case. A client watching a timed-out run must not be left
    // waiting for an event that is never coming.
    emit(analysisId, {
      type: "complete",
      status: "timed_out",
      degraded: true,
      timedOut: true,
      // Unknown from here: the pipeline never returned its plan. Reporting
      // zeroes would assert that nothing was produced, which is a claim this
      // module cannot make — `API-021` reports what was actually stored.
      artifactCounts: { generated: 0, failed: 0, omitted: 0 },
    });

    return {
      analysisId,
      mode: deps.mode,
      outcome: "timed_out",
      failureReason: `The analysis exceeded its ${String(timeoutMs)}ms limit (FR-094).`,
    };
  }

  /**
   * Terminal failure. Whatever earlier stages committed stays committed
   * (`DB §6.2` progressive persistence, `FR-091`) — this moves the lifecycle,
   * it does not roll back the reasoning that succeeded.
   */
  async function fail(
    analysisId: string,
    failureReason: string,
  ): Promise<ExecutionReport> {
    await deps.prisma.analysis.update({
      where: { analysisId },
      data: { status: "failed", completedAt: now() },
    });
    // ⚠️ THE REASON DOES NOT TRAVEL. `failureReason` is a diagnostic — it has
    // carried a replay fixture key, and could carry a provider message — and
    // `API §9.5` keeps internal detail out of anything client-facing, while
    // `AI-006` keeps provider identity out entirely. The HTTP envelope already
    // answers a 500 with a fixed sentence for exactly this reason; the stream
    // says the same thing. The detail is on the stage trace, where an operator
    // can read it (`DB §8.4`).
    emit(analysisId, {
      type: "error",
      code: "internal_error",
      message: "The analysis failed before it completed.",
      stageNumber: null,
    });
    return { analysisId, mode: deps.mode, outcome: "failed", failureReason };
  }
}
