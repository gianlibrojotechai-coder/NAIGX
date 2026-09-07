/**
 * Session issuance, rotation and reuse detection (`API-001`–`API-003`, [D-44](../../../docs/19-D-44-Refresh-Token-Table.md)).
 *
 * ⚠️ THIS MODULE IS THE ONLY PLACE THAT READS `refresh_token`. `API §3.1`
 * makes access and refresh separate credential classes with different
 * lifetimes, and `src/auth/principal.ts` — which authenticates every protected
 * request — does not consult this table at all. A refresh token is therefore
 * not a `Bearer` credential for any resource route, structurally rather than
 * by a check somebody could remove.
 *
 * REUSE DETECTION IS THE REASON THE TABLE EXISTS. `API-002`: "Reuse of a
 * consumed refresh token invalidates the entire session family and writes a
 * security audit event — reuse indicates theft." Detecting that requires
 * recognising a token that has **already been spent**, so consumed rows are
 * retained rather than deleted. `DB §4.1`'s SESSION could not hold them, which
 * is the contradiction D-44 records.
 *
 * WHY REUSE REVOKES EVERYTHING. A spent token presented a second time means
 * either a client with a bug or an attacker replaying a stolen credential, and
 * the two are indistinguishable from here. Revoking the family costs the
 * honest client one re-login and costs the attacker the session; the opposite
 * default costs the user their account.
 */

import { randomUUID } from "node:crypto";

import {
  generateFamilyId,
  generateToken,
  hashIp,
  hashToken,
  userAgentClass,
} from "./tokens.js";

/**
 * `API §3.1` — "Refresh: separate refresh token, **longer-lived**".
 *
 * One hour of access and thirty days of refresh: short enough that a leaked
 * access token expires on its own, long enough that a returning user is not
 * asked to log in again. Neither number is prescribed by any document; both
 * are implementation values recorded here rather than in a decision record,
 * because unlike the anonymous lifetime ([D-45](../../../docs/20-D-45-Anonymous-Expiry-And-Token-Lifetime.md))
 * no requirement constrains them.
 */
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** What a caller is handed. The raw tokens exist only here and in the response. */
export interface IssuedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly sessionId: string;
}

export interface RequestContext {
  readonly ip: string;
  readonly userAgent: string | undefined;
  readonly correlationId: string | undefined;
}

