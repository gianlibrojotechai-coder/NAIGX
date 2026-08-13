/**
 * Production `FragmentResolver` — resolves published fragment versions at
 * runtime from the primary store (`DB §4.5`, `docs/12` D-3).
 *
 * Lives in `db/` because it holds the Prisma import. The NIE declares the port
 * and never sees this file (`AD-02`, boundary check 2).
 *
 * WHICH VERSION IS "THE" VERSION. `PROMPT_FRAGMENT_VERSION` is append-only
 * (`DP-4`), so a fragment key has many rows. The active one is the row that has
 * been activated and not deprecated; where several qualify, the most recently
 * activated wins. That ordering is what makes `AI-014` rollback work: activating
 * an older version's row makes it current again without a deploy and without
 * deleting anything.
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type { FragmentResolver, ResolvedFragment } from "../nie/ports.js";

export function createFragmentResolver(prisma: PrismaClient): FragmentResolver {
  return {
    async resolve(
      fragmentKeys: readonly string[],
    ): Promise<readonly ResolvedFragment[]> {
      if (fragmentKeys.length === 0) {
        return [];
      }

      const rows = await prisma.promptFragmentVersion.findMany({
        where: {
          activatedAt: { not: null },
          deprecatedAt: null,
          fragment: { fragmentKey: { in: [...fragmentKeys] } },
        },
        // Newest activation first, so the first row seen per key is the active
        // one. `createdAt` breaks ties for rows activated in the same instant.
        orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          fragmentVersionId: true,
          version: true,
          content: true,
          fragment: { select: { fragmentKey: true } },
        },
      });

      const active = new Map<string, ResolvedFragment>();
      for (const row of rows) {
        const key = row.fragment.fragmentKey;
        if (active.has(key)) {
          continue;
        }
        active.set(key, {
          fragmentKey: key,
          fragmentVersionId: row.fragmentVersionId,
          version: row.version,
          content: row.content,
        });
      }

      const missing = fragmentKeys.filter((key) => !active.has(key));
      if (missing.length > 0) {
        // Halting, deliberately. A stage running without its framing fragment
        // would produce output shaped by nothing, which is exactly what the
        // composition model exists to prevent (`AI-012`, `AIP-5`).
        throw new Error(
          `No active published version for fragment(s): ${missing.join(", ")}`,
        );
      }

      return fragmentKeys.map((key) => active.get(key) as ResolvedFragment);
    },
  };
}
