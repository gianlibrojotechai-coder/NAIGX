/**
 * Integration — the two paths M-11 adds (`FR-021`, `FR-023`, `docs/15` D-40).
 *
 * Runs the real pipeline through the real provider abstraction with the replay
 * adapter: offline, deterministic, no credentials, no network, no database.
 *
 * What this proves that the unit tests cannot:
 *
 *   · `existing_workflow` now *reaches* a Stage 6 generator at all, and reaches
 *     `workflow_review` rather than `architecture_analysis` — the routing
 *     `docs/15` D-40 corrected.
 *   · `technical_assessment` reaches `architecture_analysis` and is held to
 *     `FR-023`'s trade-offs and named rejected alternative, which the
 *     requirement path is not.
 *   · Both paths persist through the ports the composition root supplies, in
 *     the order `RiskItem.component_id` requires: components, then findings.
 *   · The derived artifacts are planned, validated, persisted and announced
 *     like any other artifact, without a provider call.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createProviderInvoker } from "../../src/provider/invoke.js";
import type { TokenRate } from "../../src/provider/cost.js";
import {
  createReplayProvider,
  replayKeyFor,
} from "../../src/provider/adapters/replay.js";
import type { CapabilityRequest } from "../../src/provider/capability.js";
import {
  contextHandoffView,
  createPipeline,
  stageHandoff,
  stageProviderInputs,
} from "../../src/nie/pipeline.js";
import { parseClassification } from "../../src/nie/stages/classification.js";
import { parseIntent } from "../../src/nie/stages/intent.js";
import { parseContext } from "../../src/nie/stages/context-extraction.js";
import { composePrompt } from "../../src/nie/prompt.js";
import type { AnalysisEvent } from "../../src/nie/events.js";
import type {
  ArchitectureResult,
  ArtifactPlanEntry,
  ClassificationType,
  WorkflowFinding,
} from "../../src/nie/contracts.js";
import type {
  FragmentUsageRecord,
  PersistedArtifact,
  ResolvedFragment,
  StageResultSink,
  StageTraceRecord,
} from "../../src/nie/ports.js";

const ANALYSIS_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const rate: TokenRate = {
  inputUsdPerMillionTokens: "3.00",
  outputUsdPerMillionTokens: "15.00",
};

const resolver = {
  resolve: (keys: readonly string[]): Promise<readonly ResolvedFragment[]> =>
    Promise.resolve(
      keys.map((fragmentKey, i): ResolvedFragment => ({
        fragmentKey,
        fragmentVersionId: `ver-${fragmentKey}`,
        version: `1.${String(i)}`,
        content: `[${fragmentKey}]`,
      })),
    ),
};

// --- the existing-workflow fixture ---------------------------------------

const WORKFLOW_INPUT = [
  "Here is our current lead intake. A Zapier zap watches a Google Form.",
  "Every submission is appended to a Google Sheet, then a second zap emails sales.",
  "It has been running for a year and we want to know what is wrong with it.",
].join("\n");

const WORKFLOW_CONTEXT = JSON.stringify({
  elements: [
    {
      id: "e1",
      content: "A Zapier zap watches a Google Form for submissions",
      category: "system",
      provenance: "stated",
      source_quote: "A Zapier zap watches a Google Form",
      specificity_score: 0.9,
    },
    {
      id: "e2",
      content: "Submissions are appended to a Google Sheet",
      category: "system",
      provenance: "stated",
      source_quote: "Every submission is appended to a Google Sheet",
      specificity_score: 0.9,
    },
  ],
  sufficiency: "sufficient",
});

const WORKFLOW_REVIEW_OUTPUT = JSON.stringify({
  summary: "A two-hop Zapier workflow from form submission to a sales email",
  data_flow_description: "Google Form → Zapier → Google Sheet → Zapier → email",
  structure: [
    {
      name: "Form Watcher",
      responsibility: "Detect new Google Form submissions",
      inputs: "Google Form submission events",
      outputs: "Submission payload",
      failure_handling: "The submitted workflow does not state what happens",
      grounded_in_context_indices: [0],
    },
    {
      name: "Sheet Appender",
      responsibility: "Append the submission as a sheet row",
      inputs: "Submission payload",
      outputs: "A new sheet row",
      failure_handling: "Zapier retries three times, then the task errors out",
      external_system: "Google Sheets",
      integration_direction: "outbound",
      grounded_in_context_indices: [1],
    },
  ],
  findings: [
    {
      component_index: 0,
      description:
        "A paused or erroring zap drops submissions with no record that they arrived",
      severity: 4,
      likelihood: 2,
      remediation:
        "Reconcile the form response count against the sheet row count daily and alert on any gap",
    },
  ],
  optimisations: [
    "Merge the two zaps so a sheet write failure blocks the email",
  ],
});

// --- the technical-assessment fixture ------------------------------------

const ASSESSMENT_INPUT = [
  "Take-home: design an ingestion path for partner webhooks into our warehouse.",
  "Partners retry on non-2xx. Volume is roughly 50 events a second at peak.",
].join("\n");

const ASSESSMENT_CONTEXT = JSON.stringify({
  elements: [
    {
      id: "e1",
      content: "Partners retry when the endpoint returns a non-2xx status",
      category: "constraint",
      provenance: "stated",
      source_quote: "Partners retry on non-2xx",
      specificity_score: 0.95,
    },
    {
      id: "e2",
      content: "Peak volume is roughly 50 events a second",
      category: "constraint",
      provenance: "stated",
      source_quote: "roughly 50 events a second at peak",
      specificity_score: 0.9,
    },
  ],
  sufficiency: "sufficient",
});

const ASSESSMENT_ARCHITECTURE_OUTPUT = JSON.stringify({
  summary: "A queue-backed ingestion path with an idempotent warehouse writer",
  data_flow_description: "Webhook → queue → writer → warehouse",
  components: [
    {
      name: "Webhook Receiver",
      responsibility: "Accept and acknowledge partner events",
      inputs: "HTTP POST bodies",
      outputs: "Queued messages",
      failure_handling: "Return 503 so the partner's own retry takes over",
      grounded_in_context_indices: [0],
    },
    {
      name: "Warehouse Writer",
      responsibility: "Write each event exactly once",
      inputs: "Queued messages",
      outputs: "Warehouse rows",
      failure_handling: "Dead-letter after five attempts",
      external_system: "BigQuery",
      integration_direction: "outbound",
      grounded_in_context_indices: [1],
    },
  ],
  trade_offs: [
    {
      choice: "A queue between receipt and write",
      accepted: "End-to-end latency rises from milliseconds to seconds",
    },
  ],
  rejected_approaches: [
    {
      approach: "Write to the warehouse synchronously in the request handler",
      rejection_reason:
        "A warehouse outage would fail the partner's request, and at 50/s their retries would compound the outage",
    },
  ],
});

// --- the harness ---------------------------------------------------------

interface Scenario {
  readonly input: string;
  readonly type: ClassificationType;
  readonly context: string;
  readonly stageKey: string;
  readonly stageOutput: string;
}

const WORKFLOW: Scenario = {
  input: WORKFLOW_INPUT,
  type: "existing_workflow",
  context: WORKFLOW_CONTEXT,
  stageKey: "workflow_review",
  stageOutput: WORKFLOW_REVIEW_OUTPUT,
};

const ASSESSMENT: Scenario = {
  input: ASSESSMENT_INPUT,
  type: "technical_assessment",
  context: ASSESSMENT_CONTEXT,
  stageKey: "architecture_analysis",
  stageOutput: ASSESSMENT_ARCHITECTURE_OUTPUT,
};

/**
 * The Stage 1 and Stage 2 outputs each scenario replays.
 *
 * Hoisted so the fixture builder below and the `stageProviderInputs` agreement
 * test share one definition. When they were separate, the agreement test could
 * only have compared a copy against a copy.
 */
