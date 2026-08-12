/**
 * Unit — configuration validation.
 *
 * `Roadmap §6.6` makes "all validation classes" mandatory coverage. Config
 * validation is the gate between a malformed environment and a running
 * process, and its whole purpose is to fail fast rather than surface later as
 * an obscure runtime error.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "../../src/config/env.js";

const valid = { DATABASE_URL: "postgresql://u:p@localhost:5432/db" };

test("accepts a minimal valid environment and applies documented defaults", () => {
  const config = loadConfig(valid);
  assert.equal(config.databaseUrl, valid.DATABASE_URL);
  assert.equal(config.port, 3000);
  assert.equal(config.corsOrigin, "http://localhost:5173");
  assert.equal(config.logLevel, "info");
});

test("rejects a missing DATABASE_URL and names the variable", () => {
  assert.throws(
    () => loadConfig({}),
    (error: Error) => error.message.includes("DATABASE_URL"),
  );
});

test("rejects a blank DATABASE_URL — whitespace is not a value", () => {
  assert.throws(() => loadConfig({ DATABASE_URL: "   " }));
});

test("reports every problem at once, not just the first", () => {
  try {
    loadConfig({ PORT: "abc", LOG_LEVEL: "chatty" });
    assert.fail("expected loadConfig to throw");
  } catch (error) {
    const message = (error as Error).message;
    assert.ok(
      message.includes("DATABASE_URL"),
      "missing DATABASE_URL reported",
    );
    assert.ok(message.includes("PORT"), "invalid PORT reported");
    assert.ok(message.includes("LOG_LEVEL"), "invalid LOG_LEVEL reported");
  }
});

test("rejects out-of-range and non-integer ports", () => {
  for (const port of ["0", "65536", "-1", "abc", "3.5"]) {
    assert.throws(
      () => loadConfig({ ...valid, PORT: port }),
      (error: Error) => error.message.includes("PORT"),
      `expected PORT='${port}' to be rejected`,
    );
  }
});

test("accepts boundary ports", () => {
  assert.equal(loadConfig({ ...valid, PORT: "1" }).port, 1);
  assert.equal(loadConfig({ ...valid, PORT: "65535" }).port, 65535);
});

test("accepts every documented log level and rejects others", () => {
  for (const level of [
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]) {
    assert.equal(loadConfig({ ...valid, LOG_LEVEL: level }).logLevel, level);
  }
  assert.throws(() => loadConfig({ ...valid, LOG_LEVEL: "verbose" }));
});

test("treats empty optional values as absent rather than invalid", () => {
  const config = loadConfig({
    ...valid,
    PORT: "",
    CORS_ORIGIN: "",
    LOG_LEVEL: "",
  });
  assert.equal(config.port, 3000);
  assert.equal(config.corsOrigin, "http://localhost:5173");
  assert.equal(config.logLevel, "info");
});
