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

import type { PipelineResult } from "../nie/contracts.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { ExecutionMode } from "./execution-mode.js";

/** What the run did, from the lifecycle's point of view. */
export type ExecutionOutcome =
  "completed" | "degraded" | "halted" | "failed" | "not_claimable";

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
   * Runs the reasoning. Supplied by the composition root already wired to an
   * adapter, the fragment resolver and the persistence sinks.
   */
  readonly runPipeline: (input: {
    readonly analysisId: string;
    readonly text: string;
  }) => Promise<PipelineResult>;
  readonly now?: () => Date;
  /** Surfaces a failure to the log without failing the run twice over. */
  readonly onError?: (error: unknown) => void;
}

export interface AnalysisExecutor {
  execute(analysisId: string): Promise<ExecutionReport>;
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

  return {
    async execute(analysisId) {
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
      const text = analysis?.input?.rawContent;

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
        const result = await deps.runPipeline({ analysisId, text });
        const degraded = wasDegraded(result);

        // A designed halt is not a failure. `AI §5.4`: "the insufficient case
        // is a designed outcome, not an error", and `API §9.3` classes it
        // explicitly as "not a failure". The reason is already recorded on the
        // analysis by Stage 3's sufficiency level.
        const halted = result.haltedAt !== undefined;

        await deps.prisma.analysis.update({
          where: { analysisId },
          data: {
            status: "completed",
            completedAt: now(),
            degradationFlag: degraded,
          },
        });

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
    return { analysisId, mode: deps.mode, outcome: "failed", failureReason };
  }
}
