/**
 * The minimal harness — `Roadmap` Sprint 1 Interface deliverable.
 *
 * "Text in, raw structured output. Deliberately unstyled." `EP-2`: a sprint
 * must end with something that "can be executed, observed, and judged" — "a
 * business requirement produces a schema-valid architecture you can read".
 *
 * This is a composition root, not a second pipeline. It wires the *production*
 * pieces together and reports what they did:
 *
 *   config → both databases → provider abstraction → the real `createPipeline`
 *   → the real `StageResultSink` → a structured report read back from the
 *   rows that were actually written.
 *
 * There is no reasoning here, no parsing, no validation and no persistence
 * logic. If this file were deleted the product would lose a viewing window and
 * nothing else.
 *
 * The Roadmap row for this deliverable cites **no requirement**, and no
 * authoritative document requires the harness to use an HTTP surface. So it
 * follows the smallest convention already in the repository — a script run
 * through npm, like `fragments.mts` — rather than expanding the API.
 */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { loadConfig, type AppConfig } from "../config/env.js";
import { loadCipher } from "../crypto/index.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaClient as TracePrismaClient } from "../generated/prisma-trace/client.js";
import { createFragmentResolver } from "../db/fragment-resolver.js";
import { createFragmentUsageSink } from "../db/fragment-usage-sink.js";
import { createStageTraceSink } from "../db/stage-trace-sink.js";
import { createStageResultSink } from "../db/analysis-result-sink.js";
import { createProviderInvocationRecorder } from "../db/provider-invocation-recorder.js";
import { createProviderInvoker } from "../provider/invoke.js";
import type {
  ProviderInvocationRecord,
  ProviderInvoker,
} from "../provider/invoke.js";
import type { TokenRate } from "../provider/cost.js";
import { createProvider } from "../provider/index.js";
import { createAnthropicProvider } from "../provider/adapters/anthropic.js";
import type { ProviderAdapter } from "../provider/capability.js";
import { createPipeline } from "../nie/pipeline.js";
import {
  loadCapabilityProfile,
  type CapabilityProfile,
} from "../nie/capability-profile.js";
import { StageError } from "../nie/contracts.js";
import type {
  FragmentUsageRecord,
  FragmentUsageSink,
  StageTraceRecord,
  StageTraceSink,
} from "../nie/ports.js";
import {
  createRecordedProvider,
  DEFAULT_BUSINESS_REQUIREMENT_RECORDING,
  type RecordingSet,
} from "./recordings.js";

/** `FR-002` — the harness enforces the same bounds the product does. */
export const MIN_INPUT_CHARACTERS = 50;
export const MAX_INPUT_CHARACTERS = 50_000;

/**
 * ⚠️ Placeholder rate for the offline adapters only. `docs/12` D-10 item 5
 * records that no persistent token-rate surface is defined; for the offline
 * adapters the cost figure demonstrates the accounting path rather than a bill.
 *
 * The **real** adapter refuses to run on this. Billing a real call at an
 * invented rate would put a plausible, wrong number into the unit economics
 * `TV-4` depends on, which is worse than having none.
 */
const PLACEHOLDER_RATE: TokenRate = {
  inputUsdPerMillionTokens: "3.00",
  outputUsdPerMillionTokens: "15.00",
};

/** Rates for a real call, which must be configured rather than assumed. */
function realProviderRate(config: AppConfig): TokenRate {
  const input = config.provider.inputUsdPerMillionTokens;
  const output = config.provider.outputUsdPerMillionTokens;
  if (input === undefined || output === undefined) {
    throw new Error(
      "Real-provider runs require PROVIDER_INPUT_USD_PER_MTOK and " +
        "PROVIDER_OUTPUT_USD_PER_MTOK (USD per million tokens). Cost accounting " +
        "is required per call (SA §3.5, NFR-083) and no rate may be assumed.",
    );
  }
  return {
    inputUsdPerMillionTokens: input,
    outputUsdPerMillionTokens: output,
  };
}

const HARNESS_PROVIDER_KEY = "harness";
const HARNESS_MODEL_KEY = "recorded";

