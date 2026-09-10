/**
 * Health endpoint — `API-060` (`API §6.7`).
 *
 * | Input | `?check=liveness\|readiness` |
 * | Success | `200 OK` healthy · `503` not ready |
 * | Acceptance | "Readiness includes database reachability, **provider
 *   reachability**, and template loadability — an instance that cannot reason
 *   must not receive traffic. Liveness never depends on external services.
 *   **No internal detail, version, or provider name exposed** on an
 *   unauthenticated endpoint." |
 *
 * Two consequences of that last clause, both deliberate:
 *
 *   · The `app` and `version` fields this endpoint used to return are gone.
 *     A version string is internal detail on an unauthenticated endpoint.
 *   · Dependencies are named by *role* — `provider`, not which provider
 *     (`AI-006`). A failing check reports `unavailable` and nothing more; the
 *     underlying error goes to the log, where operators can see it.
 *
 * The checks are injected. This module performs no I/O of its own, so the
 * contract is testable without a database, a credential, or a network.
 */

import type { FastifyPluginAsync } from "fastify";

import type { PrismaClient } from "../generated/prisma/client.js";

/** A dependency probe. Resolves when healthy; rejects when not. */
export type HealthCheck = () => Promise<void>;

export interface HealthRouteOptions {
  readonly prisma: PrismaClient;
  /**
   * Provider reachability. Absent means no provider is configured, which is a
   * readiness failure: an instance that cannot reason must not receive
   * traffic.
   */
  readonly checkProvider?: HealthCheck;
  /** Template loadability — the reasoning fragments resolve. */
  readonly checkTemplates?: HealthCheck;
  /**
   * D-89: the published artifact schemas — every implemented artifact type
   * has one. On 2026-09-09 readiness answered 200 with zero schema rows and
   * three of four paths failed at Stage 9 behind it (STATUS, `API-060` open
   * issue). Absent means the composition root did not supply the probe,
   * which is a readiness failure like an absent provider.
   */
  readonly checkSchemas?: HealthCheck;
}

type DependencyStatus = "available" | "unavailable";

const probe = async (
  check: HealthCheck | undefined,
  onError: (error: unknown) => void,
): Promise<DependencyStatus> => {
  if (check === undefined) {
    return "unavailable";
  }
  try {
    await check();
    return "available";
  } catch (error) {
    onError(error);
    return "unavailable";
  }
};

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  app,
  options,
) => {
  const { prisma } = options;

  app.get("/health", async (request, reply) => {
    const check = (request.query as { check?: string } | undefined)?.check;

    // Liveness answers one question: is this process running? `API-060` —
    // "Liveness never depends on external services." A liveness probe that
    // consults the database restarts a healthy instance during an outage.
    if (check === "liveness") {
      return { status: "ok" };
    }

    // Readiness is the default: an orchestrator polling `/health` with no
    // parameter should learn whether this instance can serve, not merely
    // whether it is running.
    const log = (error: unknown): void => {
      app.log.error(error);
    };

    const dependencies = {
      database: await probe(
        () => prisma.healthCheck.findFirst().then(() => undefined),
        log,
      ),
      provider: await probe(options.checkProvider, log),
      templates: await probe(options.checkTemplates, log),
      schemas: await probe(options.checkSchemas, log),
    };

    const ready = Object.values(dependencies).every(
      (status) => status === "available",
    );

    // `database` is retained alongside the dependency map for the existing
    // client, which reads it. `API-060` forbids a version, an app name and a
    // provider name — a database reachability flag is none of those, and it is
    // the per-dependency status the requirement asks readiness to report.
    const database =
      dependencies.database === "available" ? "connected" : "disconnected";

    if (!ready) {
      return reply
        .status(503)
        .send({ status: "error", database, dependencies });
    }

    return { status: "ok", database, dependencies };
  });
};
