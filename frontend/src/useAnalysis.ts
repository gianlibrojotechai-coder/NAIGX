/**
 * The submit → poll → retrieve lifecycle.
 *
 * POLLING, NOT STREAMING. `API-025` (SSE) is not implemented, so results
 * appear when the analysis reaches a terminal state rather than as each stage
 * completes. `FR-041` — "artifacts must appear as they complete" — is
 * therefore **not** satisfied by this increment, and the processing view says
 * so rather than implying progress it cannot see.
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

import {
  createAnalysis,
  fetchAnalysis,
  fetchStatus,
  toApiFailure,
  type ApiFailure,
} from "./api/analyses";
import { isTerminal, type Analysis, type AnalysisStatus } from "./api/types";

export const POLL_INTERVAL_MS = 2_000;

/**
 * How many consecutive failed polls to absorb before saying so.
 *
 * Four ticks is roughly eight seconds — long enough that a restarting backend
 * or a dropped packet passes unnoticed, short enough that a genuine outage
 * does not masquerade as a long analysis.
 */
const POLL_FAILURES_TOLERATED = 4;

export type Phase = "idle" | "submitting" | "processing" | "done" | "error";

export interface AnalysisState {
  readonly phase: Phase;
  readonly analysisId: string | null;
  readonly status: AnalysisStatus | null;
  readonly analysis: Analysis | null;
  readonly failure: ApiFailure | null;
  /** Set while polls are failing but the analysis is not presumed dead. */
  readonly connectionWarning: string | null;
  readonly elapsedSeconds: number;
}

const INITIAL: AnalysisState = {
  phase: "idle",
  analysisId: null,
  status: null,
  analysis: null,
  failure: null,
  connectionWarning: null,
  elapsedSeconds: 0,
};

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(INITIAL);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const consecutiveFailures = useRef(0);

  const stopTimers = useCallback(() => {
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
        const analysis = await fetchAnalysis(
          analysisId,
          abort.current?.signal,
        );
        setState((previous) => ({
          ...previous,
          phase: "done",
          status,
          analysis,
          connectionWarning: null,
        }));
      } catch (error) {
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
        const { status } = await fetchStatus(
          analysisId,
          abort.current?.signal,
        );
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
    async (content: string) => {
      stopTimers();
      abort.current?.abort();
      abort.current = new AbortController();
      consecutiveFailures.current = 0;

      setState({ ...INITIAL, phase: "submitting" });

      let created;
      try {
        created = await createAnalysis(content, abort.current.signal);
      } catch (error) {
        setState({
          ...INITIAL,
          phase: "error",
          failure: toApiFailure(error),
        });
        return;
      }

      setState({
        ...INITIAL,
        phase: "processing",
        analysisId: created.analysis_id,
        status: created.status,
      });

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
    setState(INITIAL);
  }, [stopTimers]);

  return { state, submit, reset, retryRetrieval };
}
