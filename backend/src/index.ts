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
import { createAnalysisEventLog } from "./events/analysis-event-log.js";
import {
  isMetered,
  resolveExecutionMode,
} from "./orchestrator/execution-mode.js";
import { createTracePurgeQueue } from "./db/trace-purge.js";
import { createAuditSink } from "./db/audit-sink.js";
import { sweepExpiredAnonymousAnalyses } from "./db/anonymous-expiry.js";
import type { AppConfig } from "./config/env.js";

/**
 * How often the cross-store purge drains (`DB §5.4` step 3).
 *
 * Frequent, because the work is small and the promise is a deletion the user
 * has already been told is happening. The stated window is 24 hours; this runs
 * every minute so the window is a bound rather than a target.
 */
const TRACE_PURGE_INTERVAL_MS = 60_000;

/**
 * How often expired unclaimed analyses are swept (`DBQ-6`).
 *
 * Hourly. The expiry period is 7 days, so the sweep's own frequency changes
 * nothing about what expires — only how promptly. Hourly keeps the deletion
 * close to the promise without a query that earns nothing running constantly.
 */
const ANONYMOUS_SWEEP_INTERVAL_MS = 60 * 60_000;

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

  // One log, two ends: the runner publishes into it, the API streams from it.
  // Both halves are wired here because neither may reach for the other —
  // `AD-02`/`AP-3` keep transport out of the NIE, and the orchestrator does
  // not know an HTTP layer exists.
  const eventLog = createAnalysisEventLog();

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
    eventSink: {
      emit: (analysisId, event) => {
        eventLog.publish(analysisId, event);
      },
    },
  });

  /**
   * `DB §5.4` — the cross-store purge, wired to the real trace store.
   *
   * The app registers a no-op queue when none is supplied; this is the one
   * that actually deletes. Drained on a timer rather than per request, because
   * `DB §5.4` step 1 honours the user's request in the primary store and
   * everything after it is operator-side cleanup.
   */
  const tracePurge = createTracePurgeQueue({
    client: traceDatabase.prisma,
    audit: createAuditSink({ prisma: database.prisma }),
    onError: (error) => {
      // A failed purge retries; a persistent one is audited as failed. Either
      // way it must be visible in the log, because the user was told it would
      // happen.
      app.log.error({ err: error }, "trace purge attempt failed");
    },
  });

  const app = await buildApp({
    config,
    database,
    checkProvider,
    checkTemplates,
    // `DB §4.1`. Omitted rather than passed as `undefined` so `buildApp`'s own
    // development default applies outside production; `loadConfig` refuses to
    // start a production process that has not set it.
    ...(config.ipHashSecret !== undefined
      ? { ipSecret: config.ipHashSecret }
      : {}),
    tracePurge,
    // `M-10` schema validity in `API-070`, read from the trace store.
    tracePrisma: traceDatabase.prisma,
    startExecution: (analysisId) => {
      // Opened before execution starts so a client that connects immediately
      // finds a log rather than a 410. `API-020` returns before reasoning
      // begins, so this race is the normal case, not the edge one.
      eventLog.open(analysisId);
      runner.startExecution(analysisId);
    },
    eventLog,
    // Awaited by the route, unlike `startExecution`: a retry is one Stage 9
    // call and the caller reports its outcome (`API-032`).
    retryArtifact: (analysisId, artifactType) =>
      runner.retryArtifact(analysisId, artifactType),
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

  // --- scheduled maintenance ------------------------------------------------
  //
  // Two sweeps, both unreferenced so neither by itself holds the process open
  // at shutdown, and both cleared before the server closes.

  /** `DB §5.4` step 3 — "purged asynchronously with retry until confirmed". */
  const purgeTimer = setInterval(() => {
    void tracePurge.drain().then(({ purged, failed }) => {
      if (purged > 0 || failed > 0) {
        app.log.info({ purged, failed }, "Trace purge drained");
      }
    });
  }, TRACE_PURGE_INTERVAL_MS);
  purgeTimer.unref();

  /**
   * `DBQ-6` / `DB §5.5` — unclaimed anonymous analyses expire on a fixed
   * schedule ([D-45](../../docs/20-D-45-Anonymous-Expiry-And-Token-Lifetime.md)).
   *
   * ⚠️ THE 22 PRE-MIGRATION ROWS ARE EXEMPT, and the exemption lives in the
   * sweep's WHERE clause rather than here — see `src/db/anonymous-expiry.ts`.
   * Nothing in this scheduler can widen it.
   */
  const expiryTimer = setInterval(() => {
    void sweepExpiredAnonymousAnalyses(database.prisma, new Date())
      .then(({ deleted, cutoff }) => {
        if (deleted > 0) {
          app.log.info(
            { deleted, cutoff: cutoff.toISOString() },
            "Expired unclaimed anonymous analyses",
          );
        }
      })
      .catch((error: unknown) => {
        app.log.error({ err: error }, "anonymous expiry sweep failed");
      });
  }, ANONYMOUS_SWEEP_INTERVAL_MS);
  expiryTimer.unref();

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    app.log.info({ signal }, "Shutting down");

    try {
      clearInterval(purgeTimer);
      clearInterval(expiryTimer);

      // Stop accepting requests before releasing the resources they depend on.
      await app.close();

      // One last drain, so a deletion accepted seconds before shutdown is not
      // silently dropped. Bounded by the queue itself; a failure here is
      // logged and does not block the shutdown.
      await tracePurge.drain().catch((error: unknown) => {
        app.log.error({ err: error }, "final trace purge failed");
      });
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
    host: config.host,
  });

  // The bind address and the proxy setting are both stated, because both
  // change what the process is exposed to and neither is visible from a
  // request. `trustProxy` in particular decides whether `request.ip` is the
  // client or the proxy, and a deployment that has it wrong looks healthy.
  app.log.info(
    { host: config.host, port: config.port, trustProxy: config.trustProxy },
    "Listening",
  );
};

main().catch((error: unknown) => {
  // Configuration and startup failures occur before a logger exists.
  console.error("Failed to start backend:", error);
  process.exit(1);
});
