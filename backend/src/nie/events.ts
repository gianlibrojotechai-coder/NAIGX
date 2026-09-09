/**
 * The progress events an analysis emits while it runs (`API §7.4`, `FR-041`).
 *
 * WHY THIS EXISTS. Until now an analysis was opaque for its whole duration:
 * submit, wait sixty seconds, receive everything. `FR-041` requires artifacts
 * to "appear as they complete rather than after the full set completes", and
 * `PRD §7` puts the reason plainly — "a 60-second opaque wait is a worse
 * experience than a 60-second visible one".
 *
 * WHY THE TYPES LIVE IN THE NIE. The pipeline emits these, and `AD-02`/`AP-3`
 * forbid it importing transport. So the vocabulary is declared here, beside the
 * stage contracts that produce it, and `api/` decides that a `ClassificationEvent`
 * becomes an SSE frame. Nothing in this file knows what SSE is.
 *
 * ⚠️ NO STAGE-INTERNAL REASONING CONTENT. `API §8.2` keeps prompts, fragments,
 * provider identity and raw stage traces off this channel entirely. The payloads
 * below carry conclusions and counts — the same discipline `API-021` follows,
 * applied to a stream. A field that could hold a prompt does not exist here.
 */

import type {
  ArtifactPlanEntry,
  ArtifactType,
  ClassificationResult,
  ContextResult,
  IntentResult,
  RecommendationResult,
} from "./contracts.js";

/** `API §7.4` — the closed set of event names. */
export const ANALYSIS_EVENT_TYPES = [
  "classification",
  "understanding",
  "insufficient_context",
  "reasoning_complete",
  "plan",
  "artifact",
  "artifact_failed",
  "complete",
  "error",
] as const;

export type AnalysisEventType = (typeof ANALYSIS_EVENT_TYPES)[number];

/** After Stage 1. `FR-014` — the determination is visible and correctable. */
export interface ClassificationEvent {
  readonly type: "classification";
  readonly determinedType: string;
  readonly confidence: number;
  readonly candidateTypes: readonly string[];
  readonly wasLowConfidence: boolean;
}

/**
 * After Stage 3 — the problem as understood, which `FR-040` puts first.
 *
 * Counts by provenance rather than the elements themselves: the stream exists
 * to show progress, and the full context set is what `API-021` is for.
 */
export interface UnderstandingEvent {
  readonly type: "understanding";
  readonly primaryObjective: string;
  readonly inferredScope: string | null;
  readonly sufficiency: string;
  readonly contextCounts: {
    readonly stated: number;
    readonly inferred: number;
    readonly unknown: number;
  };
  readonly unknowns: readonly {
    readonly content: string;
    readonly resolutionHint: string | null;
  }[];
}

/** Stage 3 declined to proceed (`AI §5.4`, `FR-044`). */
export interface InsufficientContextEvent {
  readonly type: "insufficient_context";
  readonly reason: string;
  readonly unknowns: readonly {
    readonly content: string;
    readonly resolutionHint: string | null;
  }[];
}

/** After Stage 6 or 7 — reasoning is done, artifacts have not started. */
export interface ReasoningCompleteEvent {
  readonly type: "reasoning_complete";
  readonly architectureSummary: string | null;
  readonly recommendationCount: number;
  readonly decisiveGapCount: number;
}

/**
 * After Stage 8, and **always before any `artifact` event** (`API §7.4`).
 *
 * The client learns what to expect before results arrive, so the layout does
 * not jump as artifacts land. The ordering guarantee is enforced by where this
 * is emitted, not by a runtime check — Stage 8 completes before Stage 9 starts.
 */
export interface PlanEvent {
  readonly type: "plan";
  readonly planned: readonly string[];
  readonly omitted: readonly {
    readonly artifactType: string;
    readonly reason: string;
  }[];
}

/** One artifact generated and schema-valid (`FR-039`). */
export interface ArtifactEvent {
  readonly type: "artifact";
  readonly artifactType: ArtifactType;
  readonly content: unknown;
}

/**
 * One artifact attempted and not produced (`FR-091`).
 *
 * Distinct from omission, which is a `plan` decision. A reader must be able to
 * tell "tried and failed" from "chose not to", and a stream that dropped the
 * failure silently would be the defect `FR-091` names.
 */
export interface ArtifactFailedEvent {
  readonly type: "artifact_failed";
  readonly artifactType: ArtifactType;
  readonly reason: string;
  /**
   * Whether `API-032` will accept a retry for this artifact.
   *
   * `API §7.4` specifies this event's payload as "Type, failure reason, retry
   * availability", and the third part is not decoration: `FR-091` requires
   * retry to be available for a failed artifact, and a client that offered the
   * control for a *rendered* artifact would be offering a button the endpoint
   * refuses with `invalid_state`. Derived from one predicate shared with the
   * endpoint, so the stream cannot promise what the API declines.
   */
  readonly retryAvailable: boolean;
}

