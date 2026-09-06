/**
 * The ports the NIE depends on, declared by the NIE.
 *
 * `AD-02`/`AP-3` forbid the NIE importing persistence or transport, and
 * boundary check 2 enforces it mechanically. So the NIE does not reach out to
 * the trace store or the fragment tables — it declares what it needs and the
 * composition root supplies an implementation from `db/`.
 *
 * This is also why the NIE is testable with no database: every port here is
 * satisfiable by an in-memory object.
 */

import type {
  ArtifactPlanEntry,
  ArtifactType,
  ArchitectureResult,
  ClassificationResult,
  ContextResult,
  RecommendationResult,
  IntentResult,
} from "./contracts.js";

/**
 * A resolved prompt fragment version (`DB §4.5`).
 *
 * `docs/12` D-3: fragments are authored in `prompts/` and published to
 * `PROMPT_FRAGMENT_VERSION`; the runtime resolves content from the database, so
 * a rollback is an activation change and needs no deploy (`AI-014`).
 */
export interface ResolvedFragment {
  readonly fragmentKey: string;
  readonly fragmentVersionId: string;
  readonly version: string;
  readonly content: string;
}

/**
 * Resolves the currently-active version of each requested fragment.
 *
 * @throws when a required fragment has no active version. A stage running
 * without its framing fragment would produce output shaped by nothing, which
 * `AI-012`/`AIP-5` exist to prevent.
 */
export interface FragmentResolver {
  resolve(
    fragmentKeys: readonly string[],
  ): Promise<readonly ResolvedFragment[]>;
}

/**
 * One `FRAGMENT_USAGE` row (`DB §4.5`, `AI-013`).
 *
 * `AI-013` requires the *composition* be recorded, not merely a template
 * identifier — this is what makes quality attribution possible when a fragment
 * version is later suspected.
 */
export interface FragmentUsageRecord {
  readonly analysisId: string;
  readonly fragmentVersionId: string;
  readonly stage: string;
  readonly ordinal: number;
}

export interface FragmentUsageSink {
  record(usages: readonly FragmentUsageRecord[]): Promise<void>;
}

/** One `STAGE_TRACE` row (`DB §4.7`, `FR-100`). */
export interface StageTraceRecord {
  readonly stageTraceId: string;
  readonly analysisId: string;
  readonly stageNumber: number;
  readonly stageKey: string;
  readonly structuredInput: unknown;
  readonly structuredOutput: unknown;
  readonly startedAt: Date;
  readonly durationMs: number;
  readonly outcome: "success" | "failure";
  readonly failureReason: string | null;
  readonly retryCount: number;
}

/**
 * Receives a completed stage trace.
 *
 * Implementations must not throw into the caller: `DB §6.2` and `SA §3.10`
 * require trace writes to be non-blocking, and a trace failure never fails an
 * analysis. The pipeline guards this regardless.
 */
export interface StageTraceSink {
  record(trace: StageTraceRecord): Promise<void>;
}

/**
 * Receives each stage's result as that stage completes.
 *
 * `DB §6.2` requires progressive persistence: "Records are written as stages
 * complete, **not batched at the end**", so that "a failed analysis retains
 * everything up to the failure point, supporting diagnosis and partial
 * presentation (`FR-091`)". Batching at the end means a Stage 6 failure
 * discards correct Stage 1-3 work — which is what the first real run cost.
 *
 * Shaped like `StageTraceSink` and `FragmentUsageSink` deliberately: a
 * per-stage side-effect port the pipeline calls from `runStage`. The NIE never
 * sees Prisma or a row identifier (`AD-02`, boundary check 2).
 *
 * UNLIKE THE TRACE SINKS, a failure here is **not** swallowed. `DB §6.2`
 * singles out trace writes as "asynchronous and non-blocking; trace failure
 * never fails an analysis" — the exemption is granted to traces specifically.
 * A primary-domain write that fails means the analysis was not stored, and
 * `FR-060` retrieval reproduces what is stored; reporting success for an
 * analysis nobody can retrieve would be a lie.
 */
export interface StageResultSink {
  persistClassification(
    analysisId: string,
    classification: ClassificationResult,
  ): Promise<void>;
  persistIntent(analysisId: string, intent: IntentResult): Promise<void>;
  persistContext(analysisId: string, context: ContextResult): Promise<void>;
  /**
   * Stage 7, job-description path (`FR-022`). Optional so a caller wired for
   * Sprint 1 only keeps compiling; a sink that omits it simply stores no
   * recommendation.
   */
  persistRecommendation?(
    analysisId: string,
    recommendation: RecommendationResult,
  ): Promise<void>;
  persistArchitecture(
    analysisId: string,
    architecture: ArchitectureResult,
  ): Promise<void>;
  /**
   * Stage 8 (`DB §4.4` ARTIFACT_PLAN_ENTRY). Optional, for the same reason
   * `persistRecommendation` is: a sink wired for an earlier sprint keeps
   * compiling and simply stores no plan.
   */
  persistArtifactPlan?(
    analysisId: string,
    plan: readonly ArtifactPlanEntry[],
  ): Promise<void>;
  /** Stage 9 (`DB §4.4` ARTIFACT). */
  persistArtifact?(
    analysisId: string,
    artifact: PersistedArtifact,
  ): Promise<void>;
}

/**
 * One generated artifact, as the persistence layer receives it.
 *
 * The content is the **wire document** the generator returned and the schema
 * validated — not the camelCase domain object. `DB §4.4` stores it whole
 * (`DP-1`), and storing the parsed form would mean the row no longer matched
 * the definition its `validation_status` refers to.
 */
export interface PersistedArtifact {
  readonly artifactType: ArtifactType;
  readonly content: unknown;
  readonly depthLevel: string;
  readonly generationAttemptCount: number;
  /** `DB §4.4` — only `valid` artifacts are presentable. */
  readonly validationStatus: "valid" | "failed";
}
