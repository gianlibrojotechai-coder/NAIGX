/**
 * NIE domain contracts — the typed handoffs between stages (`AI §3`).
 *
 * These types are declared here rather than imported from the generated Prisma
 * client on purpose: `AD-02`/`AP-3` forbid the NIE reaching persistence, and
 * boundary check 2 enforces it. They mirror the `DB §4.2` column vocabularies
 * exactly, so a persistence layer can map one to the other without translation.
 * Where a value set is closed in the database it is closed here.
 *
 * `FR-010` requires each stage to receive the prior stage's *structured* output.
 * That is what these types are: no stage accepts free text from another.
 */

/**
 * The five terminal classifications of `FR-011`.
 *
 * **Not six.** `AI §4.1` enumerates `mixed`, but `docs/12` D-6 establishes it as
 * an internal Stage 1 detection state that must resolve to a dominant type
 * before the stage completes. Nothing downstream can consume `mixed` — `§4.1`
 * gives it no path of its own, and `§4.3` resolves it to a dominant frame.
 */
export const CLASSIFICATION_TYPES = [
  "business_requirement",
  "existing_workflow",
  "job_description",
  "technical_assessment",
  "unsupported",
] as const;

export type ClassificationType = (typeof CLASSIFICATION_TYPES)[number];

/**
 * The intermediate detection value. Legal inside Stage 1 and nowhere else.
 * `API §4.2` defers first-class mixed output to a later version.
 */
export const MIXED_DETECTION = "mixed" as const;

/** `FR-011`: "Confidence below 0.6 triggers FR-015." */
export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.6;

/** `AI §5.3` context categories. */
export const CONTEXT_CATEGORIES = [
  "constraint",
  "environment",
  "scale",
  "dependency",
  "system",
  "objective",
] as const;

export type ContextCategory = (typeof CONTEXT_CATEGORIES)[number];

/** `DB §4.2` CONTEXT_ELEMENT, `AI §5.3`. */
export const CONTEXT_PROVENANCE = ["stated", "inferred", "unknown"] as const;
export type ContextProvenance = (typeof CONTEXT_PROVENANCE)[number];

/** `FR-012`: every intent element is labelled `stated` or `inferred`. */
export const INTENT_PROVENANCE = ["stated", "inferred"] as const;
export type IntentProvenance = (typeof INTENT_PROVENANCE)[number];

/** `AI §5.4`. */
export const SUFFICIENCY_LEVELS = [
  "sufficient",
  "thin",
  "insufficient",
] as const;
export type SufficiencyLevel = (typeof SUFFICIENCY_LEVELS)[number];

// --- Stage 1 -------------------------------------------------------------

export interface ClassificationResult {
  readonly determinedType: ClassificationType;
  /** In [0,1] (`FR-011`). Classification confidence — NOT analysis confidence. */
  readonly confidence: number;
  /** Ordered alternatives. Carries the secondary type of a mixed input (D-6). */
  readonly candidateTypes: readonly ClassificationType[];
  /** `confidence < 0.6` (`FR-011`, `FR-015`). */
  readonly wasLowConfidence: boolean;
  /**
   * True when Stage 1 detected material proportions of two types and resolved
   * to the dominant one (`AI §4.3`). Recorded so the resolution is visible;
   * `mixed` itself never leaves the stage.
   */
  readonly mixedDetected: boolean;
}

// --- Stage 2 -------------------------------------------------------------

export interface IntentObjective {
  readonly content: string;
  readonly provenance: IntentProvenance;
}

export interface IntentResult {
  readonly primaryObjective: IntentObjective;
  readonly secondaryObjectives: readonly IntentObjective[];
  readonly inferredScope: string;
}

// --- Stage 3 -------------------------------------------------------------

/**
 * One extracted context element with its provenance.
 *
 * The conditional fields are not optional decoration: `AIP-3` and the `DB §4.2`
 * CHECK constraints make a `stated` element without a span, an `inferred`
 * element without a basis, or an `unknown` without a resolution hint invalid
 * and unstorable. `DD-05` is why this is enforced at extraction rather than
 * later — provenance cannot be reconstructed after the fact.
 */
export interface ContextElement {
  readonly content: string;
  readonly category: ContextCategory;
  readonly provenance: ContextProvenance;
  /** `stated` only: half-open span `[start, end)` into the input text. */
  readonly sourceSpanStart?: number;
  readonly sourceSpanEnd?: number;
  /** `inferred` only: what the inference rests on. */
  readonly inferenceBasis?: string;
  /** `unknown` only: what would resolve it. */
  readonly resolutionHint?: string;
  /** Feeds confidence factor CF-4 (`AI §8.2`). */
  readonly specificityScore: number;
  /** Index of a conflicting element in the same set (CF-3, `AI §5.2`). */
  readonly conflictsWithIndex?: number;
}