export interface HarnessOptions {
  readonly inputText: string;
  /**
   * `recorded` replays a recording through the replay adapter; `stub` and
   * `replay` come from the registry; `anthropic` makes a real model request.
   */
  readonly provider?: "recorded" | "stub" | "replay" | "anthropic";
  readonly recordings?: RecordingSet;
  readonly config?: AppConfig;
}

export interface HarnessReport {
  readonly analysisId: string;
  readonly input: { readonly characterCount: number };
  readonly outcome: "completed" | "halted" | "failed";
  readonly provider: {
    readonly adapter: string;
    readonly note: string;
    readonly invocations: readonly ProviderInvocationRecord[];
  };
  /**
   * Whether the operator inventory Stage 7 matches against was available
   * (`FR-022`). Reported rather than assumed: a job description that halts for
   * want of a profile and one that halts for any other reason look identical
   * from the outside otherwise.
   */
  readonly capabilityProfile: {
    readonly loaded: boolean;
    readonly capabilities: number;
    readonly error?: string;
  };
  readonly result?: unknown;
  readonly failure?: {
    readonly stageNumber: number | null;
    readonly stageKey: string | null;
    readonly message: string;
  };
  /** Read back from the rows actually written — not from memory. */
  readonly persisted?: unknown;
  readonly trace: {
    readonly store: "separate database";
    readonly stages: readonly {
      readonly stageTraceId: string;
      readonly stageNumber: number;
      readonly stageKey: string;
      readonly outcome: string;
      readonly durationMs: number;
      readonly retryCount: number;
      readonly failureReason: string | null;
    }[];
  };
  readonly fragments: readonly FragmentUsageRecord[];
}

/** Collects what a sink receives without preventing it from persisting. */
const tee = <T>(
  sink: { record: (value: T) => Promise<void> },
  collected: T[],
): { record: (value: T) => Promise<void> } => ({
  record: async (value: T) => {
    collected.push(value);
    await sink.record(value);
  },
});

export function validateInput(text: string): void {
  const length = text.length;
  if (length < MIN_INPUT_CHARACTERS) {
    throw new RangeError(
      `Input is ${String(length)} characters; the minimum is ${String(MIN_INPUT_CHARACTERS)} (FR-002)`,
    );
  }
  if (length > MAX_INPUT_CHARACTERS) {
    throw new RangeError(
      `Input is ${String(length)} characters; the maximum is ${String(MAX_INPUT_CHARACTERS)} (FR-002)`,
    );
  }
}

/**
 * Runs the current vertical slice and reports it.
 *
 * Opens both databases, runs the production pipeline, persists through the
 * production sink, then reads the persisted provenance chain back so the report
 * shows what is stored rather than what was returned.
 */