const classificationOutputFor = (scenario: Scenario): string =>
  JSON.stringify({
    determined_type: scenario.type,
    confidence: 0.93,
    candidate_types: [],
  });

const intentOutputFor = (scenario: Scenario): string =>
  JSON.stringify({
    primary_objective: {
      content:
        scenario.type === "existing_workflow"
          ? "Have the current lead intake reviewed"
          : "Produce a defensible ingestion design",
      provenance: "stated",
    },
    secondary_objectives: [],
    inferred_scope: "Form submission through downstream handoff",
  });

/** Primes the replay adapter against the prompts the pipeline will compose. */
const primedAdapter = async (
  scenario: Scenario,
  stageOutput = scenario.stageOutput,
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
    classifiedAs?: ClassificationType,
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

  const classificationOutput = classificationOutputFor(scenario);
  const intentOutput = intentOutputFor(scenario);

  await add("input_classification", scenario.input, classificationOutput);
  const classification = parseClassification(classificationOutput);

  await add(
    "intent_detection",
    stageHandoff({ input_text: scenario.input, classification }),
    intentOutput,
    scenario.type,
  );
  const intent = parseIntent(intentOutput);

  await add(
    "context_extraction",
    stageHandoff({ input_text: scenario.input, intent }),
    scenario.context,
    scenario.type,
  );
  const context = parseContext(scenario.context, scenario.input);

  await add(
    scenario.stageKey,
    stageHandoff({
      classification,
      intent,
      context: contextHandoffView(context),
    }),
    stageOutput,
    scenario.type,
  );

  return createReplayProvider({ fixtures, lowVarianceSampling: true });
};

