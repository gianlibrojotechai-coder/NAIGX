/**
 * `API-025` — the event stream is served to a credential presented as a
 * header ([D-74](../../../docs/49-D-74-Authenticated-Event-Stream.md)).
 *
 * The frontend used `EventSource`, which cannot set `Authorization`, so an
 * owned analysis could never be streamed to its owner. D-74 moves the client
 * to `fetch` with the same header every other request sends. Nothing on the
 * server changed for that — which is exactly what these tests pin: the route
 * authenticates from the header, refuses without it, and resumes from
 * `Last-Event-ID`. If any of those stopped being true the client would fall
 * back to polling silently, and `FR-041` would degrade without a failing test.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import { createAnalysisEventLog } from "../../src/events/analysis-event-log.js";
import { generateToken, hashToken } from "../../src/auth/tokens.js";
import type { AnalysisEvent } from "../../src/nie/events.js";
import {
  anonymousCredential,
  anonymousLookup,
  noSessions,
} from "../helpers/anonymous-principal.js";

const ANALYSIS_ID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const OWNER_ID = "cccccccc-3333-4333-8333-cccccccccccc";

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

const classification: AnalysisEvent = {
  type: "classification",
  determinedType: "business_requirement",
  confidence: 0.9,
  candidateTypes: ["business_requirement"],
  wasLowConfidence: false,
};

const complete: AnalysisEvent = {
  type: "complete",
  status: "completed",
  degraded: false,
  timedOut: false,
  artifactCounts: { generated: 2, failed: 0, omitted: 0 },
};

/** A log holding a finished analysis: classification, then the terminal event. */
const finishedLog = () => {
  const eventLog = createAnalysisEventLog();
  eventLog.open(ANALYSIS_ID);
  eventLog.publish(ANALYSIS_ID, classification);
  eventLog.publish(ANALYSIS_ID, complete);
  return eventLog;
};

const streamApp = async (options: {
  readonly owner: "anonymous" | "user";
  readonly sessionToken?: string;
}) => {
  const anonymous = anonymousCredential();
  const sessionToken = options.sessionToken ?? generateToken();
  const prisma = {
    healthCheck: { findFirst: () => Promise.resolve(null) },
    session:
      options.owner === "user"
        ? {
            findFirst: ({ where }: { where: { tokenHash: string } }) =>
              Promise.resolve(
                where.tokenHash === hashToken(sessionToken)
                  ? { sessionId: "session-1", userId: OWNER_ID }
                  : null,
              ),
          }
        : noSessions,
    analysis: {
      findUnique: () =>
        Promise.resolve({
          status: "completed",
          userId: options.owner === "user" ? OWNER_ID : null,
        }),
      ...anonymousLookup(anonymous, {
        analysisId: ANALYSIS_ID,
        userId: options.owner === "user" ? OWNER_ID : null,
      }),
    },
  };

  const app = await buildApp({
    config,
    database: {
      prisma,
      disconnect: () => Promise.resolve(),
    } as unknown as Database,
    eventLog: finishedLog(),
  });
  return { app, anonymous, sessionToken };
};

const stream = (
  app: Awaited<ReturnType<typeof streamApp>>["app"],
  headers: Record<string, string>,
) =>
  app.inject({
    method: "GET",
    url: `/analyses/${ANALYSIS_ID}/events`,
    headers,
  });

test("an owned analysis streams to its owner's session token in the Authorization header", async () => {
  const { app, sessionToken } = await streamApp({ owner: "user" });
  const res = await stream(app, {
    authorization: `Bearer ${sessionToken}`,
    accept: "text/event-stream",
  });

  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers["content-type"]), /text\/event-stream/);
  // Every frame carries the sequence the client resumes from (`API-025`).
  assert.match(res.body, /^id: 1\nevent: classification\ndata: /m);
  assert.match(res.body, /^id: 2\nevent: complete\ndata: /m);
});

test("an owned analysis is refused to a request with no credential", async () => {
  const { app } = await streamApp({ owner: "user" });
  const res = await stream(app, { accept: "text/event-stream" });

  // 404, not 401/403: `requireAccess` answers "does not exist" rather than
  // "not yours", so an unauthenticated caller learns nothing about which ids
  // are real. Either way it is not 200 and not a stream — the client closes
  // and the poll takes over.
  assert.equal(res.statusCode, 404, res.body);
  assert.doesNotMatch(String(res.headers["content-type"]), /event-stream/);
});

test("an owned analysis is refused to another account's anonymous token", async () => {
  const { app } = await streamApp({ owner: "user" });
  const stranger = anonymousCredential();
  const res = await stream(app, {
    ...stranger.header,
    accept: "text/event-stream",
  });

  assert.equal(res.statusCode, 404, res.body);
  assert.doesNotMatch(String(res.headers["content-type"]), /event-stream/);
});

test("an anonymous analysis still streams to its anonymous token (API §7.8)", async () => {
  const { app, anonymous } = await streamApp({ owner: "anonymous" });
  const res = await stream(app, {
    ...anonymous.header,
    accept: "text/event-stream",
  });

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /^event: classification$/m);
  assert.match(res.body, /^event: complete$/m);
});

test("a cross-origin stream carries the CORS headers the rest of the API sends", async () => {
  // The route writes to the raw response, which skips Fastify's reply headers
  // unless they are carried across. Without them a browser on the configured
  // origin fetches the frames and then refuses to read them.
  const { app, sessionToken } = await streamApp({ owner: "user" });
  const res = await stream(app, {
    authorization: `Bearer ${sessionToken}`,
    accept: "text/event-stream",
    origin: config.corsOrigin,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(
    res.headers["access-control-allow-origin"],
    config.corsOrigin,
    "the CORS allow-origin header reaches the raw stream response",
  );
  assert.match(String(res.headers["content-type"]), /text\/event-stream/);
});

test("Last-Event-ID resumes after the frame the client already has", async () => {
  const { app, sessionToken } = await streamApp({ owner: "user" });
  const res = await stream(app, {
    authorization: `Bearer ${sessionToken}`,
    accept: "text/event-stream",
    "last-event-id": "1",
  });

  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(res.body, /^event: classification$/m);
  assert.match(res.body, /^id: 2\nevent: complete$/m);
});
