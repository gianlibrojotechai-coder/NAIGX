/**
 * History (`FR-061`, `FR-062`, `FR-063`, `API-022`–`API-024`).
 *
 * ⚠️ AN ENTRY IS A SUMMARY, NOT AN ANALYSIS. `API-022` returns "summaries only
 * — never full artifact content". Opening one fetches it through `API-021`,
 * which is where the full record lives. Nothing here renders analysis content,
 * because nothing here has any.
 *
 * ⚠️ DELETION IS PERMANENT AND SAYS SO BEFORE IT HAPPENS. `FR-063`: "deletion
 * requires explicit confirmation stating it is permanent". The confirmation
 * below names what is about to be destroyed and does not soften it — and the
 * server refuses a delete that arrives without one, so a client that skipped
 * this could not delete anything anyway.
 *
 * `FR-061` — "empty state explains what will appear here", and `FR-062` —
 * "no-results state distinguishes 'no matches' from 'no history'". Those are
 * two different screens, and `API-022`'s `filtered` flag is what tells them
 * apart: without it both render blank and the user cannot tell which they are
 * looking at.
 */

import { useCallback, useEffect, useId, useState } from "react";

import {
  deleteAllAnalyses,
  deleteAnalysis,
  fetchHistory,
  type HistoryEntry,
} from "../api/history";
import { toApiFailure } from "../api/auth";
import { formatTimestamp, humanise } from "../format";

const CLASSIFICATIONS = [
  "business_requirement",
  "existing_workflow",
  "job_description",
  "technical_assessment",
] as const;

export function HistoryView({
  onOpen,
  onClose,
}: {
  onOpen: (analysisId: string) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<readonly HistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filtered, setFiltered] = useState(false);
  const [classification, setClassification] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchId = useId();
  const filterId = useId();

  const load = useCallback(
    async (cursor: string | null = null) => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchHistory({
          cursor,
          classification: classification === "" ? null : classification,
          q: search,
        });
        setEntries((previous) =>
          cursor === null ? page.items : [...previous, ...page.items],
        );
        setNextCursor(page.pagination.next_cursor);
        setFiltered(page.filtered);
      } catch (caught) {
        setError(toApiFailure(caught).message);
      } finally {
        setLoading(false);
      }
    },
    [classification, search],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const remove = async (analysisId: string) => {
    try {
      const receipt = await deleteAnalysis(analysisId);
      setEntries((previous) =>
        previous.filter((entry) => entry.analysis_id !== analysisId),
      );
      // `API-023` returns 202 with a window because the trace store is purged
      // asynchronously. Saying so is more honest than a bare "deleted".
      setNotice(
        `Deleted. Diagnostic traces are purged within ${receipt.trace_purge_window}.`,
      );
    } catch (caught) {
      setError(toApiFailure(caught).message);
    } finally {
      setConfirming(null);
    }
  };

  const removeAll = async () => {
    try {
      const receipt = await deleteAllAnalyses();
      setEntries([]);
      setNextCursor(null);
      setNotice(
        `Deleted ${String(receipt.deleted_count ?? 0)} analyses. Diagnostic traces are purged within ${receipt.trace_purge_window}.`,
      );
    } catch (caught) {
      setError(toApiFailure(caught).message);
    } finally {
      setConfirmingAll(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">History</h2>
          <p className="text-sm text-slate-500">
            Every analysis saved to this account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setConfirmingAll(true);
              }}
              className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
            >
              Delete all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </header>

      {/* `FR-062` — searchable by text, filterable by classification. */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 px-5 py-3">
        {/* ⚠️ A PLACEHOLDER IS NOT A LABEL (WCAG 3.3.2, Level A). It vanishes
            on focus, is not reliably announced, and leaves a screen-reader
            user with an unnamed field. `sr-only` keeps the visual design and
            gives the control a real accessible name. */}
        <label className="sr-only" htmlFor={searchId}>
          Search your history by the text you submitted
        </label>
        <input
          id={searchId}
          type="search"
          value={search}
          placeholder="Search the text you submitted…"
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <label className="sr-only" htmlFor={filterId}>
          Filter history by input type
        </label>
        <select
          id={filterId}
          value={classification}
          onChange={(event) => {
            setClassification(event.target.value);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">All types</option>
          {CLASSIFICATIONS.map((type) => (
            <option key={type} value={type}>
              {humanise(type)}
            </option>
          ))}
        </select>
      </div>

      {notice !== null && (
        <p
          role="status"
          className="border-b border-slate-200 bg-slate-50 px-5 py-2 text-sm text-slate-700"
        >
          {notice}
        </p>
      )}
      {error !== null && (
        <p className="border-b border-rose-200 bg-rose-50 px-5 py-2 text-sm text-rose-900">
          {error}
        </p>
      )}

      {/* `FR-063` — bulk deletion, confirmed, and named as permanent. */}
      {confirmingAll && (
        <div className="border-b border-rose-200 bg-rose-50 px-5 py-3">
          <p className="text-sm font-medium text-rose-900">
            Delete every analysis in this account?
          </p>
          <p className="mt-1 text-sm text-rose-900">
            This is permanent. The analyses are removed from storage and cannot
            be recovered through this interface or any other.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                void removeAll();
              }}
              className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-800"
            >
              Delete permanently
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingAll(false);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Keep them
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-200">
        {loading && entries.length === 0 && (
          <p className="px-5 py-6 text-sm text-slate-500">Loading…</p>
        )}

        {/* Two different empty states, distinguished by `filtered`. */}
        {!loading && entries.length === 0 && !filtered && (
          <div className="px-5 py-8">
            <p className="font-medium text-slate-900">No analyses yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Every analysis you run while signed in appears here, with the date
              and what it was determined to be. Nothing is saved until you run
              one.
            </p>
          </div>
        )}
        {!loading && entries.length === 0 && filtered && (
          <div className="px-5 py-8">
            <p className="font-medium text-slate-900">No matches</p>
            <p className="mt-1 text-sm text-slate-600">
              Your history is not empty — nothing in it matches this search or
              filter. Clear them to see everything.
            </p>
          </div>
        )}

        {entries.map((entry) => (
          <article key={entry.analysis_id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    onOpen(entry.analysis_id);
                  }}
                  className="text-left font-medium text-slate-900 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  {entry.derived_title ?? "Untitled analysis"}
                </button>
                <p className="mt-0.5 text-sm text-slate-500">
                  {formatTimestamp(entry.created_at) ?? entry.created_at}
                  {entry.classification !== null &&
                    ` · ${humanise(entry.classification)}`}
                  {entry.status !== "completed" &&
                    ` · ${humanise(entry.status)}`}
                  {/* A declined analysis is listed and marked. A history that
                      dropped them would look like analyses had vanished. */}
                  {entry.refused && " · Declined"}
                </p>
              </div>

              {confirming === entry.analysis_id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-900">
                    Permanent. Delete?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void remove(entry.analysis_id);
                    }}
                    className="rounded-md bg-rose-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-800"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(null);
                    }}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(entry.analysis_id);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {nextCursor !== null && (
        <div className="border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void load(nextCursor);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}
