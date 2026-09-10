/**
 * Integration — the Stage 1-3 pipeline (`FR-010`, `FR-100`, `AI-013`).
 *
 * Runs the real pipeline against the real provider abstraction, using the
 * replay adapter so the whole thing is offline and deterministic: no
 * credentials, no network, no database, no wall clock.
 *
 * The point of running it through *both* adapters is `AI-005`'s claim in
 * reverse — reasoning code that behaves identically regardless of provider.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createProviderInvoker } from "../../src/provider/invoke.js";
import type { ProviderInvocationRecord } from "../../src/provider/invoke.js";
import type { TokenRate } from "../../src/provider/cost.js";
import { createReplayProvider } from "../../src/provider/adapters/replay.js";
import { createStubProvider } from "../../src/provider/adapters/stub.js";
import { replayKeyFor } from "../../src/provider/adapters/replay.js";
import type {
  CapabilityRequest,
  ProviderAdapter,
} from "../../src/provider/capability.js";
import {
  architectureHandoffView,
  contextHandoffView,
  createPipeline,
  stageHandoff,
  stageProviderInputs,
} from "../../src/nie/pipeline.js";
import { parseClassification } from "../../src/nie/stages/classification.js";
import { parseIntent } from "../../src/nie/stages/intent.js";
import { parseContext } from "../../src/nie/stages/context-extraction.js";
import { parseArchitecture } from "../../src/nie/stages/architecture-analysis.js";
import { StageError } from "../../src/nie/contracts.js";
import { STAGES } from "../../src/nie/stages.js";
import {
  FOUNDATION_FRAGMENT_KEYS,
  composePrompt,
} from "../../src/nie/prompt.js";
import type {
  FragmentUsageRecord,
  ResolvedFragment,
  StageTraceRecord,
} from "../../src/nie/ports.js";

// Over the D-90 minimal band (200 characters): these tests exercise the
// full requirement path, and a two-line input would now run at minimal depth.
const INPUT =
  "Invoices arrive by email and are keyed into Xero by hand. Roughly 450 per month. " +
  "Approvals go by email to the department head and take five to nine days, so early-payment discounts are missed; we would like the routing and the reminders handled automatically.";
const ANALYSIS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const rate: TokenRate = {
  inputUsdPerMillionTokens: "3.00",
  outputUsdPerMillionTokens: "15.00",
};

/** Resolves any requested fragment key to deterministic content. */
const resolver = {
  resolve: (keys: readonly string[]): Promise<readonly ResolvedFragment[]> =>
    Promise.resolve(
      keys.map((fragmentKey, i) => ({
        fragmentKey,
        fragmentVersionId: `ver-${fragmentKey}`,
        version: `1.${String(i)}`,
        content: `[${fragmentKey}]`,
      })),
    ),
};

const CLASSIFICATION_OUTPUT = JSON.stringify({
  determined_type: "business_requirement",
  confidence: 0.91,
  candidate_types: ["business_requirement"],
});

const INTENT_OUTPUT = JSON.stringify({
  primary_objective: {
    content: "Automate invoice capture and approval",
    provenance: "stated",
  },
  secondary_objectives: [
    { content: "Recover early-payment discounts", provenance: "inferred" },
  ],
  inferred_scope: "Accounts payable",
});

const ARCHITECTURE_OUTPUT = JSON.stringify({
  summary: "Automated invoice capture and approval routing",
  data_flow_description: "Email \u2192 ingestion \u2192 approval \u2192 Xero",
  // D-78: the context's one unknown (index 1, approval headcount) is disposed of.
  unknown_disposition: [
    {
      context_index: 1,
      disposition: "deferred",
      statement:
        "Routing is parameterised per approver; the headcount is set when known",
    },
  ],
  components: [
    {
      name: "Invoice Ingestion",
      responsibility: "Capture inbound invoice attachments",
      inputs: "Email messages with attachments",
      outputs: "Normalised invoice records",
      failure_handling:
        "Retry with backoff; quarantine unparseable attachments",
      grounded_in_context_indices: [0],
    },
  ],
});

const CONTEXT_OUTPUT = JSON.stringify({
  elements: [
    {
      id: "e1",
      content: "Invoices arrive by email",
      category: "environment",
      provenance: "stated",
      source_quote: "Invoices arrive by email",
      specificity_score: 0.9,
    },
    {
      id: "e2",
      content: "Approval headcount",
      category: "dependency",
      provenance: "unknown",
      resolution_hint: "Ask how many approvers exist per department",
      specificity_score: 0.2,
    },
  ],
  sufficiency: "sufficient",
});

