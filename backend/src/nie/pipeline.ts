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
  producesArchitecture,
  StageError,
  type ArchitectureResult,
  type ClassificationResult,
  type ClassificationType,
  type ContextResult,
  type IntentResult,
  type GapItem,
  type PipelineResult,
  type PortfolioSuggestions,
  type RecommendationResult,
  type RecommendationResult as ContractRecommendationResult,
} from "./contracts.js";
import { composePrompt, type ComposedPrompt } from "./prompt.js";
import type { CapabilityProfile } from "./capability-profile.js";
import { parseRecommendation } from "./stages/recommendation-generation.js";
import {
  eligibleGaps,
  isPlanned,
  planArtifacts,
} from "./stages/artifact-planning.js";
import { parsePortfolioSuggestions } from "./stages/portfolio-suggestions.js";
import type {
  FragmentResolver,
  FragmentUsageRecord,
  FragmentUsageSink,
  StageResultSink,
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

export interface PipelineDependencies {
  readonly invoker: ProviderInvoker;
  readonly resolver: FragmentResolver;
  readonly traceSink: StageTraceSink;
  readonly fragmentUsageSink: FragmentUsageSink;
  /**
   * Receives each stage's result as it completes (`DB §6.2`, `FR-091`).
   *
   * Optional so a caller that only wants to observe reasoning — the unit and
   * pipeline tests — needs no database. When absent nothing is persisted, and
   * that is a caller's choice rather than a silent loss.
   */
  readonly resultSink?: StageResultSink;
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
  // The branch the pipeline takes after Stage 3, mirrored. `AI §9.1` sends the
  // job-description path to Stage 7 and gives it no architecture, so a fixture
  // set that offered `architecture_analysis` here would describe a call that is
  // never made.
  if (classification.determinedType === "job_description") {
    if (outputs.capabilityProfile !== undefined) {
      inputs.set(
        "recommendation_generation",
        stageHandoff({
          classification,
          intent,
          context: contextHandoffView(context),
          capability_profile: outputs.capabilityProfile,
        }),
      );
    }
    return inputs;
  }

  inputs.set(
    "architecture_analysis",
    stageHandoff({
      classification,
      intent,
      context: contextHandoffView(context),
    }),
  );

  return inputs;
}

export interface PipelineInput {
  readonly analysisId: string;
  readonly text: string;
}

interface StageRun<T> {
  readonly stageNumber: number;
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
   * attempt. Only Stage 6 uses it: `AI §3.2` grants one regeneration on a
   * traceability failure, then fails "rather than emitting an unjustifiable
   * design". Everything else follows `SA §11.3` — stages do not auto-retry.
   */
  readonly regenerateOnce?: (error: unknown) => boolean;
}

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
  recommendation: ContractRecommendationResult,
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
  const recordDeterministicStage = async (
    input: PipelineInput,
    spec: {
      readonly stageNumber: number;
      readonly structuredInput: unknown;
      readonly structuredOutput: unknown;
    },
  ): Promise<void> => {
    const stage = stageByNumber(spec.stageNumber);
    const startedAt = now();
    await guard(() =>
      deps.traceSink.record({
        stageTraceId: newId(),
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
  };

  const runStage = async <T>(
    input: PipelineInput,
    spec: StageRun<T>,
  ): Promise<T> => {
    const stage = stageByNumber(spec.stageNumber);
    const stageTraceId = newId();
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

      const attempt = async (): Promise<T> => {
        const response = await deps.invoker.invoke(
          spec.buildRequest(prompt),
          invocationContext,
        );
        // Captured before parsing, so an unparseable response survives.
        lastProviderOutput = response.output;
        return spec.parse(response.output);
      };

      let parsed: T;
      try {
        parsed = await attempt();
      } catch (error) {
        if (spec.regenerateOnce?.(error) !== true) {
          throw error;
        }
        // One regeneration, then the failure stands (`AI §3.2`).
        retryCount = 1;
        parsed = await attempt();
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

  /** Runs stages 1-3 in the `FR-010` order, halting where the spec halts. */
  const run = async (input: PipelineInput): Promise<PipelineResult> => {
    const classification: ClassificationResult = await runStage(input, {
      stageNumber: 1,
      structuredInput: { text: input.text },
      buildRequest: (prompt) =>
        request(prompt, "input_classification", input.text),
      parse: parseClassification,
    });

    // Persisted as the stage completes, not batched at the end (`DB §6.2`).
    // Deliberately unguarded: unlike a trace write, a primary-domain failure
    // means the analysis was not stored, and `FR-060` retrieval reproduces
    // what is stored.
    await deps.resultSink?.persistClassification(
      input.analysisId,
      classification,
    );

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

    if (!contextProceeds(context)) {
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

    // `FR-022` — the job-description path decides whether to apply now or
    // build first. `AI §9.1` gives it no architecture, so this is where that
    // path produces its reasoning instead of stopping at context.
    if (classification.determinedType === "job_description") {
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
      const portfolioSuggestions: PortfolioSuggestions = await runStage(input, {
        stageNumber: 9,
        classifiedAs: classification.determinedType,
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
        parse: (text) => parsePortfolioSuggestions(text, eligible),
      });

      return {
        classification,
        intent,
        context,
        recommendation,
        artifactPlan,
        portfolioSuggestions,
      };
    }

    if (!producesArchitecture(classification.determinedType)) {
      // `AI §9.1` scopes the architecture to the requirement and assessment
      // paths. Skipping is correct, not a halt: the run completed everything
      // its path defines.
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
      parse: (text) => parseArchitecture(text, context),
      regenerateOnce: (error) => error instanceof ArchitectureTraceabilityError,
    });

    await deps.resultSink?.persistArchitecture(input.analysisId, architecture);

    return { classification, intent, context, architecture };
  };

  return { run };
}

export { StageError };
