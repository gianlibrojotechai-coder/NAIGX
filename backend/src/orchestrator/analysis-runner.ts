/**
 * Wiring for the analysis runner — the composition seam (`SA §3.3`).
 *
 * `index.ts` owns the process; this owns the object graph an executing
 * analysis needs: reference rows, provider invoker, NIE pipeline, executor.
 * Separated so the wiring can be exercised in a test without a port, a signal
 * handler, or a shutdown sequence.
 *
 * IT IS HANDED AN ADAPTER, IT DOES NOT CHOOSE ONE. Which provider answers is
 * decided at the configuration boundary in `index.ts` and passed in already
 * built, together with the mode it was chosen under. That keeps this module
 * free of provider identity (`AI-006`) and makes it impossible for a wiring
 * change to quietly promote a run from replay to live.
 *
 * THE NIE IS UNTOUCHED. It receives ports — invoker, resolver, sinks — exactly
 * as `harness/run.ts` builds them. No HTTP or Prisma type crosses into it, and
 * boundary checks 2 and 4 hold.
 *
 * NO QUEUE. `startExecution` hands the id to the executor and returns; the
 * `ANALYSIS` row is the durable record (`SA §12`). A rejected run is reported
 * through `onError` and lands as a terminal `failed` status, never as an
 * unhandled rejection.
 */

import type { ClassificationType } from "../nie/contracts.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { PrismaClient as TracePrismaClient } from "../generated/prisma-trace/client.js";
import { createFragmentResolver } from "../db/fragment-resolver.js";
import { createFragmentUsageSink } from "../db/fragment-usage-sink.js";
import { createStageTraceSink } from "../db/stage-trace-sink.js";
import { createValidationEventSink } from "../db/validation-event-sink.js";
import { createStageResultSink } from "../db/analysis-result-sink.js";
import { readRecommendation } from "../db/recommendation-reader.js";
import { readArchitectureForRetry } from "../db/architecture-reader.js";
import { createProviderInvocationRecorder } from "../db/provider-invocation-recorder.js";
import { createProviderInvoker } from "../provider/invoke.js";
import type { ProviderAdapter } from "../provider/capability.js";
import type { AnalysisEventSink } from "../nie/ports.js";
import type { TokenRate } from "../provider/cost.js";
import { createPipeline } from "../nie/pipeline.js";
import { loadCapabilityProfile } from "../nie/capability-profile.js";
import type { CapabilityProfile } from "../nie/capability-profile.js";
import type { FieldCipher } from "../crypto/data-key.js";
import { createAnalysisExecutor } from "./execute-analysis.js";
import type { ExecutionMode } from "./execution-mode.js";

export interface AnalysisRunnerDependencies {
  readonly prisma: PrismaClient;
  readonly tracePrisma: TracePrismaClient;
  /**
   * Seals and opens the three fields `DB §13.1` row 3 names
   * ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §2).
   *
   * Passed down to the stage-trace sink, which seals `structured_input` and
   * `structured_output`, and to the executor, which opens `raw_content`. The
   * pipeline itself never receives it.
   */
  readonly cipher: FieldCipher;
  /** Built at the configuration boundary, for the mode below. */
  readonly adapter: ProviderAdapter;
  readonly mode: ExecutionMode;
  /**
   * Per-token cost. Required for `live` — `SA §3.5` and `NFR-083` make cost
   * accounting per call mandatory, and `harness/run.ts` already refuses to
   * assume a rate. A replay run bills nothing, so its rate is nominal.
   */
  readonly rate: TokenRate;
  /** Names the rows that record which model answered (`AI-004` drift attribution). */
  readonly providerKey: string;
  readonly modelKey: string;
  readonly onError?: (error: unknown) => void;
  /** Receives progress events (`FR-041`). Absent means nothing is watching. */
  readonly eventSink?: AnalysisEventSink;
  /** `FR-094` deadline override; absent means the executor's default (D-65). */
  readonly analysisTimeoutMs?: number;
}