/**
 * Builds a replay adapter primed for all three stages, by composing the same
 * prompts the pipeline will compose and keying fixtures by the resulting
 * request. Nothing is hard-coded: if composition changes, the keys follow.
 */
const primedAdapter = async (
  outputs: {
    readonly classification?: string;
    readonly intent?: string;
    readonly context?: string;
    readonly architecture?: string;
  } = {},
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
  const classificationOutput = outputs.classification ?? CLASSIFICATION_OUTPUT;
  await add("input_classification", INPUT, classificationOutput);

  let classification;
  try {
    classification = parseClassification(classificationOutput);
  } catch {
    // A deliberately malformed Stage 1 fixture: nothing downstream will run.
    return createReplayProvider({ fixtures, lowVarianceSampling: true });
  }

  const intentOutput = outputs.intent ?? INTENT_OUTPUT;
  await add(
    "intent_detection",
    stageHandoff({ input_text: INPUT, classification }),
    intentOutput,
    "business_requirement",
  );

  let intent;
  try {
    // D-90: a declined design is verified against the input.
    intent = parseIntent(intentOutput, INPUT);
  } catch {
    return createReplayProvider({ fixtures, lowVarianceSampling: true });
  }

  const contextOutput = outputs.context ?? CONTEXT_OUTPUT;
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
    // Stage 6 is shown the context set with each element's `index` label, so
    // grounding is copied rather than counted (`docs/12` D-19 principle).
    stageHandoff({
      classification,
      intent,
      context: contextHandoffView(context),
    }),
    outputs.architecture ?? ARCHITECTURE_OUTPUT,
    "business_requirement",
  );

  // D-78: the requirement path's Stage 9 generator is keyed on the parsed
  // architecture, the way the pipeline keys it.
  try {
    const architecture = parseArchitecture(
      outputs.architecture ?? ARCHITECTURE_OUTPUT,
      context,
    );
    const requirementHandoff = stageHandoff({
      context: contextHandoffView(context),
      architecture: architectureHandoffView(architecture),
    });
    await add(
      "platform_recommendation",
      requirementHandoff,
      PLATFORM_OUTPUT,
      "business_requirement",
    );
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
        integrations: [],
        no_integrations_statement:
          "Every component reads and writes its own store; nothing external is touched",
        knowledge_currency_note:
          "Platform capabilities, limits and pricing change; verify before building.",
      }),
      "business_requirement",
    );
    // D-79: the risk register, the path's second generator, same handoff.
    await add(
      "risk_assessment",
      requirementHandoff,
      JSON.stringify({
        risks: [
          {
            component: "Invoice Ingestion",
            description:
              "An unreadable attachment is quarantined and the invoice waits unnoticed",
            severity: 3,
            likelihood: 3,
            mitigation: "Alert finance on every quarantine",
          },
        ],
        no_risks_statement: null,
      }),
      "business_requirement",
    );
  } catch {
    // An architecture fixture that does not parse describes a run that stops
    // at Stage 6; there is no Stage 9 call to key.
  }

  return createReplayProvider({ fixtures, lowVarianceSampling: true });
};

/** D-78: the requirement path's Stage 9 answer, grounded in the fixture above. */
const PLATFORM_OUTPUT = JSON.stringify({
  criteria_applied: [
    {
      criterion: "Invoices arrive by email, so capture starts from the mailbox",
      context_index: 0,
      component: null,
    },
  ],
  recommended_platform: "n8n",
  also_required: [],
  rationale: "A workflow platform with a mailbox trigger covers the design.",
  alternatives_rejected: [
    {
      platform: "Custom code",
      rejection_reason: "Nothing in the context names a developer to own it.",
    },
  ],
  fit: [
    {
      component: "Invoice Ingestion",
      how: "IMAP trigger with attachment extraction",
    },
  ],
  knowledge_currency_note:
    "Platform capabilities and pricing change; verify before committing.",
});

const harness = async (outputs?: Parameters<typeof primedAdapter>[0]) => {
  const traces: StageTraceRecord[] = [];
  const usages: FragmentUsageRecord[] = [];
  const invocations: ProviderInvocationRecord[] = [];
  let tick = 0;

  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter: await primedAdapter(outputs),
      rate,
      recorder: {
        record: (r) => {
          invocations.push(r);
          return Promise.resolve();
        },
      },
      sleep: () => Promise.resolve(),
      random: () => 0,
      now: () => 0,
    }),
    resolver,
    traceSink: {
      record: (t) => {
        traces.push(t);
        return Promise.resolve();
      },
    },
    fragmentUsageSink: {
      record: (u) => {
        usages.push(...u);
        return Promise.resolve();
      },
    },
    modelVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    modelKey: "replay-model",
    now: () => new Date(1_000 + tick++ * 5),
    newId: () => `trace-${String(traces.length + 1)}`,
  });

  return { pipeline, traces, usages, invocations };
};

