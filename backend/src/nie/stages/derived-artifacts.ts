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
  MINIMAL_PATH_ARTIFACT_TYPES,
  PATH_ARTIFACT_TYPES,
  type ArchitectureResult,
  type ArtifactPlanEntry,
  type ArtifactType,
  type ClassificationType,
  type ContextResult,
  type DepthLevel,
  type IntentResult,
  type RecommendationForArtifacts,
  type WorkflowReviewResult,
  isBuildableKind,
} from "../contracts.js";
import { MINIMAL_INPUT_CHARACTERS } from "./reasoning-planning.js";

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
  // D-90: what the submitter asked to receive, carried from Stage 2 so the
  // brief says up front whether a design is coming.
  requested_outcome: intent.requestedOutcome,
  decline_quote: intent.declineQuote ?? null,
  standing: "understanding_only",
});

/**
 * What Stage 8 reads to plan a path's artifacts by judgement
 * ([D-90](../../../../docs/65-D-90-Planning-By-Judgement.md)).
 */
export interface PathPlanSignals {
  readonly classifiedAs: ClassificationType;
  /** Stage 5's depth (`reasoning-planning.ts`). */
  readonly depthLevel: DepthLevel;
  /** The input's length, so a minimal-depth omission can say why. */
  readonly characterCount: number;
  /** Stage 2: whether the submitter declined a design. */
  readonly intent: IntentResult;
  /** Stage 6, when it ran: whether it concluded automation is unwarranted. */
  readonly architecture?: ArchitectureResult;
  /** The reason recorded on every artifact the judgement keeps. */
  readonly inclusionReason: string;
}

/** Why each artifact is left out when the path produces no design. */
const NO_DESIGN_CLAUSES: Partial<Record<ArtifactType, string>> = {
  architecture_recommendation: "no architecture is designed",
  mermaid_diagram:
    "no architecture is designed, so there is nothing to diagram",
  platform_recommendation:
    "recommending a platform would imply a build that is not being proposed",
  risk_assessment:
    "FR-032 requires every risk to name an affected component, and no design exists to have one",
  complexity_score:
    "complexity scores a proposed solution (docs/09 §1), and none is proposed",
  implementation_roadmap: "a roadmap sequences a build, and none is proposed",
  integration_requirements:
    "integration requirements derive from a design's external systems, and nothing is designed",
  edge_cases_and_practices:
    "edge cases are enumerated per component of a design, and nothing is designed",
  executive_summary:
    "there are no generated findings to summarise; the business analysis is the whole answer",
  assessment_feedback: "no architecture is designed to assess",
};

/** Why each artifact is disproportionate to a minimal input (`FR-017`, `AC-037`). */
const MINIMAL_CLAUSES: Partial<Record<ArtifactType, string>> = {
  mermaid_diagram:
    "a diagram of a design this small adds nothing the recommendation's component list does not already say",
  platform_recommendation:
    "the systems are named by the submitter, so no platform decision exists and no alternative could honestly be rejected (FR-034)",
  risk_assessment:
    "FR-020 scopes risk analysis to non-trivial requirements, and one trigger between named systems is not one",
  complexity_score:
    "FR-020 scopes complexity scoring to non-trivial requirements; a five-factor score of this would be a number with no decision attached",
  implementation_roadmap:
    "a roadmap for a design this small is its component list",
  integration_requirements:
    "the recommendation already names the systems and the direction of every flow",
  edge_cases_and_practices:
    "an input this short states no failure modes to enumerate against, and inventing them is the over-production PV §3.2 names",
  executive_summary:
    "there are no generated findings to summarise beyond the analysis and the recommendation",
  assessment_feedback:
    "FR-023's trade-off defence would reject alternatives on grounds the input did not give",
};

const omitted = (
  artifactType: ArtifactType,
  depthLevel: DepthLevel,
  omissionReason: string,
): ArtifactPlanEntry => ({
  artifactType,
  planned: false,
  depthLevel,
  outcome: "omitted",
  omissionReason,
});

