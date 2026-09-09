/**
 * The API contracts this client depends on (`API-020`, `API-021`, `API-026`).
 *
 * Mirrored from `backend/src/routes/analyses.ts` by hand. Nothing generates
 * these, so they are a claim about the server, not a guarantee — which is why
 * every optional field below is typed `| null` exactly where the route can
 * return null, rather than being made optional for convenience. A field the
 * server may omit and the UI may not invent has to be visible in the type.
 */

/** `DB §4.2` ANALYSIS_STATUS. */
export type AnalysisStatus =
  "queued" | "running" | "completed" | "failed" | "timed_out";

/**
 * The statuses after which nothing further will change.
 *
 * `completed` is not the only one — an analysis that failed or timed out is
 * equally final, and polling past any of them is a request that can only
 * return what it just returned.
 */
export const TERMINAL_STATUSES: readonly AnalysisStatus[] = [
  "completed",
  "failed",
  "timed_out",
];

export const isTerminal = (status: AnalysisStatus): boolean =>
  TERMINAL_STATUSES.includes(status);

/** Every response carries `meta`, on success and on error alike. */
export interface ResponseMeta {
  readonly request_id?: string;
  readonly correlation_id?: string;
  readonly timestamp?: string;
}

export interface SuccessEnvelope<T> {
  readonly data: T;
  readonly meta: ResponseMeta;
}

/** `API §9.1`. `action` is the corrective step; `FR-090` requires one where it exists. */
export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
  readonly action?: string;
  readonly field?: string;
  readonly details?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  readonly error: ApiErrorBody;
  readonly meta: ResponseMeta;
}

// --- API-020 ---------------------------------------------------------------

export interface CreatedAnalysis {
  readonly analysis_id: string;
  readonly status: AnalysisStatus;
  /**
   * `FR-004` — the anonymous credential, issued **once** at creation.
   *
   * Absent when the caller was signed in: that analysis is owned from
   * creation and has no anonymous credential. Present otherwise, and it is
   * the only way to read the analysis afterwards — the server stores a hash.
   */
  readonly anonymous_token?: string;
  readonly classification_override?: string;
  readonly supersedes_analysis_id?: string;
}

// --- API-026 ---------------------------------------------------------------

export interface AnalysisStatusResponse {
  readonly status: AnalysisStatus;
  readonly updated_at: string;
  /** `FR-091` — the run completed, but not everything it planned was produced. */
  readonly degraded: boolean;
  readonly timed_out: boolean;
}

// --- API-021 ---------------------------------------------------------------

/** `stated` and `inferred` must be distinguishable wherever shown (`FR-043`). */
export type Provenance = "stated" | "inferred" | "unknown";

export interface ContextElement {
  readonly content: string;
  readonly category: string;
  readonly provenance: Provenance;
  readonly specificity_score: number;
  readonly source_span_start: number | null;
  readonly source_span_end: number | null;
  readonly inference_basis: string | null;
  readonly resolution_hint: string | null;
}

export interface Unknown {
  readonly content: string;
  readonly resolution_hint: string | null;
}

export interface Classification {
  readonly determined_type: string;
  readonly confidence: number;
  readonly candidate_types: readonly string[];
  readonly was_low_confidence: boolean;
  readonly user_override_type: string | null;
  readonly overridden_at: string | null;
}

export interface Intent {
  readonly primary_objective: string;
  readonly inferred_scope: string | null;
  readonly objective_provenance: unknown;
}

export interface Alternative {
  readonly alternative: string;
  readonly rejection_reason: string;
}

export interface Verdict {
  /** `apply_now` or `build_first` on this path; free text in the column. */
  readonly decision: string;
  readonly rationale: string;
  /**
   * The standard the decision was weighed against (`FR-034`, `AIP-4`).
   *
   * Non-nullable at the database, so a stored verdict always has one. Typed
   * nullable here anyway: an analysis persisted before Stage 7 produced
   * criteria can still be retrieved, and the UI says so rather than crashing.
   */
  readonly criteria_applied: string | null;
  /** Null until Stage 11 exists (`docs/12` D-33). Never render a substitute. */
  readonly confidence_band: string | null;
  readonly confidence_factors: unknown | null;
  readonly alternatives: readonly Alternative[];
}

