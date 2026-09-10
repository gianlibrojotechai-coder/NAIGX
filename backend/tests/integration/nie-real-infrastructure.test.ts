/**
 * Integration — NIE stages 1-3 against the **real** persistence and fragment
 * infrastructure.
 *
 * Everything here is production code except the provider: the FragmentResolver
 * reads published `PROMPT_FRAGMENT_VERSION` rows, `FRAGMENT_USAGE` is written to
 * the primary store, and `STAGE_TRACE` is written to the separate trace store.
 * The provider is the replay adapter so the run stays offline and deterministic
 * — a network dependency here would make the suite conditional on a credential,
 * which is exactly the `SA AR-43` failure.
 *
 * REQUIRES TWO DATABASES. When they are unreachable the tests skip rather than
 * fail: CI has no Postgres service yet (see the report accompanying this file).
 * A skip is visible; a false pass is not.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client.js";
import { PrismaClient as TracePrismaClient } from "../../src/generated/prisma-trace/client.js";
import { createFragmentResolver } from "../../src/db/fragment-resolver.js";
import { createFragmentUsageSink } from "../../src/db/fragment-usage-sink.js";
import { createStageTraceSink } from "../../src/db/stage-trace-sink.js";
import { createTestCipher } from "../helpers/cipher.js";
import { createStageResultSink } from "../../src/db/analysis-result-sink.js";
import { createProviderInvocationRecorder } from "../../src/db/provider-invocation-recorder.js";
import { createProviderInvoker } from "../../src/provider/invoke.js";
import {
  createReplayProvider,
  replayKeyFor,
} from "../../src/provider/adapters/replay.js";
import type { CapabilityRequest } from "../../src/provider/capability.js";
import {
  architectureHandoffView,
  contextHandoffView,
  createPipeline,
  stageHandoff,
} from "../../src/nie/pipeline.js";
import { parseClassification } from "../../src/nie/stages/classification.js";
import { parseIntent } from "../../src/nie/stages/intent.js";
import { parseContext } from "../../src/nie/stages/context-extraction.js";
import { parseArchitecture } from "../../src/nie/stages/architecture-analysis.js";
import { StageError } from "../../src/nie/contracts.js";
import { composePrompt } from "../../src/nie/prompt.js";
import type { FragmentResolver } from "../../src/nie/ports.js";

// Over the D-90 minimal band (200 characters): these tests exercise the
// full requirement path, and a two-line input would now run at minimal depth.
const INPUT =
  "Invoices arrive by email and are keyed into Xero by hand. Roughly 450 per month. " +
  "Approvals go by email to the department head and take five to nine days, so early-payment discounts are missed; we would like the routing and the reminders handled automatically.";

const rate = {
  inputUsdPerMillionTokens: "3.00",
  outputUsdPerMillionTokens: "15.00",
};

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
const DATABASES_AVAILABLE = primaryReachable && traceReachable;

// A real cipher, not a pass-through: these suites are the only place the seal/
// open round trip is exercised against actual columns.
const testCipher = await createTestCipher();

/**
 * Where these tests are mandatory.
 *
 * `CI` is set to `true` by GitHub Actions and every other CI runner; the
 * explicit override exists so a developer can demand the same strictness
 * locally. Skipping is a local convenience only — in CI a missing database
 * **fails the build** rather than producing a green run that proved nothing.
 * A suite that silently stops running is the `SA AR-43` failure in a new
 * costume: an assumption nobody is checking.
 */
const DATABASES_REQUIRED =
  process.env["CI"] === "true" || process.env["REQUIRE_DB_TESTS"] === "1";

if (!DATABASES_AVAILABLE && DATABASES_REQUIRED) {
  const missing = [
    ...(primaryReachable ? [] : ["DATABASE_URL (primary store)"]),
    ...(traceReachable ? [] : ["TRACE_DATABASE_URL (trace store)"]),
  ];
  throw new Error(
    `Database-backed NIE tests are mandatory here (CI=${String(process.env["CI"])}, ` +
      `REQUIRE_DB_TESTS=${String(process.env["REQUIRE_DB_TESTS"])}) but these are unreachable: ` +
      `${missing.join(", ")}. Provision both databases — see .github/workflows/ci.yml.`,
  );
}

const skip = DATABASES_AVAILABLE
  ? false
  : "requires DATABASE_URL and TRACE_DATABASE_URL to be reachable (set REQUIRE_DB_TESTS=1 to make this an error)";

const clients = () => {
  const primaryPool = new pg.Pool({
    connectionString: process.env["DATABASE_URL"],
  });
  const tracePool = new pg.Pool({
    connectionString: process.env["TRACE_DATABASE_URL"],
  });
  return {
    primary: new PrismaClient({ adapter: new PrismaPg(primaryPool) }),
    trace: new TracePrismaClient({ adapter: new PrismaPg(tracePool) }),
    close: async () => {
      await primaryPool.end();
      await tracePool.end();
    },
  };
};