// --- the happy path ------------------------------------------------------

test("runs stages 1-3 in order and produces typed handoffs", async () => {
  const { pipeline, traces } = await harness();
  const result = await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  assert.equal(result.classification.determinedType, "business_requirement");
  assert.equal(result.classification.wasLowConfidence, false);
  assert.equal(
    result.intent?.primaryObjective.content,
    "Automate invoice capture and approval",
  );
  assert.equal(result.context?.elements.length, 2);
  assert.equal(result.haltedAt, undefined);

  // `FR-010`: fixed order, no stage bypassed.
  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    // D-72: Stages 10 and 12 trace on every response.
    [1, 2, 3, 5, 6, 8, 9, 9, 9, 9, 9, 9, 10, 11, 12],
  );
  assert.deepEqual(
    traces.map((t) => t.stageKey),
    [
      "input_classification",
      "intent_detection",
      "context_extraction",
      "reasoning_planning",
      "architecture_analysis",
      // D-90: Stage 8, the plan by judgement, traced on this path too.
      "artifact_planning",
      // D-78: Stage 9 on this path is the platform generator, keyed by its
      // generator like the job path's; the rendered artifacts attach to it.
      "platform_recommendation",
      // D-79: the risk register, the path's second generator.
      "risk_assessment",
      // D-80: the complexity assessment, its third.
      "complexity_assessment",
      // D-82: the implementation roadmap, its fourth.
      "implementation_roadmap",
      // D-84/D-83: the integration requirements and the edge cases.
      "integration_requirements",
      "edge_case_analysis",
      "response_validation",
      // D-86: Stage 11 between them.
      "confidence_evaluation",
      "response_assembly",
    ],
  );
  // The vertical slice: a business requirement reaches a grounded architecture.
  assert.equal(result.architecture?.components.length, 1);
  assert.deepEqual(
    result.architecture?.components[0]?.groundedInContextIndices,
    [0],
  );
});

test("every stage emits a trace event (AP-8, FR-100)", async () => {
  const { pipeline, traces } = await harness();
  await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  // 1-2-3 then Stage 5 (deterministic planning, `docs/12` D-35) then Stage 6.
  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    // D-72: Stages 10 and 12 trace on every response.
    [1, 2, 3, 5, 6, 8, 9, 9, 9, 9, 9, 9, 10, 11, 12],
  );
  for (const trace of traces) {
    assert.equal(trace.analysisId, ANALYSIS_ID);
    assert.equal(trace.outcome, "success");
    assert.equal(trace.failureReason, null);
    assert.ok(trace.structuredOutput !== null, "the handoff is captured");
    assert.ok(trace.durationMs >= 0);
    assert.ok(trace.startedAt instanceof Date);
  }
});

test("a stage receives the prior stage's structured output, not raw text", async () => {
  const { pipeline, traces } = await harness();
  await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  const intentInput = traces[1]?.structuredInput as {
    classification?: { determinedType?: string };
  };
  assert.equal(
    intentInput.classification?.determinedType,
    "business_requirement",
    "FR-010: each stage receives the prior stage's structured output",
  );

  const contextInput = traces[2]?.structuredInput as {
    intent?: { primaryObjective?: { provenance?: string } };
  };
  assert.equal(contextInput.intent?.primaryObjective?.provenance, "stated");
});

test("fragment versions are resolved at runtime and recorded per run (AI-013)", async () => {
  const { pipeline, usages } = await harness();
  await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  // Foundation fragments plus one stage fragment for stage 1; stages 2 and 3
  // add a type modifier once the classification is known.
  const stage1 = usages.filter((u) => u.stage === "input_classification");
  assert.equal(stage1.length, FOUNDATION_FRAGMENT_KEYS.length + 1);

  const stage3 = usages.filter((u) => u.stage === "context_extraction");
  assert.equal(stage3.length, FOUNDATION_FRAGMENT_KEYS.length + 2);
  const stage6 = usages.filter((u) => u.stage === "architecture_analysis");
  assert.equal(stage6.length, FOUNDATION_FRAGMENT_KEYS.length + 2);
  assert.ok(
    stage3.some((u) =>
      u.fragmentVersionId.includes("type.business_requirement"),
    ),
    "the type modifier follows the classification",
  );

  // Composition order is recorded, not just membership (`AI-013`).
  assert.deepEqual(
    stage1.map((u) => u.ordinal),
    [0, 1, 2, 3, 4],
  );
  for (const usage of usages) {
    assert.equal(usage.analysisId, ANALYSIS_ID);
  }
});

