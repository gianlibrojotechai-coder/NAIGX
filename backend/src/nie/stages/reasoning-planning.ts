/**
 * Stage 5 — Reasoning Planning (`FR-017`, `AI §5`, `AI` App. A).
 *
 * "Determine which reasoning is required and at what depth, before performing
 * it." `FR-017` requires orchestration rules be "explicit and inspectable, not
 * left entirely to model discretion" — so this is the rule set, stated once,
 * rather than a routing decision scattered through the pipeline.
 *
 * FULLY DETERMINISTIC, AND NO PROVIDER. `AI` App. A classifies this stage
 * Deterministic and `AI §3` names depth selection and planning among the
 * deterministic operations. It reads classification and returns a plan; there is
 * no model call, no I/O, and no clock.
 *
 * REDUCED IN v1 (`docs/12` D-35). `AI §5` specifies three outputs: required
 * analyses, depth level, and a complexity pre-assessment. This ships the first
 * two. The pre-assessment is **deferred and undefined** — it is not the
 * `COMPLEXITY_ASSESSMENT` artifact (`FR-033` makes that depend on the Stage 6
 * architecture and `DB §4.3` writes it at Stage 9, both after this stage), and
 * no scale, entity or vocabulary exists for it anywhere. Nothing is invented to
 * fill the gap, and this stage fabricates no complexity score.
 *
 * DEPTH IS SINGLE-VALUED (`docs/12` D-34, resolving `AIQ-7`). `"standard"` is
 * the whole domain. Proportionality is carried by the artifact set (`FR-017`),
 * and `AC-037` is tested as `DB §4.4` specifies — artifact-set size against
 * complexity score — which needs no depth taxonomy.
 */

import { producesArchitecture, type ClassificationType } from "../contracts.js";

/**
 * The reasoning modules Stage 5 may select.
 *
 * `AI §7.1` is the authority — its *Applies to* column maps every module to
 * the paths it serves. `AI §4.2` describes the paths in prose and is **not**
 * that mapping; reading it as one is what left the workflow path unrouted
 * until `docs/15` D-40.
 *
 * Values are `stageKey`s from the stage registry rather than a parallel
 * vocabulary — `stages.ts` derives those mechanically from `AI` App. A, and a
 * second naming scheme for the same stages would drift from it.
 */
export const REASONING_MODULES = [
  "architecture_analysis",
  "recommendation_generation",
  "workflow_review",
] as const;
export type ReasoningModule = (typeof REASONING_MODULES)[number];

/** `AI §5` Stage 5 output, reduced per `docs/12` D-35. */
export interface ReasoningPlan {
  /**
   * The reasoning modules this path requires, in pipeline order.
   *
   * Empty is a legitimate plan for a path `AI §4.2` maps to no module — not a
   * failure. `AI §5` says a plan producing no analyses "indicates upstream
   * failure and halts", which the pipeline judges; a path that defines no
   * reasoning has not failed at anything.
   */
  readonly requiredAnalyses: readonly ReasoningModule[];
  /** `docs/12` D-34: the whole domain. */
  readonly depthLevel: "standard";
}

/**
 * Selects the reasoning modules for a classified path.
 *
 * Pure, total over `ClassificationType`, and identical inputs give an identical
 * plan — the `FR-024` consistency property this stage is expected to hold.
 */
export function planReasoning(classifiedAs: ClassificationType): ReasoningPlan {
  const requiredAnalyses: ReasoningModule[] = [];

  // `AI §4.2`: "Architecture design applies to requirements and assessments."
  // Read through the existing predicate rather than re-listing the types, so
  // this cannot disagree with the Stage 6 gate the pipeline already applies.
  if (producesArchitecture(classifiedAs)) {
    requiredAnalyses.push("architecture_analysis");
  }

  // `AI §4.2`: "gap analysis applies to postings." `AI §4.1` gives this path
  // "No architecture generated", so the two are mutually exclusive here.
  if (classifiedAs === "job_description") {
    requiredAnalyses.push("recommendation_generation");
  }

  // `FR-021` via `AI §7.1`, resolved by `docs/15` D-40. The workflow path maps
  // to RM-1, RM-2, RM-3, RM-6, RM-7 and RM-8 — and pointedly **not** RM-4
  // Architecture Design, because this path reviews the workflow it was given
  // rather than designing a replacement. RM-6 Platform Selection is routed but
  // its artifact is deferred to M-07; RM-8 Complexity is blocked by D-33,
  // D-35 and D-36. What remains is the review itself, which carries RM-3 and
  // RM-7 as its findings.
  if (classifiedAs === "existing_workflow") {
    requiredAnalyses.push("workflow_review");
  }

  // `unsupported` falls through to an empty plan, which is correct and settled:
  // `FR-092` declines before reasoning.

  return { requiredAnalyses, depthLevel: "standard" };
}