export interface ContextResult {
  readonly elements: readonly ContextElement[];
  readonly sufficiency: SufficiencyLevel;
}

// --- Pipeline ------------------------------------------------------------

/** What Stages 1-3 collectively produce. Stage 6 consumes this in a later task. */
export interface PipelineResult {
  readonly classification: ClassificationResult;
  /** Absent when Stage 1 declined (`unsupported`, `FR-092`). */
  readonly intent?: IntentResult;
  /** Absent when Stage 1 declined, or Stage 2 halted. */
  readonly context?: ContextResult;
  /**
   * Absent when the path does not produce an architecture (`AI §9.1`), or when
   * the run halted before Stage 6.
   */
  readonly architecture?: ArchitectureResult;
  /**
   * Stage 7, job-description path only (`FR-022`). Absent on every other
   * path, and absent when no capability profile was supplied.
   */
  readonly recommendation?: RecommendationResult;
  /**
   * Stage 8, deterministic. Present whenever Stage 7 produced a verdict —
   * including when it plans nothing, because an omission with a reason is the
   * output (`DB §4.4`).
   */
  readonly artifactPlan?: readonly ArtifactPlanEntry[];
  /** Stage 9, present only when the plan included `portfolio_suggestions`. */
  readonly portfolioSuggestions?: PortfolioSuggestions;
  /** Why the pipeline stopped early, if it did. */
  readonly haltedAt?: { readonly stageNumber: number; readonly reason: string };
}

/**
 * Raised when a stage cannot produce a valid structured output.
 *
 * Every stage in 1-3 is halting (`AI` App. A), so this ends the run. It carries
 * no provider detail — provider failures arrive already normalized as
 * `ProviderError` (`SA §3.5`).
 */
export class StageError extends Error {
  readonly stageNumber: number;
  readonly stageKey: string;

  constructor(
    stageNumber: number,
    stageKey: string,
    message: string,
    options: { readonly cause?: unknown } = {},
  ) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "StageError";
    this.stageNumber = stageNumber;
    this.stageKey = stageKey;
  }
}

// --- Stage 6 -------------------------------------------------------------

/**
 * Paths that produce an architecture.
 *
 * `AI §9.1` scopes the Architecture Recommendation artifact to "Requirement,
 * assessment". `AI §4.1` agrees: a job description explicitly produces "No
 * architecture generated", and the workflow path is a review of an existing
 * structure rather than a derivation of a new one. Stage 6 is skipped, not
 * failed, for the other paths — `AI §3.2` calls it "halting for
 * architecture-producing paths", which only bites where the path produces one.
 */
export const ARCHITECTURE_PRODUCING_TYPES: readonly ClassificationType[] = [
  "business_requirement",
  "technical_assessment",
];

export const producesArchitecture = (type: ClassificationType): boolean =>
  ARCHITECTURE_PRODUCING_TYPES.includes(type);

/**
 * One component of the derived design (`FR-030`, `DB §4.3`).
 *
 * `groundedInContextIndices` is the traceability link `FR-030` requires:
 * "components addressing no stated or inferred requirement are a defect".
 * Indices refer to the Stage 3 context set, and become `CONTEXT_REFERENCE`
 * rows at persistence — the join that makes `FR-103` auditability queryable.
 */
export interface ArchitectureComponentDraft {
  readonly name: string;
  readonly responsibility: string;
  readonly inputs: string;
  readonly outputs: string;
  readonly failureHandling: string;
  /** Direction of data flow, required when an external system is involved. */
  readonly integrationDirection?: string;
  readonly externalSystem?: string;
  readonly ordinal: number;
  /** At least one, each resolving to a Stage 3 context element. */
  readonly groundedInContextIndices: readonly number[];
}

export interface ArchitectureResult {
  readonly summary: string;
  readonly dataFlowDescription: string;
  readonly components: readonly ArchitectureComponentDraft[];
}

/**
 * A Stage 6 traceability failure — the one condition `AI §3.2` says triggers a
 * single regeneration before the stage fails.
 *
 * Distinct from `StageError` so the pipeline can regenerate on this and only
 * this. A malformed response is not a traceability failure and does not earn a
 * second attempt here.
 */
export class ArchitectureTraceabilityError extends StageError {
  constructor(message: string) {
    super(6, "architecture_analysis", message);
    this.name = "ArchitectureTraceabilityError";
  }
}

// --- Stage 7 (job-description path) ---------------------------------------

