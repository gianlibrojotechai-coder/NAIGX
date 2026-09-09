/**
 * ⚠️ THE DRY-RUN ADAPTER. IT IS NOT A PROVIDER AND ITS OUTPUT IS NOT EVIDENCE.
 *
 * It exists so the capture path — pipeline wiring, response collection, hashing,
 * validation, writing, manifest update, refusal rules — can be exercised end to
 * end without a credential, a network call, or a cent of provider spend. That is
 * the whole of its purpose.
 *
 * WHAT IT PRODUCES is the minimum each stage will parse, derived mechanically
 * from the corpus case: the classification the corpus expects, a quote taken
 * verbatim from the input so `docs/12` D-19 provenance verification passes, and
 * one grounded component. There is no reasoning in it whatsoever.
 *
 * WHY THIS CANNOT BECOME FAKE EVIDENCE. Three independent guards:
 *
 *   1. the capture command refuses to point a dry run at the real recording
 *      store — it writes to a scratch directory and says where;
 *   2. every recording it produces carries `provider.adapter = "dry-run"`, so a
 *      stray file is identifiable on sight and in review;
 *   3. the manifest gate means any recording reaching the suite arrived through
 *      a reviewed diff (`docs/12` D-24).
 *
 * A recording captured from this adapter would tell you only that the plumbing
 * runs. It would tell you nothing about reasoning, which is the thing the corpus
 * exists to measure.
 */

import type {
  CapabilityRequest,
  CapabilityResponse,
  ProviderAdapter,
} from "../provider/capability.js";
import {
  isMatchable,
  type CapabilityProfile,
} from "../nie/capability-profile.js";
import type { CorpusCase } from "./corpus.js";

export const DRY_RUN_ADAPTER_ID = "dry-run";

/** A quote that certainly occurs in the input, for the D-19 span check. */
const quoteFrom = (inputText: string): string => {
  const firstLine = inputText.split("\n").find((l) => l.trim().length > 12);
  const line = (firstLine ?? inputText).trim();
  return line.slice(0, Math.min(48, line.length));
};

/**
 * The Stage 7 answer, built from the profile the run was actually given.
 *
 * WHY IT IS DERIVED RATHER THAN WRITTEN OUT. Stage 7 refuses a match citing a
 * capability id that does not resolve, a capability that is not matchable, or
 * an `evidence_ref` that is not one of *that capability's own* locators. A
 * hardcoded answer would therefore encode one operator's inventory into
 * application code and break the moment `profile.yaml` changed — so the ids and
 * the locator are read off the profile in hand.
 *
 * The shape is the smallest one that still exercises the whole contract: two
 * requirements so that one can be matched and one can be a gap, which is the
 * only way to reach a verdict that has both halves to weigh. Both are disposed
 * of, satisfying the `D-28` partition rule. Returns undefined when the profile
 * has nothing matchable, because there is then no honest match to build and a
 * fabricated one would be the exact failure Stage 7 exists to refuse.
 */