/** Seeds the rows an analysis needs, and returns a cleanup function. */
const seedAnalysis = async (primary: PrismaClient) => {
  const suffix = randomUUID().slice(0, 8);
  const provider = await primary.provider.create({
    data: {
      providerKey: `test-${suffix}`,
      declaredCapabilities: {},
      active: true,
    },
  });
  const modelVersion = await primary.modelVersion.create({
    data: {
      providerId: provider.providerId,
      modelKey: `model-${suffix}`,
      versionLabel: "1",
      active: true,
    },
  });
  const analysis = await primary.analysis.create({
    data: {
      status: "running",
      anonymousTokenHash: `anon-${suffix}`,
      modelVersionId: modelVersion.modelVersionId,
    },
  });

  return {
    analysisId: analysis.analysisId,
    modelVersionId: modelVersion.modelVersionId,
    modelKey: modelVersion.modelKey,
    cleanup: async () => {
      // Analysis cascades to FragmentUsage (`DB §5.3`); ModelVersion and
      // Provider are RESTRICT, so they are removed explicitly and last.
      await primary.analysis.delete({
        where: { analysisId: analysis.analysisId },
      });
      await primary.modelVersion.delete({
        where: { modelVersionId: modelVersion.modelVersionId },
      });
      await primary.provider.delete({
        where: { providerId: provider.providerId },
      });
    },
  };
};

const OUTPUTS = {
  classification: JSON.stringify({
    determined_type: "business_requirement",
    confidence: 0.91,
    candidate_types: ["business_requirement"],
  }),
  intent: JSON.stringify({
    primary_objective: {
      content: "Automate invoice capture and approval",
      provenance: "stated",
    },
    secondary_objectives: [],
    inferred_scope: "Accounts payable",
  }),
  architecture: JSON.stringify({
    summary: "Automated invoice capture and approval routing",
    data_flow_description: "Email to ingestion to Xero",
    components: [
      {
        name: "Invoice Ingestion",
        responsibility: "Capture inbound invoice attachments",
        inputs: "Email messages with attachments",
        outputs: "Normalised invoice records",
        failure_handling: "Retry with backoff; quarantine failures",
        grounded_in_context_indices: [0],
        external_system: "Xero",
        integration_direction: "outbound",
      },
    ],
  }),
  context: JSON.stringify({
    elements: [
      {
        id: "e1",
        content: "Invoices arrive by email",
        category: "environment",
        provenance: "stated",
        source_quote: "Invoices arrive by email",
        specificity_score: 0.9,
      },
    ],
    sufficiency: "sufficient",
  }),
};

/**
 * Builds a replay adapter primed against the prompts the **real** resolver
 * composes — so a fixture only matches if the published fragment content is
 * what the composer actually used.
 */
