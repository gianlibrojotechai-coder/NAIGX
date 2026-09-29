/**
 * The app picker (D-94): every app n8n ships, searchable and grouped by
 * category, so the owner can swap the app behind a workflow step for one they
 * prefer, one the client already pays for, or one they want to learn.
 *
 * A dialog, not a dropdown: 400 entries need a search box and category
 * filters, and a modal keeps the keyboard inside it (Escape closes, focus
 * returns to the button that opened it).
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  categoriesInOrder,
  searchApps,
  type CatalogueApp,
  CATALOGUE_SOURCE,
} from "../apps";

const LIMIT = 60;

export function AppPicker({
  stepName,
  stepNumber,
  isTrigger,
  currentType,
  onChoose,
  onReset,
  onClose,
}: {
  stepName: string;
  stepNumber: number;
  /** Step 1 is the workflow's trigger; the list opens on trigger nodes. */
  isTrigger: boolean;
  currentType: string | null;
  onChoose: (app: CatalogueApp) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [triggersOnly, setTriggersOnly] = useState(isTrigger);
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const categories = useMemo(categoriesInOrder, []);
  const results = searchApps(query, category, triggersOnly);
  const shown = results.slice(0, LIMIT);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-50/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-400">
            Step {stepNumber} · swap the app
          </p>
          <h2 id={titleId} className="mt-1 font-serif text-2xl text-slate-900">
            {stepName}
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search 400+ apps — Pipedrive, Notion, Stripe…"
              aria-label="Search apps"
              className="glow-focus min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={triggersOnly}
                onChange={(event) => {
                  setTriggersOnly(event.target.checked);
                }}
                className="h-4 w-4 accent-accent-400"
              />
              Triggers only
            </label>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setCategory(null);
              }}
              aria-pressed={category === null}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                category === null
                  ? "border-accent-500 bg-sky-50 text-sky-900"
                  : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-50"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(category === c ? null : c);
                }}
                aria-pressed={category === c}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                  category === c
                    ? "border-accent-500 bg-sky-50 text-sky-900"
                    : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {shown.length === 0 && (
            <li className="px-3 py-6 text-sm text-slate-500 italic">
              Nothing matches. Try a shorter word, or clear the category.
            </li>
          )}
          {shown.map((app) => {
            const current = app.type === currentType;
            return (
              <li key={app.type}>
                <button
                  type="button"
                  onClick={() => {
                    onChoose(app);
                  }}
                  aria-current={current ? "true" : undefined}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 ${
                    current ? "bg-sky-50" : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-200 font-mono text-xs font-bold text-slate-800"
                  >
                    {app.name
                      .split(/\s+/)
                      .map((w) => w.charAt(0))
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {app.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {app.categories.join(" · ") || "Uncategorised"}
                    </span>
                  </span>
                  {app.trigger && (
                    <span className="shrink-0 rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                      trigger
                    </span>
                  )}
                  {current && (
                    <span className="shrink-0 text-xs text-slate-500">
                      current
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {results.length > LIMIT && (
            <li className="px-3 py-3 text-xs text-slate-500">
              {results.length - LIMIT} more — narrow the search to see them.
            </li>
          )}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            {results.length} of the apps n8n ships ({CATALOGUE_SOURCE}).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              Keep NAIGX&apos;s pick
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
