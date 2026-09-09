/**
 * Integration — the minimal harness (`Roadmap` Sprint 1 Interface, `EP-2`).
 *
 * `EP-2` requires a sprint to end with something that "can be executed,
 * observed, and judged". These tests check the harness does that against real
 * infrastructure, and — more importantly — that it observes the **production**
 * pipeline rather than a convenient copy of it.
 *
 * Requires both databases. As with the other real-infrastructure tests, they
 * skip locally and **fail** in CI (`CI=true`) rather than passing hollowly.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client.js";
import { PrismaClient as TracePrismaClient } from "../../src/generated/prisma-trace/client.js";
import { loadConfig } from "../../src/config/env.js";
import { runHarness, validateInput } from "../../src/harness/run.js";
import type { HarnessReport } from "../../src/harness/run.js";
import { STAGES } from "../../src/nie/stages.js";

const INPUT = [
  "We need to automate our supplier invoice approval process.",
  "",
  "Invoices arrive as PDF attachments to accounts@ourcompany.com. Someone in",
  "finance keys each one into Xero, then emails the department head for",
  "approval. Volumes run about 450 per month from 90 suppliers. Approvals take",
  "5-9 days and we miss early-payment discounts as a result.",
].join("\n");

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

const primaryReachable = await reachable(process.env["DATABASE_URL"]);
const traceReachable = await reachable(process.env["TRACE_DATABASE_URL"]);
const AVAILABLE = primaryReachable && traceReachable;

const REQUIRED =
  process.env["CI"] === "true" || process.env["REQUIRE_DB_TESTS"] === "1";

if (!AVAILABLE && REQUIRED) {
  throw new Error(
    "Harness tests are mandatory here but DATABASE_URL / TRACE_DATABASE_URL are unreachable. " +
      "Provision both databases — see .github/workflows/ci.yml.",
  );
}

const skip = AVAILABLE
  ? false
  : "requires DATABASE_URL and TRACE_DATABASE_URL to be reachable";

/**
 * Asserts the run's provider calls reached `PROVIDER_INVOCATION` in the trace
 * store, each resolving to a stage trace the same run produced (`DB §4.7`,
 * `§8.2`, `FR-093`, `NFR-083`).
 */
const assertInvocationsPersisted = async (
  report: HarnessReport,
): Promise<void> => {
  const config = loadConfig();
  const tracePool = new pg.Pool({ connectionString: config.traceDatabaseUrl });
  const trace = new TracePrismaClient({ adapter: new PrismaPg(tracePool) });
  try {
    const stageTraceIds = report.trace.stages.map((s) => s.stageTraceId);
    const rows = await trace.providerInvocation.findMany({
      where: { stageTraceId: { in: stageTraceIds } },
    });

    assert.equal(
      rows.length,
      report.provider.invocations.length,
      "every invocation the report shows is a row in the trace store",
    );
    for (const row of rows) {
      assert.ok(
        stageTraceIds.includes(row.stageTraceId),
        "the row resolves to a stage trace of this run",
      );
      assert.equal(row.outcome, "success");
      assert.equal(row.attemptNumber, 1);
      assert.ok(row.inputTokens > 0 && row.outputTokens > 0);
      assert.ok(Number(row.estimatedCost) > 0);
      assert.ok(row.modelVersionId.length > 0, "AI-004 drift attribution");
    }
  } finally {
    await trace.$disconnect();
    await tracePool.end();
  }
};