export async function runHarness(
  options: HarnessOptions,
): Promise<HarnessReport> {
  validateInput(options.inputText);

  const config = options.config ?? loadConfig();
  const primaryPool = new pg.Pool({ connectionString: config.databaseUrl });
  const tracePool = new pg.Pool({ connectionString: config.traceDatabaseUrl });
  const primary = new PrismaClient({ adapter: new PrismaPg(primaryPool) });
  const trace = new TracePrismaClient({ adapter: new PrismaPg(tracePool) });

  // `DB §13.1` row 3. Offline runs get the test double; a harness pointed at a
  // real deployment gets whatever that deployment is configured with. After
  // the clients exist — the key ring is read from the primary store.
  const { cipher } = await loadCipher(config, primary);

  const traces: StageTraceRecord[] = [];
  const fragments: FragmentUsageRecord[] = [];
  const invocations: ProviderInvocationRecord[] = [];

  try {
    const resolver = createFragmentResolver(primary);

    const providerId = options.provider ?? "recorded";
    let adapter: ProviderAdapter;
    let note: string;
    let rate: TokenRate = PLACEHOLDER_RATE;

    if (providerId === "recorded") {
      adapter = await createRecordedProvider(
        options.recordings ?? DEFAULT_BUSINESS_REQUIREMENT_RECORDING,
        resolver,
        options.inputText,
      );
      note =
        "Replaying a recorded run. The pipeline, provenance and persistence are real; the reasoning is not. Reasoning quality cannot be judged until a real model runs.";
    } else if (providerId === "anthropic") {
      // The composition root holds the credential and hands it over; the
      // adapter never reads the environment (`AI §10.5`).
      const model = config.provider.model;
      if (config.provider.apiKey === undefined || model === undefined) {
        throw new Error(
          "Real-provider runs require ANTHROPIC_API_KEY and PROVIDER_MODEL to be set.",
        );
      }
      adapter = createAnthropicProvider({
        apiKey: config.provider.apiKey,
        model,
      });
      rate = realProviderRate(config);
      note =
        "A real model produced this analysis. Reasoning, provenance, persistence and cost are all real.";
    } else {
      adapter = createProvider(providerId);
      note = `Using the '${providerId}' adapter from the registry.`;
    }

    // Reference rows an analysis needs (`DB §4.5`). Upserted so repeated runs
    // reuse them rather than accumulating provider rows.
    const provider = await primary.provider.upsert({
      where: { providerKey: HARNESS_PROVIDER_KEY },
      update: {},
      create: {
        providerKey: HARNESS_PROVIDER_KEY,
        // Spread into a plain object: `ProviderCapabilities` is a closed
        // interface, and Prisma's JSON input requires an index signature.
        declaredCapabilities: { ...adapter.capabilities },
        active: true,
      },
    });
    const modelVersion = await primary.modelVersion.upsert({
      where: {
        providerId_modelKey_versionLabel: {
          providerId: provider.providerId,
          modelKey: HARNESS_MODEL_KEY,
          versionLabel: "1",
        },
      },
      update: {},
      create: {
        providerId: provider.providerId,
        modelKey: HARNESS_MODEL_KEY,
        versionLabel: "1",
        active: true,
      },
    });

    const analysis = await primary.analysis.create({
      data: {
        status: "running",
        anonymousTokenHash: `harness-${randomUUID()}`,
        modelVersionId: modelVersion.modelVersionId,
      },
    });

    const invoker: ProviderInvoker = createProviderInvoker({
      adapter,
      rate,
      // `DB §4.7`/`§8.2`, `FR-093`, `NFR-083`: every provider call is recorded
      // in the trace store with its latency, tokens, cost, outcome and attempt
      // number. Collecting them in memory for the report is not persistence —
      // it is what `docs/12` D-20 recorded as outstanding, and it meant a real
      // run's token counts and cost never reached the trace store.
      //
      // The row is written while the stage is still running, so it lands
      // *before* its `stage_trace` parent. That is safe precisely because
      // `stage_trace_id` is an identifier reference with no foreign key
      // (`docs/12` D-9) — the same property that lets the 30-day tier outlive
      // the 7-day one.
      recorder: tee(createProviderInvocationRecorder(trace), invocations),
    });

    // The harness seals stage traces exactly as the server does. Using a
    // pass-through here instead would leave `structured_input` and
    // `structured_output` in PLAINTEXT for every harness run — in the same
    // table the server seals — and the mixture would look like an unfinished
    // backfill rather than a second writer that forgot.
    const traceSink: StageTraceSink = tee(
      createStageTraceSink(trace, cipher),
      traces,
    );
    const fragmentUsageSink: FragmentUsageSink = {
      record: async (usages) => {
        fragments.push(...usages);
        await createFragmentUsageSink(primary).record(usages);
      },
    };

    // `FR-022` — the job-description path needs the operator inventory to have
    // anything to compare a posting against. Read from the repository asset,
    // never assembled here: `docs/12` D-27 makes the profile human-authored
    // precisely so the system cannot write the evidence behind its own verdict.
    //
    // A missing or malformed profile is not fatal to an analysis that does not
    // need one, so the failure is carried rather than thrown: business
    // requirements, workflows and assessments still run, and a job description
    // halts at Stage 7 with the reason the pipeline already states.
    let capabilityProfile: CapabilityProfile | undefined;
    let capabilityProfileError: string | undefined;
    try {
      capabilityProfile = loadCapabilityProfile();
    } catch (error) {
      capabilityProfileError =
        error instanceof Error ? error.message : String(error);
    }

    const pipeline = createPipeline({
      invoker,
      resolver,
      traceSink,
      fragmentUsageSink,
      modelVersionId: modelVersion.modelVersionId,
      modelKey: modelVersion.modelKey,
      // Progressive persistence (`DB §6.2`): each stage commits as it
      // completes, so a later failure keeps what earlier stages produced.
      resultSink: createStageResultSink(primary),
      ...(capabilityProfile !== undefined ? { capabilityProfile } : {}),
    });

    // Built as a function, not a value: the trace and fragment arrays are
    // filled by the pipeline as it runs, so snapshotting them before the run
    // would report an empty trace for every analysis.
    const base = () => ({
      analysisId: analysis.analysisId,
      input: { characterCount: options.inputText.length },
      provider: {
        adapter: providerId,
        note,
        invocations,
      },
      capabilityProfile: {
        loaded: capabilityProfile !== undefined,
        capabilities: capabilityProfile?.capabilities.length ?? 0,
        ...(capabilityProfileError !== undefined
          ? { error: capabilityProfileError }
          : {}),
      },
      trace: {
        store: "separate database" as const,
        stages: traces.map((t) => ({
          stageTraceId: t.stageTraceId,
          stageNumber: t.stageNumber,
          stageKey: t.stageKey,
          outcome: t.outcome,
          durationMs: t.durationMs,
          retryCount: t.retryCount,
          failureReason: t.failureReason,
        })),
      },
      fragments,
    });

    try {
      const result = await pipeline.run({
        analysisId: analysis.analysisId,
        text: options.inputText,
      });

      await primary.analysis.update({
        where: { analysisId: analysis.analysisId },
        data: { status: "completed", completedAt: new Date() },
      });

      return {
        ...base(),
        outcome: result.haltedAt === undefined ? "completed" : "halted",
        result,
        persisted: await readPersistedProvenance(primary, analysis.analysisId),
      };
    } catch (error) {
      await primary.analysis.update({
        where: { analysisId: analysis.analysisId },
        data: { status: "failed", completedAt: new Date() },
      });

      return {
        ...base(),
        outcome: "failed",
        failure: {
          stageNumber: error instanceof StageError ? error.stageNumber : null,
          stageKey: error instanceof StageError ? error.stageKey : null,
          message: error instanceof Error ? error.message : String(error),
        },
        // `FR-091`: a partial failure yields partial results. Whatever earlier
        // stages committed is still here, and worth showing.
        persisted: await readPersistedProvenance(primary, analysis.analysisId),
      };
    }
  } finally {
    await primary.$disconnect();
    await trace.$disconnect();
    await primaryPool.end();
    await tracePool.end();
  }
}

