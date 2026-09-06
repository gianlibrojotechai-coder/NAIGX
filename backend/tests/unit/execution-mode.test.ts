/**
 * Unit — execution mode selection.
 *
 * The property under test is a financial one: **nothing reaches a paid
 * provider by omission.** An unset variable, an empty string, a stray typo —
 * every path that is not the exact word `live` must resolve to replay or
 * refuse outright.
 *
 * Pure and environment-free by construction: `resolveExecutionMode` reads no
 * `process.env`, so this suite cannot be made to select `live` by a credential
 * that happens to exist on a developer's machine or in CI.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_EXECUTION_MODE,
  ExecutionModeError,
  isMetered,
  resolveExecutionMode,
} from "../../src/orchestrator/execution-mode.js";

const withCredentials = { hasProviderCredentials: true };
const withoutCredentials = { hasProviderCredentials: false };

// --- the default is free -------------------------------------------------

test("replay is the default, and the default is not metered", () => {
  assert.equal(DEFAULT_EXECUTION_MODE, "replay");
  assert.equal(isMetered("replay"), false);
  assert.equal(isMetered("live"), true);
});

test("an absent or empty mode resolves to replay, credentials or not", () => {
  for (const requested of [undefined, "", "   "]) {
    assert.equal(
      resolveExecutionMode({ requested, ...withCredentials }),
      "replay",
      "a configured credential must not select live on its own",
    );
    assert.equal(
      resolveExecutionMode({ requested, ...withoutCredentials }),
      "replay",
    );
  }
});

// --- live is opt-in and exact --------------------------------------------

test("live is selected only by the exact word, and only with credentials", () => {
  assert.equal(
    resolveExecutionMode({ requested: "live", ...withCredentials }),
    "live",
  );
  assert.equal(
    resolveExecutionMode({ requested: "  LIVE  ", ...withCredentials }),
    "live",
    "trimmed and case-insensitive, but still the whole word",
  );
});

test("a typo is refused rather than guessed at", () => {
  for (const requested of ["liv", "live-mode", "production", "real", "1"]) {
    assert.throws(
      () => resolveExecutionMode({ requested, ...withCredentials }),
      ExecutionModeError,
      `"${requested}" must not resolve to anything`,
    );
  }
});

// --- neither mode falls back to the other --------------------------------

test("live without credentials refuses; it never downgrades to replay", () => {
  try {
    resolveExecutionMode({ requested: "live", ...withoutCredentials });
    assert.fail("expected a refusal, but a mode was returned");
  } catch (error) {
    assert.ok(error instanceof ExecutionModeError);
    assert.match(error.message, /will not silently downgrade/);
  }
});

test("replay never escalates to live", () => {
  assert.equal(
    resolveExecutionMode({ requested: "replay", ...withCredentials }),
    "replay",
    "credentials present, replay requested — replay wins",
  );
});
