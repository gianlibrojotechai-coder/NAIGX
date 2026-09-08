/**
 * Replay against the composition a recording was **captured** with
 * ([D-63](../../../docs/38-D-63-Authored-Fragment-Resolution-For-Regression.md) §7,
 * the runner amendment).
 *
 * ## ⚠️ THE MISTAKE THIS CORRECTS
 *
 * D-63 originally sent the runner to the authored resolver, on the reasoning
 * that capture and replay must use "the same resolver" for fixture keys to
 * match. The truer statement is that they must use **the same composition** —
 * which for a fresh capture is the authored one, and for an existing recording
 * is whatever it was captured under. Collapsing those two invalidated ten
 * recordings the moment authored content drifted from active content.
 *
 * ## Why the fragments are pinned rather than the instructions
 *
 * `replayKeyFor` hashes the composed `instructions`, so exact replay needs
 * byte-identical instructions. Two representations could guarantee that:
 * storing the composed text per stage, or storing the fragments it was composed
 * from. The fragments win on both counts —
 *
 *   · **smaller**: the four foundation fragments appear in every stage's
 *     instructions, so storing text per stage duplicates them once per stage;
 *   · **structural**: `composePrompt` still does the composing, so there is no
 *     second assembly path free to disagree with the pipeline's.
 *
 * `composePrompt` is a pure function of the resolver's output and a fixed key
 * order, so pinning its inputs pins its output exactly.
 *
 * ⚠️ **Replayability is not evidential currency.** A recording replayed this
 * way always answers the prompt it was captured against. Whether it is still
 * *evidence* for a newer candidate composition is a separate question, and the
 * activation gate — not this resolver — is what answers it.
 */

import type { FragmentResolver, ResolvedFragment } from "../nie/ports.js";

/**
 * How a recording's fragments were resolved at capture time.
 *
 * ⚠️ Recorded, never inferred. A legacy recording has no value here, and must
 * not be given one retroactively: labelling it `active` would assert something
 * about a capture nobody re-examined.
 */
export const CAPTURE_RESOLUTIONS = ["authored", "active"] as const;
export type CaptureResolution = (typeof CAPTURE_RESOLUTIONS)[number];

/** One fragment exactly as it was resolved when the recording was captured. */
export interface RecordedFragment {
  readonly fragmentKey: string;
  readonly fragmentVersionId: string;
  readonly version: string;
  readonly content: string;
}

/**
 * The composition a recording was captured against.
 *
 * Absent on recordings captured before this existed — see the legacy path in
 * `runner.ts`, which is explicit rather than implied.
 */
export interface RecordedComposition {
  readonly resolution: CaptureResolution;
  readonly fragments: readonly RecordedFragment[];
}

/**
 * A resolver that answers only from a recording's captured composition.
 *
 * It consults no database and no filesystem, which is the entire point: what
 * the fragments look like *today* cannot change what this returns, so a
 * recording's fixture keys are stable for as long as the recording exists.
 */
export function createPinnedResolver(
  composition: RecordedComposition,
): FragmentResolver {
  const byKey = new Map(composition.fragments.map((f) => [f.fragmentKey, f]));

  return {
    resolve: async (keys) =>
      await Promise.resolve(
        keys.map((fragmentKey): ResolvedFragment => {
          const fragment = byKey.get(fragmentKey);
          if (fragment === undefined) {
            // A stage asking for a fragment the capture never composed means
            // the recording and the pipeline disagree about the path taken.
            // Failing loudly beats composing a shorter prompt and replaying
            // against a request that was never recorded.
            throw new RangeError(
              `Recording has no captured fragment "${fragmentKey}" — the ` +
                `recorded composition does not cover the stage being replayed`,
            );
          }
          return {
            fragmentKey,
            fragmentVersionId: fragment.fragmentVersionId,
            version: fragment.version,
            content: fragment.content,
          };
        }),
      ),
  };
}

/**
 * Collects what a resolver returned, so a capture can persist its composition.
 *
 * Wraps rather than replaces: the capture still resolves through whatever
 * resolver it was given (authored, per D-63's capture decision), and this only
 * observes the answers. Deduplicated by key — the foundation fragments resolve
 * once per stage and are identical every time.
 */
export function recordingResolver(inner: FragmentResolver): {
  readonly resolver: FragmentResolver;
  readonly collected: () => readonly RecordedFragment[];
} {
  const seen = new Map<string, RecordedFragment>();

  return {
    resolver: {
      resolve: async (keys) => {
        const resolved = await inner.resolve(keys);
        for (const fragment of resolved) {
          seen.set(fragment.fragmentKey, {
            fragmentKey: fragment.fragmentKey,
            fragmentVersionId: fragment.fragmentVersionId,
            version: fragment.version,
            content: fragment.content,
          });
        }
        return resolved;
      },
    },
    // Sorted so a recording's composition is byte-stable across captures of
    // the same content — an unordered set would make identical captures differ.
    collected: () =>
      [...seen.values()].sort((a, b) =>
        a.fragmentKey.localeCompare(b.fragmentKey),
      ),
  };
}
