/**
 * The wait.
 *
 * WHAT IT DOES NOT CLAIM. There is no progress bar and no stage list, because
 * `API-026` reports a status and nothing else — no stage, no percentage, no
 * estimate. A bar animating against an unknown denominator would be an
 * invented measurement, which is the one thing this tool must not do. What can
 * honestly be shown is the status, how long it has been running, and that
 * results appear only when the run finishes.
 *
 * `FR-041` (artifacts appearing as they complete) needs `API-025`, which is
 * not implemented. Rather than imply progressive results, the copy says
 * plainly that everything arrives at once.
 */

import { formatDuration } from "../format";
import type { AnalysisStatus } from "../api/types";

const STATUS_COPY: Record<AnalysisStatus, string> = {
  queued: "Queued — accepted and stored, waiting to start.",
  running: "Reasoning over the posting.",
  completed: "Complete. Retrieving the stored analysis…",
  failed: "The run failed.",
  timed_out: "The run timed out.",
};

/** What each event means, in the order the pipeline emits them (`API §7.4`). */
const MILESTONES: Record<string, string> = {
  classification: "Worked out what kind of input this is",
  understanding: "Extracted the problem and its context",
  insufficient_context:
    "Stopped — the input does not support a reliable answer",
  reasoning_complete: "Finished reasoning",
  plan: "Decided which artifacts to produce",
  artifact: "Produced an artifact",
  artifact_failed: "An artifact was attempted and did not validate",
  complete: "Done",
  error: "The run failed",
};

export function Processing({
  status,
  elapsedSeconds,
  connectionWarning,
  progress,
  streaming,
  onCancel,
}: {
  status: AnalysisStatus | null;
  elapsedSeconds: number;
  connectionWarning: string | null;
  progress: readonly { type: string }[];
  streaming: boolean;
  onCancel: () => void;
}) {
  return (
    <div
      className="border border-slate-200 rounded-lg bg-white p-6"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="mt-1 shrink-0 w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin"
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-900">Analysing</h2>
          <p className="text-sm text-slate-600 mt-1">
            {status === null ? "Submitting…" : STATUS_COPY[status]}
          </p>
          <p className="text-sm text-slate-500 mt-3">
            Elapsed {formatDuration(elapsedSeconds)}
            {streaming
              ? " · following progress live"
              : " · checking every 2 seconds"}
            .
          </p>

          {/* `FR-041` — what has actually completed, as it completes. Only
              events the server sent appear here; nothing is predicted. */}
          {progress.length > 0 && (
            <ol className="mt-4 space-y-1.5">
              {progress.map((event, index) => (
                <li
                  key={`${event.type}-${String(index)}`}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <span
                    aria-hidden="true"
                    className={
                      event.type === "artifact_failed" || event.type === "error"
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }
                  >
                    {event.type === "artifact_failed" || event.type === "error"
                      ? "✕"
                      : "✓"}
                  </span>
                  <span>{MILESTONES[event.type] ?? event.type}</span>
                </li>
              ))}
            </ol>
          )}

          {connectionWarning !== null && (
            <p
              role="status"
              className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-md p-3"
            >
              {connectionWarning}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
        >
          Stop watching
        </button>
      </div>

      <p className="text-xs text-slate-500 mt-4 pl-8">
        Stopping only stops this page from watching. The analysis continues on
        the server and stays stored.
      </p>
    </div>
  );
}