const primedAdapter = async (
  resolver: FragmentResolver,
  outputs: Partial<typeof OUTPUTS> = {},
) => {
  const fixtures: Record<
    string,
    {
      output: string;
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
    }
  > = {};

  const add = async (
    stageKey: string,
    providerInput: string,
    output: string,
    classifiedAs?: "business_requirement",
  ) => {
    const prompt = await composePrompt(
      { stageKey, ...(classifiedAs !== undefined ? { classifiedAs } : {}) },
      resolver,
    );
    const request: CapabilityRequest = {
      task: stageKey,
      input: providerInput,
      instructions: prompt.instructions,
      preferLowVariance: true,
    };
    fixtures[replayKeyFor(request)] = {
      output,
      inputTokens: 20,
      outputTokens: 30,
      latencyMs: 12,
    };
  };

  // Stage 1 receives the raw requirement; every later stage receives the
  // handoff the pipeline builds, so the fixtures parse forward exactly as the
  // pipeline does (`FR-010`, `AI §3.2`).
  const merged = { ...OUTPUTS, ...outputs };
  const classificationOutput = merged.classification;
  await add("input_classification", INPUT, classificationOutput);

  let classification;
  try {
    classification = parseClassification(classificationOutput);
  } catch {
    // A deliberately malformed Stage 1 fixture: nothing downstream will run.
    return createReplayProvider({ fixtures, lowVarianceSampling: true });
  }

  const intentOutput = merged.intent;
  await add(
    "intent_detection",
    stageHandoff({ input_text: INPUT, classification }),
    intentOutput,
    "business_requirement",
  );

  let intent;
  try {
    intent = parseIntent(intentOutput);
  } catch {
    return createReplayProvider({ fixtures, lowVarianceSampling: true });
  }

  const contextOutput = merged.context;
  await add(
    "context_extraction",
    stageHandoff({ input_text: INPUT, intent }),
    contextOutput,
    "business_requirement",
  );

  let context;
  try {
    context = parseContext(contextOutput, INPUT);
  } catch {
    return createReplayProvider({ fixtures, lowVarianceSampling: true });
  }

  await add(
    "architecture_analysis",
    // Labelled context set — grounding is copied, not counted.
    stageHandoff({
      classification,
      intent,
      context: contextHandoffView(context),
    }),
    merged.architecture,
    "business_requirement",
  );

  // D-78: the requirement path's Stage 9 generator, keyed on the parsed
  // architecture the way the pipeline keys it.
  try {
    const architecture = parseArchitecture(merged.architecture, context);
    const requirementHandoff = stageHandoff({
      context: contextHandoffView(context),
      architecture: architectureHandoffView(architecture),
    });
    // D-80: the complexity assessment, keyed on the same handoff.
    await add(
      "complexity_assessment",
      requirementHandoff,
      JSON.stringify({
        factors: [
          "workflow",
          "integration",
          "data_logic",
          "failure_risk",
          "operational",
        ].map((factor) => ({
          factor,
          score: 2,
          justification: "A placeholder justification for this design",
        })),
      }),
      "business_requirement",
    );
    // D-82: the implementation roadmap, keyed on the same handoff.
    await add(
      "implementation_roadmap",
      requirementHandoff,
      JSON.stringify({
        phases: [
          {
            ordinal: 1,
            name: "Capture invoices",
            objective:
              "Build the mailbox capture so invoices arrive as records",
            components: ["Invoice Ingestion"],
            depends_on: [],
            outcome: "Every emailed invoice becomes a normalised record",
            estimate: null,
          },
          {
            ordinal: 2,
            name: "Route approvals",
            objective: "Route captured invoices to approvers and track state",
            components: ["Invoice Ingestion"],
            depends_on: [1],
            outcome:
              "Invoices reach the right approver and their decisions are recorded",
            estimate: null,
          },
        ],
        sequencing_rationale:
          "Routing consumes captured records, so capture is proven first",
      }),
      "business_requirement",
    );
    // D-83/D-84: the edge cases and the integration requirements, same handoff.
    await add(
      "edge_case_analysis",
      requirementHandoff,
      JSON.stringify({
        edge_cases: [
          {
            component: "Invoice Ingestion",
            scenario:
              "An email carries two PDFs, one an invoice and one a remittance advice",
            consequence:
              "The remittance advice is captured as a second invoice",
            handling:
              "Classify attachments and quarantine any that cannot be classified",
          },
        ],
        practices: [],
      }),
      "business_requirement",
    );
    await add(
      "integration_requirements",
      requirementHandoff,
      JSON.stringify({
        integrations: [
          {
            system: "Xero",
            component: "Invoice Ingestion",
            purpose: "Create the approved bill in the ledger",
            direction: "outbound",
            capabilities_required: ["Create a bill with line items"],
            constraints: [
              {
                constraint: "60 calls per minute per tenant",
                provenance: "general_knowledge",
                context_index: null,
              },
            ],
            uncertainties: [],
          },
        ],
        no_integrations_statement: null,
        knowledge_currency_note:
          "Platform capabilities, limits and pricing change; verify before building.",
      }),
      "business_requirement",
    );
    // D-79: the risk register, keyed on the same handoff.
    await add(
      "risk_assessment",
      requirementHandoff,
      JSON.stringify({
        risks: architecture.components.map((c) => ({
          component: c.name,
          description: "A placeholder risk against this component",
          severity: 2,
          likelihood: 2,
          mitigation: "A placeholder mitigation",
        })),
        no_risks_statement: null,
      }),
      "business_requirement",
    );
    await add(
      "platform_recommendation",
      requirementHandoff,
      JSON.stringify({
        criteria_applied: [
          {
            criterion:
              "Invoices arrive by email, so capture starts from the mailbox",
            context_index: 0,
            component: null,
          },
        ],
        recommended_platform: "n8n",
        also_required: [],
        rationale:
          "A workflow platform with a mailbox trigger and a Xero node covers the design.",
        alternatives_rejected: [
          {
            platform: "Custom code",
            rejection_reason:
              "Nothing in the context names a developer to own it.",
          },
        ],
        fit: architecture.components.map((c) => ({
          component: c.name,
          how: "Covered by a dedicated node",
        })),
        knowledge_currency_note:
          "Platform capabilities and pricing change; verify before committing.",
      }),
      "business_requirement",
    );
  } catch {
    // An architecture fixture that does not parse describes a run that stops
    // at Stage 6; there is no Stage 9 call to key.
  }

  return createReplayProvider({ fixtures, lowVarianceSampling: true });
};

// --- fragment resolution -------------------------------------------------

