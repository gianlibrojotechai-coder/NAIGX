/**
 * Feedback and operator metrics — `API-050`, `API-070` (`M-16`).
 *
 *   PUT /analyses/{id}/feedback   quality signal, 200
 *   GET /internal/metrics         operator only, 200
 *
 * ⚠️ `PUT`, NOT `POST`, FOR FEEDBACK. `API-050`: "`PUT` because feedback is
 * replaceable — a user may revise their own assessment (`DB §4.6`)." That is
 * also `DP-3`'s one permitted exception: feedback is user-authored rather than
 * system-generated, so revising it does not alter the analysis record. The
 * analysis itself stays immutable.
 *
 * ⚠️ FEEDBACK IS NEVER REQUIRED. `FR-101`: "never required to proceed", and
 * `API-050`: "never required to proceed anywhere in the API". Nothing else in
 * this system reads it, so an analysis with no feedback is complete.
 *
 * ⚠️ `/internal/*` ACCEPTS AN OPERATOR CREDENTIAL AND NOTHING ELSE
 * ([D-48](../../docs/23-D-48-Operator-Authentication.md)). A valid user access
 * token, a valid anonymous token, an absent header and a malformed one all
 * receive the same refusal. Being signed in is not a step toward being an
 * operator — and this route never consults `request.principal`, which is the
 * user resolver's answer and has no bearing here.
 */

import type { FastifyPluginAsync } from "fastify";

import { AppError, notFoundError } from "../http/errors.js";
import { sendSuccess } from "../http/responses.js";
import { requireUser } from "../http/authenticate.js";
import { requireOperator } from "../auth/operator.js";
import { computeMetrics, renderPrometheus } from "../db/metrics.js";
import type { AuditWriter } from "../auth/sessions.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { PrismaClient as TracePrismaClient } from "../generated/prisma-trace/client.js";

export interface InstrumentationRouteOptions {
  readonly prisma: PrismaClient;
  readonly audit: AuditWriter;
  /** `M-10` needs the trace store; an instance without one reports zero. */
  readonly tracePrisma?: TracePrismaClient;
  /** D-48. Absent disables `/internal/*` entirely. */
  readonly operatorToken?: string;
  readonly now?: () => Date;
}

/** `FR-101` — "negative signals accept optional free-text detail". */
const DETAIL_MAX = 2_000;

export const instrumentationRoutes: FastifyPluginAsync<
  InstrumentationRouteOptions
> = (
  app,
  { prisma, audit, tracePrisma, operatorToken, now = () => new Date() },
) => {
  // --- API-050 — submit feedback -------------------------------------------
  app.put<{ Params: { id: string } }>(
    "/analyses/:id/feedback",
    async (request, reply) => {
      const { userId } = requireUser(request.principal);
      const body = (request.body ?? {}) as {
        helpful?: unknown;
        detail?: unknown;
      };

      if (typeof body.helpful !== "boolean") {
        throw new AppError(
          "validation_failed",
          "`helpful` must be true or false.",
          {
            field: "helpful",
            action:
              "Send whether this analysis was helpful. Feedback is optional; it is never required to proceed.",
          },
        );
      }

      const detail = body.detail;
      if (detail !== undefined && detail !== null) {
        if (typeof detail !== "string") {
          throw new AppError("validation_failed", "`detail` must be text.", {
            field: "detail",
            action: "Omit it, or send a short explanation.",
          });
        }
        if (detail.length > DETAIL_MAX) {
          throw new AppError(
            "validation_failed",
            `\`detail\` is ${String(detail.length)} characters; the maximum is ${String(DETAIL_MAX)}.`,
            { field: "detail", action: "Shorten it." },
          );
        }
      }

      // `API-050` is owner-scoped. 404 rather than 403 for a non-owner, the
      // same rule `API-021` uses: a 403 confirms the analysis exists.
      const analysis = await prisma.analysis.findUnique({
        where: { analysisId: request.params.id },
        select: { analysisId: true, userId: true },
      });
      if (analysis === null || analysis.userId !== userId) {
        throw notFoundError();
      }

      const detailValue =
        typeof detail === "string" && detail.trim() !== "" ? detail : null;

      // Replaceable by the user, once per analysis (`DB §4.6`). An upsert
      // rather than a create, because `PUT` means "make it be this".
      const saved = await prisma.feedback.upsert({
        where: { analysisId: analysis.analysisId },
        create: {
          analysisId: analysis.analysisId,
          userId,
          helpful: body.helpful,
          ...(detailValue !== null ? { detail: detailValue } : {}),
        },
        update: {
          helpful: body.helpful,
          detail: detailValue,
          submittedAt: now(),
        },
        select: { helpful: true, detail: true, submittedAt: true },
      });

      return sendSuccess(request, reply, {
        analysis_id: analysis.analysisId,
        helpful: saved.helpful,
        detail: saved.detail,
        submitted_at: saved.submittedAt.toISOString(),
      });
    },
  );

  // --- API-070 — operator metrics ------------------------------------------
  app.get("/internal/metrics", async (request, reply) => {
    // ⚠️ `requireOperator`, never `requireUser`. The two resolvers share no
    // source, so no user credential can satisfy this (D-48 §2.2).
    requireOperator(request.headers.authorization, operatorToken);

    const snapshot = await computeMetrics(
      { prisma, ...(tracePrisma !== undefined ? { trace: tracePrisma } : {}) },
      now(),
    );

    // Audited: `API §6.8` treats internal access as privileged. The event
    // records that an operator read metrics, and carries no identity because
    // D-48 issues one shared credential — recorded there as a known cost.
    await audit.record({
      userId: null,
      eventType: "internal.metrics_read",
      resourceType: "metrics",
      outcome: "success",
      correlationId: request.id,
    });

    return reply
      .code(200)
      .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
      .send(renderPrometheus(snapshot));
  });

  return Promise.resolve();
};
