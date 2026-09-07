/**
 * Cross-store trace purge (`DB §5.4`, `DB §12.2`, `FR-063`, `FR-073`).
 *
 * WHY THIS EXISTS AT ALL. `DB §1.4` forbids any foreign key across the store
 * boundary, so deleting an analysis in the primary store cannot cascade to its
 * stage traces. `DB §5.4` sets the contract instead:
 *
 *   1. Analysis deletion commits in the primary store — the user's request is
 *      honored immediately
 *   2. A purge instruction is enqueued for the trace store
 *   3. Traces are purged asynchronously with retry until confirmed
 *   4. Purge completion is recorded as an audit event
 *
 * **The user-facing guarantee is honored at step 1.** That is why `API-011`
 * and `API-023` return `202` with a stated window rather than `204`: returning
 * 204 would claim a completeness spanning two stores that the system cannot
 * yet guarantee, and `API-011`'s own note calls that "the difference between a
 * kept and a broken deletion promise".
 *
 * ## The queue below is the IN-MEMORY one, and it is no longer what production
 * uses
 *
 * `M-19` Phase 3 added `trace-purge-outbox.ts`: the same interface, backed by a
 * table in the **primary** store and written in the same transaction as the
 * deletion. That closes the gap this comment used to describe — a restart
 * between step 1 and step 3 losing the instruction.
 *
 * This implementation remains because it is genuinely useful: it needs no
 * database, so unit tests drive step 3 deterministically, and `app.ts`
 * registers a no-op variant when no trace store is wired at all.
 *
 * ⚠️ IT IS NOT A FALLBACK FOR PRODUCTION. An instance that quietly used this
 * one would honour `FR-073` in the primary store and forget the trace half on
 * the next restart — the exact failure Phase 3 removed. The composition root
 * builds the durable queue; nothing selects this because the durable one was
 * unavailable.
 *
 * ## Why `enqueue` is asynchronous
 *
 * It used to return `void`, which was honest for an in-memory array and
 * impossible for a durable queue: "the instruction is accepted" has to mean
 * "the row is committed", and that cannot be claimed without awaiting a write.
 * The optional `tx` parameter is what lets the caller put that write inside the
 * deletion's own transaction, so there is no instant where one is durable and
 * the other is not.
 */

/**
 * The window quoted to the user (`API-011`, `API-023` — "a stated completion
 * window returned in the response").
 *
 * 24 hours, and the number is not arbitrary: `DB §8.3` already expires stage
 * traces at 7 days, so the promise here is that a deletion beats that schedule
 * by a wide margin. It is a bound, not an estimate — the purge normally runs
 * within seconds.
 */
export const TRACE_PURGE_WINDOW_HOURS = 24;

export const tracePurgeWindow = (): string =>
  `${String(TRACE_PURGE_WINDOW_HOURS)} hours`;

export interface PurgeInstruction {
  readonly analysisIds: readonly string[];
  /** Who asked, for the completion audit event. Null if the user is gone. */
  readonly userId: string | null;
  readonly correlationId: string | null;
  readonly attempts: number;
}

/**
 * The trace-store writes a purge needs.
 *
 * ⚠️ STAGE TRACES ONLY. `PROVIDER_INVOCATION` is deliberately **not** purged,
 * and that is not an omission:
 *
 *   · It holds **no user content**. `DB §8.3` classes its content sensitivity
 *     as "None — metrics only", against StageTrace's "High — full user
 *     business content". `FR-073` promises removal of "all analyses and
 *     personal data"; token counts and latency are neither.
 *   · `DB §4.7` says so directly: "Because this entity holds no content, it
 *     may outlive stage traces. This matters: cost and reliability analysis
 *     over a long window is valuable, and it should not require retaining user
 *     business content to obtain."
 *   · It carries no `analysis_id` to purge by — it references a
 *     `stage_trace_id`, and `DB §8.3` gives it 30 days against StageTrace's
 *     7 precisely so the two expire independently.
 *
 * Purging it would destroy the cost and reliability history `TV-4` and
 * `NFR-083` depend on, to remove data that identifies nobody.
 */
