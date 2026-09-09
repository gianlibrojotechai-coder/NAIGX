/**
 * The submit → poll → retrieve lifecycle.
 *
 * STREAMING AND POLLING, TOGETHER. `API-025` narrates progress as stages
 * finish (`FR-041`); `API-026` polling decides when the analysis is done.
 * They run at the same time on purpose — `SA AR-06` requires the journey to
 * complete with streaming disabled, so the stream may enrich the wait but must
 * never be the only path to the result. If it drops, nothing is lost.
 *
 * POLLING STOPS AT A TERMINAL STATE, and `completed` is not the only one.
 * `failed` and `timed_out` are equally final; continuing to ask would be a
 * request that can only return what it just returned. The interval is cleared
 * on unmount and on a new submission, so at most one poll loop exists.
 *
 * A POLL FAILING IS NOT THE ANALYSIS FAILING. The backend being briefly
 * unreachable says nothing about the run, which continues server-side — the
 * durable `ANALYSIS` row is the job (`SA §12`). So a failed poll is counted
 * and retried, and only a sustained outage is surfaced. Treating one dropped
 * request as a failed analysis would report a failure that did not happen.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { clearDraft } from "./draftStorage";

import {
  createAnalysis,
  setAnonymousToken,
  type Correction,
  fetchAnalysis,
  fetchStatus,
  toApiFailure,
  toRefusal,
  type ApiFailure,
} from "./api/analyses";
import {
  isTerminal,
  type Analysis,
  type AnalysisStatus,
  type Refusal,
} from "./api/types";
import {
  streamAnalysis,
  type StreamedEvent,
  type StreamSubscription,
} from "./api/events";

export const POLL_INTERVAL_MS = 2_000;

/**
 * How many consecutive failed polls to absorb before saying so.
 *
 * Four ticks is roughly eight seconds — long enough that a restarting backend
 * or a dropped packet passes unnoticed, short enough that a genuine outage
 * does not masquerade as a long analysis.
 */
const POLL_FAILURES_TOLERATED = 4;

export type Phase =
  | "idle"
  | "submitting"
  | "processing"
  | "done"
  /**
   * The analysis ran correctly and declined to produce one (`API §9.3`).
   *
   * ⚠️ A SEPARATE PHASE FROM `error` ON PURPOSE. `API §9.3` insists both
   * refusal codes are "not failures" — the request was well-formed and
   * processed correctly. Folding them into `error` would tell the user
   * something went wrong when the system worked exactly as designed, and
   * would bury the unknowns that are the most useful thing it produced.
   */
  | "refused"
  | "error";

export interface AnalysisState {
  readonly phase: Phase;
  readonly analysisId: string | null;
  readonly status: AnalysisStatus | null;
  readonly analysis: Analysis | null;
  readonly failure: ApiFailure | null;
  /** Set in the `refused` phase; null everywhere else (`API §9.3`). */
  readonly refusal: Refusal | null;
  /**
   * The text this analysis was submitted with (`FR-014`).
   *
   * Kept because `API §7.5` step 1 requires a correction to re-submit "the
   * same content", and `API-021` does not return it — `AnalysisInput` carries
   * a character count and a source type, not the text. Held for the session
   * that submitted it, which is the only session that can correct it while
   * history is `M-15` work.
   */
  readonly submittedContent: string | null;
  /** Set while polls are failing but the analysis is not presumed dead. */
  readonly connectionWarning: string | null;
  readonly elapsedSeconds: number;
  /**
   * What the stream has told us so far (`FR-041`).
   *
   * Rendered while the analysis runs; superseded by the retrieved analysis at
   * the end. The stream is an enhancement, so this is additive — nothing here
   * replaces what `API-021` returns.
   */
  readonly progress: readonly StreamedEvent[];
  /** True while events are arriving; false when polling is doing the work. */
  readonly streaming: boolean;
}

