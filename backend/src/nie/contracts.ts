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
