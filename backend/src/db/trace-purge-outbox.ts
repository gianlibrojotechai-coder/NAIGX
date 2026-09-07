/**
 * The durable trace-purge queue (`DB §5.4`, `M-19` Phase 3).
 *
 * Same interface as the in-memory queue in `trace-purge.ts`, same four-step
 * contract, same `202` response. The only thing that changes is where the
 * instruction lives between step 2 and step 3 — and that was the gap.
 *
 * ## Why the table is in the PRIMARY store
 *
 * This looks backwards at first: the work is deleting rows from the *trace*
 * store, so the queue "should" live there. It must not, and the reason is the
 * whole design.
 *
 * `DB §5.4` step 1 commits the analysis deletion in the primary store. If the
 * instruction were written anywhere else, there would be an instant where the
 * deletion is durable and the instruction is not — a crash there loses the
 * purge silently, which is exactly the failure the in-memory queue had. Putting
 * the outbox in the primary store lets both writes share **one transaction**:
 * either the analysis is gone and its traces are owed a purge, or neither
 * happened.
 *
 * `DB §1.4` forbids a foreign key across the store boundary, and this respects
 * that — the outbox holds bare ids with no FK, and nothing joins the stores.
 *
 * ## What it does not change
 *
 * The user-facing promise is untouched. `API-011`/`API-023` still return `202`
 * with a stated window rather than `204`, because that promise was always
 * honoured at step 1 and never depended on the trace store. Durability changes
 * how reliably step 3 follows, not what the user is told.
 */

import {
  TRACE_PURGE_WINDOW_HOURS,
  type TracePurgeAudit,
  type TracePurgeClient,
  type TracePurgeQueue,
} from "./trace-purge.js";

/** The primary-store rows this queue owns. */
interface OutboxRow {
  readonly purgeId: string;
  readonly analysisIds: readonly string[];
  readonly userId: string | null;
  readonly correlationId: string | null;
  readonly attempts: number;
}

export interface OutboxStore {
  readonly tracePurgeOutbox: {
    create(args: {
      data: {
        analysisIds: string[];
        userId: string | null;
        correlationId: string | null;
      };
    }): Promise<unknown>;
    findMany(args: {
      where: { failedAt: null };
      orderBy: { enqueuedAt: "asc" };
      take: number;
    }): Promise<readonly OutboxRow[]>;
    delete(args: { where: { purgeId: string } }): Promise<unknown>;
    update(args: {
      where: { purgeId: string };
      data: {
        attempts?: number;
        lastErrorAt?: Date;
        failedAt?: Date;
      };
    }): Promise<unknown>;
    count(args: { where: { failedAt: null } }): Promise<number>;
  };
}

export interface TracePurgeOutboxOptions {
  /** The primary store — where the outbox lives. */
  readonly store: OutboxStore;
  /** The trace store — where the deletions happen. */
  readonly client: TracePurgeClient;
  readonly audit: TracePurgeAudit;
  /** `DB §5.4` step 3 — "with retry until confirmed". */
  readonly maxAttempts?: number;
  /** Bounds one drain pass, so a large backlog cannot monopolise the timer. */
  readonly batchSize?: number;
  readonly onError?: (error: unknown) => void;
  readonly now?: () => Date;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 100;

export function createTracePurgeOutbox(
  options: TracePurgeOutboxOptions,
): TracePurgeQueue {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const now = options.now ?? (() => new Date());

  // ⚠️ RE-ENTRANCY GUARD. `drain` runs on a timer AND once more at shutdown. A
  // slow pass that is still running when the timer fires again would select
  // the same rows twice and attempt the same deletion twice — harmless for the
  // delete itself, but it double-counts attempts and can double-audit a
  // completion. One instance is the sanctioned topology (D-50), so an
  // in-process flag is sufficient; a second instance would need row locking.
  let draining = false;

  return {
    async enqueue(instruction, tx) {
      if (instruction.analysisIds.length === 0) {
        // Nothing owed. The CHECK constraint would reject an empty array
        // anyway; refusing here keeps a bulk delete of zero analyses from
        // failing a transaction it has no business failing.
        return;
      }

      // `tx ?? options.store` is the durability decision in one line: with a
      // transaction, this row commits with the deletion; without one, it is a
      // separate commit and a crash between them loses the instruction.
      const writer = tx ?? options.store;
      await writer.tracePurgeOutbox.create({
        data: {
          analysisIds: [...instruction.analysisIds],
          userId: instruction.userId,
          correlationId: instruction.correlationId,
        },
      });
    },

    async drain() {
      if (draining) {
        return { purged: 0, failed: 0 };
      }
      draining = true;

      let purged = 0;
      let failed = 0;

      try {
        const rows = await options.store.tracePurgeOutbox.findMany({
          where: { failedAt: null },
          orderBy: { enqueuedAt: "asc" },
          take: batchSize,
        });

        for (const row of rows) {
          try {
            const ids = [...row.analysisIds];
            // Content-bearing rows only — `TracePurgeClient` explains why
            // PROVIDER_INVOCATION is deliberately not purged.
            await options.client.stageTrace.deleteMany({
              where: { analysisId: { in: ids } },
            });

            // ⚠️ ORDER MATTERS. The audit is written BEFORE the row is
            // deleted, so a crash in between re-runs the purge and re-audits
            // it — a duplicate audit entry for a deletion that did happen.
            // The other order loses the record of a purge that did happen,
            // which is the one `DB §5.4` step 4 exists to prevent.
            await options.audit.record({
              userId: row.userId,
              eventType: "trace.purged",
              resourceType: "analysis",
              resourceId: ids.join(","),
              outcome: "success",
              correlationId: row.correlationId,
            });

            await options.store.tracePurgeOutbox.delete({
              where: { purgeId: row.purgeId },
            });
            purged += ids.length;
          } catch (error) {
            options.onError?.(error);
            const attempts = row.attempts + 1;

            if (attempts < maxAttempts) {
              await options.store.tracePurgeOutbox.update({
                where: { purgeId: row.purgeId },
                data: { attempts, lastErrorAt: now() },
              });
            } else {
              // Marked, never deleted: the row records a purge the user was
              // told would happen and which did not. Deleting it would destroy
              // the only evidence that anything is owed.
              await options.store.tracePurgeOutbox.update({
                where: { purgeId: row.purgeId },
                data: { attempts, lastErrorAt: now(), failedAt: now() },
              });
              failed += row.analysisIds.length;
              await options.audit.record({
                userId: row.userId,
                eventType: "trace.purge_failed",
                resourceType: "analysis",
                resourceId: row.analysisIds.join(","),
                outcome: "failed",
                correlationId: row.correlationId,
              });
            }
          }
        }
      } finally {
        draining = false;
      }

      return { purged, failed };
    },

    pending() {
      return options.store.tracePurgeOutbox.count({
        where: { failedAt: null },
      });
    },
  };
}

/**
 * Instructions that have been owed longer than the window quoted to the user.
 *
 * `API-011` tells the user their traces go within `TRACE_PURGE_WINDOW_HOURS`.
 * A row older than that is a **broken promise**, not a slow one, and Phase 4's
 * alerting is meant to say so. Exposed here so the metric has one definition
 * rather than a threshold repeated at each call site.
 */
export const purgeOverdueBefore = (now: Date): Date =>
  new Date(now.getTime() - TRACE_PURGE_WINDOW_HOURS * 60 * 60 * 1000);
