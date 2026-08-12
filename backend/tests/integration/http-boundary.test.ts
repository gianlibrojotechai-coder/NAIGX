/**
 * Integration — the HTTP boundary (`Roadmap §6.1`: "Boundary crossings").
 *
 * Exercises the assembled Fastify application through `inject`, so the
 * request-context hook, CORS registration, error handler and route wiring are
 * tested together rather than in isolation. No port is bound and no database
 * is contacted: `buildApp` takes its dependencies as arguments, which is the
 * property that makes this testable at all.
 *
 * Covers the error paths `Roadmap §6.6` makes mandatory.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import { AppError } from "../../src/http/errors.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  port: 0,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

/** Test double. No connection is opened. */
const database = (findFirst: () => Promise<unknown>): Database =>
  ({
    prisma: { healthCheck: { findFirst } },
    disconnect: () => Promise.resolve(),
  }) as unknown as Database;

const build = async (findFirst = () => Promise.resolve(null)) =>
  buildApp({ config, database: database(findFirst) });

test("unmatched route returns the documented error envelope, not Fastify's default", async () => {
  const app = await build();
  const res = await app.inject({ method: "GET", url: "/no-such-route" });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 404);
  assert.equal(body.error.code, "not_found");
  assert.ok(body.error.action.length > 0);
  assert.ok(!res.body.includes("Route GET:/no-such-route not found"));
  await app.close();
});

test("an unrecognised thrown error is sanitised to internal_error", async () => {
  const app = await build();
  app.get("/__boom", () => {
    const error = new Error("connect ECONNREFUSED password=hunter2");
    error.stack = "Error\n    at /internal/secret.ts:42:11";
    throw error;
  });

  const res = await app.inject({ method: "GET", url: "/__boom" });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 500);
  assert.equal(body.error.code, "internal_error");
  for (const leak of ["hunter2", "ECONNREFUSED", "secret.ts", "stack"]) {
    assert.ok(!res.body.includes(leak), `response leaked '${leak}'`);
  }
  await app.close();
});

test("a raised AppError keeps its code, status, field and details", async () => {
  const app = await build();
  app.get("/__app-error", () => {
    throw new AppError("content_too_short", "Input is too short.", {
      action: "Add more detail.",
      field: "content",
      details: { minimum: 50, provided: 23 },
      cause: new Error("INTERNAL: fragment v3"),
    });
  });

  const res = await app.inject({ method: "GET", url: "/__app-error" });
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 400);
  assert.equal(body.error.code, "content_too_short");
  assert.equal(body.error.field, "content");
  assert.deepEqual(body.error.details, { minimum: 50, provided: 23 });
  assert.ok(!res.body.includes("fragment v3"));
  await app.close();
});

test("correlation headers are present on success, 404 and 500 alike", async () => {
  const app = await build();
  app.get("/__boom", () => {
    throw new Error("x");
  });

  for (const url of ["/health", "/no-such-route", "/__boom"]) {
    const res = await app.inject({ method: "GET", url });
    assert.ok(res.headers["x-request-id"], `missing request id on ${url}`);
    assert.ok(
      res.headers["x-correlation-id"],
      `missing correlation id on ${url}`,
    );
  }
  await app.close();
});

test("a supplied correlation id is propagated to headers and error meta", async () => {
  const app = await build();
  const res = await app.inject({
    method: "GET",
    url: "/no-such-route",
    headers: { "x-correlation-id": "incident-2026" },
  });

  assert.equal(res.headers["x-correlation-id"], "incident-2026");
  assert.equal(JSON.parse(res.body).meta.correlation_id, "incident-2026");
  await app.close();
});

test("response meta agrees with the response headers", async () => {
  const app = await build();
  const res = await app.inject({
    method: "GET",
    url: "/no-such-route",
    headers: { "x-request-id": "rid-1", "x-correlation-id": "cid-1" },
  });
  const meta = JSON.parse(res.body).meta;

  assert.equal(meta.request_id, res.headers["x-request-id"]);
  assert.equal(meta.correlation_id, res.headers["x-correlation-id"]);
  await app.close();
});

test("CORS exposes the correlation headers to a browser client", async () => {
  const app = await build();
  const res = await app.inject({
    method: "GET",
    url: "/health",
    headers: { origin: config.corsOrigin },
  });

  assert.equal(res.headers["access-control-allow-origin"], config.corsOrigin);
  const exposed = String(res.headers["access-control-expose-headers"] ?? "");
  assert.match(exposed, /X-Request-Id/i);
  assert.match(exposed, /X-Correlation-Id/i);
  await app.close();
});

test("the app builds without binding a port", async () => {
  const app = await build();
  assert.equal(app.server.listening, false);
  await app.close();
});
