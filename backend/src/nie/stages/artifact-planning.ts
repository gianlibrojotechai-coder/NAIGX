/**
 * Stage 8 — Artifact Planning, job-description path (`FR-017`, `AI` App. A).
 *
 * DETERMINISTIC, AND THAT IS THE SPECIFICATION, NOT A SIMPLIFICATION.
 * `AI` App. A is explicit about why: *"artifact selection asked of a model
 * produces an inconsistent, unexplainable, untestable set that varies between
 * runs on identical input — directly violating `FR-024`. Rules are
 * inspectable, testable, and explainable to the user."* So this module makes
 * no provider call, holds no prompt, and returns the same plan for the same
 * input every time.
 *
 * WHAT IT DECIDES is only *whether* to produce each artifact and *why* —
 * never its content. Content is Stage 9.
 *
 * OMISSION IS A RECORDED DECISION. `DB §4.4` gives ARTIFACT_PLAN_ENTRY a
 * mandatory `omission_reason` precisely so a missing artifact is never
 * ambiguous: the reader can tell "chose not to" from "tried and failed", and
 * those mean opposite things about the analysis (`FR-091`, `AIP-8`). An
 * unimplemented generator is therefore an omission with a reason, not silence.
 *
 * Pure: no provider, no database, no filesystem, no clock.
 */

import {
  IMPLEMENTED_ARTIFACT_TYPES,
  PATH_ARTIFACT_TYPES,
  isBuildableKind,
  type ArtifactOutcome,
  type ArtifactPlanEntry,
  type ArtifactType,
  type GapItem,
  type RecommendationForArtifacts,
  type RecommendationResult,
  type RequiredCapability,
} from "../contracts.js";

/**
 * The gaps a portfolio build may be recommended against.
 *
 * Three filters, all of them refusals carried forward from `docs/12` D-28:
 *
 *   · **reported** — the gap exists in the Stage 7 output, so a project can
 *     never be justified by a gap nobody found;
 *   · **technical** — `isBuildableKind`; a project closes nothing behavioural,
 *     nothing about sector history, nothing about track record;
 *   · **decisive** — it actually drove `build_first`. A gap the verdict did
 *     not rest on is real, but it is not why the operator should spend weeks.
 *
 * Derived here rather than asked of the model, per the `docs/12` D-19
 * principle: never ask the model to compute what the application can derive.
 */
export function eligibleGaps(
  recommendation: RecommendationForArtifacts,
): readonly GapItem[] {
  if (recommendation.verdict.decision !== "build_first") return [];

  const kindOf = new Map<string, RequiredCapability["kind"]>(
    recommendation.requiredCapabilities.map((r) => [r.id, r.kind]),
  );
  const decisive = new Set(recommendation.verdict.decisiveGaps);

  return recommendation.gaps.filter((gap) => {
    const kind = kindOf.get(gap.requirementId);
    return (
      kind !== undefined &&
      isBuildableKind(kind) &&
      decisive.has(gap.requirementId)
    );
  });
}

/**
 * The plan for the job-description path.
 *
 * `AI §9.1` maps this path to three artifact types. Phase 3A implements one
 * generator, so the other two are planned-out with a reason that says exactly
 * that — visible in the plan rather than inferred from an empty result.
 */