/** Removes what a harness run wrote, leaving reference data in place. */
const cleanup = async (analysisId: string): Promise<void> => {
  const config = loadConfig();
  const primaryPool = new pg.Pool({ connectionString: config.databaseUrl });
  const tracePool = new pg.Pool({ connectionString: config.traceDatabaseUrl });
  const primary = new PrismaClient({ adapter: new PrismaPg(primaryPool) });
  const trace = new TracePrismaClient({ adapter: new PrismaPg(tracePool) });
  try {
    // Provider invocations first: they are linked by identifier with no
    // foreign key (`docs/12` D-9), so nothing cascades them away.
    const stageTraces = await trace.stageTrace.findMany({
      where: { analysisId },
      select: { stageTraceId: true },
    });
    await trace.providerInvocation.deleteMany({
      where: { stageTraceId: { in: stageTraces.map((t) => t.stageTraceId) } },
    });
    await trace.stageTrace.deleteMany({ where: { analysisId } });
    await primary.analysis.delete({ where: { analysisId } });
  } finally {
    await primary.$disconnect();
    await trace.$disconnect();
    await primaryPool.end();
    await tracePool.end();
  }
};

// --- it is the real pipeline --------------------------------------------

test("the harness runs the production pipeline, not a copy of it", () => {
  // Structural, so it holds without a database. Boundary check 6 already
  // forbids any module but `pipeline.ts` importing a stage module, so the
  // harness *cannot* re-implement a stage; this asserts the positive half —
  // that it goes through `createPipeline` and the production sinks.
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, "../../src/harness/run.ts"),
    "utf8",
  );

  for (const required of [
    'from "../nie/pipeline.js"',
    "createPipeline",
    "createFragmentResolver",
    "createStageTraceSink",
    "createFragmentUsageSink",
    "createStageResultSink",
    "createProviderInvoker",
    // `FR-093`/`NFR-083`: provider calls are persisted, not merely collected
    // for the report (`docs/12` D-20's outstanding item).
    "createProviderInvocationRecorder",
  ]) {
    assert.ok(source.includes(required), `harness must use ${required}`);
  }

  for (const forbidden of [
    "parseClassification",
    "parseArchitecture",
    "JSON.parse(",
  ]) {
    assert.ok(
      !source.includes(forbidden),
      `harness must not re-implement stage logic (found ${forbidden})`,
    );
  }
});

test("input bounds match FR-002 rather than being re-invented", () => {
  assert.throws(() => validateInput("too short"), RangeError);
  assert.throws(() => validateInput("x".repeat(50_001)), RangeError);
  assert.doesNotThrow(() => validateInput("x".repeat(50)));
});

// --- a successful business requirement -----------------------------------

test(
  "a business requirement produces a grounded, persisted architecture",
  { skip },
  async () => {
    const report = await runHarness({ inputText: INPUT });

    try {
      assert.equal(report.outcome, "completed");
      assert.equal(report.provider.adapter, "recorded");
      assert.ok(
        /reasoning is not/.test(report.provider.note),
        "the report states plainly what it does and does not demonstrate",
      );

      // Every implemented stage *on this path* ran and was traced, in order.
      // Stages 7 and 8 are excluded because `AI §9.1` scopes recommendation
      // generation and artifact planning to the job-description path: a
      // business requirement that ran them would be answering a question
      // nobody asked. Stage 9 runs here since D-73 — it renders the
      // requirement's architecture recommendation and diagram.
      const JOB_DESCRIPTION_PATH_ONLY = new Set([7, 8]);
      const implemented = STAGES.filter(
        (s) => s.implemented && !JOB_DESCRIPTION_PATH_ONLY.has(s.stageNumber),
      ).map((s) => s.stageNumber);
      assert.deepEqual(
        report.trace.stages.map((s) => s.stageNumber),
        implemented,
      );
      for (const stage of report.trace.stages) {
        assert.equal(stage.outcome, "success");
        assert.equal(stage.failureReason, null);
        assert.ok(stage.stageTraceId.length > 0);
      }

      // Fragment composition was resolved and recorded per run (`AI-013`).
      assert.ok(report.fragments.length > 0);
      assert.ok(
        report.fragments.every((f) => f.fragmentVersionId.length > 0),
        "every recorded usage names a published fragment version",
      );

      // Cost accounting flowed through the shared provider path — for the
      // stages that call one. Stage 5 is deterministic (`AI` App. A,
      // `docs/12` D-35): it is traced like any other stage but reaches no
      // provider, so it contributes a trace and no invocation.
      // D-72: Stages 10 (response validation) and 12 (response assembly) are
      // deterministic too — traced, never a provider call.
      // D-78: Stage 9 on this path is the platform generator, a provider call.
      const DETERMINISTIC = new Set([5, 10, 12]);
      const providerStages = implemented.filter((n) => !DETERMINISTIC.has(n));
      assert.equal(report.provider.invocations.length, providerStages.length);
      for (const invocation of report.provider.invocations) {
        assert.match(invocation.estimatedCostUsd, /^\d+\.\d{8}$/);
      }

      // …and reached the trace store, rather than only the report. Collecting
      // invocations in memory is what `docs/12` D-20 recorded as outstanding:
      // a real run's token counts and cost never reached `PROVIDER_INVOCATION`.
      await assertInvocationsPersisted(report);

      // The observable deliverable: an architecture read back from storage, with
      // each component grounded in a stored context element (`FR-030`).
      const persisted = report.persisted as {
        architectureId: string | null;
        contextElements: readonly unknown[];
        components: readonly {
          name: string;
          groundedIn: readonly {
            contextElementId: string;
            provenance: string;
          }[];
        }[];
      };

      assert.ok(persisted.architectureId, "an ARCHITECTURE_MODEL row exists");
      assert.ok(persisted.components.length > 0);
      for (const component of persisted.components) {
        assert.ok(
          component.groundedIn.length > 0,
          `component "${component.name}" must cite at least one context element`,
        );
        for (const grounding of component.groundedIn) {
          assert.ok(grounding.contextElementId.length > 0);
          assert.ok(
            ["stated", "inferred", "unknown"].includes(grounding.provenance),
            "grounding resolves to a real element carrying provenance",
          );
        }
      }
    } finally {
      await cleanup(report.analysisId);
    }
  },
);