test(
  "resolves the published fragment version, with content and version id",
  { skip },
  async () => {
    const { primary, close } = clients();
    try {
      const resolver = createFragmentResolver(primary);
      const resolved = await resolver.resolve([
        "foundation.system_frame",
        "stage.classification",
      ]);

      assert.equal(resolved.length, 2);
      assert.deepEqual(
        resolved.map((f) => f.fragmentKey),
        ["foundation.system_frame", "stage.classification"],
        "resolution preserves the requested order",
      );
      for (const fragment of resolved) {
        assert.ok(
          fragment.content.length > 0,
          "content comes from the database",
        );
        assert.ok(
          fragment.fragmentVersionId.length > 0,
          "version id for AI-013",
        );
        assert.ok(fragment.version.length > 0);
      }
      assert.match(
        resolved[1]?.content ?? "",
        /STAGE 1 — INPUT CLASSIFICATION/,
        "the published content is the authored content",
      );
    } finally {
      await close();
    }
  },
);

test(
  "selects the active version, not merely the newest row",
  { skip },
  async () => {
    // `DP-4` append-only plus `AI-014` rollback: activating an older row makes it
    // current again. A resolver that took `max(createdAt)` would ignore that.
    const { primary, close } = clients();
    const key = `test.rollback_${randomUUID().slice(0, 8)}`;
    try {
      const fragment = await primary.promptFragment.create({
        data: { fragmentKey: key, fragmentClass: "stage", ownerClass: "test" },
      });

      const v1 = await primary.promptFragmentVersion.create({
        data: {
          fragmentId: fragment.fragmentId,
          version: "1",
          content: "VERSION ONE",
          contentHash: "h1",
          activatedAt: new Date("2026-08-13T10:00:00Z"),
          regressionPassReference: "gate:test",
        },
      });
      // Newer row, deprecated — the rolled-back version.
      await primary.promptFragmentVersion.create({
        data: {
          fragmentId: fragment.fragmentId,
          version: "2",
          content: "VERSION TWO",
          contentHash: "h2",
          activatedAt: new Date("2026-08-13T11:00:00Z"),
          deprecatedAt: new Date("2026-08-13T12:00:00Z"),
          regressionPassReference: "gate:test",
        },
      });

      const resolved = await createFragmentResolver(primary).resolve([key]);
      assert.equal(resolved[0]?.content, "VERSION ONE");
      assert.equal(resolved[0]?.fragmentVersionId, v1.fragmentVersionId);

      await primary.promptFragmentVersion.deleteMany({
        where: { fragmentId: fragment.fragmentId },
      });
      await primary.promptFragment.delete({
        where: { fragmentId: fragment.fragmentId },
      });
    } finally {
      await close();
    }
  },
);

test(
  "an unresolvable fragment halts rather than composing from nothing",
  { skip },
  async () => {
    const { primary, close } = clients();
    try {
      await assert.rejects(
        createFragmentResolver(primary).resolve(["stage.does_not_exist"]),
        (error: Error) => /stage\.does_not_exist/.test(error.message),
      );
    } finally {
      await close();
    }
  },
);

// --- end to end ----------------------------------------------------------

test(
  "stages 1-3 execute end to end on real infrastructure",
  { skip },
  async () => {
    const { primary, trace, close } = clients();
    const seed = await seedAnalysis(primary);
    try {
      const resolver = createFragmentResolver(primary);
      const pipeline = createPipeline({
        invoker: createProviderInvoker({
          adapter: await primedAdapter(resolver),
          rate,
          recorder: { record: () => Promise.resolve() },
          sleep: () => Promise.resolve(),
          random: () => 0,
        }),
        resolver,
        traceSink: createStageTraceSink(trace, testCipher),
        fragmentUsageSink: createFragmentUsageSink(primary),
        modelVersionId: seed.modelVersionId,
        modelKey: seed.modelKey,
      });

      const result = await pipeline.run({
        analysisId: seed.analysisId,
        text: INPUT,
      });

      assert.equal(
        result.classification.determinedType,
        "business_requirement",
      );
      assert.equal(result.intent?.primaryObjective.provenance, "stated");
      assert.equal(result.context?.elements.length, 1);
      assert.equal(result.haltedAt, undefined);

      // FRAGMENT_USAGE persisted, per stage, in composition order (`AI-013`).
      const usages = await primary.fragmentUsage.findMany({
        where: { analysisId: seed.analysisId },
        orderBy: [{ stage: "asc" }, { ordinal: "asc" }],
      });
      assert.equal(
        usages.length,
        // D-78: the requirement path's Stage 9 platform generator composes six too.
        5 + 6 + 6 + 6 + 6 + 6 + 6 + 6 + 6 + 6,
        "stage 1 has no type modifier yet",
      );
      const stage1 = usages.filter((u) => u.stage === "input_classification");
      assert.deepEqual(
        stage1.map((u) => u.ordinal),
        [0, 1, 2, 3, 4],
      );

      // Every recorded version id resolves to a real published row.
      const versionIds = [...new Set(usages.map((u) => u.fragmentVersionId))];
      const found = await primary.promptFragmentVersion.findMany({
        where: { fragmentVersionId: { in: versionIds } },
        select: { fragmentVersionId: true },
      });
      assert.equal(found.length, versionIds.length, "no dangling composition");

      // STAGE_TRACE persisted to the separate trace store.
      const traces = await trace.stageTrace.findMany({
        where: { analysisId: seed.analysisId },
        orderBy: { stageNumber: "asc" },
      });
      assert.deepEqual(
        traces.map((t) => t.stageNumber),
        [1, 2, 3, 5, 6, 8, 9, 9, 9, 9, 9, 9, 10, 11, 12],
      );
      assert.deepEqual(
        traces.map((t) => t.outcome),
        // Stage 9 renders the requirement path's artifacts since D-73; Stage
        // 10 (response validation) and Stage 12 (assembly) are traced on every
        // response since D-72. All three are deterministic here; so is the
        // D-90 Stage 8 plan.
        [
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
        ],
      );
      for (const row of traces) {
        assert.equal(row.failureReason, null);
        assert.notEqual(row.structuredOutput, null);
        assert.ok(row.durationMs >= 0);
      }

      await trace.stageTrace.deleteMany({
        where: { analysisId: seed.analysisId },
      });
    } finally {
      await seed.cleanup();
      await close();
    }
  },
);

