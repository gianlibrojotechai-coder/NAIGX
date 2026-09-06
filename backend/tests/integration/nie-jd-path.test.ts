/**
 * Integration — the Phase 2 job-description vertical slice.
 *
 * Runs the real pipeline through the real provider abstraction with the replay
 * adapter, so the whole path is offline and deterministic: no credentials, no
 * network, no database, no wall clock.
 *
 * What this proves that the unit tests cannot: that a job description now
 * *reaches* Stage 7 at all, that the stage is composed and traced like every
 * other stage (`AP-8`, `FR-100`), and that the two designed non-outcomes —
 * no profile, and an unsupported input — stop cleanly rather than half-running.
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
  eligibleGapsView,
  stageHandoff,
} from "../../src/nie/pipeline.js";
import { eligibleGaps } from "../../src/nie/stages/artifact-planning.js";
import { parseRecommendation } from "../../src/nie/stages/recommendation-generation.js";
import { parseClassification } from "../../src/nie/stages/classification.js";
import { parseIntent } from "../../src/nie/stages/intent.js";
import { parseContext } from "../../src/nie/stages/context-extraction.js";
import { parseCapabilityProfile } from "../../src/nie/capability-profile.js";
import { composePrompt } from "../../src/nie/prompt.js";
import type {
  FragmentUsageRecord,
  ResolvedFragment,
  StageTraceRecord,
} from "../../src/nie/ports.js";

const INPUT = [
  "Automation Engineer — we run our lead flow on n8n and need someone to own it.",
  "You will build workflows that push qualified leads into HubSpot and handle retries when the API fails.",
  "Roughly 400 leads a week.",
].join("\n");

const ANALYSIS_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

const profile = parseCapabilityProfile(`profile_version: profile-v1
owner: test-operator
capabilities:
  - id: cap-001
    name: Multi-system workflow orchestration in n8n
    platforms: [n8n]
    depth: demonstrated
    evidence:
      - type: workflow
        locator: https://example.invalid/lead-routing.json
        description: Lead routing workflow with retry and error branch
`);

const CLASSIFICATION_OUTPUT = JSON.stringify({
  determined_type: "job_description",
  confidence: 0.92,
  candidate_types: [],
});

const INTENT_OUTPUT = JSON.stringify({
  primary_objective: {
    content: "Hire someone to own lead-flow automation",
    provenance: "stated",
  },
  secondary_objectives: [],
  inferred_scope: "Lead capture through CRM handoff",
});

const CONTEXT_OUTPUT = JSON.stringify({
  elements: [
    {
      id: "e1",
      content: "n8n is the automation platform",
      category: "system",
      provenance: "stated",
      source_quote: "we run our lead flow on n8n",
      specificity_score: 0.9,
    },
    {
      id: "e2",
      content: "HubSpot is the CRM destination",
      category: "system",
      provenance: "stated",
      source_quote: "push qualified leads into HubSpot",
      specificity_score: 0.9,
    },
  ],
  sufficiency: "sufficient",
});

const RECOMMENDATION_OUTPUT = JSON.stringify({
  required_capabilities: [
    {
      id: "req-1",
      name: "Build and own n8n workflows",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      grounded_in_context_indices: [0],
    },
    {
      id: "req-2",
      name: "HubSpot CRM integration",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      grounded_in_context_indices: [1],
    },
  ],
  matched: [
    {
      requirement_id: "req-1",
      capability_id: "cap-001",
      strength: "strong",
      evidence_ref: "https://example.invalid/lead-routing.json",
    },
  ],
  gaps: [
    {
      requirement_id: "req-2",
      priority: "high",
      why_it_matters:
        "Every workflow in the posting terminates in HubSpot and no evidence covers it",
    },
  ],
  verdict: {
    decision: "build_first",
    rationale:
      "n8n orchestration is already evidenced; CRM integration is a must-have with nothing behind it.",
    decisive_gaps: ["req-2"],
  },
});

/** Primes the replay adapter against the prompts the pipeline will compose. */
const PORTFOLIO_OUTPUT = JSON.stringify({
  projects: [
    {
      rank: 1,
      name: "HubSpot lead sync",
      complexity: "intermediate",
      primary_gaps: ["req-2"],
      secondary_capabilities: ["Retry handling"],
      why_this_project: "It closes the only decisive technical gap.",
      business_problem: "Qualified leads are re-keyed into the CRM by hand.",
      what_to_build: "A workflow that pushes qualified leads into HubSpot.",
      workflow: [
        "Trigger: qualified lead",
        "Map fields",
        "Outcome: CRM record",
      ],
      platforms: ["n8n", "HubSpot"],
      technical_concepts: ["Webhooks", "Field mapping"],
      evidence_to_produce: [
        { type: "repo", what_it_shows: "The workflow export and its README" },
      ],
      why_not_consolidated: "It is the only eligible gap in this analysis.",
      reusability: {
        provenance: "inferred",
        basis: "HubSpot is named in this posting's requirements",
        claim: "Likely to transfer to other CRM automation postings",
      },
      estimated_effort: "days",
      portfolio_value: "Closes the CRM gap with a demonstrable system",
    },
  ],
  consolidation_rationale: "One eligible gap, so one project.",
});

