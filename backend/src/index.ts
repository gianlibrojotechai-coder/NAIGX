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
import { loadCipher } from "./crypto/index.js";
import { createDatabase } from "./db/client.js";
import {
  assertDataFormatReadable,
  SUPPORTED_DATA_FORMAT,
} from "./db/data-format.js";
import { createTraceDatabase } from "./db/trace-client.js";
import { createFragmentResolver } from "./db/fragment-resolver.js";
import { createAnthropicProvider } from "./provider/adapters/anthropic.js";
import { createReplayProvider } from "./provider/adapters/replay.js";
import type { ProviderAdapter } from "./provider/capability.js";
import type { TokenRate } from "./provider/cost.js";
import { FOUNDATION_FRAGMENT_KEYS } from "./nie/prompt.js";
import { STAGE_OUTPUT_SCHEMAS } from "./nie/output-schemas.js";
import { loadCapabilityProfile } from "./nie/capability-profile.js";
import type { CapabilityProfile } from "./nie/capability-profile.js";
import type { FragmentResolver } from "./nie/ports.js";
import { loadCorpus } from "./regression/corpus.js";
import { createRecordingStore } from "./regression/recording-store.js";
import {
  assertReplayServable,
  loadReplayCorpus,
  type ReplayCorpus,
} from "./regression/replay-corpus.js";
import { createAnalysisRunner } from "./orchestrator/analysis-runner.js";
import { createAnalysisEventLog } from "./events/analysis-event-log.js";
import {
  isMetered,
  resolveExecutionMode,
} from "./orchestrator/execution-mode.js";
import { createTracePurgeOutbox } from "./db/trace-purge-outbox.js";
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

/**
 * The recorded corpus a replay deployment serves from
 * ([D-62](../../docs/37-D-62-Mode-Aware-Readiness.md)).
 *
 * Loaded from the canonical recording store at startup, against the fragments
 * THIS instance composes with, so that every fixture answers a prompt the
 * runtime will actually present — `regression/replay-corpus.ts` states the
 * rule and excludes what fails it. The result is held in one value that both
 * the adapter and the readiness probe read, so the probe cannot report a
 * corpus the adapter does not hold.
 *
 * ⚠️ NEVER THROWS. A replay instance whose corpus cannot be read is an
 * instance that is NOT READY, and D-62 wants that said by `GET /health`, not
 * by a crash loop that hides the reason in a restart counter. The failure is
 * carried as an empty corpus with the error as its one exclusion, logged at
 * startup, and surfaced verbatim by the readiness probe.
 *
 * Reads `research/` — the corpus, the store and the capability profile — which
 * the production compose file mounts read-only for exactly this.
 */
