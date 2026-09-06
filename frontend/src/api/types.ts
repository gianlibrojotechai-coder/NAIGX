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
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "timed_out";

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
}

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
