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
 * ⚠️ IN-PROCESS, AND THAT IS A LIMITATION. The queue below lives in memory, so
 * a process restart between step 1 and step 3 loses the instruction and leaves
 * traces the user asked to be deleted. That is a real gap, recorded here and
 * in `docs/STATUS.md` rather than implied away — and it is bounded by
 * `DB §8.3`, which expires stage traces after **7 days** regardless. The worst
 * case is therefore a delay, not indefinite retention.
 *
 * Closing it properly needs a durable queue, which is `M-19` infrastructure
 * work of the same kind [D-46](../../../docs/21-D-46-In-Memory-Rate-Limiting.md)
 * deferred for rate limiting. The alternatives were worse: refusing the
 * deletion until traces are gone would make a trace-store outage into a
 * refusal to honour `FR-073`, and deleting synchronously would make the user
 * wait on a store their request does not depend on.
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

export interface TracePurgeQueue {
  /** `DB §5.4` step 2. Returns once the instruction is accepted, not done. */
  enqueue(instruction: Omit<PurgeInstruction, "attempts">): void;
  /** Drains the queue. Called on a timer, and directly by tests. */
  drain(): Promise<{ purged: number; failed: number }>;
  readonly pending: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;

export function createTracePurgeQueue(
  options: TracePurgeQueueOptions,
): TracePurgeQueue {
  const queue: PurgeInstruction[] = [];
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  return {
    enqueue(instruction) {
      if (instruction.analysisIds.length === 0) return;
      queue.push({ ...instruction, attempts: 0 });
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

    get pending() {
      return queue.length;
    },
  };
}