const primedAdapter = async (
  outputs: {
    readonly recommendation?: string;
    readonly portfolio?: string;
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
    classifiedAs?: "job_description",
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

  await add("input_classification", INPUT, CLASSIFICATION_OUTPUT);
  const classification = parseClassification(CLASSIFICATION_OUTPUT);

  await add(
    "intent_detection",
    stageHandoff({ input_text: INPUT, classification }),
    INTENT_OUTPUT,
    "job_description",
  );
  const intent = parseIntent(INTENT_OUTPUT);

  await add(
    "context_extraction",
    stageHandoff({ input_text: INPUT, intent }),
    CONTEXT_OUTPUT,
    "job_description",
  );
  const context = parseContext(CONTEXT_OUTPUT, INPUT);

  await add(
    "recommendation_generation",
    stageHandoff({
      classification,
      intent,
      context: contextHandoffView(context),
      capability_profile: profile,
    }),
    outputs.recommendation ?? RECOMMENDATION_OUTPUT,
    "job_description",
  );

  // Stage 9 is keyed on the derived eligible-gap view, so the fixture has to
  // be built the same way the pipeline builds it.
  const recommendationText = outputs.recommendation ?? RECOMMENDATION_OUTPUT;
  try {
    const recommendation = parseRecommendation(
      recommendationText,
      context,
      profile,
    );
    const eligible = eligibleGaps(recommendation);
    if (eligible.length > 0) {
      await add(
        "portfolio_suggestions",
        stageHandoff({
          eligible_gaps: eligibleGapsView(recommendation, eligible),
          matched_capabilities: recommendation.matched,
          verdict: recommendation.verdict,
        }),
        outputs.portfolio ?? PORTFOLIO_OUTPUT,
        "job_description",
      );
    }
  } catch {
    // A recommendation fixture that does not parse describes a run that stops
    // at Stage 7, so there is no Stage 9 call to key.
  }

  return createReplayProvider({ fixtures, lowVarianceSampling: true });
};

/**
 * Builds the pipeline without running it.
 *
 * Separated from `harness` so a test expecting a *failing* run can still read
 * the traces the run emitted — `harness` returns the result, which a rejection
 * never produces.
 */
const buildHarness = async (
  options: {
    readonly withProfile?: boolean;
    readonly recommendation?: string;
    readonly portfolio?: string;
  } = {},
) => {
  const traces: StageTraceRecord[] = [];
  const usages: FragmentUsageRecord[] = [];

  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter: await primedAdapter({
        ...(options.recommendation !== undefined
          ? { recommendation: options.recommendation }
          : {}),
        ...(options.portfolio !== undefined
          ? { portfolio: options.portfolio }
          : {}),
      }),
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
    modelVersionId: "33333333-3333-4333-8333-333333333333",
    modelKey: "test-model",
    ...(options.withProfile === false ? {} : { capabilityProfile: profile }),
    now: () => new Date(0),
  });

  return { pipeline, traces, usages };
};

const harness = async (
  options: Parameters<typeof buildHarness>[0] = {},
): Promise<{
  result: Awaited<
    ReturnType<Awaited<ReturnType<typeof buildHarness>>["pipeline"]["run"]>
  >;
  traces: StageTraceRecord[];
  usages: FragmentUsageRecord[];
}> => {
  const { pipeline, traces, usages } = await buildHarness(options);
  const result = await pipeline.run({ analysisId: ANALYSIS_ID, text: INPUT });
  return { result, traces, usages };
};

// --- the slice runs end to end -------------------------------------------

