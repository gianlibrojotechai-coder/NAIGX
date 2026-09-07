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

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  TRACE_DATABASE_URL: "postgresql://u:p@localhost:5432/db_trace",
};

test("accepts a minimal valid environment and applies documented defaults", () => {
  const config = loadConfig(valid);
  assert.equal(config.databaseUrl, valid.DATABASE_URL);
  assert.equal(config.traceDatabaseUrl, valid.TRACE_DATABASE_URL);
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
  assert.throws(() => loadConfig({ ...valid, DATABASE_URL: "   " }));
});

test("rejects a missing TRACE_DATABASE_URL and names the variable", () => {
  assert.throws(
    () => loadConfig({ DATABASE_URL: valid.DATABASE_URL }),
    (error: Error) => error.message.includes("TRACE_DATABASE_URL"),
  );
});

test("rejects a trace URL identical to the primary URL", () => {
  // `DB §1.4` — the trace store is a separate database. One URL for both would
  // silently collapse the retention, access-control and blast-radius
  // separation, and nothing downstream would report the loss.
  assert.throws(
    () =>
      loadConfig({
        DATABASE_URL: valid.DATABASE_URL,
        TRACE_DATABASE_URL: valid.DATABASE_URL,
      }),
    (error: Error) => error.message.includes("separate database"),
  );
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
    assert.ok(
      message.includes("TRACE_DATABASE_URL"),
      "missing TRACE_DATABASE_URL reported",
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

// --- M-19 Phase 2: bind address and proxy trust ---------------------------

test("defaults HOST to every interface and accepts an override", () => {
  // The default is what a container needs; the override is what a bare
  // process sharing a host with its proxy needs.
  assert.equal(loadConfig(valid).host, "0.0.0.0");
  assert.equal(loadConfig({ ...valid, HOST: "127.0.0.1" }).host, "127.0.0.1");
  assert.equal(loadConfig({ ...valid, HOST: "  ::1  " }).host, "::1");
});

test("rejects a blank HOST rather than widening the bind", () => {
  // `HOST=` in a compose file is an unresolved substitution, not a request
  // for the default. Treating it as one would widen the bind in response to a
  // broken configuration — the failure direction that does not announce
  // itself.
  assert.throws(
    () => loadConfig({ ...valid, HOST: "   " }),
    (error: Error) => error.message.includes("HOST"),
  );
});

test("defaults TRUST_PROXY to false — the safe value when unproxied", () => {
  assert.equal(loadConfig(valid).trustProxy, false);
  assert.equal(loadConfig({ ...valid, TRUST_PROXY: "" }).trustProxy, false);
});

test("parses TRUST_PROXY strictly and rejects anything ambiguous", () => {
  for (const raw of ["true", "TRUE", "1"]) {
    assert.equal(
      loadConfig({ ...valid, TRUST_PROXY: raw }).trustProxy,
      true,
      `expected TRUST_PROXY='${raw}' to enable proxy trust`,
    );
  }
  for (const raw of ["false", "False", "0"]) {
    assert.equal(
      loadConfig({ ...valid, TRUST_PROXY: raw }).trustProxy,
      false,
      `expected TRUST_PROXY='${raw}' to disable proxy trust`,
    );
  }

  // ⚠️ THE POINT OF THE STRICT PARSE. A loose "any non-empty string is true"
  // reading turns each of these into `true` — silently, and in the direction
  // that lets a client set its own rate-limit identity.
  for (const raw of ["flase", "yes", "no", "off", "maybe"]) {
    assert.throws(
      () => loadConfig({ ...valid, TRUST_PROXY: raw }),
      (error: Error) => error.message.includes("TRUST_PROXY"),
      `expected TRUST_PROXY='${raw}' to be rejected, not coerced`,
    );
  }
});

test("requires an IP hash salt in production and not outside it", () => {
  // `DB §4.1` / `DB §13`. The development default is a constant in this
  // repository; IPv4 is 2^32 values, so an `ip_hash` salted with it enumerates
  // back to the address and stops being Pseudonymous. Production is the only
  // environment where that default would become the deployed value.
  assert.throws(
    () => loadConfig({ ...valid, NODE_ENV: "production" }),
    (error: Error) => error.message.includes("NAIGX_IP_HASH_SECRET"),
  );
  assert.throws(
    () =>
      loadConfig({
        ...valid,
        NODE_ENV: "production",
        NAIGX_IP_HASH_SECRET: "",
      }),
    (error: Error) => error.message.includes("NAIGX_IP_HASH_SECRET"),
  );

  assert.equal(
    loadConfig({
      ...valid,
      NODE_ENV: "production",
      NAIGX_IP_HASH_SECRET: "a-real-secret",
    }).ipHashSecret,
    "a-real-secret",
  );

  // Development and test need no configuration at all.
  assert.equal(loadConfig(valid).ipHashSecret, undefined);
  assert.equal(
    loadConfig({ ...valid, NODE_ENV: "test" }).ipHashSecret,
    undefined,
  );
});