// --- halting paths -------------------------------------------------------

test("unsupported input halts after stage 1 with no reasoning performed", async () => {
  const { pipeline, traces } = await harness({
    classification: JSON.stringify({
      determined_type: "unsupported",
      confidence: 0.97,
      candidate_types: [],
    }),
  });

  const result = await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  assert.equal(result.classification.determinedType, "unsupported");
  assert.equal(result.haltedAt?.stageNumber, 1);
  assert.match(result.haltedAt?.reason ?? "", /FR-092/);
  assert.equal(result.intent, undefined);
  // D-72: Stages 10 and 12 trace on every response, a refusal included;
  // the reasoning stages are what must be absent.
  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    [1, 10, 11, 12],
    "stages 2 and 3 never ran",
  );
});

test("insufficient context halts before reasoning but keeps what was extracted", async () => {
  const { pipeline, traces } = await harness({
    context: JSON.stringify({
      elements: [
        {
          id: "e1",
          content: "What the process does",
          category: "objective",
          provenance: "unknown",
          resolution_hint: "Describe the current steps",
          specificity_score: 0.1,
        },
      ],
      sufficiency: "insufficient",
    }),
  });

  const result = await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  assert.equal(result.haltedAt?.stageNumber, 3);
  assert.equal(result.context?.sufficiency, "insufficient");
  assert.equal(result.architecture, undefined, "Stage 6 never ran");
  assert.equal(
    result.context?.elements[0]?.resolutionHint,
    "Describe the current steps",
    "AI §5.4: the system states what would resolve it",
  );
  // D-72: plus Stages 10 and 12, which trace on every response.
  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    [1, 2, 3, 10, 11, 12],
    "all three stages ran and were traced",
  );
});

test("a failing stage still emits its trace, with the failure recorded", async () => {
  // A failed stage is exactly the one whose trace matters most (`FR-093`).
  const { pipeline, traces } = await harness({
    intent: "this is not json",
  });

  await assert.rejects(
    pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT }),
    StageError,
  );

  assert.equal(traces.length, 2);
  const failed = traces[1];
  assert.equal(failed?.stageNumber, 2);
  assert.equal(failed?.outcome, "failure");
  assert.match(failed?.failureReason ?? "", /JSON/);
  // The raw response is retained so the failure is diagnosable without
  // re-running the provider (`DB §8.2`, `FR-100`).
  assert.equal(
    (failed?.structuredOutput as { unparsed?: string })?.unparsed,
    "this is not json",
  );
});

test("a trace-sink failure never fails the analysis (DB §6.2)", async () => {
  const seen: unknown[] = [];
  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter: await primedAdapter(),
      rate,
      recorder: { record: () => Promise.resolve() },
      sleep: () => Promise.resolve(),
      random: () => 0,
      now: () => 0,
    }),
    resolver,
    traceSink: { record: () => Promise.reject(new Error("trace store down")) },
    fragmentUsageSink: {
      record: () => Promise.reject(new Error("usage write failed")),
    },
    modelVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    modelKey: "replay-model",
    onRecordError: (error) => seen.push(error),
  });

  const result = await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });
  assert.equal(result.classification.determinedType, "business_requirement");
  assert.ok(seen.length >= 2, "failures are surfaced, not silently dropped");
});

// --- provider independence ----------------------------------------------

test("cost accounting flows through the shared provider path per stage", async () => {
  const { pipeline, invocations } = await harness();
  await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  // Stages 1, 2, 3, 6 and, since D-78, the requirement path's Stage 9
  // platform generator.
  assert.equal(invocations.length, 10, "one provider call per provider stage");
  for (const invocation of invocations) {
    assert.equal(invocation.outcome, "success");
    // 20 × $3/M + 30 × $15/M = 0.00006 + 0.00045
    assert.equal(invocation.estimatedCostUsd, "0.00051000");
  }
});

test("the pipeline is provider-neutral — a different adapter changes nothing structural", async () => {
  // The stub returns a synthetic digest, which is not parseable stage output.
  // The pipeline must fail as a *stage* failure — it must not special-case a
  // provider, and it must not surface provider identity.
  const traces: StageTraceRecord[] = [];
  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter: createStubProvider(),
      rate,
      recorder: { record: () => Promise.resolve() },
      sleep: () => Promise.resolve(),
      random: () => 0,
      now: () => 0,
    }),
    resolver,
    traceSink: {
      record: (t) => {
        traces.push(t);
        return Promise.resolve();
      },
    },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    modelKey: "stub-model",
  });

  await assert.rejects(
    pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT }),
    (error: unknown) => error instanceof StageError && error.stageNumber === 1,
  );

  const failure = traces[0]?.failureReason ?? "";
  assert.ok(
    !/stub|replay|provider/i.test(failure),
    `stage failure must not name a provider (AI-006, FR-093): "${failure}"`,
  );
});