test("a job description reaches Stage 7 and produces a verdict", async () => {
  const { result } = await harness();

  assert.equal(result.classification.determinedType, "job_description");
  assert.ok(result.context, "Stage 3 still runs");
  assert.ok(result.recommendation, "Stage 7 produced a recommendation");
  assert.equal(result.architecture, undefined, "AI §9.1 — no architecture");
  assert.equal(result.haltedAt, undefined);

  const { recommendation } = result;
  assert.equal(recommendation.verdict.decision, "build_first");
  assert.deepEqual(recommendation.verdict.decisiveGaps, ["req-2"]);
  assert.equal(recommendation.requiredCapabilities.length, 2);
  assert.equal(recommendation.matched.length, 1);
  assert.equal(
    recommendation.matched[0]?.evidenceRef,
    "https://example.invalid/lead-routing.json",
  );
});

test("Stage 7 emits a trace like every other stage (AP-8, FR-100)", async () => {
  const { traces } = await harness();

  // 8 and 9 joined in Phase 3A (`docs/12` D-29); the JD path now runs all six.
  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    // Stage 5 plans the reasoning deterministically before Stage 7 runs it
    // (`docs/12` D-35).
    [1, 2, 3, 5, 7, 8, 9],
  );
  const stage7 = traces.find((t) => t.stageNumber === 7);
  assert.ok(stage7);
  assert.equal(stage7.stageKey, "recommendation_generation");
  assert.equal(stage7.outcome, "success");
  assert.equal(stage7.retryCount, 0);
});

test("Stage 7 records its fragment composition per run (AI-013)", async () => {
  const { usages } = await harness();
  const stage7 = usages.filter((u) => u.stage === "recommendation_generation");

  assert.ok(stage7.length > 0);
  assert.ok(
    stage7.some((u) =>
      u.fragmentVersionId.includes("stage.recommendation_generation"),
    ),
    "the Stage 7 fragment is resolved and recorded",
  );
});

test("Stage 7 is shown the labelled context set, not a bare array", async () => {
  // Requirement grounding is copied, never counted (`docs/12` D-19 principle).
  const { result } = await harness();
  const grounded = result.recommendation?.requiredCapabilities.flatMap(
    (r) => r.groundedInContextIndices,
  );
  assert.deepEqual(grounded, [0, 1]);
});

// --- designed non-outcomes ------------------------------------------------

test("without a capability profile the run stops before Stage 7, and says why", async () => {
  const { result, traces } = await harness({ withProfile: false });

  assert.ok(result.context, "the analysis still classifies and extracts");
  assert.equal(result.recommendation, undefined);
  assert.equal(result.haltedAt?.stageNumber, 7);
  assert.match(result.haltedAt?.reason ?? "", /No capability profile/);
  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    // Stage 5 planned the reasoning before the missing profile halted the run:
    // the plan was legitimately made, and the halt is Stage 7's.
    [1, 2, 3, 5],
    "no Stage 7 trace, because no Stage 7 call was made",
  );
});

test("an invented requirement fails the stage rather than reaching a verdict", async () => {
  // The whole point of the grounding rule: a requirement the posting does not
  // support would manufacture a gap, and a gap manufactures a project.
  await assert.rejects(
    harness({
      recommendation: JSON.stringify({
        required_capabilities: [
          {
            id: "req-1",
            name: "Kubernetes administration",
            necessity: "must_have",
            provenance: "inferred",
            kind: "technical",
            grounded_in_context_indices: [9],
          },
        ],
        matched: [],
        gaps: [
          { requirement_id: "req-1", priority: "high", why_it_matters: "x" },
        ],
        verdict: {
          decision: "build_first",
          rationale: "x",
          decisive_gaps: ["req-1"],
        },
      }),
    }),
    /cites context element 9/,
  );
});

// --- Phase 3A: Stage 8 and Stage 9 (`docs/12` D-29) ----------------------

test("the JD path now reaches Stage 9 and produces portfolio suggestions", async () => {
  const { result } = await harness();

  assert.ok(result.recommendation, "Stage 7 still runs");
  assert.ok(result.artifactPlan, "Stage 8 produced a plan");
  assert.ok(result.portfolioSuggestions, "Stage 9 produced the artifact");

  const suggestions = result.portfolioSuggestions;
  assert.equal(suggestions.projects.length, 1);
  assert.deepEqual(suggestions.projects[0]?.primaryGaps, ["req-2"]);
  assert.equal(suggestions.projects[0]?.rank, 1);
  assert.ok(suggestions.consolidationRationale.length > 0);
});

