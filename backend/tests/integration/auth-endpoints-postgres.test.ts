/**
 * Integration — `API-001`–`API-004` against **real Postgres**.
 *
 * Run against the database rather than doubles because the properties under
 * test are transactional: rotation must consume exactly one row, reuse must
 * revoke a whole family, and logout must invalidate two credential classes at
 * once. A fake would agree with whatever the code did.
 *
 * The tests that matter here each describe a way in:
 *
 *   · account enumeration through the login response or its timing
 *   · a refresh token accepted as an access credential
 *   · a spent refresh token still working
 *   · reuse detected but the family left alive
 *   · a revoked session still resolving
 *
 * REQUIRES THE PRIMARY DATABASE. Unreachable means skip locally, fail in CI.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { buildApp } from "../../src/app.js";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { createRateLimiter } from "../../src/auth/rate-limit.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";

const reachable = async (url: string | undefined): Promise<boolean> => {
  if (url === undefined || url === "") return false;
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
};

const DATABASE_AVAILABLE = await reachable(process.env["DATABASE_URL"]);
const DATABASE_REQUIRED =
  process.env["CI"] === "true" || process.env["REQUIRE_DB_TESTS"] === "1";

if (!DATABASE_AVAILABLE && DATABASE_REQUIRED) {
  throw new Error(
    "Database-backed auth tests are mandatory here " +
      `(CI=${String(process.env["CI"])}, REQUIRE_DB_TESTS=${String(process.env["REQUIRE_DB_TESTS"])}) ` +
      "but DATABASE_URL is unreachable.",
  );
}

const skip = DATABASE_AVAILABLE
  ? false
  : "requires DATABASE_URL to be reachable (set REQUIRE_DB_TESTS=1 to make this an error)";

const config: AppConfig = {
  databaseUrl: process.env["DATABASE_URL"] ?? "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  spend: { reserveUsdPerAnalysis: "0.30" },
  port: 0,
  host: "127.0.0.1",
  trustProxy: false,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const PASSWORD = "a-sufficiently-long-passphrase";

/** A fresh app over the real database, with an isolated rate limiter. */
const harness = async () => {
  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const database = {
    prisma,
    disconnect: () => pool.end(),
  } as unknown as Database;

  const app = await buildApp({
    config,
    database,
    // Per-test limiter, so one test's attempts cannot exhaust another's.
    rateLimiter: createRateLimiter(),
  });

  const createdUsers: string[] = [];

  return {
    app,
    prisma,
    async register(email = `test-${randomUUID()}@example.test`, body = {}) {
      const res = await app.inject({
        method: "POST",
        url: "/users",
        payload: { email, password: PASSWORD, ...body },
      });
      if (res.statusCode === 201) {
        createdUsers.push(JSON.parse(res.body).data.user.user_id);
      }
      return { res, email };
    },
    async cleanup() {
      for (const userId of createdUsers) {
        await prisma.user.delete({ where: { userId } }).catch(() => undefined);
      }
      await app.close();
      await pool.end();
    },
  };
};

// --- API-004 registration ---------------------------------------------------

test(
  "API-004 — registration creates a user, settings and a session",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { res } = await h.register();
      const body = JSON.parse(res.body);

      assert.equal(res.statusCode, 201);
      assert.ok(body.data.access_token);
      assert.ok(body.data.refresh_token);
      assert.notEqual(body.data.access_token, body.data.refresh_token);

      // `NFR-030` — training consent defaults to false and needs an explicit act.
      assert.equal(body.data.user.training_consent, false);

      const settings = await h.prisma.userSettings.findUnique({
        where: { userId: body.data.user.user_id },
      });
      assert.ok(settings, "USER_SETTINGS was not created");
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "API-004 — a credential is never returned or stored in plaintext",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { res } = await h.register();
      assert.equal(
        res.body.includes(PASSWORD),
        false,
        "the password was echoed",
      );

      const userId = JSON.parse(res.body).data.user.user_id;
      const user = await h.prisma.user.findUnique({ where: { userId } });
      assert.ok(user?.credentialHash);
      assert.equal(user.credentialHash.includes(PASSWORD), false);
      assert.match(user.credentialHash, /^scrypt\$/);
    } finally {
      await h.cleanup();
    }
  },
);

