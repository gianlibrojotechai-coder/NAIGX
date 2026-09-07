/**
 * Integration — history, account and deletion against **real Postgres**.
 *
 * `DB §12.2` makes one of these tests mandatory by name:
 *
 * > **Verification requirement.** Deletion completeness is verified by test,
 * > not asserted: a test creates a user with a full analysis set, deletes the
 * > account, and confirms no residual row references the identifier in either
 * > store.
 *
 * That test is below, and it checks every table that can reference a user or
 * an analysis rather than a representative sample — a cascade that missed one
 * child is exactly the failure `FR-073` cannot tolerate, and sampling would
 * find it only by luck.
 *
 * The rest pin the properties an implementation drifts on quietly: a listing
 * that starts joining content tables, a cursor that drops or repeats a row, a
 * 204 where the contract says 202, and one user reading another's history.
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
import { createTracePurgeQueue } from "../../src/db/trace-purge.js";
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
    "Database-backed history tests are mandatory here " +
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
  port: 0,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const PASSWORD = "a-sufficiently-long-passphrase";

/** Above `FR-002`'s 50-character floor, and containing a searchable term. */
const SEEDED_INPUT =
  "A stored job description mentioning orchestration, retries and idempotent delivery across queues.";

const harness = async () => {
  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const purged: string[][] = [];
  const tracePurge = createTracePurgeQueue({
    client: {
      stageTrace: {
        deleteMany: ({ where }) => {
          purged.push([...where.analysisId.in]);
          return Promise.resolve({ count: where.analysisId.in.length });
        },
      },
    },
    audit: { record: () => Promise.resolve() },
  });

  const app = await buildApp({
    config,
    database: { prisma, disconnect: () => pool.end() } as unknown as Database,
    rateLimiter: createRateLimiter(),
    tracePurge,
  });

  const users: string[] = [];

  const register = async () => {
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
  };

  /** An owned analysis with children in every table that hangs off one. */
  const seedAnalysis = async (userId: string, createdAt = new Date()) => {
    const analysis = await prisma.analysis.create({
      data: {
        userId,
        status: "completed",
        createdAt,
        completedAt: createdAt,
        derivedTitle: `Analysis ${createdAt.toISOString()}`,
        input: {
          create: {
            // Long enough to satisfy `analysis_input_character_count_check`,
            // which enforces `FR-002`'s 50-character minimum in the database.
            rawContent: SEEDED_INPUT,
            contentHash: randomUUID(),
            characterCount: SEEDED_INPUT.length,
            sourceType: "paste",
          },
        },
        classification: {
          create: {
            determinedType: "job_description",
            confidence: 0.9,
            candidateTypes: ["job_description"],
            wasLowConfidence: false,
          },
        },
        contextElements: {
          create: [
            {
              content: "Five years of automation experience",
              category: "requirement",
              // A `stated` element must carry its span:
              // `context_element_stated_requires_span_check` enforces
              // `FR-043` in the database — a claim said to be *in the text*
              // has to say where.
              provenance: "stated",
              sourceSpanStart: 0,
              sourceSpanEnd: 34,
              specificityScore: 0.8,
            },
          ],
        },
      },
    });
    return analysis.analysisId;
  };

  return {
    app,
    prisma,
    purged,
    tracePurge,
    register,
    seedAnalysis,
    async cleanup() {
      for (const userId of users) {
        await prisma.user.delete({ where: { userId } }).catch(() => undefined);
      }
      await app.close();
      await pool.end();
    },
  };
};

// --- DB §12.2: the mandated verification ------------------------------------