/** A sink that records the calls, in the order the pipeline made them. */
const recordingSink = () => {
  const calls: string[] = [];
  const architectures: ArchitectureResult[] = [];
  const findings: WorkflowFinding[] = [];
  const artifacts: PersistedArtifact[] = [];
  let plan: readonly ArtifactPlanEntry[] = [];

  const sink: StageResultSink = {
    persistClassification: () => {
      calls.push("classification");
      return Promise.resolve();
    },
    persistIntent: () => {
      calls.push("intent");
      return Promise.resolve();
    },
    persistContext: () => {
      calls.push("context");
      return Promise.resolve();
    },
    persistArchitecture: (_id, architecture) => {
      calls.push("architecture");
      architectures.push(architecture);
      return Promise.resolve();
    },
    persistWorkflowFindings: (_id, given) => {
      calls.push("findings");
      findings.push(...given);
      return Promise.resolve();
    },
    persistArtifactPlan: (_id, given) => {
      calls.push("plan");
      // D-66: the plan is written twice — the brief at Stage 2, the path set
      // at Stage 8 — and the real sink merges the writes, so this one does too.
      plan = [...plan, ...given];
      return Promise.resolve();
    },
    persistArtifact: (_id, artifact) => {
      calls.push(`artifact:${artifact.artifactType}`);
      artifacts.push(artifact);
      return Promise.resolve();
    },
  };

  return {
    sink,
    calls,
    architectures,
    findings,
    artifacts,
    plan: () => plan,
  };
};

const harness = async (scenario: Scenario, stageOutput?: string) => {
  const traces: StageTraceRecord[] = [];
  const usages: FragmentUsageRecord[] = [];
  const events: AnalysisEvent[] = [];
  const recorded = recordingSink();

  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter: await primedAdapter(scenario, stageOutput),
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
    fragmentUsageSink: {
      record: (u) => {
        usages.push(...u);
        return Promise.resolve();
      },
    },
    resultSink: recorded.sink,
    modelVersionId: "44444444-4444-4444-8444-444444444444",
    modelKey: "test-model",
    eventSink: {
      emit: (_analysisId, event) => {
        events.push(event);
      },
    },
    now: () => new Date(0),
  });

  const result = await pipeline.run({
    analysisId: ANALYSIS_ID,
    text: scenario.input,
  });

  return { result, traces, usages, events, recorded };
};

// --- FR-021, the existing-workflow path ----------------------------------

test("an existing workflow reaches Stage 6W and is reviewed, not redesigned", async () => {
  const { result } = await harness(WORKFLOW);

  assert.equal(result.classification.determinedType, "existing_workflow");
  assert.equal(result.haltedAt, undefined);
  assert.ok(result.workflowReview, "FR-021 — the review is the path's output");
  assert.equal(result.workflowReview.structure.length, 2);
  assert.equal(result.workflowReview.findings.length, 1);
  // The observed structure travels as an architecture because that is what the
  // entity models (`docs/15` D-40). The provenance is opposite; the shape is not.
  assert.equal(result.architecture?.summary, result.workflowReview.summary);
});

