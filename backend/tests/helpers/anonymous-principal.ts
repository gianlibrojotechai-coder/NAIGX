/**
 * Test helper — presenting a valid anonymous credential.
 *
 * WHY EVERY READ TEST NEEDS THIS NOW. Before `M-15`, `API-021`, `API-025`,
 * `API-026`, `API-032` and `API-040` enforced no ownership at all: knowing an
 * analysis id was enough to read it, and the route header said so. Ownership
 * is now enforced, so a test that reads an analysis has to hold the credential
 * for it — exactly as a real client does.
 *
 * A test that instead asserted a bare id still works would be asserting the
 * vulnerability. So these helpers make the *correct* thing convenient rather
 * than making the old thing keep passing.
 *
 * `analysis.findFirst` is the query `resolvePrincipal` uses for the anonymous
 * class, and the double below applies the same predicates the real query does
 * — including `userId: null`, so a claimed analysis stops answering to its old
 * token in tests too.
 */

import { generateToken, hashToken } from "../../src/auth/tokens.js";

/** A token and the hash a stored analysis must carry to answer to it. */
export interface AnonymousCredential {
  readonly token: string;
  readonly tokenHash: string;
  readonly header: { readonly authorization: string };
}

export const anonymousCredential = (): AnonymousCredential => {
  const token = generateToken();
  return {
    token,
    tokenHash: hashToken(token),
    header: { authorization: `Bearer ${token}` },
  };
};

/**
 * The `analysis.findFirst` a Prisma double needs for anonymous resolution.
 *
 * Enforces the real predicates rather than returning the row unconditionally:
 * a double that answered any token would let an authorization bug pass.
 */
export const anonymousLookup = (
  credential: AnonymousCredential,
  analysis: { analysisId: string; createdAt?: Date; userId?: string | null },
) => ({
  findFirst: ({
    where,
  }: {
    where: { anonymousTokenHash: string; userId: null };
  }) =>
    Promise.resolve(
      where.anonymousTokenHash === credential.tokenHash &&
        (analysis.userId ?? null) === null
        ? {
            analysisId: analysis.analysisId,
            createdAt: analysis.createdAt ?? new Date(),
          }
        : null,
    ),
});

/** A session lookup that matches nothing. Anonymous tests need no sessions. */
export const noSessions = {
  findFirst: () => Promise.resolve(null),
};
