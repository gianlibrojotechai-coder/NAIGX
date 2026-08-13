/**
 * Fragment tooling — the change gate and the publisher (`docs/12` D-3, D-14).
 *
 *   npm run fragments:check    verify authored fragments match the manifest
 *   npm run fragments:write    record the current fragments in the manifest
 *   npm run fragments:publish  publish to PROMPT_FRAGMENT_VERSION and activate
 *
 * `check` is the gate boundary check 7 requires: a fragment cannot change
 * without the change being recorded, and therefore reviewed. It needs no
 * database and no network, so it runs in the ordinary test gate.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildManifest,
  detectDrift,
  isClean,
  readAuthoredFragments,
  type FragmentManifest,
} from "../src/fragments/source.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const PROMPTS_ROOT = path.join(ROOT, "prompts");
export const MANIFEST_PATH = path.join(PROMPTS_ROOT, "fragments.manifest.json");

export const readManifest = (): FragmentManifest =>
  JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as FragmentManifest;

const command = process.argv[2];

if (command === "check") {
  const fragments = readAuthoredFragments(PROMPTS_ROOT);
  const drift = detectDrift(fragments, readManifest());

  if (isClean(drift)) {
    console.log(`✅ ${String(fragments.length)} fragments match the manifest.`);
    process.exit(0);
  }

  console.error(
    "❌ Fragment drift — NFR-043: a fragment change must be recorded.",
  );
  for (const [label, keys] of [
    ["changed", drift.changed],
    ["added", drift.added],
    ["removed", drift.removed],
  ] as const) {
    for (const key of keys) console.error(`   ${label}: ${key}`);
  }
  console.error("\n   Review the diff, then run: npm run fragments:write");
  process.exit(1);
}

if (command === "write") {
  const fragments = readAuthoredFragments(PROMPTS_ROOT);
  const manifest = buildManifest(fragments, readManifest().version);
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Recorded ${String(fragments.length)} fragments.`);
  process.exit(0);
}

if (command === "publish") {
  const { default: pg } = await import("pg");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  await import("dotenv/config");

  const fragments = readAuthoredFragments(PROMPTS_ROOT);
  const manifest = readManifest();
  const drift = detectDrift(fragments, manifest);
  if (!isClean(drift)) {
    console.error(
      "❌ Refusing to publish: fragments do not match the manifest.",
    );
    console.error("   Run `npm run fragments:check` for detail.");
    process.exit(1);
  }

  // `DB §4.5`: activation requires a recorded passing regression run. Until the
  // Sprint 2 corpus suite exists, that reference names the gate that actually
  // ran — the manifest gate — rather than a fabricated pass (`docs/12` D-14).
  const regressionPassReference = `fragment-manifest-gate:${manifest.version}`;

  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  let published = 0;
  let unchanged = 0;

  for (const fragment of fragments) {
    const existing = await prisma.promptFragment.findUnique({
      where: { fragmentKey: fragment.fragmentKey },
      include: {
        versions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

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
        regressionPassReference,
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
    `Published ${String(published)} new version(s); ${String(unchanged)} unchanged.`,
  );
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
}

console.error("Usage: fragments.mts <check|write|publish>");
process.exit(2);