/**
 * `FR-022`: "Requirements are extracted with `must-have` / `nice-to-have`
 * classification, labelled `stated` or `inferred`."
 */
export const REQUIREMENT_NECESSITY = ["must_have", "nice_to_have"] as const;
export type RequirementNecessity = (typeof REQUIREMENT_NECESSITY)[number];

/** How completely an evidenced capability covers a requirement. */
export const MATCH_STRENGTHS = ["strong", "partial"] as const;
export type MatchStrength = (typeof MATCH_STRENGTHS)[number];

/** `FR-022`: gaps carry a priority so a build can be sized against them. */
export const GAP_PRIORITIES = ["high", "medium", "low"] as const;
export type GapPriority = (typeof GAP_PRIORITIES)[number];

/**
 * What closing a requirement would actually take (`docs/12` D-28).
 *
 * WHY THIS EXISTS. Without it every requirement is implicitly capability-
 * shaped, and because the profile models only technical capabilities, anything
 * behavioural falls through to "no matchable evidence" and becomes a gap. The
 * first real run proved the cost: "track record as builder/solo operator"
 * matched `strong` while "independent operation with minimal oversight" was
 * reported as a gap — the same claim, split by phrasing alone, because the
 * model had no way to say *this is not the kind of thing a profile evidences*.
 *
 * `FR-022` already requires portfolio recommendations be "specific and
 * buildable". This vocabulary is what lets the stage honour that.
 */