export interface Match {
  readonly capability_id: string;
  readonly strength: "strong" | "partial";
  readonly evidence_ref: string;
}

export interface Gap {
  readonly priority: "high" | "medium" | "low";
  readonly why_it_matters: string;
  readonly decisive: boolean;
}

export interface Requirement {
  readonly id: string;
  readonly name: string;
  readonly necessity: "must_have" | "nice_to_have";
  readonly provenance: Provenance;
  readonly kind: string;
  readonly matched: readonly Match[];
  readonly gaps: readonly Gap[];
}

export type ArtifactOutcome = "generated" | "failed" | "omitted" | null;

export interface ArtifactEntry {
  readonly artifact_type: string;
  readonly planned: boolean;
  readonly outcome: ArtifactOutcome;
  readonly inclusion_reason: string | null;
  readonly omission_reason: string | null;
  readonly validation_status: "valid" | "failed" | null;
  /** Present only when `validation_status` is `valid` (`DB §4.4`). */
  readonly content: unknown | null;
}

/**
 * A refusal, as `API-021` reports it (`API §9.3`).
 *
 * ⚠️ THIS DOES NOT ARRIVE ON `Analysis`. A refused analysis is answered with a
 * **422**, not a 200 with an empty body, so the client never receives an
 * `Analysis` for one. This is reconstructed from the error envelope instead —
 * which is why `unknowns` is shaped like the error `details` payload rather
 * than like `Analysis.unknowns`.
 */
export interface Refusal {
  readonly code: "unsupported_input_type" | "insufficient_context";
  readonly message: string;
  readonly action: string | null;
  /** Populated for `insufficient_context`; empty for a Stage 1 decline. */
  readonly unknowns: readonly {
    readonly missing: string;
    readonly would_resolve: string | null;
  }[];
  /** `FR-092` — what NAIGX *does* analyse. Present on the unsupported path. */
  readonly supportedTypes: readonly string[];
}

export interface Analysis {
  readonly analysis_id: string;
  readonly status: AnalysisStatus;
  readonly created_at: string;
  readonly completed_at: string | null;
  readonly derived_title: string | null;
  readonly sufficiency_level: string | null;
  readonly overall_confidence_band: string | null;
  readonly degraded: boolean;
  readonly timed_out: boolean;
  readonly input: {
    readonly character_count: number;
    readonly source_type: string;
    /** Present only for the signed-in owner (D-67 §7): the text to re-submit on a correction. */
    readonly content?: string;
  } | null;
  readonly classification: Classification | null;
  readonly intent: Intent | null;
  readonly context: readonly ContextElement[];
  readonly unknowns: readonly Unknown[];
  readonly verdict: Verdict | null;
  readonly requirements: readonly Requirement[];
  readonly decisive_gaps: readonly string[];
  readonly artifacts: readonly ArtifactEntry[];
}

// --- the portfolio_suggestions artifact ------------------------------------

/**
 * `backend/schemas/portfolio_suggestions.schema.json`.
 *
 * Typed loosely on purpose: the schema leaves `additionalProperties` open, and
 * the renderer reads known keys and ignores the rest. A stricter type here
 * would be stricter than the contract it describes.
 */
export interface PortfolioProject {
  readonly rank: number;
  readonly name: string;
  readonly complexity?: string;
  readonly primary_gaps?: readonly string[];
  readonly secondary_capabilities?: readonly string[];
  readonly why_this_project?: string;
  readonly business_problem?: string;
  readonly what_to_build?: string;
  readonly workflow?: readonly string[];
  readonly platforms?: readonly string[];
  readonly technical_concepts?: readonly string[];
  readonly evidence_to_produce?: readonly {
    readonly type: string;
    readonly what_it_shows: string;
  }[];
  readonly why_not_consolidated?: string;
  readonly reusability?: {
    readonly provenance: string;
    readonly basis: string;
    readonly claim: string;
  };
  readonly estimated_effort?: string;
  readonly portfolio_value?: string;
  /** D-70 — present only for an automation-platform workflow. */
  readonly implementation?: {
    readonly platform: string;
    readonly steps: readonly {
      readonly step: number;
      readonly node: string;
      readonly purpose: string;
      readonly setup: readonly string[];
      readonly credential: string | null;
    }[];
    readonly notes: readonly string[];
  };
}

