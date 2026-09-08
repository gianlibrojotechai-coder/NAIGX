/**
 * Fragment publisher — the production entry point (`docs/12` D-3, D-14).
 *
 *   docker compose ... run --rm fragments publish -- --reference=<ref>
 *
 * ## ⚠️ WHY THIS EXISTS SEPARATELY FROM `scripts/fragments.mts`
 *
 * The runtime image prunes dev dependencies and ships no `scripts/` directory,
 * so `npm run fragments:publish` — which runs `tsx scripts/fragments.mts` —
 * cannot execute on a deployment. That is the same defect `encrypt.ts` was
 * moved here to avoid, discovered again the first time a real deploy needed to
 * activate its fragments.
 *
 * This file carries **only the publish path**. `check` and `write` are
 * development gates that run in CI against a checkout, need no database, and
 * have no business in a production image.
 *
 * ## ⚠️ THE ACTIVATION GATE IS NOT RELAXED HERE, AND MUST NOT BE
 *
 * `DB §4.5` and `docs/12` D-24 require that a fragment version becomes active
 * only on evidence that a passing regression run exercised **that fragment**.
 * The reference is supplied by the operator and checked by
 * `assertActivationPermitted`; this module manufactures nothing. An earlier
 * version of the script did mint its own reference, and D-14 replaced it for
 * exactly that reason.
 *
 * ## Where it reads from
 *
 * `prompts/` and `research/` are **not** baked into the image. They are
 * bind-mounted read-only by the compose service, because they are authored
 * content and evidence artifacts rather than application code — and because
 * `prompts/` sits outside the backend build context, so a `COPY` could not
 * reach it without pulling the whole repository into every image build.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  detectDrift,
  isClean,
  readAuthoredFragments,
  type AuthoredFragment,
  type FragmentManifest,
} from "../fragments/source.js";
import { PrismaClient } from "../generated/prisma/client.js";
import type { FragmentResolver, ResolvedFragment } from "../nie/ports.js";
import {
  ActivationRefusedError,
  assertActivationPermitted,
} from "../regression/activation-gate.js";
import { loadCorpus, loadSuiteVersion } from "../regression/corpus.js";
import { createRecordingStore } from "../regression/recording-store.js";

/**
 * Resolved the same way `corpus.ts` and `recording-store.ts` resolve theirs, so
 * one mental model covers all of them: three levels up from the compiled
 * module. In a checkout that is the repository root; in the image it is `/`,
 * which is where the compose service mounts them.
 */
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const PROMPTS_ROOT = path.join(ROOT, "prompts");
const MANIFEST_PATH = path.join(PROMPTS_ROOT, "fragments.manifest.json");

const readManifest = (): FragmentManifest =>
  JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as FragmentManifest;

/**
 * A resolver over the fragments **about to be published**, not the active ones.
 *
 * Coverage asks which corpus cases compose a fragment. At publish time the
 * database still holds the previous version — and on a first publish, none at
 * all — so asking the database would compute coverage for the wrong content.
 */
const authoredResolver = (
  fragments: readonly AuthoredFragment[],
): FragmentResolver => {
  const byKey = new Map(fragments.map((f) => [f.fragmentKey, f]));
  return {
    resolve: (keys) =>
      Promise.resolve(
        keys.map((fragmentKey): ResolvedFragment => {
          const fragment = byKey.get(fragmentKey);
          if (fragment === undefined) {
            throw new RangeError(`No authored fragment "${fragmentKey}"`);
          }
          return {
            fragmentKey,
            fragmentVersionId: `authored:${fragment.contentHash.slice(0, 12)}`,
            version: "authored",
            content: fragment.content,
          };
        }),
      ),
  };
};

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const close = async (): Promise<void> => {
  await prisma.$disconnect();
  await pool.end();
};

