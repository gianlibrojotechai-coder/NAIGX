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
  /**
   * Stage 6W, existing-workflow path only (`FR-021`, `docs/15` D-40).
   *
   * Carried beside `architecture` rather than instead of it: the architecture
   * field holds the *observed* structure this review identified, and this holds
   * the evaluation of it.
   */
  readonly workflowReview?: WorkflowReviewResult;
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

/**
 * A trade-off the proposed approach accepts (`FR-023`, `AI §7.1` RM-5).
 *
 * `FR-023`: "Trade-offs accepted by the proposed approach are stated." A design
 * that names no cost is either trivial or dishonest, and the assessment path
 * exists to produce something the user can defend under questioning.
 */
export interface AcceptedTradeOff {
  readonly choice: string;
  readonly accepted: string;
}

/**
 * An approach considered and not taken (`FR-023`, `AI-031`).
 *
 * The same shape `RejectedAlternative` takes on a Stage 7 verdict, and for the
 * same reason: `FR-023` requires "at least one rejected alternative approach
 * named with the reason for rejection", which has to be countable rather than
 * inferable from prose.
 */
export interface RejectedApproach {
  readonly approach: string;
  readonly rejectionReason: string;
}

export interface ArchitectureResult {
  readonly summary: string;
  readonly dataFlowDescription: string;
  readonly components: readonly ArchitectureComponentDraft[];
  /**
   * Present on the `technical_assessment` path (`FR-023`, RM-5 Trade-off
   * Evaluation); absent on `business_requirement`, which `AI §7.1` also maps
   * to RM-5 but which `FR-020` does not require to state trade-offs.
   *
   * Optional rather than empty-by-default so the two paths stay
   * distinguishable in the contract: "produced none" and "was not asked" are
   * different facts.
   */
  readonly tradeOffs?: readonly AcceptedTradeOff[];
  /** Present on the `technical_assessment` path. `FR-023` requires ≥1. */
  readonly rejectedApproaches?: readonly RejectedApproach[];
}

// --- Stage 6W, existing-workflow path (`FR-021`, `docs/15` D-40) ----------

/** `docs/09` §2 — the 1–5 integer scales risks are scored on. */
export const FINDING_SEVERITIES = [1, 2, 3, 4, 5] as const;

/**
 * One issue found in the submitted workflow.
 *
 * `FR-021`: "Each issue carries severity and a concrete remediation", and
 * "identified issues are specific to the submitted workflow, not generic
 * best-practice statements". The component reference is what makes the second
 * enforceable — a finding that cannot name the step it concerns is the generic
 * statement the requirement rejects, and `FR-032` applies the same rule to
 * risks with a NOT NULL column.
 */
export interface WorkflowFinding {
  /** Index into `structure`, so a finding always names the step it concerns. */
  readonly componentIndex: number;
  readonly description: string;
  /** `docs/09` §2 severity, 1–5. */
  readonly severity: number;
  /** `docs/09` §2 likelihood, 1–5. */
  readonly likelihood: number;
  readonly remediation: string;
}

/**
 * Stage 6W output — the workflow as it is, then what is wrong with it.
 *
 * ORDER IS THE REQUIREMENT, not a convention. `FR-021`: "Output identifies the
 * workflow's current structure before evaluating it." The structure is
 * described first because an evaluation of a structure nobody has stated is an
 * evaluation the reader cannot check.
 *
 * `docs/15` D-40: the identified structure is *observed*, not designed. It is
 * persisted through `ArchitectureModel`/`ArchitectureComponent` because that is
 * what those entities model, and the analysis's classification is what
 * distinguishes a transcription from a recommendation.
 */