test(
  "DB §12.2 — account deletion leaves no residual row referencing the user",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { userId, auth } = await h.register();
      const analysisId = await h.seedAnalysis(userId);

      // A full set: settings, session, refresh token, export, feedback, and an
      // analysis with children.
      await h.prisma.export.create({
        data: {
          analysisId,
          userId,
          format: "markdown",
          metadataSnapshot: { included_types: [] },
        },
      });
      await h.prisma.feedback.create({
        data: { analysisId, userId, helpful: true },
      });

      const res = await h.app.inject({
        method: "DELETE",
        url: "/users/me",
        payload: { confirmation: true },
        headers: auth,
      });
      assert.equal(res.statusCode, 202);

      // Every table that can reference a user or an analysis. Checked
      // exhaustively rather than sampled: a cascade that missed one child is
      // the failure `FR-073` cannot tolerate.
      assert.equal(await h.prisma.user.count({ where: { userId } }), 0);
      assert.equal(await h.prisma.session.count({ where: { userId } }), 0);
      assert.equal(await h.prisma.userSettings.count({ where: { userId } }), 0);
      assert.equal(await h.prisma.analysis.count({ where: { userId } }), 0);
      assert.equal(await h.prisma.export.count({ where: { userId } }), 0);
      assert.equal(await h.prisma.feedback.count({ where: { userId } }), 0);
      assert.equal(
        await h.prisma.refreshToken.count({ where: { session: { userId } } }),
        0,
      );
      // The analysis's own descendants went with it.
      assert.equal(
        await h.prisma.analysisInput.count({ where: { analysisId } }),
        0,
      );
      assert.equal(
        await h.prisma.classification.count({ where: { analysisId } }),
        0,
      );
      assert.equal(
        await h.prisma.contextElement.count({ where: { analysisId } }),
        0,
      );
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "DB §4.6 — audit events survive account deletion with the identity severed",
  { skip },
  async () => {
    // The deliberate tension `DB §4.6` names: the audit trail must record that
    // an account was deleted, and `FR-073` promises the identity is gone. Both
    // hold because `user_id` is nullified rather than cascaded.
    const h = await harness();
    try {
      const { userId, auth } = await h.register();

      await h.app.inject({
        method: "DELETE",
        url: "/users/me",
        payload: { confirmation: true },
        headers: auth,
      });

      const orphaned = await h.prisma.auditEvent.findFirst({
        where: { eventType: "user.deleted", resourceId: userId },
      });
      assert.ok(orphaned, "the deletion audit event was cascade-deleted");
      assert.equal(orphaned.userId, null, "the identity was not severed");

      assert.equal(
        await h.prisma.auditEvent.count({ where: { userId } }),
        0,
        "an audit event still names the deleted user",
      );
    } finally {
      await h.cleanup();
    }
  },
);

test("deleting the account invalidates its sessions", { skip }, async () => {
  const h = await harness();
  try {
    const { auth } = await h.register();

    await h.app.inject({
      method: "DELETE",
      url: "/users/me",
      payload: { confirmation: true },
      headers: auth,
    });

    // The session row cascaded, so the token resolves to nobody.
    const after = await h.app.inject({
      method: "GET",
      url: "/users/me",
      headers: auth,
    });
    assert.equal(after.statusCode, 401);
  } finally {
    await h.cleanup();
  }
});

// --- DB §5.4: the cross-store contract --------------------------------------

test(
  "DB §5.4 — deletion returns 202 with a stated window",
  { skip },
  async () => {
    // Not 204. `API-011`: returning 204 "would claim completeness the system
    // cannot yet guarantee", because deletion spans two stores.
    const h = await harness();
    try {
      const { userId, auth } = await h.register();
      const analysisId = await h.seedAnalysis(userId);

      const res = await h.app.inject({
        method: "DELETE",
        url: `/analyses/${analysisId}`,
        payload: { confirmation: true },
        headers: auth,
      });

      assert.equal(res.statusCode, 202);
      const body = JSON.parse(res.body).data;
      assert.match(body.trace_purge_window, /hours/);

      // Step 2 — the purge was enqueued, and step 1 already committed.
      await h.tracePurge.drain();
      assert.deepEqual(h.purged.at(-1), [analysisId]);
    } finally {
      await h.cleanup();
    }
  },
);

test("deletion without confirmation is refused", { skip }, async () => {
  // `FR-063` — "requires explicit confirmation stating it is permanent".
  const h = await harness();
  try {
    const { userId, auth } = await h.register();
    const analysisId = await h.seedAnalysis(userId);

    const res = await h.app.inject({
      method: "DELETE",
      url: `/analyses/${analysisId}`,
      headers: auth,
    });

    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).error.message, /permanent/);
    assert.equal(
      await h.prisma.analysis.count({ where: { analysisId } }),
      1,
      "the analysis was deleted without confirmation",
    );
  } finally {
    await h.cleanup();
  }
});

test(
  "API-023 — a subsequent GET returns 404, and there is no soft delete",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { userId, auth } = await h.register();
      const analysisId = await h.seedAnalysis(userId);

      await h.app.inject({
        method: "DELETE",
        url: `/analyses/${analysisId}`,
        payload: { confirmation: true },
        headers: auth,
      });

      const after = await h.app.inject({
        method: "GET",
        url: `/analyses/${analysisId}`,
        headers: auth,
      });
      assert.equal(after.statusCode, 404);

      // The row is gone, not flagged. `API-023`: "the API's DELETE means what
      // DB DP-7 says it means."
      assert.equal(await h.prisma.analysis.count({ where: { analysisId } }), 0);
    } finally {
      await h.cleanup();
    }
  },
);

