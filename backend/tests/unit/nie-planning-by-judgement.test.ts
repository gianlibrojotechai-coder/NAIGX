/**
 * D-90 — planning by judgement and complexity-appropriate depth
 * (`docs/65`; `FR-017`, `FR-020`, `AC-037`, `PV §3.2`).
 *
 * The three judgements the corpus authored inputs to test, at the unit level:
 * a submitter who declined a design (br-010), an automation Stage 6 concluded
 * is unwarranted (br-003), and an input near the `FR-002` floor (br-004,
 * ew-004, jd-004, ta-005). Each has an explicit reason on every entry, kept
 * or omitted.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MINIMAL_PATH_ARTIFACT_TYPES,
  PATH_ARTIFACT_TYPES,
  StageError,
  type ArchitectureResult,
  type ContextResult,
  type IntentResult,
} from "../../src/nie/contracts.js";
import {
  MINIMAL_INPUT_CHARACTERS,
  depthFor,
  planReasoning,
} from "../../src/nie/stages/reasoning-planning.js";
import {
  planDerivedArtifacts,
  planPathArtifacts,
  renderIntentBrief,
} from "../../src/nie/stages/derived-artifacts.js";
import { planArtifacts } from "../../src/nie/stages/artifact-planning.js";
import {
  IntentDeclineQuoteError,
  parseIntent,
} from "../../src/nie/stages/intent.js";
import { parseArchitecture } from "../../src/nie/stages/architecture-analysis.js";
import type { RecommendationResult } from "../../src/nie/contracts.js";

const design: IntentResult = {
  primaryObjective: { content: "Automate onboarding", provenance: "stated" },
  secondaryObjectives: [],
  inferredScope: "New-starter setup",
  requestedOutcome: "design",
};

const declined: IntentResult = {
  ...design,
  requestedOutcome: "understanding_only",
  declineQuote: "I don't want you to design the solution",
};

const architecture: ArchitectureResult = {
  summary: "Two components",
  dataFlowDescription: "A → B",
  components: [],
  unknownDispositions: [],
};

const unwarranted: ArchitectureResult = {
  ...architecture,
  automationUnwarranted: {
    statement:
      "Four policies, one broker, once a year: a 90-minute task does not repay a build.",
  },
};

// --- Stage 5: the depth rule ---------------------------------------------

test("D-90: depth is minimal at or under the band and standard above it", () => {
  assert.equal(MINIMAL_INPUT_CHARACTERS, 200);
  assert.equal(depthFor({ characterCount: 50 }), "minimal");
  assert.equal(depthFor({ characterCount: 200 }), "minimal");
  assert.equal(depthFor({ characterCount: 201 }), "standard");
  assert.equal(depthFor({ characterCount: 967 }), "standard");
});

test("D-90: the corpus's minimal cases fall inside the band and its full-set cases outside it", () => {
  // br-004 66, ew-004 81, jd-004 83, ta-005 83; br-005 355, ta-009 478.
  for (const n of [66, 81, 83])
    assert.equal(depthFor({ characterCount: n }), "minimal");
  for (const n of [355, 478, 647])
    assert.equal(depthFor({ characterCount: n }), "standard");
});

test("D-90: planReasoning reads the depth from the signals, and stays standard without them", () => {
  assert.equal(planReasoning("business_requirement").depthLevel, "standard");
  assert.equal(
    planReasoning("business_requirement", { characterCount: 66 }).depthLevel,
    "minimal",
  );
  assert.equal(
    planReasoning("existing_workflow", { characterCount: 900 }).depthLevel,
    "standard",
  );
  // The module routing is untouched by depth.
  assert.deepEqual(
    planReasoning("business_requirement", { characterCount: 66 })
      .requiredAnalyses,
    ["architecture_analysis"],
  );
});

// --- Stage 8: the judgement --------------------------------------------

const types = (plan: ReturnType<typeof planPathArtifacts>) =>
  plan.filter((e) => e.planned).map((e) => e.artifactType);

test("D-90 rule 1: a declined design keeps the business analysis and omits everything that designs", () => {
  const plan = planPathArtifacts({
    classifiedAs: "business_requirement",
    depthLevel: "standard",
    characterCount: 647,
    intent: declined,
    inclusionReason: "",
  });
  assert.deepEqual(types(plan), ["business_analysis"]);
  // Every entry on the path is present, with a reason that quotes the submitter.
  assert.equal(plan.length, PATH_ARTIFACT_TYPES.business_requirement.length);
  for (const entry of plan) {
    if (entry.planned) {
      assert.match(entry.inclusionReason ?? "", /declined a design/);
      assert.match(entry.inclusionReason ?? "", /I don't want you to design/);
    } else {
      assert.equal(entry.outcome, "omitted");
      assert.match(entry.omissionReason ?? "", /Omitted by judgement/);
      assert.match(entry.omissionReason ?? "", /I don't want you to design/);
      assert.match(entry.omissionReason ?? "", /FR-017/);
    }
  }
});

test("D-90 rule 2: an unwarranted automation keeps the business analysis and states the conclusion on every omission", () => {
  const plan = planPathArtifacts({
    classifiedAs: "business_requirement",
    depthLevel: "standard",
    characterCount: 967,
    intent: design,
    architecture: unwarranted,
    inclusionReason: "",
  });
  assert.deepEqual(types(plan), ["business_analysis"]);
  const omitted = plan.filter((e) => !e.planned);
  assert.equal(omitted.length, plan.length - 1);
  for (const entry of omitted) {
    assert.match(entry.omissionReason ?? "", /automation is unwarranted/);
    assert.match(entry.omissionReason ?? "", /once a year/);
    assert.match(entry.omissionReason ?? "", /FR-020/);
  }
});

test("D-90 rule 3: minimal depth plans each path's minimal set and nothing else", () => {
  for (const classifiedAs of [
    "business_requirement",
    "existing_workflow",
    "technical_assessment",
  ] as const) {
    const plan = planPathArtifacts({
      classifiedAs,
      depthLevel: "minimal",
      characterCount: 83,
      intent: design,
      architecture,
      inclusionReason: "because",
    });
    assert.deepEqual(
      [...types(plan)].sort(),
      [...MINIMAL_PATH_ARTIFACT_TYPES[classifiedAs]].sort(),
      classifiedAs,
    );
    assert.equal(plan.length, PATH_ARTIFACT_TYPES[classifiedAs].length);
    for (const entry of plan) {
      assert.equal(entry.depthLevel, "minimal");
      if (entry.planned) {
        assert.match(entry.inclusionReason ?? "", /minimal depth/);
        assert.match(entry.inclusionReason ?? "", /83 characters/);
        assert.match(entry.inclusionReason ?? "", /because$/);
      } else {
        assert.match(entry.omissionReason ?? "", /Omitted by judgement/);
        assert.match(entry.omissionReason ?? "", /83 characters/);
        assert.match(entry.omissionReason ?? "", /200-character minimal band/);
      }
    }
  }
});

test("D-90: the minimal sets are what the corpus's minimal cases expect", () => {
  // br-004, ew-004, ta-005 (`platform_comparison` is the product's
  // `platform_recommendation`; the P1 artifacts are superseded expectations).
  assert.deepEqual(MINIMAL_PATH_ARTIFACT_TYPES.business_requirement, [
    "business_analysis",
    "architecture_recommendation",
  ]);
  assert.deepEqual(MINIMAL_PATH_ARTIFACT_TYPES.existing_workflow, [
    "workflow_recommendation",
  ]);
  assert.deepEqual(MINIMAL_PATH_ARTIFACT_TYPES.technical_assessment, [
    "architecture_recommendation",
    "mermaid_diagram",
  ]);
  assert.deepEqual(MINIMAL_PATH_ARTIFACT_TYPES.job_description, [
    "skill_gap_analysis",
  ]);
});

test("D-90: the rules take precedence in order — a decline beats an unwarranted verdict beats depth", () => {
  const plan = planPathArtifacts({
    classifiedAs: "business_requirement",
    depthLevel: "minimal",
    characterCount: 60,
    intent: declined,
    architecture: unwarranted,
    inclusionReason: "",
  });
  assert.deepEqual(types(plan), ["business_analysis"]);
  assert.match(
    plan.find((e) => e.artifactType === "mermaid_diagram")?.omissionReason ??
      "",
    /declined a design/,
  );
});

test("D-90: a decline is only read on the requirement path, and standard depth with a design plans the whole set", () => {
  const assessment = planPathArtifacts({
    classifiedAs: "technical_assessment",
    depthLevel: "standard",
    characterCount: 500,
    intent: declined,
    architecture,
    inclusionReason: "because",
  });
  assert.equal(
    assessment.every((e) => e.planned),
    true,
  );

  const whole = planPathArtifacts({
    classifiedAs: "business_requirement",
    depthLevel: "standard",
    characterCount: 500,
    intent: design,
    architecture,
    inclusionReason: "because",
  });
  assert.equal(
    whole.every((e) => e.planned),
    true,
  );
  assert.deepEqual(
    whole,
    planDerivedArtifacts("business_requirement", "because"),
  );
});

test("D-90: the same signals give the same plan (FR-024)", () => {
  const signals = {
    classifiedAs: "existing_workflow" as const,
    depthLevel: "minimal" as const,
    characterCount: 81,
    intent: design,
    architecture,
    inclusionReason: "x",
  };
  assert.deepEqual(planPathArtifacts(signals), planPathArtifacts(signals));
});

// --- the job-description planner at minimal depth -------------------------

const recommendation: RecommendationResult = {
  requiredCapabilities: [
    {
      id: "r1",
      name: "n8n",
      necessity: "must_have",
      kind: "tool",
      provenance: "stated",
      groundedInContextIndices: [0],
    },
  ],
  matched: [],
  gaps: [
    {
      requirementId: "r1",
      priority: "high",
      whyItMatters: "Named",
      reported: true,
    },
  ],
  verdict: {
    decision: "build_first",
    decisiveGaps: ["r1"],
    reasoning: "One decisive gap",
  },
} as unknown as RecommendationResult;

test("D-90: a minimal posting plans the gap analysis alone, with FR-022 reasons for the rest", () => {
  const plan = planArtifacts(recommendation, "minimal");
  assert.deepEqual(
    plan.filter((e) => e.planned).map((e) => e.artifactType),
    ["skill_gap_analysis"],
  );
  for (const entry of plan.filter((e) => !e.planned)) {
    assert.equal(entry.depthLevel, "minimal");
    assert.match(entry.omissionReason ?? "", /Omitted by judgement/);
    assert.match(entry.omissionReason ?? "", /FR-022/);
  }
  // Standard depth is the pre-D-90 plan.
  assert.deepEqual(
    planArtifacts(recommendation),
    planArtifacts(recommendation, "standard"),
  );
});

// --- Stage 2: the decline, verified ---------------------------------------

const INPUT =
  "The problem is our new-starter setup.\nI don't want you to design the solution - the suppliers will pitch their own.\nAbout 60 new starters a year.";

const intentJson = (extra: Record<string, unknown>) =>
  JSON.stringify({
    primary_objective: {
      content: "Write the requirement down",
      provenance: "stated",
    },
    secondary_objectives: [],
    inferred_scope: "Onboarding",
    ...extra,
  });

test("D-90: a decline quoted verbatim from the input is read as understanding_only", () => {
  const intent = parseIntent(
    intentJson({
      requested_outcome: "understanding_only",
      decline_quote: "I don't want you to design the solution",
    }),
    INPUT,
  );
  assert.equal(intent.requestedOutcome, "understanding_only");
  assert.equal(intent.declineQuote, "I don't want you to design the solution");
});

test("D-90: a decline the input does not contain is the one Stage 2 error worth a regeneration", () => {
  assert.throws(
    () =>
      parseIntent(
        intentJson({
          requested_outcome: "understanding_only",
          decline_quote: "please do not design anything",
        }),
        INPUT,
      ),
    IntentDeclineQuoteError,
  );
  assert.throws(
    () =>
      parseIntent(
        intentJson({
          requested_outcome: "understanding_only",
          decline_quote: null,
        }),
        INPUT,
      ),
    IntentDeclineQuoteError,
  );
  // Without the input to check against, a decline cannot be verified.
  assert.throws(
    () =>
      parseIntent(
        intentJson({
          requested_outcome: "understanding_only",
          decline_quote: "I don't want you to design the solution",
        }),
      ),
    IntentDeclineQuoteError,
  );
});

test("D-90: a pre-D-90 response with no requested_outcome reads as design; a stray quote is rejected", () => {
  assert.equal(parseIntent(intentJson({}), INPUT).requestedOutcome, "design");
  assert.equal(
    parseIntent(
      intentJson({ requested_outcome: "design", decline_quote: null }),
      INPUT,
    ).declineQuote,
    undefined,
  );
  assert.throws(
    () =>
      parseIntent(
        intentJson({
          requested_outcome: "design",
          decline_quote: "I don't want",
        }),
        INPUT,
      ),
    (error: unknown) =>
      error instanceof StageError &&
      !(error instanceof IntentDeclineQuoteError),
  );
});

test("D-90: the intent brief carries the requested outcome and the quote", () => {
  const brief = renderIntentBrief(declined);
  assert.equal(brief["requested_outcome"], "understanding_only");
  assert.equal(
    brief["decline_quote"],
    "I don't want you to design the solution",
  );
  assert.equal(renderIntentBrief(design)["decline_quote"], null);
});

// --- Stage 6: the unwarranted conclusion ---------------------------------

const context: ContextResult = {
  sufficiency: "thin",
  elements: [
    {
      content: "Four policies, one broker, once a year",
      category: "scale",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 10,
      specificityScore: 0.9,
    },
  ],
};

const architectureJson = (extra: Record<string, unknown>) =>
  JSON.stringify({
    summary: "Annual renewal review",
    data_flow_description: "Broker → office manager → directors",
    unknown_disposition: [],
    components: [],
    ...extra,
  });

const component = {
  name: "Quote Capture",
  responsibility: "Capture broker PDFs",
  inputs: "PDFs",
  outputs: "Rows",
  failure_handling: "Manual fallback",
  grounded_in_context_indices: [0],
};

test("D-90: an unwarranted verdict with no components parses, and carries its statement", () => {
  const result = parseArchitecture(
    architectureJson({
      automation_verdict: {
        warranted: false,
        statement: "Once a year and 90 minutes: keep it manual.",
      },
    }),
    context,
  );
  assert.equal(result.components.length, 0);
  assert.equal(
    result.automationUnwarranted?.statement,
    "Once a year and 90 minutes: keep it manual.",
  );
});

test("D-90: an unwarranted verdict with components designed anyway is rejected, and so is a design with none", () => {
  assert.throws(
    () =>
      parseArchitecture(
        architectureJson({
          components: [component],
          automation_verdict: {
            warranted: false,
            statement: "Keep it manual.",
          },
        }),
        context,
      ),
    /designed anyway/,
  );
  assert.throws(
    () => parseArchitecture(architectureJson({}), context),
    /at least one component/,
  );
});

test("D-90: a warranted verdict is the design as before; an empty unwarranted statement states nothing", () => {
  const result = parseArchitecture(
    architectureJson({
      components: [component],
      automation_verdict: { warranted: true, statement: "Fine" },
    }),
    context,
  );
  assert.equal(result.automationUnwarranted, undefined);
  assert.throws(
    () =>
      parseArchitecture(
        architectureJson({
          automation_verdict: { warranted: false, statement: "  " },
        }),
        context,
      ),
    /non-empty string|statement must say why/,
  );
});

test("D-90: the assessment path cannot decline to design what it was asked to assess", () => {
  assert.throws(
    () =>
      parseArchitecture(
        architectureJson({
          automation_verdict: {
            warranted: false,
            statement: "Keep it manual.",
          },
        }),
        context,
        true,
      ),
    /technical-assessment path/,
  );
});
