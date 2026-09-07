/**
 * Application assembly.
 *
 * Builds a fully configured Fastify instance without binding a port, so the
 * application can be constructed and exercised without starting a server.
 * Listening, signal handling, and process lifecycle belong to the composition
 * root in `index.ts`.
 */

import { createHash } from "node:crypto";

import cors from "@fastify/cors";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import {
  createPassThroughCipher,
  type FieldCipher,
} from "./crypto/data-key.js";
import type { AppConfig } from "./config/env.js";
import type { Database } from "./db/client.js";
import { registerErrorHandler } from "./http/error-handler.js";
import {
  generateRequestId,
  registerRequestContext,
} from "./http/request-context.js";
import { healthRoutes, type HealthCheck } from "./routes/health.js";
import { analysisRoutes } from "./routes/analyses.js";
import type { ClassificationType } from "./nie/contracts.js";
import { exportRoutes } from "./routes/exports.js";
import type { AnalysisEventLog } from "./events/analysis-event-log.js";
import { authRoutes } from "./routes/auth.js";
import { registerAuthentication } from "./http/authenticate.js";
import { createRateLimiter, type RateLimiter } from "./auth/rate-limit.js";
import { createSessionService } from "./auth/sessions.js";
import { createAuditSink } from "./db/audit-sink.js";
import { historyRoutes } from "./routes/history.js";
import { instrumentationRoutes } from "./routes/instrumentation.js";
import {
  createTracePurgeQueue,
  type TracePurgeQueue,
} from "./db/trace-purge.js";

/**
 * `DB §4.2` `ANALYSIS_INPUT.content_hash`.
 *
 * Overridable so the API layer can be exercised without crypto, and so the
 * composition root keeps one definition — duplicate detection and
 * regression-corpus matching both key on this value.
 */
const defaultHashContent = (content: string): string =>
  createHash("sha256").update(content, "utf8").digest("hex");

export interface AppDependencies {
  readonly config: AppConfig;
  readonly database: Database;
  /**
   * Readiness probes for the dependencies the API layer does not own
   * (`API-060`). Supplied by the composition root so this layer names no
   * provider and reaches no fragment store itself.
   */
  readonly checkProvider?: HealthCheck;
  readonly checkTemplates?: HealthCheck;
  /**
   * Content hashing for `ANALYSIS_INPUT.content_hash` (`DB §4.2`).
   *
   * Injected rather than imported so the API layer stays free of crypto and
   * the composition root keeps one definition of how content is hashed —
   * duplicate detection and regression-corpus matching both key on it.
   */
  readonly hashContent?: (content: string) => string;
  /** Starts reasoning for a created analysis. Absent means submissions queue and stay queued. */
  readonly startExecution?: (
    analysisId: string,
    classificationOverride?: ClassificationType,
  ) => void;
  /** The event log `API-025` streams from. Absent means no streaming endpoint. */
  readonly eventLog?: AnalysisEventLog;
  /** `API-032` — regenerate one failed artifact from stored reasoning. */
  readonly retryArtifact?: (
    analysisId: string,
    artifactType: string,
  ) => Promise<void>;
  /**
   * Salts the stored IP hash (`DB §4.1` — raw IP is never persisted).
   *
   * Defaulted so a test need not supply one. A deployment must supply a real
   * value, and since `M-19` Phase 2 that is `NAIGX_IP_HASH_SECRET`, which
   * `config/env.ts` makes **mandatory under `NODE_ENV=production`** — the
   * default below is a public constant and an IP hash salted with one is
   * reversible by enumerating IPv4.
   */
  readonly ipSecret?: string;
  /** Injected so a test can drive the rate limiter and token expiry. */
  readonly now?: () => Date;
  /** Shared so a test can inspect or reset it. */
  readonly rateLimiter?: RateLimiter;
  /**
   * Seals and opens the three encrypted fields
   * ([D-53](../../docs/28-D-53-Encryption-Layers.md) §2).
   *
   * ⚠️ THE DEFAULT SEALS NOTHING, AND THAT IS FOR TESTS ONLY. The composition
   * root always supplies a real cipher and refuses to start without a key
   * (D-52 §5); this default exists so a unit test of an unrelated route need
   * not stand up a key provider. Nothing selects it because a key was
   * unavailable.
   */
  readonly cipher?: FieldCipher;
  /**
   * The trace store, for `M-10` schema validity in `API-070`.
   *
   * Optional: an instance without one reports zero validation events rather
   * than refusing to serve metrics at all.
   */
  readonly tracePrisma?: import("./generated/prisma-trace/client.js").PrismaClient;
  /**
   * The cross-store purge queue (`DB §5.4`).
   *
   * Injected so a test can drain it deterministically instead of waiting on a
   * timer, and so the trace store is supplied by the composition root — this
   * module never opens a connection.
   */
  readonly tracePurge?: TracePurgeQueue;
}