export function planArtifacts(
  recommendation: RecommendationResult,
): readonly ArtifactPlanEntry[] {
  const eligible = eligibleGaps(recommendation);
  const implemented = new Set<string>(IMPLEMENTED_ARTIFACT_TYPES);

  // Only this path's artifacts (`AI §9.1`). Walking the whole catalogue would
  // record an omission for every artifact of every other path — a Mermaid
  // diagram "omitted" from a job-description analysis answers a question
  // nobody asked.
  const types = PATH_ARTIFACT_TYPES["job_description"];

  return types.map((artifactType: ArtifactType): ArtifactPlanEntry => {
    if (!implemented.has(artifactType)) {
      return {
        artifactType,
        planned: false,
        depthLevel: "standard",
        outcome: "omitted",
        omissionReason:
          "No generator for this artifact type yet (docs/12 D-29; " +
          "skill_gap_analysis is rendered since D-75, portfolio_suggestions " +
          "generated since Phase 3A). Omitted by decision, not failure.",
      };
    }

    // D-75 — the gap analysis is a projection of the recommendation itself,
    // so it is planned whenever Stage 7 produced one, whichever way the
    // verdict went: an apply_now analysis with no gaps says so, which is a
    // finding rather than an absence.
    // D-76 — the interview guidance is derived from the same recommendation
    // and is wanted on either verdict: an apply_now operator is about to be
    // interviewed; a build_first operator will be, once the build is done.
    if (artifactType === "interview_guidance") {
      return {
        artifactType,
        planned: true,
        depthLevel: "standard",
        inclusionReason:
          `Generated from the Stage 7 recommendation: the competencies ${String(recommendation.requiredCapabilities.length)} requirement(s) imply, ` +
          `with ${String(recommendation.matched.length)} matched capability(ies) to cite (D-76).`,
      };
    }

    if (artifactType === "skill_gap_analysis") {
      return {
        artifactType,
        planned: true,
        depthLevel: "standard",
        inclusionReason:
          `Rendered from the Stage 7 recommendation: ${String(recommendation.requiredCapabilities.length)} requirement(s), ` +
          `${String(recommendation.gaps.length)} gap(s), ${String(recommendation.verdict.decisiveGaps.length)} decisive (D-75).`,
      };
    }

    if (recommendation.verdict.decision !== "build_first") {
      return {
        artifactType,
        planned: false,
        depthLevel: "standard",
        outcome: "omitted",
        omissionReason:
          "The verdict is apply_now, so there is nothing to build. Recommending a " +
          "project here would contradict the decision the analysis just reached.",
      };
    }

    if (eligible.length === 0) {
      // Unreachable through the Stage 7 parser, which requires `build_first`
      // to name at least one decisive gap and every decisive gap to be
      // technical. Handled anyway: a plan that assumes an upstream invariant
      // is a plan that breaks silently when the invariant moves.
      return {
        artifactType,
        planned: false,
        depthLevel: "standard",
        outcome: "omitted",
        omissionReason:
          "No decisive technical gap remains, so no project could be traced to one.",
      };
    }

    return {
      artifactType,
      planned: true,
      depthLevel: "standard",
      inclusionReason:
        `The verdict is build_first and ${String(eligible.length)} decisive technical ` +
        `gap(s) are buildable: ${eligible.map((g) => g.requirementId).join(", ")}.`,
    };
  });
}

/** Whether Stage 9 should run for this artifact type. */
export const isPlanned = (
  plan: readonly ArtifactPlanEntry[],
  artifactType: ArtifactType,
): boolean =>
  plan.some((entry) => entry.artifactType === artifactType && entry.planned);

/**
 * Records what became of one planned artifact (`DB §4.4`, `FR-091`).
 *
 * `DB §4.4` writes the entry at Stage 8 and sets its `outcome` at Stage 9-10,
 * so this returns a new plan rather than mutating one: the Stage 8 trace
 * already recorded what was planned, and rewriting that record afterwards would
 * make the trace disagree with itself.
 *
 * Only planned entries are touched. An unplanned entry is already `omitted` and
 * that decision is final — `FR-091` requires failed and omitted stay distinct.
 */
export const withOutcome = (
  plan: readonly ArtifactPlanEntry[],
  artifactType: ArtifactType,
  outcome: ArtifactOutcome,
): readonly ArtifactPlanEntry[] =>
  plan.map((entry) =>
    entry.artifactType === artifactType && entry.planned
      ? { ...entry, outcome }
      : entry,
  );

export const ARTIFACT_PLANNING_STAGE = {
  stageNumber: 8,
  stageKey: "artifact_planning",
} as const;
