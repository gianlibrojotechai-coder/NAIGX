/**
 * Output schemas for the provider-side structured-output contract
 * ([D-65](../../../docs/40-D-65-Structured-Outputs-And-Sonnet-5.md)).
 *
 * ## What these are, and are not
 *
 * Each schema states the **shape** the corresponding stage parser accepts —
 * the field names, the enums, the nesting — in the dialect the provider's
 * constrained decoding supports. They are sent as `output_config.format`, by
 * task, from the Anthropic adapter. They make the *shape* failures the
 * 2026-09-08 pilot recorded (`category: "unknown"`, `decisive_gaps` not an
 * array, `specificity_score` not a number) impossible at the source.
 *
 * ⚠️ **They are not the validation.** Every parser in `stages/` still runs on
 * every response, and everything a parser checks that a schema cannot express
 * — a `source_quote` occurring in the input, a context index in range, a
 * requirement reported as matched *or* gap, a total order on `rank` — is
 * still checked there. The published artifact schemas (`schemas/*.json`)
 * remain the `FR-039` authority for artifacts; the portfolio entry below is a
 * *derived* shape, because the published one uses keywords constrained
 * decoding does not accept (`if`/`then`, `minimum`, `pattern`, `minLength`,
 * `uniqueItems`, `maxItems`). Nothing here weakens a parser or a gate.
 *
 * ## The dialect
 *
 * Verified against the structured-outputs documentation on 2026-09-09: every
 * object needs `additionalProperties: false`; `enum` and `const` are fine;
 * numeric and string constraints are not; `anyOf` with `null` expresses an
 * optional field. So a field the parser treats as optional is **required but
 * nullable** here, and the parsers already read `null` as absent
 * (`optionalString`, `conflictIdOf`, the `typeof === "string"` guards). The
 * two exceptions are `trade_offs` and `rejected_approaches`, which the
 * architecture parser rejects when present-and-not-an-array — so they are
 * required arrays, possibly empty, never null.
 *
 * ⚠️ The field vocabulary is imported from `contracts.ts`, never copied: a
 * schema that drifted from the parser would reintroduce, at the provider,
 * exactly the disagreement it exists to remove.
 */

import {
  BUILD_EFFORT,
  CLASSIFICATION_TYPES,
  COMPETENCY_STANDING,
  COMPLEXITY_FACTORS,
  CONSTRAINT_PROVENANCES,
  INTEGRATION_DIRECTIONS,
  CONTEXT_CATEGORIES,
  CONTEXT_PROVENANCE,
  GAP_PRIORITIES,
  INTENT_PROVENANCE,
  MATCH_STRENGTHS,
  MIXED_DETECTION,
  PORTFOLIO_COMPLEXITY,
  PORTFOLIO_EVIDENCE_TYPES,
  RECOMMENDATION_DECISIONS,
  REQUIREMENT_KINDS,
  REQUIREMENT_NECESSITY,
  SUFFICIENCY_LEVELS,
  UNKNOWN_DISPOSITIONS,
  REQUESTED_OUTCOMES,
} from "./contracts.js";

export type OutputSchema = Readonly<Record<string, unknown>>;

const string: OutputSchema = { type: "string" };
const number: OutputSchema = { type: "number" };
const boolean: OutputSchema = { type: "boolean" };
const integer: OutputSchema = { type: "integer" };
const nullable = (schema: OutputSchema): OutputSchema => ({
  anyOf: [schema, { type: "null" }],
});
const enumOf = (values: readonly (string | number)[]): OutputSchema => ({
  enum: [...values],
});
const array = (items: OutputSchema): OutputSchema => ({
  type: "array",
  items,
});
/**
 * A list that must not be empty. `minItems` is supported by constrained
 * decoding for the values 0 and 1 only, which is exactly enough: the
 * published portfolio schema's `nonEmptyStringList` is `minItems: 1`, and the
 * one artifact failure in the 30-run Sonnet 5 sample was an empty
 * `platforms` list that this now prevents at the source.
 */
