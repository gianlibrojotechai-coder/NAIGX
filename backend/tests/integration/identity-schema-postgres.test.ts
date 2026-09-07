/**
 * Integration — the M-15 schema against **real Postgres**.
 *
 * The unit suites prove the sweep builds the right query and the resolver
 * applies the right predicates. They cannot prove Postgres accepts the tables,
 * that the constraints hold, or — the one that matters most — that the
 * **evidence exemption actually protects the 22 legacy rows**.
 *
 * ⚠️ THE EXEMPTION TEST RUNS AGAINST THE LIVE ROWS. It asserts the boundary
 * selects exactly the pre-existing analyses and no others, without deleting
 * anything: the sweep is exercised by counting what it *would* match, because
 * a test that verified the exemption by running a destructive sweep on real
 * evidence would be the accident it exists to prevent.
 *
 * REQUIRES THE PRIMARY DATABASE. Unreachable means skip locally and fail in
 * CI, matching the other Postgres-backed suites.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  ANONYMOUS_EXPIRY_BOUNDARY,
  anonymousExpiryCutoff,
} from "../../src/db/anonymous-expiry.js";
import {
  generateToken,
  hashPassword,
  hashToken,
} from "../../src/auth/tokens.js";

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
    "Database-backed identity tests are mandatory here " +
      `(CI=${String(process.env["CI"])}, REQUIRE_DB_TESTS=${String(process.env["REQUIRE_DB_TESTS"])}) ` +
      "but DATABASE_URL is unreachable. Provision the primary store.",
  );
}

const skip = DATABASE_AVAILABLE
  ? false
  : "requires DATABASE_URL to be reachable (set REQUIRE_DB_TESTS=1 to make this an error)";

const clients = () => {
  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
    close: () => pool.end(),
  };
};

const newUser = async (prisma: PrismaClient) =>
  prisma.user.create({
    data: {
      email: `test-${randomUUID()}@example.test`,
      credentialHash: await hashPassword("a test password"),
      settings: { create: { defaultExportFormat: "markdown" } },
    },
  });

// --- D-45: the evidence exemption -------------------------------------------

test(
  "D-45 — the boundary selects exactly the pre-existing legacy rows",
  { skip },
  async () => {
    const { prisma, close } = clients();
    try {
      const exempt = await prisma.analysis.count({
        where: {
          userId: null,
          createdAt: { lt: ANONYMOUS_EXPIRY_BOUNDARY },
        },
      });

      // The 22 analyses D-45 §3 names, including the live-provider run and
      // d797492d. If this number drops, evidence was destroyed.
      assert.equal(
        exempt,
        22,
        "the count of exempt legacy analyses changed — D-45 §3 names 22",
      );

      // And nothing created after the boundary is hiding among them.
      const newest = await prisma.analysis.findFirst({
        where: { userId: null, createdAt: { lt: ANONYMOUS_EXPIRY_BOUNDARY } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      assert.ok(newest);
      assert.ok(
        newest.createdAt < ANONYMOUS_EXPIRY_BOUNDARY,
        "an exempt row is not actually before the boundary",
      );
    } finally {
      await close();
    }
  },
);

test(
  "a post-boundary anonymous analysis IS eligible while the legacy rows are not",
  { skip },
  async () => {
    // The other half of the exemption: it protects the legacy set and nothing
    // else. Counted rather than swept — see the file header.
    //
    // ⚠️ EVALUATED AT A FUTURE INSTANT, DELIBERATELY. The boundary is
    // 2026-09-07 and the expiry period is 7 days, so **no post-boundary row
    // can be eligible until 2026-09-14** — today the eligible range is
    // legitimately empty, which is the behaviour the unit suite pins
    // separately. Using the real clock here would assert against that empty
    // window and prove nothing about the exemption.
    const evaluatedAt = new Date(
      ANONYMOUS_EXPIRY_BOUNDARY.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    const { prisma, close } = clients();
    let analysisId: string | undefined;
    try {
      const stale = new Date(
        anonymousExpiryCutoff(evaluatedAt).getTime() - 60_000,
      );
      const created = await prisma.analysis.create({
        data: {
          status: "completed",
          anonymousTokenHash: hashToken(generateToken()),
          createdAt: stale,
          completedAt: stale,
        },
      });
      analysisId = created.analysisId;

      const wouldSweep = await prisma.analysis.findMany({
        where: {
          userId: null,
          createdAt: {
            gte: ANONYMOUS_EXPIRY_BOUNDARY,
            lt: anonymousExpiryCutoff(evaluatedAt),
          },
        },
        select: { analysisId: true },
      });

      const ids = wouldSweep.map((a) => a.analysisId);
      assert.ok(
        ids.includes(analysisId),
        "a stale post-boundary anonymous analysis was not eligible",
      );

      // No legacy row is in the eligible set.
      const legacy = await prisma.analysis.findMany({
        where: { userId: null, createdAt: { lt: ANONYMOUS_EXPIRY_BOUNDARY } },
        select: { analysisId: true },
      });
      for (const row of legacy) {
        assert.equal(
          ids.includes(row.analysisId),
          false,
          `legacy analysis ${row.analysisId} would have been swept`,
        );
      }
    } finally {
      if (analysisId !== undefined) {
        await prisma.analysis.delete({ where: { analysisId } });
      }
      await close();
    }
  },
);

// --- D-44: the refresh-token table ------------------------------------------

test(
  "D-44 — a refresh-token family round-trips with consumed rows retained",
  { skip },
  async () => {
    const { prisma, close } = clients();
    let userId: string | undefined;
    try {
      const user = await newUser(prisma);
      userId = user.userId;

      const session = await prisma.session.create({
        data: {
          userId,
          tokenHash: hashToken(generateToken()),
          expiresAt: new Date(Date.now() + 3_600_000),
          userAgentClass: "browser",
          ipHash: "deadbeef",
        },
      });

      const familyId = randomUUID();
      const first = await prisma.refreshToken.create({
        data: {
          sessionId: session.sessionId,
          familyId,
          tokenHash: hashToken(generateToken()),
          expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000),
        },
      });

      // Rotation: the old row is CONSUMED, not deleted. That retention is what
      // makes reuse recognisable at all (D-44 §1 point 3).
      const second = await prisma.refreshToken.create({
        data: {
          sessionId: session.sessionId,
          familyId,
          tokenHash: hashToken(generateToken()),
          expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000),
        },
      });
      await prisma.refreshToken.update({
        where: { refreshTokenId: first.refreshTokenId },
        data: { consumedAt: new Date(), replacedById: second.refreshTokenId },
      });

      const consumed = await prisma.refreshToken.findUnique({
        where: { refreshTokenId: first.refreshTokenId },
      });
      assert.ok(
        consumed,
        "the consumed token was deleted — reuse is undetectable",
      );
      assert.notEqual(consumed.consumedAt, null);
      assert.equal(consumed.replacedById, second.refreshTokenId);

      // The family is one predicate, not a walk up a chain.
      const family = await prisma.refreshToken.findMany({
        where: { familyId },
      });
      assert.equal(family.length, 2);
    } finally {
      if (userId !== undefined) {
        await prisma.user.delete({ where: { userId } });
      }
      await close();
    }
  },
);

test(
  "a refresh token cannot expire before it was issued",
  { skip },
  async () => {
    const { prisma, close } = clients();
    let userId: string | undefined;
    try {
      const user = await newUser(prisma);
      userId = user.userId;
      const session = await prisma.session.create({
        data: {
          userId,
          tokenHash: hashToken(generateToken()),
          expiresAt: new Date(Date.now() + 3_600_000),
          userAgentClass: "browser",
          ipHash: "deadbeef",
        },
      });

      await assert.rejects(
        prisma.refreshToken.create({
          data: {
            sessionId: session.sessionId,
            familyId: randomUUID(),
            tokenHash: hashToken(generateToken()),
            issuedAt: new Date(Date.now()),
            expiresAt: new Date(Date.now() - 60_000),
          },
        }),
        /refresh_token_expiry_check/,
      );
    } finally {
      if (userId !== undefined) {
        await prisma.user.delete({ where: { userId } });
      }
      await close();
    }
  },
);

// --- DB §4.1 and §4.6 constraints -------------------------------------------

test(
  "DB §4.1 — an active account cannot have a null credential",
  { skip },
  async () => {
    const { prisma, close } = clients();
    try {
      await assert.rejects(
        prisma.user.create({
          data: { email: `test-${randomUUID()}@example.test` },
        }),
        /user_active_credential_check/,
      );
    } finally {
      await close();
    }
  },
);

test(
  "DB §4.6 — deleting a user nullifies audit events rather than removing them",
  { skip },
  async () => {
    // The one place in the schema a user reference is severed rather than
    // cascaded. The event that an action occurred survives; the identity does
    // not — which is what lets FR-073 and the audit trail both hold.
    const { prisma, close } = clients();
    let auditEventId: string | undefined;
    try {
      const user = await newUser(prisma);
      const event = await prisma.auditEvent.create({
        data: {
          userId: user.userId,
          eventType: "session.created",
          resourceType: "session",
          outcome: "success",
        },
      });
      auditEventId = event.auditEventId;

      await prisma.user.delete({ where: { userId: user.userId } });

      const survived = await prisma.auditEvent.findUnique({
        where: { auditEventId },
      });
      assert.ok(survived, "the audit event was cascade-deleted with the user");
      assert.equal(survived.userId, null, "the identity was not severed");
      assert.equal(survived.eventType, "session.created");
    } finally {
      if (auditEventId !== undefined) {
        await prisma.auditEvent
          .delete({ where: { auditEventId } })
          .catch(() => undefined);
      }
      await close();
    }
  },
);

test(
  "deleting a user cascades sessions, refresh tokens and settings",
  { skip },
  async () => {
    const { prisma, close } = clients();
    try {
      const user = await newUser(prisma);
      const session = await prisma.session.create({
        data: {
          userId: user.userId,
          tokenHash: hashToken(generateToken()),
          expiresAt: new Date(Date.now() + 3_600_000),
          userAgentClass: "browser",
          ipHash: "deadbeef",
        },
      });
      await prisma.refreshToken.create({
        data: {
          sessionId: session.sessionId,
          familyId: randomUUID(),
          tokenHash: hashToken(generateToken()),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });

      await prisma.user.delete({ where: { userId: user.userId } });

      assert.equal(
        await prisma.session.count({ where: { userId: user.userId } }),
        0,
      );
      assert.equal(
        await prisma.refreshToken.count({
          where: { sessionId: session.sessionId },
        }),
        0,
      );
      assert.equal(
        await prisma.userSettings.count({ where: { userId: user.userId } }),
        0,
      );
    } finally {
      await close();
    }
  },
);

test("FEEDBACK allows one record per analysis", { skip }, async () => {
  const { prisma, close } = clients();
  let userId: string | undefined;
  let analysisId: string | undefined;
  try {
    const user = await newUser(prisma);
    userId = user.userId;
    const analysis = await prisma.analysis.create({
      data: { status: "completed", userId },
    });
    analysisId = analysis.analysisId;

    await prisma.feedback.create({
      data: { analysisId, userId, helpful: true },
    });
    await assert.rejects(
      prisma.feedback.create({
        data: { analysisId, userId, helpful: false },
      }),
      /feedback_analysis_id_key|Unique constraint/,
    );
  } finally {
    if (analysisId !== undefined) {
      await prisma.analysis
        .delete({ where: { analysisId } })
        .catch(() => undefined);
    }
    if (userId !== undefined) {
      await prisma.user.delete({ where: { userId } }).catch(() => undefined);
    }
    await close();
  }
});
