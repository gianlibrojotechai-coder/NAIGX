/**
 * Contract — `API-020` under the owner-only controls (D-67 §2, §3) and the
 * D-47 submission limit that D-67 finally wired.
 *
 * Fully faked database, as `analyses.test.ts`. What is pinned:
 *
 *   · anonymous submission refused with 401 when the policy says so, and
 *     nothing written or counted before the refusal
 *   · the per-account submission limit refuses the 11th in an hour
 *   · a spend-guard refusal is a 429 that names the window and when it
 *     resets, and writes no row
 *   · with the guard admitting, the row is written and the guard was asked
 *     exactly once per submission
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildApp } from "../../src/app.js";
import { createRateLimiter, RATE_LIMITS } from "../../src/auth/rate-limit.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import type {
  SpendDecision,
  SpendGuard,
} from "../../src/orchestrator/spend-guard.js";
import { CONTENT_MIN } from "../../src/routes/analyses.js";
import { hashToken } from "../../src/auth/tokens.js";

const ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "cccccccc-3333-4333-8333-cccccccccccc";
const SESSION_ID = "dddddddd-4444-4444-8444-dddddddddddd";
const ACCESS_TOKEN = "owner-access-token";
const NOW = new Date("2026-09-09T13:45:00.000Z");

const baseConfig: AppConfig = {
  databaseUrl: "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  spend: { reserveUsdPerAnalysis: "0.30" },
  port: 0,
  host: "127.0.0.1",
  trustProxy: false,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const guardReturning = (
  decision: SpendDecision,
): SpendGuard & { asked: number } => {
  const guard = {
    asked: 0,
    caps: { perDayUsd: "2.00" },
    admit() {
      guard.asked += 1;
      return Promise.resolve(decision);
    },
  };
  return guard;
};

const build = async (options: {
  config?: Partial<AppConfig>;
  spendGuard?: SpendGuard;
  rateLimiter?: ReturnType<typeof createRateLimiter>;
}) => {
  const created: unknown[] = [];
  const app = await buildApp({
    config: { ...baseConfig, ...options.config },
    database: {
      prisma: {
        healthCheck: { findFirst: () => Promise.resolve(null) },
        session: {
          findFirst: ({ where }: { where: { tokenHash: string } }) =>
            Promise.resolve(
              where.tokenHash === hashToken(ACCESS_TOKEN)
                ? {
                    sessionId: SESSION_ID,
                    userId: USER_ID,
                    user: { email: "owner@example.test" },
                  }
                : null,
            ),
        },
        analysis: {
          findFirst: () => Promise.resolve(null),
          create: (args: unknown) => {
            created.push(args);
            return Promise.resolve({
              analysisId: ANALYSIS_ID,
              status: "queued",
            });
          },
        },
      },
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    checkProvider: () => Promise.resolve(),
    checkTemplates: () => Promise.resolve(),
    hashContent: () => "deadbeef",
    now: () => NOW,
    ...(options.spendGuard !== undefined
      ? { spendGuard: options.spendGuard }
      : {}),
    ...(options.rateLimiter !== undefined
      ? { rateLimiter: options.rateLimiter }
      : {}),
  });
  return { app, created };
};

const content = "x".repeat(CONTENT_MIN);
const asOwner = { authorization: `Bearer ${ACCESS_TOKEN}` };

test("D-67 §2 — anonymous submission is refused with 401 when disabled, and nothing is written", async () => {
  const guard = guardReturning({ admitted: true, remainingUsd: "1.00" });
  const { app, created } = await build({
    config: { anonymousAnalysis: "disabled" },
    spendGuard: guard,
  });

  const anonymous = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: { content },
  });
  assert.equal(anonymous.statusCode, 401);
  const error = JSON.parse(anonymous.body).error;
  assert.equal(error.code, "unauthenticated");
  assert.match(error.action, /sign in/i);
  assert.equal(created.length, 0);
  assert.equal(guard.asked, 0, "refused before any cost check");

  const owner = await app.inject({
    method: "POST",
    url: "/analyses",
    headers: asOwner,
    payload: { content },
  });
  assert.equal(owner.statusCode, 202);
  assert.equal(created.length, 1);
  assert.equal(guard.asked, 1);
  // An owned analysis carries no anonymous credential.
  assert.equal(JSON.parse(owner.body).data.anonymous_token, undefined);
});

test("D-67 §2 — with the FR-004 default, an anonymous submission still works", async () => {
  const { app, created } = await build({});
  const response = await app.inject({
    method: "POST",
    url: "/analyses",
    payload: { content },
  });
  assert.equal(response.statusCode, 202);
  assert.equal(typeof JSON.parse(response.body).data.anonymous_token, "string");
  assert.equal(created.length, 1);
});

test("D-47 — the per-account submission limit is enforced at last", async () => {
  const { app, created } = await build({ rateLimiter: createRateLimiter() });
  const limit = RATE_LIMITS.analysisCreateUser.limit;
  for (let i = 0; i < limit; i++) {
    const ok = await app.inject({
      method: "POST",
      url: "/analyses",
      headers: asOwner,
      payload: { content },
    });
    assert.equal(ok.statusCode, 202, `submission ${String(i + 1)}`);
  }
  const refused = await app.inject({
    method: "POST",
    url: "/analyses",
    headers: asOwner,
    payload: { content },
  });
  assert.equal(refused.statusCode, 429);
  const error = JSON.parse(refused.body).error;
  assert.equal(error.code, "rate_limited");
  assert.ok(error.details.retry_after_seconds > 0);
  assert.equal(created.length, limit);
});

test("D-67 §3 — a spend-cap refusal is a 429 naming the window, and writes no row", async () => {
  const guard = guardReturning({
    admitted: false,
    reason: "cap_reached",
    window: "day",
    capUsd: "2.00",
    spentUsd: "1.8000",
    reserveUsd: "0.30",
    resetsAt: new Date("2026-09-10T00:00:00.000Z"),
  });
  const { app, created } = await build({ spendGuard: guard });

  const response = await app.inject({
    method: "POST",
    url: "/analyses",
    headers: asOwner,
    payload: { content },
  });
  assert.equal(response.statusCode, 429);
  const error = JSON.parse(response.body).error;
  assert.equal(error.code, "rate_limited");
  assert.match(error.message, /daily provider spend cap/);
  assert.equal(error.details.spend_window, "day");
  assert.equal(error.details.spend_cap_usd, "2.00");
  // 13:45 → 00:00 next day.
  assert.equal(error.details.retry_after_seconds, 36_900);
  // What others spent is never exposed on the wire.
  assert.equal(JSON.stringify(error).includes("1.8000"), false);
  assert.equal(created.length, 0);
});

test("D-67 §3 — an unverifiable ledger refuses too, with a different message", async () => {
  const guard = guardReturning({
    admitted: false,
    reason: "spend_unknown",
    window: "day",
    capUsd: "2.00",
    reserveUsd: "0.30",
    resetsAt: new Date("2026-09-10T00:00:00.000Z"),
  });
  const { app, created } = await build({ spendGuard: guard });
  const response = await app.inject({
    method: "POST",
    url: "/analyses",
    headers: asOwner,
    payload: { content },
  });
  assert.equal(response.statusCode, 429);
  assert.match(JSON.parse(response.body).error.message, /cannot be verified/);
  assert.equal(created.length, 0);
});
