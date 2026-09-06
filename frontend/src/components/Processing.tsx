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

export function Processing({
  status,
  elapsedSeconds,
  connectionWarning,
  onCancel,
}: {
  status: AnalysisStatus | null;
  elapsedSeconds: number;
  connectionWarning: string | null;
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
            Elapsed {formatDuration(elapsedSeconds)} · checking every 2 seconds.
            Results appear once the run finishes — this build retrieves the
            whole analysis at the end rather than streaming it.
          </p>

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