/** Terminal. Always emitted before the stream closes (`API §7.4`). */
export interface CompleteEvent {
  readonly type: "complete";
  readonly status: string;
  readonly degraded: boolean;
  /**
   * `FR-094`/`API §7.7` — "client notification: `complete` event with the
   * timeout flag".
   *
   * Carried separately from `status` even though a timed-out run sets both,
   * because `degraded` and `timedOut` answer different questions: the first
   * says the result is partial, the second says *why*. A run can be degraded
   * without timing out — an artifact that failed its schema — and conflating
   * them would lose the distinction the client needs to word its message.
   */
  readonly timedOut: boolean;
  readonly artifactCounts: {
    readonly generated: number;
    readonly failed: number;
    readonly omitted: number;
  };
  /** D-86: Stage 11's band, when the run reached it. */
  readonly confidenceBand?: string;
  /**
   * The run stopped by design rather than producing an analysis (`API §9.3`).
   *
   * `FR-092` declines an unsupported input at Stage 1; `AI §5.4` stops an
   * insufficient one at Stage 3. Both are terminal and neither is an error, so
   * they arrive on `complete` rather than on `error` — but a client that saw a
   * plain `complete` would go on to fetch an analysis the API answers with a
   * **422**, and would have no way to tell that outcome from an empty result.
   *
   * Absent rather than `false` when nothing was refused, matching the stored
   * columns: null there means "no refusal", not "unknown".
   */
  readonly refused?: boolean;
  readonly haltedAtStage?: number;
  readonly haltReason?: string;
}

/**
 * A halting failure. Terminal, like `complete`.
 *
 * `message` is client-facing and carries no provider identity, stack or
 * internal detail (`API §9.5`, `AI-006`) — the same rule the HTTP error
 * envelope follows.
 */
export interface ErrorEvent {
  readonly type: "error";
  readonly code: string;
  readonly message: string;
  readonly stageNumber: number | null;
}

export type AnalysisEvent =
  | ClassificationEvent
  | UnderstandingEvent
  | InsufficientContextEvent
  | ReasoningCompleteEvent
  | PlanEvent
  | ArtifactEvent
  | ArtifactFailedEvent
  | CompleteEvent
  | ErrorEvent;

/** The two events after which no further event is emitted. */
export const isTerminalEvent = (event: AnalysisEvent): boolean =>
  event.type === "complete" || event.type === "error";

// --- builders ------------------------------------------------------------
//
// Built here rather than in the pipeline so the mapping from stage result to
// event payload has one definition, and so the pipeline stays a sequence of
// stage calls rather than a sequence of stage calls interleaved with
// presentation logic.

export const classificationEvent = (
  result: ClassificationResult,
): ClassificationEvent => ({
  type: "classification",
  determinedType: result.determinedType,
  confidence: result.confidence,
  candidateTypes: [...result.candidateTypes],
  wasLowConfidence: result.wasLowConfidence,
});

const unknownsOf = (
  context: ContextResult,
): readonly { content: string; resolutionHint: string | null }[] =>
  context.elements
    .filter((element) => element.provenance === "unknown")
    .map((element) => ({
      content: element.content,
      resolutionHint: element.resolutionHint ?? null,
    }));

export const understandingEvent = (
  intent: IntentResult,
  context: ContextResult,
): UnderstandingEvent => ({
  type: "understanding",
  primaryObjective: intent.primaryObjective.content,
  inferredScope: intent.inferredScope,
  sufficiency: context.sufficiency,
  contextCounts: {
    stated: context.elements.filter((e) => e.provenance === "stated").length,
    inferred: context.elements.filter((e) => e.provenance === "inferred")
      .length,
    unknown: context.elements.filter((e) => e.provenance === "unknown").length,
  },
  unknowns: unknownsOf(context),
});

export const insufficientContextEvent = (
  reason: string,
  context: ContextResult,
): InsufficientContextEvent => ({
  type: "insufficient_context",
  reason,
  unknowns: unknownsOf(context),
});

export const planEvent = (plan: readonly ArtifactPlanEntry[]): PlanEvent => ({
  type: "plan",
  planned: plan.filter((entry) => entry.planned).map((e) => e.artifactType),
  omitted: plan
    .filter((entry) => !entry.planned)
    .map((entry) => ({
      artifactType: entry.artifactType,
      reason: entry.omissionReason ?? "No reason recorded",
    })),
});

export const reasoningCompleteEvent = (
  architectureSummary: string | null,
  recommendation?: RecommendationResult,
): ReasoningCompleteEvent => ({
  type: "reasoning_complete",
  architectureSummary,
  recommendationCount: recommendation === undefined ? 0 : 1,
  decisiveGapCount: recommendation?.verdict.decisiveGaps.length ?? 0,
});