export async function buildApp({
  config,
  database,
  checkProvider,
  checkTemplates,
  hashContent = defaultHashContent,
  startExecution,
  eventLog,
  retryArtifact,
  ipSecret = "naigx-dev-ip-secret",
  now = () => new Date(),
  rateLimiter = createRateLimiter(),
  cipher = createPassThroughCipher(),
  tracePurge,
  tracePrisma,
}: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    genReqId: generateRequestId,
    // What `request.ip` resolves to — the client, or the proxy in front of it.
    // Configured rather than assumed; `AppConfig.trustProxy` explains why both
    // possible defaults are unsafe. The per-IP authentication limit and the
    // session IP hash are the two things that read it.
    trustProxy: config.trustProxy,
  });

  // Applied to the root instance, before routes, so every route context
  // inherits it and every response carries the correlation headers.
  registerRequestContext(app);

  // Registered after the request context so error responses can read the
  // correlation identifiers it establishes.
  registerErrorHandler(app);

  // Authentication resolves a principal for every request and rejects none —
  // `API §3.3` requires analysis creation and retrieval to work with no
  // account, so authorization is each route's decision.
  registerAuthentication(app, {
    lookup: database.prisma,
    now,
  });

  await app.register(cors, {
    origin: config.corsOrigin,
    // Custom response headers are unreadable by a browser client unless
    // explicitly exposed. Without this the correlation headers exist on the
    // wire but cannot be surfaced by the very clients meant to quote them
    // when reporting an incident (`API §9.5`).
    exposedHeaders: ["X-Request-Id", "X-Correlation-Id"],
  });

  await app.register(healthRoutes, {
    prisma: database.prisma,
    ...(checkProvider !== undefined ? { checkProvider } : {}),
    ...(checkTemplates !== undefined ? { checkTemplates } : {}),
  });

  await app.register(analysisRoutes, {
    prisma: database.prisma,
    cipher,
    hashContent,
    ...(startExecution !== undefined ? { startExecution } : {}),
    ...(eventLog !== undefined ? { eventLog } : {}),
    ...(retryArtifact !== undefined ? { retryArtifact } : {}),
  });

  const audit = createAuditSink({
    prisma: database.prisma,
    onError: (error) => {
      // A failed audit write must not fail the action it audits, but it must
      // not vanish either.
      app.log.error({ err: error }, "audit write failed");
    },
  });

  await app.register(authRoutes, {
    prisma: database.prisma,
    sessions: createSessionService({
      store: database.prisma,
      audit,
      ipSecret,
      now,
    }),
    rateLimiter,
    audit,
    now,
  });

  await app.register(historyRoutes, {
    prisma: database.prisma,
    audit,
    cipher,
    // Without a trace store wired, the queue accepts instructions and drops
    // them on drain — an instance with no trace connection still honours the
    // primary-store half of `FR-073`, which is the half the user's request
    // depends on. `DB §5.4` step 1.
    tracePurge:
      tracePurge ??
      createTracePurgeQueue({
        client: {
          stageTrace: { deleteMany: () => Promise.resolve({ count: 0 }) },
        },
        audit,
      }),
  });

  await app.register(instrumentationRoutes, {
    prisma: database.prisma,
    audit,
    cipher,
    ...(tracePrisma !== undefined ? { tracePrisma } : {}),
    // D-48. Absent disables `/internal/*` entirely rather than opening it.
    ...(config.operatorToken !== undefined
      ? { operatorToken: config.operatorToken }
      : {}),
    now,
  });

  // `API-040`. Registered after the analysis routes it reads through.
  await app.register(exportRoutes, { prisma: database.prisma });

  return app;
}