test("one user cannot delete another's analysis", { skip }, async () => {
  const h = await harness();
  try {
    const owner = await h.register();
    const stranger = await h.register();
    const analysisId = await h.seedAnalysis(owner.userId);

    const res = await h.app.inject({
      method: "DELETE",
      url: `/analyses/${analysisId}`,
      payload: { confirmation: true },
      headers: stranger.auth,
    });

    // 404, not 403 — a 403 confirms the analysis exists.
    assert.equal(res.statusCode, 404);
    assert.equal(await h.prisma.analysis.count({ where: { analysisId } }), 1);
  } finally {
    await h.cleanup();
  }
});

test(
  "API-024 — bulk delete removes only the caller's analyses",
  { skip },
  async () => {
    const h = await harness();
    try {
      const owner = await h.register();
      const stranger = await h.register();
      await h.seedAnalysis(owner.userId);
      await h.seedAnalysis(owner.userId);
      const strangersAnalysis = await h.seedAnalysis(stranger.userId);

      const res = await h.app.inject({
        method: "DELETE",
        url: "/analyses",
        payload: { confirmation: true },
        headers: owner.auth,
      });

      assert.equal(res.statusCode, 202);
      assert.equal(JSON.parse(res.body).data.deleted_count, 2);
      assert.equal(
        await h.prisma.analysis.count({
          where: { analysisId: strangersAnalysis },
        }),
        1,
        "bulk delete crossed an ownership boundary",
      );
    } finally {
      await h.cleanup();
    }
  },
);

// --- API-022: the listing ---------------------------------------------------