export const REQUIREMENT_KINDS = [
  /** A capability an artifact can demonstrate. The only buildable kind. */
  "technical",
  /** Industry or sector exposure. Only real work in that sector closes it. */
  "domain_experience",
  /** History: years held, people trained, roles occupied. Proved by narrative. */
  "track_record",
  /** Behavioural or character attributes. Never a build target. */
  "disposition",
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

/**
 * Whether a gap on this requirement could justify building something.
 *
 * The mirror of `isMatchable` in `capability-profile.ts`, at the other end of
 * the pipeline: that predicate governs what may *support* a match, this one
 * governs what may *drive* a build. Only `technical` qualifies — a portfolio
 * project cannot close resourcefulness, five years in aerospace, or a track
 * record of training non-technical staff, and recommending one that claims to
 * would waste the scarcest thing the operator has.
 */
export const isBuildableKind = (kind: RequirementKind): boolean =>
  kind === "technical";

/**
 * The decision the stage exists to make.
 *
 * `apply_now` is first-class, not a fallback: the product maximises
 * employability rather than project count, so concluding that existing
 * evidence suffices is a valid and valuable outcome.
 */
export const RECOMMENDATION_DECISIONS = ["apply_now", "build_first"] as const;
export type RecommendationDecision = (typeof RECOMMENDATION_DECISIONS)[number];

export interface RequiredCapability {
  readonly id: string;
  readonly name: string;
  readonly necessity: RequirementNecessity;
  readonly provenance: IntentProvenance;
  /** What closing this would take, and so whether a build could (`D-28`). */
  readonly kind: RequirementKind;
  /** At least one, each resolving to a Stage 3 context element. */
  readonly groundedInContextIndices: readonly number[];
}

export interface MatchedCapability {
  readonly requirementId: string;
  /** Resolves in the capability profile, and must be matchable. */
  readonly capabilityId: string;
  readonly strength: MatchStrength;
  /** The specific evidence locator a reader could open. */
  readonly evidenceRef: string;
}

export interface GapItem {
  readonly requirementId: string;
  readonly priority: GapPriority;
  readonly whyItMatters: string;
}

export interface RecommendationVerdict {
  readonly decision: RecommendationDecision;
  readonly rationale: string;
  /** Required for `build_first`, forbidden for `apply_now`. */
  readonly decisiveGaps: readonly string[];
}

/** What Stage 7 produces on the job-description path. */
export interface RecommendationResult {
  readonly requiredCapabilities: readonly RequiredCapability[];
  readonly matched: readonly MatchedCapability[];
  readonly gaps: readonly GapItem[];
  readonly verdict: RecommendationVerdict;
}

// --- Stage 8 / Stage 9, job-description path (`docs/12` D-29) -------------

/**
 * The artifact set `AI §9.1` maps to the job-description path, and `docs/11`
 * §5 names in the corpus.
 *
 * All three are declared because Stage 8 must record an **omission reason**
 * for the ones it does not plan — `DB §4.4` exists so "chose not to" and
 * "tried and failed" are distinguishable in storage, and a type the planner
 * cannot name at all would be neither.
 */
export const ARTIFACT_TYPES = [
  "skill_gap_analysis",
  "portfolio_suggestions",
  "interview_guidance",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/** The generators that exist. Phase 3A ships one (`docs/12` D-29). */
export const IMPLEMENTED_ARTIFACT_TYPES = ["portfolio_suggestions"] as const;

/**
 * `DB §4.4` — what became of a planned artifact.
 *
 * The distinction `ARTIFACT_PLAN_ENTRY` exists for: *"omission and failure are
 * distinguishable… the user cannot tell whether the system chose not to produce
 * it or tried and failed, and those mean opposite things"* (`DB §4.4`,
 * `FR-091`, `AIP-8`).
 */
export const ARTIFACT_OUTCOMES = ["generated", "failed", "omitted"] as const;
export type ArtifactOutcome = (typeof ARTIFACT_OUTCOMES)[number];

/** `DB §4.4` ARTIFACT_PLAN_ENTRY — Stage 8 output, one row per artifact type. */
export interface ArtifactPlanEntry {
  readonly artifactType: ArtifactType;
  readonly planned: boolean;
  readonly depthLevel: "standard";
  /** Required when planned. */
  readonly inclusionReason?: string;
  /** Required when not planned. Omission is a decision, not an absence. */
  readonly omissionReason?: string;
  /**
   * `DB §4.4`: *"Written at Stage 8; `outcome` set at Stage 9–10."*
   *
   * Optional because a planned entry has no outcome until Stage 9 runs. An
   * unplanned entry is `omitted` from the moment it is planned out — that
   * decision is already final.
   */
  readonly outcome?: ArtifactOutcome;
}

/** How much work a project is, from the operator's side. */
export const PORTFOLIO_COMPLEXITY = [
  "simple",
  "intermediate",
  "advanced",
] as const;
export type PortfolioComplexity = (typeof PORTFOLIO_COMPLEXITY)[number];

/** Coarse on purpose: a model estimating hours precisely is inventing. */
export const BUILD_EFFORT = ["hours", "days", "weeks"] as const;
export type BuildEffort = (typeof BUILD_EFFORT)[number];

/**
 * What a finished project should leave behind.
 *
 * Deliberately the `EVIDENCE_TYPES` vocabulary from `capability-profile.ts`,
 * plus the two forms a build produces that an inventory entry does not
 * (`screenshot`, `test_evidence`, `sample_io`). The overlap is the point: the
 * loop is gap → project → evidence → `profile.yaml` → future match, and a
 * separate vocabulary would break it at the last step.
 */
export const PORTFOLIO_EVIDENCE_TYPES = [
  "workflow",
  "repo",
  "diagram",
  "loom",
  "doc",
  "deployment",
  "screenshot",
  "test_evidence",
  "sample_io",
] as const;
export type PortfolioEvidenceType = (typeof PORTFOLIO_EVIDENCE_TYPES)[number];

export interface PortfolioEvidence {
  readonly type: PortfolioEvidenceType;
  readonly whatItShows: string;
}

/**
 * A claim about how far a project carries beyond this posting.
 *
 * Always `inferred`, and structurally so: NAIGX holds exactly one job
 * description and nothing models the wider market, so a reusability claim is
 * reasoning about the requirements in hand — not data. `basis` must state what
 * the inference rests on, so a reader can discount it (`docs/12` D-29).
 */
export interface ReusabilityClaim {
  readonly provenance: "inferred";
  readonly basis: string;
  readonly claim: string;
}

export interface PortfolioProject {
  /** Total order over the set; 1 is built first. */
  readonly rank: number;
  readonly name: string;
  readonly complexity: PortfolioComplexity;
  /** Stage 7 gap ids. Every one technical, decisive, and reported. */
  readonly primaryGaps: readonly string[];
  /** Free text: what else it shows. Never a capability-profile id. */
  readonly secondaryCapabilities: readonly string[];
  readonly whyThisProject: string;
  readonly businessProblem: string;
  readonly whatToBuild: string;
  /** Trigger through outcome, in order. */
  readonly workflow: readonly string[];
  readonly platforms: readonly string[];
  readonly technicalConcepts: readonly string[];
  /** At least one. A project leaving no evidence closes no gap. */
  readonly evidenceToProduce: readonly PortfolioEvidence[];
  /** Required when the project claims exactly one gap. */
  readonly whyNotConsolidated?: string;
  readonly reusability: ReusabilityClaim;
  readonly estimatedEffort: BuildEffort;
  readonly portfolioValue: string;
}

/** What the Stage 9 `portfolio_suggestions` generator produces. */
export interface PortfolioSuggestions {
  readonly projects: readonly PortfolioProject[];
  /** Why this many projects and not one per gap. */
  readonly consolidationRationale: string;
}