const INITIAL: AnalysisState = {
  phase: "idle",
  analysisId: null,
  status: null,
  analysis: null,
  failure: null,
  refusal: null,
  submittedContent: null,
  connectionWarning: null,
  elapsedSeconds: 0,
  progress: [],
  streaming: false,
};

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(INITIAL);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const stream = useRef<StreamSubscription | null>(null);
  const consecutiveFailures = useRef(0);

  const stopTimers = useCallback(() => {
    stream.current?.close();
    stream.current = null;
    if (pollTimer.current !== null) clearInterval(pollTimer.current);
    if (tickTimer.current !== null) clearInterval(tickTimer.current);
    pollTimer.current = null;
    tickTimer.current = null;
  }, []);

  // Timers and in-flight requests must not outlive the component.
  useEffect(
    () => () => {
      stopTimers();
      abort.current?.abort();
    },
    [stopTimers],
  );

  /** Terminal state reached: stop polling and fetch the stored analysis. */
  const retrieve = useCallback(
    async (analysisId: string, status: AnalysisStatus) => {
      stopTimers();
      try {
        const analysis = await fetchAnalysis(analysisId, abort.current?.signal);
        // `FR-006` — the draft has done its job. The analysis is stored and
        // retrievable by id, so a local copy would only resurrect old text
        // into the next submission.
        //
        // Cleared **here**, on successful retrieval, and on no failure path:
        // a failed run is exactly when the user still needs their input.
        clearDraft();
        setState((previous) => ({
          ...previous,
          phase: "done",
          status,
          analysis,
          // D-67 §7 — the owner gets the submitted text back with the
          // analysis, so an analysis opened from history is correctable
          // (`FR-014`) exactly as one submitted in this session is.
          submittedContent:
            previous.submittedContent ?? analysis.input?.content ?? null,
          connectionWarning: null,
        }));
      } catch (error) {
        // `API §9.3` — a 422 here is the analysis reporting a determination,
        // not the retrieval failing. It is lifted out before the error path so
        // the UI can render what was determined and what would resolve it.
        const refusal = toRefusal(error);
        if (refusal !== null) {
          setState((previous) => ({
            ...previous,
            phase: "refused",
            status,
            refusal,
            connectionWarning: null,
          }));
          return;
        }

        // The analysis itself may well have succeeded; it is the retrieval
        // that failed, and the id is kept so it can be retried.
        setState((previous) => ({
          ...previous,
          phase: "error",
          status,
          failure: toApiFailure(error),
        }));
      }
    },
    [stopTimers],
  );

  const poll = useCallback(
    async (analysisId: string) => {
      try {
        const { status } = await fetchStatus(analysisId, abort.current?.signal);
        consecutiveFailures.current = 0;

        setState((previous) => ({
          ...previous,
          status,
          connectionWarning: null,
        }));

        if (isTerminal(status)) {
          await retrieve(analysisId, status);
        }
      } catch (error) {
        consecutiveFailures.current += 1;
        if (consecutiveFailures.current >= POLL_FAILURES_TOLERATED) {
          const failure = toApiFailure(error);
          setState((previous) => ({
            ...previous,
            connectionWarning: `${failure.message} The analysis may still be running on the server — retrieval will be retried.`,
          }));
        }
      }
    },
    [retrieve],
  );

  const submit = useCallback(
    async (content: string, correction?: Correction) => {
      stopTimers();
      abort.current?.abort();
      abort.current = new AbortController();
      consecutiveFailures.current = 0;

      setState({ ...INITIAL, phase: "submitting", submittedContent: content });

      let created;
      try {
        created = await createAnalysis(
          content,
          abort.current.signal,
          correction,
        );
      } catch (error) {
        // The content is kept on the failure too: `FR-006` means a failed
        // submission must not cost the user their text.
        setState({
          ...INITIAL,
          phase: "error",
          failure: toApiFailure(error),
          submittedContent: content,
        });
        return;
      }

      // `FR-004` — kept so every later read can present it. Null when signed
      // in, because an owned analysis is reached with the session instead.
      setAnonymousToken(created.anonymous_token ?? null);

      setState({
        ...INITIAL,
        phase: "processing",
        analysisId: created.analysis_id,
        status: created.status,
        submittedContent: content,
      });

      // `FR-041` — subscribe so artifacts appear as they complete. Polling
      // runs alongside rather than instead: `SA AR-06` requires the journey to
      // finish with streaming disabled, so the stream never becomes the only
      // way the UI learns the analysis is done.
      stream.current =
        streamAnalysis(created.analysis_id, {
          onEvent: (event) => {
            setState((previous) => ({
              ...previous,
              streaming: true,
              progress: [...previous.progress, event],
            }));
          },
          onClosed: () => {
            setState((previous) => ({ ...previous, streaming: false }));
          },
        }) ?? null;

      // An analysis can in principle be terminal already; poll once now rather
      // than waiting a full interval to discover it.
      void poll(created.analysis_id);

      pollTimer.current = setInterval(() => {
        void poll(created.analysis_id);
      }, POLL_INTERVAL_MS);

      tickTimer.current = setInterval(() => {
        setState((previous) =>
          previous.phase === "processing"
            ? { ...previous, elapsedSeconds: previous.elapsedSeconds + 1 }
            : previous,
        );
      }, 1_000);
    },
    [poll, stopTimers],
  );

  /** Retry a retrieval that failed after the analysis itself finished. */
  const retryRetrieval = useCallback(() => {
    if (state.analysisId === null || state.status === null) return;
    setState((previous) => ({ ...previous, phase: "processing" }));
    void retrieve(state.analysisId, state.status);
  }, [retrieve, state.analysisId, state.status]);

  const reset = useCallback(() => {
    stopTimers();
    abort.current?.abort();
    abort.current = null;
    // ⚠️ THE DRAFT IS NOT CLEARED HERE, ON PURPOSE.
    //
    // A successful run already cleared it on retrieval. Every remaining route
    // into `reset` is one where the user still wants their text: "submit a
    // different input" after an `insufficient_context` refusal means *add the
    // missing detail to what I wrote*, and starting them from a blank box
    // would be the same data loss `FR-006` exists to prevent. Discarding is
    // available explicitly, on the recovery banner.
    setState(INITIAL);
  }, [stopTimers]);

  /**
   * `FR-014` — re-run with the type fixed (`API §7.5`).
   *
   * A plain submission of the same content with an override, which the API
   * turns into a **new** analysis. Nothing about the original is mutated, and
   * the new one records which analysis it corrects.
   */
  const correctClassification = useCallback(
    (classificationOverride: string) => {
      const content = state.submittedContent;
      const supersedes = state.analysisId;
      if (content === null) return;
      void submit(content, {
        classificationOverride,
        ...(supersedes !== null ? { supersedesAnalysisId: supersedes } : {}),
      });
    },
    [state.submittedContent, state.analysisId, submit],
  );

  /**
   * Opens a stored analysis from history (`FR-061` — "selecting an entry opens
   * the full stored result").
   *
   * Retrieval only: `API-021` reproduces what is stored and never re-runs
   * reasoning, so this cannot cost anything or produce a different answer.
   *
   * ⚠️ The anonymous token is cleared first. An analysis reached from history
   * is owned, and its anonymous credential was destroyed by the claim; leaving
   * a stale one set would send a credential that authenticates nobody.
   */
  const openStored = useCallback(
    async (analysisId: string) => {
      stopTimers();
      abort.current?.abort();
      abort.current = new AbortController();
      setAnonymousToken(null);

      setState({ ...INITIAL, phase: "processing", analysisId });
      await retrieve(analysisId, "completed");
    },
    [retrieve, stopTimers],
  );

  return {
    state,
    submit,
    reset,
    retryRetrieval,
    correctClassification,
    openStored,
  };
}