// --- a meaningful failure ------------------------------------------------

test(
  "a failing run surfaces the stage, the reason and its trace",
  { skip },
  async () => {
    // The stub adapter returns a synthetic digest, which no stage can parse. That
    // is a realistic failure to observe: the pipeline reached the provider, got an
    // unusable answer, and stopped.
    const report = await runHarness({ inputText: INPUT, provider: "stub" });

    try {
      assert.equal(report.outcome, "failed");
      assert.equal(report.failure?.stageNumber, 1);
      assert.equal(report.failure?.stageKey, "input_classification");
      assert.match(report.failure?.message ?? "", /JSON/);

      // A failed stage is the one whose trace matters most (`FR-093`).
      assert.equal(report.trace.stages.length, 1);
      assert.equal(report.trace.stages[0]?.outcome, "failure");
      assert.ok(report.trace.stages[0]?.failureReason);

      assert.ok(
        !/stub|provider/i.test(report.failure?.message ?? ""),
        "the failure names no provider (AI-006, FR-093)",
      );
      // `FR-091`: a partial failure yields partial results, so the report now
      // carries whatever earlier stages committed. Stage 1 failed, so that is
      // nothing — and nothing must mean *no invalid rows*, not an absent
      // section of the report.
      const persisted = report.persisted as {
        architectureId: string | null;
        contextElements: readonly unknown[];
        components: readonly unknown[];
      };
      assert.ok(persisted, "a failed run still reports what was stored");
      assert.deepEqual(persisted.contextElements, []);
      assert.deepEqual(persisted.components, []);
      assert.equal(persisted.architectureId, null);
    } finally {
      await cleanup(report.analysisId);
    }
  },
);

test(
  "a missing recording is reported as a provider failure, not a crash",
  { skip },
  async () => {
    // An empty recording set means the replay adapter has nothing to answer with.
    const report = await runHarness({ inputText: INPUT, recordings: [] });

    try {
      assert.equal(report.outcome, "failed");
      assert.equal(
        report.failure?.stageNumber,
        null,
        "a provider failure, not a stage parse failure",
      );
      assert.equal(report.trace.stages[0]?.outcome, "failure");
    } finally {
      await cleanup(report.analysisId);
    }
  },
);