const recommendationFrom = (profile: CapabilityProfile): string | undefined => {
  const capability = profile.capabilities.find(isMatchable);
  const locator = capability?.evidence[0]?.locator;
  if (capability === undefined || locator === undefined) return undefined;

  return JSON.stringify({
    required_capabilities: [
      {
        id: "req-1",
        name: "Dry-run placeholder requirement, matched",
        necessity: "must_have",
        provenance: "stated",
        // `technical` on both: only a buildable gap may be decisive (D-28),
        // and req-2 has to be decisive for this fixture to reach a verdict.
        kind: "technical",
        // The dry-run context set has exactly one element, at index 0.
        grounded_in_context_indices: [0],
      },
      {
        id: "req-2",
        name: "Dry-run placeholder requirement, unmet",
        necessity: "must_have",
        provenance: "stated",
        kind: "technical",
        grounded_in_context_indices: [0],
      },
    ],
    matched: [
      {
        requirement_id: "req-1",
        capability_id: capability.id,
        strength: "strong",
        evidence_ref: locator,
      },
    ],
    gaps: [
      {
        requirement_id: "req-2",
        priority: "high",
        why_it_matters:
          "Dry-run placeholder gap; exercises the build_first path and nothing else",
      },
    ],
    verdict: {
      decision: "build_first",
      rationale:
        "Dry-run placeholder verdict: one requirement is evidenced and one is not",
      // `FR-034` / `AI-031`. The rehearsal has to satisfy the same contract the
      // paid capture will, or it certifies a path the real run cannot take —
      // which is exactly what a dry run exists to prevent.
      criteria_applied:
        "Dry-run placeholder criteria: must-have technical requirements weighed against evidenced capabilities",
      decisive_gaps: ["req-2"],
      alternatives: [
        {
          alternative: "Apply now without building",
          rejection_reason:
            "Dry-run placeholder: the decisive gap has no evidence behind it",
        },
      ],
    },
  });
};

/**
 * The Stage 9 answer, built from the gaps Stage 8 would rule eligible.
 *
 * Derived for the same reason the Stage 7 answer is: the parser refuses a
 * project citing a gap that is not decisive-and-technical, and requires every
 * eligible gap to be claimed. A written-out answer would break the moment the
 * upstream fixture changed. One project claiming every eligible gap is also
 * the shape that satisfies coverage without tripping the redundancy rule.
 */
const portfolioFrom = (eligibleIds: readonly string[]): string | undefined => {
  if (eligibleIds.length === 0) return undefined;

  return JSON.stringify({
    projects: [
      {
        rank: 1,
        name: "Dry-run placeholder project",
        complexity: "intermediate",
        primary_gaps: [...eligibleIds],
        secondary_capabilities: ["Exercises the capture path and nothing else"],
        why_this_project: "Dry-run placeholder; there is no reasoning here",
        business_problem: "Dry-run placeholder business problem",
        what_to_build: "Dry-run placeholder build",
        workflow: ["Trigger: dry-run", "Outcome: dry-run"],
        platforms: ["dry-run"],
        technical_concepts: ["dry-run"],
        evidence_to_produce: [
          { type: "repo", what_it_shows: "Dry-run placeholder evidence" },
        ],
        // Supplied whenever the set is a single gap, which the parser requires.
        ...(eligibleIds.length === 1
          ? { why_not_consolidated: "Dry-run placeholder: only one gap exists" }
          : {}),
        reusability: {
          provenance: "inferred",
          basis: "Dry-run placeholder basis",
          claim: "Dry-run placeholder claim",
        },
        estimated_effort: "days",
        portfolio_value: "None; this is plumbing output, not a recommendation",
      },
    ],
    consolidation_rationale:
      "Dry-run placeholder: one project claims every eligible gap",
  });
};

/**
 * The D-76 Stage 9 answer: one competency per requirement the Stage 7 answer
 * carries, grounded the way the parser demands (derived from a listed
 * requirement, citing only a matched capability).
 */
const interviewFrom = (
  recommendation: string | undefined,
): string | undefined => {
  if (recommendation === undefined) return undefined;
  const parsed = JSON.parse(recommendation) as {
    matched: { requirement_id: string; capability_id: string }[];
  };
  const matched = parsed.matched[0];
  if (matched === undefined) return undefined;
  return JSON.stringify({
    competencies: [
      {
        rank: 1,
        name: "Dry-run placeholder competency, evidenced",
        derived_from: [matched.requirement_id],
        why_the_posting_implies_it:
          "Dry-run placeholder; there is no posting here",
        be_ready_to_explain: ["Dry-run placeholder point"],
        likely_question: "Dry-run placeholder question?",
        evidence_to_cite: [matched.capability_id],
        standing: "evidenced",
        how_to_handle_the_gap: null,
      },
      {
        rank: 2,
        name: "Dry-run placeholder competency, a gap",
        derived_from: ["req-2"],
        why_the_posting_implies_it:
          "Dry-run placeholder; there is no posting here",
        be_ready_to_explain: ["Dry-run placeholder point"],
        likely_question: "Dry-run placeholder question?",
        evidence_to_cite: [],
        standing: "gap",
        how_to_handle_the_gap: "Dry-run placeholder handling",
      },
    ],
    framing: "Dry-run placeholder framing",
  });
};