export interface TracePurgeClient {
  readonly stageTrace: {
    deleteMany(args: {
      where: { analysisId: { in: string[] } };
    }): Promise<{ count: number }>;
  };
}

export interface TracePurgeAudit {
  record(event: {
    userId: string | null;
    eventType: string;
    resourceType: string;
    resourceId?: string | null;
    outcome: string;
    correlationId?: string | null;
  }): Promise<void>;
}

export interface TracePurgeQueueOptions {
  readonly client: TracePurgeClient;
  readonly audit: TracePurgeAudit;
  /** `DB §5.4` step 3 — "with retry until confirmed". */
  readonly maxAttempts?: number;
  readonly onError?: (error: unknown) => void;
}

/**
 * A transaction handle the enqueue can join.
 *
 * ⚠️ THIS PARAMETER IS THE DURABILITY GUARANTEE, NOT AN OPTIMISATION. Passing
 * the deletion's own transaction is what makes "the analysis is deleted" and
 * "its traces are owed a purge" commit together or not at all. Omitting it
 * writes the instruction in its own transaction, which reopens a small window
 * between the two commits — acceptable for a test, wrong for the delete route.
 */
export interface PurgeOutboxWriter {
  readonly tracePurgeOutbox: {
    create(args: {
      data: {
        analysisIds: string[];
        userId: string | null;
        correlationId: string | null;
      };
    }): Promise<unknown>;
  };
}

export interface TracePurgeQueue {
  /**
   * `DB §5.4` step 2. Resolves once the instruction is **accepted** — for the
   * durable queue that means committed, not merely remembered.
   *
   * Pass `tx` to enlist in the caller's transaction; see `PurgeOutboxWriter`.
   */
  enqueue(
    instruction: Omit<PurgeInstruction, "attempts">,
    tx?: PurgeOutboxWriter,
  ): Promise<void>;
  /** Drains the queue. Called on a timer, and directly by tests. */
  drain(): Promise<{ purged: number; failed: number }>;
  /** Instructions still owed. A query for the durable queue, hence async. */
  pending(): Promise<number>;
}

const DEFAULT_MAX_ATTEMPTS = 5;

export function createTracePurgeQueue(
  options: TracePurgeQueueOptions,
): TracePurgeQueue {
  const queue: PurgeInstruction[] = [];
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  return {
    enqueue(instruction) {
      // `tx` is accepted and ignored: an in-memory array has no transaction to
      // join. The signature matches so the two implementations are
      // interchangeable at the one swap point.
      if (instruction.analysisIds.length > 0) {
        queue.push({ ...instruction, attempts: 0 });
      }
      return Promise.resolve();
    },

    async drain() {
      let purged = 0;
      let failed = 0;

      // Snapshot: an instruction re-queued for retry must not be retried
      // again in the same pass, or a persistent failure would spin.
      const batch = queue.splice(0, queue.length);

      for (const instruction of batch) {
        try {
          const ids = [...instruction.analysisIds];
          // Content-bearing rows only — see `TracePurgeClient`.
          await options.client.stageTrace.deleteMany({
            where: { analysisId: { in: ids } },
          });

          // `DB §5.4` step 4 — completion is recorded.
          await options.audit.record({
            userId: instruction.userId,
            eventType: "trace.purged",
            resourceType: "analysis",
            resourceId: ids.join(","),
            outcome: "success",
            correlationId: instruction.correlationId,
          });
          purged += ids.length;
        } catch (error) {
          options.onError?.(error);
          const attempts = instruction.attempts + 1;
          if (attempts < maxAttempts) {
            queue.push({ ...instruction, attempts });
          } else {
            // Giving up silently would leave the user believing traces were
            // purged. The audit trail records that they were not.
            failed += instruction.analysisIds.length;
            await options.audit.record({
              userId: instruction.userId,
              eventType: "trace.purge_failed",
              resourceType: "analysis",
              resourceId: instruction.analysisIds.join(","),
              outcome: "failed",
              correlationId: instruction.correlationId,
            });
          }
        }
      }

      return { purged, failed };
    },

    pending() {
      return Promise.resolve(queue.length);
    },
  };
}
