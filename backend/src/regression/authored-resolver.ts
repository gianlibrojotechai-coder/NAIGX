/**
 * A `FragmentResolver` over the fragments **authored on disk**
 * ([D-63](../../../docs/38-D-63-Authored-Fragment-Resolution-For-Regression.md)).
 *
 * ## ⚠️ THIS IS EVIDENCE MACHINERY, NOT A RUNTIME RESOLVER
 *
 * Production resolution is `db/fragment-resolver.ts` and reads **active
 * published versions**. That is unchanged and must stay unchanged: an
 * unpublished fragment is unusable at runtime, which is the property `DB §4.5`
 * exists to guarantee.
 *
 * This resolver exists because a change gate has to be able to test *the
 * change*. Composing a candidate fragment against the versions already active
 * would test the content already in force — which is precisely what a
 * candidate is not — and a fragment that has never been active could not be
 * composed at all, so it could never acquire the evidence its own activation
 * requires. D-63 §1 sets out that circularity.
 *
 * The publisher already reasoned this way: `assertActivationPermitted` is
 * given an authored resolver, because at publish time the database still holds
 * the previous version. Capture and the regression runner are the two paths
 * that had not caught up.
 *
 * ⚠️ **Being resolvable here does not make a fragment production-valid.** It
 * reaches production only by the unchanged route — a clean covering run, a
 * genuine reference, and the publisher's gate.
 */

import type { FragmentResolver, ResolvedFragment } from "../nie/ports.js";
import type { AuthoredFragment } from "../fragments/source.js";

/**
 * The `version` reported for an authored fragment.
 *
 * ⚠️ DELIBERATELY NOT A NUMBER. An authored fragment has no version — versions
 * are assigned by the publisher when a row is written. Reporting `"1"` here
 * would make a candidate indistinguishable from a published first version in
 * any trace that records it.
 */
export const AUTHORED_VERSION = "authored";

/**
 * Builds a resolver over a fixed set of authored fragments.
 *
 * Fails loudly on an unknown key rather than returning nothing: a stage asking
 * for a fragment that was never authored is a manifest or routing error, and
 * silently composing a shorter prompt would produce evidence about a prompt
 * nobody wrote.
 */
export function createAuthoredResolver(
  fragments: readonly AuthoredFragment[],
): FragmentResolver {
  const byKey = new Map(fragments.map((f) => [f.fragmentKey, f]));

  return {
    // ⚠️ `async` so a missing fragment REJECTS rather than throwing
    // synchronously. `FragmentResolver.resolve` returns a promise, and a
    // caller that handled failures with `.catch()` would miss a synchronous
    // throw entirely — the composition would blow up somewhere less obvious.
    resolve: async (keys) =>
      await Promise.resolve(
        keys.map((fragmentKey): ResolvedFragment => {
          const fragment = byKey.get(fragmentKey);
          if (fragment === undefined) {
            throw new RangeError(`No authored fragment "${fragmentKey}"`);
          }
          return {
            fragmentKey,
            // Derived from the content hash so two runs over identical
            // authored content produce identical identifiers — the fixture
            // keys built from this composition have to match across capture
            // and replay, or a recording can never be replayed (D-63 §5).
            fragmentVersionId: `authored:${fragment.contentHash.slice(0, 12)}`,
            version: AUTHORED_VERSION,
            content: fragment.content,
          };
        }),
      ),
  };
}