const nonEmptyArray = (items: OutputSchema): OutputSchema => ({
  type: "array",
  minItems: 1,
  items,
});

/**
 * An object in which every property is required — except those named in
 * `optional`, which the model may omit — and nothing else is allowed. The
 * dialect permits properties outside `required` (verified 2026-09-09).
 */
const object = (
  properties: Readonly<Record<string, OutputSchema>>,
  optional: readonly string[] = [],
): OutputSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties).filter((k) => !optional.includes(k)),
  additionalProperties: false,
});

const groundedIndices = array(integer);

const inputClassification = object({
  determined_type: enumOf([...CLASSIFICATION_TYPES, MIXED_DETECTION]),
  confidence: number,
  candidate_types: array(enumOf(CLASSIFICATION_TYPES)),
  // Read only when `determined_type` is `mixed` (`AI §4.3`).
  dominant_type: nullable(enumOf(CLASSIFICATION_TYPES)),
});

const objective = object({
  content: string,
  provenance: enumOf(INTENT_PROVENANCE),
});

const intentDetection = object(
  {
    primary_objective: objective,
    secondary_objectives: array(objective),
    inferred_scope: string,
    // D-90: what the submitter asked to receive; the quote is verified by the parser.
    requested_outcome: enumOf(REQUESTED_OUTCOMES),
    decline_quote: nullable(string),
  },
  // Optional in the request schema, as why_not_consolidated is (test 3 in
  // output-schemas.test.ts): the canonical recordings captured before D-90
  // have neither key, and the parser reads absence as design. The prompt
  // asks for both on every response.
  ["requested_outcome", "decline_quote"],
);

const contextExtraction = object({
  elements: array(
    object({
      id: string,
      content: string,
      category: enumOf(CONTEXT_CATEGORIES),
      provenance: enumOf(CONTEXT_PROVENANCE),
      specificity_score: number,
      // One of the three is required by provenance; the parser decides which.
      source_quote: nullable(string),
      inference_basis: nullable(string),
      resolution_hint: nullable(string),
      conflicts_with_id: nullable(string),
    }),
  ),
  sufficiency: enumOf(SUFFICIENCY_LEVELS),
});

const component = object({
  name: string,
  responsibility: string,
  inputs: string,
  outputs: string,
  failure_handling: string,
  external_system: nullable(string),
  integration_direction: nullable(string),
  grounded_in_context_indices: groundedIndices,
});

const architectureAnalysis = object(
  {
    summary: string,
    data_flow_description: string,
    components: array(component),
    // D-78: one entry per unknown context element; the parser enforces coverage.
    unknown_disposition: array(
      object({
        context_index: integer,
        disposition: enumOf(UNKNOWN_DISPOSITIONS),
        statement: string,
      }),
    ),
    // Required by the assessment path (`FR-023`); the parser enforces that.
    trade_offs: array(object({ choice: string, accepted: string })),
    rejected_approaches: array(
      object({ approach: string, rejection_reason: string }),
    ),
    // D-90 (`FR-020`): the one conclusion that produces no design.
    automation_verdict: object({ warranted: boolean, statement: string }),
  },
  // Optional for the same reason: pre-D-90 recordings carry no verdict, and
  // the parser reads absence as warranted. The prompt requires it.
  ["automation_verdict"],
);

const workflowReview = object({
  summary: string,
  data_flow_description: string,
  structure: array(component),
  findings: array(
    object({
      component_index: integer,
      description: string,
      severity: enumOf([1, 2, 3, 4, 5]),
      likelihood: enumOf([1, 2, 3, 4, 5]),
      remediation: string,
    }),
  ),
  optimisations: array(string),
  // Required when there are no findings (`FR-021`); the parser enforces that.
  soundness_statement: nullable(string),
});