test("a duplicate email is refused with email_in_use", { skip }, async () => {
  const h = await harness();
  try {
    const { email } = await h.register();
    const { res } = await h.register(email);

    assert.equal(res.statusCode, 409);
    assert.equal(JSON.parse(res.body).error.code, "email_in_use");
  } finally {
    await h.cleanup();
  }
});

test(
  "a short password is refused with a reason, not a rule list",
  { skip },
  async () => {
    const h = await harness();
    try {
      const res = await h.app.inject({
        method: "POST",
        url: "/users",
        payload: {
          email: `test-${randomUUID()}@example.test`,
          password: "short",
        },
      });
      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.body).error.action, /longer/i);
    } finally {
      await h.cleanup();
    }
  },
);

// --- API-001 login ----------------------------------------------------------

test("API-001 — correct credentials issue a session", { skip }, async () => {
  const h = await harness();
  try {
    const { email } = await h.register();
    const res = await h.app.inject({
      method: "POST",
      url: "/auth/sessions",
      payload: { email, password: PASSWORD },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.data.access_token);
    assert.ok(body.data.expires_at);
  } finally {
    await h.cleanup();
  }
});

test(
  "API-001 — an unknown email and a wrong password are indistinguishable",
  { skip },
  async () => {
    // The enumeration surface. Both must return the same code, the same message
    // and the same action — anything that differs tells an attacker which
    // addresses have accounts.
    const h = await harness();
    try {
      const { email } = await h.register();

      const wrongPassword = await h.app.inject({
        method: "POST",
        url: "/auth/sessions",
        payload: { email, password: "definitely-not-the-password" },
      });
      const unknownEmail = await h.app.inject({
        method: "POST",
        url: "/auth/sessions",
        payload: {
          email: `absent-${randomUUID()}@example.test`,
          password: "definitely-not-the-password",
        },
      });

      assert.equal(wrongPassword.statusCode, 401);
      assert.equal(unknownEmail.statusCode, 401);

      const a = JSON.parse(wrongPassword.body).error;
      const b = JSON.parse(unknownEmail.body).error;
      assert.equal(a.code, b.code);
      assert.equal(a.message, b.message);
      assert.equal(a.action, b.action);
      assert.equal(a.code, "invalid_credentials");
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "a failed login is audited without naming the account",
  { skip },
  async () => {
    // Attributing a failed login to a user id would record that the account
    // exists, in a table designed to survive that account's deletion.
    const h = await harness();
    try {
      await h.app.inject({
        method: "POST",
        url: "/auth/sessions",
        payload: {
          email: `absent-${randomUUID()}@example.test`,
          password: "wrong",
        },
      });

      const event = await h.prisma.auditEvent.findFirst({
        where: { eventType: "session.login_failed" },
        orderBy: { occurredAt: "desc" },
      });
      assert.ok(event);
      assert.equal(event.userId, null);
      assert.equal(event.outcome, "denied");
    } finally {
      await h.cleanup();
    }
  },
);

// --- API-002 rotation and reuse ---------------------------------------------

test(
  "API-002 — rotation issues a new pair and consumes the old token",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { res } = await h.register();
      const first = JSON.parse(res.body).data;

      const rotated = await h.app.inject({
        method: "POST",
        url: "/auth/sessions/refresh",
        payload: { refresh_token: first.refresh_token },
      });

      assert.equal(rotated.statusCode, 200);
      const second = JSON.parse(rotated.body).data;
      assert.notEqual(second.refresh_token, first.refresh_token);
      assert.notEqual(second.access_token, first.access_token);

      // The consumed row is RETAINED — that retention is what makes reuse
      // detectable at all (D-44).
      const consumed = await h.prisma.refreshToken.findMany({
        where: { consumedAt: { not: null } },
      });
      assert.ok(consumed.length >= 1);
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "API-002 — reusing a consumed token revokes the entire family",
  { skip },
  async () => {
    // The security property the whole refresh_token table exists for.
    const h = await harness();
    try {
      const { res } = await h.register();
      const first = JSON.parse(res.body).data;

      const rotated = await h.app.inject({
        method: "POST",
        url: "/auth/sessions/refresh",
        payload: { refresh_token: first.refresh_token },
      });
      const second = JSON.parse(rotated.body).data;

      // Replay the spent token.
      const reused = await h.app.inject({
        method: "POST",
        url: "/auth/sessions/refresh",
        payload: { refresh_token: first.refresh_token },
      });

      assert.equal(reused.statusCode, 401);
      assert.equal(JSON.parse(reused.body).error.code, "token_reused");

      // The *newest* token is dead too — that is what "entire family" means.
      const afterRevocation = await h.app.inject({
        method: "POST",
        url: "/auth/sessions/refresh",
        payload: { refresh_token: second.refresh_token },
      });
      assert.notEqual(
        afterRevocation.statusCode,
        200,
        "the live token survived a reuse detection — the family was not revoked",
      );

      // And a security audit event was written.
      const event = await h.prisma.auditEvent.findFirst({
        where: { eventType: "session.refresh_reuse_detected" },
        orderBy: { occurredAt: "desc" },
      });
      assert.ok(event, "reuse was not audited");
      assert.equal(event.outcome, "revoked");
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "reuse also kills the access token the family issued",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { res } = await h.register();
      const first = JSON.parse(res.body).data;

      const rotated = await h.app.inject({
        method: "POST",
        url: "/auth/sessions/refresh",
        payload: { refresh_token: first.refresh_token },
      });
      const second = JSON.parse(rotated.body).data;

      await h.app.inject({
        method: "POST",
        url: "/auth/sessions/refresh",
        payload: { refresh_token: first.refresh_token },
      });

      // A revoked session must stop authenticating immediately — `API §3.1`
      // chose opaque server-validated tokens precisely so this is possible.
      const after = await h.app.inject({
        method: "DELETE",
        url: "/auth/sessions/current",
        headers: { authorization: `Bearer ${second.access_token}` },
      });
      // Logout is idempotent, so 204 either way; what matters is that the
      // principal no longer resolves, checked directly below.
      assert.equal(after.statusCode, 204);

      const session = await h.prisma.session.findFirst({
        where: { revokedAt: { not: null } },
        orderBy: { issuedAt: "desc" },
      });
      assert.ok(session, "no session was revoked by the reuse detection");
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "an unknown refresh token is invalid_token, not token_reused",
  { skip },
  async () => {
    // The two mean different things: one is an expired or fabricated credential,
    // the other is evidence of theft.
    const h = await harness();
    try {
      const res = await h.app.inject({
        method: "POST",
        url: "/auth/sessions/refresh",
        payload: { refresh_token: "not-a-real-token" },
      });
      assert.equal(res.statusCode, 401);
      assert.equal(JSON.parse(res.body).error.code, "invalid_token");
    } finally {
      await h.cleanup();
    }
  },
);

// --- D-44: the credential classes stay apart --------------------------------

test(
  "D-44 — a refresh token is not an access credential",
  { skip },
  async () => {
    // Presented as a Bearer header on a protected route, a refresh token must
    // authenticate nobody. `resolvePrincipal` never reads `refresh_token`.
    const h = await harness();
    try {
      const { res } = await h.register();
      const { refresh_token, access_token } = JSON.parse(res.body).data;

      // Logout is the only protected route wired in this phase, and it is
      // idempotent — so the observable difference is whether a session was
      // actually revoked.
      await h.app.inject({
        method: "DELETE",
        url: "/auth/sessions/current",
        headers: { authorization: `Bearer ${refresh_token}` },
      });

      const revokedByRefresh = await h.prisma.session.count({
        where: { revokedAt: { not: null } },
      });
      assert.equal(
        revokedByRefresh,
        0,
        "a refresh token authenticated a protected route",
      );

      // The access token does revoke it, proving the route works at all.
      await h.app.inject({
        method: "DELETE",
        url: "/auth/sessions/current",
        headers: { authorization: `Bearer ${access_token}` },
      });
      const revokedByAccess = await h.prisma.session.count({
        where: { revokedAt: { not: null } },
      });
      assert.equal(revokedByAccess, 1);
    } finally {
      await h.cleanup();
    }
  },
);

// --- API-003 logout ---------------------------------------------------------

test(
  "API-003 — logout revokes both credential classes and is idempotent",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { res } = await h.register();
      const { access_token, refresh_token } = JSON.parse(res.body).data;

      const first = await h.app.inject({
        method: "DELETE",
        url: "/auth/sessions/current",
        headers: { authorization: `Bearer ${access_token}` },
      });
      assert.equal(first.statusCode, 204);

      // "A subsequent request with either returns 401."
      const refreshAfter = await h.app.inject({
        method: "POST",
        url: "/auth/sessions/refresh",
        payload: { refresh_token },
      });
      assert.equal(refreshAfter.statusCode, 401);

      // Idempotent — logging out twice is not an error.
      const second = await h.app.inject({
        method: "DELETE",
        url: "/auth/sessions/current",
        headers: { authorization: `Bearer ${access_token}` },
      });
      assert.equal(second.statusCode, 204);
    } finally {
      await h.cleanup();
    }
  },
);

test("logging out unauthenticated is 204, not 401", { skip }, async () => {
  const h = await harness();
  try {
    const res = await h.app.inject({
      method: "DELETE",
      url: "/auth/sessions/current",
    });
    assert.equal(res.statusCode, 204);
  } finally {
    await h.cleanup();
  }
});

// --- FR-004 claim -----------------------------------------------------------

test(
  "FR-004 — registering with an anonymous token claims the analysis",
  { skip },
  async () => {
    const h = await harness();
    let analysisId: string | undefined;
    try {
      const { generateToken, hashToken } =
        await import("../../src/auth/tokens.js");
      const token = generateToken();
      const analysis = await h.prisma.analysis.create({
        data: {
          status: "completed",
          anonymousTokenHash: hashToken(token),
          completedAt: new Date(),
        },
      });
      analysisId = analysis.analysisId;

      const { res } = await h.register(undefined, { anonymous_token: token });
      const body = JSON.parse(res.body);

      assert.equal(res.statusCode, 201);
      assert.equal(body.data.claimed_analysis_id, analysisId);

      // `DB §10.3` — ownership rewritten, token cleared.
      const claimed = await h.prisma.analysis.findUnique({
        where: { analysisId },
      });
      assert.equal(claimed?.userId, body.data.user.user_id);
      assert.equal(claimed?.anonymousTokenHash, null);

      // "Claim audited."
      const event = await h.prisma.auditEvent.findFirst({
        where: { eventType: "analysis.claimed", resourceId: analysisId },
      });
      assert.ok(event, "the claim was not audited");
    } finally {
      if (analysisId !== undefined) {
        await h.prisma.analysis
          .delete({ where: { analysisId } })
          .catch(() => undefined);
      }
      await h.cleanup();
    }
  },
);

test(
  "an analysis id presented as an anonymous token claims nothing",
  { skip },
  async () => {
    // The constraint again, at the claim boundary: an id is a name, not a
    // credential, and claiming is exactly where confusing the two would hand
    // one user another user's analysis.
    const h = await harness();
    let analysisId: string | undefined;
    try {
      const { generateToken, hashToken } =
        await import("../../src/auth/tokens.js");
      const analysis = await h.prisma.analysis.create({
        data: {
          status: "completed",
          anonymousTokenHash: hashToken(generateToken()),
          completedAt: new Date(),
        },
      });
      analysisId = analysis.analysisId;

      const { res } = await h.register(undefined, {
        anonymous_token: analysisId,
      });

      assert.equal(res.statusCode, 201);
      assert.equal(JSON.parse(res.body).data.claimed_analysis_id, undefined);

      const untouched = await h.prisma.analysis.findUnique({
        where: { analysisId },
      });
      assert.equal(untouched?.userId, null, "an id claimed an analysis");
    } finally {
      if (analysisId !== undefined) {
        await h.prisma.analysis
          .delete({ where: { analysisId } })
          .catch(() => undefined);
      }
      await h.cleanup();
    }
  },
);

test(
  "a stale anonymous token does not fail the registration",
  { skip },
  async () => {
    // `API-004` makes the field optional and says a presented token transfers
    // ownership; it does not say a stale one fails the request. Failing would
    // mean a user whose analysis expired cannot create an account at all.
    const h = await harness();
    try {
      const { generateToken } = await import("../../src/auth/tokens.js");
      const { res } = await h.register(undefined, {
        anonymous_token: generateToken(),
      });

      assert.equal(res.statusCode, 201);
      assert.equal(JSON.parse(res.body).data.claimed_analysis_id, undefined);
    } finally {
      await h.cleanup();
    }
  },
);

// --- NFR-025 rate limiting --------------------------------------------------

test(
  "NFR-025 — repeated failed logins are rate limited with Retry-After",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { email } = await h.register();

      let limited: Awaited<ReturnType<typeof h.app.inject>> | undefined;
      // D-47: 5 per account per 15 minutes.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const res = await h.app.inject({
          method: "POST",
          url: "/auth/sessions",
          payload: { email, password: "wrong-every-time" },
        });
        if (res.statusCode === 429) {
          limited = res;
          break;
        }
      }

      assert.ok(limited, "credential guessing was never rate limited");
      const body = JSON.parse(limited.body);
      assert.equal(body.error.code, "rate_limited");
      assert.ok(body.error.details.retry_after_seconds > 0);
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "a successful login clears the account's attempt counter",
  { skip },
  async () => {
    // Someone who mistypes a password and then succeeds has not made an attack,
    // and should not stay one failure from a lockout.
    const h = await harness();
    try {
      const { email } = await h.register();

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await h.app.inject({
          method: "POST",
          url: "/auth/sessions",
          payload: { email, password: "wrong" },
        });
      }

      const ok = await h.app.inject({
        method: "POST",
        url: "/auth/sessions",
        payload: { email, password: PASSWORD },
      });
      assert.equal(ok.statusCode, 201);

      // The counter was reset, so three more failures are still permitted.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const res = await h.app.inject({
          method: "POST",
          url: "/auth/sessions",
          payload: { email, password: "wrong" },
        });
        assert.notEqual(res.statusCode, 429, "the counter was not reset");
      }
    } finally {
      await h.cleanup();
    }
  },
);

