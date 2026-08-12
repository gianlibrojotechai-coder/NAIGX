/**
 * Contract — `GET /health` (`Roadmap §6.1`: "API request/response").
 *
 * The frontend consumes this endpoint's exact shape, so these assertions exist
 * to make an accidental change to it fail loudly rather than reach a client.
 *
 * ⚠️ This endpoint deliberately does **not** use the `API §10.1` envelope. It
 * predates the envelope and its body is depended upon; `API-060` conformance
 * (the `?check=liveness|readiness` parameter, and removing internal detail from
 * an unauthenticated response) is recorded as deferred in
 * `src/routes/health.ts`. These tests pin the contract as it stands today, not
 * as `API-060` will eventually require.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  port: 0,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const build = async (findFirst: () => Promise<unknown>) =>
  buildApp({
    config,
    database: {
      prisma: { healthCheck: { findFirst } },
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
  });

test("returns the exact documented body when the database is reachable", async () => {
  const app = await build(() => Promise.resolve(null));
  const res = await app.inject({ method: "GET", url: "/health" });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    status: "ok",
    app: "NAIGX",
    version: "0.1.0",
    database: "connected",
  });
  await app.close();
});

test("returns 503 with the exact documented body when the database is unreachable", async () => {
  const app = await build(() => Promise.reject(new Error("ECONNREFUSED")));
  const res = await app.inject({ method: "GET", url: "/health" });

  assert.equal(res.statusCode, 503);
  assert.deepEqual(JSON.parse(res.body), {
    status: "error",
    app: "NAIGX",
    version: "0.1.0",
    database: "disconnected",
  });
  await app.close();
});

test("the 503 path is not rewritten by the centralized error handler", async () => {
  const app = await build(() => Promise.reject(new Error("boom")));
  const body = JSON.parse(
    (await app.inject({ method: "GET", url: "/health" })).body,
  );

  assert.ok(!("error" in body), "health must not adopt the error envelope");
  assert.ok(!("meta" in body));
  await app.close();
});

test("the database failure reason never reaches the client", async () => {
  const app = await build(() =>
    Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:5432 pw=hunter2")),
  );
  const res = await app.inject({ method: "GET", url: "/health" });

  assert.ok(!res.body.includes("hunter2"));
  assert.ok(!res.body.includes("5432"));
  await app.close();
});

test("the frontend's required fields are all present and typed as strings", async () => {
  const app = await build(() => Promise.resolve(null));
  const body = JSON.parse((await app.inject({ url: "/health" })).body);

  for (const field of ["status", "app", "version", "database"]) {
    assert.equal(typeof body[field], "string", `${field} must be a string`);
  }
  await app.close();
});
