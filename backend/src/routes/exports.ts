/**
 * Export endpoints — `API-040` (`API §6.5`).
 *
 *   POST /analyses/{id}/exports    the analysis as a distributable document
 *
 * WHAT THIS RETURNS, AND WHY IT IS NOT WHAT `API-040` SPECIFIES.
 * `API-040`'s output is `export_id`, `download_url`, `expires_at`, and its
 * acceptance records an `EXPORT` row. [D-41](../../docs/16-D-41-Anonymous-Export-Deviation.md)
 * decided that row is written only when a real authenticated owner exists —
 * never before `M-15` — so all three fields would identify nothing.
 * [D-42](../../docs/17-D-42-Export-Response-Contract.md) resolves that: the
 * document is the response body, the three fields appear only when a row was
 * actually written, and the status is `200` rather than `201` because nothing
 * is created. **No identifier is minted and no row is fabricated here.**
 *
 * IT IS A PURE TRANSFORMATION (`SA §3.8`). This endpoint reads stored
 * artifacts and lays them out. It never generates content, never invokes the
 * NIE, and never alters analysis substance — so exporting the same analysis
 * twice produces the same document, which is what makes regenerating on demand
 * a sound substitute for storing a file (`DB §4.4`).
 *
 * ONE SERIALISER (`FR-053`). Copy-to-clipboard is a partial export of one
 * artifact — `FR-052`'s `artifact_types` selection specifies exactly that — so
 * the copy control calls this endpoint with a single type rather than holding
 * its own Markdown writer that could drift from this one.
 *
 * BOTH FORMATS, ONE DOCUMENT. `API-040` enumerates `markdown` and `pdf`, and
 * both are served. **PDF is a rendering of the Markdown, not a second
 * document**: the serialiser produces the substance, `export/html.ts` decides
 * how it looks on a page, and `export/pdf.ts` prints it. There is no second
 * content model, so the PDF cannot state anything the Markdown does not.
 *
 * ⚠️ PDF NEEDS A BROWSER ON THE MACHINE (`SA AQ-3`). Mermaid cannot parse
 * without a DOM, so diagrams render only in a real browser. Where none is
 * installed, a `pdf` request is refused with the corrective action and
 * Markdown named — `docs/08` sanctions it as the fallback — rather than served
 * Markdown under a PDF content type.
 */

import type { FastifyPluginAsync } from "fastify";

import { readAnalysis } from "../db/analysis-reader.js";
import { AppError, invalidStateError, notFoundError } from "../http/errors.js";
import { ARTIFACT_TYPES } from "../nie/contracts.js";
import { renderAnalysisMarkdown } from "../export/markdown.js";
import { renderExportHtml } from "../export/html.js";
import { findBrowser, pdfUnavailableError, renderPdf } from "../export/pdf.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export interface ExportRouteOptions {
  readonly prisma: PrismaClient;
  /** Injected so a rendered document is reproducible in a test. */
  readonly now?: () => Date;
}

/** `API-040` input. Both fields optional; `format` defaults to Markdown. */
interface ExportBody {
  readonly format?: unknown;
  readonly artifact_types?: unknown;
}

const EXPORT_FORMATS = ["markdown", "pdf"] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * `API-040`: "Analysis must be terminal."
 *
 * `failed` and `timed_out` are terminal and exportable. `M-14` made partial
 * preservation real — a timed-out analysis keeps everything that completed
 * before it stopped — and refusing to export that would tell a user their
 * surviving work is worthless. The document labels the state at the top.
 */
const TERMINAL_STATUSES = new Set(["completed", "failed", "timed_out"]);

function validateFormat(raw: unknown): ExportFormat {
  if (raw === undefined) return "markdown";
  if (!EXPORT_FORMATS.includes(raw as ExportFormat)) {
    throw new AppError(
      "validation_failed",
      `\`format\` must be one of: ${EXPORT_FORMATS.join(", ")}.`,
      {
        field: "format",
        action: "Omit the field to accept the default, `markdown`.",
      },
    );
  }
  return raw as ExportFormat;
}

/** `FR-052` — the selectable subset, validated against the known types. */
function validateArtifactTypes(raw: unknown): readonly string[] | undefined {
  if (raw === undefined) return undefined;

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AppError(
      "validation_failed",
      "`artifact_types` must be a non-empty array of artifact type names.",
      {
        field: "artifact_types",
        action:
          "Omit the field to export every artifact, or name the ones to include.",
      },
    );
  }

  const known = new Set<string>(ARTIFACT_TYPES);
  const unknown = raw.filter(
    (entry) => typeof entry !== "string" || !known.has(entry),
  );
  if (unknown.length > 0) {
    throw new AppError(
      "validation_failed",
      `\`artifact_types\` contains ${String(unknown.length)} value${unknown.length === 1 ? "" : "s"} that name no artifact type.`,
      {
        field: "artifact_types",
        action: `Use one or more of: ${ARTIFACT_TYPES.join(", ")}.`,
        details: { unrecognised: unknown },
      },
    );
  }

  return raw as readonly string[];
}

