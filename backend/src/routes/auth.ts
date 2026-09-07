/**
 * Authentication endpoints — `API-001`–`API-004` (`API §6.1`).
 *
 *   POST   /auth/sessions          login, 201
 *   POST   /auth/sessions/refresh  rotate, 200
 *   DELETE /auth/sessions/current  logout, 204
 *   POST   /users                  register, 201
 *
 * ⚠️ AN UNKNOWN EMAIL AND A WRONG PASSWORD MUST BE INDISTINGUISHABLE.
 * `API-001`: "Invalid credentials return an identical response shape **and
 * timing profile** regardless of whether the email exists." Both halves are
 * enforced here — one error object for both cases, and a scrypt derivation
 * charged even when no account matched. Skipping the derivation would make
 * this endpoint an account-enumeration oracle that no amount of response
 * matching could hide.
 *
 * ⚠️ REFRESH IS A SEPARATE CREDENTIAL CLASS. `API-002` takes the refresh token
 * in the **body**, never as a `Bearer` header, and the request authenticator
 * never resolves one. A refresh token is therefore not an access credential
 * anywhere in this API — structurally, per [D-44](../../docs/19-D-44-Refresh-Token-Table.md).
 *
 * `FR-004` CLAIM ON AUTHENTICATION. Both `API-001` and `API-004` accept an
 * optional `anonymous_token`, and both audit the transfer (`DB §10.3`). The
 * claim is verified by the token, never by an analysis id.
 */

import type { FastifyPluginAsync, FastifyRequest } from "fastify";

import { AppError } from "../http/errors.js";
import { sendSuccess } from "../http/responses.js";
import {
  hashPassword,
  hashToken,
  verifyPassword,
  verifyPasswordAgainstMissingUser,
} from "../auth/tokens.js";
import type { SessionService, RequestContext } from "../auth/sessions.js";
import type { RateLimiter } from "../auth/rate-limit.js";
import type { AuditWriter } from "../auth/sessions.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { anonymousTokenExpiresAt } from "../db/anonymous-expiry.js";

export interface AuthRouteOptions {
  readonly prisma: PrismaClient;
  readonly sessions: SessionService;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditWriter;
  readonly now?: () => Date;
}

interface CredentialsBody {
  readonly email?: unknown;
  readonly password?: unknown;
  readonly anonymous_token?: unknown;
}

/**
 * `API-004` — "password meets policy".
 *
 * No document states a policy. Length is the only property with real evidence
 * behind it, so length is what is required and nothing else: composition rules
 * (a digit, a symbol) push users toward predictable substitutions and are not
 * asked for by any requirement here.
 */
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 200;

const requestContext = (request: FastifyRequest): RequestContext => ({
  ip: request.ip,
  userAgent: request.headers["user-agent"],
  correlationId: request.id,
});

