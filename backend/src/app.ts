/**
 * Application assembly.
 *
 * Builds a fully configured Fastify instance without binding a port, so the
 * application can be constructed and exercised without starting a server.
 * Listening, signal handling, and process lifecycle belong to the composition
 * root in `index.ts`.
 */

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
import { healthRoutes } from "./routes/health.js";

export interface AppDependencies {
  readonly config: AppConfig;
  readonly database: Database;
}

export async function buildApp({
  config,
  database,
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
  });

  return app;
}