/** D-71 — the n8n import file, as stored. */
export interface N8nWorkflow {
  readonly name: string;
  readonly nodes: readonly {
    readonly name: string;
    readonly type: string;
    readonly typeVersion: number;
    readonly parameters: Readonly<Record<string, unknown>>;
    readonly notes?: string;
  }[];
  readonly connections: Readonly<Record<string, unknown>>;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly naigx: {
    readonly standing: "scaffold";
    readonly platform: string;
    readonly steps_mapped: number;
    readonly steps_unmapped: readonly string[];
  };
}

export const asN8nWorkflow = (content: unknown): N8nWorkflow | null => {
  if (typeof content !== "object" || content === null) return null;
  const c = content as Record<string, unknown>;
  const naigx = c["naigx"];
  if (
    typeof c["name"] !== "string" ||
    !Array.isArray(c["nodes"]) ||
    typeof c["connections"] !== "object" ||
    typeof naigx !== "object" ||
    naigx === null ||
    (naigx as Record<string, unknown>)["standing"] !== "scaffold"
  ) {
    return null;
  }
  return content as N8nWorkflow;
};

export interface PortfolioSuggestions {
  readonly projects: readonly PortfolioProject[];
  readonly consolidation_rationale: string;
}

/**
 * Narrows an artifact's content without trusting it.
 *
 * The content is stored as an opaque document, so the only honest way to
 * render it is to check the shape first and fall back to reporting that it
 * could not be read — never to render a half-object as though it were whole.
 */
export const asPortfolioSuggestions = (
  content: unknown,
): PortfolioSuggestions | null => {
  if (content === null || typeof content !== "object") return null;
  const candidate = content as Partial<PortfolioSuggestions>;
  if (!Array.isArray(candidate.projects)) return null;
  if (typeof candidate.consolidation_rationale !== "string") return null;
  return candidate as PortfolioSuggestions;
};

// --- the M-11 path artifacts -----------------------------------------------
//
// Four artifact types the workflow and assessment paths produce. Unlike
// `portfolio_suggestions`, these are *rendered* server-side from reasoning the
// pipeline already did (`docs/15` D-40) rather than generated by a model — but
// nothing about that changes what arrives here. They are stored as opaque
// documents like any artifact, so they are narrowed the same way: check the
// shape, and report that it could not be read rather than render half of it.

/** `backend/schemas/workflow_recommendation.schema.json`. */
export interface WorkflowStep {
  readonly name: string;
  readonly responsibility: string;
  readonly inputs: string;
  readonly outputs: string;
  readonly failure_handling: string;
}

export interface WorkflowFinding {
  readonly step: string;
  readonly description: string;
  readonly severity: number;
  readonly remediation: string;
}

export interface WorkflowRecommendation {
  readonly current_structure: {
    readonly summary: string;
    readonly data_flow: string;
    readonly steps: readonly WorkflowStep[];
  };
  readonly findings: readonly WorkflowFinding[];
  readonly optimisations: readonly string[];
  /**
   * `FR-021`: a sound workflow says so explicitly. Present when `findings` is
   * empty, and the parser — not the schema — enforces that conditional.
   */
  readonly soundness_statement?: string;
}

export const asWorkflowRecommendation = (
  content: unknown,
): WorkflowRecommendation | null => {
  if (content === null || typeof content !== "object") return null;
  const candidate = content as Partial<WorkflowRecommendation>;
  const structure = candidate.current_structure;
  if (structure === undefined || typeof structure !== "object") return null;
  if (typeof structure.summary !== "string") return null;
  if (!Array.isArray(structure.steps) || structure.steps.length === 0) {
    return null;
  }
  if (!Array.isArray(candidate.findings)) return null;
  if (!Array.isArray(candidate.optimisations)) return null;
  return candidate as WorkflowRecommendation;
};