export const exportRoutes: FastifyPluginAsync<ExportRouteOptions> = (
  app,
  { prisma, now = () => new Date() },
) => {
  // --- API-040 — create export --------------------------------------------
  app.post<{ Params: { id: string } }>(
    "/analyses/:id/exports",
    async (request, reply) => {
      const body = (request.body ?? {}) as ExportBody;
      const format = validateFormat(body.format);
      const artifactTypes = validateArtifactTypes(body.artifact_types);

      const stored = await readAnalysis(prisma, request.params.id);
      if (stored === null) throw notFoundError();

      // ⚠️ THE OWNERSHIP DECISION, WRITTEN NOW AND ENFORCED WHEN THERE IS
      // SOMETHING TO ENFORCE (`D-41` §4.4, `D-42` §3.5).
      //
      // `Analysis.user_id` is null for every analysis today — `API-020` stores
      // an anonymous token hash instead — so this branch resolves to
      // "anonymous, permitted" from data rather than from a stub. There is no
      // authentication layer, so an analysis that *does* carry an owner cannot
      // have its caller verified, and the only honest answer is to refuse.
      // `M-15` supplies an identity to this branch rather than adding one.
      if (stored.ownership.ownerUserId !== null) {
        throw new AppError(
          "forbidden",
          "This analysis belongs to a registered account, and this instance cannot yet verify who is asking.",
          {
            action:
              "Sign in and export from the account that owns this analysis.",
          },
        );
      }

      if (!TERMINAL_STATUSES.has(stored.view.status)) {
        throw invalidStateError(
          `This analysis is \`${stored.view.status}\`, and an export of a run still in progress would describe a moment rather than a result.`,
          "Wait for the analysis to reach a terminal state — poll `/analyses/{id}/status` — then export.",
        );
      }

      // Resolved before the document is built. A PDF request on a machine with
      // no browser should be refused for the reason it will actually fail, not
      // after the work of rendering something it cannot deliver.
      //
      // Never silently downgraded: a caller who asked for PDF and received
      // Markdown under a PDF content type has a corrupt file and no
      // explanation. `docs/08` sanctions Markdown as the fallback, which is a
      // reason to name it in the refusal, not to substitute it.
      const executablePath = format === "pdf" ? await findBrowser() : null;
      if (format === "pdf" && executablePath === null) {
        throw pdfUnavailableError();
      }

      // A REFUSAL IS EXPORTABLE, AND EXPORTS AS A REFUSAL (`API §9.3`).
      //
      // ⚠️ Unlike `API-021`, this is **not** a 422. The caller is asking for a
      // document describing what happened, and "the input was outside scope,
      // here is what NAIGX does analyse" is a legitimate document — refusing
      // to produce it would leave them with nothing to show for a real
      // determination. The serialiser returns the refusal layout rather than
      // eight headings over nothing.
      //
      // A `FR-052` selection has nothing to select from here, and saying so
      // beats the generic "no artifacts" message, which would suggest the
      // analysis merely produced none.
      if (stored.view.refusal !== null && artifactTypes !== undefined) {
        throw new AppError(
          "validation_failed",
          "This analysis was declined before any artifact was planned, so there is no artifact to select.",
          {
            field: "artifact_types",
            action:
              "Export it without a selection to receive the refusal and what would resolve it.",
            details: { refusal_code: stored.view.refusal.code },
          },
        );
      }

      const exported = renderAnalysisMarkdown(stored.view, {
        generatedAt: now(),
        ...(artifactTypes !== undefined ? { artifactTypes } : {}),
      });

      // A selection that matches nothing this analysis produced is a request
      // for an empty document. Refused with what *is* available, so the caller
      // can correct it rather than wonder why the export looks empty.
      if (artifactTypes !== undefined && exported.includedTypes.length === 0) {
        const available = stored.view.artifacts
          .filter((artifact) => artifact.validation_status === "valid")
          .map((artifact) => artifact.artifact_type);
        throw new AppError(
          "validation_failed",
          "None of the requested artifact types was produced by this analysis.",
          {
            field: "artifact_types",
            action:
              available.length === 0
                ? "This analysis produced no presentable artifacts. Export it without a selection to receive the reasoning sections."
                : `This analysis produced: ${available.join(", ")}.`,
            details: { requested: artifactTypes, available },
          },
        );
      }

      // `D-42` §3.1 — the document *is* the response. No envelope: a caller
      // saving this to a file must not have to unwrap it, and `AC-008` requires
      // the output to be presentation-ready without reformatting.
      //
      // `D-42` §3.2 — `export_id`, `download_url` and `expires_at` are absent
      // rather than null, because no `EXPORT` row was written. A caller seeing
      // no export id is seeing an accurate report that none exists.
      const filename = `naigx-analysis-${stored.view.analysis_id}`;

      if (executablePath !== null) {
        // PDF is a *rendering* of the Markdown above, not a second document.
        // `renderAnalysisMarkdown` produced the substance; these two steps
        // decide how it looks on paper and cannot add to what it says.
        const title =
          stored.view.derived_title ??
          `NAIGX analysis ${stored.view.analysis_id}`;
        const pdf = await renderPdf(
          renderExportHtml(exported.document, title),
          {
            executablePath,
          },
        );

        return reply
          .code(200)
          .header("Content-Type", "application/pdf")
          .header(
            "Content-Disposition",
            `attachment; filename="${filename}.pdf"`,
          )
          .send(pdf);
      }

      return reply
        .code(200)
        .header("Content-Type", "text/markdown; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${filename}.md"`)
        .send(exported.document);
    },
  );

  return Promise.resolve();
};
