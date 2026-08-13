/**
 * Production `FragmentUsageSink` — persists the per-run fragment composition
 * (`DB §4.5` FRAGMENT_USAGE, `AI-013`).
 *
 * `AI-013` requires the *composition* be recorded, not merely a template
 * identifier: when a quality regression appears, this table answers "which
 * analyses used the suspect fragment version?" and, for any stored analysis,
 * reconstructs the exact composition that produced it.
 *
 * Rows carry real foreign keys — `analysis_id` to `ANALYSIS` and
 * `fragment_version_id` to `PROMPT_FRAGMENT_VERSION` (RESTRICT, `DB §5.3`: a
 * version referenced by history is never deletable). Both live in the primary
 * store, so these are ordinary in-database relationships, unlike the trace
 * store's identifier-only links.
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type { FragmentUsageRecord, FragmentUsageSink } from "../nie/ports.js";

export function createFragmentUsageSink(
  prisma: PrismaClient,
): FragmentUsageSink {
  return {
    async record(usages: readonly FragmentUsageRecord[]): Promise<void> {
      if (usages.length === 0) {
        return;
      }
      await prisma.fragmentUsage.createMany({
        data: usages.map((usage) => ({
          analysisId: usage.analysisId,
          fragmentVersionId: usage.fragmentVersionId,
          stage: usage.stage,
          ordinal: usage.ordinal,
        })),
      });
    },
  };
}
