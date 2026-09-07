/**
 * Classification correction (`FR-014`, `API §7.5`).
 *
 * ⚠️ THIS DOES NOT EDIT THE ANALYSIS ON SCREEN. `API §7.5` is explicit that the
 * contract "deliberately does not mutate the original analysis": `DB DP-3`
 * makes analyses immutable, and re-running reasoning under a different frame
 * produces a genuinely different analysis. So correcting the type **submits
 * the same content again** with the type fixed, and a new analysis is created.
 * The original stays exactly where it was and remains retrievable.
 *
 * That is why this control is worded as "re-analyse as…" rather than "change
 * the type". A user who expected an in-place edit would be surprised to find
 * a second analysis; one told they are re-running is not.
 *
 * THE CONTENT COMES FROM THE STORED ANALYSIS, NOT FROM THE BROWSER. `API §7.5`
 * step 1 says the client submits "the same content", and the only trustworthy
 * copy of that is the one the server stored — a local draft may have been
 * edited, cleared on success, or never existed if the page was opened by id.
 * So the caller supplies the text it retrieved.
 */

import { useState } from "react";

import { humanise } from "../format";

/**
 * `unsupported` is deliberately absent.
 *
 * It is a refusal outcome (`FR-092`), not a frame anything can be reasoned
 * under, and the API refuses it. Offering it here would present a choice that
 * produces no analysis.
 */
const CORRECTABLE_TYPES = [
  "business_requirement",
  "existing_workflow",
  "job_description",
  "technical_assessment",
] as const;

export function ClassificationCorrection({
  determinedType,
  wasLowConfidence,
  onCorrect,
  busy,
}: {
  determinedType: string;
  wasLowConfidence: boolean;
  /** Re-submits the stored content with this type fixed. */
  onCorrect: (type: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");

  const alternatives = CORRECTABLE_TYPES.filter(
    (type) => type !== determinedType,
  );

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      {!open ? (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <p className="text-sm text-slate-600 max-w-xl">
            {wasLowConfidence
              ? "This type was determined with low confidence. If it is wrong, the reasoning that follows rests on the wrong frame."
              : "If this is not what the input actually is, the reasoning that follows rests on the wrong frame."}
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            This is the wrong type
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Re-analyse as a different type
            </p>
            {/* The behaviour the user is about to get, stated before they get
                it. `API §7.5` creates a new analysis; a control that implied
                an in-place edit would be lying about the contract. */}
            <p className="mt-1 text-sm text-slate-600">
              This runs the analysis again with the type you choose. It creates
              a <strong>new</strong> analysis — this one is kept, unchanged, so
              you can compare them.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="correction-type">
              Corrected type
            </label>
            <select
              id="correction-type"
              value={selected}
              disabled={busy}
              onChange={(event) => {
                setSelected(event.target.value);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:bg-slate-50"
            >
              <option value="">Choose a type…</option>
              {alternatives.map((type) => (
                <option key={type} value={type}>
                  {humanise(type)}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={selected === "" || busy}
              onClick={() => {
                onCorrect(selected);
              }}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Re-analysing…" : "Re-analyse"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setSelected("");
              }}
              className="rounded-md px-2 py-1.5 text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
