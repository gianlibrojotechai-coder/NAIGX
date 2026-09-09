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
  type ArtifactType,
  type RecommendationForArtifacts,
  type WorkflowReviewResult,
} from "./contracts.js";
import { composePrompt, type ComposedPrompt } from "./prompt.js";
import type { CapabilityProfile } from "./capability-profile.js";
import { parseRecommendation } from "./stages/recommendation-generation.js";
import {
  eligibleGaps,
  isPlanned,
  withOutcome,
  planArtifacts,
} from "./stages/artifact-planning.js";
import { parsePortfolioSuggestions } from "./stages/portfolio-suggestions.js";
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
import { parseIntent } from "./stages/intent.js";
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
  planDerivedArtifacts,
  renderAssessmentFeedback,
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
    intent = parseIntent(outputs.intent);
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
  }): Promise<void> => {
    const sink = deps.validationSink;
    const stageTraceId = event.stageTraceId;
    if (sink === undefined || stageTraceId === null) return;

    await guard(() =>
      sink.record({
        stageTraceId,
        artifactType: event.artifactType,
        validationClass: "schema",
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
        outcome: "success",
        failureReason: null,
        retryCount: 0,
      }),
    );

    return stageTraceId;
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

        const response = await deps.invoker.invoke(request, invocationContext);
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
  ): Promise<readonly ArtifactPlanEntry[]> => {
    let updated = plan;

    // `M-10` — one Stage 9 trace for the rendered set, so each validation
    // event names the stage that produced the artifact it describes. Rendered
    // artifacts make no provider call, so this is a deterministic stage like
    // Stage 5 and Stage 8.
    const renderTraceId = await recordDeterministicStage(input, {
      stageNumber: 9,
      structuredInput: { rendered: plan.map((e) => e.artifactType) },
      structuredOutput: { renderer: "derived-artifacts" },
    });

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

  /** Runs stages 1-3 in the `FR-010` order, halting where the spec halts. */
  const run = async (input: PipelineInput): Promise<PipelineResult> => {
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

    const intent: IntentResult = await runStage(input, {
      stageNumber: 2,
      classifiedAs: classification.determinedType,
      structuredInput: { text: input.text, classification },
      buildRequest: (prompt) =>
        request(
          prompt,
          "intent_detection",
          // `AI §3.2` Stage 2 input: "Input text + classification".
          stageHandoff({ input_text: input.text, classification }),
        ),
      parse: parseIntent,
    });

    await deps.resultSink?.persistIntent(input.analysisId, intent);

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

    await deps.resultSink?.persistContext(input.analysisId, context);
    // The problem as understood, which `FR-040` puts first and `FR-041` wants
    // visible before the slow stages run.
    emit(input.analysisId, understandingEvent(intent, context));

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
    const reasoningPlan = planReasoning(classification.determinedType);
    await recordDeterministicStage(input, {
      stageNumber: 5,
      structuredInput: { classification, intent },
      structuredOutput: reasoningPlan,
    });

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

      emit(input.analysisId, reasoningCompleteEvent(null, recommendation));
      await deps.resultSink?.persistRecommendation?.(
        input.analysisId,
        recommendation,
      );

      // Stage 8 — deterministic (`AI` App. A). No prompt, no provider call, no
      // model judgement: the same input yields the same plan, which is what
      // `FR-024` requires of artifact selection.
      const artifactPlan = planArtifacts(recommendation);
      await recordDeterministicStage(input, {
        stageNumber: 8,
        structuredInput: { recommendation },
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

      if (!isPlanned(artifactPlan, "portfolio_suggestions")) {
        // Planned out, with the reason already on the entry. Not a halt: the
        // run completed everything its path defines.
        return {
          classification,
          intent,
          context,
          recommendation,
          artifactPlan,
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
      } catch (error) {
        outcome = "failed";
        failureReason =
          error instanceof ArtifactSchemaError
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

      return {
        classification,
        intent,
        context,
        recommendation,
        artifactPlan: withOutcome(
          artifactPlan,
          "portfolio_suggestions",
          outcome,
        ),
        ...(portfolioSuggestions !== undefined ? { portfolioSuggestions } : {}),
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

      // `docs/15` D-40: the identified structure is *observed*, not designed,
      // and persists through the architecture entities because that is what
      // they model. `FR-032` then holds unchanged — a risk names a step of the
      // workflow under review.
      const observed: ArchitectureResult = {
        summary: review.summary,
        dataFlowDescription: review.dataFlowDescription,
        components: review.structure,
      };
      await deps.resultSink?.persistArchitecture(input.analysisId, observed);
      await deps.resultSink?.persistWorkflowFindings?.(
        input.analysisId,
        review.findings,
      );
      emit(input.analysisId, reasoningCompleteEvent(review.summary));

      const workflowPlan = planDerivedArtifacts(
        "existing_workflow",
        `The review identified ${String(review.structure.length)} step(s) and ${String(review.findings.length)} finding(s).`,
      );
      emit(input.analysisId, planEvent(workflowPlan));
      await deps.resultSink?.persistArtifactPlan?.(
        input.analysisId,
        workflowPlan,
      );

      const rendered = await emitDerivedArtifacts(input, workflowPlan, {
        workflow_recommendation: () => renderWorkflowRecommendation(review),
        risk_assessment: () => renderRiskAssessment(review),
      });

      return {
        classification,
        intent,
        context,
        architecture: observed,
        workflowReview: review,
        artifactPlan: rendered,
      };
    }

    if (!reasoningPlan.requiredAnalyses.includes("architecture_analysis")) {
      // `AI §9.1` scopes the architecture to the requirement and assessment
      // paths. Skipping is correct, not a halt: the run completed everything
      // its path defines. The condition now reads from the Stage 5 plan, which
      // derives it from `producesArchitecture` — the same predicate, stated once.
      return { classification, intent, context };
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

    emit(input.analysisId, reasoningCompleteEvent(architecture.summary));
    await deps.resultSink?.persistArchitecture(input.analysisId, architecture);

    // `FR-023` — the assessment path turns its architecture into something the
    // user can defend. `AI §9.1` gives it Assessment Feedback and a Mermaid
    // diagram, both derivable from what Stage 6 just produced. The requirement
    // path's own artifact set is M-07 work and plans nothing here, which
    // `PATH_ARTIFACT_TYPES` states as an empty list.
    const assessmentPlan = planDerivedArtifacts(
      classification.determinedType,
      `The assessment produced ${String(architecture.components.length)} component(s) with ${String(architecture.rejectedApproaches?.length ?? 0)} rejected approach(es).`,
    );

    if (assessmentPlan.length === 0) {
      return { classification, intent, context, architecture };
    }

    emit(input.analysisId, planEvent(assessmentPlan));
    await deps.resultSink?.persistArtifactPlan?.(
      input.analysisId,
      assessmentPlan,
    );

    const rendered = await emitDerivedArtifacts(input, assessmentPlan, {
      assessment_feedback: () => renderAssessmentFeedback(architecture),
      mermaid_diagram: () => renderMermaidDiagram(architecture),
    });

    return {
      classification,
      intent,
      context,
      architecture,
      artifactPlan: rendered,
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
  }): Promise<RegeneratedArtifact> => {
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