/** `backend/schemas/risk_assessment.schema.json`. */
export interface RiskItem {
  readonly component: string;
  readonly description: string;
  /** `docs/09` §2, 1-5. */
  readonly severity: number;
  /** `docs/09` §2, 1-5. */
  readonly likelihood: number;
  readonly mitigation: string;
}

export interface RiskAssessment {
  readonly risks: readonly RiskItem[];
  readonly no_risks_statement?: string;
}

export const asRiskAssessment = (content: unknown): RiskAssessment | null => {
  if (content === null || typeof content !== "object") return null;
  const candidate = content as Partial<RiskAssessment>;
  if (!Array.isArray(candidate.risks)) return null;
  return candidate as RiskAssessment;
};

/** `backend/schemas/assessment_feedback.schema.json`. */
export interface AssessmentComponent {
  readonly name: string;
  readonly responsibility: string;
  readonly failure_handling: string;
}

export interface AssessmentFeedback {
  readonly approach: {
    readonly summary: string;
    readonly data_flow: string;
    readonly components: readonly AssessmentComponent[];
  };
  readonly trade_offs: readonly {
    readonly choice: string;
    readonly accepted: string;
  }[];
  readonly rejected_approaches: readonly {
    readonly approach: string;
    readonly rejection_reason: string;
  }[];
}

export const asAssessmentFeedback = (
  content: unknown,
): AssessmentFeedback | null => {
  if (content === null || typeof content !== "object") return null;
  const candidate = content as Partial<AssessmentFeedback>;
  const approach = candidate.approach;
  if (approach === undefined || typeof approach !== "object") return null;
  if (typeof approach.summary !== "string") return null;
  if (!Array.isArray(approach.components)) return null;
  if (!Array.isArray(candidate.trade_offs)) return null;
  if (!Array.isArray(candidate.rejected_approaches)) return null;
  return candidate as AssessmentFeedback;
};

/** `backend/schemas/intent_brief.schema.json` (D-66). */
export interface IntentBrief {
  readonly objective: {
    readonly content: string;
    readonly provenance: "stated" | "inferred";
  };
  readonly secondary_objectives: readonly {
    readonly content: string;
    readonly provenance: "stated" | "inferred";
  }[];
  readonly inferred_scope: string;
  /** Fixed by the renderer: this artifact is understanding, not conclusion. */
  readonly standing: "understanding_only";
}

export const asIntentBrief = (content: unknown): IntentBrief | null => {
  if (content === null || typeof content !== "object") return null;
  const candidate = content as Partial<IntentBrief>;
  const objective = candidate.objective;
  if (objective === undefined || typeof objective !== "object") return null;
  if (typeof objective.content !== "string") return null;
  if (!Array.isArray(candidate.secondary_objectives)) return null;
  if (typeof candidate.inferred_scope !== "string") return null;
  if (candidate.standing !== "understanding_only") return null;
  return candidate as IntentBrief;
};

/** `backend/schemas/mermaid_diagram.schema.json`. */
export interface MermaidDiagram {
  readonly diagram: string;
  readonly node_count: number;
}

export const asMermaidDiagram = (content: unknown): MermaidDiagram | null => {
  if (content === null || typeof content !== "object") return null;
  const candidate = content as Partial<MermaidDiagram>;
  if (typeof candidate.diagram !== "string" || candidate.diagram === "") {
    return null;
  }
  if (typeof candidate.node_count !== "number") return null;
  return candidate as MermaidDiagram;
};

/** `backend/schemas/interview_guidance.schema.json` (D-76). */
export interface InterviewCompetency {
  readonly rank: number;
  readonly name: string;
  readonly derived_from: readonly string[];
  readonly why_the_posting_implies_it: string;
  readonly be_ready_to_explain: readonly string[];
  readonly likely_question: string;
  readonly evidence_to_cite: readonly string[];
  readonly standing: "evidenced" | "gap";
  readonly how_to_handle_the_gap: string | null;
}

