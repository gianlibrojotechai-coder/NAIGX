/**
 * The `API-025` event stream client (`FR-041`).
 *
 * WHY NOT `EventSource`. The browser's built-in SSE reader cannot set an
 * `Authorization` header, and `API-025` became owner-scoped in `M-15`. Until
 * [D-74](../../../docs/49-D-74-Authenticated-Event-Stream.md) the stream was
 * refused for every signed-in account and the UI learned of progress from the
 * 2-second poll instead — `FR-041` progressive rendering was degraded on
 * exactly the instance the owner uses (D-67 disables anonymous analysis, so
 * *every* production analysis is owned).
 *
 * `fetch` can set the header, and a `text/event-stream` body is a byte stream
 * like any other. What `EventSource` did for free — reconnecting, and sending
 * `Last-Event-ID` — is done here explicitly, against the same server contract:
 * every frame carries `id:`, the server accepts `Last-Event-ID` and replays
 * from it, and the terminal event is always sent before close.
 *
 * ⚠️ THE CREDENTIAL TRAVELS IN A HEADER, NEVER IN THE URL. The two workarounds
 * `EventSource` invited — a token in the query string, or a cookie — were
 * rejected for good reasons that still hold (STATUS, M-15 limitation 1).
 * This client presents the same `Authorization` header every other request
 * sends, and nothing else.
 *
 * ⚠️ THE STREAM IS AN ENHANCEMENT, NOT THE SOURCE OF TRUTH. `API-025`:
 * "Stream failure never fails the analysis", and `SA AR-06` keeps polling as
 * the fallback. So every failure here — a refused stream, a dropped
 * connection, a restarted server, a browser without streaming `fetch` —
 * resolves to "fall back to polling", never to an error the user sees. The
 * stored analysis is retrieved the same way either way.
 */

import { analysisAuth } from "./analyses";
import { parseSseFrames, type SseFrame } from "./sse";

const baseURL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:3000";

/** `API §7.4` — the event names the server can send. */
export type AnalysisEventType =
  | "classification"
  | "understanding"
  | "insufficient_context"
  | "reasoning_complete"
  | "plan"
  | "artifact"
  | "artifact_failed"
  | "complete"
  | "error";

const EVENT_TYPES: ReadonlySet<string> = new Set<AnalysisEventType>([
  "classification",
  "understanding",
  "insufficient_context",
  "reasoning_complete",
  "plan",
  "artifact",
  "artifact_failed",
  "complete",
  "error",
]);

export interface StreamedEvent {
  readonly type: AnalysisEventType;
  readonly [key: string]: unknown;
}

export interface StreamHandlers {
  readonly onEvent: (event: StreamedEvent) => void;
  /**
   * The stream ended, for any reason.
   *
   * `terminal` distinguishes "the analysis finished and said so" from "the
   * connection went away". Only the first means the caller can stop; the second
   * means fall back to polling.
   */
  readonly onClosed: (terminal: boolean) => void;
}

export interface StreamSubscription {
  readonly close: () => void;
}

/**
 * How many times a dropped connection is re-opened before giving up and
 * leaving the poll to finish the job. `EventSource` retried forever; a bound
 * keeps a dead server from being hit every few seconds for the life of the
 * tab, and the poll is running regardless.
 */
const MAX_RECONNECTS = 5;
const RECONNECT_DELAY_MS = 2_000;

/**
 * Opens the stream. Returns `undefined` when the browser cannot stream a
 * `fetch` body, so the caller polls instead.
 */
export const streamAnalysis = (
  analysisId: string,
  handlers: StreamHandlers,
): StreamSubscription | undefined => {
  if (
    typeof fetch === "undefined" ||
    typeof ReadableStream === "undefined" ||
    typeof TextDecoder === "undefined"
  ) {
    return undefined;
  }

  let terminal = false;
  let closed = false;
  let lastEventId: string | null = null;
  let reconnects = 0;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const shutdown = (wasTerminal: boolean): void => {
    if (closed) return;
    closed = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    controller?.abort();
    handlers.onClosed(wasTerminal);
  };

  const deliver = (frame: SseFrame): void => {
    if (frame.id !== null) lastEventId = frame.id;
    if (frame.event === null || !EVENT_TYPES.has(frame.event)) return;
    let parsed: StreamedEvent;
    try {
      parsed = JSON.parse(frame.data) as StreamedEvent;
    } catch {
      // A malformed frame is a delivery fault, not an analysis fault. Drop it
      // and keep listening; the stored analysis is unaffected.
      return;
    }
    handlers.onEvent(parsed);
    if (frame.event === "complete" || frame.event === "error") {
      terminal = true;
      shutdown(true);
    }
  };

  const connect = async (): Promise<void> => {
    if (closed) return;
    controller = new AbortController();
    let response: Response;
    try {
      response = await fetch(`${baseURL}/analyses/${analysisId}/events`, {
        headers: {
          Accept: "text/event-stream",
          ...analysisAuth(),
          ...(lastEventId === null ? {} : { "Last-Event-ID": lastEventId }),
        },
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      scheduleReconnect();
      return;
    }

    if (!response.ok || response.body === null) {
      // 401/403: not ours to stream. 404/410 (`expired`): nothing live to
      // stream. 503: no stream on this instance. None is worth retrying —
      // the poll already covers all of them (`SA AR-06`).
      shutdown(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { frames, rest } = parseSseFrames(buffer);
        buffer = rest;
        for (const frame of frames) {
          deliver(frame);
          if (closed) return;
        }
      }
    } catch {
      // The connection dropped mid-stream; fall through to the reconnect.
    }

    if (closed) return;
    // The server closes after the terminal event (`API §7.4`), so reaching
    // the end without one means the connection was lost, not finished.
    scheduleReconnect();
  };

  const scheduleReconnect = (): void => {
    if (closed) return;
    if (reconnects >= MAX_RECONNECTS) {
      shutdown(false);
      return;
    }
    reconnects += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, RECONNECT_DELAY_MS);
  };

  void connect();

  return {
    close: () => {
      shutdown(terminal);
    },
  };
};