// --- stage inventory (docs/12 D-7) --------------------------------------

test("the stage inventory is twelve stages, ten implemented", () => {
  assert.equal(STAGES.length, 12, "docs/12 D-7 — twelve, not six");
  // Stage 7 joined in Phase 2 (`docs/12` D-27); stages 8 and 9 in Phase 3A
  // (`docs/12` D-29), both on the job-description path. Stage 5 joined with
  // `docs/12` D-35, reduced: reasoning modules and depth only, no complexity
  // pre-assessment.
  assert.deepEqual(
    STAGES.filter((s) => s.implemented).map((s) => s.stageNumber),
    // D-72: 10 (response validation) and 12 (response assembly) landed;
    // 4 (knowledge assembly, D-15) and 11 (confidence, D-33) stay deferred.
    [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  assert.equal(
    STAGES.find((s) => s.stageNumber === 6)?.stageKey,
    "architecture_analysis",
    "stage 6 is Architecture Analysis, per AI Appendix A",
  );
  // Stage 9 produces the path artifacts (`AI` App. A); Stage 2 produces the
  // intent brief, rendered from its own record with no selection (D-66).
  assert.deepEqual(
    STAGES.filter((s) => s.producesArtifactTypes.length > 0).map(
      (s) => s.stageNumber,
    ),
    [2, 9],
  );
  assert.deepEqual(
    STAGES.find((s) => s.stageNumber === 2)?.producesArtifactTypes,
    ["intent_brief"],
  );
});

// --- Stage 6 regeneration (AI §3.2) --------------------------------------

test("a traceability failure earns exactly one regeneration, then fails", async () => {
  // `AI §3.2`: "Traceability verification failure triggers one regeneration;
  // persistent failure fails the stage rather than emitting an unjustifiable
  // design." The retry is recorded on the trace, not hidden.
  const ungrounded = JSON.stringify({
    summary: "s",
    data_flow_description: "d",
    components: [
      {
        name: "Orphan",
        responsibility: "r",
        inputs: "i",
        outputs: "o",
        failure_handling: "f",
        grounded_in_context_indices: [],
      },
    ],
  });

  const { pipeline, traces, invocations } = await harness({
    architecture: ungrounded,
  });

  await assert.rejects(
    pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT }),
    (error: unknown) => error instanceof StageError && error.stageNumber === 6,
  );

  const stage6 = traces.find((t) => t.stageNumber === 6);
  assert.equal(stage6?.outcome, "failure");
  assert.equal(stage6?.retryCount, 1, "one regeneration, not zero and not two");
  assert.match(stage6?.failureReason ?? "", /grounded in no context element/);

  // Two provider calls for stage 6; one each for stages 1-3.
  assert.equal(invocations.length, 5);
});

test("stages other than 6 are never regenerated (SA §11.3)", async () => {
  const { pipeline, traces, invocations } = await harness({
    intent: "not json",
  });
  await assert.rejects(pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT }));

  assert.equal(traces[1]?.retryCount, 0, "stage 2 is attempted once");
  assert.equal(invocations.length, 2);
});

test("a non-architecture path skips stage 6 rather than failing", async () => {
  // `AI §9.1` scopes the architecture to the requirement and assessment paths.
  const { pipeline, traces } = await harness({
    classification: JSON.stringify({
      determined_type: "job_description",
      confidence: 0.93,
      candidate_types: ["job_description"],
    }),
  });

  // Stages 2 and 3 compose a different type modifier, so they have no fixture
  // and the run fails there — which is itself the proof that classification
  // reached the composer. What matters here is that stage 6 was never reached.
  await assert.rejects(pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT }));
  assert.ok(
    !traces.some((t) => t.stageNumber === 6),
    "stage 6 must not run for a job description",
  );
});

// --- a failed stage is diagnosable from its trace (DB §8.2, FR-100) ------