test("a failing stage persists a failure trace", { skip }, async () => {
  const { primary, trace, close } = clients();
  const seed = await seedAnalysis(primary);
  try {
    const resolver = createFragmentResolver(primary);
    const pipeline = createPipeline({
      invoker: createProviderInvoker({
        adapter: await primedAdapter(resolver, { intent: "not json" }),
        rate,
        recorder: { record: () => Promise.resolve() },
        sleep: () => Promise.resolve(),
        random: () => 0,
      }),
      resolver,
      traceSink: createStageTraceSink(trace, testCipher),
      fragmentUsageSink: createFragmentUsageSink(primary),
      modelVersionId: seed.modelVersionId,
      modelKey: seed.modelKey,
    });

    await assert.rejects(
      pipeline.run({ analysisId: seed.analysisId, text: INPUT }),
      StageError,
    );

    const traces = await trace.stageTrace.findMany({
      where: { analysisId: seed.analysisId },
      orderBy: { stageNumber: "asc" },
    });
    assert.equal(traces.length, 2);
    assert.equal(traces[1]?.outcome, "failure");
    assert.match(traces[1]?.failureReason ?? "", /JSON/);
    // Retained through the real trace store, not just in memory: the failure
    // is diagnosable without paying to re-run the provider (`DB §8.2`,
    // `FR-100`).
    //
    // ⚠️ SEALED AT REST ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §2).
    // Both halves are asserted deliberately: that the column does **not**
    // contain readable content, and that it opens to exactly what was written.
    // Checking only the second would pass just as well if encryption were
    // silently disabled.
    const storedOutput = traces[1]?.structuredOutput;
    assert.equal(
      typeof storedOutput,
      "string",
      "structured_output should hold a sealed envelope, not a plain object",
    );
    assert.ok(
      !JSON.stringify(storedOutput).includes("not json"),
      "the plaintext is readable in the column — it was not sealed",
    );
    assert.equal(
      (
        JSON.parse(testCipher.open(storedOutput as string)) as {
          unparsed?: string;
        }
      ).unparsed,
      "not json",
    );

    await trace.stageTrace.deleteMany({
      where: { analysisId: seed.analysisId },
    });
  } finally {
    await seed.cleanup();
    await close();
  }
});

