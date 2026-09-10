/**
 * The NIE pipeline runner — stages 1-3 (`FR-010`).
 *
 * `FR-010` fixes the order and forbids bypass: "Each stage receives the prior
 * stage's structured output; no stage is bypassed." Every stage therefore runs
 * through `runStage` and nowhere else, which is what makes `AP-8`/`FR-100`
 * — every stage emits a trace event — structurally true rather than a
 * convention. Boundary check 6 enforces that no stage module is invoked outside
 * this file.
 *
 * PROVIDER NEUTRALITY. This imports the provider *abstraction* (`invoke.js`,
 * `capability.js`) and never an adapter or a registry that knows one. There is
 * no provider name in this module and no branch on provider identity
 * (`AI-001`, `AI §10.6`, boundary check 1).
 *
 * NO ROUTING. `AI §10.3` per-stage routing is Sprint 2 (`AIQ-6`); the caller
 * supplies one invoker and every stage uses it.
 */

import { randomUUID } from "node:crypto";

import type { CapabilityRequest } from "../provider/capability.js";
import type { InvocationContext, ProviderInvoker } from "../provider/invoke.js";
import {
  ArchitectureTraceabilityError,
  StageError,
  isRetryableArtifactType,
  isRetryableArtifact,
  type ArchitectureResult,
  type ArtifactOutcome,
  type ClassificationResult,
  type ClassificationType,
  type ContextResult,
  type IntentResult,
  type GapItem,
  type PipelineResult,
  type PortfolioSuggestions,
  type RecommendationResult,
  type ArtifactPlanEntry,
  type GeneratedArtifactType,
  type RetryableArtifactType,
  type InterviewGuidance,
  type PlatformRecommendation,
  type RiskRegister,
  type ComplexityAssessment,
  type ImplementationRoadmap,
  type EdgeCaseAnalysis,
  type IntegrationRequirements,
  type ArtifactType,
  type RecommendationForArtifacts,
  type WorkflowReviewResult,
} from "./contracts.js";
import { composePrompt, type ComposedPrompt } from "./prompt.js";
import type { CapabilityProfile } from "./capability-profile.js";
import { parseRecommendation } from "./stages/recommendation-generation.js";
import { parseInterviewGuidance } from "./stages/interview-guidance.js";
import { parsePlatformRecommendation } from "./stages/platform-recommendation.js";
import { parseRiskRegister } from "./stages/risk-assessment.js";
import { parseImplementationRoadmap } from "./stages/implementation-roadmap.js";
import { parseEdgeCaseAnalysis } from "./stages/edge-case-analysis.js";
import { parseIntegrationRequirements } from "./stages/integration-requirements.js";
import { renderExecutiveSummary } from "./stages/executive-summary.js";
import { evaluateConfidence } from "./stages/confidence-evaluation.js";
import { renderConfidence } from "./confidence-wire.js";
import { CONFIDENCE_MODEL_V1 } from "./confidence-model.js";
import {
  parseComplexityFactors,
  renderComplexityScore,
} from "./stages/complexity-assessment.js";
import {
  eligibleGaps,
  isPlanned,
  withOutcome,
  planArtifacts,
} from "./stages/artifact-planning.js";
import { parsePortfolioSuggestions } from "./stages/portfolio-suggestions.js";
import {
  n8nProjectOf,
  planN8nWorkflow,
  renderN8nWorkflow,
} from "./stages/n8n-workflow.js";
import {
  checkInternalConsistency,
  ResponseValidationError,
  validateReasoning,
  type ReasoningContext,
  type ValidationClass,
  type ValidationFinding,
} from "./stages/response-validation.js";
import { AssemblyError, assembleResponse } from "./stages/response-assembly.js";
import {
  classificationEvent,
  insufficientContextEvent,
  planEvent,
  reasoningCompleteEvent,
  understandingEvent,
  type AnalysisEvent,
} from "./events.js";
import type {
  AnalysisEventSink,
  FragmentResolver,
  FragmentUsageRecord,
  FragmentUsageSink,
  StageResultSink,
  ValidationEventSink,
  StageTraceSink,
} from "./ports.js";
import { stageByNumber } from "./stages.js";
import {
  parseClassification,
  proceedsToReasoning as classificationProceeds,
} from "./stages/classification.js";
import { IntentDeclineQuoteError, parseIntent } from "./stages/intent.js";
import {
  parseContext,
  proceedsToReasoning as contextProceeds,
} from "./stages/context-extraction.js";
import { parseArchitecture } from "./stages/architecture-analysis.js";
import {
  parseWorkflowReview,
  WorkflowReviewGroundingError,
} from "./stages/workflow-review.js";
import {
  planIntentBrief,
  planPathArtifacts,
  renderIntentBrief,
  renderArchitectureRecommendation,
  renderAssessmentFeedback,
  renderBusinessAnalysis,
  renderSkillGapAnalysis,
  renderMermaidDiagram,
  renderRiskAssessment,
  renderWorkflowRecommendation,
} from "./stages/derived-artifacts.js";
import { planReasoning } from "./stages/reasoning-planning.js";
import {
  ArtifactSchemaError,
  correctionFor,
  validateArtifact,
} from "./artifact-validation.js";
import { parseStructured } from "./parse.js";

export interface PipelineDependencies {
  readonly invoker: ProviderInvoker;
  readonly resolver: FragmentResolver;
  readonly traceSink: StageTraceSink;
  /**
   * `M-10` schema validity. Optional: an instance with no trace store still
   * validates artifacts, it simply records no measurement of having done so.
   */
  readonly validationSink?: ValidationEventSink;
  readonly fragmentUsageSink: FragmentUsageSink;
  /**
   * Receives each stage's result as it completes (`DB §6.2`, `FR-091`).
   *
   * Optional so a caller that only wants to observe reasoning — the unit and
   * pipeline tests — needs no database. When absent nothing is persisted, and
   * that is a caller's choice rather than a silent loss.
   */
  readonly resultSink?: StageResultSink;
  /** Receives progress events (`FR-041`). Absent means no stream is watching. */
  readonly eventSink?: AnalysisEventSink;
  readonly modelVersionId: string;
  readonly modelKey: string;
  /**
   * The operator capability profile Stage 7 matches against (`FR-022`).
   *
   * Optional, and its absence is a designed outcome rather than a failure: a
   * job description still classifies, extracts intent and extracts context
   * without one. What it cannot do is produce a gap analysis, because there is
   * nothing to compare against — so Stage 7 is skipped and the reason is
   * recorded on the result.
   */
  readonly capabilityProfile?: CapabilityProfile;
  /** Injected so traces are testable without the wall clock. */
  readonly now?: () => Date;
  readonly newId?: () => string;
  /** Trace/usage writes must never fail an analysis (`DB §6.2`, `SA §3.10`). */
  readonly onRecordError?: (error: unknown) => void;
}

/**
 * Serializes a stage's upstream handoff for the provider request.
 *
 * `FR-010`: "Each stage receives the prior stage's structured output."
 * `AI §3.2` names those inputs per stage — Stage 2 gets input text plus the
 * classification, Stage 3 gets input text plus the intent, Stage 6 gets the
 * context set. Until now the pipeline threaded those objects into the *trace*
 * and sent the provider only the raw requirement, so a stage told "you are
 * given the classification, the intent record, and the context set" received
 * none of them. Stage 6 responded by producing all of them itself, which is
 * what run `e8908bb0` cost: 7,417 output tokens and a whole-pipeline object.
 *
 * Exported because the replay fixtures must key on exactly these bytes.
 */
export const stageHandoff = (payload: Record<string, unknown>): string =>
  JSON.stringify(payload, null, 2);

/**
 * The context set as Stage 6 is shown it: every element carries its own
 * `index`.
 *
 * WHY THE LABEL EXISTS. Stage 6 must cite the elements a component is grounded
 * in (`FR-030`), and it used to receive a bare JSON array — so citing element
 * seventeen meant *counting to seventeen*. The first real capture of `br-001`
 * failed on exactly that: against a 28-element set the model cited element 28,
 * one past the end, which is what 1-indexing a list you had to count looks
 * like.
 *
 * `docs/12` D-19 already settled this class of problem for Stage 3 spans:
 * "model arithmetic ... is not a thing language models do reliably", so the
 * design stopped asking for a computed number and asked for something copied
 * instead. This is the same move for grounding — the model copies an `index`
 * that is printed beside the element rather than deriving it.
 *
 * THE VALUE IS THE ARRAY POSITION, so nothing downstream changes: the parser,
 * the traceability check and `analysis-result-sink`'s `ids[index]` lookup all
 * keep their 0-based contract. Only what the model is *shown* is different.
 */
export const contextHandoffView = (
  context: ContextResult,
): Record<string, unknown> => ({
  elements: context.elements.map((element, index) => ({ index, ...element })),
  sufficiency: context.sufficiency,
});

/**
 * The provider input each stage is sent, derived from a set of raw stage
 * outputs.
 *
 * This is pipeline knowledge — `AI §3.2` fixes what every stage receives — and
 * a replay fixture that guesses it wrongly silently fails to match. Exposing it
 * here keeps the fixtures and the runner reading from one definition, and keeps
 * stage modules imported only by this file (boundary check 6).
 *
 * Stops at the first output that is absent or unparseable: a fixture set that
 * ends early is describing a run that ends early.
 */
export function stageProviderInputs(
  inputText: string,
  outputs: {
    readonly classification?: string;
    readonly intent?: string;
    readonly context?: string;
    /**
     * Supplied only for the job-description path, and only when the caller has
     * one — exactly the condition under which the pipeline calls Stage 7.
     * Without it there is no Stage 7 input to describe, because there would
     * have been no Stage 7 call to key a fixture against.
     */
    readonly capabilityProfile?: CapabilityProfile;
    /**
     * Stage 7's raw output, so Stage 9 can be keyed.
     *
     * ⚠️ WITHOUT THIS, STAGE 9 WAS NEVER KEYED — the fourth instance of
     * capture and replay diverging on one input. A `job_description` recording
     * that reached Stage 9 replayed its first four stages and then failed
     * `portfolio_suggestions` with "No recorded response for request key …",
     * against a recording that held the answer. The regression run still
     * passed, because `artifact_set` is a deferred assertion, so nothing said
     * so until a deployment tried to serve the recording.
     */
    readonly recommendation?: string;
    /**
     * Stage 6's raw output, so the requirement path's Stage 9 generator can be
     * keyed (D-78) — the same shape as `recommendation` for the job path.
     */
    readonly architecture?: string;
    /** Stage 6W's raw output, so the workflow path's Stage 9 can be keyed (D-80). */
    readonly review?: string;
  },
): ReadonlyMap<string, string> {
  const inputs = new Map<string, string>();
  inputs.set("input_classification", inputText);

  if (outputs.classification === undefined) return inputs;
  let classification;
  try {
    classification = parseClassification(outputs.classification);
  } catch {
    return inputs;
  }
  inputs.set(
    "intent_detection",
    stageHandoff({ input_text: inputText, classification }),
  );

  if (outputs.intent === undefined) return inputs;
  let intent;
  try {
    // D-90: a declined design is verified against the input here too —
    // without the text, the replay key for Stage 3 of a declined case could
    // never be built (br-010 replayed as "no recorded response").
    intent = parseIntent(outputs.intent, inputText);
  } catch {
    return inputs;
  }
  inputs.set(
    "context_extraction",
    stageHandoff({ input_text: inputText, intent }),
  );

  if (outputs.context === undefined) return inputs;
  let context;
  try {
    context = parseContext(outputs.context, inputText);
  } catch {
    return inputs;
  }
  // The branch the pipeline takes after Stage 3, mirrored — ⚠️ BY ASKING THE
  // SAME FUNCTION, not by re-listing the types.
  //
  // This used to re-state the routing rules inline: `job_description` went to
  // Stage 7, and *everything else* was given `architecture_analysis`. That
  // silently mis-described the `existing_workflow` path, which `planReasoning`
  // sends to `workflow_review` and pointedly **not** to architecture design
  // (`FR-021` via `AI §7.1`, `docs/15` D-40). The consequence was not a wrong
  // fixture but a missing one: `createRecordedProvider` skips any recorded
  // stage with no provider input, so an `existing_workflow` recording built
  // fixtures for three stages, and the pipeline's Stage 6 call then failed with
  // `No recorded response for request key …` — a message that reads like
  // missing evidence when the evidence was present and unkeyed.
  //
  // ⚠️ IT COST REAL MONEY TO FIND. `ew-001` was captured for $0.1072 and could
  // not be replayed at all, and the shape of the failure pointed at the
  // recording rather than at this function.
  //
  // `planReasoning` is pure and total over `ClassificationType`, and it is what
  // the pipeline itself branches on at Stage 6. Reading through it means a new
  // reasoning module cannot be routed in the pipeline and forgotten here.
  const plan = planReasoning(classification.determinedType);

  if (plan.requiredAnalyses.includes("architecture_analysis")) {
    inputs.set(
      "architecture_analysis",
      stageHandoff({
        classification,
        intent,
        context: contextHandoffView(context),
      }),
    );
    // D-78: the requirement path's Stage 9 generator is keyed on the parsed
    // architecture. Mirrored the same way as Stage 9 on the job path.
    if (
      classification.determinedType === "business_requirement" &&
      outputs.architecture !== undefined
    ) {
      try {
        const architecture = parseArchitecture(
          outputs.architecture,
          context,
          false,
        );
        const requirementHandoff = stageHandoff({
          context: contextHandoffView(context),
          architecture: architectureHandoffView(architecture),
        });
        inputs.set("platform_recommendation", requirementHandoff);
        // D-79: the risk register is keyed on the same handoff; only the task
        // and the composed prompt differ, which `replayKeyFor` distinguishes.
        inputs.set("risk_assessment", requirementHandoff);
        // D-80: so is the complexity assessment.
        inputs.set("complexity_assessment", requirementHandoff);
        // D-82: and the implementation roadmap.
        inputs.set("implementation_roadmap", requirementHandoff);
        // D-83/D-84: and the edge cases and the integration requirements.
        inputs.set("edge_case_analysis", requirementHandoff);
        inputs.set("integration_requirements", requirementHandoff);
      } catch {
        // An architecture fixture that does not parse describes a run that
        // stops at Stage 6; there is no Stage 9 call to key.
      }
    }
  }

  // Stage 6's other generator. The same handoff as architecture analysis —
  // only the task and the composed prompt differ, which is exactly what
  // `replayKeyFor` distinguishes.
  if (plan.requiredAnalyses.includes("workflow_review")) {
    inputs.set(
      "workflow_review",
      stageHandoff({
        classification,
        intent,
        context: contextHandoffView(context),
      }),
    );
    // D-80: the workflow path's complexity assessment is keyed on the
    // observed structure the review produced.
    if (outputs.review !== undefined) {
      try {
        const review = parseWorkflowReview(outputs.review, context);
        const observedHandoff = stageHandoff({
          context: contextHandoffView(context),
          architecture: architectureHandoffView({
            summary: review.summary,
            dataFlowDescription: review.dataFlowDescription,
            components: review.structure,
            unknownDispositions: [],
          }),
        });
        inputs.set("complexity_assessment", observedHandoff);
        // D-87: the platform comparison is keyed on the same handoff.
        inputs.set("platform_comparison", observedHandoff);
      } catch {
        // A review fixture that does not parse describes a run that stops at
        // Stage 6; there is no Stage 9 call to key.
      }
    }
  }

  // `AI §9.1` gives the job-description path no architecture, so a fixture set
  // offering one would describe a call that is never made — `planReasoning`
  // now enforces that rather than this function asserting it.
  //
  // Still conditional on the caller holding a profile: without one the
  // pipeline makes no Stage 7 call, so there is no request to key against.
  if (
    plan.requiredAnalyses.includes("recommendation_generation") &&
    outputs.capabilityProfile !== undefined
  ) {
    inputs.set(
      "recommendation_generation",
      stageHandoff({
        classification,
        intent,
        context: contextHandoffView(context),
        capability_profile: outputs.capabilityProfile,
      }),
    );

    // Stage 9, mirrored the same way: parsed with the pipeline's own parser,
    // planned with the pipeline's own deterministic Stage 8, and keyed on the
    // handoff the generator is actually sent. No Stage 9 call is made for a
    // recommendation that plans the artifact out, so none is described.
    if (outputs.recommendation === undefined) return inputs;
    let recommendation;
    try {
      recommendation = parseRecommendation(
        outputs.recommendation,
        context,
        outputs.capabilityProfile,
      );
    } catch {
      return inputs;
    }
    // D-76: the second generator is keyed on the recommendation view, on both
    // verdicts — a recording that reached it files a fixture for it.
    inputs.set(
      "interview_guidance",
      stageHandoff(interviewHandoffView(recommendation)),
    );
    if (isPlanned(planArtifacts(recommendation), "portfolio_suggestions")) {
      inputs.set(
        "portfolio_suggestions",
        stageHandoff({
          eligible_gaps: eligibleGapsView(
            recommendation,
            eligibleGaps(recommendation),
          ),
          matched_capabilities: recommendation.matched,
          verdict: recommendation.verdict,
        }),
      );
    }
  }

  return inputs;
}