/** `API-001`/`API-004` — "email well-formed". Deliberately permissive. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(body: CredentialsBody): {
  email: string;
  password: string;
} {
  const { email, password } = body;

  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    throw new AppError("validation_failed", "A valid `email` is required.", {
      field: "email",
      action: "Send the email address for the account.",
    });
  }
  if (typeof password !== "string" || password === "") {
    throw new AppError("validation_failed", "`password` is required.", {
      field: "password",
      action: "Send the account password.",
    });
  }

  return { email: email.trim().toLowerCase(), password };
}

/** The anonymous token presented for an `FR-004` claim, if any. */
function validateAnonymousToken(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new AppError(
      "validation_failed",
      "`anonymous_token` must be the token issued with the anonymous analysis.",
      {
        field: "anonymous_token",
        action:
          "Omit the field, or send the token returned when the analysis was created.",
      },
    );
  }
  return raw;
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = (
  app,
  { prisma, sessions, rateLimiter, audit, now = () => new Date() },
) => {
  /** `429` with the `Retry-After` `API §10.4` requires. */
  const enforceLimit = (
    rateClass: Parameters<RateLimiter["check"]>[0],
    key: string,
  ): void => {
    const decision = rateLimiter.check(rateClass, key, now());
    if (!decision.allowed) {
      throw new AppError(
        "rate_limited",
        "Too many attempts. This limit exists to make credential guessing impractical.",
        {
          action: `Wait ${String(decision.retryAfterSeconds)} seconds and try again.`,
          details: { retry_after_seconds: decision.retryAfterSeconds },
        },
      );
    }
  };

  /**
   * `FR-004` / `DB §10.3` — ownership rewritten to `user_id`, token cleared,
   * claim audited.
   *
   * ⚠️ VERIFIED BY THE TOKEN, NEVER BY AN ANALYSIS ID. The claim matches on
   * `anonymous_token_hash` and `userId: null`, so a caller can only claim an
   * analysis they hold the credential for — and a claim of an already-owned
   * analysis matches nothing rather than transferring it away from its owner.
   *
   * A token that matches nothing is **not** an error. `API-001` and `API-004`
   * make the field optional and their acceptance says a presented token
   * transfers ownership; it does not say a stale one fails the login. Failing
   * would mean a user whose analysis expired cannot log in at all.
   */
  const claimAnonymousAnalysis = async (
    token: string | undefined,
    userId: string,
    request: FastifyRequest,
  ): Promise<string | null> => {
    if (token === undefined) return null;

    const candidate = await prisma.analysis.findFirst({
      where: { anonymousTokenHash: hashToken(token), userId: null },
      select: { analysisId: true, createdAt: true },
    });
    if (candidate === null) return null;

    // An expired token is not a credential any more (`API §3.4`, D-45).
    if (anonymousTokenExpiresAt(candidate.createdAt) <= now()) return null;

    const { count } = await prisma.analysis.updateMany({
      // `userId: null` again in the update, so two concurrent claims cannot
      // both succeed — the second matches nothing.
      where: { analysisId: candidate.analysisId, userId: null },
      data: { userId, anonymousTokenHash: null },
    });
    if (count === 0) return null;

    await audit.record({
      userId,
      eventType: "analysis.claimed",
      resourceType: "analysis",
      resourceId: candidate.analysisId,
      outcome: "success",
      correlationId: request.id,
    });

    return candidate.analysisId;
  };

  // --- API-004 — register ---------------------------------------------------
  app.post("/users", async (request, reply) => {
    const body = (request.body ?? {}) as CredentialsBody;
    enforceLimit("authAttemptIp", request.ip);

    const { email, password } = validateCredentials(body);
    const anonymousToken = validateAnonymousToken(body.anonymous_token);

    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      throw new AppError(
        "validation_failed",
        `A password must be between ${String(PASSWORD_MIN)} and ${String(PASSWORD_MAX)} characters. Length is what makes a password hard to guess; composition rules mostly make it hard to remember.`,
        {
          field: "password",
          action: `Choose a longer passphrase — ${String(PASSWORD_MIN)} characters or more.`,
        },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { userId: true },
    });
    if (existing !== null) {
      // `API-004` specifies `email_in_use` 409 here. This *is* an enumeration
      // surface, and it is the specified behaviour: registration cannot both
      // tell a user their email is taken and conceal that it is taken.
      // `API-001` is where concealment matters, and it conceals.
      throw new AppError(
        "email_in_use",
        "An account already exists for that email address.",
        { field: "email", action: "Sign in instead, or use another address." },
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        credentialHash: await hashPassword(password),
        // `API-004` acceptance — settings created with defaults, and
        // `training_consent` defaults to false (`NFR-030`), which the column
        // default already guarantees.
        settings: { create: { defaultExportFormat: "markdown" } },
      },
      select: {
        userId: true,
        email: true,
        createdAt: true,
        trainingConsent: true,
      },
    });

    await audit.record({
      userId: user.userId,
      eventType: "user.registered",
      resourceType: "user",
      resourceId: user.userId,
      outcome: "success",
      correlationId: request.id,
    });

    const claimed = await claimAnonymousAnalysis(
      anonymousToken,
      user.userId,
      request,
    );
    const tokens = await sessions.issue(user.userId, requestContext(request));

    return sendSuccess(
      request,
      reply,
      {
        user: {
          user_id: user.userId,
          email: user.email,
          created_at: user.createdAt.toISOString(),
          training_consent: user.trainingConsent,
        },
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt.toISOString(),
        ...(claimed !== null ? { claimed_analysis_id: claimed } : {}),
      },
      201,
    );
  });

  // --- API-001 — login ------------------------------------------------------
  app.post("/auth/sessions", async (request, reply) => {
    const body = (request.body ?? {}) as CredentialsBody;
    enforceLimit("authAttemptIp", request.ip);

    const { email, password } = validateCredentials(body);
    const anonymousToken = validateAnonymousToken(body.anonymous_token);

    // Per account as well as per IP (`API §11.2` — credential stuffing). Keyed
    // on the email as presented, because the account may not exist and the
    // limit has to apply either way.
    enforceLimit("authAttemptAccount", email);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { userId: true, credentialHash: true, deletedAt: true },
    });

    // ⚠️ THE TIMING PROFILE IS THE POINT. A missing account is charged the
    // same derivation as a real one. Without this the endpoint answers in
    // microseconds for unknown emails and in scrypt-time for known ones, which
    // enumerates the user table regardless of what the response body says.
    const valid =
      user === null || user.credentialHash === null || user.deletedAt !== null
        ? await verifyPasswordAgainstMissingUser(password)
        : await verifyPassword(password, user.credentialHash);

    if (!valid || user === null) {
      await audit.record({
        // No user id: attributing a failed login to an account would record
        // that the account exists, in a table meant to survive deletion.
        userId: null,
        eventType: "session.login_failed",
        resourceType: "session",
        outcome: "denied",
        correlationId: request.id,
      });
      // One error object for both cases.
      throw new AppError(
        "invalid_credentials",
        "That email and password do not match an account.",
        {
          action:
            "Check both and try again, or register if you have no account.",
        },
      );
    }

    // A successful login is not an attack. Without this reset, someone who
    // mistypes their password four times stays one failure from a lockout for
    // the rest of the window.
    rateLimiter.reset("authAttemptAccount", email);

    const claimed = await claimAnonymousAnalysis(
      anonymousToken,
      user.userId,
      request,
    );
    const tokens = await sessions.issue(user.userId, requestContext(request));

    return sendSuccess(
      request,
      reply,
      {
        user: { user_id: user.userId, email },
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt.toISOString(),
        ...(claimed !== null ? { claimed_analysis_id: claimed } : {}),
      },
      201,
    );
  });

  // --- API-002 — refresh ----------------------------------------------------
  //
  // The refresh token arrives in the **body**. It is not a `Bearer` credential
  // and the request authenticator never resolves one (D-44).
  app.post("/auth/sessions/refresh", async (request, reply) => {
    enforceLimit("authAttemptIp", request.ip);

    const body = (request.body ?? {}) as { refresh_token?: unknown };
    if (typeof body.refresh_token !== "string" || body.refresh_token === "") {
      throw new AppError("validation_failed", "`refresh_token` is required.", {
        field: "refresh_token",
        action: "Send the refresh token issued with the session.",
      });
    }

    const outcome = await sessions.refresh(
      body.refresh_token,
      requestContext(request),
    );

    if (outcome.kind === "reused") {
      // `API-002`: reuse indicates theft. The family is already revoked by the
      // service; the message says what happened, because a user whose session
      // was cut needs to know it was cut deliberately.
      throw new AppError(
        "token_reused",
        "That refresh token had already been used. The session has been ended as a precaution, because a reused token can mean it was copied.",
        {
          action:
            "Sign in again. If you did not expect this, change your password.",
        },
      );
    }

    if (outcome.kind === "invalid") {
      throw new AppError(
        "invalid_token",
        "That refresh token is not valid or has expired.",
        { action: "Sign in again." },
      );
    }

    return sendSuccess(request, reply, {
      access_token: outcome.tokens.accessToken,
      refresh_token: outcome.tokens.refreshToken,
      expires_at: outcome.tokens.expiresAt.toISOString(),
    });
  });

  // --- API-003 — logout -----------------------------------------------------
  app.delete("/auth/sessions/current", async (request, reply) => {
    const principal = request.principal;

    // `API-003` acceptance — "idempotent: logging out twice is not an error".
    // An unauthenticated call has nothing to revoke and has already achieved
    // what it asked for.
    if (principal.kind !== "user") {
      return reply.code(204).send();
    }

    await sessions.revoke(
      principal.sessionId,
      principal.userId,
      requestContext(request),
    );
    return reply.code(204).send();
  });

  return Promise.resolve();
};
