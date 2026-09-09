/**
 * Executive Summary — rendered from the analysis's own settled results
 * ([D-85](../../../../docs/60-D-85-Executive-Summary.md), `FR-038`).
 *
 * `FR-038` asks for a non-technical summary of the problem, the approach, the
 * principal risks and the complexity, "consistent with the detailed
 * artifacts; contradiction between them is a defect". This module makes the
 * third criterion true BY CONSTRUCTION: nothing here is generated. The
 * headline is the intent record's objective; the approach is the
 * architecture's own summary and component names; the platform is the
 * recommendation's; the risks are the register's top three by score; the
 * complexity is the score already computed; the phases are the roadmap's.
 * Stage 10 recomputes every projection against the source it came from.
 *
 * The connective prose is the renderer's and is plain. The quoted content is
 * the analysis's own — which is what a summary of it must be. A section
 * whose source artifact did not generate is absent, and `not_summarised`
 * names it, so the reader is never shown a summary of something that does
 * not exist.
 */

import type {
  ArchitectureResult,
  ComplexityAssessment,
  ContextResult,
  ImplementationRoadmap,
  IntentResult,
  PlatformRecommendation,
  RiskRegister,
} from "../contracts.js";

export const EXECUTIVE_SUMMARY_STANDING = "summary_of_detailed_artifacts";

/** The band a 20–100 score falls in, as the presenter labels it. */
export const complexityBand = (
  score: number,
): "low" | "moderate" | "high" | "severe" =>
  score >= 80
    ? "severe"
    : score >= 60
      ? "high"
      : score >= 40
        ? "moderate"
        : "low";

/** The register's highest-scoring risks, at most three, in register order. */
export const principalRisks = (register: RiskRegister): RiskRegister["risks"] =>
  register.risks.slice(0, 3);

export interface ExecutiveSummarySources {
  readonly intent: IntentResult;
  readonly context: ContextResult;
  readonly architecture: ArchitectureResult;
  readonly platform?: PlatformRecommendation;
  readonly riskRegister?: RiskRegister;
  readonly complexity?: ComplexityAssessment;
  readonly roadmap?: ImplementationRoadmap;
  /** Human names of the artifacts that did not generate. */
  readonly notSummarised: readonly string[];
}

export const renderExecutiveSummary = (
  s: ExecutiveSummarySources,
): Record<string, unknown> => ({
  standing: EXECUTIVE_SUMMARY_STANDING,
  headline: s.intent.primaryObjective.content,
  problem: {
    objective: s.intent.primaryObjective.content,
    scope: s.intent.inferredScope,
    key_constraints: s.context.elements
      .filter((e) => e.category === "constraint" && e.provenance === "stated")
      .slice(0, 3)
      .map((e) => e.content),
    open_questions: s.context.elements.filter((e) => e.provenance === "unknown")
      .length,
  },
  approach: {
    summary: s.architecture.summary,
    components: s.architecture.components.map((c) => c.name),
    data_flow: s.architecture.dataFlowDescription,
  },
  ...(s.platform !== undefined
    ? {
        platform: {
          recommended: s.platform.recommendedPlatform,
          rationale: s.platform.rationale,
        },
      }
    : {}),
  ...(s.riskRegister !== undefined
    ? {
        principal_risks: principalRisks(s.riskRegister).map((r) => ({
          component: r.component,
          description: r.description,
          severity: r.severity,
          likelihood: r.likelihood,
        })),
      }
    : {}),
  ...(s.complexity !== undefined
    ? {
        complexity: {
          score: s.complexity.complexityScore,
          band: complexityBand(s.complexity.complexityScore),
        },
      }
    : {}),
  ...(s.roadmap !== undefined
    ? {
        phases: s.roadmap.phases.map((p) => ({
          ordinal: p.ordinal,
          name: p.name,
          outcome: p.outcome,
        })),
      }
    : {}),
  not_summarised: [...s.notSummarised],
});