export interface PipelineInput {
  readonly analysisId: string;
  readonly text: string;
  /**
   * Cancellation from the lifecycle that owns this run (`FR-094`).
   *
   * Once aborted, no further stage starts and no further provider call is
   * made; the stage in flight records the cancellation as its failure. The
   * NIE never decides *when* — it only stops when told, which keeps the
   * orchestrator the sole owner of job state (`SA §3.3`).
   */
  readonly signal?: AbortSignal;
  /**
   * D-86 — stop cleanly after this stage, with the run recorded as halted
   * there. The one use is the confidence-feature capture: Stage 3's output
   * is what CF-2 and CF-4 are computed from (`AI §8.2`, D-33), and the
   * thirty-odd corpus cases with no recording can supply it for the cost of
   * three calls each rather than a whole run. Never set by the orchestrator.
   */
  readonly stopAfterStage?: 3;
  /**
   * A user-corrected classification (`FR-014`, `API §7.5`).
   *
   * When present, Stage 1 does not run: the type is **fixed** rather than
   * determined. `FR-014` requires reclassification to "re-run the pipeline
   * from `FR-011` with the user's type fixed", and asking a model to classify
   * text whose classification has already been decided would spend a request
   * to produce an answer that is then discarded.
   *
   * `unsupported` is not accepted here and the route refuses it: it is a
   * refusal outcome, not a frame anything can be reasoned under.
   */
  readonly classificationOverride?: ClassificationType;
}

interface StageRun<T> {
  readonly stageNumber: number;
  /**
   * Receives this stage's trace id.
   *
   * Used by Stage 9 so a `VALIDATION_EVENT` can name the stage whose output
   * it validated (`DB §4.7` — the reference is by identifier, not a foreign
   * key, because the two rows live in the same store on different schedules).
   */
  readonly onStageTrace?: (stageTraceId: string) => void;
  readonly classifiedAs?: ClassificationType;
  readonly buildRequest: (prompt: ComposedPrompt) => CapabilityRequest;
  readonly parse: (responseText: string) => T;
  /**
   * Recorded on the trace (`DB §8.2`). Kept separate from what is sent: the
   * trace records everything a stage was given, while Stage 1 is sent bare
   * text because it has no upstream stage to be given anything from.
   */
  readonly structuredInput: unknown;
  /**
   * When set, a failure this predicate accepts earns exactly one further
   * attempt. `AI §3.2` grants one regeneration on a traceability failure, then
   * fails "rather than emitting an unjustifiable design"; `FR-039` grants the
   * same after a schema validation failure. Everything else follows
   * `SA §11.3` — stages do not auto-retry.
   *
   * Returning `true` retries with the identical request. Returning an
   * `{ addendum }` retries with that text appended to the request input, so
   * the second attempt is told what was wrong with the first. The budget is
   * one attempt either way: the addendum makes the retry *informed*, not
   * repeatable.
   */
  readonly regenerateOnce?: (error: unknown) => RegenerationDecision;
  /**
   * Overrides the fragment and trace key for a stage with more than one
   * generator.
   *
   * Stage 9 established the shape: `docs/12` D-29 makes its registry key the
   * *generator* (`portfolio_suggestions`) because "a shared
   * `artifact_generation` key would give two generators one prompt". Stage 6
   * is now the second such stage — it designs an architecture on the
   * requirement and assessment paths, and reviews a submitted workflow on the
   * workflow path (`docs/15` D-40). Two jobs, two prompts, one stage number.
   *
   * The stage *number* is never overridden: `AP-8`/`FR-100` trace by stage, and
   * a variant that renumbered itself would break the twelve-stage inventory.
   */
  readonly stageKey?: string;
}

/**
 * What to do with a failure a stage is willing to retry.
 *
 * `false` (or `undefined`) lets the failure stand. `true` repeats the request
 * unchanged — correct where the failure carries nothing the model could act
 * on. `{ addendum }` repeats it with corrective text appended, which is what a
 * validation failure warrants: the violations name exactly what to fix, and
 * withholding them makes the retry a coin toss the run pays for.
 */
export type RegenerationDecision = boolean | { readonly addendum: string };

/**
 * The eligible gap set as Stage 9 is shown it: each gap carries its own
 * `requirement_id`, name and priority.
 *
 * The same move as `contextHandoffView` for Stage 6 and Stage 7 — the model
 * copies an identifier printed beside the item rather than deriving one. It
 * also carries the requirement *name*, because a gap id alone tells the
 * generator nothing about what to build.
 */
/**
 * The architecture as the platform generator is shown it (D-78): the design
 * with its components, integrations and unknown dispositions, so the
 * generator recommends for this architecture and cites its component names
 * and context indices rather than reconstructing them.
 */
export const architectureHandoffView = (
  architecture: ArchitectureResult,
): Record<string, unknown> => ({
  summary: architecture.summary,
  data_flow_description: architecture.dataFlowDescription,
  components: architecture.components.map((c) => ({
    name: c.name,
    responsibility: c.responsibility,
    inputs: c.inputs,
    outputs: c.outputs,
    failure_handling: c.failureHandling,
    ...(c.externalSystem !== undefined
      ? { external_system: c.externalSystem }
      : {}),
    ...(c.integrationDirection !== undefined
      ? { integration_direction: c.integrationDirection }
      : {}),
    grounded_in_context_indices: c.groundedInContextIndices,
  })),
  unknown_disposition: (architecture.unknownDispositions ?? []).map((d) => ({
    context_index: d.contextIndex,
    disposition: d.disposition,
    statement: d.statement,
  })),
});

/**
 * The recommendation as the interview-guidance generator is shown it (D-76):
 * every requirement with its id, the matches with the capability ids the
 * operator may cite, the gaps, and the verdict. Names and ids together, so
 * the generator copies ids rather than reconstructing them.
 */
export const interviewHandoffView = (
  recommendation: RecommendationForArtifacts,
): Record<string, unknown> => ({
  requirements: recommendation.requiredCapabilities.map((r) => ({
    id: r.id,
    name: r.name,
    necessity: r.necessity,
    kind: r.kind,
    provenance: r.provenance,
  })),
  matched: recommendation.matched.map((m) => ({
    requirement_id: m.requirementId,
    capability_id: m.capabilityId,
    strength: m.strength,
    evidence_ref: m.evidenceRef,
  })),
  gaps: recommendation.gaps.map((g) => ({
    requirement_id: g.requirementId,
    priority: g.priority,
    why_it_matters: g.whyItMatters,
  })),
  verdict: recommendation.verdict,
});

export const eligibleGapsView = (
  recommendation: RecommendationForArtifacts,
  eligible: readonly GapItem[],
): readonly Record<string, unknown>[] => {
  const nameOf = new Map(
    recommendation.requiredCapabilities.map((r) => [r.id, r.name]),
  );
  return eligible.map((gap) => ({
    requirement_id: gap.requirementId,
    requirement: nameOf.get(gap.requirementId) ?? gap.requirementId,
    priority: gap.priority,
    why_it_matters: gap.whyItMatters,
  }));
};

