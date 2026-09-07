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
import type { FieldCipher } from "../crypto/data-key.js";
import type { TracePurgeQueue } from "../db/trace-purge.js";
import { tracePurgeWindow } from "../db/trace-purge.js";
import { CLASSIFICATION_TYPES } from "../nie/contracts.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export interface HistoryRouteOptions {
  readonly prisma: PrismaClient;
  readonly audit: AuditWriter;
  readonly tracePurge: TracePurgeQueue;
  /**
   * Opens `raw_content` ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §2).
   *
   * Needed by `API-022`'s search and by `API-014`'s data export, both of which
   * read the user's submitted text back.
   */
  readonly cipher: FieldCipher;
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

/** The listing's summary projection. One definition, used by both search paths. */
const SUMMARY_SELECT = {
  analysisId: true,
  derivedTitle: true,
  createdAt: true,
  status: true,
  overallConfidenceBand: true,
  haltedAtStage: true,
  classification: { select: { determinedType: true } },
} as const;

interface SearchArgs {
  readonly prisma: PrismaClient;
  readonly cipher: FieldCipher;
  readonly userId: string;
  readonly search: string;
  readonly classificationFilter: Record<string, unknown>;
  readonly cursor: { createdAt: Date; analysisId: string } | null;
  readonly limit: number;
}

/**
 * `FR-062` search over sealed `raw_content`
 * ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §4).
 *
 * Fetch, decrypt, filter, then paginate — in that order, and the order is
 * forced. The cursor cannot be pushed into SQL here: which rows match is not
 * known until they are decrypted, so a database-side `LIMIT` would cut the set
 * before filtering and return short or empty pages that look like the end of
 * the results.
 *
 * ⚠️ THE PROJECTION STILL EXCLUDES ARTIFACT CONTENT. `API-022` keeps the
 * listing off content-bearing tables, and decrypting to search must not become
 * a reason to widen it — `input.rawContent` is added because it *is* the search
 * corpus, and nothing else is.
 *
 * ⚠️ `O(the user's analyses)`, deliberately and with the ceiling recorded.
 * D-53 §4 accepts this at v1.0 volume (tens of analyses; AES-GCM is
 * microseconds a row) and names the trigger for revisiting: a user whose search
 * is slow. It is not a scan of every user's data — the `userId` filter is still
 * a SQL predicate, and so is the classification.
 */
async function searchByDecrypting(args: SearchArgs) {
  const {
    prisma,
    cipher,
    userId,
    search,
    classificationFilter,
    cursor,
    limit,
  } = args;

  const candidates = await prisma.analysis.findMany({
    where: { userId, ...classificationFilter },
    select: { ...SUMMARY_SELECT, input: { select: { rawContent: true } } },
    orderBy: [{ createdAt: "desc" }, { analysisId: "desc" }],
  });

  const needle = search.toLowerCase();

  const matched = candidates.filter((row) => {
    const stored = row.input?.rawContent;
    if (stored === undefined || stored === null) {
      // An analysis whose input row is missing cannot match a text search.
      // `select` without the field would read as `undefined` here too, which
      // is why this checks both — "not selected" must never read as "no match"
      // by accident.
      return false;
    }
    return cipher.open(stored).toLowerCase().includes(needle);
  });

  // Keyset pagination, applied after filtering, over the same ordering the
  // database used. `<` on the pair, exactly as the SQL branch expresses it.
  const afterCursor =
    cursor === null
      ? matched
      : matched.filter(
          (row) =>
            row.createdAt.getTime() < cursor.createdAt.getTime() ||
            (row.createdAt.getTime() === cursor.createdAt.getTime() &&
              row.analysisId < cursor.analysisId),
        );

  // One extra, so the caller detects a next page the same way it always has.
  return afterCursor.slice(0, limit + 1).map((row) => ({
    analysisId: row.analysisId,
    derivedTitle: row.derivedTitle,
    createdAt: row.createdAt,
    status: row.status,
    overallConfidenceBand: row.overallConfidenceBand,
    haltedAtStage: row.haltedAtStage,
    classification: row.classification,
  }));
}

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
  { prisma, audit, tracePurge, cipher },
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
    const searching = search !== undefined && search !== "";

    const classificationFilter =
      query.classification !== undefined
        ? { classification: { determinedType: query.classification as never } }
        : {};

    // ⚠️ SEARCH CANNOT BE A SQL PREDICATE ANY MORE, AND THIS IS THE ONE PLACE
    // ENCRYPTION CHANGES BEHAVIOUR ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §4).
    //
    // This used to read:
    //
    //     { input: { rawContent: { contains: search, mode: "insensitive" } } }
    //
    // `raw_content` is now sealed, and **a database cannot substring-match
    // ciphertext**. Leaving that predicate in place would not error — it would
    // match nothing, so every search would return an empty page and look like
    // "no results" rather than like a broken feature. That silent failure is
    // exactly what D-53 §4 was written to prevent, so the resolution it chose
    // is implemented here instead: fetch, decrypt in process, filter on the
    // plaintext, and paginate from the filtered set.
    //
    // `FR-062` semantics are unchanged — still case-insensitive substring
    // matching over submitted text. The cost is that search is now
    // `O(the user's analyses)` rather than an indexed scan, which D-53 §4
    // records and accepts at v1.0 volume.
    const rows = searching
      ? await searchByDecrypting({
          prisma,
          cipher,
          userId,
          search,
          classificationFilter,
          cursor,
          limit,
        })
      : await prisma.analysis.findMany({
          where: {
            userId,
            ...classificationFilter,
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

      // `DB §5.4` steps 1 and 2, in ONE transaction.
      //
      // ⚠️ THE TRANSACTION IS THE DURABILITY GUARANTEE. The deletion is
      // irreversible and cascades (`DB §5.3`); the purge instruction says the
      // trace store still owes work. Committing them separately leaves an
      // instant where the analysis is gone and nothing records that its traces
      // must follow — a crash there loses the purge silently, which is what
      // the in-memory queue did. Either both land or neither does.
      await prisma.$transaction(async (tx) => {
        await tx.analysis.delete({
          where: { analysisId: analysis.analysisId },
        });
        await tracePurge.enqueue(
          {
            analysisIds: [analysis.analysisId],
            userId,
            correlationId: correlationOf(request),
          },
          tx,
        );
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

    // One transaction, for the reason given on `API-021` above.
    const { count } = await prisma.$transaction(async (tx) => {
      const deleted = await tx.analysis.deleteMany({ where: { userId } });
      await tracePurge.enqueue(
        {
          analysisIds,
          userId,
          correlationId: correlationOf(request),
        },
        tx,
      );
      return deleted;
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
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { userId } });
      await tracePurge.enqueue(
        {
          analysisIds,
          // The user is gone; the purge audit records the action without them.
          userId: null,
          correlationId: correlationOf(request),
        },
        tx,
      );
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
        //
        // ⚠️ EXCEPT `raw_content`, WHICH MUST BE OPENED FIRST. It is sealed in
        // the database ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §2),
        // and dumping the row verbatim would hand the user a base64 envelope
        // where their own submitted document should be — satisfying `FR-072`'s
        // letter while exporting something no one can read. This is the second
        // read path encryption touches; the first is search.
        analyses: analyses.map((analysis) => ({
          ...analysis,
          input:
            analysis.input === null
              ? null
              : {
                  ...analysis.input,
                  rawContent: cipher.open(analysis.input.rawContent),
                },
        })),
      },
      202,
    );
  });

  return Promise.resolve();
};
