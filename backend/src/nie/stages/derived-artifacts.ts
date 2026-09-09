/**
 * Stage 9 generators that need no provider call (`AI §9.1`).
 *
 * WHY THESE ARE RENDERED, NOT GENERATED. Four artifacts on the workflow and
 * assessment paths restate reasoning the pipeline has already done:
 *
 *   · **Workflow Recommendation** — "review findings, structural issues,
 *     optimizations", which *is* the Stage 6W review.
 *   · **Risk Assessment** — "risk register with severity, likelihood,
 *     component, mitigation", which *is* the review's findings.
 *   · **Assessment Feedback** — "solution architecture with trade-off
 *     reasoning", which *is* the Stage 6 architecture plus `FR-023`'s
 *     trade-offs.
 *   · **Mermaid Diagram** — "nodes match architecture components", which is a
 *     transcription of those components.
 *
 * Asking a model to restate them would cost money to add nothing, and would
 * introduce a way for the artifact to disagree with the reasoning it came from.
 * `AI §9.3` wants generation guidance and validation to share one source; here
 * the reasoning result is that source, and the renderer cannot drift from it.
 *
 * These still validate against their published schemas like any artifact
 * (`FR-039`) — a rendering bug is a schema failure, caught the same way.
 *
 * Pure: no provider, no database, no clock.
 */

import {
  IMPLEMENTED_ARTIFACT_TYPES,
  PATH_ARTIFACT_TYPES,
  type ArchitectureResult,
  type ArtifactPlanEntry,
  type ArtifactType,
  type ClassificationType,
  type IntentResult,
  type WorkflowReviewResult,
} from "../contracts.js";

/**
 * The intent brief's plan entry — one, planned, on every reasoning path
 * ([D-66](../../../../docs/41-D-66-Intent-Brief-Early-Artifact.md)).
 *
 * Written at Stage 2, not Stage 8: `DB §4.4`'s "written at Stage 8" is
 * amended by D-66 to "written when the artifact's source stage completes",
 * which for every other artifact is still Stage 8. There is no judgement in
 * planning it — every input that reaches Stage 2 has an intent record — so
 * the entry records inclusion, like the derived artifacts below.
 */
export const planIntentBrief = (): readonly ArtifactPlanEntry[] => [
  {
    artifactType: "intent_brief",
    planned: true,
    depthLevel: "standard",
    inclusionReason:
      "Rendered from the Stage 2 intent record the moment it exists, so the reader has a true statement of the problem while reasoning continues (D-66, NFR-001).",
  },
];

/**
 * Intent Brief — the intent record, as an artifact.
 *
 * A projection, not a paraphrase: every field is the intent record's own
 * value with its own provenance, and `standing` is fixed here so the document
 * itself says it is understanding, not conclusion. The renderer cannot claim
 * more than Stage 2 established.
 */
export const renderIntentBrief = (
  intent: IntentResult,
): Record<string, unknown> => ({
  objective: {
    content: intent.primaryObjective.content,
    provenance: intent.primaryObjective.provenance,
  },
  secondary_objectives: intent.secondaryObjectives.map((objective) => ({
    content: objective.content,
    provenance: objective.provenance,
  })),
  inferred_scope: intent.inferredScope,
  standing: "understanding_only",
});

/**
 * Plans the artifacts of a path whose set is fixed rather than conditional.
 *
 * Unlike the job-description plan, which decides against the eligible gap set,
 * these paths produce their whole `AI §9.1` set whenever they run — there is no
 * judgement to make, so the plan records inclusion rather than deliberation.
 * Types with no generator are still listed with an omission reason, because
 * `DB §4.4` exists so "chose not to" and "has no generator" stay legible.
 */
export function planDerivedArtifacts(
  classifiedAs: ClassificationType,
  inclusionReason: string,
): readonly ArtifactPlanEntry[] {
  const implemented = new Set<string>(IMPLEMENTED_ARTIFACT_TYPES);

  return PATH_ARTIFACT_TYPES[classifiedAs].map(
    (artifactType: ArtifactType): ArtifactPlanEntry => {
      if (!implemented.has(artifactType)) {
        return {
          artifactType,
          planned: false,
          depthLevel: "standard",
          outcome: "omitted",
          omissionReason: `No generator for ${artifactType} yet. Omitted by decision, not failure.`,
        };
      }
      return {
        artifactType,
        planned: true,
        depthLevel: "standard",
        inclusionReason,
      };
    },
  );
}