export function createPipeline(deps: PipelineDependencies) {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => randomUUID());

  const guard = async (work: () => Promise<void>): Promise<void> => {
    try {
      await work();
    } catch (error) {
      deps.onRecordError?.(error);
    }
  };

  /**
   * Emits a progress event, and never lets delivery fail the analysis.
   *
   * `API-025`: "Stream failure never fails the analysis." A disconnected
   * client is a delivery problem; the reasoning it would have described has
   * already happened and is already persisted. Guarded for the same reason
   * trace writes are (`DB §6.2`).
   */
  const emit = (analysisId: string, event: AnalysisEvent): void => {
    try {
      deps.eventSink?.emit(analysisId, event);
    } catch (error) {
      deps.onRecordError?.(error);
    }
  };

  /**
   * Runs one stage: compose → invoke → parse → trace.
   *
   * The trace is emitted on **both** paths. A stage that failed is exactly the
   * stage whose trace is most needed (`FR-100`, `FR-093`), and emitting only on
   * success would lose every diagnosis the trace store exists for.
   */
  /**
   * Traces a stage that reaches no provider.
   *
   * `AP-8`/`FR-100` require every stage to be reconstructible from its trace,
   * and Stage 8 is a stage — it just happens to be rule-based (`AI` App. A).
   * `StageTrace` carries no model linkage (`DB §8.2`), so a deterministic
   * stage records exactly like any other, minus the invocation. Without this
   * the one stage whose output is pure policy would be the one stage nobody
   * could audit.
   */
  /**
   * `M-10` — schema validity, the metric with a table and no writer.
   *
   * Guarded like every other trace write: a measurement that failed to record
   * must never fail the analysis it was measuring.
   *
   * ⚠️ `failureDetail` carries the validator's message, which names the schema
   * rule that failed and never the content that failed it (`NFR-081`).
   */
  const recordValidation = async (event: {
    stageTraceId: string | null;
    artifactType: string;
    passed: boolean;
    failureDetail?: string;
    regenerationTriggered: boolean;
    /** D-72: the class; `schema` unless a Stage 10 class is named. */
    validationClass?: ValidationClass;
  }): Promise<void> => {
    const sink = deps.validationSink;
    const stageTraceId = event.stageTraceId;
    if (sink === undefined || stageTraceId === null) return;

    await guard(() =>
      sink.record({
        stageTraceId,
        artifactType: event.artifactType,
        validationClass: event.validationClass ?? "schema",
        passed: event.passed,
        ...(event.failureDetail !== undefined
          ? { failureDetail: event.failureDetail }
          : {}),
        regenerationTriggered: event.regenerationTriggered,
      }),
    );
  };

  const recordDeterministicStage = async (
    input: PipelineInput,
    spec: {
      readonly stageNumber: number;
      readonly structuredInput: unknown;
      readonly structuredOutput: unknown;
      /** D-72: Stages 10 and 12 can fail; a failed deterministic stage is traced as such. */
      readonly failureReason?: string;
    },
  ): Promise<string> => {
    const stage = stageByNumber(spec.stageNumber);
    const startedAt = now();
    // Generated once and returned, so a validation event can attach to the
    // stage that produced the artifact it describes (`M-10`).
    const stageTraceId = newId();
    await guard(() =>
      deps.traceSink.record({
        stageTraceId,
        analysisId: input.analysisId,
        stageNumber: stage.stageNumber,
        stageKey: stage.stageKey,
        structuredInput: spec.structuredInput,
        structuredOutput: spec.structuredOutput,
        startedAt,
        durationMs: Math.max(0, now().getTime() - startedAt.getTime()),
        outcome: spec.failureReason === undefined ? "success" : "failure",
        failureReason: spec.failureReason ?? null,
        retryCount: 0,
      }),
    );

    return stageTraceId;
  };

  // --- D-72: Stage 10 bookkeeping ------------------------------------------
  //
  // Findings are collected per run and traced at Stage 10 once the run has
  // produced everything it will. The reasoning context grows as stages
  // complete; the artifact-level check runs at the moment each artifact is
  // validated, so a failing artifact is failed there and not after the fact.
  const runValidation = new Map<
    string,
    { context: ReasoningContext; findings: ValidationFinding[] }
  >();
  const validationOf = (input: PipelineInput) => {
    let entry = runValidation.get(input.analysisId);
    if (entry === undefined) {
      entry = { context: { inputText: input.text }, findings: [] };
      runValidation.set(input.analysisId, entry);
    }
    return entry;
  };
  const extendContext = (
    input: PipelineInput,
    patch: Partial<ReasoningContext>,
  ): void => {
    const entry = validationOf(input);
    entry.context = { ...entry.context, ...patch };
  };

  /**
   * Stage 10's artifact-level classes, applied where the schema class is:
   * before the artifact is persisted. Returns the failure detail when an
   * enforced class fails, so the caller fails the artifact the same way a
   * schema failure would; advisory findings are only recorded.
   */
  const deepValidate = async (
    input: PipelineInput,
    stageTraceId: string | null,
    artifactType: string,
    content: unknown,
  ): Promise<string | null> => {
    const entry = validationOf(input);
    const consistency = checkInternalConsistency(
      artifactType,
      content,
      entry.context,
    );
    entry.findings.push(consistency);
    await recordValidation({
      stageTraceId,
      artifactType,
      passed: consistency.passed,
      ...(consistency.detail !== undefined
        ? { failureDetail: consistency.detail }
        : {}),
      regenerationTriggered: false,
      validationClass: consistency.validationClass,
    });
    return consistency.passed
      ? null
      : `Did not pass response validation (${consistency.validationClass}).`;
  };

  const runStage = async <T>(
    input: PipelineInput,
    spec: StageRun<T>,
  ): Promise<T> => {
    const registered = stageByNumber(spec.stageNumber);
    const stage = {
      ...registered,
      stageKey: spec.stageKey ?? registered.stageKey,
    };
    const stageTraceId = newId();
    spec.onStageTrace?.(stageTraceId);
    const startedAt = now();

    let outcome: "success" | "failure" = "failure";
    let failureReason: string | null = null;
    let structuredOutput: unknown = null;
    let retryCount = 0;

    /**
     * The last thing the provider returned, held so a parse failure does not
     * discard it.
     *
     * `DB §8.2` records "Structured input and output" against StageTrace for
     * **reasoning reconstruction**, and `FR-100` requires a run be
     * reconstructible "without re-running". A failed stage is where that
     * matters most and was the one case storing nothing — the first real
     * Stage 6 failure could not be diagnosed from its trace.
     *
     * Stays `null` when the **provider** failed, because then nothing was
     * returned. The scrubbed `ProviderError` message is already on
     * `failureReason`, and the raw SDK error never leaves the adapter
     * (`AI-006`, `FR-093`) — so this cannot become a leak.
     */
    let lastProviderOutput: string | null = null;

    try {
      const prompt = await composePrompt(
        {
          stageKey: stage.stageKey,
          // Spread rather than assign: `exactOptionalPropertyTypes` treats an
          // explicit `undefined` as a supplied value, and "no type yet" is not
          // the same claim as "type is undefined".
          ...(spec.classifiedAs !== undefined
            ? { classifiedAs: spec.classifiedAs }
            : {}),
        },
        deps.resolver,
      );

      // `AI-013`: the exact composition is recorded per run — the fragment
      // version set, not a template name.
      await guard(async () => {
        const usages: FragmentUsageRecord[] = prompt.fragments.map(
          (fragment, ordinal) => ({
            analysisId: input.analysisId,
            fragmentVersionId: fragment.fragmentVersionId,
            stage: stage.stageKey,
            ordinal,
          }),
        );
        await deps.fragmentUsageSink.record(usages);
      });

      const invocationContext: InvocationContext = {
        stageTraceId,
        modelVersionId: deps.modelVersionId,
        modelKey: deps.modelKey,
      };

      /**
       * One provider call.
       *
       * `addendum` is present only on a regeneration, and is appended to the
       * request *input* rather than its instructions. The instructions are the
       * fragment-composed prompt (`AI §6.1`), and they stay byte-identical to
       * the published fragments this stage recorded using — a correction is
       * data about one response, not a change to the template. The addendum is
       * therefore invisible to `FRAGMENT_USAGE`, which is correct: no fragment
       * was added, activated or altered.
       */
      const attempt = async (addendum?: string): Promise<T> => {
        const base = spec.buildRequest(prompt);
        const request =
          addendum === undefined
            ? base
            : { ...base, input: `${base.input}\n\n${addendum}` };

        // ⚠️ A cancelled analysis makes no new provider call. Checked here,
        // immediately before the call, so a deadline that fires between
        // stages — or between a failed attempt and its regeneration — stops
        // the spend rather than merely the waiting (D-65 §7.2).
        if (input.signal?.aborted === true) {
          throw new StageError(
            stage.stageNumber,
            stage.stageKey,
            "Cancelled: the analysis reached its deadline before this call was made (FR-094)",
          );
        }
        const response = await deps.invoker.invoke(
          request,
          // D-89: a regeneration is the stage's second attempt, and its
          // provider row says so.
          addendum === undefined
            ? invocationContext
            : { ...invocationContext, attemptBase: 2 },
          input.signal !== undefined ? { signal: input.signal } : {},
        );
        // Captured before parsing, so an unparseable response survives.
        lastProviderOutput = response.output;
        return spec.parse(response.output);
      };

      let parsed: T;
      try {
        parsed = await attempt();
      } catch (error) {
        const decision = spec.regenerateOnce?.(error) ?? false;
        if (decision === false) {
          throw error;
        }
        // One regeneration, then the failure stands (`AI §3.2`, `FR-039`).
        // A second failure leaves this `catch` uncaught, so the stage fails
        // closed exactly as before — being informed buys one better attempt,
        // never an extra one.
        retryCount = 1;
        parsed = await attempt(
          decision === true ? undefined : decision.addendum,
        );
      }

      structuredOutput = parsed;
      outcome = "success";
      return parsed;
    } catch (error) {
      failureReason =
        error instanceof Error ? error.message : "Unknown stage failure";
      throw error;
    } finally {
      const completedAt = now();
      await guard(() =>
        deps.traceSink.record({
          stageTraceId,
          analysisId: input.analysisId,
          stageNumber: stage.stageNumber,
          stageKey: stage.stageKey,
          structuredInput: spec.structuredInput,
          // On success this is the parsed handoff. On failure it is the raw
          // response under `unparsed`, which is a deliberately distinct shape:
          // a consumer can tell a reconstructed handoff from a rejected one
          // without guessing.
          structuredOutput:
            outcome === "success"
              ? structuredOutput
              : lastProviderOutput === null
                ? null
                : { unparsed: lastProviderOutput },
          startedAt,
          durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
          outcome,
          failureReason,
          // Provider-level retries are counted per ProviderInvocation row
          // (`DB §4.7`). This counts stage regenerations, which only Stage 6
          // performs (`AI §3.2`); every other stage records 0 per `SA §11.3`.
          retryCount,
        }),
      );
    }
  };

  const request = (
    prompt: ComposedPrompt,
    task: string,
    text: string,
  ): CapabilityRequest => ({
    task,
    input: text,
    instructions: prompt.instructions,
    // Reasoning must be reproducible where the provider allows it (`AIP-7`).
    preferLowVariance: true,
  });

  /**
   * The requirement path's Stage 9 generator (D-78): the platform
   * recommendation, from the architecture and the context set. The same
   * shape as the two job-path generators, in one place so the requirement
   * branch and `API-032` retry call the same code.
   */
  const generatePlatformRecommendation = async (
    input: PipelineInput,
    classifiedAs: ClassificationType,
    architecture: ArchitectureResult,
    context: ContextResult,
    options: {
      readonly retry?: boolean;
      /**
       * D-87: the workflow path runs this generator as the Platform
       * Comparison — its own Stage 9 key and fragment, framed for an observed
       * workflow — against the same schema and parser.
       */
      readonly stageKey?: "platform_recommendation" | "platform_comparison";
    } = {},
  ): Promise<{
    readonly outcome: ArtifactOutcome;
    readonly wire: unknown;
    readonly recommendation: PlatformRecommendation | undefined;
    readonly attempts: number;
    readonly traceId: string | null;
    readonly failureReason: string;
  }> => {
    let wire: unknown;
    let attempts = 1;
    let traceId: string | null = null;
    let recommendation: PlatformRecommendation | undefined;
    let outcome: ArtifactOutcome = "generated";
    let failureReason = "";
    try {
      const stageKey = options.stageKey ?? "platform_recommendation";
      recommendation = await runStage(input, {
        stageNumber: 9,
        stageKey,
        classifiedAs,
        onStageTrace: (id) => {
          traceId = id;
        },
        structuredInput: {
          architecture,
          ...(options.retry === true ? { retry: true } : {}),
        },
        buildRequest: (prompt) =>
          request(
            prompt,
            stageKey,
            stageHandoff({
              context: contextHandoffView(context),
              architecture: architectureHandoffView(architecture),
            }),
          ),
        parse: (text) => {
          const parsed = parseStructured(9, "platform_recommendation", text);
          wire = parsed;
          validateArtifact("platform_recommendation", parsed);
          return parsePlatformRecommendation(text, architecture, context);
        },
        regenerateOnce: (error) => {
          if (!(error instanceof ArtifactSchemaError)) return false;
          attempts += 1;
          return { addendum: correctionFor(error) };
        },
      });
      const deep = await deepValidate(
        input,
        traceId,
        "platform_recommendation",
        wire,
      );
      if (deep !== null) {
        recommendation = undefined;
        throw new ResponseValidationError(deep);
      }
    } catch (error) {
      outcome = "failed";
      failureReason =
        error instanceof ResponseValidationError
          ? error.message
          : error instanceof ArtifactSchemaError
            ? "Generated but did not satisfy its output schema."
            : "Generation did not produce a usable document.";
    }
    return { outcome, wire, recommendation, attempts, traceId, failureReason };
  };

  /**
   * The requirement path's risk register (D-79, `FR-032`): the same handoff
   * as the platform generator, its own Stage 9 trace, the shared
   * `risk_assessment` schema.
   */
  const generateRiskRegister = async (
    input: PipelineInput,
    classifiedAs: ClassificationType,
    architecture: ArchitectureResult,
    context: ContextResult,
  ): Promise<{
    readonly outcome: ArtifactOutcome;
    readonly wire: unknown;
    readonly register: RiskRegister | undefined;
    readonly attempts: number;
    readonly traceId: string | null;
    readonly failureReason: string;
  }> => {
    let wire: unknown;
    let attempts = 1;
    let traceId: string | null = null;
    let register: RiskRegister | undefined;
    let outcome: ArtifactOutcome = "generated";
    let failureReason = "";
    try {
      register = await runStage(input, {
        stageNumber: 9,
        stageKey: "risk_assessment",
        classifiedAs,
        onStageTrace: (id) => {
          traceId = id;
        },
        structuredInput: { architecture },
        buildRequest: (prompt) =>
          request(
            prompt,
            "risk_assessment",
            stageHandoff({
              context: contextHandoffView(context),
              architecture: architectureHandoffView(architecture),
            }),
          ),
        parse: (text) => {
          const parsed = parseStructured(9, "risk_assessment", text);
          // The published schema (shared with the rendered workflow-path
          // artifact) has no null: an absent statement is absent. The request
          // schema makes it required-but-nullable, so null is dropped here.
          if (parsed["no_risks_statement"] === null) {
            delete parsed["no_risks_statement"];
          }
          wire = parsed;
          validateArtifact("risk_assessment", parsed);
          return parseRiskRegister(text, architecture);
        },
        regenerateOnce: (error) => {
          if (!(error instanceof ArtifactSchemaError)) return false;
          attempts += 1;
          return { addendum: correctionFor(error) };
        },
      });
      const deep = await deepValidate(input, traceId, "risk_assessment", wire);
      if (deep !== null) {
        register = undefined;
        throw new ResponseValidationError(deep);
      }
    } catch (error) {
      outcome = "failed";
      failureReason =
        error instanceof ResponseValidationError
          ? error.message
          : error instanceof ArtifactSchemaError
            ? "Generated but did not satisfy its output schema."
            : "Generation did not produce a usable document.";
    }
    return { outcome, wire, register, attempts, traceId, failureReason };
  };

  /**
   * The complexity assessment (D-80, `FR-033`): the generator scores the
   * five factors; the document — weight, contribution, weighted and complexity
   * score — is rendered here by `docs/09` §1.3 arithmetic and validated
   * against the published schema. Runs on the requirement path against the
   * Stage 6 architecture and on the workflow path against the observed
   * structure.
   */
  const generateComplexity = async (
    input: PipelineInput,
    classifiedAs: ClassificationType,
    architecture: ArchitectureResult,
    context: ContextResult,
  ): Promise<{
    readonly outcome: ArtifactOutcome;
    readonly wire: unknown;
    readonly assessment: ComplexityAssessment | undefined;
    readonly attempts: number;
    readonly traceId: string | null;
    readonly failureReason: string;
  }> => {
    let wire: unknown;
    let attempts = 1;
    let traceId: string | null = null;
    let assessment: ComplexityAssessment | undefined;
    let outcome: ArtifactOutcome = "generated";
    let failureReason = "";
    try {
      assessment = await runStage(input, {
        stageNumber: 9,
        stageKey: "complexity_assessment",
        classifiedAs,
        onStageTrace: (id) => {
          traceId = id;
        },
        structuredInput: { architecture },
        buildRequest: (prompt) =>
          request(
            prompt,
            "complexity_assessment",
            stageHandoff({
              context: contextHandoffView(context),
              architecture: architectureHandoffView(architecture),
            }),
          ),
        parse: (text) => {
          const parsed = parseComplexityFactors(text);
          // The artifact is the rendered table, not the model's factor list:
          // the arithmetic is the pipeline's, so the document a reader gets
          // always carries the basis `FR-033` requires.
          const document = renderComplexityScore(parsed);
          wire = document;
          validateArtifact("complexity_score", document);
          return parsed;
        },
        regenerateOnce: (error) => {
          if (!(error instanceof ArtifactSchemaError)) return false;
          attempts += 1;
          return { addendum: correctionFor(error) };
        },
      });
      const deep = await deepValidate(input, traceId, "complexity_score", wire);
      if (deep !== null) {
        assessment = undefined;
        throw new ResponseValidationError(deep);
      }
    } catch (error) {
      outcome = "failed";
      failureReason =
        error instanceof ResponseValidationError
          ? error.message
          : error instanceof ArtifactSchemaError
            ? "Generated but did not satisfy its output schema."
            : "Generation did not produce a usable document.";
    }
    return { outcome, wire, assessment, attempts, traceId, failureReason };
  };

  /**
   * The implementation roadmap (D-82, `FR-036`): the requirement path's
   * fourth generator, keyed on the same handoff, its own Stage 9 trace.
   */
  const generateRoadmap = async (
    input: PipelineInput,
    classifiedAs: ClassificationType,
    architecture: ArchitectureResult,
    context: ContextResult,
  ): Promise<{
    readonly outcome: ArtifactOutcome;
    readonly wire: unknown;
    readonly roadmap: ImplementationRoadmap | undefined;
    readonly attempts: number;
    readonly traceId: string | null;
    readonly failureReason: string;
  }> => {
    let wire: unknown;
    let attempts = 1;
    let traceId: string | null = null;
    let roadmap: ImplementationRoadmap | undefined;
    let outcome: ArtifactOutcome = "generated";
    let failureReason = "";
    try {
      roadmap = await runStage(input, {
        stageNumber: 9,
        stageKey: "implementation_roadmap",
        classifiedAs,
        onStageTrace: (id) => {
          traceId = id;
        },
        structuredInput: { architecture },
        buildRequest: (prompt) =>
          request(
            prompt,
            "implementation_roadmap",
            stageHandoff({
              context: contextHandoffView(context),
              architecture: architectureHandoffView(architecture),
            }),
          ),
        parse: (text) => {
          const parsed = parseStructured(9, "implementation_roadmap", text);
          // The published schema has no null: an absent estimate is absent.
          // The request schema makes it required-but-nullable, so a null is
          // dropped from every phase here.
          for (const p of Array.isArray(parsed["phases"])
            ? parsed["phases"]
            : []) {
            if (
              p !== null &&
              typeof p === "object" &&
              (p as Record<string, unknown>)["estimate"] === null
            ) {
              delete (p as Record<string, unknown>)["estimate"];
            }
          }
          wire = parsed;
          validateArtifact("implementation_roadmap", parsed);
          return parseImplementationRoadmap(text, architecture, context);
        },
        regenerateOnce: (error) => {
          if (!(error instanceof ArtifactSchemaError)) return false;
          attempts += 1;
          return { addendum: correctionFor(error) };
        },
      });
      const deep = await deepValidate(
        input,
        traceId,
        "implementation_roadmap",
        wire,
      );
      if (deep !== null) {
        roadmap = undefined;
        throw new ResponseValidationError(deep);
      }
    } catch (error) {
      outcome = "failed";
      failureReason =
        error instanceof ResponseValidationError
          ? error.message
          : error instanceof ArtifactSchemaError
            ? "Generated but did not satisfy its output schema."
            : "Generation did not produce a usable document.";
    }
    return { outcome, wire, roadmap, attempts, traceId, failureReason };
  };

  const settleRoadmap = async (
    input: PipelineInput,
    generated: Awaited<ReturnType<typeof generateRoadmap>>,
  ): Promise<void> => {
    emit(
      input.analysisId,
      generated.outcome === "generated" && generated.roadmap !== undefined
        ? {
            type: "artifact",
            artifactType: "implementation_roadmap",
            content: generated.wire,
          }
        : {
            type: "artifact_failed",
            artifactType: "implementation_roadmap",
            reason: generated.failureReason,
            // Generated on this path only (D-81).
            retryAvailable: isRetryableArtifact(
              "implementation_roadmap",
              "business_requirement",
            ),
          },
    );
    if (generated.wire !== undefined) {
      await deps.resultSink?.persistArtifact?.(input.analysisId, {
        artifactType: "implementation_roadmap",
        content: generated.wire,
        depthLevel: "standard",
        generationAttemptCount: generated.attempts,
        validationStatus:
          generated.outcome === "generated" ? "valid" : "failed",
      });
    }
    await recordValidation({
      stageTraceId: generated.traceId,
      artifactType: "implementation_roadmap",
      passed: generated.outcome === "generated",
      ...(generated.outcome === "generated"
        ? {}
        : { failureDetail: generated.failureReason }),
      regenerationTriggered: generated.attempts > 1,
    });
  };

  const generateEdgeCases = async (
    input: PipelineInput,
    classifiedAs: ClassificationType,
    architecture: ArchitectureResult,
    context: ContextResult,
  ): Promise<{
    readonly outcome: ArtifactOutcome;
    readonly wire: unknown;
    readonly analysis: EdgeCaseAnalysis | undefined;
    readonly attempts: number;
    readonly traceId: string | null;
    readonly failureReason: string;
  }> => {
    let wire: unknown;
    let attempts = 1;
    let traceId: string | null = null;
    let analysis: EdgeCaseAnalysis | undefined;
    let outcome: ArtifactOutcome = "generated";
    let failureReason = "";
    try {
      analysis = await runStage(input, {
        stageNumber: 9,
        stageKey: "edge_case_analysis",
        classifiedAs,
        onStageTrace: (id) => {
          traceId = id;
        },
        structuredInput: { architecture },
        buildRequest: (prompt) =>
          request(
            prompt,
            "edge_case_analysis",
            stageHandoff({
              context: contextHandoffView(context),
              architecture: architectureHandoffView(architecture),
            }),
          ),
        parse: (text) => {
          const parsed = parseStructured(9, "edge_case_analysis", text);

          wire = parsed;
          validateArtifact("edge_cases_and_practices", parsed);
          return parseEdgeCaseAnalysis(text, architecture);
        },
        regenerateOnce: (error) => {
          if (!(error instanceof ArtifactSchemaError)) return false;
          attempts += 1;
          return { addendum: correctionFor(error) };
        },
      });
      const deep = await deepValidate(
        input,
        traceId,
        "edge_cases_and_practices",
        wire,
      );
      if (deep !== null) {
        analysis = undefined;
        throw new ResponseValidationError(deep);
      }
    } catch (error) {
      outcome = "failed";
      failureReason =
        error instanceof ResponseValidationError
          ? error.message
          : error instanceof ArtifactSchemaError
            ? "Generated but did not satisfy its output schema."
            : "Generation did not produce a usable document.";
    }
    return { outcome, wire, analysis, attempts, traceId, failureReason };
  };

  const settleEdgeCases = async (
    input: PipelineInput,
    generated: Awaited<ReturnType<typeof generateEdgeCases>>,
  ): Promise<void> => {
    emit(
      input.analysisId,
      generated.outcome === "generated" && generated.analysis !== undefined
        ? {
            type: "artifact",
            artifactType: "edge_cases_and_practices",
            content: generated.wire,
          }
        : {
            type: "artifact_failed",
            artifactType: "edge_cases_and_practices",
            reason: generated.failureReason,
            // Generated on this path only (D-81).
            retryAvailable: isRetryableArtifact(
              "edge_cases_and_practices",
              "business_requirement",
            ),
          },
    );
    if (generated.wire !== undefined) {
      await deps.resultSink?.persistArtifact?.(input.analysisId, {
        artifactType: "edge_cases_and_practices",
        content: generated.wire,
        depthLevel: "standard",
        generationAttemptCount: generated.attempts,
        validationStatus:
          generated.outcome === "generated" ? "valid" : "failed",
      });
    }
    await recordValidation({
      stageTraceId: generated.traceId,
      artifactType: "edge_cases_and_practices",
      passed: generated.outcome === "generated",
      ...(generated.outcome === "generated"
        ? {}
        : { failureDetail: generated.failureReason }),
      regenerationTriggered: generated.attempts > 1,
    });
  };

  const generateIntegrations = async (
    input: PipelineInput,
    classifiedAs: ClassificationType,
    architecture: ArchitectureResult,
    context: ContextResult,
  ): Promise<{
    readonly outcome: ArtifactOutcome;
    readonly wire: unknown;
    readonly requirements: IntegrationRequirements | undefined;
    readonly attempts: number;
    readonly traceId: string | null;
    readonly failureReason: string;
  }> => {
    let wire: unknown;
    let attempts = 1;
    let traceId: string | null = null;
    let requirements: IntegrationRequirements | undefined;
    let outcome: ArtifactOutcome = "generated";
    let failureReason = "";
    try {
      requirements = await runStage(input, {
        stageNumber: 9,
        stageKey: "integration_requirements",
        classifiedAs,
        onStageTrace: (id) => {
          traceId = id;
        },
        structuredInput: { architecture },
        buildRequest: (prompt) =>
          request(
            prompt,
            "integration_requirements",
            stageHandoff({
              context: contextHandoffView(context),
              architecture: architectureHandoffView(architecture),
            }),
          ),
        parse: (text) => {
          const parsed = parseStructured(9, "integration_requirements", text);
          // The published schema has no null: the statement and a
          // constraint's context index are absent when absent. The request
          // schema makes both required-but-nullable, so nulls are dropped.
          if (parsed["no_integrations_statement"] === null) {
            delete parsed["no_integrations_statement"];
          }
          for (const i of Array.isArray(parsed["integrations"])
            ? parsed["integrations"]
            : []) {
            const rec = i as Record<string, unknown>;
            for (const c of Array.isArray(rec["constraints"])
              ? rec["constraints"]
              : []) {
              const cr = c as Record<string, unknown>;
              if (cr["context_index"] === null) delete cr["context_index"];
            }
          }
          wire = parsed;
          validateArtifact("integration_requirements", parsed);
          return parseIntegrationRequirements(text, architecture, context);
        },
        regenerateOnce: (error) => {
          if (!(error instanceof ArtifactSchemaError)) return false;
          attempts += 1;
          return { addendum: correctionFor(error) };
        },
      });
      const deep = await deepValidate(
        input,
        traceId,
        "integration_requirements",
        wire,
      );
      if (deep !== null) {
        requirements = undefined;
        throw new ResponseValidationError(deep);
      }
    } catch (error) {
      outcome = "failed";
      failureReason =
        error instanceof ResponseValidationError
          ? error.message
          : error instanceof ArtifactSchemaError
            ? "Generated but did not satisfy its output schema."
            : "Generation did not produce a usable document.";
    }
    return { outcome, wire, requirements, attempts, traceId, failureReason };
  };

  const settleIntegrations = async (
    input: PipelineInput,
    generated: Awaited<ReturnType<typeof generateIntegrations>>,
  ): Promise<void> => {
    emit(
      input.analysisId,
      generated.outcome === "generated" && generated.requirements !== undefined
        ? {
            type: "artifact",
            artifactType: "integration_requirements",
            content: generated.wire,
          }
        : {
            type: "artifact_failed",
            artifactType: "integration_requirements",
            reason: generated.failureReason,
            // Generated on this path only (D-81).
            retryAvailable: isRetryableArtifact(
              "integration_requirements",
              "business_requirement",
            ),
          },
    );
    if (generated.wire !== undefined) {
      await deps.resultSink?.persistArtifact?.(input.analysisId, {
        artifactType: "integration_requirements",
        content: generated.wire,
        depthLevel: "standard",
        generationAttemptCount: generated.attempts,
        validationStatus:
          generated.outcome === "generated" ? "valid" : "failed",
      });
    }
    await recordValidation({
      stageTraceId: generated.traceId,
      artifactType: "integration_requirements",
      passed: generated.outcome === "generated",
      ...(generated.outcome === "generated"
        ? {}
        : { failureDetail: generated.failureReason }),
      regenerationTriggered: generated.attempts > 1,
    });
  };

  const settleComplexity = async (
    input: PipelineInput,
    classifiedAs: ClassificationType,
    generated: Awaited<ReturnType<typeof generateComplexity>>,
  ): Promise<void> => {
    emit(
      input.analysisId,
      generated.outcome === "generated" && generated.assessment !== undefined
        ? {
            type: "artifact",
            artifactType: "complexity_score",
            content: generated.wire,
          }
        : {
            type: "artifact_failed",
            artifactType: "complexity_score",
            reason: generated.failureReason,
            // D-81: generated on this path, so a retry is a fresh sample.
            retryAvailable: isRetryableArtifact(
              "complexity_score",
              classifiedAs,
            ),
          },
    );
    if (generated.wire !== undefined) {
      await deps.resultSink?.persistArtifact?.(input.analysisId, {
        artifactType: "complexity_score",
        content: generated.wire,
        depthLevel: "standard",
        generationAttemptCount: generated.attempts,
        validationStatus:
          generated.outcome === "generated" ? "valid" : "failed",
      });
    }
    await recordValidation({
      stageTraceId: generated.traceId,
      artifactType: "complexity_score",
      passed: generated.outcome === "generated",
      ...(generated.outcome === "generated"
        ? {}
        : { failureDetail: generated.failureReason }),
      regenerationTriggered: generated.attempts > 1,
    });
  };

  const settleRiskRegister = async (
    input: PipelineInput,
    generated: Awaited<ReturnType<typeof generateRiskRegister>>,
  ): Promise<void> => {
    emit(
      input.analysisId,
      generated.outcome === "generated" && generated.register !== undefined
        ? {
            type: "artifact",
            artifactType: "risk_assessment",
            content: generated.wire,
          }
        : {
            type: "artifact_failed",
            artifactType: "risk_assessment",
            reason: generated.failureReason,
            // D-81: this settle runs only where the register is GENERATED
            // (the requirement path); the workflow path renders its register
            // through the generic renderer, whose event says deterministic.
            retryAvailable: isRetryableArtifact(
              "risk_assessment",
              "business_requirement",
            ),
          },
    );
    if (generated.wire !== undefined) {
      await deps.resultSink?.persistArtifact?.(input.analysisId, {
        artifactType: "risk_assessment",
        content: generated.wire,
        depthLevel: "standard",
        generationAttemptCount: generated.attempts,
        validationStatus:
          generated.outcome === "generated" ? "valid" : "failed",
      });
    }
    await recordValidation({
      stageTraceId: generated.traceId,
      artifactType: "risk_assessment",
      passed: generated.outcome === "generated",
      ...(generated.outcome === "generated"
        ? {}
        : { failureDetail: generated.failureReason }),
      regenerationTriggered: generated.attempts > 1,
    });
  };

  const settlePlatformRecommendation = async (
    input: PipelineInput,
    generated: Awaited<ReturnType<typeof generatePlatformRecommendation>>,
  ): Promise<void> => {
    emit(
      input.analysisId,
      generated.outcome === "generated" &&
        generated.recommendation !== undefined
        ? {
            type: "artifact",
            artifactType: "platform_recommendation",
            content: generated.wire,
          }
        : {
            type: "artifact_failed",
            artifactType: "platform_recommendation",
            reason: generated.failureReason,
            retryAvailable: isRetryableArtifactType("platform_recommendation"),
          },
    );
    if (generated.wire !== undefined) {
      await deps.resultSink?.persistArtifact?.(input.analysisId, {
        artifactType: "platform_recommendation",
        content: generated.wire,
        depthLevel: "standard",
        generationAttemptCount: generated.attempts,
        validationStatus:
          generated.outcome === "generated" ? "valid" : "failed",
      });
    }
    await recordValidation({
      stageTraceId: generated.traceId,
      artifactType: "platform_recommendation",
      passed: generated.outcome === "generated",
      ...(generated.outcome === "generated"
        ? {}
        : { failureDetail: generated.failureReason }),
      regenerationTriggered: generated.attempts > 1,
    });
  };

  /**
   * Stage 9's second generator (D-76): the interview guidance, from the
   * recommendation. The same shape as the portfolio generator — one
   * informed regeneration on a schema failure, the wire document kept for a
   * labelled failure, the outcome announced and validated — in one place so
   * both job-path branches and `API-032` retry call the same code.
   */
  const generateInterviewGuidance = async (
    input: PipelineInput,
    classifiedAs: ClassificationType,
    recommendation: RecommendationForArtifacts,
    options: { readonly retry?: boolean } = {},
  ): Promise<{
    readonly outcome: ArtifactOutcome;
    readonly wire: unknown;
    readonly guidance: InterviewGuidance | undefined;
    readonly attempts: number;
    readonly traceId: string | null;
    readonly failureReason: string;
  }> => {
    let wire: unknown;
    let attempts = 1;
    let traceId: string | null = null;
    let guidance: InterviewGuidance | undefined;
    let outcome: ArtifactOutcome = "generated";
    let failureReason = "";
    try {
      guidance = await runStage(input, {
        stageNumber: 9,
        stageKey: "interview_guidance",
        classifiedAs,
        onStageTrace: (id) => {
          traceId = id;
        },
        structuredInput: {
          recommendation,
          ...(options.retry === true ? { retry: true } : {}),
        },
        buildRequest: (prompt) =>
          request(
            prompt,
            "interview_guidance",
            stageHandoff(interviewHandoffView(recommendation)),
          ),
        parse: (text) => {
          const parsed = parseStructured(9, "interview_guidance", text);
          wire = parsed;
          validateArtifact("interview_guidance", parsed);
          return parseInterviewGuidance(text, recommendation);
        },
        regenerateOnce: (error) => {
          if (!(error instanceof ArtifactSchemaError)) return false;
          attempts += 1;
          return { addendum: correctionFor(error) };
        },
      });
      const deep = await deepValidate(
        input,
        traceId,
        "interview_guidance",
        wire,
      );
      if (deep !== null) {
        guidance = undefined;
        throw new ResponseValidationError(deep);
      }
    } catch (error) {
      outcome = "failed";
      failureReason =
        error instanceof ResponseValidationError
          ? error.message
          : error instanceof ArtifactSchemaError
            ? "Generated but did not satisfy its output schema."
            : "Generation did not produce a usable document.";
    }
    return { outcome, wire, guidance, attempts, traceId, failureReason };
  };

  /** Announces, stores and validation-records one interview-guidance attempt. */
  const settleInterviewGuidance = async (
    input: PipelineInput,
    generated: Awaited<ReturnType<typeof generateInterviewGuidance>>,
  ): Promise<void> => {
    emit(
      input.analysisId,
      generated.outcome === "generated" && generated.guidance !== undefined
        ? {
            type: "artifact",
            artifactType: "interview_guidance",
            content: generated.wire,
          }
        : {
            type: "artifact_failed",
            artifactType: "interview_guidance",
            reason: generated.failureReason,
            retryAvailable: isRetryableArtifactType("interview_guidance"),
          },
    );
    if (generated.wire !== undefined) {
      await deps.resultSink?.persistArtifact?.(input.analysisId, {
        artifactType: "interview_guidance",
        content: generated.wire,
        depthLevel: "standard",
        generationAttemptCount: generated.attempts,
        validationStatus:
          generated.outcome === "generated" ? "valid" : "failed",
      });
    }
    await recordValidation({
      stageTraceId: generated.traceId,
      artifactType: "interview_guidance",
      passed: generated.outcome === "generated",
      ...(generated.outcome === "generated"
        ? {}
        : { failureDetail: generated.failureReason }),
      regenerationTriggered: generated.attempts > 1,
    });
  };

  /**
   * Renders, validates, persists and announces the artifacts a path derives
   * from reasoning it has already done (`docs/15` D-40).
   *
   * These make no provider call — see `derived-artifacts.ts` — but they are
   * artifacts in every other respect: validated against their published schema
   * (`FR-039`), stored valid or failed (`DB §4.4`), and announced with the
   * outcome a reader needs to tell "produced" from "tried and failed"
   * (`FR-091`). A rendering bug therefore surfaces as a schema failure rather
   * than as a malformed artifact nobody checked.
   */
  const emitDerivedArtifacts = async (
    input: PipelineInput,
    plan: readonly ArtifactPlanEntry[],
    renderers: Partial<Record<string, () => Record<string, unknown>>>,
    // The trace the rendering is attributed to. The path artifacts record
    // their own Stage 9 trace; the intent brief (D-66) is attributed to the
    // Stage 2 trace that produced its source, so a stage still has exactly
    // one trace (`AP-8`) and the validation event names the stage whose
    // output it validated (`M-10`).
    options: { readonly traceId?: string } = {},
  ): Promise<readonly ArtifactPlanEntry[]> => {
    let updated = plan;

    // `M-10` — one trace for the rendered set, so each validation event names
    // the stage that produced the artifact it describes. Rendered artifacts
    // make no provider call, so this is a deterministic record like Stage 5
    // and Stage 8.
    const renderTraceId =
      options.traceId ??
      (await recordDeterministicStage(input, {
        stageNumber: 9,
        structuredInput: { rendered: plan.map((e) => e.artifactType) },
        structuredOutput: { renderer: "derived-artifacts" },
      }));

    for (const entry of plan) {
      const render = renderers[entry.artifactType];
      if (!entry.planned || render === undefined) continue;

      const content = render();
      let outcome: ArtifactOutcome = "generated";
      let reason = "";
      try {
        validateArtifact(entry.artifactType, content);
      } catch (error) {
        outcome = "failed";
        reason =
          error instanceof ArtifactSchemaError
            ? "Rendered but did not satisfy its output schema."
            : "Rendering did not produce a usable document.";
      }
      // D-72 — Stage 10's consistency class, at the same point as the schema
      // class: a rendered artifact that disagrees with its source is failed.
      if (outcome === "generated") {
        const deep = await deepValidate(
          input,
          renderTraceId,
          entry.artifactType,
          content,
        );
        if (deep !== null) {
          outcome = "failed";
          reason = deep;
        }
      }

      // `M-10` — recorded whether it passed or failed. A rate computed only
      // from failures would have no denominator.
      //
      // `regenerationTriggered` is **false** here and structurally so: a
      // rendered artifact is a deterministic function of reasoning already
      // stored, so a second attempt would recompute the identical document
      // (`docs/15` D-40, and the same reasoning `API-032` uses to refuse a
      // retry for these types).
      await recordValidation({
        stageTraceId: renderTraceId,
        artifactType: entry.artifactType,
        passed: outcome === "generated",
        ...(reason !== "" ? { failureDetail: reason } : {}),
        regenerationTriggered: false,
      });

      await deps.resultSink?.persistArtifact?.(input.analysisId, {
        artifactType: entry.artifactType,
        content,
        depthLevel: "standard",
        // Rendered, not generated: there is no second attempt to make, because
        // a deterministic renderer given the same input produces the same
        // output. Regeneration is a remedy for sampling, not for arithmetic.
        generationAttemptCount: 1,
        validationStatus: outcome === "generated" ? "valid" : "failed",
      });

      emit(
        input.analysisId,
        outcome === "generated"
          ? { type: "artifact", artifactType: entry.artifactType, content }
          : {
              type: "artifact_failed",
              artifactType: entry.artifactType,
              reason,
              retryAvailable: isRetryableArtifactType(entry.artifactType),
            },
      );

      updated = withOutcome(updated, entry.artifactType, outcome);
    }

    return updated;
  };

  /**
   * D-72 — every result passes through Stage 10 (the reasoning-level
   * validation classes, traced) and Stage 12 (assembly), whether it halted
   * or completed. A Stage 10 enforced failure or a Stage 12 refusal fails the
   * analysis: "no invalid or unsupported output reaches a user" and "partial
   * assembly is not permitted" are the specified behaviours.
   */
  const run = async (input: PipelineInput): Promise<PipelineResult> => {
    const result = await runStages(input);

    // --- Stage 10 -------------------------------------------------------
    const entry = validationOf(input);
    extendContext(input, {
      ...(result.intent !== undefined ? { intent: result.intent } : {}),
      ...(result.context !== undefined ? { context: result.context } : {}),
      ...(result.architecture !== undefined
        ? { architecture: result.architecture }
        : {}),
      ...(result.workflowReview !== undefined
        ? { workflowReview: result.workflowReview }
        : {}),
      ...(result.recommendation !== undefined
        ? { recommendation: result.recommendation }
        : {}),
      ...(result.portfolioSuggestions !== undefined
        ? { portfolio: result.portfolioSuggestions }
        : {}),
    });
    const reasoningFindings = validateReasoning(entry.context);
    entry.findings.push(...reasoningFindings);
    const enforcedFailures = entry.findings.filter(
      (f) => !f.advisory && !f.passed,
    );
    const stage10TraceId = await recordDeterministicStage(input, {
      stageNumber: 10,
      structuredInput: {
        classes: [
          "schema",
          "rationale_completeness",
          "reference_integrity",
          "provenance_integrity",
          "unsupported_claim_detection",
          "internal_consistency",
        ],
        artifacts: (result.artifactPlan ?? [])
          .filter((e) => e.planned)
          .map((e) => e.artifactType),
      },
      structuredOutput: {
        findings: entry.findings.map((f) => ({
          class: f.validationClass,
          subject: f.subject,
          passed: f.passed,
          advisory: f.advisory,
          ...(f.detail !== undefined ? { detail: f.detail } : {}),
        })),
      },
      ...(enforcedFailures.length > 0
        ? {
            failureReason: `Stage 10 enforced class(es) failed: ${enforcedFailures.map((f) => f.validationClass).join(", ")}`,
          }
        : {}),
    });
    for (const f of reasoningFindings) {
      await recordValidation({
        stageTraceId: stage10TraceId,
        artifactType: f.subject,
        passed: f.passed,
        ...(f.detail !== undefined ? { failureDetail: f.detail } : {}),
        regenerationTriggered: false,
        validationClass: f.validationClass,
      });
    }
    // Reasoning-level enforced failures fail closed. The parsers already
    // enforce each of these, so reaching here is a defect, not a judgement.
    const reasoningFailure = reasoningFindings.find(
      (f) => !f.advisory && !f.passed,
    );
    if (reasoningFailure !== undefined) {
      runValidation.delete(input.analysisId);
      throw new StageError(
        10,
        "response_validation",
        `Stage 10 ${reasoningFailure.validationClass} failed: ${reasoningFailure.detail ?? ""}`,
      );
    }

    // --- Stage 11 -------------------------------------------------------
    // D-86: deterministic, from measured factors, never model-reported
    // (`AIP-2`). Runs on every result that reaches here — a halt or a
    // refusal takes `low` by D-31 decision 1 — so the band is never absent
    // from a completed analysis.
    const confidence = evaluateConfidence(
      {
        ...(result.context !== undefined ? { context: result.context } : {}),
        ...(result.artifactPlan !== undefined
          ? { artifactPlan: result.artifactPlan }
          : {}),
      },
      CONFIDENCE_MODEL_V1,
    );
    await recordDeterministicStage(input, {
      stageNumber: 11,
      structuredInput: {
        model: CONFIDENCE_MODEL_V1.version,
        elements: result.context?.elements.length ?? 0,
        generated: (result.artifactPlan ?? []).filter(
          (e) => e.planned && e.outcome === "generated",
        ).length,
      },
      structuredOutput: renderConfidence(confidence),
    });
    await deps.resultSink?.persistConfidence?.(input.analysisId, confidence);
    const withConfidence: PipelineResult = { ...result, confidence };

    // --- Stage 12 -------------------------------------------------------
    try {
      const report = assembleResponse(withConfidence);
      await recordDeterministicStage(input, {
        stageNumber: 12,
        structuredInput: {
          planned: (result.artifactPlan ?? []).length,
          halted: result.haltedAt !== undefined,
          confidence: confidence.band,
        },
        structuredOutput: report,
      });
    } catch (error) {
      if (error instanceof AssemblyError) {
        await recordDeterministicStage(input, {
          stageNumber: 12,
          structuredInput: { planned: (result.artifactPlan ?? []).length },
          structuredOutput: { problems: error.problems },
          failureReason: error.message,
        });
        runValidation.delete(input.analysisId);
        throw new StageError(12, "response_assembly", error.message);
      }
      throw error;
    }
    runValidation.delete(input.analysisId);
    return withConfidence;
  };

  /** Runs stages 1-3 in the `FR-010` order, halting where the spec halts. */
  const runStages = async (input: PipelineInput): Promise<PipelineResult> => {
    // `FR-014` — a corrected classification replaces Stage 1 rather than
    // competing with it. Recorded as a deterministic stage so the trace shows
    // *why* this analysis has the type it has (`FR-017`: orchestration
    // "explicit and inspectable"), and so a reader can tell a user's decision
    // from a model's.
    //
    // ⚠️ `confidence: 1` IS NOT A MODEL MEASUREMENT. There is no ambiguity
    // about the frame this analysis ran under — the user fixed it — and
    // `wasLowConfidence` is false for the same reason. What marks the value as
    // user-supplied rather than measured is `userOverrideType` on the stored
    // row, which `API-021` returns and the UI and export both surface. A
    // reader that ignored that column would misread this number, which is why
    // nothing in this project displays confidence without it.
    const classification: ClassificationResult =
      input.classificationOverride === undefined
        ? await runStage(input, {
            stageNumber: 1,
            structuredInput: { text: input.text },
            buildRequest: (prompt) =>
              request(prompt, "input_classification", input.text),
            parse: parseClassification,
          })
        : {
            determinedType: input.classificationOverride,
            confidence: 1,
            candidateTypes: [input.classificationOverride],
            wasLowConfidence: false,
            mixedDetected: false,
          };

    if (input.classificationOverride !== undefined) {
      await recordDeterministicStage(input, {
        stageNumber: 1,
        structuredInput: {
          text: input.text,
          classification_override: input.classificationOverride,
        },
        structuredOutput: classification,
      });
    }

    // Persisted as the stage completes, not batched at the end (`DB §6.2`).
    // Deliberately unguarded: unlike a trace write, a primary-domain failure
    // means the analysis was not stored, and `FR-060` retrieval reproduces
    // what is stored.
    await deps.resultSink?.persistClassification(
      input.analysisId,
      classification,
      input.classificationOverride,
    );
    emit(input.analysisId, classificationEvent(classification));

    if (!classificationProceeds(classification)) {
      // `FR-011`/`FR-092`: `unsupported` declines with an explanation and no
      // reasoning is performed. Not a failure — a designed outcome.
      return {
        classification,
        haltedAt: {
          stageNumber: 1,
          reason:
            "Input classified unsupported; no reasoning performed (FR-092)",
        },
      };
    }

    // Captured so the brief's validation event names the stage that produced
    // its source (`M-10`), without a second Stage 2 trace.
    let intentTraceId: string | null = null;
    const intent: IntentResult = await runStage(input, {
      stageNumber: 2,
      classifiedAs: classification.determinedType,
      onStageTrace: (id) => {
        intentTraceId = id;
      },
      structuredInput: { text: input.text, classification },
      buildRequest: (prompt) =>
        request(
          prompt,
          "intent_detection",
          // `AI §3.2` Stage 2 input: "Input text + classification".
          stageHandoff({ input_text: input.text, classification }),
        ),
      // D-90: a declined design must be quoted verbatim from the input.
      parse: (text) => parseIntent(text, input.text),
      // The one Stage 2 failure worth a single regeneration: the model read
      // a decline and could not point at it. Same shape as Stage 6's
      // traceability regeneration (`AI §3.2`).
      regenerateOnce: (error) => error instanceof IntentDeclineQuoteError,
    });
    extendContext(input, { intent });

    await deps.resultSink?.persistIntent(input.analysisId, intent);

    // D-66 — the intent brief: the first artifact of every reasoning path,
    // rendered from the intent record the moment it exists. It says what the
    // input asks for, as understood, and nothing more; its `standing` field
    // says so in the document itself. Planned here rather than at Stage 8
    // because its source stage is this one, and `DB §4.4`'s plan is written
    // when the source stage completes (D-66 amends the "at Stage 8" wording).
    // Everything after this point carries it in the plan, so a halt at Stage 3
    // still reports the one artifact the run did produce (`FR-091`).
    const briefPlan = planIntentBrief();
    emit(input.analysisId, planEvent(briefPlan));
    await deps.resultSink?.persistArtifactPlan?.(input.analysisId, briefPlan);
    const brief = await emitDerivedArtifacts(
      input,
      briefPlan,
      { intent_brief: () => renderIntentBrief(intent) },
      intentTraceId === null ? {} : { traceId: intentTraceId },
    );
    const withBrief = (
      plan: readonly ArtifactPlanEntry[] = [],
    ): readonly ArtifactPlanEntry[] => [...brief, ...plan];

    const context: ContextResult = await runStage(input, {
      stageNumber: 3,
      classifiedAs: classification.determinedType,
      structuredInput: { text: input.text, intent },
      buildRequest: (prompt) =>
        request(
          prompt,
          "context_extraction",
          // `AI §3.2` Stage 3 input: "Input text + intent".
          stageHandoff({ input_text: input.text, intent }),
        ),
      parse: (text) => parseContext(text, input.text),
    });
    extendContext(input, { context });

    await deps.resultSink?.persistContext(input.analysisId, context);
    // The problem as understood, which `FR-040` puts first and `FR-041` wants
    // visible before the slow stages run.
    emit(input.analysisId, understandingEvent(intent, context));

    // D-86: a feature capture wants Stage 3's output and nothing after it.
    if (input.stopAfterStage === 3) {
      return {
        classification,
        intent,
        context,
        artifactPlan: withBrief(),
        haltedAt: {
          stageNumber: 3,
          reason:
            "Stopped after Stage 3 by request — a confidence-feature capture (D-86)",
        },
      };
    }

    if (!contextProceeds(context)) {
      emit(
        input.analysisId,
        insufficientContextEvent(
          "Context insufficient; any design would be substantially invented (AI §5.4)",
          context,
        ),
      );
      // `AI §5.4`: "Analysis does not proceed to reasoning." The system states
      // what is missing — the `unknown` elements carry their resolution hints.
      return {
        classification,
        intent,
        context,
        artifactPlan: withBrief(),
        haltedAt: {
          stageNumber: 3,
          reason:
            "Context insufficient; any design would be substantially invented (AI §5.4)",
        },
      };
    }

    // Stage 5 — deterministic (`AI` App. A, `docs/12` D-35). Reduced in v1: it
    // selects the reasoning modules and the depth level, and produces no
    // complexity pre-assessment, which remains undefined. Recorded like any
    // other stage so the routing below is auditable rather than implicit —
    // `FR-017` wants orchestration "explicit and inspectable".
    // D-90: the depth is read from the input's length — the one rule, in
    // `reasoning-planning.ts`, recorded with its input so the trace shows why.
    const depthSignals = { characterCount: input.text.length };
    const reasoningPlan = planReasoning(
      classification.determinedType,
      depthSignals,
    );
    await recordDeterministicStage(input, {
      stageNumber: 5,
      structuredInput: { classification, intent, depthSignals },
      structuredOutput: reasoningPlan,
    });

    // D-90 — Stage 8 by judgement, recorded as its own deterministic stage
    // on every path that reaches it (`AI` App. A lists Stage 8 as
    // deterministic; the job-description path has recorded it since D-29).
    const recordPlan = async (
      plan: readonly ArtifactPlanEntry[],
      judged: Record<string, unknown>,
    ): Promise<void> => {
      await recordDeterministicStage(input, {
        stageNumber: 8,
        structuredInput: {
          classifiedAs: classification.determinedType,
          depthLevel: reasoningPlan.depthLevel,
          characterCount: input.text.length,
          requestedOutcome: intent.requestedOutcome,
          ...judged,
        },
        structuredOutput: plan,
      });
      emit(input.analysisId, planEvent(plan));
      await deps.resultSink?.persistArtifactPlan?.(input.analysisId, plan);
    };

    // `FR-022` — the job-description path decides whether to apply now or
    // build first. `AI §9.1` gives it no architecture, so this is where that
    // path produces its reasoning instead of stopping at context.
    if (reasoningPlan.requiredAnalyses.includes("recommendation_generation")) {
      const profile = deps.capabilityProfile;
      if (profile === undefined) {
        // Not a failure. Without a profile there is nothing to compare the
        // posting against, and a gap analysis against an absent inventory
        // would invent both halves of its own conclusion.
        return {
          classification,
          intent,
          context,
          artifactPlan: withBrief(),
          haltedAt: {
            stageNumber: 7,
            reason:
              "No capability profile supplied; gap analysis needs one side to compare against (FR-022)",
          },
        };
      }

      const recommendation: RecommendationResult = await runStage(input, {
        stageNumber: 7,
        classifiedAs: classification.determinedType,
        structuredInput: { classification, intent, context },
        buildRequest: (prompt) =>
          request(
            prompt,
            "recommendation_generation",
            // The context set is labelled so requirement grounding is copied
            // rather than counted, exactly as Stage 6 receives it.
            stageHandoff({
              classification,
              intent,
              context: contextHandoffView(context),
              capability_profile: profile,
            }),
          ),
        parse: (text) => parseRecommendation(text, context, profile),
      });
      extendContext(input, { recommendation });

      emit(input.analysisId, reasoningCompleteEvent(null, recommendation));
      await deps.resultSink?.persistRecommendation?.(
        input.analysisId,
        recommendation,
      );

      // Stage 8 — deterministic (`AI` App. A). No prompt, no provider call, no
      // model judgement: the same input yields the same plan, which is what
      // `FR-024` requires of artifact selection.
      // D-90: at minimal depth only the gap analysis is planned.
      const artifactPlan = planArtifacts(
        recommendation,
        reasoningPlan.depthLevel,
      );
      await recordDeterministicStage(input, {
        stageNumber: 8,
        structuredInput: {
          recommendation,
          depthLevel: reasoningPlan.depthLevel,
        },
        structuredOutput: artifactPlan,
      });
      // `DB §4.4`: the plan is written at Stage 8, including the entries that
      // were planned *out* — omission and failure stay distinguishable only if
      // the omissions are stored too (`FR-091`, `AIP-8`).
      // `API §7.4`: `plan` precedes any `artifact` event, so the client knows
      // what to expect before results arrive. Guaranteed by position — Stage 8
      // completes before Stage 9 starts.
      emit(input.analysisId, planEvent(artifactPlan));
      await deps.resultSink?.persistArtifactPlan?.(
        input.analysisId,
        artifactPlan,
      );

      // D-75 — the gap analysis is rendered from the recommendation on every
      // run that reaches here. Its renderer is registered once; which Stage 9
      // trace it is attributed to depends on whether the portfolio generator
      // runs (below), so a stage still has exactly one trace (`AP-8`).
      const gapPlan = artifactPlan.filter(
        (e) => e.artifactType === "skill_gap_analysis",
      );
      const gapRenderers = {
        skill_gap_analysis: () => renderSkillGapAnalysis(recommendation),
      };
      const withoutGap = (
        entries: readonly ArtifactPlanEntry[],
        rendered: readonly ArtifactPlanEntry[],
      ): readonly ArtifactPlanEntry[] =>
        entries.map(
          (e) => rendered.find((r) => r.artifactType === e.artifactType) ?? e,
        );

      if (!isPlanned(artifactPlan, "portfolio_suggestions")) {
        // Planned out, with the reason already on the entry. Not a halt: the
        // run completed everything its path defines — including, since D-75,
        // the gap analysis, which an apply_now verdict still has to show, and
        // since D-76 the interview guidance, which an apply_now operator is
        // about to need. The generator's Stage 9 trace carries the rendering.
        const interview = await generateInterviewGuidance(
          input,
          classification.determinedType,
          recommendation,
        );
        await settleInterviewGuidance(input, interview);
        const gapEntries = await emitDerivedArtifacts(
          input,
          gapPlan,
          gapRenderers,
          interview.traceId === null ? {} : { traceId: interview.traceId },
        );
        return {
          classification,
          intent,
          context,
          recommendation,
          artifactPlan: withBrief(
            withoutGap(
              withOutcome(
                artifactPlan,
                "interview_guidance",
                interview.outcome,
              ),
              gapEntries,
            ),
          ),
          ...(interview.guidance !== undefined
            ? { interviewGuidance: interview.guidance }
            : {}),
        };
      }

      // Stage 9 — one generator, independent by construction (`AID-08`): it
      // reads reasoning state and no other generator's output.
      const eligible = eligibleGaps(recommendation);
      // Declared before the generator closes over them.
      let lastPortfolioWire: unknown;
      let portfolioAttempts = 1;
      // `M-10` — captured so the validation event names the stage whose
      // output it validated.
      let portfolioTraceId: string | null = null;

      const generate = (): Promise<PortfolioSuggestions> =>
        runStage(input, {
          stageNumber: 9,
          classifiedAs: classification.determinedType,
          onStageTrace: (id) => {
            portfolioTraceId = id;
          },
          structuredInput: { recommendation, artifactPlan },
          buildRequest: (prompt) =>
            request(
              prompt,
              "portfolio_suggestions",
              // The eligible set is derived and labelled, never left for the
              // model to filter: which gaps may justify a build is application
              // knowledge (`docs/12` D-19, D-28, D-29).
              stageHandoff({
                eligible_gaps: eligibleGapsView(recommendation, eligible),
                matched_capabilities: recommendation.matched,
                verdict: recommendation.verdict,
              }),
            ),
          parse: (text) => {
            // `FR-039`: every artifact validates against its schema before
            // presentation. Against the *wire* record, because the schema is the
            // Output Contract the generator was given (`AI §6.1`, `§9.3`) — the
            // camelCase result is downstream of it.
            const wire = parseStructured(9, "portfolio_suggestions", text);
            // Captured before validation so a *failed* artifact still has a
            // document to store: `DB §4.4` keeps failed artifacts rather than
            // discarding them, which is what turns an unexplained gap into a
            // labelled failure.
            lastPortfolioWire = wire;
            validateArtifact("portfolio_suggestions", wire);
            // Schema-valid is necessary, not sufficient: gap coverage, project
            // redundancy and the rank total order are not expressible in JSON
            // Schema and stay here (`docs/12` D-29).
            return parsePortfolioSuggestions(text, eligible);
          },
          // `FR-039`: "Validation failure triggers one regeneration attempt."
          // The existing Stage 6 mechanism, not a second retry path — one
          // attempt, then the failure stands (`AI §3.2`).
          //
          // The attempt carries the violations. A schema failure names exactly
          // what was wrong, and re-sending the identical request throws that
          // away: analysis `d797492d` spent two calls producing the same
          // omission because the second was never told about the first.
          regenerateOnce: (error) => {
            if (!(error instanceof ArtifactSchemaError)) return false;
            // `DB §4.4`: generation_attempt_count records regeneration.
            portfolioAttempts += 1;
            return { addendum: correctionFor(error) };
          },
        });

      // `FR-091` — partial failure yields partial results with honest
      // labelling, and `AI` App. A makes Stage 9 "per-artifact isolated".
      // Letting the failure escape would discard a completed classification,
      // intent, context, recommendation and plan to report one artifact that
      // did not generate — the "silent omission" `FR-091` calls a defect,
      // applied to the whole analysis.
      //
      // The failure is not swallowed: `runStage` has already recorded the
      // Stage 9 trace with `outcome: "failure"` and its retry count, and the
      // plan entry below carries the label a reader needs.
      let portfolioSuggestions: PortfolioSuggestions | undefined;
      let outcome: ArtifactOutcome = "generated";
      // `API §7.4` specifies a failure reason on this event, so one is sent —
      // but a *classified* one, never the raw error. An error message can carry
      // a replay fixture key, a parser dump, or provider text, and `API §9.5`
      // and `AI-006` keep all three off a client channel. Which class it was is
      // the part a reader can act on; the detail is on the stage trace, where
      // an operator can read it (`DB §8.4`).
      let failureReason = "";
      try {
        portfolioSuggestions = await generate();
        // D-72 — Stage 10's consistency class on the generated document, at
        // the same point the schema class ran: a failure fails the artifact.
        const deep = await deepValidate(
          input,
          portfolioTraceId,
          "portfolio_suggestions",
          lastPortfolioWire,
        );
        if (deep !== null) {
          portfolioSuggestions = undefined;
          throw new ResponseValidationError(deep);
        }
      } catch (error) {
        outcome = "failed";
        failureReason =
          error instanceof ResponseValidationError
            ? error.message
            : error instanceof ArtifactSchemaError
              ? "Generated but did not satisfy its output schema."
              : "Generation did not produce a usable document.";
      }

      // `FR-091` — a failed artifact is announced, not dropped. The stream has
      // to distinguish "tried and failed" from the "chose not to" the `plan`
      // event already carried.
      emit(
        input.analysisId,
        outcome === "generated" && portfolioSuggestions !== undefined
          ? {
              type: "artifact",
              artifactType: "portfolio_suggestions",
              content: lastPortfolioWire,
            }
          : {
              type: "artifact_failed",
              artifactType: "portfolio_suggestions",
              reason: failureReason,
              retryAvailable: isRetryableArtifactType("portfolio_suggestions"),
            },
      );

      // `DB §4.4`: the artifact is stored either way. A `failed` row is what a
      // reader sees instead of an absence, and only a `valid` one is
      // presentable. Nothing is stored when the generator produced no parseable
      // document at all — there is no artifact to record.
      if (lastPortfolioWire !== undefined) {
        await deps.resultSink?.persistArtifact?.(input.analysisId, {
          artifactType: "portfolio_suggestions",
          content: lastPortfolioWire,
          depthLevel: "standard",
          generationAttemptCount: portfolioAttempts,
          validationStatus: outcome === "generated" ? "valid" : "failed",
        });
      }

      // `M-10` — the one artifact type with a real regeneration, so
      // `regenerationTriggered` here reports something rather than being
      // structurally false: `portfolioAttempts` exceeds one exactly when
      // `FR-039`'s single informed retry was spent.
      await recordValidation({
        stageTraceId: portfolioTraceId,
        artifactType: "portfolio_suggestions",
        passed: outcome === "generated",
        ...(outcome === "generated" ? {} : { failureDetail: failureReason }),
        regenerationTriggered: portfolioAttempts > 1,
      });

      // D-75 — the gap analysis, attributed to the same Stage 9 trace as the
      // portfolio and announced right after it, before the n8n decision.
      const gapEntries = await emitDerivedArtifacts(
        input,
        gapPlan,
        gapRenderers,
        portfolioTraceId === null ? {} : { traceId: portfolioTraceId },
      );

      // D-71 — the n8n import file, rendered from the portfolio's
      // implementation plan. Planned here, at Stage 9, when the plan exists
      // (like the brief at Stage 2): a decision either way, so an analysis
      // whose project is not on n8n shows an omission with its reason.
      if (portfolioSuggestions !== undefined) {
        extendContext(input, { portfolio: portfolioSuggestions });
      }
      const n8nPlan = planN8nWorkflow(
        outcome === "generated" ? portfolioSuggestions : undefined,
      );
      emit(input.analysisId, planEvent(n8nPlan));
      await deps.resultSink?.persistArtifactPlan?.(input.analysisId, n8nPlan);
      const n8nProject =
        portfolioSuggestions === undefined
          ? null
          : n8nProjectOf(portfolioSuggestions);
      const n8nEntries = await emitDerivedArtifacts(
        input,
        n8nPlan,
        n8nProject === null
          ? {}
          : { n8n_workflow: () => renderN8nWorkflow(n8nProject) },
        portfolioTraceId === null ? {} : { traceId: portfolioTraceId },
      );

      // D-76 — the second generator, independent of the first (`AID-08`): it
      // reads the recommendation and nothing the portfolio produced.
      const interview = await generateInterviewGuidance(
        input,
        classification.determinedType,
        recommendation,
      );
      await settleInterviewGuidance(input, interview);

      return {
        classification,
        intent,
        context,
        recommendation,
        artifactPlan: withBrief([
          ...withoutGap(
            withOutcome(
              withOutcome(artifactPlan, "portfolio_suggestions", outcome),
              "interview_guidance",
              interview.outcome,
            ),
            gapEntries,
          ),
          ...n8nEntries,
        ]),
        ...(portfolioSuggestions !== undefined ? { portfolioSuggestions } : {}),
        ...(interview.guidance !== undefined
          ? { interviewGuidance: interview.guidance }
          : {}),
      };
    }

    // `FR-021` via `AI §7.1`, resolved by `docs/15` D-40. Stage 6's second
    // generator: this path reviews the workflow it was given rather than
    // designing a replacement, so it runs here instead of
    // `architecture_analysis` and never alongside it.
    if (reasoningPlan.requiredAnalyses.includes("workflow_review")) {
      const review: WorkflowReviewResult = await runStage(input, {
        stageNumber: 6,
        // Stage 6's other prompt. The number is the stage; the key is the job.
        stageKey: "workflow_review",
        classifiedAs: classification.determinedType,
        structuredInput: { classification, intent, context },
        buildRequest: (prompt) =>
          request(
            prompt,
            "workflow_review",
            stageHandoff({
              classification,
              intent,
              context: contextHandoffView(context),
            }),
          ),
        parse: (text) => parseWorkflowReview(text, context),
        // The same single regeneration `AI §3.2` grants Stage 6, for the same
        // failure: a citation resolving to nothing is worth one more attempt,
        // and nothing else is.
        regenerateOnce: (error) =>
          error instanceof WorkflowReviewGroundingError,
      });
      extendContext(input, { workflowReview: review });

      // `docs/15` D-40: the identified structure is *observed*, not designed,
      // and persists through the architecture entities because that is what
      // they model. `FR-032` then holds unchanged — a risk names a step of the
      // workflow under review.
      const observed: ArchitectureResult = {
        summary: review.summary,
        dataFlowDescription: review.dataFlowDescription,
        components: review.structure,
        // D-78: a review transcribes; it disposes of nothing, and says so.
        unknownDispositions: [],
      };
      // D-87: Stage 10 checks the platform comparison's fit lines against
      // the architecture in its context — on this path, the observed one.
      extendContext(input, { architecture: observed });
      await deps.resultSink?.persistArchitecture(input.analysisId, observed);
      await deps.resultSink?.persistWorkflowFindings?.(
        input.analysisId,
        review.findings,
      );
      emit(input.analysisId, reasoningCompleteEvent(review.summary));

      // D-90: planned by judgement — at minimal depth the review is the
      // whole answer, and the platform comparison and score are omitted
      // with their reasons on the entries.
      const workflowPlan = planPathArtifacts({
        classifiedAs: "existing_workflow",
        depthLevel: reasoningPlan.depthLevel,
        characterCount: input.text.length,
        intent,
        architecture: observed,
        inclusionReason: `The review identified ${String(review.structure.length)} step(s) and ${String(review.findings.length)} finding(s).`,
      });
      await recordPlan(workflowPlan, {
        steps: review.structure.length,
        findings: review.findings.length,
      });

      if (!isPlanned(workflowPlan, "platform_recommendation")) {
        const renderedMinimal = await emitDerivedArtifacts(
          input,
          workflowPlan,
          {
            workflow_recommendation: () => renderWorkflowRecommendation(review),
            risk_assessment: () => renderRiskAssessment(review),
          },
        );
        return {
          classification,
          intent,
          context,
          architecture: observed,
          workflowReview: review,
          artifactPlan: withBrief(renderedMinimal),
        };
      }

      // D-87 — the platform comparison (keep, move or stop) and, D-80, the
      // complexity assessment, both against the observed structure and
      // concurrent (D-80 §2); the rendered artifacts attach to the last
      // Stage 9 trace to finish.
      const [platform, complexity] = await Promise.all([
        generatePlatformRecommendation(
          input,
          classification.determinedType,
          observed,
          context,
          { stageKey: "platform_comparison" },
        ),
        generateComplexity(
          input,
          classification.determinedType,
          observed,
          context,
        ),
      ]);
      await settlePlatformRecommendation(input, platform);
      await settleComplexity(input, classification.determinedType, complexity);
      const lastWorkflowTrace = complexity.traceId ?? platform.traceId;
      const rendered = await emitDerivedArtifacts(
        input,
        withOutcome(
          withOutcome(
            workflowPlan,
            "platform_recommendation",
            platform.outcome,
          ),
          "complexity_score",
          complexity.outcome,
        ),
        {
          workflow_recommendation: () => renderWorkflowRecommendation(review),
          risk_assessment: () => renderRiskAssessment(review),
        },
        lastWorkflowTrace === null ? {} : { traceId: lastWorkflowTrace },
      );

      return {
        classification,
        intent,
        context,
        architecture: observed,
        workflowReview: review,
        artifactPlan: withBrief(rendered),
        ...(platform.recommendation !== undefined
          ? { platformRecommendation: platform.recommendation }
          : {}),
        ...(complexity.assessment !== undefined
          ? { complexityAssessment: complexity.assessment }
          : {}),
      };
    }

    if (!reasoningPlan.requiredAnalyses.includes("architecture_analysis")) {
      // `AI §9.1` scopes the architecture to the requirement and assessment
      // paths. Skipping is correct, not a halt: the run completed everything
      // its path defines. The condition now reads from the Stage 5 plan, which
      // derives it from `producesArchitecture` — the same predicate, stated once.
      return { classification, intent, context, artifactPlan: withBrief() };
    }

    // D-90 — the submitter declined a design (Stage 2, with their own words
    // verified against the input). The requirement path then produces the
    // problem statement and nothing that designs, chooses or scores a
    // solution: Stage 6 is not run, because a design nobody asked for is the
    // over-production `PV §3.2` names and `FR-017` forbids. Not a halt — the
    // run completed everything the input asked of it, and the plan records
    // every omission with its reason.
    if (
      classification.determinedType === "business_requirement" &&
      intent.requestedOutcome === "understanding_only"
    ) {
      const declinedPlan = planPathArtifacts({
        classifiedAs: classification.determinedType,
        depthLevel: reasoningPlan.depthLevel,
        characterCount: input.text.length,
        intent,
        inclusionReason: "",
      });
      await recordPlan(declinedPlan, {
        declineQuote: intent.declineQuote ?? null,
        stage6: "skipped: the submitter declined a design",
      });
      emit(
        input.analysisId,
        reasoningCompleteEvent(
          `No design produced: the submitter declined one ("${intent.declineQuote ?? ""}"). The business analysis states the problem as understood.`,
        ),
      );
      const renderedDeclined = await emitDerivedArtifacts(input, declinedPlan, {
        business_analysis: () => renderBusinessAnalysis(intent, context),
      });
      return {
        classification,
        intent,
        context,
        artifactPlan: withBrief(renderedDeclined),
      };
    }

    const architecture: ArchitectureResult = await runStage(input, {
      stageNumber: 6,
      classifiedAs: classification.determinedType,
      structuredInput: { classification, intent, context },
      buildRequest: (prompt) =>
        request(
          prompt,
          "architecture_analysis",
          // `AI §3.2` Stage 6 input: "Context + knowledge + reasoning plan".
          // Knowledge and the reasoning plan are Stages 4-5, which do not exist
          // (`docs/12` D-15); the classification and intent are the frame the
          // context was extracted under and are sent with it. The context set
          // is labelled so grounding is copied rather than counted.
          stageHandoff({
            classification,
            intent,
            context: contextHandoffView(context),
          }),
        ),
      // `FR-023` binds trade-offs and a named rejected approach to the
      // assessment path only. `FR-020` asks the requirement path for neither,
      // so requiring them everywhere would fail a path against a rule nothing
      // states about it.
      parse: (text) =>
        parseArchitecture(
          text,
          context,
          classification.determinedType === "technical_assessment",
        ),
      regenerateOnce: (error) => error instanceof ArchitectureTraceabilityError,
    });
    extendContext(input, { architecture });

    emit(input.analysisId, reasoningCompleteEvent(architecture.summary));
    await deps.resultSink?.persistArchitecture(input.analysisId, architecture);

    // `FR-023` — the assessment path turns its architecture into something the
    // user can defend. `AI §9.1` gives it Assessment Feedback and a Mermaid
    // diagram, both derivable from what Stage 6 just produced. The requirement
    // path (`FR-020`) gets its Architecture Recommendation and the same
    // diagram from the same source (D-73); its reasoning artifacts —
    // platform recommendation and the rest — remain the open decision STATUS
    // records, and `PATH_ARTIFACT_TYPES` lists only what is rendered.
    // D-90: planned by judgement. An unwarranted automation (Stage 6's
    // conclusion, `FR-020`) keeps the business analysis alone; a minimal
    // input keeps the path's minimal set; otherwise the whole set.
    const assessmentPlan = planPathArtifacts({
      classifiedAs: classification.determinedType,
      depthLevel: reasoningPlan.depthLevel,
      characterCount: input.text.length,
      intent,
      architecture,
      inclusionReason:
        classification.determinedType === "technical_assessment"
          ? `The assessment produced ${String(architecture.components.length)} component(s) with ${String(architecture.rejectedApproaches?.length ?? 0)} rejected approach(es).`
          : `The requirement was reasoned to an architecture of ${String(architecture.components.length)} component(s); the recommendation and its diagram are rendered from that architecture (D-73).`,
    });
    await recordPlan(assessmentPlan, {
      components: architecture.components.length,
      automationUnwarranted:
        architecture.automationUnwarranted?.statement ?? null,
    });

    const renderers = {
      assessment_feedback: () =>
        renderAssessmentFeedback(architecture, context),
      // D-77: the problem as understood — Stages 2 and 3, nothing later.
      business_analysis: () => renderBusinessAnalysis(intent, context),
      architecture_recommendation: () =>
        renderArchitectureRecommendation(architecture, context),
      mermaid_diagram: () => renderMermaidDiagram(architecture),
    };

    // D-78/D-79/D-80 — the requirement path's three Stage 9 generators: the
    // platform recommendation, the risk register, the complexity assessment.
    // Each takes the same handoff (the context set and the architecture with
    // its dispositions) and none reads another's answer, so they run
    // CONCURRENTLY: the path's wall time is the slowest generator, not the
    // sum. Sequentially, at Opus 5 high effort, the two D-79 generators
    // alone put a live run at 380 s of its 420 s deadline (D-79 §5); a third
    // in series would have breached it. Each generator still has its own
    // Stage 9 trace, its own regeneration and its own deep validation; the
    // deadline signal cancels all three together (FR-094). They are SETTLED
    // in a fixed order — platform, risk, complexity — so the events, the
    // persisted artifacts and the validation records keep the precedence
    // the plan states; only the three traces' completion order is the
    // provider's. The rendered artifacts attach to the last trace to finish.
    if (
      classification.determinedType === "business_requirement" &&
      isPlanned(assessmentPlan, "platform_recommendation")
    ) {
      const [platform, risk, complexity, roadmap, integrations, edgeCases] =
        await Promise.all([
          generatePlatformRecommendation(
            input,
            classification.determinedType,
            architecture,
            context,
          ),
          generateRiskRegister(
            input,
            classification.determinedType,
            architecture,
            context,
          ),
          generateComplexity(
            input,
            classification.determinedType,
            architecture,
            context,
          ),
          // D-82: the roadmap, the path's fourth generator.
          generateRoadmap(
            input,
            classification.determinedType,
            architecture,
            context,
          ),
          // D-84/D-83: the integration requirements and the edge cases.
          generateIntegrations(
            input,
            classification.determinedType,
            architecture,
            context,
          ),
          generateEdgeCases(
            input,
            classification.determinedType,
            architecture,
            context,
          ),
        ]);
      await settlePlatformRecommendation(input, platform);
      await settleRiskRegister(input, risk);
      await settleComplexity(input, classification.determinedType, complexity);
      await settleRoadmap(input, roadmap);
      await settleIntegrations(input, integrations);
      await settleEdgeCases(input, edgeCases);
      // D-85: the settled results reach Stage 10, which checks the executive
      // summary's every figure against them.
      extendContext(input, {
        ...(platform.recommendation !== undefined
          ? { platformRecommendation: platform.recommendation }
          : {}),
        ...(risk.register !== undefined ? { riskRegister: risk.register } : {}),
        ...(complexity.assessment !== undefined
          ? { complexityAssessment: complexity.assessment }
          : {}),
        ...(roadmap.roadmap !== undefined
          ? { implementationRoadmap: roadmap.roadmap }
          : {}),
      });
      const notSummarised = [
        ...(platform.recommendation === undefined
          ? ["the platform recommendation"]
          : []),
        ...(risk.register === undefined ? ["the risk register"] : []),
        ...(complexity.assessment === undefined
          ? ["the complexity score"]
          : []),
        ...(roadmap.roadmap === undefined
          ? ["the implementation roadmap"]
          : []),
      ];
      const lastTrace =
        edgeCases.traceId ??
        integrations.traceId ??
        roadmap.traceId ??
        complexity.traceId ??
        risk.traceId ??
        platform.traceId;
      const rendered = await emitDerivedArtifacts(
        input,
        withOutcome(
          withOutcome(
            withOutcome(
              withOutcome(
                withOutcome(
                  withOutcome(
                    assessmentPlan,
                    "platform_recommendation",
                    platform.outcome,
                  ),
                  "risk_assessment",
                  risk.outcome,
                ),
                "complexity_score",
                complexity.outcome,
              ),
              "implementation_roadmap",
              roadmap.outcome,
            ),
            "integration_requirements",
            integrations.outcome,
          ),
          "edge_cases_and_practices",
          edgeCases.outcome,
        ),
        {
          ...renderers,
          // D-85: rendered from the settled results, after the generators,
          // so it cannot contradict them; listed first in the plan.
          executive_summary: () =>
            renderExecutiveSummary({
              intent,
              context,
              architecture,
              ...(platform.recommendation !== undefined
                ? { platform: platform.recommendation }
                : {}),
              ...(risk.register !== undefined
                ? { riskRegister: risk.register }
                : {}),
              ...(complexity.assessment !== undefined
                ? { complexity: complexity.assessment }
                : {}),
              ...(roadmap.roadmap !== undefined
                ? { roadmap: roadmap.roadmap }
                : {}),
              notSummarised,
            }),
        },
        lastTrace === null ? {} : { traceId: lastTrace },
      );
      return {
        classification,
        intent,
        context,
        architecture,
        // D-90: the brief is part of every reasoning path plan (D-66); the
        // workflow and posting paths already returned it, this one did not.
        artifactPlan: withBrief(rendered),
        ...(platform.recommendation !== undefined
          ? { platformRecommendation: platform.recommendation }
          : {}),
        ...(risk.register !== undefined ? { riskRegister: risk.register } : {}),
        ...(complexity.assessment !== undefined
          ? { complexityAssessment: complexity.assessment }
          : {}),
        ...(roadmap.roadmap !== undefined
          ? { implementationRoadmap: roadmap.roadmap }
          : {}),
        ...(edgeCases.analysis !== undefined
          ? { edgeCaseAnalysis: edgeCases.analysis }
          : {}),
        ...(integrations.requirements !== undefined
          ? { integrationRequirements: integrations.requirements }
          : {}),
      };
    }

    const rendered = await emitDerivedArtifacts(
      input,
      assessmentPlan,
      renderers,
    );

    return {
      classification,
      intent,
      context,
      architecture,
      artifactPlan: withBrief(rendered),
    };
  };

  /**
   * Stage 9 for one artifact, from stored reasoning (`API-032`, `FR-091`).
   *
   * WHY THE PIPELINE OWNS THIS RATHER THAN THE ROUTE. Everything a
   * regeneration needs is already here — prompt composition, the provider
   * invoker, the trace sink, the fragment-usage sink, the single informed
   * retry. A route that rebuilt those would be a second Stage 9 that could
   * drift from the first, and boundary check 6 exists precisely so a stage is
   * not reachable except through this module. Calling `runStage` means a retry
   * is traced exactly like the original attempt (`AP-8`, `FR-100`) — indeed
   * the trace is the only place the two attempts can be told apart.
   *
   * IT DOES NOT RE-RUN STAGES 1-8. `API-032`: "reuses stored reasoning state;
   * does not re-run stages 1-8". The recommendation arrives already loaded
   * from the database, so no classification, extraction or Stage 7 call
   * happens — which is what makes a retry cheap enough to offer at all, and
   * what keeps it a *retry* rather than a second analysis (`API §7.6`).
   *
   * ⚠️ THE ARTIFACT IS RETURNED, NOT PERSISTED. Writing it is the caller's
   * job through the sinks, exactly as in a live run: `SA §3.4` keeps the NIE
   * away from the database, and this is not the place to make an exception.
   */
  const regenerateArtifact = async (input: {
    readonly analysisId: string;
    readonly classifiedAs: ClassificationType;
    readonly recommendation: RecommendationForArtifacts;
    /** D-76: which generator to run again. Defaults to the portfolio. */
    readonly artifactType?: RetryableArtifactType;
    /**
     * D-78/D-81: the stored architecture and context, for the generators
     * keyed on them — platform, risk register, complexity.
     */
    readonly architecture?: ArchitectureResult;
    readonly context?: ContextResult;
  }): Promise<RegeneratedArtifact> => {
    if (
      input.artifactType === "platform_recommendation" ||
      input.artifactType === "risk_assessment" ||
      input.artifactType === "complexity_score" ||
      input.artifactType === "implementation_roadmap" ||
      input.artifactType === "edge_cases_and_practices" ||
      input.artifactType === "integration_requirements"
    ) {
      if (input.architecture === undefined || input.context === undefined) {
        throw new Error(
          `Analysis ${input.analysisId} has no stored architecture and context to regenerate ${input.artifactType} from`,
        );
      }
      const stageInput = { analysisId: input.analysisId, text: "" };
      // D-81: the register and the score are regenerated only where they
      // are generated — `isRetryableArtifact` decided that at the route, and
      // the workflow path's stored architecture is the observed workflow,
      // which is what its complexity generator scored the first time.
      const generated =
        input.artifactType === "platform_recommendation"
          ? await generatePlatformRecommendation(
              stageInput,
              input.classifiedAs,
              input.architecture,
              input.context,
              {
                retry: true,
                // D-87: on the workflow path the type is the comparison.
                ...(input.classifiedAs === "existing_workflow"
                  ? { stageKey: "platform_comparison" as const }
                  : {}),
              },
            )
          : input.artifactType === "risk_assessment"
            ? await generateRiskRegister(
                stageInput,
                input.classifiedAs,
                input.architecture,
                input.context,
              )
            : input.artifactType === "implementation_roadmap"
              ? await generateRoadmap(
                  stageInput,
                  input.classifiedAs,
                  input.architecture,
                  input.context,
                )
              : input.artifactType === "edge_cases_and_practices"
                ? await generateEdgeCases(
                    stageInput,
                    input.classifiedAs,
                    input.architecture,
                    input.context,
                  )
                : input.artifactType === "integration_requirements"
                  ? await generateIntegrations(
                      stageInput,
                      input.classifiedAs,
                      input.architecture,
                      input.context,
                    )
                  : await generateComplexity(
                      stageInput,
                      input.classifiedAs,
                      input.architecture,
                      input.context,
                    );
      return {
        artifactType: input.artifactType,
        content: generated.wire,
        validationStatus:
          generated.outcome === "generated" ? "valid" : "failed",
        generationAttemptCount: generated.attempts,
      };
    }
    if (input.artifactType === "interview_guidance") {
      const generated = await generateInterviewGuidance(
        { analysisId: input.analysisId, text: "" },
        input.classifiedAs,
        input.recommendation,
        { retry: true },
      );
      return {
        artifactType: "interview_guidance",
        content: generated.wire,
        validationStatus:
          generated.outcome === "generated" ? "valid" : "failed",
        generationAttemptCount: generated.attempts,
      };
    }
    const eligible = eligibleGaps(input.recommendation);
    let lastWire: unknown;
    let attempts = 1;

    // `runStage` wants a `PipelineInput`; the text is only used to build a
    // request for stages that read the original input, and Stage 9 does not —
    // it reads the reasoning. Passing the empty string keeps the seam honest
    // about that rather than re-loading input this stage never consults.
    const stageInput: PipelineInput = {
      analysisId: input.analysisId,
      text: "",
    };

    try {
      await runStage(stageInput, {
        stageNumber: 9,
        classifiedAs: input.classifiedAs,
        structuredInput: { recommendation: input.recommendation, retry: true },
        buildRequest: (prompt) =>
          request(
            prompt,
            "portfolio_suggestions",
            stageHandoff({
              eligible_gaps: eligibleGapsView(input.recommendation, eligible),
              matched_capabilities: input.recommendation.matched,
              verdict: input.recommendation.verdict,
            }),
          ),
        parse: (text) => {
          const wire = parseStructured(9, "portfolio_suggestions", text);
          lastWire = wire;
          validateArtifact("portfolio_suggestions", wire);
          return parsePortfolioSuggestions(text, eligible);
        },
        // The same single informed regeneration a first attempt gets
        // (`FR-039`, `AI §3.2`). A retry is a fresh attempt at the stage, not
        // a licence to loop: `API-032` regenerates once per request, and a
        // caller wanting another asks again.
        regenerateOnce: (error) => {
          if (!(error instanceof ArtifactSchemaError)) return false;
          attempts += 1;
          return { addendum: correctionFor(error) };
        },
      });

      return {
        artifactType: "portfolio_suggestions",
        content: lastWire,
        validationStatus: "valid",
        generationAttemptCount: attempts,
      };
    } catch {
      // `FR-091` again: a failed retry stores a *labelled failure*, not an
      // absence. The document that failed is returned when there was one, so
      // `DB §4.4` can keep it for diagnosis exactly as the first attempt did.
      // The error itself is not propagated — it can carry parser or provider
      // detail, and `API §9.5`/`AI-006` keep both off a client channel.
      return {
        artifactType: "portfolio_suggestions",
        content: lastWire,
        validationStatus: "failed",
        generationAttemptCount: attempts,
      };
    }
  };

  return { run, regenerateArtifact };
}

/** What a single-artifact regeneration produced (`API-032`). */
export interface RegeneratedArtifact {
  readonly artifactType: ArtifactType;
  /** The wire document, or `undefined` when nothing parseable came back. */
  readonly content: unknown;
  readonly validationStatus: "valid" | "failed";
  readonly generationAttemptCount: number;
}

export { StageError };
