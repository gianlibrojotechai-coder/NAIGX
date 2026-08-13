/**
 * Unit — bounded exponential backoff with jitter (`AI §10.4`, `NFR-013`).
 *
 * The properties under test are the ones the specification actually fixes:
 * which classes are retryable, that a malformed response gets exactly one
 * retry, and that delays are exponential, capped, and jittered. The provisional
 * numeric bounds are deliberately not asserted as requirements — only that they
 * are honoured once supplied.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { ProviderError } from "../../src/provider/capability.js";
import {
  backoffDelayMs,
  executeWithRetry,
  MALFORMED_RESPONSE_MAX_ATTEMPTS,
  maxAttemptsFor,
  type RetryPolicy,
} from "../../src/provider/retry.js";

const policy: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 100,
  maxDelayMs: 1000,
};

const deps = (random = () => 0.5) => {
  const slept: number[] = [];
  return {
    slept,
    deps: {
      policy,
      random,
      sleep: (ms: number) => {
        slept.push(ms);
        return Promise.resolve();
      },
    },
  };
};

test("only the classes AI §10.4 names retryable get more than one attempt", () => {
  assert.equal(maxAttemptsFor("transient", policy), policy.maxAttempts);
  assert.equal(
    maxAttemptsFor("malformed_response", policy),
    MALFORMED_RESPONSE_MAX_ATTEMPTS,
  );
  // Persistent means failover (§10.3, Sprint 2), not retry against the same
  // provider. Capability mismatch means degrade (§10.2), not retry.
  assert.equal(maxAttemptsFor("persistent", policy), 1);
  assert.equal(maxAttemptsFor("capability_mismatch", policy), 1);
});

test("a malformed response is retried exactly once, as §10.4 states", async () => {
  let attempts = 0;
  const { deps: d } = deps();
  await assert.rejects(
    executeWithRetry(() => {
      attempts += 1;
      return Promise.reject(new ProviderError("malformed_response", "garbage"));
    }, d),
    (error: ProviderError) => error.failureClass === "malformed_response",
  );
  assert.equal(attempts, 2, "initial call plus one retry, then stage failure");
});

test("a transient failure is retried up to the policy bound and no further", async () => {
  let attempts = 0;
  const { deps: d } = deps();
  await assert.rejects(
    executeWithRetry(() => {
      attempts += 1;
      return Promise.reject(new ProviderError("transient", "429"));
    }, d),
  );
  assert.equal(attempts, policy.maxAttempts, "bounded, per NFR-013");
});

test("a persistent failure is not retried", async () => {
  let attempts = 0;
  const { deps: d } = deps();
  await assert.rejects(
    executeWithRetry(() => {
      attempts += 1;
      return Promise.reject(new ProviderError("persistent", "auth failed"));
    }, d),
  );
  assert.equal(attempts, 1);
});

test("a retry that succeeds returns its value and stops retrying", async () => {
  let attempts = 0;
  const { deps: d } = deps();
  const result = await executeWithRetry((attempt) => {
    attempts += 1;
    if (attempt < 3) {
      return Promise.reject(new ProviderError("transient", "timeout"));
    }
    return Promise.resolve(`ok on ${String(attempt)}`);
  }, d);
  assert.equal(result, "ok on 3");
  assert.equal(attempts, 3);
});

test("a non-ProviderError escapes untouched rather than being retried", async () => {
  // Normalization happens before retry (`SA §3.5`). Anything unnormalized here
  // is a programming fault, and retrying it would spend budget on a bug.
  let attempts = 0;
  const { deps: d } = deps();
  await assert.rejects(
    executeWithRetry(() => {
      attempts += 1;
      return Promise.reject(new TypeError("bug"));
    }, d),
    TypeError,
  );
  assert.equal(attempts, 1);
});

test("delays grow exponentially and are capped by maxDelayMs", () => {
  // random() = 1 would be out of range; the largest representable jitter
  // factor approaches 1, so use it to observe the pre-jitter ceiling.
  const nearOne = () => 0.9999999;
  const delays = [2, 3, 4, 5, 6].map((attempt) =>
    backoffDelayMs(attempt, policy, nearOne),
  );
  assert.deepEqual(delays.slice(0, 4), [99, 199, 399, 799]);
  assert.ok(
    delays.every((d) => d <= policy.maxDelayMs),
    "no delay exceeds the bound",
  );
  assert.equal(
    backoffDelayMs(20, policy, nearOne),
    999,
    "growth saturates at the cap rather than overflowing",
  );
});

test("jitter spreads the delay across [0, capped) rather than fixing it", () => {
  const atZero = backoffDelayMs(4, policy, () => 0);
  const atHalf = backoffDelayMs(4, policy, () => 0.5);
  const atMax = backoffDelayMs(4, policy, () => 0.9999999);
  assert.equal(atZero, 0, "full jitter can collapse to no delay");
  assert.equal(atHalf, 200);
  assert.equal(atMax, 399);
  assert.notEqual(atHalf, atMax, "delay is not constant per attempt");
});

test("the first attempt never waits", () => {
  assert.equal(
    backoffDelayMs(1, policy, () => 0.9999999),
    0,
  );
});

test("backoff is actually applied between attempts", async () => {
  const { slept, deps: d } = deps(() => 0.5);
  await assert.rejects(
    executeWithRetry(
      () => Promise.reject(new ProviderError("transient", "5xx")),
      d,
    ),
  );
  assert.equal(slept.length, policy.maxAttempts - 1, "one sleep per retry");
  assert.deepEqual(slept, [50, 100, 200], "each wait longer than the last");
});