/**
 * Reads the stored grounding chain back.
 *
 * This is the part worth looking at: it shows `FR-030` traceability as it
 * exists at rest — each component and the context elements it is grounded in,
 * resolved through `CONTEXT_REFERENCE` rows.
 */
async function readPersistedProvenance(
  primary: PrismaClient,
  analysisId: string,
): Promise<unknown> {
  const elements = await primary.contextElement.findMany({
    where: { analysisId },
  });
  const byId = new Map(elements.map((e) => [e.contextElementId, e]));

  const model = await primary.architectureModel.findUnique({
    where: { analysisId },
    include: { components: { orderBy: { ordinal: "asc" } } },
  });

  const components = [];
  for (const component of model?.components ?? []) {
    const references = await primary.contextReference.findMany({
      where: {
        referencingType: "architecture_component",
        referencingId: component.componentId,
      },
    });
    components.push({
      componentId: component.componentId,
      name: component.name,
      groundedIn: references.map((reference) => {
        const element = byId.get(reference.contextElementId);
        return {
          contextElementId: reference.contextElementId,
          provenance: element?.provenance ?? null,
          content: element?.content ?? null,
        };
      }),
    });
  }

  return {
    contextElements: elements.map((e) => ({
      contextElementId: e.contextElementId,
      category: e.category,
      provenance: e.provenance,
      content: e.content,
      sourceSpan:
        e.sourceSpanStart !== null && e.sourceSpanEnd !== null
          ? [e.sourceSpanStart, e.sourceSpanEnd]
          : null,
      inferenceBasis: e.inferenceBasis,
      resolutionHint: e.resolutionHint,
    })),
    architectureId: model?.architectureId ?? null,
    components,
  };
}
