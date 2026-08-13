/**
 * Bounded exponential backoff with jitter (`AI §10.4`, `NFR-013`, `FR-093`).
 *
 * This module decides *whether* and *when* to retry. It never inspects an HTTP
 * status, a provider error body, or anything else provider-shaped — an attempt
 * is retryable purely from its normalized `ProviderFailureClass`, which the
 * adapter supplies. Provider-specific classification stays inside `adapters/`
 * (`AI-001`, AD-03).
 *
 * WHAT THE SPECIFICATION FIXES
 *
 *   · `AI §10.4` — transient (rate limit, timeout, 5xx): "bounded exponential
 *     backoff with jitter".
 *   · `AI §10.4` — malformed response: "treated as a transient error, **one
 *     retry**, then stage failure". An exact count, so it is a constant here
 *     rather than a policy knob.
 *   · `AI §10.4` — persistent: failover to an alternate provider, which is
 *     routing (`§10.3`) and deferred to Sprint 2 by `docs/12` D-4. Until then a
 *     persistent failure is terminal, and retrying the same provider is exactly
 *     what `§10.4` does not ask for.
 *   · `AI §10.4` — capability mismatch: degrade per `§10.2`. Not a retry.
 *   · `SA §11.3` — "Exponential backoff, jittered, bounded attempt count".
 *
 * WHAT IT DOES NOT FIX — see `docs/12` D-10
 *
 *   No document gives a maximum attempt count, a base delay, a delay ceiling,
 *   or a jitter distribution. Those live in `RetryPolicy` as required fields so
 *   that a caller must supply them consciously; the provisional values below
 *   are marked as unratified rather than presented as requirements.
 */

import { ProviderError, type ProviderFailureClass } from "./capability.js";

/**
 * Attempts allowed for a malformed response: the initial call plus the one
 * retry `AI §10.4` grants. Not configurable — the specification states a
 * number, and widening it here would quietly overrule it.
 */
export const MALFORMED_RESPONSE_MAX_ATTEMPTS = 2;

export interface RetryPolicy {
  /** Total attempts for a transient failure, including the first. */
  readonly maxAttempts: number;
  /** Delay before the second attempt, in milliseconds. Doubles thereafter. */
  readonly baseDelayMs: number;
  /** Ceiling on any single delay. This is the "bounded" in `NFR-013`. */
  readonly maxDelayMs: number;
}

/**
 * ⚠️ PROVISIONAL — not derived from any authoritative document.
 *
 * `NFR-013`, `FR-093` and `SA §11.3` all require the retry to be *bounded* and
 * none of them says by what. These numbers exist so the layer is runnable; they
 * are recorded as an open question (`docs/12` D-10) and must not be cited as a
 * requirement. Callers may pass their own policy.
 */
export const PROVISIONAL_TRANSIENT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 5000,
};

/**
 * Attempts permitted for a given failure class.
 *
 * Anything not named retryable by `AI §10.4` gets exactly one attempt — the
 * conservative reading. Retrying a failure the specification does not call
 * retryable spends provider cost to reproduce a fault, which is the same
 * reasoning `SA §11.3` gives for not auto-retrying stages 5-10.
 */
export function maxAttemptsFor(
  failureClass: ProviderFailureClass,
  policy: RetryPolicy,
): number {
  switch (failureClass) {
    case "transient":
      return policy.maxAttempts;
    case "malformed_response":
      return MALFORMED_RESPONSE_MAX_ATTEMPTS;
    case "persistent":
    case "capability_mismatch":
      return 1;
  }
}

/**
 * Delay before `attempt` (1-based; `attempt` 2 is the first retry).
 *
 * Exponential, capped, then jittered. `random` must return a value in [0,1);
 * it is injected so tests are deterministic rather than flaky-by-design.
 *
 * ⚠️ The jitter *distribution* is unspecified (`docs/12` D-10). This uses full
 * jitter — uniform over [0, capped delay] — because it is the variant that
 * actually spreads a retry storm; equal jitter still leaves half the delay
 * synchronized across callers.
 */
export function backoffDelayMs(
  attempt: number,
  policy: RetryPolicy,
  random: () => number,
): number {
  if (attempt <= 1) {
    return 0;
  }
  const exponential = policy.baseDelayMs * 2 ** (attempt - 2);
  const capped = Math.min(exponential, policy.maxDelayMs);
  return Math.floor(random() * capped);
}

export interface RetryDependencies {
  readonly policy: RetryPolicy;
  readonly sleep: (ms: number) => Promise<void>;
  readonly random: () => number;
}

/**
 * Runs `attemptFn` until it succeeds or its failure class exhausts its budget.
 *
 * `attemptFn` receives the 1-based attempt number so the caller can record it —
 * `ProviderInvocation.attempt_number` (`DB §4.7`) is written per call, not per
 * logical invocation.
 *
 * Every rejection must already be a `ProviderError`; normalization is the
 * caller's job and happens before this sees it (`SA §3.5`).
 */
export async function executeWithRetry<T>(
  attemptFn: (attempt: number) => Promise<T>,
  deps: RetryDependencies,
): Promise<T> {
  let attempt = 1;

  for (;;) {
    try {
      return await attemptFn(attempt);
    } catch (error) {
      if (!(error instanceof ProviderError)) {
        throw error;
      }

      const allowed = maxAttemptsFor(error.failureClass, deps.policy);
      if (attempt >= allowed) {
        throw error;
      }

      attempt += 1;
      const delay = backoffDelayMs(attempt, deps.policy, deps.random);
      if (delay > 0) {
        await deps.sleep(delay);
      }
    }
  }
}
