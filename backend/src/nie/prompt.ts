/**
 * Prompt composition (`AI §6.1`).
 *
 * "Prompts are assembled from versioned fragments. No monolithic per-path
 * template exists" (`AI-012`, `AIP-5`). This composes, in the §6.1 order:
 *
 *   Foundation  → shared by every stage: system frame, neutrality constraints,
 *                 provenance rules, refusal & uncertainty rules
 *   Stage       → the one fragment for the stage being run
 *   Type        → the path modifier, only once a type is known
 *   Output      → the schema specification and depth directive
 *
 * There is no parallel prompt store here. Fragment *content* comes from the
 * `FragmentResolver` port, which reads `PROMPT_FRAGMENT_VERSION` at runtime
 * (`docs/12` D-3) — so a fragment change takes effect without a deploy, and the
 * exact versions used are recorded per run (`AI-013`).
 */

import type { ClassificationType } from "./contracts.js";
import type { FragmentResolver, ResolvedFragment } from "./ports.js";

/** `AI §6.2` foundation fragments, shared by every stage. */
export const FOUNDATION_FRAGMENT_KEYS = [
  "foundation.system_frame",
  "foundation.neutrality_constraints",
  "foundation.provenance_rules",
  "foundation.refusal_and_uncertainty",
] as const;

/** Stage fragment key per stage (`AI §6.2` stage fragments). */
export const STAGE_FRAGMENT_KEYS: Readonly<Record<string, string>> = {
  input_classification: "stage.classification",
  intent_detection: "stage.intent",
  context_extraction: "stage.context_extraction",
  architecture_analysis: "stage.architecture_analysis",
  // Stage 6's second generator (`docs/15` D-40): the existing-workflow path
  // reviews the workflow it was given rather than designing one, so it needs
  // its own framing rather than a variant of the design prompt.
  workflow_review: "stage.workflow_review",
  recommendation_generation: "stage.recommendation_generation",
  // Stage 9 registers per generator, not per stage: generators are independent
  // (`AID-08`), so each carries its own fragment rather than sharing one.
  portfolio_suggestions: "stage.portfolio_suggestions",
  // D-76: the second generator, with its own fragment.
  interview_guidance: "stage.interview_guidance",
  // D-78: the requirement path's generator, with its own fragment.
  platform_recommendation: "stage.platform_recommendation",
  // D-79: the requirement path's risk register — generated here, rendered on
  // the workflow path, so the key is the generator's.
  risk_assessment: "stage.risk_assessment",
  // D-80: the complexity assessment, one fragment for both of its paths.
  complexity_assessment: "stage.complexity_assessment",
  // D-82: the requirement path's implementation roadmap.
  implementation_roadmap: "stage.implementation_roadmap",
  // D-83: its edge cases and practices.
  edge_case_analysis: "stage.edge_case_analysis",
  // D-84: its integration requirements.
  integration_requirements: "stage.integration_requirements",
  // D-87: the workflow path's platform comparison — the platform generator
  // under a fragment framed for an observed workflow (keep, move or stop).
  platform_comparison: "stage.platform_comparison",
};

/** Type modifier per classified path (`AI §6.1` TYPE group). */
export const TYPE_MODIFIER_FRAGMENT_KEYS: Readonly<
  Record<ClassificationType, string | null>
> = {
  business_requirement: "type.business_requirement",
  existing_workflow: "type.workflow",
  job_description: "type.job_description",
  technical_assessment: "type.assessment",
  // `AI §4.1`: declined with explanation, no reasoning performed. There is no
  // path to modify, so there is no modifier.
  unsupported: null,
};

export interface ComposedPrompt {
  /** The assembled instruction text handed to the provider. */
  readonly instructions: string;
  /** Every fragment used, in composition order — recorded per `AI-013`. */
  readonly fragments: readonly ResolvedFragment[];
}

export interface CompositionRequest {
  readonly stageKey: string;
  /** Present once Stage 1 has determined a type. */
  readonly classifiedAs?: ClassificationType;
  /** The `AI §6.1` output-contract fragment key, when the stage has one. */
  readonly outputContractKey?: string;
}

/**
 * Resolves and assembles the fragment set for one stage.
 *
 * Order is significant and fixed: foundation constraints must precede stage
 * guidance so that a stage fragment cannot appear to override a prohibition.
 */
export async function composePrompt(
  request: CompositionRequest,
  resolver: FragmentResolver,
): Promise<ComposedPrompt> {
  const stageFragmentKey = STAGE_FRAGMENT_KEYS[request.stageKey];
  if (stageFragmentKey === undefined) {
    throw new RangeError(
      `No stage fragment registered for "${request.stageKey}"`,
    );
  }

  const keys: string[] = [...FOUNDATION_FRAGMENT_KEYS, stageFragmentKey];

  if (request.classifiedAs !== undefined) {
    const modifier = TYPE_MODIFIER_FRAGMENT_KEYS[request.classifiedAs];
    if (modifier !== null) {
      keys.push(modifier);
    }
  }

  if (request.outputContractKey !== undefined) {
    keys.push(request.outputContractKey);
  }

  const resolved = await resolver.resolve(keys);

  // The resolver may return in any order; composition order is ours to hold.
  const byKey = new Map(resolved.map((f) => [f.fragmentKey, f]));
  const ordered: ResolvedFragment[] = [];
  for (const key of keys) {
    const fragment = byKey.get(key);
    if (fragment === undefined) {
      throw new RangeError(`Fragment "${key}" has no active version`);
    }
    ordered.push(fragment);
  }

  return {
    instructions: ordered.map((f) => f.content).join("\n\n"),
    fragments: ordered,
  };
}
