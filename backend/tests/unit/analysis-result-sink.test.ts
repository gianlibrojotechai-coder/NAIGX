/**
 * Unit — Stage 3's reported sufficiency reaches `ANALYSIS.sufficiency_level`.
 *
 * `schema.prisma` annotates the column "Written at Stage 3 (`AI §5.4`)" and
 * `docs/12` D-13 fixes where the value comes from: reported by the model and
 * validated against the `§5.4` enumeration, never computed. Stage 3 already
 * produced it; until now nothing wrote it down.
 *
 * The Prisma client is a recording double, so this runs with no database — the
 * database-backed assertion lives in `nie-real-infrastructure.test.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createStageResultSink } from "../../src/db/analysis-result-sink.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { ContextResult } from "../../src/nie/contracts.js";

interface Call {
  readonly model: string;
  readonly op: string;
  readonly args: unknown;
  /** True when the call was made against the transaction client. */
  readonly inTransaction: boolean;
}

const recordingPrisma = () => {
  const calls: Call[] = [];

  const client = (inTransaction: boolean) => ({
    contextElement: {
      create: (args: unknown) => {
        calls.push({
          model: "contextElement",
          op: "create",
          args,
          inTransaction,
        });
        return Promise.resolve({
          contextElementId: `element-${String(calls.length)}`,
        });
      },
      update: (args: unknown) => {
        calls.push({
          model: "contextElement",
          op: "update",
          args,
          inTransaction,
        });
        return Promise.resolve({});
      },
    },
    analysis: {
      update: (args: unknown) => {
        calls.push({ model: "analysis", op: "update", args, inTransaction });
        return Promise.resolve({});
      },
    },
  });

  const prisma = {
    ...client(false),
    $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn(client(true)),
  };

  return { prisma: prisma as unknown as PrismaClient, calls };
};

const context = (sufficiency: ContextResult["sufficiency"]): ContextResult => ({
  elements: [
    {
      content: "Invoices arrive by email",
      category: "environment",
      provenance: "stated",
      specificityScore: 0.9,
      sourceSpanStart: 0,
      sourceSpanEnd: 24,
    },
  ],
  sufficiency,
});

for (const level of ["sufficient", "thin", "insufficient"] as const) {
  test(`persistContext writes sufficiency "${level}" to the analysis`, async () => {
    const { prisma, calls } = recordingPrisma();

    await createStageResultSink(prisma).persistContext("analysis-1", {
      ...context(level),
    });

    const update = calls.find((c) => c.model === "analysis");
    assert.ok(update, "the analysis row is updated");
    assert.deepEqual(update.args, {
      where: { analysisId: "analysis-1" },
      data: { sufficiencyLevel: level },
    });
  });
}

test("the sufficiency write shares Stage 3's transaction", async () => {
  const { prisma, calls } = recordingPrisma();

  await createStageResultSink(prisma).persistContext(
    "analysis-1",
    context("thin"),
  );

  const update = calls.find((c) => c.model === "analysis");
  assert.ok(update);
  assert.equal(
    update.inTransaction,
    true,
    "a context set without its level, or a level without its elements, is the half-written stage the boundary prevents",
  );
});

test("element persistence is unchanged", async () => {
  const { prisma, calls } = recordingPrisma();

  const result = context("sufficient");
  await createStageResultSink(prisma).persistContext("analysis-1", {
    elements: [
      ...result.elements,
      {
        content: "Volume is roughly 450 per month",
        category: "constraint",
        provenance: "inferred",
        specificityScore: 0.4,
        inferenceBasis: "stated volume",
        conflictsWithIndex: 0,
      },
    ],
    sufficiency: result.sufficiency,
  });

  const creates = calls.filter((c) => c.op === "create");
  assert.equal(creates.length, 2, "one row per element, in order");
  const first = creates[0];
  assert.ok(first);
  assert.equal(
    (first.args as { data: { content: string } }).data.content,
    "Invoices arrive by email",
  );

  const links = calls.filter(
    (c) => c.model === "contextElement" && c.op === "update",
  );
  assert.equal(links.length, 1, "the conflict link is still written");
  assert.deepEqual(links[0]?.args, {
    where: { contextElementId: "element-2" },
    data: { conflictsWithId: "element-1" },
  });

  // The elements and their links are written before the analysis is stamped,
  // so nothing about the existing ordering moved.
  const analysisIndex = calls.findIndex((c) => c.model === "analysis");
  assert.equal(analysisIndex, calls.length - 1);
});
