/**
 * Integration — `API-050` and `API-070` against **real Postgres** (`M-16`).
 *
 * Two things are being protected here.
 *
 * **That `/internal/*` is not reachable by an ordinary account.** The unit
 * suite pins `resolveOperator`; this pins the route, because a correct
 * resolver wired to the wrong guard is the failure that actually ships. A
 * valid user token, a valid anonymous token, no credential and a wrong one
 * are all exercised against the live endpoint.
 *
 * **That three metrics stay uncomputed.** `PRD §3.2` defines M-6, M-8 and M-9
 * as manual review. A later change "completing" the metric set by emitting
 * them would produce numbers that look measured and are not — the exact
 * misreading `PRD §3.1` warns about. They must appear as comments, never as
 * series, because a series with no value scrapes as `0`.
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
import { generateToken, hashToken } from "../../src/auth/tokens.js";
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
    "Database-backed instrumentation tests are mandatory here " +
      `(CI=${String(process.env["CI"])}, REQUIRE_DB_TESTS=${String(process.env["REQUIRE_DB_TESTS"])}) ` +
      "but DATABASE_URL is unreachable.",
  );
}

const skip = DATABASE_AVAILABLE
  ? false
  : "requires DATABASE_URL to be reachable (set REQUIRE_DB_TESTS=1 to make this an error)";

const OPERATOR_SECRET = "test-operator-secret-value";
const PASSWORD = "a-sufficiently-long-passphrase";
const SEEDED_INPUT =
  "A stored job description mentioning orchestration, retries and idempotent delivery across queues.";

const config: AppConfig = {
  databaseUrl: process.env["DATABASE_URL"] ?? "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  port: 0,
  host: "127.0.0.1",
  trustProxy: false,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
  operatorToken: OPERATOR_SECRET,
};

const harness = async () => {
  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const app = await buildApp({
    config,
    database: { prisma, disconnect: () => pool.end() } as unknown as Database,
    rateLimiter: createRateLimiter(),
  });

  const users: string[] = [];
  const analyses: string[] = [];

  return {
    app,
    prisma,
    async register() {
      const res = await app.inject({
        method: "POST",
        url: "/users",
        payload: {
          email: `test-${randomUUID()}@example.test`,
          password: PASSWORD,
        },
      });
      const body = JSON.parse(res.body).data;
      users.push(body.user.user_id);
      return {
        userId: body.user.user_id as string,
        auth: { authorization: `Bearer ${body.access_token}` },
      };
    },
    async seedAnalysis(userId: string | null) {
      const token = generateToken();
      const analysis = await prisma.analysis.create({
        data: {
          ...(userId !== null
            ? { userId }
            : { anonymousTokenHash: hashToken(token) }),
          status: "completed",
          completedAt: new Date(),
          derivedTitle: "Seeded",
          input: {
            create: {
              rawContent: SEEDED_INPUT,
              contentHash: randomUUID(),
              characterCount: SEEDED_INPUT.length,
              sourceType: "paste",
            },
          },
        },
      });
      analyses.push(analysis.analysisId);
      return { analysisId: analysis.analysisId, token };
    },
    async cleanup() {
      for (const analysisId of analyses) {
        await prisma.analysis
          .delete({ where: { analysisId } })
          .catch(() => undefined);
      }
      for (const userId of users) {
        await prisma.user.delete({ where: { userId } }).catch(() => undefined);
      }
      await app.close();
      await pool.end();
    },
  };
};

// --- D-48: /internal/* is operator-only -------------------------------------

test("API-070 — the operator credential is accepted", { skip }, async () => {
  const h = await harness();
  try {
    const res = await h.app.inject({
      method: "GET",
      url: "/internal/metrics",
      headers: { authorization: `Bearer ${OPERATOR_SECRET}` },
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"] as string, /text\/plain/);
    assert.match(res.body, /naigx_analysis_completion_rate/);
  } finally {
    await h.cleanup();
  }
});

test("D-48 — a valid USER access token is refused", { skip }, async () => {
  // The failure that would matter most: an ordinary account reaching the
  // operational surface. The token below authenticates perfectly well on
  // `/users/me` and must do nothing here.
  const h = await harness();
  try {
    const { auth } = await h.register();

    const asUser = await h.app.inject({
      method: "GET",
      url: "/users/me",
      headers: auth,
    });
    assert.equal(asUser.statusCode, 200, "the token is genuinely valid");

    const res = await h.app.inject({
      method: "GET",
      url: "/internal/metrics",
      headers: auth,
    });
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error.code, "operator_only");
  } finally {
    await h.cleanup();
  }
});

test("D-48 — a valid ANONYMOUS token is refused", { skip }, async () => {
  const h = await harness();
  try {
    const { analysisId, token } = await h.seedAnalysis(null);

    const asAnonymous = await h.app.inject({
      method: "GET",
      url: `/analyses/${analysisId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(asAnonymous.statusCode, 200, "the token is genuinely valid");

    const res = await h.app.inject({
      method: "GET",
      url: "/internal/metrics",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await h.cleanup();
  }
});

test("D-48 — a missing or wrong credential is refused", { skip }, async () => {
  const h = await harness();
  try {
    for (const headers of [
      undefined,
      { authorization: "Bearer wrong-secret" },
      { authorization: `Basic ${OPERATOR_SECRET}` },
    ]) {
      const res = await h.app.inject({
        method: "GET",
        url: "/internal/metrics",
        ...(headers !== undefined ? { headers } : {}),
      });
      assert.equal(res.statusCode, 403, JSON.stringify(headers));
    }
  } finally {
    await h.cleanup();
  }
});

test("D-48 — the refusal never contains the secret", { skip }, async () => {
  const h = await harness();
  try {
    const res = await h.app.inject({
      method: "GET",
      url: "/internal/metrics",
      headers: { authorization: "Bearer wrong-secret" },
    });
    assert.equal(res.body.includes(OPERATOR_SECRET), false);
  } finally {
    await h.cleanup();
  }
});

// --- the three metrics that must stay uncomputed -----------------------------

test(
  "PRD §3.2 — M-6, M-8 and M-9 are never emitted as series",
  { skip },
  async () => {
    // A series with no value scrapes as 0 and is indistinguishable from a
    // measured zero. These are review protocols, and reporting them as
    // metrics would be the misreading `PRD §3.1` warns about.
    const h = await harness();
    try {
      const res = await h.app.inject({
        method: "GET",
        url: "/internal/metrics",
        headers: { authorization: `Bearer ${OPERATOR_SECRET}` },
      });

      const series = res.body
        .split("\n")
        .filter((line) => !line.startsWith("#") && line.trim() !== "");

      for (const name of [
        "classification_accuracy",
        "recommendation_explicability",
        "platform_recommendation_defensibility",
      ]) {
        assert.equal(
          series.some((line) => line.includes(name)),
          false,
          `${name} was emitted as a series`,
        );
      }

      // Present as commentary, so the absence is legible rather than silent.
      assert.match(res.body, /M-6 classification_accuracy/);
      assert.match(res.body, /M-8 recommendation_explicability/);
      assert.match(res.body, /M-9 platform_recommendation_defensibility/);
      assert.match(res.body, /manual review|NOT instrumented/);
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "API-070 — the seven automatable metrics are present",
  { skip },
  async () => {
    const h = await harness();
    try {
      const res = await h.app.inject({
        method: "GET",
        url: "/internal/metrics",
        headers: { authorization: `Bearer ${OPERATOR_SECRET}` },
      });

      for (const name of [
        "naigx_analysis_completion_rate", // M-1
        "naigx_time_to_first_artifact_p50", // M-2
        "naigx_full_analysis_latency_p50", // M-3
        "naigx_export_rate", // M-4
        "naigx_return_rate", // M-5
        "naigx_low_quality_flag_rate", // M-7
        "naigx_schema_validity_rate", // M-10
      ]) {
        assert.match(res.body, new RegExp(`^${name} `, "m"), name);
      }
    } finally {
      await h.cleanup();
    }
  },
);

test("metrics carry no user business content", { skip }, async () => {
  // `API §11.1` forbids exposing internal metrics publicly; the shape here
  // additionally has no field an input or artifact could occupy.
  const h = await harness();
  try {
    const { userId } = await h.register();
    await h.seedAnalysis(userId);

    const res = await h.app.inject({
      method: "GET",
      url: "/internal/metrics",
      headers: { authorization: `Bearer ${OPERATOR_SECRET}` },
    });

    assert.equal(res.body.includes("orchestration"), false);
    assert.equal(res.body.includes("Seeded"), false);
    assert.equal(res.body.includes("@example.test"), false);
  } finally {
    await h.cleanup();
  }
});

test("an operator read is audited", { skip }, async () => {
  const h = await harness();
  try {
    await h.app.inject({
      method: "GET",
      url: "/internal/metrics",
      headers: { authorization: `Bearer ${OPERATOR_SECRET}` },
    });

    const event = await h.prisma.auditEvent.findFirst({
      where: { eventType: "internal.metrics_read" },
      orderBy: { occurredAt: "desc" },
    });
    assert.ok(event, "the operator read was not audited");
    // D-48 issues one shared credential, so there is no identity to record.
    assert.equal(event.userId, null);
  } finally {
    await h.cleanup();
  }
});

// --- API-050 feedback --------------------------------------------------------

test("API-050 — feedback is stored and replaceable", { skip }, async () => {
  // `PUT` because feedback is replaceable — `DP-3`'s one permitted exception,
  // because it is user-authored rather than system-generated.
  const h = await harness();
  try {
    const { userId, auth } = await h.register();
    const { analysisId } = await h.seedAnalysis(userId);

    const first = await h.app.inject({
      method: "PUT",
      url: `/analyses/${analysisId}/feedback`,
      payload: { helpful: false, detail: "The verdict missed a constraint." },
      headers: auth,
    });
    assert.equal(first.statusCode, 200);
    assert.equal(JSON.parse(first.body).data.helpful, false);

    // Revised, not duplicated.
    const second = await h.app.inject({
      method: "PUT",
      url: `/analyses/${analysisId}/feedback`,
      payload: { helpful: true },
      headers: auth,
    });
    assert.equal(second.statusCode, 200);
    assert.equal(JSON.parse(second.body).data.helpful, true);
    assert.equal(JSON.parse(second.body).data.detail, null);

    assert.equal(
      await h.prisma.feedback.count({ where: { analysisId } }),
      1,
      "PUT created a second row instead of replacing",
    );
  } finally {
    await h.cleanup();
  }
});

test(
  "API-050 — feedback requires authentication and ownership",
  { skip },
  async () => {
    const h = await harness();
    try {
      const owner = await h.register();
      const stranger = await h.register();
      const { analysisId } = await h.seedAnalysis(owner.userId);

      const anonymous = await h.app.inject({
        method: "PUT",
        url: `/analyses/${analysisId}/feedback`,
        payload: { helpful: true },
      });
      assert.equal(anonymous.statusCode, 401);

      // 404 rather than 403 — a 403 confirms the analysis exists.
      const other = await h.app.inject({
        method: "PUT",
        url: `/analyses/${analysisId}/feedback`,
        payload: { helpful: true },
        headers: stranger.auth,
      });
      assert.equal(other.statusCode, 404);
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "API-050 — a missing helpful flag is refused with an action",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { userId, auth } = await h.register();
      const { analysisId } = await h.seedAnalysis(userId);

      const res = await h.app.inject({
        method: "PUT",
        url: `/analyses/${analysisId}/feedback`,
        payload: { detail: "no flag" },
        headers: auth,
      });
      assert.equal(res.statusCode, 400);
      // `FR-101` — never required to proceed, and the message says so.
      assert.match(JSON.parse(res.body).error.action, /never required/i);
    } finally {
      await h.cleanup();
    }
  },
);

test("M-7 — feedback moves the low-quality flag rate", { skip }, async () => {
  const h = await harness();
  try {
    const { userId, auth } = await h.register();
    const a = await h.seedAnalysis(userId);
    const b = await h.seedAnalysis(userId);

    await h.app.inject({
      method: "PUT",
      url: `/analyses/${a.analysisId}/feedback`,
      payload: { helpful: false },
      headers: auth,
    });
    await h.app.inject({
      method: "PUT",
      url: `/analyses/${b.analysisId}/feedback`,
      payload: { helpful: true },
      headers: auth,
    });

    const res = await h.app.inject({
      method: "GET",
      url: "/internal/metrics",
      headers: { authorization: `Bearer ${OPERATOR_SECRET}` },
    });

    const total = /^naigx_feedback_total (\d+)/m.exec(res.body);
    assert.ok(total);
    assert.ok(Number(total[1]) >= 2, "feedback did not reach the metric");
  } finally {
    await h.cleanup();
  }
});