/**
 * Stage 8 for the requirement, workflow and assessment paths: the artifact
 * plan, decided by judgement rather than copied from the path's list
 * ([D-90](../../../../docs/65-D-90-Planning-By-Judgement.md)).
 *
 * Until D-90 every path produced its whole `AI §9.1` set whatever the input
 * said; the M-11 measurement found the corpus contradicting that on three
 * inputs authored to test exactly this. The judgement is three rules, in
 * precedence, each with the artifact-by-artifact reason recorded on the
 * entry so `DB §4.4`'s "chose not to" stays legible:
 *
 *   1. **The submitter declined a design** (Stage 2 `understanding_only`,
 *      with the verbatim quote): the requirement path produces the business
 *      analysis and nothing that designs, chooses or scores a solution
 *      (`FR-017` proportionality; `PV §3.2` over-production).
 *   2. **Automation is unwarranted** (Stage 6's conclusion): the same set —
 *      the system states the conclusion instead of producing a design
 *      (`FR-020`).
 *   3. **Minimal depth** (Stage 5): the path's `MINIMAL_PATH_ARTIFACT_TYPES`
 *      and nothing else (`FR-017`: "minimal input yields a minimal artifact
 *      set"; `AC-037`).
 *
 * Otherwise the whole path set is planned, as before. Types with no
 * generator are still listed with an omission reason. Pure: same signals,
 * same plan (`FR-024`).
 */
export function planPathArtifacts(
  signals: PathPlanSignals,
): readonly ArtifactPlanEntry[] {
  const implemented = new Set<string>(IMPLEMENTED_ARTIFACT_TYPES);
  const { classifiedAs, depthLevel } = signals;
  const declined =
    classifiedAs === "business_requirement" &&
    signals.intent.requestedOutcome === "understanding_only"
      ? (signals.intent.declineQuote ?? "")
      : undefined;
  const unwarranted = signals.architecture?.automationUnwarranted?.statement;
  const minimal = new Set<string>(MINIMAL_PATH_ARTIFACT_TYPES[classifiedAs]);

  return PATH_ARTIFACT_TYPES[classifiedAs].map(
    (artifactType: ArtifactType): ArtifactPlanEntry => {
      if (!implemented.has(artifactType)) {
        return omitted(
          artifactType,
          depthLevel,
          `No generator for ${artifactType} yet. Omitted by decision, not failure.`,
        );
      }

      // Rule 1 — a declined design. Only the problem statement survives.
      if (declined !== undefined) {
        if (artifactType === "business_analysis") {
          return {
            artifactType,
            planned: true,
            depthLevel,
            inclusionReason: `The submitter asked for the problem written down and declined a design ("${declined}"); the business analysis is that statement (D-77, FR-017).`,
          };
        }
        return omitted(
          artifactType,
          depthLevel,
          `Omitted by judgement: the submitter declined a design — "${declined}" — and ${NO_DESIGN_CLAUSES[artifactType] ?? "this artifact presupposes one"} (FR-017 proportionality; PV §3.2 treats over-production as a defect).`,
        );
      }

      // Rule 2 — automation unwarranted. The conclusion is stated, not designed.
      if (unwarranted !== undefined) {
        if (artifactType === "business_analysis") {
          return {
            artifactType,
            planned: true,
            depthLevel,
            inclusionReason: `Automation is unwarranted (Stage 6: ${unwarranted}); the business analysis states the problem the conclusion answers (FR-020, D-77).`,
          };
        }
        return omitted(
          artifactType,
          depthLevel,
          `Omitted by judgement: automation is unwarranted — ${unwarranted} — and ${NO_DESIGN_CLAUSES[artifactType] ?? "this artifact presupposes a design"} (FR-020: the system states this rather than producing a design).`,
        );
      }

      // Rule 3 — minimal depth. The path's minimal set and nothing else.
      if (depthLevel === "minimal" && !minimal.has(artifactType)) {
        return omitted(
          artifactType,
          depthLevel,
          `Omitted by judgement: the input is ${String(signals.characterCount)} characters, at or under the ${String(MINIMAL_INPUT_CHARACTERS)}-character minimal band, and ${MINIMAL_CLAUSES[artifactType] ?? "this artifact is disproportionate to it"} (FR-017: minimal input yields a minimal artifact set; AC-037).`,
        );
      }

      return {
        artifactType,
        planned: true,
        depthLevel,
        inclusionReason:
          depthLevel === "minimal"
            ? `Planned at minimal depth (${String(signals.characterCount)} characters, at or under ${String(MINIMAL_INPUT_CHARACTERS)}): one of the artifacts a minimal input on this path supports (FR-017). ${signals.inclusionReason}`
            : signals.inclusionReason,
      };
    },
  );
}

/**
 * The pre-D-90 plan: the whole path set at standard depth, no judgement.
 *
 * Kept for callers that have no input, intent or architecture in hand — it
 * is `planPathArtifacts` with every judgement signal at its default.
 */
