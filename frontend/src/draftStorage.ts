/**
 * Input persistence across failure (`FR-006`).
 *
 * THE FAILURE THIS PREVENTS. A user pastes a long job description, submits it,
 * and the run fails — or the backend is unreachable, or the tab reloads while
 * they wait. Before this, the textarea came back empty and the only copy of
 * what they had pasted was gone. Losing a user's own input to *our* failure is
 * the worst possible response to it.
 *
 * ⚠️ CLIENT-SIDE ONLY, AND DELIBERATELY SO. This is `localStorage` in the
 * user's own browser. Nothing is sent anywhere, nothing is stored on the
 * server, and no identity is involved — `FR-006` is about not destroying what
 * the user typed, not about syncing it. Server-side drafts would need an owner,
 * and ownership is `M-15`.
 *
 * WHAT IS AND IS NOT KEPT:
 *
 *   · Kept while a submission is in flight and after a failure, so the text
 *     survives a failed run, a reload, or a closed tab.
 *   · **Cleared on success.** A completed analysis is retrievable by id and
 *     its input is stored server-side; keeping a local copy would resurrect
 *     old text into the next submission, which is a worse bug than the one
 *     this fixes.
 *   · Cleared when the user explicitly starts over.
 *
 * EVERY ACCESS IS GUARDED. `localStorage` throws rather than returning null in
 * a private window, when site data is blocked, and when a quota is exceeded.
 * A storage failure must never take down the form the user is typing into —
 * so every operation here fails silently and the app behaves as if no draft
 * existed. Persistence is a convenience; the textarea is the source of truth.
 */

const KEY = "naigx.draft.v1";

/**
 * Guards against a stored value large enough to be a problem to read back.
 *
 * `CONTENT_MAX` is 50,000 characters and the form rejects more, but storage
 * can hold whatever a previous version wrote. A draft longer than the server
 * would accept is not worth restoring — it would restore into a form that
 * immediately rejects it.
 */
const MAX_RESTORABLE = 50_000;

export interface Draft {
  readonly content: string;
  /** When it was saved, so the UI can say how stale the recovered text is. */
  readonly savedAt: string;
}

/** Saves the in-flight input. Silently does nothing if storage is unavailable. */
export const saveDraft = (content: string): void => {
  if (content.trim() === "") return;
  try {
    const draft: Draft = { content, savedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Private window, blocked site data, or a full quota. The user keeps
    // typing; they simply have no recovery if this session ends badly.
  }
};

/**
 * Recovers a saved draft, or `null` when there is nothing usable.
 *
 * Narrowed rather than cast: this value was written by a previous version of
 * this app and read back by this one, which is exactly the boundary where a
 * shape assumption goes wrong. Anything unrecognisable is discarded rather
 * than restored as `undefined` into a textarea.
 */
export const loadDraft = (): Draft | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { content, savedAt } = parsed as Record<string, unknown>;
    if (typeof content !== "string" || content.trim() === "") return null;
    if (content.length > MAX_RESTORABLE) return null;

    return {
      content,
      savedAt: typeof savedAt === "string" ? savedAt : "",
    };
  } catch {
    return null;
  }
};

/** Forgets the draft. Called on success and on an explicit start-over. */
export const clearDraft = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do. A draft that cannot be cleared is a stale suggestion the
    // user can dismiss, not a failure worth surfacing.
  }
};