export interface WorkflowReviewResult {
  /** What the submitted workflow does, described before it is judged. */
  readonly summary: string;
  readonly dataFlowDescription: string;
  /** The steps of the workflow under review. */
  readonly structure: readonly ArchitectureComponentDraft[];
  /**
   * Empty is a valid, meaningful answer.
   *
   * `FR-021`: "A sound workflow yields an explicit statement that no material
   * issues were found, not manufactured criticism." An empty findings list with
   * a stated `soundnessStatement` is that outcome; the parser requires the
   * statement precisely so silence cannot pass for approval.
   */
  readonly findings: readonly WorkflowFinding[];
  /**
   * Required when `findings` is empty — the explicit "no material issues"
   * statement `FR-021` asks for. Absent when findings exist, because the
   * findings are the answer.
   */
  readonly soundnessStatement?: string;
  /** Optimisation recommendations (`FR-021`). Free text, one per entry. */
  readonly optimisations: readonly string[];
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

/**
 * One option considered and rejected, with the reason (`AI-031`, `FR-034`).
 *
 * Modelled as a pair rather than free prose because `FR-034` requires "at least
 * one rejected alternative **named with its reason**" — countable, not
 * inferable from a paragraph. `RecommendationAlternative` was built to store
 * exactly this shape.
 */
export interface RejectedAlternative {
  readonly alternative: string;
  readonly rejectionReason: string;
}

export interface RecommendationVerdict {
  readonly decision: RecommendationDecision;
  readonly rationale: string;
  /** Required for `build_first`, forbidden for `apply_now`. */
  readonly decisiveGaps: readonly string[];
  /**
   * The criteria the decision was made against (`AI §3.2` Stage 7 output,
   * `FR-034`, `AIP-4`).
   *
   * Non-optional, because `DB §4.4`'s design note calls non-nullable
   * `criteria_applied` "the most important constraint in the schema": an
   * unexplained recommendation must be unrepresentable. A rationale says what
   * the system concluded; criteria say what it weighed to get there, and only
   * the second lets a reader disagree on the standard rather than the verdict.
   */
  readonly criteriaApplied: string;
  /**
   * What was considered and rejected (`AI-031`).
   *
   * At least one, enforced at parse. `AI §3.2` makes "name what was rejected
   * and why" a Stage 7 responsibility, and `docs/10` C-6 — the `M-9`
   * instrument — asks whether the reader can answer "why this, not the
   * alternative?". Without a named rejection there is nothing to answer with.
   */
  readonly alternatives: readonly RejectedAlternative[];
}

/**
 * The part of a Stage 7 recommendation that Stage 9 reads.
 *
 * WHY THIS EXISTS SEPARATELY. `API-032` regenerates a failed artifact by
 * *reusing stored reasoning*, and what storage can honestly return is not the
 * whole of `RecommendationResult`: `groundedInContextIndices` are positions in
 * the Stage 3 element list, while the database records grounding as references
 * to context element **ids** and `CONTEXT_ELEMENT` has no ordinal column.
 * Recovering positions after the fact would mean re-deriving an order nothing
 * ever recorded.
 *
 * So Stage 9's input is declared as exactly what it consumes. A live run
 * passes the full result, which satisfies this by structure; a retry passes
 * what came back from storage. Neither has to pretend.
 *
 * Declared here rather than in `db/` because `AD-02`/`AP-3` forbid the NIE
 * importing persistence and boundary check 2 enforces it — the NIE states the
 * shape it needs, and the persistence layer produces something assignable.
 */
export interface RecommendationForArtifacts {
  readonly requiredCapabilities: readonly Omit<
    RequiredCapability,
    "groundedInContextIndices"
  >[];
  readonly matched: readonly MatchedCapability[];
  readonly gaps: readonly GapItem[];
  readonly verdict: RecommendationVerdict;
}

/** What Stage 7 produces on the job-description path. */
export interface RecommendationResult extends RecommendationForArtifacts {
  readonly requiredCapabilities: readonly RequiredCapability[];
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
  // Every reasoning path, rendered from the Stage 2 intent record the moment
  // Stage 2 completes ([D-66](../../../docs/41-D-66-Intent-Brief-Early-Artifact.md)).
  // Not in `PATH_ARTIFACT_TYPES`: it is planned at Stage 2, not Stage 8, and
  // a path planner that listed it would plan it twice.
  "intent_brief",
  // D-71: rendered at Stage 9 from the portfolio's implementation plan —
  // planned there, like the brief at Stage 2, so not in PATH_ARTIFACT_TYPES.
  "n8n_workflow",
  // Job-description path (`docs/12` D-29).
  "skill_gap_analysis",
  "portfolio_suggestions",
  "interview_guidance",
  // Existing-workflow path (`FR-021`, `docs/15` D-40). Platform Comparison and
  // Complexity Score are `AI §9.1` artifacts of this path too: the first is
  // deferred to M-07, the second blocked by D-33/D-35/D-36. Edge Cases is
  // excluded by `MVP §5.3`. None is declared, because a declared type with no
  // generator would have to be planned and omitted on every run.
  "workflow_recommendation",
  "risk_assessment",
  // Technical-assessment path (`FR-023`).
  "assessment_feedback",
  "mermaid_diagram",
  // Business-requirement path (`FR-020`, `AI §9.1` "Architecture
  // Recommendation"), rendered from the Stage 6 architecture — D-73. The
  // path also produces `mermaid_diagram`, the same type the assessment path
  // renders. `platform_recommendation`, the path's reasoning artifact, stays
  // an open owner decision (STATUS) and is not declared.
  "architecture_recommendation",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/**
 * Which artifacts belong to which path (`AI §9.1`).
 *
 * ⚠️ ARTIFACT TYPES ARE PER PATH, NOT GLOBAL. `AI §9.1`'s *Applies to* column
 * maps every artifact to the paths that produce it, and a planner that walked
 * the whole catalogue would have to record an omission reason on every
 * artifact of every *other* path — telling a job-description reader that a
 * Mermaid diagram was "omitted", which is true of a question nobody asked.
 *
 * `business_requirement` lists the two of its `AI §9.1` artifacts that are
 * pure projections of the Stage 6 architecture (D-73): the architecture
 * recommendation and the diagram. Business analysis, platform comparison,
 * risk assessment and complexity score are reasoning work — M-07, and the
 * `platform_recommendation` decision STATUS records as the owner's — and are
 * not declared, for the reason given above: a declared type with no
 * generator would be planned and omitted on every run.
 */
export const PATH_ARTIFACT_TYPES: Readonly<
  Record<ClassificationType, readonly ArtifactType[]>
> = {
  business_requirement: ["architecture_recommendation", "mermaid_diagram"],
  existing_workflow: ["workflow_recommendation", "risk_assessment"],
  job_description: [
    "skill_gap_analysis",
    "portfolio_suggestions",
    "interview_guidance",
  ],
  technical_assessment: ["assessment_feedback", "mermaid_diagram"],
  // `FR-092` declines before reasoning; nothing is planned for a refusal.
  unsupported: [],
};

/** The generators that exist. Phase 3A ships one (`docs/12` D-29). */
export const IMPLEMENTED_ARTIFACT_TYPES = [
  "intent_brief",
  "n8n_workflow",
  "portfolio_suggestions",
  "workflow_recommendation",
  "risk_assessment",
  "assessment_feedback",
  "mermaid_diagram",
  "architecture_recommendation",
] as const;

/**
 * Artifact types produced by a provider call, as opposed to rendered.
 *
 * THIS IS WHAT MAKES RETRY MEANINGFUL. `API-032` regenerates a failed artifact
 * "without re-running the analysis", and `FR-091` requires that retry be
 * available. Both assume the second attempt can differ from the first — which
 * is true of a sampled generation and false of arithmetic. The four rendered
 * artifacts (`docs/15` D-40) are deterministic functions of reasoning already
 * stored, so a retry would recompute the identical document, fail identically,
 * and charge the user a request to learn nothing.
 *
 * A rendered artifact that failed its schema is a **defect in the renderer**,
 * and the honest response to a retry request is to say so rather than to
 * perform a gesture. `API-032` returns `invalid_state` for those.
 */
export const GENERATED_ARTIFACT_TYPES = ["portfolio_suggestions"] as const;

/**
 * Whether a failed artifact of this type is worth attempting again.
 *
 * Read by the `artifact_failed` event, whose `API §7.4` payload is "Type,
 * failure reason, **retry availability**", and by `API-032` itself. One
 * predicate, so the stream cannot advertise a retry the endpoint refuses.
 */
export const isRetryableArtifactType = (artifactType: string): boolean =>
  (GENERATED_ARTIFACT_TYPES as readonly string[]).includes(artifactType);

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
  /**
   * D-70 — how to build it on the automation platform the project names.
   * Present only when the project is such a workflow; absent otherwise.
   */
  readonly implementation?: PortfolioImplementation;
}

/** One workflow step, as a node on the named platform (D-70). */
export interface ImplementationStep {
  /** 1-based index into `workflow`. */
  readonly step: number;
  /** The platform's own node name — never invented. */
  readonly node: string;
  readonly purpose: string;
  /** What a person configures on the node. */
  readonly setup: readonly string[];
  /** The credential the node needs, by the platform's name, or null. */
  readonly credential: string | null;
}

export interface PortfolioImplementation {
  readonly platform: string;
  readonly steps: readonly ImplementationStep[];
  readonly notes: readonly string[];
}

/** What the Stage 9 `portfolio_suggestions` generator produces. */
export interface PortfolioSuggestions {
  readonly projects: readonly PortfolioProject[];
  /** Why this many projects and not one per gap. */
  readonly consolidationRationale: string;
}
