/**
 * The input (`FR-001`, `FR-002`, `FR-005`).
 *
 * NO INPUT-TYPE SELECTOR. `FR-001`/`UX-002` — the system determines the type
 * itself; asking the user to declare it would be asking them to do Stage 1's
 * job and to be wrong about it.
 *
 * VALIDATION MIRRORS THE API, IT DOES NOT REPLACE IT. The bounds below are the
 * server's (`CONTENT_MIN`/`CONTENT_MAX`), duplicated so the user learns about a
 * problem while typing rather than after a round trip. The server remains the
 * authoritative gate (`API §6.1`), and its rejection is displayed verbatim if
 * the two ever disagree — that disagreement is a defect worth seeing, not one
 * worth hiding behind a client-side guess.
 *
 * Each message names the constraint and the corrective step, because
 * `FR-005` forbids "invalid input" with nothing actionable attached.
 */

import { useId, useState } from "react";

/** `backend/src/routes/analyses.ts` — kept identical deliberately. */
export const CONTENT_MIN = 50;
export const CONTENT_MAX = 50_000;

export function JobDescriptionForm({
  onSubmit,
  busy,
}: {
  onSubmit: (content: string) => void;
  busy: boolean;
}) {
  const [content, setContent] = useState("");
  const [touched, setTouched] = useState(false);
  const textareaId = useId();
  const messageId = useId();

  const count = content.length;
  const trimmedEmpty = content.trim() === "";

  const problem: string | null = trimmedEmpty
    ? "Paste a job description to analyse."
    : count < CONTENT_MIN
      ? `${String(count)} of ${String(CONTENT_MIN)} characters. Below ${String(CONTENT_MIN)} there is not enough to reason about, and any verdict would be invented — paste the full posting rather than an excerpt.`
      : count > CONTENT_MAX
        ? `${String(count)} characters; the maximum is ${String(CONTENT_MAX)}. Submit the section describing the role and its requirements.`
        : null;

  const showProblem = touched && problem !== null && !trimmedEmpty;
  const submittable = problem === null && !busy;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (submittable) onSubmit(content);
      }}
      className="border border-slate-200 rounded-lg bg-white p-5"
    >
      <label
        htmlFor={textareaId}
        className="block font-semibold text-slate-900"
      >
        Job description
      </label>
      <p className="text-sm text-slate-500 mt-1 mb-3">
        Paste the posting whole — requirements, responsibilities and context.
        NAIGX determines what it is; you do not need to tell it.
      </p>

      <textarea
        id={textareaId}
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
        }}
        onBlur={() => {
          setTouched(true);
        }}
        disabled={busy}
        rows={14}
        spellCheck={false}
        aria-describedby={showProblem ? messageId : undefined}
        aria-invalid={showProblem}
        placeholder="Paste the full job description here…"
        className="w-full rounded-md border border-slate-300 p-3 font-mono text-sm leading-relaxed text-slate-900 resize-y focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p
          id={messageId}
          className={`text-sm ${showProblem ? "text-rose-700" : "text-slate-500"}`}
          role={showProblem ? "alert" : undefined}
        >
          {showProblem
            ? problem
            : `${String(count).toLocaleString()} characters — ${String(CONTENT_MIN)} minimum, ${CONTENT_MAX.toLocaleString()} maximum.`}
        </p>

        <button
          type="submit"
          disabled={!submittable}
          className="px-5 py-2.5 rounded-md bg-slate-900 text-white font-medium hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {busy ? "Submitting…" : "Analyse"}
        </button>
      </div>
    </form>
  );
}