test("a parse failure retains the raw provider response for reconstruction", async () => {
  // The gap this closes: the first real Stage 6 failure stored a null output,
  // so what the model actually returned could not be recovered without paying
  // to run it again. `DB §8.2` records structured output for "reasoning
  // reconstruction"; `FR-100` requires reconstruction "without re-running".
  const malformedArchitecture = JSON.stringify({
    // Valid JSON, wrong shape — exactly the real failure: no `summary`.
    architecture_summary: "Automated invoice capture",
    components: [],
  });

  const { pipeline, traces } = await harness({
    architecture: malformedArchitecture,
  });

  await assert.rejects(
    pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT }),
    StageError,
  );

  const stage6 = traces.find((t) => t.stageNumber === 6);
  assert.ok(stage6);
  assert.equal(stage6.outcome, "failure");
  assert.match(stage6.failureReason ?? "", /summary/);

  const retained = stage6.structuredOutput as { unparsed?: string } | null;
  assert.ok(retained, "the failed stage stores something");
  assert.equal(
    retained.unparsed,
    malformedArchitecture,
    "the exact provider response is recoverable, byte for byte",
  );
  // Reconstruction is real: the stored payload re-parses to what was returned.
  assert.deepEqual(JSON.parse(retained.unparsed as string), {
    architecture_summary: "Automated invoice capture",
    components: [],
  });
});

test("an unparseable, non-JSON response is retained verbatim", async () => {
  // The case where JSON.parse itself fails — prose instead of an object.
  const prose = "Here is the architecture you asked for:\n\n1. Ingest invoices";
  const { pipeline, traces } = await harness({ intent: prose });

  await assert.rejects(pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT }));

  const stage2 = traces.find((t) => t.stageNumber === 2);
  assert.equal(
    (stage2?.structuredOutput as { unparsed?: string })?.unparsed,
    prose,
  );
});

test("a successful stage still stores its parsed handoff, not a raw string", async () => {
  // The success shape is unchanged: `unparsed` is only ever a failure marker.
  const { pipeline, traces } = await harness();
  await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  for (const trace of traces) {
    assert.equal(trace.outcome, "success");
    assert.ok(
      !Object.prototype.hasOwnProperty.call(
        trace.structuredOutput as object,
        "unparsed",
      ),
      `stage ${String(trace.stageNumber)} must store its parsed output`,
    );
  }
  const classification = traces[0]?.structuredOutput as {
    determinedType?: string;
  };
  assert.equal(classification.determinedType, "business_requirement");
});

test("a provider failure stores no payload and leaks no provider detail", async () => {
  // Nothing was returned, so there is nothing to retain — and the scrubbed
  // `ProviderError` message is what reaches the trace (`AI-006`, `FR-093`).
  // A replay adapter with no recordings rejects every request as `persistent`.
  const traces: StageTraceRecord[] = [];
  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter: createReplayProvider(),
      rate,
      recorder: { record: () => Promise.resolve() },
      sleep: () => Promise.resolve(),
      random: () => 0,
      now: () => 0,
    }),
    resolver,
    traceSink: {
      record: (t2) => {
        traces.push(t2);
        return Promise.resolve();
      },
    },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    modelKey: "replay-model",
  });

  await assert.rejects(pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT }));

  const stage1 = traces[0];
  assert.ok(stage1);
  assert.equal(stage1.outcome, "failure");
  assert.equal(
    stage1.structuredOutput,
    null,
    "a provider that answered nothing leaves nothing to reconstruct",
  );
  assert.ok(
    !/sk-|api[_-]?key|anthropic|claude/i.test(stage1.failureReason ?? ""),
    "no credential or provider identity reaches the trace",
  );
});

// --- FR-010 / AI §3.2: stages receive their upstream handoff -------------

/**
 * Run `e8908bb0` failed because Stage 6's prompt said "you are given the
 * classification, the intent record, and the context set" while the request
 * carried only the raw requirement. The model produced all three itself, plus
 * three Sprint 2 artifacts — 7,417 output tokens, and `summary` nested one
 * level too deep.
 *
 * These tests assert what each stage is actually *sent*, by capturing the
 * requests at the provider boundary.
 */
const capturingAdapter = (
  responses: ReadonlyMap<string, string>,
): { adapter: ProviderAdapter; seen: CapabilityRequest[] } => {
  const seen: CapabilityRequest[] = [];
  return {
    seen,
    adapter: {
      capabilities: {
        structuredOutput: false,
        extendedContext: true,
        lowVarianceSampling: true,
        costLatencyTier: "capture",
      },
      invoke: (request) => {
        seen.push(request);
        const output = responses.get(request.task);
        if (output === undefined) {
          return Promise.reject(new Error(`no response for ${request.task}`));
        }
        return Promise.resolve({
          output,
          usage: { inputTokens: 10, outputTokens: 10, latencyMs: 1 },
          degradations: [],
        });
      },
    },
  };
};