test("Stage 6W traces under its own key, not the design generator's", async () => {
  const { traces } = await harness(WORKFLOW);

  const stageSix = traces.filter((t) => t.stageNumber === 6);
  assert.equal(stageSix.length, 1);
  assert.equal(
    stageSix[0]?.stageKey,
    "workflow_review",
    "AP-8/FR-100 — the trace names the job that actually ran",
  );
  assert.equal(stageSix[0]?.outcome, "success");
});

test("Stage 6W composes its own prompt fragment (AI-013)", async () => {
  const { usages } = await harness(WORKFLOW);

  const stageSix = usages.filter((u) => u.stage === "workflow_review");
  assert.ok(stageSix.length > 0, "the composition is recorded per AI-013");
  assert.ok(
    usages.every((u) => u.stage !== "architecture_analysis"),
    "the design prompt is never composed on this path",
  );
});

test("components are persisted before the findings that reference them", async () => {
  const { recorded } = await harness(WORKFLOW);

  const architectureAt = recorded.calls.indexOf("architecture");
  const findingsAt = recorded.calls.indexOf("findings");
  assert.ok(architectureAt >= 0 && findingsAt >= 0);
  assert.ok(
    architectureAt < findingsAt,
    "RiskItem.component_id is a foreign key — the component must exist first",
  );
  assert.equal(recorded.findings.length, 1);
  assert.equal(recorded.findings[0]?.componentIndex, 0);
});

test("the workflow path produces its two AI §9.1 artifacts with no provider call", async () => {
  const { recorded, events } = await harness(WORKFLOW);

  // D-66: the intent brief precedes the path's own set on every path.
  assert.deepEqual(
    recorded.plan().map((entry) => entry.artifactType),
    ["intent_brief", "workflow_recommendation", "risk_assessment"],
  );
  assert.deepEqual(
    recorded.artifacts.map((a) => a.artifactType),
    ["intent_brief", "workflow_recommendation", "risk_assessment"],
  );
  // Rendered, not sampled: there is no second attempt to make.
  assert.ok(recorded.artifacts.every((a) => a.generationAttemptCount === 1));
  assert.ok(recorded.artifacts.every((a) => a.validationStatus === "valid"));

  const announced = events.filter((e) => e.type === "artifact");
  assert.equal(
    announced.length,
    3,
    "FR-041 — the browser sees the brief and both path artifacts",
  );
});

test("a review citing a step it never stated fails the stage after one retry", async () => {
  // The replay adapter holds one fixture for this request, so the single
  // regeneration `AI §3.2` grants replays the same bad answer and the stage
  // fails — which is the designed outcome, not a swallowed one.
  const broken = JSON.stringify({
    ...(JSON.parse(WORKFLOW_REVIEW_OUTPUT) as Record<string, unknown>),
    findings: [
      {
        component_index: 9,
        description: "Something is wrong somewhere",
        severity: 3,
        likelihood: 3,
        remediation: "Add error handling",
      },
    ],
  });

  await assert.rejects(
    harness(WORKFLOW, broken),
    /generic/,
    "FR-021 rejects a finding that cannot name the step it concerns",
  );
});

// --- FR-023, the technical-assessment path -------------------------------

test("an assessment produces an architecture with trade-offs and a rejected approach", async () => {
  const { result } = await harness(ASSESSMENT);

  assert.equal(result.classification.determinedType, "technical_assessment");
  assert.equal(result.haltedAt, undefined);
  assert.equal(result.workflowReview, undefined, "this path reviews nothing");

  const { architecture } = result;
  assert.ok(architecture);
  assert.equal(architecture.components.length, 2);
  assert.equal(architecture.tradeOffs?.length, 1);
  assert.equal(architecture.rejectedApproaches?.length, 1);
  assert.match(
    architecture.rejectedApproaches?.[0]?.rejectionReason ?? "",
    /compound the outage/,
  );
});

