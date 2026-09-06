import axios from "axios";

/**
 * The API base. Vite inlines `VITE_API_BASE_URL` at build time; the default is
 * the backend's own default port (`PORT=3000`), and the backend's default
 * `CORS_ORIGIN` is Vite's default `http://localhost:5173`, so a clean checkout
 * of both halves talks to itself with no configuration (`NFR-071`).
 */
const baseURL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:3000";

/**
 * ⚠️ TIMEOUTS ARE PER REQUEST, NOT PER ANALYSIS.
 *
 * The previous 5-second default was wrong for this workflow in both
 * directions. Reasoning takes tens of seconds (`M-2`: 15s p50, 40s p95), which
 * suggested the timeout was far too short — but no request here ever waits for
 * it. `POST /analyses` returns `202` before reasoning starts, and the wait is
 * spent in polling. The real risk is the opposite one: a *retrieval* of a
 * complete analysis is a multi-table read that can legitimately exceed five
 * seconds on a cold connection, and aborting it surfaced as "failed" for an
 * analysis that had in fact completed and been stored.
 *
 * So the default is generous enough that a slow read is waited for rather than
 * misreported, and the poll (below) sets its own much shorter bound.
 */
export const api = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

/**
 * The poll's bound, deliberately shorter than the interval it runs on.
 *
 * A status request that outlives its own polling interval would let requests
 * queue up behind a stalled backend, and each retry would make the pile
 * deeper. Failing the individual poll fast and trying again on the next tick
 * keeps at most one request in flight.
 */
export const POLL_TIMEOUT_MS = 1_500;