async function publish(): Promise<void> {
  const fragments = readAuthoredFragments(PROMPTS_ROOT);
  const drift = detectDrift(fragments, readManifest());
  if (!isClean(drift)) {
    console.error(
      "❌ Refusing to publish: fragments do not match the manifest.",
    );
    console.error("   Run `npm run fragments:check` in a checkout for detail.");
    await close();
    process.exit(1);
  }

  // ⚠️ SUPPLIED, NEVER MANUFACTURED (D-14). The operator names a run; the gate
  // decides whether it counts.
  const reference = process.argv
    .slice(3)
    .find((arg) => arg.startsWith("--reference="))
    ?.slice("--reference=".length);

  let published = 0;
  let unchanged = 0;

  // Read pass first. Which fragments would actually be activated is a fact
  // about the store, so it must be read before the gate can be asked about
  // them — and nothing is written until the gate has passed, so a refusal
  // leaves every existing row exactly as it was.
  const existingByKey = new Map(
    await Promise.all(
      fragments.map(
        async (fragment) =>
          [
            fragment.fragmentKey,
            await prisma.promptFragment.findUnique({
              where: { fragmentKey: fragment.fragmentKey },
              include: {
                versions: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            }),
          ] as const,
      ),
    ),
  );

  const changing = fragments
    .filter(
      (fragment) =>
        existingByKey.get(fragment.fragmentKey)?.versions[0]?.contentHash !==
        fragment.contentHash,
    )
    .map((fragment) => fragment.fragmentKey);

  if (changing.length > 0) {
    try {
      await assertActivationPermitted({
        reference,
        fragmentKeys: changing,
        cases: loadCorpus(),
        suiteVersion: loadSuiteVersion(),
        store: createRecordingStore(),
        resolver: authoredResolver(fragments),
      });
    } catch (error) {
      if (error instanceof ActivationRefusedError) {
        console.error(`❌ Refusing to activate [${error.reason}]`);
        console.error(`   ${error.message}`);
        console.error(
          "\n   Usage: ... run --rm fragments publish -- --reference=corpus-regression:<suite>+<fragments>:<runId>",
        );
        await close();
        process.exit(1);
      }
      throw error;
    }
  }

  for (const fragment of fragments) {
    const existing = existingByKey.get(fragment.fragmentKey) ?? null;

    const parent =
      existing ??
      (await prisma.promptFragment.create({
        data: {
          fragmentKey: fragment.fragmentKey,
          fragmentClass: fragment.fragmentClass as "foundation",
          // ⚠️ `owner_class` has no defined vocabulary (`docs/12` D-10).
          ownerClass: "reasoning",
        },
        include: { versions: true },
      }));

    const latest = existing?.versions[0];
    if (latest?.contentHash === fragment.contentHash) {
      unchanged += 1;
      continue;
    }

    // Append-only (`DP-4`): a new row, never an edit of the previous one.
    const nextVersion = String((latest ? Number(latest.version) : 0) + 1);
    await prisma.promptFragmentVersion.create({
      data: {
        fragmentId: parent.fragmentId,
        version: nextVersion,
        content: fragment.content,
        contentHash: fragment.contentHash,
        activatedAt: new Date(),
        // Spread rather than assigned: under `exactOptionalPropertyTypes` an
        // explicit `undefined` is not the same as an absent column, and the
        // gate above has already refused any case where this would be missing
        // for a *changing* fragment.
        ...(reference !== undefined
          ? { regressionPassReference: reference }
          : {}),
      },
    });

    // Soft-deprecate the version this supersedes (`DP-7`).
    if (latest !== undefined) {
      await prisma.promptFragmentVersion.update({
        where: { fragmentVersionId: latest.fragmentVersionId },
        data: { deprecatedAt: new Date() },
      });
    }
    published += 1;
  }

  console.log(
    `✅ Published ${String(published)} new version(s); ${String(unchanged)} unchanged.`,
  );
}

/** Reports what is active, so an operator can check without a write path. */
async function status(): Promise<void> {
  const active = await prisma.promptFragmentVersion.findMany({
    where: { deprecatedAt: null },
    include: { fragment: true },
    orderBy: { activatedAt: "desc" },
  });
  console.log(`${String(active.length)} active fragment version(s).`);
  for (const version of active) {
    console.log(
      `  ${version.fragment.fragmentKey} v${version.version} — ref ${version.regressionPassReference ?? "(none)"}`,
    );
  }
}

try {
  switch (process.argv[2]) {
    case "publish":
      await publish();
      break;
    case "status":
      await status();
      break;
    default:
      console.error("Usage: fragments <publish|status> [--reference=...]");
      process.exitCode = 1;
  }
} finally {
  await close();
}
