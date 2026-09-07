/**
 * Rate limiting (`NFR-025`, `API §11.2`, [D-46](../../../docs/21-D-46-In-Memory-Rate-Limiting.md), [D-47](../../../docs/22-D-47-Provisional-Rate-Limits.md)).
 *
 * ⚠️ COUNTERS LIVE IN PROCESS MEMORY AND DO NOT COMPOSE ACROSS INSTANCES.
 * With one instance the limit is exactly the configured limit; with `N` it is
 * `N ×` the limit, and it changes when the fleet is resized. D-46 records that
 * `NFR-025` therefore holds for a single instance and not for a fleet, and
 * that `NFR-051` is not met for this component. This is a known
 * pre-deployment limitation with `M-19` as its closing point — not an
 * oversight, and not something to discover in production.
 *
 * THE INTERFACE IS THE POINT OF THAT DECISION. `check` and `reset` are all a
 * route uses, so replacing the store with a shared one is one implementation
 * swap rather than a rewrite of every guarded endpoint.
 *
 * ⚠️ THE VALUES ARE PROVISIONAL (D-47). `API §11.2` specifies five endpoint
 * classes and their bases and states **no numbers**; `TV-4`'s cost ceiling,
 * the one anchor that could have supplied them, was to be defined in Sprint 0
 * and never was. These are judgement calls, recorded as such.
 *
 * A FIXED WINDOW, NOT A SLIDING ONE. A sliding window needs per-request
 * timestamps retained for the window's length, which is a per-key unbounded
 * list in memory — the thing least affordable in the store D-46 chose. A fixed
 * window admits a burst across a boundary; that is the accepted cost, and at
 * these magnitudes it is not the abuse case any of these limits target.
 */

/** One class from `API §11.2`. */
export interface RateLimitRule {
  /** Requests permitted per window. */
  readonly limit: number;
  readonly windowMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * The five classes of `API §11.2`, with D-47's provisional values.
 *
 * The classes are specified; only the numbers are ours.
 */
export const RATE_LIMITS = {
  /** Per account. Cost control (`R-13`). */
  analysisCreateUser: { limit: 10, windowMs: HOUR },
  /** Per IP, stricter. Secondary to `API §7.8`'s single-analysis cap. */
  analysisCreateAnonymous: { limit: 3, windowMs: HOUR },
  /** Per IP. Credential stuffing. */
  authAttemptIp: { limit: 10, windowMs: 15 * MINUTE },
  /** Per account — tighter, because spraying one account evades a per-IP cap. */
  authAttemptAccount: { limit: 5, windowMs: 15 * MINUTE },
  /** Per account. Rendering cost — a PDF launches a browser (`D-43`). */
  exportGenerate: { limit: 20, windowMs: HOUR },
  /** Generous per `API §11.2`; polling must never approach it. */
  read: { limit: 300, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitClass = keyof typeof RATE_LIMITS;

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Requests left in the current window. */
  readonly remaining: number;
  /**
   * Seconds until the window clears. `API §10.4` requires `429` to carry
   * `Retry-After`, and it is computed from the window rather than fixed, so a
   * client is told when the limit actually lifts.
   */
  readonly retryAfterSeconds: number;
}

interface Counter {
  count: number;
  /** When the current window ends. */
  resetAt: number;
}

export interface RateLimiter {
  /** Records an attempt and says whether it is permitted. */
  check(rateClass: RateLimitClass, key: string, now?: Date): RateLimitDecision;
  /**
   * Forgets a key's counter.
   *
   * Used after a **successful** authentication: `API §11.2` limits attempts to
   * stop credential stuffing, and a user who proves who they are has not made
   * an attack. Without this, someone who mistypes a password four times and
   * then succeeds stays one failure from a lockout for the rest of the window.
   */
  reset(rateClass: RateLimitClass, key: string): void;
  /** Drops expired counters. Called on a timer by the composition root. */
  sweep(now?: Date): number;
  /** Test and diagnostic use. */
  readonly size: number;
}

/**
 * How many distinct keys are held before new ones are refused a counter.
 *
 * ⚠️ AN UNBOUNDED MAP KEYED BY CLIENT-CONTROLLED INPUT IS A MEMORY-EXHAUSTION
 * VECTOR. IP addresses and account ids both come from the outside, so an
 * attacker rotating addresses would otherwise grow this map without limit —
 * turning the defence against abuse into the thing abused.
 *
 * At the cap, an unknown key is **denied** rather than admitted. Failing
 * closed makes the degenerate case a refusal to serve rather than a refusal
 * to limit, which is the safe direction for a control whose job is refusing.
 */
const MAX_TRACKED_KEYS = 100_000;

export function createRateLimiter(): RateLimiter {
  const counters = new Map<string, Counter>();

  const compositeKey = (rateClass: RateLimitClass, key: string): string =>
    `${rateClass}:${key}`;

  return {
    check(rateClass, key, now = new Date()) {
      const rule = RATE_LIMITS[rateClass];
      const at = now.getTime();
      const composite = compositeKey(rateClass, key);

      const existing = counters.get(composite);

      if (existing === undefined || existing.resetAt <= at) {
        if (existing === undefined && counters.size >= MAX_TRACKED_KEYS) {
          // Fail closed. See MAX_TRACKED_KEYS.
          return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
          };
        }
        counters.set(composite, { count: 1, resetAt: at + rule.windowMs });
        return {
          allowed: true,
          remaining: rule.limit - 1,
          retryAfterSeconds: 0,
        };
      }

      existing.count += 1;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt - at) / 1000),
      );

      if (existing.count > rule.limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds };
      }

      return {
        allowed: true,
        remaining: rule.limit - existing.count,
        retryAfterSeconds: 0,
      };
    },

    reset(rateClass, key) {
      counters.delete(compositeKey(rateClass, key));
    },

    sweep(now = new Date()) {
      const at = now.getTime();
      let dropped = 0;
      for (const [composite, counter] of counters) {
        if (counter.resetAt <= at) {
          counters.delete(composite);
          dropped += 1;
        }
      }
      return dropped;
    },

    get size() {
      return counters.size;
    },
  };
}