test("a trace-store outage does not fail the analysis", { skip }, async () => {
  // `DB §6.2` / `SA §3.10`: trace writes are non-blocking and a trace failure
  // never fails an analysis. Simulated by pointing the sink at a closed client.
  const { primary, close } = clients();
  const seed = await seedAnalysis(primary);
  const brokenTracePool = new pg.Pool({
    connectionString: "postgresql://nobody:nobody@127.0.0.1:1/nothing",
    connectionTimeoutMillis: 500,
  });
  const brokenTrace = new TracePrismaClient({
    adapter: new PrismaPg(brokenTracePool),
  });

  const seen: unknown[] = [];
  try {
    const resolver = createFragmentResolver(primary);
    const pipeline = createPipeline({
      invoker: createProviderInvoker({
        adapter: await primedAdapter(resolver),
        rate,
        recorder: { record: () => Promise.resolve() },
        sleep: () => Promise.resolve(),
        random: () => 0,
      }),
      resolver,
      traceSink: createStageTraceSink(brokenTrace, testCipher),
      fragmentUsageSink: createFragmentUsageSink(primary),
      modelVersionId: seed.modelVersionId,
      modelKey: seed.modelKey,
      onRecordError: (error) => seen.push(error),
    });

    const result = await pipeline.run({
      analysisId: seed.analysisId,
      text: INPUT,
    });

    assert.equal(
      result.classification.determinedType,
      "business_requirement",
      "the analysis completed despite the trace store being unreachable",
    );
    assert.equal(result.context?.sufficiency, "sufficient");
    // Stages 1-3, the deterministic Stage 5 (`docs/12` D-35), Stage 6, the
    // deterministic Stage 8 (D-90), six Stage 9 generators, and the
    // deterministic Stages 10, 11 and 12.
    assert.equal(seen.length, 15, "each failed trace write is surfaced");

    // The durable record still landed: fragment usage is primary-store data.
    const usages = await primary.fragmentUsage.count({
      where: { analysisId: seed.analysisId },
    });
    // D-78: five composing stages of six fragments, less the type modifier at Stage 1.
    assert.equal(usages, 59);
  } finally {
    await brokenTracePool.end().catch(() => undefined);
    await seed.cleanup();
    await close();
  }
});

// --- the vertical slice, persisted ---------------------------------------

test(
  "business requirement to grounded architecture, persisted end to end",
  { skip },
  async () => {
    // The Sprint 1 slice: input → classification → intent → context →
    // architecture, with every component traceable to a stored context
    // element (`FR-030`, `FR-103`).
    const { primary, trace, close } = clients();
    const seed = await seedAnalysis(primary);
    try {
      const resolver = createFragmentResolver(primary);
      const pipeline = createPipeline({
        invoker: createProviderInvoker({
          adapter: await primedAdapter(resolver),
          rate,
          // The production recorder against the real trace store: this is the
          // path a real run takes (`DB §4.7`, `FR-093`, `NFR-083`).
          recorder: createProviderInvocationRecorder(trace),
          sleep: () => Promise.resolve(),
          random: () => 0,
        }),
        resolver,
        traceSink: createStageTraceSink(trace, testCipher),
        fragmentUsageSink: createFragmentUsageSink(primary),
        modelVersionId: seed.modelVersionId,
        modelKey: seed.modelKey,
        resultSink: createStageResultSink(primary),
      });

      const result = await pipeline.run({
        analysisId: seed.analysisId,
        text: INPUT,
      });
      assert.ok(result.architecture);
      // Nothing is persisted here: the pipeline committed each stage as it
      // completed (`DB §6.2`). The assertions below read what it wrote.

      // Analysis domain (`DB §4.2`).
      const classification = await primary.classification.findUnique({
        where: { analysisId: seed.analysisId },
      });
      assert.equal(classification?.determinedType, "business_requirement");
      assert.equal(classification?.wasLowConfidence, false);

      // `ANALYSIS.sufficiency_level` — "Written at Stage 3 (`AI §5.4`)".
      const analysis = await primary.analysis.findUnique({
        where: { analysisId: seed.analysisId },
      });
      assert.equal(analysis?.sufficiencyLevel, "sufficient");

      const elements = await primary.contextElement.findMany({
        where: { analysisId: seed.analysisId },
      });
      assert.equal(elements.length, 1);
      assert.equal(elements[0]?.provenance, "stated");
      assert.equal(elements[0]?.sourceSpanStart, 0);

      // Reasoning domain (`DB §4.3`).
      const model = await primary.architectureModel.findUnique({
        where: { analysisId: seed.analysisId },
        include: { components: true },
      });
      assert.ok(model, "an ARCHITECTURE_MODEL row exists");
      assert.equal(model.components.length, 1);

      const component = model.components[0];
      assert.ok(component);
      assert.equal(component.name, "Invoice Ingestion");
      assert.equal(component.externalSystem, "Xero");
      assert.equal(component.integrationDirection, "outbound");
      assert.ok(component.failureHandling.length > 0);

      // FR-030 traceability, stored and queryable.
      const references = await primary.contextReference.findMany({
        where: {
          referencingType: "architecture_component",
          referencingId: component.componentId,
        },
      });
      assert.equal(
        references.length,
        1,
        "every component carries at least one context reference (FR-030)",
      );
      assert.equal(
        references[0]?.contextElementId,
        elements[0]?.contextElementId,
        "the reference resolves to the stored context element it was grounded in",
      );

      // Trace store (`DB §4.7`) — one PROVIDER_INVOCATION row per provider
      // call, each resolving to the stage trace that made it. The linkage is
      // by identifier with no foreign key (`docs/12` D-9), so it is asserted
      // rather than assumed.
      const stageTraces = await trace.stageTrace.findMany({
        where: { analysisId: seed.analysisId },
      });
      const stageTraceIds = stageTraces.map((t) => t.stageTraceId);
      const invocations = await trace.providerInvocation.findMany({
        where: { stageTraceId: { in: stageTraceIds } },
      });
      // Not one per stage trace: Stage 5 is deterministic (`AI` App. A,
      // `docs/12` D-35) and records a trace without reaching a provider, so a
      // one-to-one assertion would now require it to have invented a call;
      // Stages 10 and 12 (D-72) are deterministic for the same reason, and
      // Stage 9 on this path renders rather than generates (D-73).
      // D-78: Stage 9 on this path is the platform generator, a provider call.
      // D-90: Stage 8, the plan by judgement, is deterministic too.
      const DETERMINISTIC = new Set([5, 8, 10, 11, 12]);
      const providerTraces = stageTraces.filter(
        (t) => !DETERMINISTIC.has(t.stageNumber),
      );
      assert.equal(
        invocations.length,
        providerTraces.length,
        "every stage that called a provider recorded its invocation",
      );
      assert.ok(
        stageTraces.some((t) => t.stageNumber === 5),
        "the deterministic stage is still traced (AP-8, FR-100)",
      );
      for (const invocation of invocations) {
        assert.equal(invocation.modelVersionId, seed.modelVersionId);
        assert.equal(invocation.outcome, "success");
        assert.equal(invocation.attemptNumber, 1);
        assert.ok(invocation.inputTokens > 0, "token counts are accounted");
        assert.ok(Number(invocation.estimatedCost) > 0, "cost is accounted");
      }

      await trace.providerInvocation.deleteMany({
        where: { stageTraceId: { in: stageTraceIds } },
      });
      await trace.stageTrace.deleteMany({
        where: { analysisId: seed.analysisId },
      });
    } finally {
      await seed.cleanup();
      await close();
    }
  },
);

