/**
 * Health endpoint.
 *
 * NOTE: this reproduces the pre-existing behaviour exactly. It does not yet
 * implement the `API-060` contract in `docs/07-API-Design.md` §6.7 (the
 * `?check=liveness|readiness` parameter, liveness independence from external
 * services, and removal of internal detail from an unauthenticated response).
 * That change alters the response contract and is deliberately deferred.
 */

import type { FastifyPluginAsync } from "fastify";

import type { PrismaClient } from "../generated/prisma/client.js";

const APP_NAME = "NAIGX";
const APP_VERSION = "0.1.0";

export interface HealthRouteOptions {
  readonly prisma: PrismaClient;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  app,
  options,
) => {
  const { prisma } = options;

  app.get("/health", async (_request, reply) => {
    try {
      await prisma.healthCheck.findFirst();

      return {
        status: "ok",
        app: APP_NAME,
        version: APP_VERSION,
        database: "connected",
      };
    } catch (error) {
      app.log.error(error);

      return reply.status(503).send({
        status: "error",
        app: APP_NAME,
        version: APP_VERSION,
        database: "disconnected",
      });
    }
  });
};