const runCapturing = async () => {
  const { adapter, seen } = capturingAdapter(
    new Map([
      ["input_classification", CLASSIFICATION_OUTPUT],
      ["intent_detection", INTENT_OUTPUT],
      ["context_extraction", CONTEXT_OUTPUT],
      ["architecture_analysis", ARCHITECTURE_OUTPUT],
    ]),
  );

  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter,
      rate,
      recorder: { record: () => Promise.resolve() },
      sleep: () => Promise.resolve(),
      random: () => 0,
      now: () => 0,
    }),
    resolver,
    traceSink: { record: () => Promise.resolve() },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    modelKey: "capture-model",
  });

  await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });
  return new Map(seen.map((r) => [r.task, r]));
};

/** Parses the JSON handoff a stage was sent. */
const byStageInput = (
  byStage: ReadonlyMap<string, CapabilityRequest>,
  stageKey: string,
): Record<string, unknown> =>
  JSON.parse(byStage.get(stageKey)?.input ?? "{}") as Record<string, unknown>;

test("Stage 1 still receives the raw input text, unwrapped", async () => {
  const byStage = await runCapturing();
  assert.equal(
    byStage.get("input_classification")?.input,
    INPUT,
    "Stage 1 has no upstream stage; it reads the requirement itself",
  );
});

test("Stage 2 receives the input text plus the Stage 1 classification", async () => {
  // `AI §3.2` Stage 2 input: "Input text + classification".
  const sent = byStageInput(await runCapturing(), "intent_detection");
  assert.equal(sent["input_text"], INPUT);
  const classification = sent["classification"] as { determinedType?: string };
  assert.equal(classification.determinedType, "business_requirement");
});

test("Stage 3 receives the input text plus the Stage 2 intent", async () => {
  // `AI §3.2` Stage 3 input: "Input text + intent".
  const sent = byStageInput(await runCapturing(), "context_extraction");
  assert.equal(sent["input_text"], INPUT);
  const intent = sent["intent"] as {
    primaryObjective?: { content?: string; provenance?: string };
  };
  assert.equal(
    intent.primaryObjective?.content,
    "Automate invoice capture and approval",
  );
  assert.equal(intent.primaryObjective?.provenance, "stated");
});

test("Stage 6 receives the context set, not just the raw requirement", async () => {
  // The precise regression from run `e8908bb0`.
  const byStage = await runCapturing();
  const request = byStage.get("architecture_analysis");
  assert.ok(request);
  assert.notEqual(
    request.input,
    INPUT,
    "Stage 6 must no longer be sent only the business requirement",
  );

  const sent = byStageInput(byStage, "architecture_analysis") as {
    context?: { elements?: readonly { content?: string }[] };
    classification?: { determinedType?: string };
    intent?: unknown;
  };
  assert.ok(sent.context?.elements, "the context set is present");
  assert.equal(sent.context.elements.length, 2);
  assert.equal(sent.context.elements[0]?.content, "Invoices arrive by email");
  assert.equal(sent.classification?.determinedType, "business_requirement");
  assert.ok(
    sent.intent,
    "the frame the context was extracted under travels too",
  );
});

test("every stage after the first is sent structured JSON, not prose", async () => {
  const byStage = await runCapturing();
  for (const stageKey of [
    "intent_detection",
    "context_extraction",
    "architecture_analysis",
  ]) {
    const input = byStage.get(stageKey)?.input ?? "";
    assert.doesNotThrow(
      () => JSON.parse(input),
      `${stageKey} must receive a parseable handoff`,
    );
  }
});

test("the fixture builder and the pipeline agree on what is sent", async () => {
  // If these ever diverge a replay fixture silently stops matching, which is
  // how a broken handoff could hide behind green tests.
  const byStage = await runCapturing();
  const expected = stageProviderInputs(INPUT, {
    classification: CLASSIFICATION_OUTPUT,
    intent: INTENT_OUTPUT,
    context: CONTEXT_OUTPUT,
    // D-78: Stage 9 on this path keys on the parsed architecture.
    architecture: ARCHITECTURE_OUTPUT,
  });

  for (const [stageKey, request] of byStage) {
    assert.equal(
      request.input,
      expected.get(stageKey),
      `${stageKey}: the pipeline and stageProviderInputs must agree`,
    );
  }
});

// --- D-86: a feature capture stops after Stage 3 ---------------------------

test("stopAfterStage 3 halts cleanly after context extraction, before any reasoning stage (D-86)", async () => {
  const { pipeline, traces, invocations } = await harness();
  const result = await pipeline.run({
    analysisId: ANALYSIS_ID,
    text: INPUT,
    stopAfterStage: 3,
  });
  assert.equal(result.haltedAt?.stageNumber, 3);
  assert.match(result.haltedAt?.reason ?? "", /D-86/);
  assert.ok(result.context, "Stage 3's output is what the capture is for");
  assert.deepEqual(
    traces.map((t) => t.stageNumber).filter((n) => n <= 9),
    [1, 2, 3],
    "no reasoning stage runs after the stop",
  );
  assert.equal(invocations.length, 3, "three provider calls, nothing more");
});

