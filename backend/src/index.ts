/**
 * Composition root.
 *
 * The only module that wires concrete dependencies together and owns the
 * process lifecycle: load configuration, construct the database, build the
 * application, listen, and shut down in the correct order.
 */

import "dotenv/config";

import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { createTraceDatabase } from "./db/trace-client.js";
import { createFragmentResolver } from "./db/fragment-resolver.js";
import { createAnthropicProvider } from "./provider/adapters/anthropic.js";
import { createProvider } from "./provider/index.js";
import type { ProviderAdapter } from "./provider/capability.js";
import type { TokenRate } from "./provider/cost.js";
import { FOUNDATION_FRAGMENT_KEYS } from "./nie/prompt.js";
import { createAnalysisRunner } from "./orchestrator/analysis-runner.js";
import {
  isMetered,
  resolveExecutionMode,
} from "./orchestrator/execution-mode.js";
import type { AppConfig } from "./config/env.js";

const HOST = "0.0.0.0";

/**
 * A replay run bills nothing, so its rate is nominal rather than configured.
 * Requiring real rates to run offline would make the free mode need the
 * settings only the metered one uses.
 */
const NOMINAL_RATE: TokenRate = {
  inputUsdPerMillionTokens: "0.00",
  outputUsdPerMillionTokens: "0.00",
};

interface SelectedProvider {
  readonly adapter: ProviderAdapter;
  readonly rate: TokenRate;
  readonly providerKey: string;
  readonly modelKey: string;
}

/**
 * The metered path. Reached only when the mode resolved to `live`, which
 * `resolveExecutionMode` grants solely on an explicit request.
 *
 * Rates are demanded rather than assumed: `SA §3.5` and `NFR-083` make cost
 * accounting per call mandatory, and an analysis whose cost cannot be computed
 * is one nobody can audit the spend of.
 */
function liveProvider(config: AppConfig): SelectedProvider {
  const { apiKey, model, inputUsdPerMillionTokens, outputUsdPerMillionTokens } =
    config.provider;

  if (apiKey === undefined || model === undefined) {
    throw new Error(
      "Live execution requires ANTHROPIC_API_KEY and PROVIDER_MODEL.",
    );
  }
  if (
    inputUsdPerMillionTokens === undefined ||
    outputUsdPerMillionTokens === undefined
  ) {
    throw new Error(
      "Live execution requires PROVIDER_INPUT_USD_PER_MTOK and " +
        "PROVIDER_OUTPUT_USD_PER_MTOK (USD per million tokens). Cost accounting " +
        "is required per call (SA §3.5, NFR-083) and no rate may be assumed.",
    );
  }

  return {
    adapter: createAnthropicProvider({ apiKey, model }),
    rate: { inputUsdPerMillionTokens, outputUsdPerMillionTokens },
    providerKey: "anthropic",
    modelKey: model,
  };
}

const main = async (): Promise<void> => {
  const config = loadConfig();
  const database = createDatabase(config);
  // A separate store with an independent lifecycle (`DB §1.4`). Both pools are
  // lazy, so constructing it here costs no connection until something writes.
  const traceDatabase = createTraceDatabase(config);
  // `API-060` readiness probes. Built here, in the only module that already
  // knows which provider is configured, so the API layer names none (`AI-006`).
  //
  // Provider reachability is a *configuration* probe, not a model call: a
  // readiness endpoint is polled continuously, and billing a token for every
  // poll would be a defect. It verifies the instance is capable of reasoning —
  // a credential and a model are present and an adapter constructs.
  const checkProvider = (): Promise<void> => {
    const { apiKey, model } = config.provider;
    if (apiKey === undefined || model === undefined) {
      return Promise.reject(new Error("No provider is configured"));
    }
    createAnthropicProvider({ apiKey, model });
    return Promise.resolve();
  };

  // Template loadability: the shared foundation fragments resolve to published,
  // active versions. Without them no stage can compose a prompt.
  const checkTemplates = async (): Promise<void> => {
    await createFragmentResolver(database.prisma).resolve([
      ...FOUNDATION_FRAGMENT_KEYS,
    ]);
  };

  // Replaced by the Fastify logger below. Until then a failure still has
  // somewhere to go — silence during startup is how a misconfiguration hides.
  let reportError: (error: unknown) => void = (error) => {
    console.error("Analysis execution error", error);
  };

  // --- execution mode, decided once, here ---------------------------------
  //
  // The only place a live provider can be selected. `resolveExecutionMode`
  // refuses to infer it: an unset variable is replay, and `live` without
  // credentials is a refusal rather than a silent downgrade.
  const mode = resolveExecutionMode({
    requested: process.env["NAIGX_EXECUTION_MODE"],
    hasProviderCredentials:
      config.provider.apiKey !== undefined &&
      config.provider.model !== undefined,
  });

  const { adapter, rate, providerKey, modelKey } =
    mode === "live"
      ? liveProvider(config)
      : {
          // A replay adapter with no fixtures answers nothing, which is
          // correct: replay reproduces recorded runs, it does not analyse
          // arbitrary input. A submission with no recording fails at Stage 1
          // and the analysis lands `failed` — visibly, rather than by
          // reaching a provider nobody authorised.
          adapter: createProvider("replay"),
          rate: NOMINAL_RATE,
          providerKey: "replay",
          modelKey: "replay",
        };

  const runner = await createAnalysisRunner({
    prisma: database.prisma,
    tracePrisma: traceDatabase.prisma,
    adapter,
    mode,
    rate,
    providerKey,
    modelKey,
    // The runner is built before the app, because the app needs its
    // `startExecution`. Errors are routed through an indirection that the
    // logger replaces once it exists, so nothing is lost in between.
    onError: (error) => {
      reportError(error);
    },
  });

  const app = await buildApp({
    config,
    database,
    checkProvider,
    checkTemplates,
    startExecution: runner.startExecution,
  });

  reportError = (error) => {
    app.log.error({ err: error }, "Analysis execution error");
  };

  // Stated at startup, every boot. Which mode is in force is the difference
  // between a free instance and a metered one, and it should never have to be
  // inferred from which variables happen to be set.
  app.log.info(
    { mode: runner.mode, metered: isMetered(runner.mode) },
    "Analysis execution mode",
  );

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    app.log.info({ signal }, "Shutting down");

    try {
      // Stop accepting requests before releasing the resources they depend on.
      await app.close();
      await database.disconnect();
      await traceDatabase.disconnect();
      process.exit(0);
    } catch (error) {
      app.log.error(error, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await app.listen({
    port: config.port,
    host: HOST,
  });

  app.log.info(`🚀 Backend running on http://localhost:${config.port}`);
};

main().catch((error: unknown) => {
  // Configuration and startup failures occur before a logger exists.
  console.error("Failed to start backend:", error);
  process.exit(1);
});
