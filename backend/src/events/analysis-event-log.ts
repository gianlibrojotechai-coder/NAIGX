/**
 * The in-process event log an analysis publishes to, and streams read from.
 *
 * WHAT IT SOLVES. `API-025` requires three things that a bare callback cannot
 * give you: monotonic sequence numbers for gap detection, `plan` before any
 * `artifact`, and **reconnection with `Last-Event-ID` that resumes without
 * duplication**. The third is the demanding one — a client that drops at event
 * 4 and reconnects must receive 5 onward and nothing it already has. That means
 * events have to be *retained*, not merely broadcast.
 *
 * So this is a log with subscribers, not a pub/sub bus. New events append and
 * fan out; a late or returning subscriber replays from where it left off and
 * then follows live. Sequence numbers are per analysis and start at 1.
 *
 * ⚠️ IN MEMORY, AND DELIBERATELY SO. `DB §4` defines no event entity, and
 * inventing one to satisfy a transport concern would put a durable table behind
 * a feature `SA AR-06` already gives a fallback for. `SA AD-05` fixes in-process
 * execution for v1.0 and accepts that "instance restart loses in-flight work" —
 * this inherits exactly that boundary. **Resumption works within a process
 * lifetime.** After a restart a reconnecting client finds no log, is told so,
 * and falls back to polling `API-026` and retrieving `API-021`, which is what
 * those endpoints are for. Recorded rather than hidden.
 *
 * MEMORY IS BOUNDED by eviction, not by hope: a completed analysis's log is
 * dropped once nothing is listening and a grace period has passed, so a
 * long-running instance does not accumulate one buffer per analysis forever.
 */

import { isTerminalEvent, type AnalysisEvent } from "../nie/events.js";

/** One event with the sequence number a client uses to resume. */
export interface SequencedEvent {
  readonly sequence: number;
  readonly event: AnalysisEvent;
}

export type EventListener = (event: SequencedEvent) => void;

export interface Subscription {
  /** Stops delivery. Safe to call twice. */
  readonly unsubscribe: () => void;
}

export interface AnalysisEventLog {
  /** Appends, assigns the next sequence number, and fans out to listeners. */
  publish(analysisId: string, event: AnalysisEvent): void;
  /**
   * Replays everything after `afterSequence`, then follows live.
   *
   * Returns `undefined` when no log exists for the analysis — a restart, or an
   * id that never ran. The caller decides what that means; this layer does not
   * guess.
   */
  subscribe(
    analysisId: string,
    afterSequence: number,
    listener: EventListener,
  ): Subscription | undefined;
  /** True once a terminal event has been published. */
  isComplete(analysisId: string): boolean;
  /** Starts a log so a subscriber can attach before the first event. */
  open(analysisId: string): void;
}

interface LogEntry {
  events: SequencedEvent[];
  listeners: Set<EventListener>;
  complete: boolean;
  completedAt: number | null;
}

export interface EventLogOptions {
  /**
   * How long a completed log survives with no listeners.
   *
   * Long enough that a client dropping at the final event can reconnect and
   * collect it; short enough that memory does not grow with every analysis
   * the instance has ever run. Not specified by any document — a number this
   * layer must choose, recorded as chosen.
   */
  readonly retentionMs?: number;
  readonly now?: () => number;
}

const DEFAULT_RETENTION_MS = 120_000;

export function createAnalysisEventLog(
  options: EventLogOptions = {},
): AnalysisEventLog {
  const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
  const now = options.now ?? Date.now;
  const logs = new Map<string, LogEntry>();

  /** Drops completed logs nobody is reading. Called on every write. */
  const evict = (): void => {
    for (const [analysisId, entry] of logs) {
      if (
        entry.complete &&
        entry.listeners.size === 0 &&
        entry.completedAt !== null &&
        now() - entry.completedAt > retentionMs
      ) {
        logs.delete(analysisId);
      }
    }
  };

  const entryFor = (analysisId: string): LogEntry => {
    const existing = logs.get(analysisId);
    if (existing !== undefined) return existing;
    const created: LogEntry = {
      events: [],
      listeners: new Set(),
      complete: false,
      completedAt: null,
    };
    logs.set(analysisId, created);
    return created;
  };

  return {
    open(analysisId) {
      entryFor(analysisId);
    },

    publish(analysisId, event) {
      evict();
      const entry = entryFor(analysisId);

      // Sequence is position in the log. Monotonic by construction, so a gap
      // can only mean a lost frame — which is what `API §7.4` wants detectable.
      const sequenced: SequencedEvent = {
        sequence: entry.events.length + 1,
        event,
      };
      entry.events.push(sequenced);

      if (isTerminalEvent(event)) {
        entry.complete = true;
        entry.completedAt = now();
      }

      for (const listener of [...entry.listeners]) {
        // One subscriber's failure must not stop the others, and must never
        // reach the pipeline: `API-025` — "stream failure never fails the
        // analysis". A broken pipe is a delivery problem, and the reasoning
        // it would have described is already persisted.
        try {
          listener(sequenced);
        } catch {
          entry.listeners.delete(listener);
        }
      }
    },

    subscribe(analysisId, afterSequence, listener) {
      const entry = logs.get(analysisId);
      if (entry === undefined) return undefined;

      // Replay, then follow — and the gap between them is what would lose an
      // event. It cannot here: `subscribe` is synchronous end to end, so no
      // `publish` can interleave. That safety is a property of this function
      // staying synchronous, which is why it does not await anything.
      for (const sequenced of entry.events) {
        if (sequenced.sequence > afterSequence) listener(sequenced);
      }

      if (entry.complete) {
        // Nothing further will arrive. The caller closes; no listener is
        // registered, so the log becomes evictable.
        return { unsubscribe: () => undefined };
      }

      entry.listeners.add(listener);
      return {
        unsubscribe: () => {
          entry.listeners.delete(listener);
        },
      };
    },

    isComplete(analysisId) {
      return logs.get(analysisId)?.complete ?? false;
    },
  };
}
