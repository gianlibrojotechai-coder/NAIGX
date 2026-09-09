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

import { useEffect, useId, useState } from "react";

import { clearDraft, loadDraft, saveDraft, type Draft } from "../draftStorage";

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
  /**
   * `FR-006` — a draft recovered from a previous session.
   *
   * Read once, on mount, via the lazy initialiser rather than in an effect:
   * an effect would render an empty textarea first and then fill it, which
   * looks like the app losing the text and then finding it again.
   *
   * It is offered rather than applied. Silently repopulating the box would
   * leave the user unsure whether they are looking at their own text or
   * something the app remembered, so recovery stays an explicit choice.
   */
  const [recovered, setRecovered] = useState<Draft | null>(() => loadDraft());
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

  /**
   * `FR-006` — the text is saved as it is typed, not only at submission.
   *
   * A crash, a closed tab or a navigation away are all failures the user did
   * not choose, and none of them reaches a submit handler. Debounced so a long
   * paste does not write on every keystroke.
   */
  useEffect(() => {
    if (content.trim() === "") return;
    const timer = setTimeout(() => {
      saveDraft(content);
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [content]);

  const savedAtLabel = (() => {
    if (recovered === null || recovered.savedAt === "") return null;
    const when = new Date(recovered.savedAt);
    return Number.isNaN(when.getTime()) ? null : when.toLocaleString();
  })();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (submittable) {
          // Written before the request leaves, so a submission that never
          // returns still leaves the text recoverable.
          saveDraft(content);
          onSubmit(content);
        }
      }}
      className="rise glow-focus border border-slate-200 rounded-lg bg-white p-5"
      style={{ ["--i" as string]: 3 }}
    >
      {/* `FR-006` — offered, never silently applied. Hidden once the user has
          started typing: replacing what they are working on would be the same
          data loss this exists to prevent. */}
      {recovered !== null && content === "" && (
        <div className="mb-4 rounded-md border border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">
            You have unsubmitted text from a previous session
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {recovered.content.length.toLocaleString()} characters
            {savedAtLabel !== null && `, saved ${savedAtLabel}`}. It was kept in
            this browser only.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setContent(recovered.content);
                setRecovered(null);
              }}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              Restore it
            </button>
            <button
              type="button"
              onClick={() => {
                clearDraft();
                setRecovered(null);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              Discard
            </button>
          </div>
        </div>
      )}
      <label
        htmlFor={textareaId}
        className="block font-semibold text-slate-900"
      >
        Your input
      </label>
      <p className="text-sm text-slate-500 mt-1 mb-3">
        Paste the whole thing — requirements, context, constraints. NAIGX
        determines what kind of input it is; you do not need to tell it.
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
        placeholder="Paste a job posting, a business problem, a workflow description, or a design brief…"
        className="w-full rounded-md border border-slate-300 bg-slate-100 p-3 text-sm leading-relaxed text-slate-900 resize-y focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
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
          className="px-5 py-2.5 rounded-md bg-accent-400 text-slate-50 font-mono text-sm font-semibold uppercase tracking-[0.12em] hover:bg-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-300 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          {busy ? "Submitting…" : "Decide ↗"}
        </button>
      </div>
    </form>
  );
}