/**
 * Workflow Recommendation — the review, as an artifact.
 *
 * `FR-021`'s soundness statement travels with it: a workflow with no findings
 * must say so explicitly, and an artifact that simply had an empty array would
 * be the silence the requirement rejects.
 */
export const renderWorkflowRecommendation = (
  review: WorkflowReviewResult,
): Record<string, unknown> => ({
  current_structure: {
    summary: review.summary,
    data_flow: review.dataFlowDescription,
    steps: review.structure.map((step) => ({
      name: step.name,
      responsibility: step.responsibility,
      inputs: step.inputs,
      outputs: step.outputs,
      failure_handling: step.failureHandling,
    })),
  },
  findings: review.findings.map((finding) => ({
    step: review.structure[finding.componentIndex]?.name ?? "unknown",
    description: finding.description,
    severity: finding.severity,
    remediation: finding.remediation,
  })),
  optimisations: [...review.optimisations],
  ...(review.soundnessStatement !== undefined
    ? { soundness_statement: review.soundnessStatement }
    : {}),
});

/**
 * Risk Assessment — the findings as a risk register.
 *
 * `FR-032`: every risk names a component and carries a mitigation. Both are
 * structural here because a finding cannot exist without them.
 */
export const renderRiskAssessment = (
  review: WorkflowReviewResult,
): Record<string, unknown> => ({
  risks: review.findings.map((finding) => ({
    component: review.structure[finding.componentIndex]?.name ?? "unknown",
    description: finding.description,
    severity: finding.severity,
    likelihood: finding.likelihood,
    mitigation: finding.remediation,
  })),
  ...(review.findings.length === 0 && review.soundnessStatement !== undefined
    ? { no_risks_statement: review.soundnessStatement }
    : {}),
});

/**
 * Assessment Feedback — the architecture with its trade-off reasoning.
 *
 * `FR-023`: "Output is structured for the user to understand and defend, not
 * to submit verbatim." So the rejected approaches and accepted costs are
 * first-class fields rather than prose the reader has to mine.
 */
export const renderAssessmentFeedback = (
  architecture: ArchitectureResult,
): Record<string, unknown> => ({
  approach: {
    summary: architecture.summary,
    data_flow: architecture.dataFlowDescription,
    components: architecture.components.map((component) => ({
      name: component.name,
      responsibility: component.responsibility,
      failure_handling: component.failureHandling,
    })),
  },
  trade_offs: (architecture.tradeOffs ?? []).map((tradeOff) => ({
    choice: tradeOff.choice,
    accepted: tradeOff.accepted,
  })),
  rejected_approaches: (architecture.rejectedApproaches ?? []).map((entry) => ({
    approach: entry.approach,
    rejection_reason: entry.rejectionReason,
  })),
});

/** Mermaid node ids must be identifier-safe; component names are free text. */
const nodeId = (index: number): string => `n${String(index)}`;

/** Quotes a label for a Mermaid node, which cannot contain a bare quote. */
const label = (text: string): string => text.replace(/"/g, "'");

/**
 * Mermaid Diagram — the components, as a renderable graph.
 *
 * `AI §9.1`: "Nodes match architecture components." Generated from the
 * components rather than asked for, so the two cannot disagree — a diagram
 * naming a component the architecture does not have is a defect that simply
 * has no way to occur here.
 *
 * Edges follow declared integrations. Where a component names no external
 * system the flow is sequential, which is what `data_flow_description` already
 * describes in prose.
 */
export const renderMermaidDiagram = (
  architecture: ArchitectureResult,
): Record<string, unknown> => {
  const lines = ["flowchart TD"];

  architecture.components.forEach((component, index) => {
    lines.push(`  ${nodeId(index)}["${label(component.name)}"]`);
  });

  architecture.components.forEach((component, index) => {
    if (index + 1 < architecture.components.length) {
      lines.push(`  ${nodeId(index)} --> ${nodeId(index + 1)}`);
    }
    if (component.externalSystem !== undefined) {
      const external = `ext${String(index)}`;
      lines.push(`  ${external}[("${label(component.externalSystem)}")]`);
      lines.push(
        component.integrationDirection === "inbound"
          ? `  ${external} --> ${nodeId(index)}`
          : `  ${nodeId(index)} --> ${external}`,
      );
    }
  });

  return {
    diagram: lines.join("\n"),
    node_count: architecture.components.length,
  };
};