test("Stage 8 records an omission reason for every generator it lacks", async () => {
  const { result } = await harness();
  const plan = result.artifactPlan ?? [];

  assert.deepEqual(
    plan.map((e) => e.artifactType),
    ["skill_gap_analysis", "portfolio_suggestions", "interview_guidance"],
  );
  for (const entry of plan) {
    if (entry.planned) {
      assert.ok(entry.inclusionReason, `${entry.artifactType} states why`);
    } else {
      assert.ok(entry.omissionReason, `${entry.artifactType} states why not`);
    }
  }
});

test("stages 8 and 9 are traced like every other stage (AP-8, FR-100)", async () => {
  const { traces } = await harness();

  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    // Stage 5 plans the reasoning deterministically before Stage 7 runs it
    // (`docs/12` D-35).
    [1, 2, 3, 5, 7, 8, 9],
  );

  // Stage 8 reaches no provider, and is traced anyway — the one stage whose
  // output is pure policy is the one that most needs to be auditable.
  const stage8 = traces.find((t) => t.stageNumber === 8);
  assert.equal(stage8?.stageKey, "artifact_planning");
  assert.equal(stage8?.outcome, "success");
  assert.ok(Array.isArray(stage8?.structuredOutput));

  const stage9 = traces.find((t) => t.stageNumber === 9);
  assert.equal(stage9?.stageKey, "portfolio_suggestions");
  assert.equal(stage9?.outcome, "success");
});

test("Stage 9 is shown only the decisive technical gaps", async () => {
  // Which gaps may justify a build is application knowledge, derived before
  // the model is called (`docs/12` D-19, D-28, D-29).
  const recommendation = parseRecommendation(
    RECOMMENDATION_OUTPUT,
    parseContext(CONTEXT_OUTPUT, INPUT),
    profile,
  );
  const view = eligibleGapsView(recommendation, eligibleGaps(recommendation));

  assert.deepEqual(
    view.map((g) => g["requirement_id"]),
    ["req-2"],
    "req-1 was matched, so it is not a gap and cannot be built for",
  );
  assert.equal(view[0]?.["requirement"], "HubSpot CRM integration");
});

test("a project citing a gap outside the eligible set fails the artifact", async () => {
  // The refusal is unchanged — an ungrounded project is never presented
  // (`docs/12` D-28, D-29). What changed is its blast radius: under `FR-091`
  // Stage 9 is per-artifact isolated, so the refusal fails the artifact rather
  // than discarding the completed analysis around it.
  const { result, traces } = await harness({
    portfolio: JSON.stringify({
      projects: [
        {
          rank: 1,
          name: "Ungrounded",
          complexity: "simple",
          primary_gaps: ["req-1"],
          secondary_capabilities: ["x"],
          why_this_project: "x",
          business_problem: "x",
          what_to_build: "x",
          workflow: ["Trigger: x", "Outcome: y"],
          platforms: ["x"],
          technical_concepts: ["x"],
          evidence_to_produce: [{ type: "repo", what_it_shows: "x" }],
          why_not_consolidated: "x",
          reusability: { provenance: "inferred", basis: "x", claim: "y" },
          estimated_effort: "days",
          portfolio_value: "x",
        },
      ],
      consolidation_rationale: "x",
    }),
  });

  assert.equal(
    result.portfolioSuggestions,
    undefined,
    "an ungrounded project is still never presented",
  );
  const entry = (result.artifactPlan ?? []).find(
    (e) => e.artifactType === "portfolio_suggestions",
  );
  assert.equal(entry?.outcome, "failed");
  assert.match(
    traces.find((t) => t.stageNumber === 9)?.failureReason ?? "",
    /not one of the decisive technical gaps/,
    "the refusal and its reason are still recorded on the trace",
  );
});