async function loadReplayFixtures(
  resolver: FragmentResolver,
  onError: (error: unknown) => void,
): Promise<ReplayCorpus> {
  try {
    // `FR-022` — carried, not thrown, exactly as `analysis-runner.ts` treats
    // it: a missing profile means Stage 7 keys no fixture and a posting halts
    // there with the reason the pipeline already gives.
    let capabilityProfile: CapabilityProfile | undefined;
    try {
      capabilityProfile = loadCapabilityProfile();
    } catch (error) {
      onError(error);
    }
    return await loadReplayCorpus({
      cases: loadCorpus(),
      store: createRecordingStore(),
      resolver,
      ...(capabilityProfile !== undefined ? { capabilityProfile } : {}),
    });
  } catch (error) {
    onError(error);
    return {
      fixtures: {},
      lowVarianceSampling: false,
      served: [],
      excluded: [
        {
          caseId: "*",
          reason: `the recorded corpus could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      unrecorded: 0,
    };
  }
}

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
    // D-65: every stage is decoded against its output schema, and thinking
    // depth is the configured effort. Same construction as capture, so a
    // recording is made the way production runs.
    adapter: createAnthropicProvider({
      apiKey,
      model,
      outputSchemas: STAGE_OUTPUT_SCHEMAS,
      ...(config.provider.effort !== undefined
        ? { effort: config.provider.effort }
        : {}),
    }),
    rate: { inputUsdPerMillionTokens, outputUsdPerMillionTokens },
    providerKey: "anthropic",
    modelKey: model,
  };
}

const main = async (): Promise<void> => {
  const config = loadConfig();
  const database = createDatabase(config);

  // --- can this build read what is stored? ---------------------------------
  //
  // ⚠️ FIRST, BEFORE THE KEY AND BEFORE THE APP. A build older than the data
  // must not reach the point of serving a request: the Phase 4 rehearsal showed
  // a pre-encryption build starting cleanly and handing users base64 envelopes
  // where their documents should be, silently. One cheap query decides it.
  const dataFormat = await assertDataFormatReadable(database.prisma);

  // --- the data key, before anything that could need it --------------------
  //
  // ⚠️ THIS IS DELIBERATELY THE FIRST THING AFTER THE DATABASE, AND A FAILURE
  // HERE STOPS THE PROCESS (D-52 §5, last row). An instance that starts
  // without its key would accept submissions it cannot store readably and
  // serve history whose entries cannot be opened — healthy-looking, and
  // quietly producing unusable data. `loadCipher` throws rather than degrade,
  // and `main`'s catch turns that into a non-zero exit.
  const { cipher, providerName, currentVersion } = await loadCipher(
    config,
    database.prisma,
  );
  // A separate store with an independent lifecycle (`DB §1.4`). Both pools are
  // lazy, so constructing it here costs no connection until something writes.
  const traceDatabase = createTraceDatabase(config);
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

  // The corpus is loaded against the SAME resolver the pipeline composes with
  // (`analysis-runner.ts` builds its own `createFragmentResolver` over the
  // same store), so a fixture's key is the key a runtime request will carry.
  // Loaded only in replay mode: a live instance holds no recordings and must
  // not pretend to.
  const replayCorpus: ReplayCorpus | undefined =
    mode === "live"
      ? undefined
      : await loadReplayFixtures(
          createFragmentResolver(database.prisma),
          (error) => {
            reportError(error);
          },
        );

  // `replayCorpus` is defined exactly when the mode is replay, so this is the
  // mode switch — narrowed on the value rather than re-testing the string.
  const { adapter, rate, providerKey, modelKey } =
    replayCorpus === undefined
      ? liveProvider(config)
      : {
          // A replay adapter answers only from its fixtures, which is correct:
          // replay reproduces recorded runs, it does not analyse arbitrary
          // input. A submission with no recording fails at Stage 1 and the
          // analysis lands `failed` — visibly, rather than by reaching a
          // provider nobody authorised (D-62 §5).
          adapter: createReplayProvider({
            fixtures: replayCorpus.fixtures,
            // Declared by the recordings, never assumed (`AI §10.6`).
            lowVarianceSampling: replayCorpus.lowVarianceSampling,
          }),
          rate: NOMINAL_RATE,
          providerKey: "replay",
          modelKey: "replay",
        };

  // --- `API-060` readiness: what "can reason" means, per mode --------------
  //
  // [D-62](../../docs/37-D-62-Mode-Aware-Readiness.md). `API-060` requires
  // readiness to include provider reachability because "an instance that
  // cannot reason must not receive traffic". That is the right question; the
  // old implementation answered it by looking for an Anthropic credential in
  // every mode, which tests a capability replay never uses.
  //
  // ⚠️ THIS IS NOT A RELAXATION. Each mode is asked what reasoning actually
  // requires of it, and both can fail:
  //
  //   · live   — a credential and a model, and an adapter that constructs.
  //              Unchanged.
  //   · replay — a usable recorded corpus. A replay instance with no
  //              recordings can serve nothing, so it is NOT ready, and saying
  //              otherwise would be a green light on an instance that cannot
  //              answer a single submission.
  //
  // Both are configuration probes rather than model calls: readiness is polled
  // continuously and billing a token per poll would be a defect.
  const checkProvider = (): Promise<void> => {
    if (replayCorpus === undefined) {
      const { apiKey, model } = config.provider;
      if (apiKey === undefined || model === undefined) {
        return Promise.reject(new Error("No provider is configured"));
      }
      createAnthropicProvider({ apiKey, model });
      return Promise.resolve();
    }

    // The same object the adapter was built from — see `loadReplayFixtures`.
    // An instance that loaded nothing, or excluded everything, is not ready,
    // and the rejection says which.
    try {
      assertReplayServable(replayCorpus);
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    return Promise.resolve();
  };

  // One log, two ends: the runner publishes into it, the API streams from it.
  // Both halves are wired here because neither may reach for the other —
  // `AD-02`/`AP-3` keep transport out of the NIE, and the orchestrator does
  // not know an HTTP layer exists.
  const eventLog = createAnalysisEventLog();

  const runner = await createAnalysisRunner({
    prisma: database.prisma,
    tracePrisma: traceDatabase.prisma,
    cipher,
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
    // `FR-094` deadline, configurable since D-65; the default is unchanged.
    ...(config.analysisTimeoutMs !== undefined
      ? { analysisTimeoutMs: config.analysisTimeoutMs }
      : {}),
  });

  /**
   * `DB §5.4` — the cross-store purge, wired to the real trace store.
   *
   * The app registers a no-op queue when none is supplied; this is the one
   * that actually deletes. Drained on a timer rather than per request, because
   * `DB §5.4` step 1 honours the user's request in the primary store and
   * everything after it is operator-side cleanup.
   */
  // ⚠️ THE DURABLE ONE. `createTracePurgeQueue` (in-memory) is still exported
  // and still used by unit tests, but an instance that used it would forget
  // every pending instruction on restart — the gap `M-19` Phase 3 closed. The
  // outbox table lives in the PRIMARY store so the instruction commits in the
  // same transaction as the deletion it follows.
  const tracePurge = createTracePurgeOutbox({
    store: database.prisma,
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
    cipher,
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

  // What a replay instance can actually serve, stated at startup so a 503 on
  // readiness can be read against it. `excluded` carries a reason per case;
  // a corpus that loaded nothing prints exactly why, here, once.
  if (replayCorpus !== undefined) {
    app.log.info(
      {
        served: replayCorpus.served,
        fixtures: Object.keys(replayCorpus.fixtures).length,
        excluded: replayCorpus.excluded,
        unrecorded: replayCorpus.unrecorded,
        lowVarianceSampling: replayCorpus.lowVarianceSampling,
      },
      "Replay corpus loaded",
    );
  }

  // Stated at startup for the same reason as the mode: which key service is in
  // force, and under which key version new rows are sealed, should never have
  // to be inferred. ⚠️ Never logs key material — only the provider's name.
  app.log.info(
    { provider: providerName, keyVersion: currentVersion },
    "Field encryption active",
  );

  // Stated so the deployable floor is visible in the log rather than inferred
  // from a migration nobody is reading during an incident.
  app.log.info(
    { stored: dataFormat, supported: SUPPORTED_DATA_FORMAT },
    "Data format",
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