// --- progressive persistence (DB §6.2, FR-091) ---------------------------

/** Builds a pipeline wired for progressive persistence against real Postgres. */
const persistingPipeline = async (
  primary: PrismaClient,
  trace: TracePrismaClient,
  seed: { analysisId: string; modelVersionId: string; modelKey: string },
  overrides: Partial<typeof OUTPUTS> = {},
) => {
  const resolver = createFragmentResolver(primary);
  return createPipeline({
    invoker: createProviderInvoker({
      adapter: await primedAdapter(resolver, overrides),
      rate,
      recorder: { record: () => Promise.resolve() },
      sleep: () => Promise.resolve(),
      random: () => 0,
    }),
    resolver,
    traceSink: createStageTraceSink(trace, testCipher),
    fragmentUsageSink: createFragmentUsageSink(primary),
    modelVersionId: seed.modelVersionId,
    modelKey: seed.modelKey,
    resultSink: createStageResultSink(primary),
  });
};

const BAD_ARCHITECTURE = JSON.stringify({
  architecture_summary: "x",
  components: [],
});

const countsFor = async (primary: PrismaClient, analysisId: string) => ({
  classification: await primary.classification.count({ where: { analysisId } }),
  intent: await primary.intentRecord.count({ where: { analysisId } }),
  contextElements: await primary.contextElement.count({
    where: { analysisId },
  }),
  architecture: await primary.architectureModel.count({
    where: { analysisId },
  }),
});

test(
  "(1) Stage 1-3 results survive a later Stage 6 failure",
  { skip },
  async () => {
    // The first real run cost exactly this: seconds of correct, paid
    // classification, intent and context extraction discarded because Stage 6
    // failed afterwards. `DB §6.2` requires records "written as stages
    // complete, not batched at the end"; `FR-091` requires partial results.
    const { primary, trace, close } = clients();
    const seed = await seedAnalysis(primary);
    try {
      const pipeline = await persistingPipeline(primary, trace, seed, {
        architecture: BAD_ARCHITECTURE,
      });

      await assert.rejects(
        pipeline.run({ analysisId: seed.analysisId, text: INPUT }),
        (error: unknown) =>
          error instanceof StageError && error.stageNumber === 6,
      );

      const counts = await countsFor(primary, seed.analysisId);
      assert.equal(counts.classification, 1, "Stage 1 survived");
      assert.equal(counts.intent, 1, "Stage 2 survived");
      assert.equal(counts.contextElements, 1, "Stage 3 survived");
      assert.equal(counts.architecture, 0, "Stage 6 committed nothing");

      // The surviving records are complete, not half-written.
      const element = await primary.contextElement.findFirst({
        where: { analysisId: seed.analysisId },
      });
      assert.equal(element?.provenance, "stated");
      assert.equal(
        INPUT.slice(element?.sourceSpanStart ?? 0, element?.sourceSpanEnd ?? 0),
        "Invoices arrive by email",
        "provenance survived intact, span and all",
      );

      await trace.stageTrace.deleteMany({
        where: { analysisId: seed.analysisId },
      });
    } finally {
      await seed.cleanup();
      await close();
    }
  },
);