/**
 * An adapter that answers each stage for one corpus case.
 *
 * Per case rather than global: Stage 3 must quote *this* input, and a shared
 * responder would have to guess which case it was serving.
 *
 * `capabilityProfile` is required only by the job-description path. Without it
 * a `job_description` case still runs — the pipeline halts at Stage 7 with its
 * designed "no capability profile" reason, which is itself worth exercising.
 */
export function createDryRunAdapter(
  corpusCase: CorpusCase,
  capabilityProfile?: CapabilityProfile,
): ProviderAdapter {
  const quote = quoteFrom(corpusCase.inputText);
  const type = corpusCase.expectedClassification;

  const recommendation =
    capabilityProfile === undefined
      ? undefined
      : recommendationFrom(capabilityProfile);

  const outputs: Readonly<Record<string, string | undefined>> = {
    input_classification: JSON.stringify({
      determined_type: type,
      // Matches the corpus bound so the dry run follows the same path the real
      // capture would: `below_threshold` cases exercise `FR-015`.
      confidence:
        corpusCase.expectedClassificationConfidence.bound === "below_threshold"
          ? 0.45
          : 0.9,
      candidate_types: [type],
    }),
    intent_detection: JSON.stringify({
      primary_objective: {
        content: "Dry-run placeholder objective",
        provenance: "inferred",
      },
      secondary_objectives: [],
      inferred_scope: "Dry-run placeholder scope",
    }),
    context_extraction: JSON.stringify({
      elements: [
        {
          id: "e1",
          content: "Dry-run placeholder context element",
          category: "environment",
          provenance: "stated",
          source_quote: quote,
          specificity_score: 0.5,
        },
      ],
      sufficiency:
        corpusCase.specialClass === "insufficient"
          ? "insufficient"
          : "sufficient",
    }),
    architecture_analysis: JSON.stringify({
      summary: "Dry-run placeholder architecture",
      data_flow_description: "Dry-run placeholder data flow",
      components: [
        {
          name: "Dry Run Component",
          responsibility: "Exercise the capture path and nothing else",
          inputs: "Dry-run input",
          outputs: "Dry-run output",
          failure_handling: "Not applicable; this component is not a design",
          grounded_in_context_indices: [0],
        },
      ],
    }),
    recommendation_generation: recommendation,
    // The dry-run Stage 7 answer makes req-2 the single decisive technical
    // gap, so that is exactly the eligible set Stage 8 will compute.
    portfolio_suggestions:
      recommendation === undefined ? undefined : portfolioFrom(["req-2"]),
    // D-76: the second generator, answered whenever Stage 7 was.
    interview_guidance: interviewFrom(recommendation),
  };

  return {
    capabilities: {
      structuredOutput: false,
      extendedContext: false,
      // A canned string is deterministic, and saying so is honest (`AI §10.6`).
      lowVarianceSampling: true,
      costLatencyTier: "dry-run",
    },

    invoke(request: CapabilityRequest): Promise<CapabilityResponse> {
      const output = outputs[request.task];
      if (output === undefined) {
        return Promise.reject(
          new Error(
            `the dry-run adapter has no answer for stage ${request.task}`,
          ),
        );
      }
      return Promise.resolve({
        output,
        // Zero tokens: nothing was spent, and a plausible-looking count would
        // put a fictional number into a cost path someone might later read.
        usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0 },
        degradations: [],
      });
    },
  };
}
