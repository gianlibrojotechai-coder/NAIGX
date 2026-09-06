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

import type { AppConfig } from "./config/env.js";
import type { Database } from "./db/client.js";
import { registerErrorHandler } from "./http/error-handler.js";
import {
  generateRequestId,
  registerRequestContext,
} from "./http/request-context.js";
import { healthRoutes, type HealthCheck } from "./routes/health.js";
import { analysisRoutes } from "./routes/analyses.js";

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
  readonly startExecution?: (analysisId: string) => void;
}

export async function buildApp({
  config,
  database,
  checkProvider,
  checkTemplates,
  hashContent = defaultHashContent,
  startExecution,
}: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    genReqId: generateRequestId,
  });

  // Applied to the root instance, before routes, so every route context
  // inherits it and every response carries the correlation headers.
  registerRequestContext(app);

  // Registered after the request context so error responses can read the
  // correlation identifiers it establishes.
  registerErrorHandler(app);

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
    hashContent,
    ...(startExecution !== undefined ? { startExecution } : {}),
  });

  return app;
}