export function planDerivedArtifacts(
  classifiedAs: ClassificationType,
  inclusionReason: string,
): readonly ArtifactPlanEntry[] {
  return planPathArtifacts({
    classifiedAs,
    depthLevel: "standard",
    characterCount: MINIMAL_INPUT_CHARACTERS + 1,
    intent: {
      primaryObjective: { content: "unstated", provenance: "inferred" },
      secondaryObjectives: [],
      inferredScope: "",
      requestedOutcome: "design",
    },
    inclusionReason,
  });
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
/** D-78: the dispositions as an artifact carries them, with the element's content when the context is to hand. */
const dispositionsOf = (
  architecture: ArchitectureResult,
  context?: ContextResult,
): readonly Record<string, unknown>[] =>
  (architecture.unknownDispositions ?? []).map((d) => ({
    context_index: d.contextIndex,
    disposition: d.disposition,
    statement: d.statement,
    ...(context?.elements[d.contextIndex] !== undefined
      ? { content: context.elements[d.contextIndex]?.content }
      : {}),
  }));

export const renderAssessmentFeedback = (
  architecture: ArchitectureResult,
  context?: ContextResult,
): Record<string, unknown> => ({
  unknown_dispositions: dispositionsOf(architecture, context),
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

/**
 * Business Analysis — the problem as understood, as an artifact
 * ([D-77](../../../../docs/52-D-77-Business-Analysis.md)).
 *
 * `AI §9.1`: "problem as understood, objectives, constraints; precedes all
 * solution artifacts". It is a projection of Stages 2 and 3 — the intent
 * record and the context set — and of nothing later: a reader is handed the
 * problem exactly as the analysis held it before any design was reasoned,
 * with every fact carrying its provenance (`FR-043`) and every unknown
 * listed with what would resolve it (`FR-044`). The standing is fixed here
 * so the document cannot be read as a conclusion.
 */
export const renderBusinessAnalysis = (
  intent: IntentResult,
  context: ContextResult,
): Record<string, unknown> => {
  const fact = (element: ContextResult["elements"][number]) => ({
    content: element.content,
    category: element.category,
    provenance: element.provenance,
    ...(element.inferenceBasis !== undefined
      ? { inference_basis: element.inferenceBasis }
      : {}),
  });
  const known = context.elements.filter((e) => e.provenance !== "unknown");
  return {
    standing: "problem_statement",
    // D-90: Stage 2's reading of what the submitter wants back — part of the
    // problem as understood, and the reason a declined design has no
    // solution artifacts after this one.
    requested_outcome: intent.requestedOutcome,
    decline_quote: intent.declineQuote ?? null,
    objective: {
      content: intent.primaryObjective.content,
      provenance: intent.primaryObjective.provenance,
    },
    secondary_objectives: intent.secondaryObjectives.map((objective) => ({
      content: objective.content,
      provenance: objective.provenance,
    })),
    scope: intent.inferredScope,
    constraints: known.filter((e) => e.category === "constraint").map(fact),
    environment: known.filter((e) => e.category !== "constraint").map(fact),
    unknowns: context.elements
      .filter((e) => e.provenance === "unknown")
      .map((e) => ({
        content: e.content,
        category: e.category,
        resolution_hint: e.resolutionHint ?? null,
      })),
    sufficiency: context.sufficiency,
    counts: {
      elements: context.elements.length,
      stated: context.elements.filter((e) => e.provenance === "stated").length,
      inferred: context.elements.filter((e) => e.provenance === "inferred")
        .length,
      unknown: context.elements.filter((e) => e.provenance === "unknown")
        .length,
    },
  };
};

/**
 * Skill Gap Analysis — the Stage 7 requirement weighing, as an artifact
 * ([D-75](../../../../docs/50-D-75-Skill-Gap-Analysis.md)).
 *
 * `AI §9.1`: "required skills, gaps, priority; requirements classified
 * must/nice-have". Stage 7 already produced every part of that — the
 * requirements with necessity, kind and provenance (`FR-022`), the matches
 * with the evidence a screener could open, the gaps with priority and why
 * they matter, and which gaps the verdict turned on. Asking a model to
 * restate it would cost money to add nothing and could disagree with the
 * verdict it came from; so it is rendered, and Stage 10 checks it against
 * the recommendation at validation time.
 *
 * The priorities list is the one thing the hierarchy does not lay out: the
 * gaps in the order to close them — decisive first, then by priority, then
 * must-have before nice-to-have — so a reader who takes one thing away takes
 * the right one. Rendered for both verdicts: an `apply_now` analysis with
 * no gaps says so, which is a finding, not an absence.
 */
export const renderSkillGapAnalysis = (
  recommendation: RecommendationForArtifacts,
): Record<string, unknown> => {
  const decisive = new Set(recommendation.verdict.decisiveGaps);
  const gapsByRequirement = new Map(
    recommendation.gaps.map((gap) => [gap.requirementId, gap] as const),
  );
  const matchesByRequirement = new Map<
    string,
    { capability_id: string; strength: string; evidence_ref: string }[]
  >();
  for (const match of recommendation.matched) {
    const list = matchesByRequirement.get(match.requirementId) ?? [];
    list.push({
      capability_id: match.capabilityId,
      strength: match.strength,
      evidence_ref: match.evidenceRef,
    });
    matchesByRequirement.set(match.requirementId, list);
  }

  const requirements = recommendation.requiredCapabilities.map((req) => {
    const gap = gapsByRequirement.get(req.id);
    return {
      id: req.id,
      name: req.name,
      necessity: req.necessity,
      kind: req.kind,
      provenance: req.provenance,
      status: gap === undefined ? "evidenced" : "gap",
      evidence: matchesByRequirement.get(req.id) ?? [],
      gap:
        gap === undefined
          ? null
          : {
              priority: gap.priority,
              why_it_matters: gap.whyItMatters,
              decisive: decisive.has(req.id),
              buildable: isBuildableKind(req.kind),
            },
    };
  });

  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
  const NECESSITY_RANK = { must_have: 0, nice_to_have: 1 } as const;
  const priorities = requirements
    .filter((req) => req.gap !== null)
    .map((req) => ({
      requirement_id: req.id,
      name: req.name,
      necessity: req.necessity,
      priority: req.gap?.priority ?? "low",
      decisive: req.gap?.decisive ?? false,
      buildable: req.gap?.buildable ?? false,
    }))
    .sort(
      (a, b) =>
        Number(b.decisive) - Number(a.decisive) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        NECESSITY_RANK[a.necessity] - NECESSITY_RANK[b.necessity],
    );

  return {
    standing: "gap_analysis",
    decision: recommendation.verdict.decision,
    requirements,
    priorities,
    summary: {
      requirements: requirements.length,
      must_have: requirements.filter((r) => r.necessity === "must_have").length,
      nice_to_have: requirements.filter((r) => r.necessity === "nice_to_have")
        .length,
      evidenced: requirements.filter((r) => r.status === "evidenced").length,
      gaps: priorities.length,
      decisive_gaps: priorities.filter((p) => p.decisive).length,
    },
  };
};

/**
 * Architecture Recommendation — the requirement path's architecture, as an
 * artifact ([D-73](../../../../docs/48-D-73-Business-Requirement-Artifacts.md)).
 *
 * `AI §9.1` gives the requirement path an "Architecture Recommendation";
 * until D-73 the path reasoned to one and then handed the reader nothing but
 * the reasoning hierarchy. This is the same projection discipline as the
 * assessment feedback above — every field is Stage 6's own value — with two
 * differences that follow from `FR-020` rather than `FR-023`:
 *
 *   · every component carries its inputs and outputs, because a recommended
 *     design has to say what flows where before a reader can build it, and
 *     Stage 6 already produced both;
 *   · trade-offs and rejected approaches are carried when Stage 6 produced
 *     them and are otherwise empty — `FR-020` does not require them, so the
 *     renderer does not invent one to satisfy a rule that does not apply.
 *
 * `standing` is fixed here so the document says what it is: a
 * recommendation, not an assessment of something submitted.
 */
export const renderArchitectureRecommendation = (
  architecture: ArchitectureResult,
  context?: ContextResult,
): Record<string, unknown> => ({
  standing: "recommendation",
  unknown_dispositions: dispositionsOf(architecture, context),
  summary: architecture.summary,
  data_flow: architecture.dataFlowDescription,
  components: architecture.components.map((component) => ({
    ordinal: component.ordinal,
    name: component.name,
    responsibility: component.responsibility,
    inputs: component.inputs,
    outputs: component.outputs,
    failure_handling: component.failureHandling,
    ...(component.externalSystem !== undefined
      ? { external_system: component.externalSystem }
      : {}),
    ...(component.integrationDirection === "inbound" ||
    component.integrationDirection === "outbound" ||
    component.integrationDirection === "bidirectional"
      ? { integration_direction: component.integrationDirection }
      : {}),
  })),
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
