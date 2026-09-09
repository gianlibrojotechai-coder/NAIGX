/**
 * The wait — shown as the rail the analysis actually travels (D-68 §3).
 *
 * WHAT IT DOES NOT CLAIM. There is still no progress bar and no percentage:
 * `API-026` reports a status and nothing else, and the pipeline's stages take
 * wildly different times, so a bar filling toward a total would be an
 * invented measurement. What CAN be shown honestly is the rail of stages the
 * pipeline has — they are fixed and known — with each one lit only when the
 * server has reported it (`API-025` events), and a travelling light on the
 * segment after the last reported stage, meaning "working here", not "this
 * far along".
 *
 * The rail lights from the event stream, which since D-74 authenticates
 * like every other request (see `api/events.ts`), and from the 2-second poll
 * when the stream is unavailable. Either way it only lights on what the
 * server said.
 */

import { formatDuration } from "../format";
import type { AnalysisStatus } from "../api/types";

const STATUS_COPY: Record<AnalysisStatus, string> = {
  queued: "Accepted and stored, waiting to start.",
  running: "Reasoning over your input.",
  completed: "Complete. Retrieving the stored analysis…",
  failed: "The run failed.",
  timed_out: "The run timed out.",
};

/** The rail. Each stop names the event that lights it. */
const RAIL: readonly { label: string; lit: readonly string[] }[] = [
  { label: "Read", lit: ["classification"] },
  { label: "Understand", lit: ["understanding", "insufficient_context"] },
  { label: "Reason", lit: ["reasoning_complete"] },
  { label: "Produce", lit: ["plan", "artifact", "artifact_failed"] },
  { label: "Done", lit: ["complete"] },
];

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
  const seen = new Set(progress.map((event) => event.type));
  const litIndex = RAIL.reduce(
    (highest, stop, index) =>
      stop.lit.some((type) => seen.has(type)) ? index : highest,
    -1,
  );
  const failed =
    status === "failed" || status === "timed_out" || seen.has("error");
  // The segment being worked on: after the last lit stop, unless finished.
  const activeSegment =
    failed || litIndex >= RAIL.length - 1 ? -1 : litIndex + 1;

  return (
    <div
      className="rise border border-slate-200 rounded-lg bg-white p-6"
      aria-live="polite"
      aria-busy={!failed}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`mt-1 shrink-0 w-3.5 h-3.5 rounded-full ${failed ? "bg-rose-600" : "bg-accent-400 breathe"}`}
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-900">
            {failed ? "Stopped" : "Analysing"}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {status === null ? "Submitting…" : STATUS_COPY[status]}
          </p>

          {/* The rail. Lit only by server events; the beam is activity. */}
          <ol
            className="mt-5 grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${String(RAIL.length)}, minmax(0, 1fr))`,
            }}
            aria-label="Stages reported by the server"
          >
            {RAIL.map((stop, index) => {
              const lit = index <= litIndex;
              const active = index === activeSegment;
              return (
                <li key={stop.label} className="min-w-0">
                  <div
                    className={`h-1.5 rounded-full ${lit ? "bg-accent-400" : "bg-slate-200"} ${active ? "beam-track" : ""}`}
                  />
                  <p
                    className={`mt-2 text-xs font-medium truncate ${lit ? "text-slate-900" : active ? "text-slate-700" : "text-slate-500"}`}
                  >
                    {lit ? (
                      <span aria-hidden="true">✓ </span>
                    ) : active ? (
                      <span aria-hidden="true">… </span>
                    ) : null}
                    {stop.label}
                    <span className="sr-only">
                      {lit
                        ? ", reported complete"
                        : active
                          ? ", in progress"
                          : ", not yet"}
                    </span>
                  </p>
                </li>
              );
            })}
          </ol>

          <p className="text-sm text-slate-500 mt-4 tabular-nums">
            Elapsed {formatDuration(elapsedSeconds)}
            {streaming
              ? " · following progress live"
              : " · checking every 2 seconds"}
            .
          </p>

          {/* What has actually completed, as it completes. Only events the
              server sent appear here; nothing is predicted. */}
          {progress.length > 0 && (
            <ol className="mt-3 space-y-1">
              {progress.map((event, index) => (
                <li
                  key={`${event.type}-${String(index)}`}
                  className="rise flex items-start gap-2 text-sm text-slate-700"
                  style={{ ["--i" as string]: 0 }}
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