export interface InterviewGuidance {
  readonly competencies: readonly InterviewCompetency[];
  readonly framing: string;
}

export const asInterviewGuidance = (
  content: unknown,
): InterviewGuidance | null => {
  if (content === null || typeof content !== "object") return null;
  const candidate = content as Partial<InterviewGuidance>;
  if (
    !Array.isArray(candidate.competencies) ||
    candidate.competencies.length === 0
  )
    return null;
  if (typeof candidate.framing !== "string") return null;
  return candidate as InterviewGuidance;
};

/** `backend/schemas/skill_gap_analysis.schema.json` (D-75). */
export interface SkillGapRequirement {
  readonly id: string;
  readonly name: string;
  readonly necessity: "must_have" | "nice_to_have";
  readonly kind: string;
  readonly provenance: "stated" | "inferred";
  readonly status: "evidenced" | "gap";
  readonly evidence: readonly Match[];
  readonly gap: {
    readonly priority: "high" | "medium" | "low";
    readonly why_it_matters: string;
    readonly decisive: boolean;
    readonly buildable: boolean;
  } | null;
}

export interface SkillGapAnalysis {
  readonly standing: "gap_analysis";
  readonly decision: "apply_now" | "build_first";
  readonly requirements: readonly SkillGapRequirement[];
  readonly priorities: readonly {
    readonly requirement_id: string;
    readonly name: string;
    readonly necessity: "must_have" | "nice_to_have";
    readonly priority: "high" | "medium" | "low";
    readonly decisive: boolean;
    readonly buildable: boolean;
  }[];
  readonly summary: {
    readonly requirements: number;
    readonly must_have: number;
    readonly nice_to_have: number;
    readonly evidenced: number;
    readonly gaps: number;
    readonly decisive_gaps: number;
  };
}

export const asSkillGapAnalysis = (
  content: unknown,
): SkillGapAnalysis | null => {
  if (content === null || typeof content !== "object") return null;
  const candidate = content as Partial<SkillGapAnalysis>;
  if (candidate.standing !== "gap_analysis") return null;
  if (
    !Array.isArray(candidate.requirements) ||
    candidate.requirements.length === 0
  )
    return null;
  if (!Array.isArray(candidate.priorities)) return null;
  if (candidate.summary === undefined || typeof candidate.summary !== "object")
    return null;
  return candidate as SkillGapAnalysis;
};

/** `backend/schemas/architecture_recommendation.schema.json` (D-73). */
export interface RecommendedComponent {
  readonly ordinal: number;
  readonly name: string;
  readonly responsibility: string;
  readonly inputs: string;
  readonly outputs: string;
  readonly failure_handling: string;
  readonly external_system?: string;
  readonly integration_direction?: "inbound" | "outbound" | "bidirectional";
}

export interface ArchitectureRecommendation {
  readonly standing: "recommendation";
  readonly summary: string;
  readonly data_flow: string;
  readonly components: readonly RecommendedComponent[];
  readonly trade_offs: readonly {
    readonly choice: string;
    readonly accepted: string;
  }[];
  readonly rejected_approaches: readonly {
    readonly approach: string;
    readonly rejection_reason: string;
  }[];
}

export const asArchitectureRecommendation = (
  content: unknown,
): ArchitectureRecommendation | null => {
  if (content === null || typeof content !== "object") return null;
  const candidate = content as Partial<ArchitectureRecommendation>;
  if (candidate.standing !== "recommendation") return null;
  if (typeof candidate.summary !== "string") return null;
  if (typeof candidate.data_flow !== "string") return null;
  if (!Array.isArray(candidate.components) || candidate.components.length === 0)
    return null;
  if (!Array.isArray(candidate.trade_offs)) return null;
  if (!Array.isArray(candidate.rejected_approaches)) return null;
  return candidate as ArchitectureRecommendation;
};
