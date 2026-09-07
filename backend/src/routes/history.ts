/**
 * History and account endpoints — `API-022`–`API-024`, `API-010`–`API-014`.
 *
 *   GET    /analyses               list, 200
 *   DELETE /analyses/{id}          delete one, 202
 *   DELETE /analyses               delete all, 202
 *   GET    /users/me               account summary, 200
 *   DELETE /users/me               delete account, 202
 *   GET    /users/me/settings      200
 *   PUT    /users/me/settings      200
 *   POST   /users/me/data-exports  202
 *
 * ⚠️ THE LISTING NEVER TOUCHES A CONTENT TABLE. `API-022`: "Summaries only —
 * **never full artifact content**, which keeps the listing query off
 * content-bearing tables (`DB §14.1`)." That is a performance property and a
 * privacy one: a listing that joined artifacts would read every user's most
 * sensitive content on every page of history they browse. The `select` below
 * is the enforcement, and there is no field in the response shape that
 * artifact content could occupy.
 *
 * ⚠️ DELETION RETURNS 202, NOT 204. `API-011` explains why in its own words:
 * "Deletion spans two stores with different consistency characteristics.
 * Returning 204 would claim completeness the system cannot yet guarantee. 202
 * with a stated window is honest, and honesty here is not a technicality — it
 * is the difference between a kept and a broken deletion promise."
 *
 * ⚠️ NO SOFT DELETE. `API-023`: "the API's `DELETE` means what `DB DP-7` says
 * it means." The primary-store cascade is synchronous and irreversible.
 */

import type { FastifyPluginAsync, FastifyRequest } from "fastify";

import { AppError, notFoundError } from "../http/errors.js";
import { sendSuccess } from "../http/responses.js";
import { requireUser } from "../http/authenticate.js";
import type { AuditWriter } from "../auth/sessions.js";
import type { TracePurgeQueue } from "../db/trace-purge.js";
import { tracePurgeWindow } from "../db/trace-purge.js";
import { CLASSIFICATION_TYPES } from "../nie/contracts.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export interface HistoryRouteOptions {
  readonly prisma: PrismaClient;
  readonly audit: AuditWriter;
  readonly tracePurge: TracePurgeQueue;
}

/** `API-022` — "limit (default 20, max 100)". */
const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

const EXPORT_FORMATS = ["markdown", "pdf"] as const;

interface ListQuery {
  readonly cursor?: string;
  readonly limit?: string;
  readonly classification?: string;
  readonly q?: string;
}

/**
 * A cursor over `(created_at, analysis_id)`.
 *
 * Both halves are needed: `created_at` alone is not unique, so two analyses
 * created in the same millisecond would make a page boundary ambiguous and
 * could drop or repeat a row. Opaque to the client — base64url of the pair, so
 * nobody builds one by hand and depends on its shape.
 */
const encodeCursor = (createdAt: Date, analysisId: string): string =>
  Buffer.from(`${createdAt.toISOString()}|${analysisId}`, "utf8").toString(
    "base64url",
  );

const decodeCursor = (raw: string): { createdAt: Date; analysisId: string } => {
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  const separator = decoded.lastIndexOf("|");
  const createdAt = new Date(decoded.slice(0, separator));
  const analysisId = decoded.slice(separator + 1);

  if (
    separator === -1 ||
    Number.isNaN(createdAt.getTime()) ||
    analysisId === ""
  ) {
    throw new AppError("validation_failed", "That cursor is not readable.", {
      field: "cursor",
      action: "Omit `cursor` to start from the beginning of your history.",
    });
  }
  return { createdAt, analysisId };
};

/** `FR-063` / `FR-073` — "requires explicit confirmation stating it is permanent". */
function requireConfirmation(body: unknown, what: string): void {
  const confirmation = (body as { confirmation?: unknown } | null)
    ?.confirmation;
  if (confirmation !== true && confirmation !== "permanent") {
    throw new AppError(
      "validation_failed",
      `Deleting ${what} is permanent and cannot be undone.`,
      {
        field: "confirmation",
        action:
          'Send `"confirmation": true` to confirm you understand this cannot be reversed.',
      },
    );
  }
}