/** The writes and reads this service needs. Deliberately narrow. */
export interface SessionStore {
  readonly session: {
    create(args: { data: Record<string, unknown> }): Promise<{
      sessionId: string;
    }>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
  readonly refreshToken: {
    create(args: { data: Record<string, unknown> }): Promise<{
      refreshTokenId: string;
    }>;
    /**
     * The session is joined in, because rotation needs the owning user and
     * whether the session itself was revoked. Declared as an `include` so the
     * port matches what the call actually asks for — a narrower type here
     * would compile against Prisma and then read `undefined` at runtime.
     */
    findUnique(args: {
      where: { tokenHash: string };
      include: { session: { select: { userId: true; revokedAt: true } } };
    }): Promise<{
      refreshTokenId: string;
      sessionId: string;
      familyId: string;
      expiresAt: Date;
      consumedAt: Date | null;
      revokedAt: Date | null;
      session: { userId: string; revokedAt: Date | null };
    } | null>;
    update(args: {
      where: { refreshTokenId: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
}

export interface AuditWriter {
  record(event: {
    userId: string | null;
    eventType: string;
    resourceType: string;
    resourceId?: string | null;
    outcome: string;
    correlationId?: string | null;
    ipHash?: string | null;
  }): Promise<void>;
}

export interface SessionServiceOptions {
  readonly store: SessionStore;
  readonly audit: AuditWriter;
  /** Salts the stored IP hash so it cannot be reversed by enumeration. */
  readonly ipSecret: string;
  readonly now?: () => Date;
}

/** What `API-002` produced, or why it refused. */
export type RefreshOutcome =
  | {
      readonly kind: "rotated";
      readonly tokens: IssuedTokens;
      readonly userId: string;
    }
  /** Unknown, expired, or belonging to a revoked session. */
  | { readonly kind: "invalid" }
  /** Already spent. The family is now revoked (`API-002`). */
  | { readonly kind: "reused" };

export interface SessionService {
  issue(userId: string, context: RequestContext): Promise<IssuedTokens>;
  refresh(
    refreshToken: string,
    context: RequestContext,
  ): Promise<RefreshOutcome>;
  revoke(
    sessionId: string,
    userId: string,
    context: RequestContext,
  ): Promise<void>;
}

export function createSessionService(
  options: SessionServiceOptions,
): SessionService {
  const now = options.now ?? (() => new Date());
  const { store, audit } = options;

  /**
   * Creates a session and the first token of a family.
   *
   * `familyId` is supplied rather than derived from the session so that a
   * rotation chain is identifiable even after the session row changes, and so
   * revoking a family is one predicate (`D-44` §3.4).
   */
  const issueInFamily = async (
    userId: string,
    familyId: string,
    sessionId: string | null,
    context: RequestContext,
  ): Promise<IssuedTokens> => {
    const at = now();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = new Date(at.getTime() + ACCESS_TOKEN_TTL_MS);

    // A rotation reuses the session; a fresh login creates one.
    const session =
      sessionId === null
        ? await store.session.create({
            data: {
              userId,
              tokenHash: hashToken(accessToken),
              expiresAt,
              userAgentClass: userAgentClass(context.userAgent),
              ipHash: hashIp(context.ip, options.ipSecret),
            },
          })
        : await (async () => {
            await store.session.updateMany({
              where: { sessionId, revokedAt: null },
              data: { tokenHash: hashToken(accessToken), expiresAt },
            });
            return { sessionId };
          })();

    await store.refreshToken.create({
      data: {
        sessionId: session.sessionId,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(at.getTime() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresAt,
      sessionId: session.sessionId,
    };
  };

  /** Revokes a family and its session. Used by logout and by reuse detection. */
  const revokeFamily = async (
    familyId: string,
    sessionId: string,
  ): Promise<void> => {
    const at = now();
    await store.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
    await store.session.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: at },
    });
  };

  return {
    async issue(userId, context) {
      const tokens = await issueInFamily(
        userId,
        generateFamilyId(),
        null,
        context,
      );
      // `API-001` acceptance — "successful login writes an audit event".
      await audit.record({
        userId,
        eventType: "session.created",
        resourceType: "session",
        resourceId: tokens.sessionId,
        outcome: "success",
        correlationId: context.correlationId ?? null,
        ipHash: hashIp(context.ip, options.ipSecret),
      });
      return tokens;
    },

    async refresh(refreshToken, context) {
      const stored = await store.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
        include: { session: { select: { userId: true, revokedAt: true } } },
      });
      if (stored === null) return { kind: "invalid" };

      const at = now();

      // ⚠️ REUSE IS CHECKED BEFORE EXPIRY AND BEFORE REVOCATION, DELIBERATELY.
      // A spent token is evidence of theft whatever its other state, and
      // checking expiry first would let an attacker replaying an old consumed
      // token be dismissed as "expired" — silently discarding the strongest
      // signal `API-002` exists to catch.
      if (stored.consumedAt !== null) {
        await revokeFamily(stored.familyId, stored.sessionId);
        await audit.record({
          userId: stored.session.userId,
          eventType: "session.refresh_reuse_detected",
          resourceType: "session",
          resourceId: stored.sessionId,
          outcome: "revoked",
          correlationId: context.correlationId ?? null,
          ipHash: hashIp(context.ip, options.ipSecret),
        });
        return { kind: "reused" };
      }

      if (
        stored.revokedAt !== null ||
        stored.session.revokedAt !== null ||
        stored.expiresAt <= at
      ) {
        return { kind: "invalid" };
      }

      // Rotate: the new token joins the same family, and the old row is marked
      // spent rather than removed — that retention is what makes the check
      // above possible at all.
      const tokens = await issueInFamily(
        stored.session.userId,
        stored.familyId,
        stored.sessionId,
        context,
      );

      await store.refreshToken.update({
        where: { refreshTokenId: stored.refreshTokenId },
        data: { consumedAt: at },
      });

      return { kind: "rotated", tokens, userId: stored.session.userId };
    },

    async revoke(sessionId, userId, context) {
      const at = now();
      // Both credential classes die together. `API-003`: "a subsequent request
      // with either returns 401."
      await store.session.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: at },
      });
      await store.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: at },
      });
      await audit.record({
        userId,
        eventType: "session.revoked",
        resourceType: "session",
        resourceId: sessionId,
        outcome: "success",
        correlationId: context.correlationId ?? null,
        ipHash: hashIp(context.ip, options.ipSecret),
      });
    },
  };
}

/** A correlation id for an audit row when the request context has none. */
export const auditCorrelationId = (): string => randomUUID();