test("the assessment path produces its two AI §9.1 artifacts", async () => {
  const { recorded } = await harness(ASSESSMENT);

  assert.deepEqual(
    recorded.artifacts.map((a) => a.artifactType),
    ["intent_brief", "assessment_feedback", "mermaid_diagram"],
  );
  assert.ok(recorded.artifacts.every((a) => a.validationStatus === "valid"));
  assert.ok(
    !recorded.calls.includes("findings"),
    "there is no reviewed workflow, so there are no workflow findings",
  );
});

test("the mermaid diagram's nodes are the architecture's components", async () => {
  const { recorded } = await harness(ASSESSMENT);

  const diagram = recorded.artifacts.find(
    (a) => a.artifactType === "mermaid_diagram",
  );
  const content = diagram?.content as Record<string, unknown>;
  assert.equal(content["node_count"], 2);
  assert.match(String(content["diagram"]), /Webhook Receiver/);
  assert.match(String(content["diagram"]), /BigQuery/);
});

test("an assessment naming no rejected alternative fails the stage", async () => {
  const withoutAlternatives = JSON.parse(
    ASSESSMENT_ARCHITECTURE_OUTPUT,
  ) as Record<string, unknown>;
  delete withoutAlternatives["rejected_approaches"];

  await assert.rejects(
    harness(ASSESSMENT, JSON.stringify(withoutAlternatives)),
    /at least one rejected alternative/,
    "FR-023 — a solution with no alternatives cannot be defended",
  );
});

// --- the fixture builder must know every Stage 6 path --------------------

/**
 * ⚠️ THIS IS THE TEST THAT WAS MISSING, AND ITS ABSENCE COST $0.1072.
 *
 * `stageProviderInputs` tells a recorder which provider input each stage will
 * receive, and `createRecordedProvider` keys a replay fixture from it. It used
 * to re-state the Stage 6 routing rules inline — `job_description` to Stage 7,
 * **everything else** to `architecture_analysis` — which quietly mis-described
 * the `existing_workflow` path that `planReasoning` sends to `workflow_review`.
 *
 * Nothing went red. `createRecordedProvider` skips a recorded stage it has no
 * provider input for, so an `existing_workflow` recording simply built one
 * fewer fixture, and the pipeline's Stage 6 call failed at replay with
 * `No recorded response for request key …` — which reads as missing evidence.
 * `ew-001` was captured with real provider spend and could not be replayed at
 * all; the message pointed at the recording rather than at the keying.
 *
 * The tests around it could not catch this. The `nie-pipeline.test.ts`
 * agreement test only ever runs the business-requirement path, and the
 * scenarios in *this* file prime their fixtures through `primedAdapter`, which
 * computes the keys itself — a reimplementation cannot disagree with the thing
 * it reimplements.
 *
 * So this asserts the real function against the real handoff, for both
 * non-requirement paths, including that the branch NOT taken is absent: a
 * fixture set offering a call the pipeline never makes is its own defect.
 */
for (const scenario of [WORKFLOW, ASSESSMENT]) {
  test(`stageProviderInputs keys the ${scenario.type} Stage 6 call`, () => {
    const classificationOutput = classificationOutputFor(scenario);
    const intentOutput = intentOutputFor(scenario);

    const classification = parseClassification(classificationOutput);
    const intent = parseIntent(intentOutput);
    const context = parseContext(scenario.context, scenario.input);

    const inputs = stageProviderInputs(scenario.input, {
      classification: classificationOutput,
      intent: intentOutput,
      context: scenario.context,
    });

    assert.equal(
      inputs.get(scenario.stageKey),
      stageHandoff({
        classification,
        intent,
        context: contextHandoffView(context),
      }),
      `${scenario.type}: the fixture builder must key ${scenario.stageKey} with the handoff the pipeline sends`,
    );

    const notTaken =
      scenario.stageKey === "workflow_review"
        ? "architecture_analysis"
        : "workflow_review";
    assert.equal(
      inputs.get(notTaken),
      undefined,
      `${scenario.type}: ${notTaken} is never called on this path, so keying a fixture for it would describe a call that is never made`,
    );
  });
}
