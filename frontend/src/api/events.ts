/**
 * The `API-025` event stream client (`FR-041`).
 *
 * `EventSource` is the browser's built-in SSE reader. It reconnects on its own
 * and sends `Last-Event-ID` automatically, which is why the server assigns a
 * sequence number to every event — resumption is handled by the platform, and
 * our job is to give it something to resume from.
 *
 * ⚠️ THE STREAM IS AN ENHANCEMENT, NOT THE SOURCE OF TRUTH. `API-025`:
 * "Stream failure never fails the analysis", and `SA AR-06` keeps polling as
 * the fallback. So every failure here — no stream on the instance, a dropped
 * connection, a restarted server — resolves to "fall back to polling", never to
 * an error the user sees. The stored analysis is retrieved the same way either
 * way.
 */

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
 * Opens the stream. Returns `undefined` when the browser has no `EventSource`,
 * so the caller polls instead.
 */
export const streamAnalysis = (
  analysisId: string,
  handlers: StreamHandlers,
): StreamSubscription | undefined => {
  // ⚠️ THE STREAM CANNOT AUTHENTICATE, AND THAT IS A KNOWN LIMITATION.
  //
  // `API-025` became owner-scoped in `M-15`, and `EventSource` cannot set an
  // `Authorization` header — the browser API has no facility for it. The two
  // ways round are both worse than the gap: a token in the query string puts a
  // credential into URLs, server logs and `Referer` headers, and a cookie
  // would introduce a second credential class `API §3.1` deliberately does not
  // have.
  //
  // So a stream against an owner-scoped analysis is refused and this closes,
  // and the UI falls back to polling — which `SA AR-06` requires to work with
  // streaming disabled anyway, and which `useAnalysis` runs alongside the
  // stream rather than instead of it. `FR-041` progressive rendering is
  // therefore **degraded, not broken**, and it is recorded in `docs/STATUS.md`
  // rather than left to be discovered.
  if (typeof EventSource === "undefined") return undefined;

  const source = new EventSource(`${baseURL}/analyses/${analysisId}/events`);
  let terminal = false;
  let closed = false;

  const shutdown = (wasTerminal: boolean): void => {
    if (closed) return;
    closed = true;
    source.close();
    handlers.onClosed(wasTerminal);
  };

  // Each event type arrives as its own named event, so they are registered
  // individually rather than read off a single `message` handler.
  const types: AnalysisEventType[] = [
    "classification",
    "understanding",
    "insufficient_context",
    "reasoning_complete",
    "plan",
    "artifact",
    "artifact_failed",
    "complete",
    "error",
  ];

  for (const type of types) {
    source.addEventListener(type, (message: MessageEvent<string>) => {
      let parsed: StreamedEvent;
      try {
        parsed = JSON.parse(message.data) as StreamedEvent;
      } catch {
        // A malformed frame is a delivery fault, not an analysis fault. Drop it
        // and keep listening; the stored analysis is unaffected.
        return;
      }
      handlers.onEvent(parsed);

      if (type === "complete" || type === "error") {
        terminal = true;
        shutdown(true);
      }
    });
  }

  // Fires on connection loss *and* when the server closes after a terminal
  // event. `EventSource` would otherwise retry forever, so a stream that has
  // already delivered its terminal event is closed deliberately.
  source.onerror = () => {
    if (terminal) {
      shutdown(true);
      return;
    }
    // `readyState === CLOSED` means the browser has given up. While it is
    // reconnecting, leave it alone — that is the resumption path working.
    if (source.readyState === EventSource.CLOSED) shutdown(false);
  };

  return {
    close: () => {
      shutdown(terminal);
    },
  };
};