const recommendationGeneration = object({
  required_capabilities: array(
    object({
      id: string,
      name: string,
      necessity: enumOf(REQUIREMENT_NECESSITY),
      provenance: enumOf(["stated", "inferred"]),
      kind: enumOf(REQUIREMENT_KINDS),
      grounded_in_context_indices: groundedIndices,
    }),
  ),
  matched: array(
    object({
      requirement_id: string,
      capability_id: string,
      strength: enumOf(MATCH_STRENGTHS),
      evidence_ref: string,
    }),
  ),
  gaps: array(
    object({
      requirement_id: string,
      priority: enumOf(GAP_PRIORITIES),
      why_it_matters: string,
    }),
  ),
  verdict: object({
    decision: enumOf(RECOMMENDATION_DECISIONS),
    rationale: string,
    decisive_gaps: array(string),
    criteria_applied: string,
    alternatives: array(
      object({ alternative: string, rejection_reason: string }),
    ),
  }),
});

/**
 * Derived from `schemas/portfolio_suggestions.schema.json`, which stays the
 * validation authority. `why_not_consolidated` is **optional** here, exactly
 * as the published schema has it: required only for a single-gap project,
 * which the parser enforces, and rejected when present-but-empty, which the
 * published schema enforces. ⚠️ The first live Sonnet 5 run showed why it
 * cannot be required: asked for it on a multi-gap project, the model wrote
 * `""`, and the published schema correctly refused it.
 */
const portfolioSuggestions = object({
  projects: nonEmptyArray(
    object(
      {
        rank: integer,
        name: string,
        complexity: enumOf(PORTFOLIO_COMPLEXITY),
        primary_gaps: nonEmptyArray(string),
        secondary_capabilities: nonEmptyArray(string),
        why_this_project: string,
        business_problem: string,
        what_to_build: string,
        workflow: nonEmptyArray(string),
        platforms: nonEmptyArray(string),
        technical_concepts: nonEmptyArray(string),
        evidence_to_produce: nonEmptyArray(
          object({
            type: enumOf(PORTFOLIO_EVIDENCE_TYPES),
            what_it_shows: string,
          }),
        ),
        why_not_consolidated: string,
        reusability: object({
          provenance: { const: "inferred" },
          basis: string,
          claim: string,
        }),
        estimated_effort: enumOf(BUILD_EFFORT),
        portfolio_value: string,
        // D-70: how to build it on the named automation platform. Required
        // but NULLABLE: the first capture showed that an optional field is the
        // easiest thing for a model to skip, so the model must now decide —
        // the block, or an explicit null when no automation platform is named.
        implementation: nullable(
          object({
            platform: string,
            steps: nonEmptyArray(
              object({
                step: integer,
                node: string,
                purpose: string,
                setup: nonEmptyArray(string),
                credential: nullable(string),
              }),
            ),
            notes: array(string),
          }),
        ),
      },
      ["why_not_consolidated"],
    ),
  ),
  consolidation_rationale: string,
});

/**
 * Derived from `schemas/interview_guidance.schema.json` (D-76). The
 * conditional keywords the published schema uses (`if`/`then`, `maxItems`)
 * are not in the dialect; the parser enforces them. `how_to_handle_the_gap`
 * is required but nullable, as every optional field is here.
 */
const interviewGuidance = object({
  competencies: nonEmptyArray(
    object({
      rank: integer,
      name: string,
      derived_from: nonEmptyArray(string),
      why_the_posting_implies_it: string,
      be_ready_to_explain: nonEmptyArray(string),
      likely_question: string,
      evidence_to_cite: array(string),
      standing: enumOf(COMPETENCY_STANDING),
      how_to_handle_the_gap: nullable(string),
    }),
  ),
  framing: string,
});

/**
 * Derived from `schemas/platform_recommendation.schema.json` (D-78). Nullable
 * fields are required-but-nullable as everywhere here; `minItems: 1` on the
 * three lists the published schema requires non-empty.
 */