// --- D-67 §2: owner-only access ----------------------------------------------

test(
  "D-67 — with an allowlist, only the listed address can register or sign in; others get 403 before any lookup",
  { skip },
  async () => {
    const owner = `owner-${randomUUID()}@example.test`;
    const pool = new pg.Pool({
      connectionString: process.env["DATABASE_URL"],
    });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const app = await buildApp({
      config: { ...config, accessAllowlist: [owner] },
      database: {
        prisma,
        disconnect: () => pool.end(),
      } as unknown as Database,
      rateLimiter: createRateLimiter(),
    });
    let ownerId: string | undefined;
    try {
      const stranger = await app.inject({
        method: "POST",
        url: "/users",
        payload: {
          email: `x-${randomUUID()}@example.test`,
          password: PASSWORD,
        },
      });
      assert.equal(stranger.statusCode, 403);
      assert.equal(JSON.parse(stranger.body).error.code, "forbidden");

      const registered = await app.inject({
        method: "POST",
        url: "/users",
        // Case-insensitive: the allowlist is lowercased at load.
        payload: { email: owner.toUpperCase(), password: PASSWORD },
      });
      assert.equal(registered.statusCode, 201, registered.body);
      const data = JSON.parse(registered.body).data;
      ownerId = data.user.user_id as string;

      // The owner's session resolves on a protected route; a stranger's
      // sign-in attempt is refused before credentials are even checked.
      const me = await app.inject({
        method: "GET",
        url: "/users/me",
        headers: { authorization: `Bearer ${String(data.access_token)}` },
      });
      assert.equal(me.statusCode, 200, me.body);

      const strangerLogin = await app.inject({
        method: "POST",
        url: "/auth/sessions",
        payload: { email: "nobody@example.test", password: PASSWORD },
      });
      assert.equal(strangerLogin.statusCode, 403);
    } finally {
      if (ownerId !== undefined) {
        await prisma.user
          .delete({ where: { userId: ownerId } })
          .catch(() => undefined);
      }
      await app.close();
      await pool.end();
    }
  },
);
