/**
 * Contract — `GET /health` (`API-060`, `API §6.7`).
 *
 * These assertions pinned the pre-`API-060` body until now; the endpoint has
 * since been brought to the specified contract, so they pin that instead.
 *
 * `API-060` acceptance: "Readiness includes database reachability, provider
 * reachability, and template loadability — an instance that cannot reason must
 * not receive traffic. Liveness never depends on external services. No internal
 * detail, version, or provider name exposed on an unauthenticated endpoint."
 *
 * No network, no credential, no database: every probe is injected.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  spend: { reserveUsdPerAnalysis: "0.30" },
  port: 0,
  host: "127.0.0.1",
  trustProxy: false,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const ok = () => Promise.resolve();
const fail = (why: string) => () => Promise.reject(new Error(why));

const build = async (
  overrides: {
    findFirst?: () => Promise<unknown>;
    checkProvider?: () => Promise<void>;
    checkTemplates?: () => Promise<void>;
    checkSchemas?: () => Promise<void>;
  } = {},
) =>
  buildApp({
    config,
    database: {
      prisma: {
        healthCheck: {
          findFirst: overrides.findFirst ?? (() => Promise.resolve(null)),
        },
      },
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    checkProvider: overrides.checkProvider ?? ok,
    checkTemplates: overrides.checkTemplates ?? ok,
    // D-89: the artifact-schema probe is a fourth dependency.
    checkSchemas: overrides.checkSchemas ?? ok,
  });

// --- readiness -----------------------------------------------------------

test("readiness reports all four dependencies when healthy", async () => {
  const app = await build();
  const res = await app.inject({
    method: "GET",
    url: "/health?check=readiness",
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    status: "ok",
    database: "connected",
    dependencies: {
      database: "available",
      provider: "available",
      templates: "available",
      schemas: "available",
    },
  });
  await app.close();
});

test("readiness is the default when no check is named", async () => {
  const app = await build();
  const res = await app.inject({ method: "GET", url: "/health" });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).dependencies.provider, "available");
  // The existing client reads this field; keeping it is compatible with
  // `API-060`, which forbids a version, an app name and a provider name.
  assert.equal(JSON.parse(res.body).database, "connected");
  await app.close();
});

test("an unreachable provider makes the instance not ready (503)", async () => {
  // The requirement this task exists for: "an instance that cannot reason must
  // not receive traffic".
  const app = await build({ checkProvider: fail("connect ECONNREFUSED") });
  const res = await app.inject({
    method: "GET",
    url: "/health?check=readiness",
  });

  assert.equal(res.statusCode, 503);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "error");
  assert.equal(body.dependencies.provider, "unavailable");
  assert.equal(body.dependencies.database, "available");
  await app.close();
});

test("an unconfigured provider is not ready either", async () => {
  // No probe supplied means nothing is configured to reason with.
  const app = await buildApp({
    config,
    database: {
      prisma: { healthCheck: { findFirst: () => Promise.resolve(null) } },
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    checkTemplates: ok,
  });
  const res = await app.inject({
    method: "GET",
    url: "/health?check=readiness",
  });
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).dependencies.provider, "unavailable");
  await app.close();
});

test("unloadable templates make the instance not ready", async () => {
  const app = await build({ checkTemplates: fail("no active version") });
  const res = await app.inject({
    method: "GET",
    url: "/health?check=readiness",
  });
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).dependencies.templates, "unavailable");
  await app.close();
});

test("an unreachable database still makes the instance not ready", async () => {
  const app = await build({
    findFirst: () => Promise.reject(new Error("ECONNREFUSED")),
  });
  const res = await app.inject({
    method: "GET",
    url: "/health?check=readiness",
  });
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).dependencies.database, "unavailable");
  await app.close();
});

// --- liveness ------------------------------------------------------------

test("liveness never depends on an external service", async () => {
  // Every dependency is broken. Liveness must still answer 200: a liveness
  // probe that consults them would restart a healthy instance during an outage.
  const app = await build({
    findFirst: () => Promise.reject(new Error("ECONNREFUSED")),
    checkProvider: fail("unreachable"),
    checkTemplates: fail("unreachable"),
  });
  const res = await app.inject({
    method: "GET",
    url: "/health?check=liveness",
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { status: "ok" });
  await app.close();
});

// --- disclosure ----------------------------------------------------------

test("no version, app name or provider identity is exposed", async () => {
  // `API-060`: "No internal detail, version, or provider name exposed on an
  // unauthenticated endpoint." The `app` and `version` fields this endpoint
  // used to return are gone for exactly this reason.
  for (const url of [
    "/health",
    "/health?check=liveness",
    "/health?check=readiness",
  ]) {
    const app = await build();
    const res = await app.inject({ method: "GET", url });
    const body = res.body.toLowerCase();

    for (const leak of ["version", "0.1.0", "naigx", "anthropic", "claude"]) {
      assert.ok(!body.includes(leak), `${url} must not expose "${leak}"`);
    }
    await app.close();
  }
});

test("a failing dependency reports its role, never the reason", async () => {
  // The underlying error goes to the log; the unauthenticated body says only
  // that a dependency is unavailable (`AI-006`, `FR-093`).
  const app = await build({
    checkProvider: fail("anthropic: 401 invalid key sk-ant-EXAMPLE"),
  });
  const res = await app.inject({
    method: "GET",
    url: "/health?check=readiness",
  });

  assert.equal(res.statusCode, 503);
  const body = res.body.toLowerCase();
  for (const leak of ["anthropic", "sk-ant", "401", "invalid key"]) {
    assert.ok(!body.includes(leak), `the body must not contain "${leak}"`);
  }
  assert.equal(JSON.parse(res.body).dependencies.provider, "unavailable");
  await app.close();
});

test("the 503 path is not rewritten by the centralized error handler", async () => {
  const app = await build({
    findFirst: () => Promise.reject(new Error("boom")),
  });
  const body = JSON.parse(
    (await app.inject({ method: "GET", url: "/health" })).body,
  );
  assert.equal(body.status, "error");
  assert.ok(
    body.dependencies,
    "the health body survives, not an error envelope",
  );
  await app.close();
});