const platformRecommendation = object({
  criteria_applied: nonEmptyArray(
    object({
      criterion: string,
      context_index: nullable(integer),
      component: nullable(string),
    }),
  ),
  recommended_platform: nullable(string),
  also_required: array(object({ platform: string, role: string })),
  rationale: string,
  alternatives_rejected: nonEmptyArray(
    object({ platform: string, rejection_reason: string }),
  ),
  fit: nonEmptyArray(object({ component: string, how: string })),
  knowledge_currency_note: string,
});

/**
 * Derived from `schemas/risk_assessment.schema.json` (D-79): the same
 * published schema the workflow path renders against. `no_risks_statement`
 * is required-but-nullable here; the parser requires it exactly when the
 * list is empty.
 */
const riskAssessment = object({
  risks: array(
    object({
      component: string,
      description: string,
      severity: enumOf([1, 2, 3, 4, 5]),
      likelihood: enumOf([1, 2, 3, 4, 5]),
      mitigation: string,
    }),
  ),
  no_risks_statement: nullable(string),
});

/** D-80: the five factor scores; the arithmetic is the pipeline's. */
const complexityAssessment = object({
  factors: nonEmptyArray(
    object({
      factor: enumOf(COMPLEXITY_FACTORS.map((f) => f.key)),
      score: enumOf([1, 2, 3, 4, 5]),
      justification: string,
    }),
  ),
});

/**
 * D-82: the roadmap's phases. `estimate` is required-but-nullable here; the
 * published schema has no null, and the pipeline drops it before validating.
 */
const implementationRoadmap = object({
  phases: nonEmptyArray(
    object({
      ordinal: integer,
      name: string,
      objective: string,
      components: nonEmptyArray(string),
      depends_on: array(integer),
      outcome: string,
      estimate: nullable(
        object({ duration: string, basis_context_index: integer }),
      ),
    }),
  ),
  sequencing_rationale: string,
});

/** D-83: edge cases (at least one) and practices (may be none). */
const edgeCaseAnalysis = object({
  edge_cases: nonEmptyArray(
    object({
      component: string,
      scenario: string,
      consequence: string,
      handling: string,
    }),
  ),
  practices: array(
    object({ applies_to: string, practice: string, rationale: string }),
  ),
});

/**
 * D-84: the integrations. `no_integrations_statement` and a constraint's
 * `context_index` are required-but-nullable here; the published schema has
 * no null, and the pipeline drops them before validating.
 */
const integrationRequirements = object({
  integrations: array(
    object({
      system: string,
      component: string,
      purpose: string,
      direction: enumOf(INTEGRATION_DIRECTIONS),
      capabilities_required: nonEmptyArray(string),
      constraints: array(
        object({
          constraint: string,
          provenance: enumOf(CONSTRAINT_PROVENANCES),
          context_index: nullable(integer),
        }),
      ),
      uncertainties: array(string),
    }),
  ),
  no_integrations_statement: nullable(string),
  knowledge_currency_note: string,
});

/**
 * Keyed by the `task` the pipeline puts on each `CapabilityRequest` — the
 * stage key, or the generator key for Stage 9 (`docs/12` D-29).
 */
export const STAGE_OUTPUT_SCHEMAS: Readonly<Record<string, OutputSchema>> = {
  input_classification: inputClassification,
  intent_detection: intentDetection,
  context_extraction: contextExtraction,
  architecture_analysis: architectureAnalysis,
  workflow_review: workflowReview,
  recommendation_generation: recommendationGeneration,
  portfolio_suggestions: portfolioSuggestions,
  interview_guidance: interviewGuidance,
  platform_recommendation: platformRecommendation,
  // D-87: the same shape, generated on the workflow path.
  platform_comparison: platformRecommendation,
  risk_assessment: riskAssessment,
  complexity_assessment: complexityAssessment,
  implementation_roadmap: implementationRoadmap,
  edge_case_analysis: edgeCaseAnalysis,
  integration_requirements: integrationRequirements,
};
