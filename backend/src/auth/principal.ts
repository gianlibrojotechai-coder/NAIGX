/**
 * Who is asking (`API §3.3`, `API §3.4`, `NFR-026`).
 *
 * One `Authorization: Bearer` header carries two token classes, and
 * `API §3.4` says "the API distinguishes by token class". This module is where
 * that distinction is made, once, so no route re-implements it.
 *
 * ⚠️ AN ACCESS CREDENTIAL AND A REFRESH CREDENTIAL ARE DIFFERENT CLASSES.
 * A refresh token is resolvable from the database, and that must **never**
 * make it usable as a `Bearer` credential on a protected route. This resolver
 * does not read `refresh_token` at all — `API-002` alone consults that table,
 * through `consumeRefreshToken`, which is a separate entry point. A refresh
 * token presented here therefore matches no session and no anonymous
 * ownership, and resolves to `none`. That is not an accident of lookup order;
 * it is the reason the lookups are separate functions.
 *
 * ⚠️ AN ANALYSIS ID IS A NAME, NOT A CREDENTIAL. The anonymous principal is
 * established **only** by presenting a token whose hash matches a stored
 * `anonymous_token_hash`. The analysis it names is the *result* of that
 * verification and never an input to it: there is no path here that accepts an
 * id and concludes ownership. A caller who knows an analysis id and holds no
 * token is `none`.
 *
 * `NFR-026` requires authorization "enforced server-side on every history and
 * export operation" and `API §3.3` adds "never from a client-supplied owner
 * identifier". Both are properties of this file.
 */

import { hashToken } from "./tokens.js";

/** An authenticated account. */
export interface UserPrincipal {
  readonly kind: "user";
  readonly userId: string;
  readonly sessionId: string;
}

/**
 * A verified anonymous token, scoped to exactly one analysis (`API §3.4`).
 *
 * `analysisId` is what the presented token proved ownership *of*. It is
 * populated from the matched row, never from the request.
 */
export interface AnonymousPrincipal {
  readonly kind: "anonymous";
  readonly analysisId: string;
}

/** No credential, or one that verified against nothing. */
export interface NoPrincipal {
  readonly kind: "none";
}

export type Principal = UserPrincipal | AnonymousPrincipal | NoPrincipal;

export const ANONYMOUS: NoPrincipal = { kind: "none" };

/**
 * The raw token out of an `Authorization` header, or `null`.
 *
 * Case-insensitive on the scheme, because `API §3.1` names the scheme and RFC
 * 7235 makes it case-insensitive; a client sending `bearer` is not an attacker.
 */
export function bearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/** The reads this resolver needs. Deliberately narrow. */
export interface PrincipalLookup {
  readonly session: {
    findFirst(args: {
      where: {
        tokenHash: string;
        revokedAt: null;
        expiresAt: { gt: Date };
      };
      select: { sessionId: true; userId: true };
    }): Promise<{ sessionId: string; userId: string } | null>;
  };
  readonly analysis: {
    findFirst(args: {
      where: {
        anonymousTokenHash: string;
        userId: null;
      };
      select: { analysisId: true; createdAt: true };
    }): Promise<{ analysisId: string; createdAt: Date } | null>;
  };
}

export interface ResolveOptions {
  /** When an anonymous token issued at a given time stops being valid. */
  readonly anonymousTokenExpiresAt: (issuedAt: Date) => Date;
  readonly now: () => Date;
}

/**
 * Resolves a presented token into a principal.
 *
 * Session first, then anonymous. The order is a cost optimisation and not a
 * security property: the two hashes come from disjoint spaces of 256-bit
 * random values, so a token cannot match both, and swapping the order would
 * change nothing but the number of queries.
 *
 * Never throws on a bad token. An unrecognised credential is `none`, and the
 * route decides what that means for it — a 401 on a protected route, a
 * perfectly ordinary request on an open one.
 */
export async function resolvePrincipal(
  header: string | undefined,
  lookup: PrincipalLookup,
  options: ResolveOptions,
): Promise<Principal> {
  const token = bearerToken(header);
  if (token === null) return ANONYMOUS;

  const tokenHash = hashToken(token);
  const now = options.now();

  // An access token. Expiry and revocation are in the query rather than
  // checked afterwards: a revoked session must be unfindable, not found and
  // then discarded, so no later edit can accidentally use the row.
  const session = await lookup.session.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
    select: { sessionId: true, userId: true },
  });
  if (session !== null) {
    return {
      kind: "user",
      userId: session.userId,
      sessionId: session.sessionId,
    };
  }

  // An anonymous token. `userId: null` in the where clause means a **claimed**
  // analysis stops answering to its old anonymous token the moment ownership
  // transfers — the claim invalidates the credential by construction rather
  // than by remembering to clear it.
  const owned = await lookup.analysis.findFirst({
    where: { anonymousTokenHash: tokenHash, userId: null },
    select: { analysisId: true, createdAt: true },
  });
  if (owned === null) return ANONYMOUS;

  // `API §3.4` — "Lifetime: short, fixed". Checked against issuance, so use
  // does not extend it.
  if (options.anonymousTokenExpiresAt(owned.createdAt) <= now) {
    return ANONYMOUS;
  }

  return { kind: "anonymous", analysisId: owned.analysisId };
}

// --- authorization ----------------------------------------------------------

/** What a stored analysis says about who owns it. */
export interface AnalysisOwner {
  readonly analysisId: string;
  readonly ownerUserId: string | null;
}

/**
 * Whether this principal may act on this analysis (`NFR-026`).
 *
 * The single ownership predicate. `API-021`, `API-025`, `API-026`, `API-030`
 * through `API-032` and `API-040` all ask it, so "who may read an analysis" is
 * answered in one place rather than six.
 *
 * ⚠️ AN ANONYMOUS PRINCIPAL MUST NAME THIS EXACT ANALYSIS. `API §3.4` scopes
 * an anonymous token to "exactly one analysis", and that is enforced here by
 * comparing the id the *token* resolved to against the id being acted on. A
 * token for analysis A grants nothing on analysis B, and single-analysis scope
 * is therefore a property of the credential rather than a counter.
 */
export function mayAccessAnalysis(
  principal: Principal,
  analysis: AnalysisOwner,
): boolean {
  if (analysis.ownerUserId !== null) {
    // Owned: only its owner, and never an anonymous token — a claimed analysis
    // has no anonymous credential any more.
    return (
      principal.kind === "user" && principal.userId === analysis.ownerUserId
    );
  }

  // Unowned: only the holder of the token that resolved to this analysis.
  return (
    principal.kind === "anonymous" &&
    principal.analysisId === analysis.analysisId
  );
}