test("apply_now plans no artifact and never reaches Stage 9", async () => {
  const { result, traces } = await harness({
    recommendation: JSON.stringify({
      required_capabilities: [
        {
          id: "req-1",
          name: "Build and own n8n workflows",
          necessity: "must_have",
          provenance: "stated",
          kind: "technical",
          grounded_in_context_indices: [0],
        },
      ],
      matched: [
        {
          requirement_id: "req-1",
          capability_id: "cap-001",
          strength: "strong",
          evidence_ref: "https://example.invalid/lead-routing.json",
        },
      ],
      gaps: [],
      verdict: {
        decision: "apply_now",
        rationale: "The one must-have is already evidenced.",
        decisive_gaps: [],
      },
    }),
  });

  assert.equal(result.recommendation?.verdict.decision, "apply_now");
  assert.ok(result.artifactPlan, "Stage 8 still runs and records its decision");
  assert.equal(result.portfolioSuggestions, undefined);
  assert.deepEqual(
    traces.map((t) => t.stageNumber),
    [1, 2, 3, 5, 7, 8],
    "no Stage 9 trace, because no Stage 9 call was made",
  );
  const entry = (result.artifactPlan ?? []).find(
    (e) => e.artifactType === "portfolio_suggestions",
  );
  assert.match(entry?.omissionReason ?? "", /apply_now/);
  // `FR-091`: omitted and failed must not be confusable. This one was never
  // attempted, so it is `omitted` — and it keeps the reason that says why.
  assert.equal(entry?.outcome, "omitted");
});

// --- schema validation at Stage 9 (FR-039, docs/12 D-1) ------------------

test("a schema-invalid artifact earns one regeneration, then fails", async () => {
  // `FR-039`: "Validation failure triggers one regeneration attempt, then
  // degradation." The replay adapter returns the same fixture both times, so
  // the second attempt is invalid too and the failure stands (`AI §3.2`).
  const invalid = JSON.parse(PORTFOLIO_OUTPUT) as {
    consolidation_rationale?: string;
  };
  delete invalid.consolidation_rationale;

  const { result, traces } = await harness({
    portfolio: JSON.stringify(invalid),
  });

  // `FR-091`: the run resolves. Discarding a completed analysis to report one
  // artifact that did not generate is the "silent omission" the requirement
  // calls a defect, applied to everything upstream.
  assert.ok(result.recommendation, "the completed reasoning survives");
  assert.ok(result.context, "so does everything before it");
  assert.equal(result.portfolioSuggestions, undefined);

  const entry = (result.artifactPlan ?? []).find(
    (e) => e.artifactType === "portfolio_suggestions",
  );
  assert.equal(
    entry?.outcome,
    "failed",
    "tried and failed, not chosen against",
  );
  assert.ok(
    entry?.inclusionReason,
    "the reason it was planned survives the failure",
  );
  assert.equal(entry?.omissionReason, undefined);

  // Degradation does not erase the failure record.
  const stage9 = traces.find((t) => t.stageNumber === 9);
  assert.ok(stage9, "Stage 9 is still traced when it fails (AP-8, FR-100)");
  assert.equal(stage9.outcome, "failure");
  assert.match(stage9.failureReason ?? "", /consolidation_rationale/);
  assert.equal(
    stage9.retryCount,
    1,
    "exactly one regeneration — the existing Stage 6 mechanism, not a second retry path",
  );
});

test("an invalid artifact never reaches the pipeline result", async () => {
  // `DB §4.4`: "only `valid` artifacts are presentable." In this build the
  // pipeline result *is* the presentation boundary — no ARTIFACT entity exists
  // yet — so enforcement is that the artifact never lands in it.
  const invalid = JSON.parse(PORTFOLIO_OUTPUT) as {
    projects: { reusability: { provenance: string } }[];
  };
  const [project] = invalid.projects;
  assert.ok(project);
  project.reusability.provenance = "stated";

  const { result } = await harness({ portfolio: JSON.stringify(invalid) });

  assert.equal(
    result.portfolioSuggestions,
    undefined,
    "a document a model could not have written honestly must not be presented",
  );
  // Absent *and* labelled: `FR-091` — "silent omission of a failed artifact is
  // a defect", so the gap in the result has to be explained by the plan.
  const entry = (result.artifactPlan ?? []).find(
    (e) => e.artifactType === "portfolio_suggestions",
  );
  assert.equal(entry?.outcome, "failed");
});

test("a schema-valid artifact needs no regeneration", async () => {
  const { result, traces } = await harness();

  assert.ok(result.portfolioSuggestions, "the valid artifact is presented");
  const stage9 = traces.find((t) => t.stageNumber === 9);
  assert.equal(stage9?.outcome, "success");
  assert.equal(
    stage9?.retryCount,
    0,
    "no regeneration on a conforming artifact",
  );

  const entry = (result.artifactPlan ?? []).find(
    (e) => e.artifactType === "portfolio_suggestions",
  );
  assert.equal(entry?.outcome, "generated");
});
