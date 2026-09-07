/**
 * Integration — refusal persistence against **real Postgres**.
 *
 * The offline refusal suite proves the orchestrator writes the right fields
 * and the route raises the right status. It cannot prove the database accepts
 * the columns, that the CHECK constraint holds, or that a row written by one
 * process reads back as a refusal in another. That is what this file is for.
 *
 * IT ALSO PROVES THE MIGRATION IS ADDITIVE. A row created without touching the
 * halt columns comes back with both null and is **not** read as a refusal —
 * which is the guarantee every analysis stored before this migration depends
 * on. Nothing was backfilled, and nothing may behave as though it had been.
 *
 * NO PROVIDER IS INVOLVED. Rows are written directly. Nothing here costs money.
 *
 * REQUIRES THE PRIMARY DATABASE. Unreachable means skip locally and fail in
 * CI, matching the other Postgres-backed suites — a skip is visible, a false
 * pass is not.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client.js";
import { readAnalysis } from "../../src/db/analysis-reader.js";
import { renderAnalysisMarkdown } from "../../src/export/markdown.js";

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
    "Database-backed refusal tests are mandatory here " +
      `(CI=${String(process.env["CI"])}, REQUIRE_DB_TESTS=${String(process.env["REQUIRE_DB_TESTS"])}) ` +
      "but DATABASE_URL is unreachable. Provision the primary store — see docker-compose.yml.",
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

test(
  "a Stage 3 refusal round-trips through Postgres with its unknowns",
  { skip },
  async () => {
    const { prisma, close } = clients();
    let analysisId: string | undefined;
    try {
      const analysis = await prisma.analysis.create({
        data: {
          status: "completed",
          anonymousTokenHash: `test-${randomUUID()}`,
          completedAt: new Date(),
          sufficiencyLevel: "insufficient",
          haltedAtStage: 3,
          haltReason:
            "Context insufficient; any design would be substantially invented (AI §5.4)",
          contextElements: {
            create: [
              {
                content: "Expected peak submission rate",
                category: "constraint",
                provenance: "unknown",
                specificityScore: 0.1,
                resolutionHint: "Ask for peak submissions per hour",
              },
            ],
          },
        },
      });
      analysisId = analysis.analysisId;

      const stored = await readAnalysis(prisma, analysisId);
      assert.ok(stored);
      assert.ok(stored.view.refusal);
      assert.equal(stored.view.refusal.code, "insufficient_context");
      assert.equal(stored.view.refusal.halted_at_stage, 3);
      assert.deepEqual(stored.view.refusal.unknowns, [
        {
          content: "Expected peak submission rate",
          resolution_hint: "Ask for peak submissions per hour",
        },
      ]);

      // The export reads the same view, so it must reach the same conclusion.
      const exported = renderAnalysisMarkdown(stored.view, {
        generatedAt: new Date("2026-09-07T16:00:00.000Z"),
      });
      assert.match(exported.document, /^# Analysis declined/);
      assert.match(exported.document, /Ask for peak submissions per hour/);
    } finally {
      if (analysisId !== undefined) {
        await prisma.analysis.delete({ where: { analysisId } });
      }
      await close();
    }
  },
);

test(
  "a Stage 1 refusal round-trips and reports no unknowns",
  { skip },
  async () => {
    const { prisma, close } = clients();
    let analysisId: string | undefined;
    try {
      const analysis = await prisma.analysis.create({
        data: {
          status: "completed",
          anonymousTokenHash: `test-${randomUUID()}`,
          completedAt: new Date(),
          haltedAtStage: 1,
          haltReason:
            "Input classified unsupported; no reasoning performed (FR-092)",
        },
      });
      analysisId = analysis.analysisId;

      const stored = await readAnalysis(prisma, analysisId);
      assert.equal(stored?.view.refusal?.code, "unsupported_input_type");
      assert.deepEqual(stored?.view.refusal?.unknowns, []);
    } finally {
      if (analysisId !== undefined) {
        await prisma.analysis.delete({ where: { analysisId } });
      }
      await close();
    }
  },
);

test(
  "an analysis created without halt columns is not a refusal",
  { skip },
  async () => {
    // The additive-migration guarantee, checked against the real table rather
    // than against a fake that could not fail it. This is the shape every row
    // stored before the migration has.
    const { prisma, close } = clients();
    let analysisId: string | undefined;
    try {
      const analysis = await prisma.analysis.create({
        data: {
          status: "completed",
          anonymousTokenHash: `test-${randomUUID()}`,
          completedAt: new Date(),
        },
      });
      analysisId = analysis.analysisId;

      const row = await prisma.analysis.findUnique({
        where: { analysisId },
        select: { haltedAtStage: true, haltReason: true },
      });
      assert.equal(row?.haltedAtStage, null);
      assert.equal(row?.haltReason, null);

      const stored = await readAnalysis(prisma, analysisId);
      assert.equal(stored?.view.refusal, null);
    } finally {
      if (analysisId !== undefined) {
        await prisma.analysis.delete({ where: { analysisId } });
      }
      await close();
    }
  },
);

test("the database refuses a stage with no reason", { skip }, async () => {
  // `analysis_halt_complete_check`. A refusal that cannot explain itself is
  // worse than none, so the constraint makes the half-written state
  // unreachable rather than leaving the reader to cope with it.
  const { prisma, close } = clients();
  try {
    await assert.rejects(
      prisma.analysis.create({
        data: {
          status: "completed",
          anonymousTokenHash: `test-${randomUUID()}`,
          haltedAtStage: 3,
        },
      }),
      /analysis_halt_complete_check/,
    );
  } finally {
    await close();
  }
});

test("the database refuses a reason with no stage", { skip }, async () => {
  const { prisma, close } = clients();
  try {
    await assert.rejects(
      prisma.analysis.create({
        data: {
          status: "completed",
          anonymousTokenHash: `test-${randomUUID()}`,
          haltReason: "a reason nobody can locate",
        },
      }),
      /analysis_halt_complete_check/,
    );
  } finally {
    await close();
  }
});
