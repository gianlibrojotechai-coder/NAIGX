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
  });

  await app.register(cors, {
    origin: config.corsOrigin,
  });

  await app.register(healthRoutes, {
    prisma: database.prisma,
  });

  return app;
}