export interface AnalysisRunner {
  readonly mode: ExecutionMode;
  /** Fire-and-forget: `API-020` returns before reasoning completes. */
  readonly startExecution: (
    analysisId: string,
    classificationOverride?: ClassificationType,
  ) => void;
  /**
   * `API-032` — regenerate one failed artifact from stored reasoning.
   *
   * Awaited, unlike `startExecution`: a retry is a single Stage 9 call rather
   * than a whole analysis, and the caller has something to report when it
   * settles. It reuses the same pipeline object, so the retry composes the
   * same fragments and writes the same traces as the attempt it replaces.
   */
  readonly retryArtifact: (
    analysisId: string,
    artifactType: string,
  ) => Promise<void>;
}

/**
 * Builds the runner, upserting the reference rows an analysis needs.
 *
 * Upserted rather than created so a restart reuses them instead of
 * accumulating a provider row per boot (`DB §4.5`).
 */
export async function createAnalysisRunner(
  deps: AnalysisRunnerDependencies,
): Promise<AnalysisRunner> {
  const provider = await deps.prisma.provider.upsert({
    where: { providerKey: deps.providerKey },
    update: {},
    create: {
      providerKey: deps.providerKey,
      // Spread into a plain object: `ProviderCapabilities` is a closed
      // interface and Prisma's JSON input wants an index signature.
      declaredCapabilities: { ...deps.adapter.capabilities },
      active: true,
    },
  });

  const modelVersion = await deps.prisma.modelVersion.upsert({
    where: {
      providerId_modelKey_versionLabel: {
        providerId: provider.providerId,
        modelKey: deps.modelKey,
        versionLabel: "1",
      },
    },
    update: {},
    create: {
      providerId: provider.providerId,
      modelKey: deps.modelKey,
      versionLabel: "1",
      active: true,
    },
  });

  // `FR-022` — the job-description path compares a posting against the
  // operator's authored inventory. A missing profile is carried, not thrown:
  // requirements, workflows and assessments still run, and a posting halts at
  // Stage 7 with the reason the pipeline already gives (`docs/12` D-27).
  // One sink, shared by the live pipeline and by a retry: both write through
  // the same `DB §4.4` path, so a regenerated artifact is stored exactly as a
  // first attempt would have been.
  const resultSink = createStageResultSink(deps.prisma);

  let capabilityProfile: CapabilityProfile | undefined;
  try {
    capabilityProfile = loadCapabilityProfile();
  } catch (error) {
    deps.onError?.(error);
  }

  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter: deps.adapter,
      rate: deps.rate,
      recorder: createProviderInvocationRecorder(deps.tracePrisma),
    }),
    resolver: createFragmentResolver(deps.prisma),
    traceSink: createStageTraceSink(deps.tracePrisma, deps.cipher),
    // `M-10` — the table that had no writer until `M-16`.
    validationSink: createValidationEventSink(deps.tracePrisma),
    fragmentUsageSink: createFragmentUsageSink(deps.prisma),
    // Progressive persistence (`DB §6.2`): each stage commits as it completes,
    // so a later failure keeps what earlier stages produced (`FR-091`).
    resultSink,
    ...(deps.eventSink !== undefined ? { eventSink: deps.eventSink } : {}),
    modelVersionId: modelVersion.modelVersionId,
    modelKey: modelVersion.modelKey,
    ...(capabilityProfile !== undefined ? { capabilityProfile } : {}),
    ...(deps.onError !== undefined ? { onRecordError: deps.onError } : {}),
  });

  const executor = createAnalysisExecutor({
    prisma: deps.prisma,
    mode: deps.mode,
    cipher: deps.cipher,
    modelVersionId: modelVersion.modelVersionId,
    runPipeline: (input) => pipeline.run(input),
    ...(deps.onError !== undefined ? { onError: deps.onError } : {}),
    ...(deps.eventSink !== undefined ? { eventSink: deps.eventSink } : {}),
    ...(deps.analysisTimeoutMs !== undefined
      ? { timeoutMs: deps.analysisTimeoutMs }
      : {}),
  });

  return {
    mode: deps.mode,

    async retryArtifact(analysisId, artifactType) {
      const classification = await deps.prisma.classification.findFirst({
        where: { analysisId },
        select: { determinedType: true },
      });
      if (classification === null) {
        throw new Error(`Analysis ${analysisId} has no stored classification`);
      }

      // D-78/D-81: the generators keyed on the architecture regenerate from
      // the stored architecture and context set, not from a recommendation
      // they never had. The route has already refused the type on any path
      // where it is rendered rather than generated.
      const regenerated =
        artifactType === "platform_recommendation" ||
        artifactType === "risk_assessment" ||
        artifactType === "complexity_score" ||
        artifactType === "implementation_roadmap" ||
        artifactType === "edge_cases_and_practices" ||
        artifactType === "integration_requirements"
          ? await (async () => {
              const stored = await readArchitectureForRetry(
                deps.prisma,
                analysisId,
              );
              if (stored === null) {
                throw new Error(
                  `Analysis ${analysisId} has no stored architecture to regenerate ${artifactType} from`,
                );
              }
              return pipeline.regenerateArtifact({
                analysisId,
                classifiedAs: classification.determinedType,
                recommendation: {
                  requiredCapabilities: [],
                  matched: [],
                  gaps: [],
                  verdict: {
                    decision: "apply_now",
                    rationale: "",
                    decisiveGaps: [],
                    criteriaApplied: "",
                    alternatives: [],
                  },
                },
                artifactType,
                architecture: stored.architecture,
                context: stored.context,
              });
            })()
          : await (async () => {
              // Read back what Stage 7 stored. `API-032` reuses reasoning
              // rather than recomputing it, so this is the only input the
              // regeneration gets.
              const recommendation = await readRecommendation(
                deps.prisma,
                analysisId,
              );
              if (recommendation === null) {
                throw new Error(
                  `Analysis ${analysisId} has no stored recommendation to regenerate ${artifactType} from`,
                );
              }
              return pipeline.regenerateArtifact({
                analysisId,
                classifiedAs: classification.determinedType,
                recommendation,
                // D-76: two generators; the route already refused any other
                // type.
                ...(artifactType === "interview_guidance"
                  ? { artifactType: "interview_guidance" as const }
                  : {}),
              });
            })();

      // `DB §4.4` stores the outcome either way — a second failure is a
      // labelled failure, not a silent no-op. Nothing is written when the
      // generator returned nothing parseable, because there is no document to
      // store and the plan entry already says `failed`.
      if (regenerated.content !== undefined) {
        await resultSink.persistArtifact?.(analysisId, {
          artifactType: regenerated.artifactType,
          content: regenerated.content,
          depthLevel: "standard",
          generationAttemptCount: regenerated.generationAttemptCount,
          validationStatus: regenerated.validationStatus,
        });
      }

      // The stream reports the retry's outcome exactly as the first attempt
      // did (`API §7.4`), so a client watching sees the artifact replace its
      // own failure rather than having to re-fetch to notice.
      deps.eventSink?.emit(
        analysisId,
        regenerated.validationStatus === "valid"
          ? {
              type: "artifact",
              artifactType: regenerated.artifactType,
              content: regenerated.content,
            }
          : {
              type: "artifact_failed",
              artifactType: regenerated.artifactType,
              reason: "The retry did not produce a document that validated.",
              retryAvailable: true,
            },
      );
    },

    startExecution: (analysisId) => {
      // Never awaited, and never allowed to become an unhandled rejection: the
      // executor already writes a terminal status, so this only surfaces the
      // reason to the log.
      void executor.execute(analysisId).catch((error: unknown) => {
        deps.onError?.(error);
      });
    },
  };
}
