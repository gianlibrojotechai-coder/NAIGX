/**
 * Recorded provider spend, read from the trace store for the spend guard
 * ([D-67](../../../docs/42-D-67-Owner-Only-Live-Release.md) §3).
 *
 * One aggregate over `provider_invocation.estimated_cost` — the per-call
 * figure `NFR-083` requires and the one every M-20 sample was reconciled
 * against. Nothing is cached: the guard is consulted once per submission,
 * and a stale sum is exactly the way a cap gets exceeded.
 *
 * ⚠️ `estimated_cost` is recorded from the provider's usage report. A call
 * cancelled before usage arrives is recorded at $0 (`STATUS.md`, open issue
 * 2026-09-09), so this sum can UNDERSTATE spend by at most one full call per
 * cancellation. The guard's per-analysis reserve is what absorbs that.
 */

import type { PrismaClient as TracePrismaClient } from "../generated/prisma-trace/client.js";

/**
 * Structurally the orchestrator's `SpendReader`; not imported, because
 * persistence must not depend outward on the orchestrator (AP-1, boundary
 * check 4). The composition root is where the two meet.
 */
export function createTraceSpendReader(tracePrisma: TracePrismaClient): {
  spentSince(since: Date): Promise<string>;
} {
  return {
    async spentSince(since) {
      const result = await tracePrisma.providerInvocation.aggregate({
        _sum: { estimatedCost: true },
        where: { recordedAt: { gte: since } },
      });
      const sum = result._sum.estimatedCost;
      // Prisma's Decimal serialises exactly; `null` is "no rows", i.e. zero.
      return sum === null ? "0" : sum.toFixed(8);
    },
  };
}
