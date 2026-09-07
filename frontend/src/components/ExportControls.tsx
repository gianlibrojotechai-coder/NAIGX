/**
 * Export and copy controls (`FR-050`, `FR-052`, `FR-053`, `M-13`).
 *
 * BOTH CONTROLS CALL THE SAME ENDPOINT. Downloading the analysis is
 * `API-040` with no selection; copying one artifact is `API-040` with that one
 * type, which is exactly what `FR-052`'s `artifact_types` selection specifies.
 * The frontend holds no Markdown writer of its own, so the copied text and the
 * downloaded file are the same serialiser's output and cannot drift.
 *
 * WHY THE COPY CONTROL GOES TO THE SERVER RATHER THAN READING THE DOM. What is
 * on screen is React elements, not text; serialising them would mean a second
 * Markdown implementation that agrees with the first only by inspection. The
 * round trip costs one request against a stored analysis — `SA §3.8` makes it
 * a pure transformation, so it invokes no reasoning and costs nothing.
 *
 * FAILURE IS REPORTED IN PLACE. A copy control that silently does nothing is
 * worse than one that says it failed, because the user walks away believing
 * they hold the document.
 */

import { useState } from "react";

import {
  exportAnalysisMarkdown,
  exportAnalysisPdf,
  toApiFailure,
} from "../api/analyses";

type State = "idle" | "working" | "done" | "failed";

const RESET_MS = 2_500;

/** Shared button chrome. Small, quiet, and never the loudest thing on screen. */
const buttonClass =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-60 disabled:cursor-not-allowed";

/**
 * `FR-053` — a copy control on an individual artifact.
 *
 * Copies that artifact as formatted Markdown, which for a Mermaid diagram is
 * the fenced block carrying valid diagram source.
 */
export function CopyArtifactButton({
  analysisId,
  artifactType,
}: {
  analysisId: string;
  artifactType: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const copy = async () => {
    setState("working");
    setDetail(null);
    try {
      const markdown = await exportAnalysisMarkdown(analysisId, [artifactType]);
      // `writeText` needs a secure context; over plain HTTP on a non-localhost
      // host it is simply absent, which is a real deployment case rather than
      // an error to swallow.
      if (typeof navigator.clipboard?.writeText !== "function") {
        throw new Error(
          "This browser will not give the page clipboard access. Use the download control instead.",
        );
      }
      await navigator.clipboard.writeText(markdown);
      setState("done");
      setTimeout(() => {
        setState("idle");
      }, RESET_MS);
    } catch (error) {
      setState("failed");
      setDetail(
        error instanceof Error && error.message.includes("clipboard")
          ? error.message
          : toApiFailure(error).message,
      );
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className={buttonClass}
        disabled={state === "working"}
        onClick={(event) => {
          // The control sits in the section header, beside the collapse
          // toggle. Stopped rather than left to bubble so that a future header
          // that does handle clicks cannot collapse the section out from under
          // a copy.
          event.stopPropagation();
          void copy();
        }}
      >
        {state === "working"
          ? "Copying…"
          : state === "done"
            ? "Copied"
            : state === "failed"
              ? "Copy failed"
              : "Copy as Markdown"}
      </button>
      {detail !== null && (
        <span className="text-xs text-rose-700 max-w-xs text-right">
          {detail}
        </span>
      )}
    </span>
  );
}

/**
 * `FR-050` — the whole analysis as a self-contained document, in either format.
 *
 * Saved as a file rather than opened in a tab: the point of the export is that
 * the user has something to hand to somebody else.
 *
 * **Both buttons fetch the same document.** The server renders the PDF from the
 * same Markdown, so choosing a format chooses a typesetting, never a different
 * set of facts.
 */
export function ExportAnalysisButton({ analysisId }: { analysisId: string }) {
  const [state, setState] = useState<State>("idle");
  const [busy, setBusy] = useState<"markdown" | "pdf" | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  /** Hands the browser a file. Shared so the two formats cannot diverge. */
  const save = (blob: Blob, extension: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `naigx-analysis-${analysisId}.${extension}`;
    anchor.click();
    // Released on the next tick: revoking synchronously can beat the browser
    // to the download in some engines.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  };

  const download = async (format: "markdown" | "pdf") => {
    setState("working");
    setBusy(format);
    setDetail(null);
    try {
      if (format === "pdf") {
        save(await exportAnalysisPdf(analysisId), "pdf");
      } else {
        const markdown = await exportAnalysisMarkdown(analysisId);
        save(
          new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
          "md",
        );
      }
      setState("done");
      setTimeout(() => {
        setState("idle");
      }, RESET_MS);
    } catch (error) {
      setState("failed");
      // The API's own message, which names the corrective step — for PDF that
      // is usually "request markdown", and replacing it with a generic string
      // would discard the one useful thing the failure carried.
      setDetail(toApiFailure(error).message);
    } finally {
      setBusy(null);
    }
  };

  const label = (format: "markdown" | "pdf", idle: string) => {
    if (busy === format) return format === "pdf" ? "Rendering…" : "Preparing…";
    if (busy !== null) return idle;
    if (state === "done") return "Downloaded";
    if (state === "failed") return "Export failed";
    return idle;
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={busy !== null}
          onClick={() => {
            void download("markdown");
          }}
        >
          {label("markdown", "Export as Markdown")}
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={busy !== null}
          onClick={() => {
            void download("pdf");
          }}
        >
          {label("pdf", "Export as PDF")}
        </button>
      </div>
      {detail !== null && <span className="text-xs text-rose-700">{detail}</span>}
      {/* PDF needs a browser on the server (`SA AQ-3`). Where none is installed
          the API refuses and names Markdown, and that message appears above —
          so the control is offered rather than pre-emptively hidden on a guess
          about the server's environment. */}
      <span className="text-xs text-slate-500">
        PDF renders diagrams; Markdown carries the diagram source. Same content.
      </span>
    </div>
  );
}