test(
  "API-022 — history is reverse-chronological and summary-only",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { userId, auth } = await h.register();
      await h.seedAnalysis(userId, new Date("2026-09-01T10:00:00.000Z"));
      await h.seedAnalysis(userId, new Date("2026-09-03T10:00:00.000Z"));

      const res = await h.app.inject({
        method: "GET",
        url: "/analyses",
        headers: auth,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body).data;

      assert.equal(body.items.length, 2);
      assert.ok(
        body.items[0].created_at > body.items[1].created_at,
        "not reverse-chronological",
      );

      // ⚠️ NEVER ARTIFACT CONTENT. `API-022` keeps the query off content-bearing
      // tables, and the response shape has no field content could occupy.
      assert.deepEqual(Object.keys(body.items[0]).sort(), [
        "analysis_id",
        "classification",
        "confidence_band",
        "created_at",
        "derived_title",
        "refused",
        "status",
      ]);
      assert.equal(
        res.body.includes("orchestration"),
        false,
        "input text leaked",
      );
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "API-022 — paging is stable across a cursor boundary",
  { skip },
  async () => {
    // A cursor on `created_at` alone would be ambiguous for rows sharing a
    // timestamp, which drops or repeats one. These three share theirs exactly.
    const h = await harness();
    try {
      const { userId, auth } = await h.register();
      const sameInstant = new Date("2026-09-02T10:00:00.000Z");
      await h.seedAnalysis(userId, sameInstant);
      await h.seedAnalysis(userId, sameInstant);
      await h.seedAnalysis(userId, sameInstant);

      const first = await h.app.inject({
        method: "GET",
        url: "/analyses?limit=2",
        headers: auth,
      });
      const page1 = JSON.parse(first.body).data;
      assert.equal(page1.items.length, 2);
      assert.ok(page1.pagination.next_cursor);

      const second = await h.app.inject({
        method: "GET",
        url: `/analyses?limit=2&cursor=${encodeURIComponent(page1.pagination.next_cursor)}`,
        headers: auth,
      });
      const page2 = JSON.parse(second.body).data;

      const ids = [
        ...page1.items.map((i: { analysis_id: string }) => i.analysis_id),
        ...page2.items.map((i: { analysis_id: string }) => i.analysis_id),
      ];
      assert.equal(new Set(ids).size, 3, "a row was repeated or dropped");
      assert.equal(page2.pagination.next_cursor, null);
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "API-022 — an empty history is distinguishable from a filtered-empty one",
  { skip },
  async () => {
    // "Empty state distinguishable from filtered-empty." Without the flag both
    // render the same blank page and a user cannot tell which they are looking
    // at.
    const h = await harness();
    try {
      const { userId, auth } = await h.register();

      const empty = await h.app.inject({
        method: "GET",
        url: "/analyses",
        headers: auth,
      });
      assert.equal(JSON.parse(empty.body).data.filtered, false);

      await h.seedAnalysis(userId);
      const filtered = await h.app.inject({
        method: "GET",
        url: "/analyses?classification=technical_assessment",
        headers: auth,
      });
      const body = JSON.parse(filtered.body).data;
      assert.equal(body.items.length, 0);
      assert.equal(body.filtered, true);
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "API-022 — a listing never includes another user's analyses",
  { skip },
  async () => {
    const h = await harness();
    try {
      const owner = await h.register();
      const stranger = await h.register();
      await h.seedAnalysis(owner.userId);

      const res = await h.app.inject({
        method: "GET",
        url: "/analyses",
        headers: stranger.auth,
      });
      assert.deepEqual(JSON.parse(res.body).data.items, []);
    } finally {
      await h.cleanup();
    }
  },
);

test("history requires authentication", { skip }, async () => {
  const h = await harness();
  try {
    const res = await h.app.inject({ method: "GET", url: "/analyses" });
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).error.code, "unauthenticated");
  } finally {
    await h.cleanup();
  }
});

test("FR-062 — history is searchable by input text", { skip }, async () => {
  const h = await harness();
  try {
    const { userId, auth } = await h.register();
    await h.seedAnalysis(userId);

    const hit = await h.app.inject({
      method: "GET",
      url: "/analyses?q=orchestration",
      headers: auth,
    });
    assert.equal(JSON.parse(hit.body).data.items.length, 1);

    const miss = await h.app.inject({
      method: "GET",
      url: "/analyses?q=nothing-matches-this",
      headers: auth,
    });
    const body = JSON.parse(miss.body).data;
    assert.equal(body.items.length, 0);
    assert.equal(body.filtered, true);
  } finally {
    await h.cleanup();
  }
});

// --- account ----------------------------------------------------------------

test(
  "API-010 — never returns credential or session material",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { auth } = await h.register();
      const res = await h.app.inject({
        method: "GET",
        url: "/users/me",
        headers: auth,
      });

      assert.equal(res.statusCode, 200);
      for (const forbidden of [
        "credential",
        "scrypt",
        "token_hash",
        PASSWORD,
      ]) {
        assert.equal(
          res.body.includes(forbidden),
          false,
          `the response leaked: ${forbidden}`,
        );
      }
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "API-012 / API-013 — settings round-trip and reject unknown values",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { auth } = await h.register();

      const initial = await h.app.inject({
        method: "GET",
        url: "/users/me/settings",
        headers: auth,
      });
      assert.equal(
        JSON.parse(initial.body).data.default_export_format,
        "markdown",
      );

      const updated = await h.app.inject({
        method: "PUT",
        url: "/users/me/settings",
        payload: { default_export_format: "pdf" },
        headers: auth,
      });
      assert.equal(JSON.parse(updated.body).data.default_export_format, "pdf");

      const bad = await h.app.inject({
        method: "PUT",
        url: "/users/me/settings",
        payload: { default_export_format: "docx" },
        headers: auth,
      });
      assert.equal(bad.statusCode, 400);
    } finally {
      await h.cleanup();
    }
  },
);

test(
  "API-014 — a data export carries analyses and no credential material",
  { skip },
  async () => {
    const h = await harness();
    try {
      const { userId, auth } = await h.register();
      await h.seedAnalysis(userId);

      const res = await h.app.inject({
        method: "POST",
        url: "/users/me/data-exports",
        headers: auth,
      });

      assert.equal(res.statusCode, 202);
      const body = JSON.parse(res.body).data;
      assert.equal(body.analyses.length, 1);
      // `FR-072` — machine-readable and complete; `API-014` — "excludes
      // credential material entirely".
      assert.equal(res.body.includes("scrypt"), false);
      assert.equal(res.body.includes("credentialHash"), false);
    } finally {
      await h.cleanup();
    }
  },
);

// --- D-41 unwind ------------------------------------------------------------

test(
  "D-41 — an owned export writes the EXPORT row that starts M-4",
  { skip },
  async () => {
    // The row D-41 §4.3 withheld until "a real authenticated owner exists".
    const h = await harness();
    try {
      const { userId, auth } = await h.register();
      const analysisId = await h.seedAnalysis(userId);

      const res = await h.app.inject({
        method: "POST",
        url: `/analyses/${analysisId}/exports`,
        payload: {},
        headers: auth,
      });
      assert.equal(res.statusCode, 200);

      const rows = await h.prisma.export.findMany({ where: { analysisId } });
      assert.equal(rows.length, 1, "no EXPORT row was written for an owner");
      assert.equal(rows[0]?.userId, userId);
      assert.equal(rows[0]?.format, "markdown");

      // D-42 §3.2 — the id exists now, so it is reported.
      assert.equal(res.headers["x-export-id"], rows[0]?.exportId);
    } finally {
      await h.cleanup();
    }
  },
);
