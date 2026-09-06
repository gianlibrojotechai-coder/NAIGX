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

import type { PrismaClient } from "../generated/prisma/client.js";
import type { PrismaClient as TracePrismaClient } from "../generated/prisma-trace/client.js";
import { createFragmentResolver } from "../db/fragment-resolver.js";
import { createFragmentUsageSink } from "../db/fragment-usage-sink.js";
import { createStageTraceSink } from "../db/stage-trace-sink.js";
import { createStageResultSink } from "../db/analysis-result-sink.js";
import { createProviderInvocationRecorder } from "../db/provider-invocation-recorder.js";
import { createProviderInvoker } from "../provider/invoke.js";
import type { ProviderAdapter } from "../provider/capability.js";
import type { TokenRate } from "../provider/cost.js";
import { createPipeline } from "../nie/pipeline.js";
import { loadCapabilityProfile } from "../nie/capability-profile.js";
import type { CapabilityProfile } from "../nie/capability-profile.js";
import { createAnalysisExecutor } from "./execute-analysis.js";
import type { ExecutionMode } from "./execution-mode.js";

export interface AnalysisRunnerDependencies {
  readonly prisma: PrismaClient;
  readonly tracePrisma: TracePrismaClient;
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
}

export interface AnalysisRunner {
  readonly mode: ExecutionMode;
  /** Fire-and-forget: `API-020` returns before reasoning completes. */
  readonly startExecution: (analysisId: string) => void;
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
    traceSink: createStageTraceSink(deps.tracePrisma),
    fragmentUsageSink: createFragmentUsageSink(deps.prisma),
    // Progressive persistence (`DB §6.2`): each stage commits as it completes,
    // so a later failure keeps what earlier stages produced (`FR-091`).
    resultSink: createStageResultSink(deps.prisma),
    modelVersionId: modelVersion.modelVersionId,
    modelKey: modelVersion.modelKey,
    ...(capabilityProfile !== undefined ? { capabilityProfile } : {}),
    ...(deps.onError !== undefined ? { onRecordError: deps.onError } : {}),
  });

  const executor = createAnalysisExecutor({
    prisma: deps.prisma,
    mode: deps.mode,
    runPipeline: (input) => pipeline.run(input),
    ...(deps.onError !== undefined ? { onError: deps.onError } : {}),
  });

  return {
    mode: deps.mode,
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
