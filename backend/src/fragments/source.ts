/**
 * The authored fragment source — `prompts/` (`AD-14`, `docs/12` D-3).
 *
 * Fragments are authored as repository assets so their changes are reviewable
 * as diffs (`FR-019`), and published to `PROMPT_FRAGMENT_VERSION` so the runtime
 * can resolve them without a deploy (`AI-014`). This module reads the authored
 * side; `db/fragment-resolver.ts` reads the published side. `content_hash` is
 * what ties the two together and detects divergence (`DB §4.5`).
 *
 * Reads the filesystem and nothing else — no database, no network.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** `PROMPT_FRAGMENT.fragment_class` values that exist as directories today. */
const DIRECTORY_CLASS: Readonly<Record<string, string>> = {
  foundation: "foundation",
  stage: "stage",
  // The database vocabulary is `type_modifier`; the directory is `type/`
  // because the fragment key reads better as `type.workflow`.
  type: "type_modifier",
  artifact: "artifact",
  output_contract: "output_contract",
};

export interface AuthoredFragment {
  /** `<directory>.<filename>` — e.g. `stage.classification`. */
  readonly fragmentKey: string;
  readonly fragmentClass: string;
  readonly content: string;
  /** sha256 of the content, as stored in `PROMPT_FRAGMENT_VERSION`. */
  readonly contentHash: string;
  /** Repository-relative path, for review and error messages. */
  readonly sourcePath: string;
}

export const hashContent = (content: string): string =>
  createHash("sha256").update(content, "utf8").digest("hex");

/**
 * Reads every authored fragment, in a stable order.
 *
 * Line endings are normalised before hashing so a checkout on Windows and one
 * on Linux agree — otherwise the manifest gate would fail for half the
 * contributors for a reason that has nothing to do with the reasoning.
 */
export function readAuthoredFragments(promptsRoot: string): AuthoredFragment[] {
  const fragments: AuthoredFragment[] = [];

  for (const dirent of fs
    .readdirSync(promptsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const fragmentClass = DIRECTORY_CLASS[dirent.name];
    if (fragmentClass === undefined) {
      throw new Error(
        `prompts/${dirent.name}/ is not a recognised fragment class (expected one of ${Object.keys(DIRECTORY_CLASS).join(", ")})`,
      );
    }

    const dir = path.join(promptsRoot, dirent.name);
    for (const file of fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()) {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const content = raw.replace(/\r\n/g, "\n").trimEnd();
      fragments.push({
        fragmentKey: `${dirent.name}.${file.replace(/\.md$/, "")}`,
        fragmentClass,
        content,
        contentHash: hashContent(content),
        sourcePath: `prompts/${dirent.name}/${file}`,
      });
    }
  }

  return fragments;
}

export interface FragmentManifest {
  readonly version: string;
  readonly fragments: Readonly<Record<string, string>>;
}

export const buildManifest = (
  fragments: readonly AuthoredFragment[],
  version: string,
): FragmentManifest => ({
  version,
  fragments: Object.fromEntries(
    fragments.map((f) => [f.fragmentKey, f.contentHash]),
  ),
});

export interface ManifestDrift {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}

/**
 * Compares authored fragments against the recorded manifest.
 *
 * This is the change-detection half of `NFR-043`: a fragment cannot be edited
 * without the edit being recorded and therefore reviewed. It is **not** the
 * golden-corpus output regression suite — see `docs/12` D-14.
 */
export function detectDrift(
  fragments: readonly AuthoredFragment[],
  manifest: FragmentManifest,
): ManifestDrift {
  const authored = new Map(
    fragments.map((f) => [f.fragmentKey, f.contentHash]),
  );
  const recorded = new Map(Object.entries(manifest.fragments));

  return {
    added: [...authored.keys()].filter((k) => !recorded.has(k)).sort(),
    removed: [...recorded.keys()].filter((k) => !authored.has(k)).sort(),
    changed: [...authored.entries()]
      .filter(([k, h]) => recorded.has(k) && recorded.get(k) !== h)
      .map(([k]) => k)
      .sort(),
  };
}

export const isClean = (drift: ManifestDrift): boolean =>
  drift.added.length === 0 &&
  drift.removed.length === 0 &&
  drift.changed.length === 0;