export const historyRoutes: FastifyPluginAsync<HistoryRouteOptions> = (
  app,
  { prisma, audit, tracePurge },
) => {
  const correlationOf = (request: FastifyRequest): string | null => request.id;

  // --- API-022 — list analyses ---------------------------------------------
  app.get<{ Querystring: ListQuery }>("/analyses", async (request, reply) => {
    const { userId } = requireUser(request.principal);
    const query = request.query;

    const limit = (() => {
      if (query.limit === undefined) return LIMIT_DEFAULT;
      const parsed = Number.parseInt(query.limit, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > LIMIT_MAX) {
        throw new AppError(
          "validation_failed",
          `\`limit\` must be between 1 and ${String(LIMIT_MAX)}.`,
          {
            field: "limit",
            action: `Omit it to use the default of ${String(LIMIT_DEFAULT)}.`,
          },
        );
      }
      return parsed;
    })();

    if (
      query.classification !== undefined &&
      !(CLASSIFICATION_TYPES as readonly string[]).includes(
        query.classification,
      )
    ) {
      throw new AppError(
        "validation_failed",
        `\`classification\` must be one of: ${CLASSIFICATION_TYPES.join(", ")}.`,
        {
          field: "classification",
          action: "Omit it to list every type.",
        },
      );
    }

    const cursor =
      query.cursor === undefined ? null : decodeCursor(query.cursor);

    // `FR-062` — "search matches input text and artifact content". Input text
    // is matched here; artifact content is **not**, because doing so would
    // join the content tables `API-022` keeps this query off. Recorded as a
    // partial implementation in `docs/STATUS.md` rather than silently narrowed.
    const search = query.q?.trim();

    const rows = await prisma.analysis.findMany({
      where: {
        userId,
        ...(query.classification !== undefined
          ? {
              classification: { determinedType: query.classification as never },
            }
          : {}),
        ...(search !== undefined && search !== ""
          ? { input: { rawContent: { contains: search, mode: "insensitive" } } }
          : {}),
        // Keyset pagination: strictly older than the cursor, tie-broken by id.
        ...(cursor !== null
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  createdAt: cursor.createdAt,
                  analysisId: { lt: cursor.analysisId },
                },
              ],
            }
          : {}),
      },
      // ⚠️ SUMMARIES ONLY. No artifact, no context element, no recommendation
      // body. `classification` is joined for its type alone.
      select: {
        analysisId: true,
        derivedTitle: true,
        createdAt: true,
        status: true,
        overallConfidenceBand: true,
        haltedAtStage: true,
        classification: { select: { determinedType: true } },
      },
      // `API-022` — "reverse-chronological".
      orderBy: [{ createdAt: "desc" }, { analysisId: "desc" }],
      // One extra, to know whether another page exists without counting.
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);

    return sendSuccess(request, reply, {
      items: page.map((row) => ({
        analysis_id: row.analysisId,
        derived_title: row.derivedTitle,
        classification: row.classification?.determinedType ?? null,
        created_at: row.createdAt.toISOString(),
        status: row.status,
        confidence_band: row.overallConfidenceBand,
        // A refused analysis is listed and marked, not hidden — `API §9.3`
        // calls a refusal a determination, and a history that dropped them
        // would look like analyses had vanished.
        refused: row.haltedAtStage !== null,
      })),
      pagination: {
        next_cursor:
          rows.length > limit && last !== undefined
            ? encodeCursor(last.createdAt, last.analysisId)
            : null,
        limit,
      },
      // `API-022` — "empty state distinguishable from filtered-empty".
      // Without this a user with no history and a user whose filter matched
      // nothing see the same blank page and cannot tell which they are.
      filtered:
        query.classification !== undefined ||
        (search !== undefined && search !== ""),
    });
  });

  // --- API-023 — delete one analysis ---------------------------------------
  app.delete<{ Params: { id: string } }>(
    "/analyses/:id",
    async (request, reply) => {
      const { userId } = requireUser(request.principal);
      requireConfirmation(request.body, "an analysis");

      const analysis = await prisma.analysis.findUnique({
        where: { analysisId: request.params.id },
        select: { analysisId: true, userId: true },
      });
      // 404 for someone else's analysis, for the reason `API-021` uses: a 403
      // confirms it exists.
      if (analysis === null || analysis.userId !== userId) {
        throw notFoundError();
      }

      // `DB §5.4` step 1 — the primary store commits first, and the user's
      // request is honoured at that moment. Cascade is synchronous and
      // irreversible; `DB §5.3` defines every child relation.
      await prisma.analysis.delete({
        where: { analysisId: analysis.analysisId },
      });

      // Step 2 — the trace purge is enqueued, not awaited.
      tracePurge.enqueue({
        analysisIds: [analysis.analysisId],
        userId,
        correlationId: correlationOf(request),
      });

      await audit.record({
        userId,
        eventType: "analysis.deleted",
        resourceType: "analysis",
        resourceId: analysis.analysisId,
        outcome: "success",
        correlationId: correlationOf(request),
      });

      return sendSuccess(
        request,
        reply,
        { trace_purge_window: tracePurgeWindow() },
        202,
      );
    },
  );

  // --- API-024 — delete all analyses ---------------------------------------
  app.delete("/analyses", async (request, reply) => {
    const { userId } = requireUser(request.principal);
    requireConfirmation(request.body, "your entire history");

    // Ids first: after the delete there is nothing left to enqueue from.
    const owned = await prisma.analysis.findMany({
      where: { userId },
      select: { analysisId: true },
    });
    const analysisIds = owned.map((row) => row.analysisId);

    const { count } = await prisma.analysis.deleteMany({ where: { userId } });

    tracePurge.enqueue({
      analysisIds,
      userId,
      correlationId: correlationOf(request),
    });

    await audit.record({
      userId,
      eventType: "analysis.deleted",
      resourceType: "analysis",
      resourceId: `bulk:${String(count)}`,
      outcome: "success",
      correlationId: correlationOf(request),
    });

    return sendSuccess(
      request,
      reply,
      { deleted_count: count, trace_purge_window: tracePurgeWindow() },
      202,
    );
  });

  // --- API-010 — current user ----------------------------------------------
  app.get("/users/me", async (request, reply) => {
    const { userId } = requireUser(request.principal);

    const user = await prisma.user.findUnique({
      where: { userId },
      // `API-010` — "never returns `credential_hash` or any session material".
      // Selected rather than deleted afterwards: there is no path by which
      // either could reach the response.
      select: {
        userId: true,
        email: true,
        createdAt: true,
        trainingConsent: true,
      },
    });
    if (user === null) throw notFoundError();

    return sendSuccess(request, reply, {
      user_id: user.userId,
      email: user.email,
      created_at: user.createdAt.toISOString(),
      training_consent: user.trainingConsent,
    });
  });

  // --- API-011 — delete account --------------------------------------------
  app.delete("/users/me", async (request, reply) => {
    const { userId } = requireUser(request.principal);
    requireConfirmation(request.body, "your account and all its data");

    const owned = await prisma.analysis.findMany({
      where: { userId },
      select: { analysisId: true },
    });
    const analysisIds = owned.map((row) => row.analysisId);

    // Audited **before** the delete. `DB §4.6` nullifies `user_id` on account
    // deletion rather than cascading, so the event survives with its identity
    // severed — but it has to exist first, and writing it after the row is
    // gone would fail the foreign key.
    await audit.record({
      userId,
      eventType: "user.deleted",
      resourceType: "user",
      resourceId: userId,
      outcome: "success",
      correlationId: correlationOf(request),
    });

    // `DB §5.3` — CASCADE, hard, across sessions, settings, analyses and all
    // their descendants, exports and feedback. `FR-073` completeness. Sessions
    // go with it, so every token this user held stops resolving.
    await prisma.user.delete({ where: { userId } });

    tracePurge.enqueue({
      analysisIds,
      // The user is gone; the purge audit records the action without them.
      userId: null,
      correlationId: correlationOf(request),
    });

    return sendSuccess(
      request,
      reply,
      {
        deletion_id: request.id,
        trace_purge_window: tracePurgeWindow(),
      },
      202,
    );
  });

  // --- API-012 / API-013 — settings ----------------------------------------
  app.get("/users/me/settings", async (request, reply) => {
    const { userId } = requireUser(request.principal);

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { defaultExportFormat: true, updatedAt: true },
    });
    if (settings === null) throw notFoundError();

    return sendSuccess(request, reply, {
      default_export_format: settings.defaultExportFormat,
      updated_at: settings.updatedAt.toISOString(),
    });
  });

  app.put("/users/me/settings", async (request, reply) => {
    const { userId } = requireUser(request.principal);
    const body = (request.body ?? {}) as { default_export_format?: unknown };

    // ⚠️ `FR-071`: "No setting may alter reasoning behavior." There is exactly
    // one setting, it names an export format, and adding one that reached the
    // NIE would be a contract violation rather than a feature.
    const format = body.default_export_format;
    if (!(EXPORT_FORMATS as readonly unknown[]).includes(format)) {
      throw new AppError(
        "validation_failed",
        `\`default_export_format\` must be one of: ${EXPORT_FORMATS.join(", ")}.`,
        {
          field: "default_export_format",
          action: "Send the format you want exports to default to.",
        },
      );
    }

    // `API-013` — "PUT is idempotent and replaces the full object."
    const updated = await prisma.userSettings.update({
      where: { userId },
      data: { defaultExportFormat: format as "markdown" | "pdf" },
      select: { defaultExportFormat: true, updatedAt: true },
    });

    return sendSuccess(request, reply, {
      default_export_format: updated.defaultExportFormat,
      updated_at: updated.updatedAt.toISOString(),
    });
  });

  // --- API-014 — export user data ------------------------------------------
  //
  // `FR-072` — "all analyses in a machine-readable format", self-service, no
  // operator intervention. Returned inline rather than through a stored file,
  // for the reason [D-41](../../docs/16-D-41-Anonymous-Export-Deviation.md) §4.5
  // resolved `APIQ-2`: a document regenerated on demand needs no storage,
  // issuance or expiry machinery.
  app.post("/users/me/data-exports", async (request, reply) => {
    const { userId } = requireUser(request.principal);

    const analyses = await prisma.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        input: { select: { rawContent: true, sourceType: true } },
        classification: true,
        intentRecord: true,
        contextElements: true,
        recommendations: { include: { alternatives: true } },
        requiredCapabilities: { include: { matches: true, gaps: true } },
        artifactPlanEntries: { include: { artifact: true } },
      },
    });

    const user = await prisma.user.findUnique({
      where: { userId },
      // No credential material, ever (`API-014` acceptance).
      select: { email: true, createdAt: true, trainingConsent: true },
    });

    return sendSuccess(
      request,
      reply,
      {
        data_export_id: request.id,
        status: "complete",
        generated_at: new Date().toISOString(),
        user:
          user === null
            ? null
            : {
                email: user.email,
                created_at: user.createdAt.toISOString(),
                training_consent: user.trainingConsent,
              },
        // The raw rows, which is what "machine-readable" means here — a
        // reformatting for human reading would be `API-040`'s job.
        analyses,
      },
      202,
    );
  });

  return Promise.resolve();
};