// --- D-86: Stage 11 runs on every result, deterministically ----------------

test("Stage 11 traces after Stage 10 and the result carries a band with all seven factors exposed (D-86)", async () => {
  const { pipeline, traces } = await harness();
  const result = await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });
  const eleven = traces.filter((t) => t.stageNumber === 11);
  assert.equal(eleven.length, 1, "one Stage 11 trace");
  assert.equal(eleven[0]?.stageKey, "confidence_evaluation");
  assert.ok(result.confidence, "the band is on the result");
  assert.ok(
    ["high", "medium", "low"].includes(result.confidence?.band ?? ""),
    "a band, not a score",
  );
  assert.equal(
    result.confidence?.factors.length,
    7,
    "AI §8.4: factors always exposed",
  );
  assert.equal(
    result.confidence?.decidedBy,
    "weighted_base",
    "a completed requirement analysis with artifacts is decided by the weighted base",
  );
  // Deterministic: the same input evaluates to the same band.
  const again = await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });
  assert.equal(again.confidence?.band, result.confidence?.band);
});

// --- D-90: planning by judgement on the requirement path ------------------

test("D-90: a declined design skips Stage 6 and plans the business analysis alone, with the quote on every omission", async () => {
  const { pipeline, traces, invocations } = await harness({
    intent: JSON.stringify({
      primary_objective: {
        content: "Have the requirement written down properly",
        provenance: "stated",
      },
      secondary_objectives: [],
      inferred_scope: "Accounts payable",
      requested_outcome: "understanding_only",
      // Verbatim from INPUT.
      decline_quote:
        "we would like the routing and the reminders handled automatically",
    }),
  });

  const result = await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  assert.equal(
    result.haltedAt,
    undefined,
    "not a halt: the run did what was asked",
  );
  assert.equal(result.intent?.requestedOutcome, "understanding_only");
  assert.equal(result.architecture, undefined, "no design was reasoned");
  assert.ok(
    !traces.some((t) => t.stageNumber === 6),
    "Stage 6 must not run for a declined design",
  );
  assert.equal(invocations.length, 3, "Stages 1-3 are the only provider calls");
  // Stage 8 is recorded as the deterministic plan by judgement.
  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    [1, 2, 3, 5, 8, 9, 10, 11, 12],
  );

  const plan = result.artifactPlan ?? [];
  assert.deepEqual(
    plan.filter((e) => e.planned).map((e) => e.artifactType),
    ["intent_brief", "business_analysis"],
  );
  assert.equal(
    plan.find((e) => e.artifactType === "business_analysis")?.outcome,
    "generated",
  );
  for (const entry of plan.filter((e) => !e.planned)) {
    assert.equal(entry.outcome, "omitted");
    assert.match(entry.omissionReason ?? "", /declined a design/);
    assert.match(entry.omissionReason ?? "", /handled automatically/);
  }
});

test("D-90: an unwarranted automation keeps the business analysis, runs no generator, and states the conclusion", async () => {
  const { pipeline, traces, invocations } = await harness({
    architecture: JSON.stringify({
      summary: "Not worth automating",
      data_flow_description: "Manual keying stays manual",
      unknown_disposition: [
        {
          context_index: 1,
          disposition: "excluded",
          statement: "Approver count is irrelevant when nothing is built",
        },
      ],
      components: [],
      automation_verdict: {
        warranted: false,
        statement:
          "Four hundred and fifty invoices a month is real volume, but the approval delay is a policy problem: set an approval SLA before building anything.",
      },
    }),
  });

  const result = await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });

  assert.equal(result.haltedAt, undefined);
  assert.equal(result.architecture?.components.length, 0);
  assert.match(
    result.architecture?.automationUnwarranted?.statement ?? "",
    /approval SLA/,
  );
  assert.equal(invocations.length, 4, "Stages 1-3 and 6; no Stage 9 generator");
  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    [1, 2, 3, 5, 6, 8, 9, 10, 11, 12],
  );

  const plan = result.artifactPlan ?? [];
  assert.deepEqual(
    plan.filter((e) => e.planned).map((e) => e.artifactType),
    ["intent_brief", "business_analysis"],
  );
  for (const entry of plan.filter((e) => !e.planned)) {
    assert.match(entry.omissionReason ?? "", /automation is unwarranted/);
    assert.match(entry.omissionReason ?? "", /approval SLA/);
    assert.match(entry.omissionReason ?? "", /FR-020/);
  }
});