test(
  "(2) a complete run still persists exactly as before",
  { skip },
  async () => {
    const { primary, trace, close } = clients();
    const seed = await seedAnalysis(primary);
    try {
      const pipeline = await persistingPipeline(primary, trace, seed);
      const result = await pipeline.run({
        analysisId: seed.analysisId,
        text: INPUT,
      });
      assert.ok(result.architecture);

      assert.deepEqual(await countsFor(primary, seed.analysisId), {
        classification: 1,
        intent: 1,
        contextElements: 1,
        architecture: 1,
      });

      // Stage 6's FK dependency still holds: its references resolve to context
      // elements Stage 3 committed in an earlier, separate transaction.
      const model = await primary.architectureModel.findUnique({
        where: { analysisId: seed.analysisId },
        include: { components: true },
      });
      const component = model?.components[0];
      assert.ok(component);
      const references = await primary.contextReference.findMany({
        where: {
          referencingType: "architecture_component",
          referencingId: component.componentId,
        },
      });
      assert.equal(references.length, 1);
      const element = await primary.contextElement.findFirst({
        where: { analysisId: seed.analysisId },
      });
      assert.equal(
        references[0]?.contextElementId,
        element?.contextElementId,
        "the reference resolves across the transaction boundary",
      );

      await trace.stageTrace.deleteMany({
        where: { analysisId: seed.analysisId },
      });
    } finally {
      await seed.cleanup();
      await close();
    }
  },
);

test("(3) a Stage 1 failure creates no partial records", { skip }, async () => {
  const { primary, trace, close } = clients();
  const seed = await seedAnalysis(primary);
  try {
    const pipeline = await persistingPipeline(primary, trace, seed, {
      classification: "not json at all",
    });

    await assert.rejects(
      pipeline.run({ analysisId: seed.analysisId, text: INPUT }),
      (error: unknown) =>
        error instanceof StageError && error.stageNumber === 1,
    );

    assert.deepEqual(await countsFor(primary, seed.analysisId), {
      classification: 0,
      intent: 0,
      contextElements: 0,
      architecture: 0,
    });

    await trace.stageTrace.deleteMany({
      where: { analysisId: seed.analysisId },
    });
  } finally {
    await seed.cleanup();
    await close();
  }
});

test(
  "(4) the trace store and D-20 output retention are untouched",
  { skip },
  async () => {
    const { primary, trace, close } = clients();
    const seed = await seedAnalysis(primary);
    try {
      const pipeline = await persistingPipeline(primary, trace, seed, {
        architecture: BAD_ARCHITECTURE,
      });
      await assert.rejects(
        pipeline.run({ analysisId: seed.analysisId, text: INPUT }),
      );

      // Traces still land in the separate database, all five stages.
      const traces = await trace.stageTrace.findMany({
        where: { analysisId: seed.analysisId },
        orderBy: { stageNumber: "asc" },
      });
      assert.deepEqual(
        traces.map((t) => t.stageNumber),
        [1, 2, 3, 5, 6],
      );
      assert.deepEqual(
        traces.map((t) => t.outcome),
        // Stage 5 plans successfully; Stage 6 is the one that fails.
        ["success", "success", "success", "success", "failure"],
      );

      // D-20: the failed stage still retains what the provider returned.
      // Index 4, not 3 — Stage 5 now sits between context and architecture.
      //
      // Sealed at rest, and recoverable through the cipher
      // ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §2). Encryption
      // must not cost the diagnosability `DB §8.2` and `FR-100` are here for:
      // a failure nobody can read is a failure nobody can fix without paying
      // to reproduce it.
      const retained = traces[4]?.structuredOutput;
      assert.ok(
        !JSON.stringify(retained).includes(BAD_ARCHITECTURE),
        "the provider response is readable in the column — it was not sealed",
      );
      assert.equal(
        (
          JSON.parse(testCipher.open(retained as string)) as {
            unparsed?: string;
          }
        ).unparsed,
        BAD_ARCHITECTURE,
        "the raw response is still recoverable (DB §8.2, FR-100)",
      );
      assert.ok(
        !/sk-|anthropic|claude/i.test(traces[3]?.failureReason ?? ""),
        "AI-006 scrubbing intact",
      );

      // No foreign key crosses the store boundary (`DB §1.4`): each store holds
      // its own view of the same run, linked by identifier only.
      assert.equal(
        (await countsFor(primary, seed.analysisId)).classification,
        1,
        "the primary store kept its committed stages independently",
      );

      await trace.stageTrace.deleteMany({
        where: { analysisId: seed.analysisId },
      });
    } finally {
      await seed.cleanup();
      await close();
    }
  },
);
