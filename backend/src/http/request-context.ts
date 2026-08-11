/**
 * Request context — correlation infrastructure (`API §10.4`).
 *
 * Establishes two identifiers on every request, for every current and future
 * route:
 *
 *   - `X-Request-Id`     identifies a single HTTP request
 *   - `X-Correlation-Id` spans a sequence of related requests (`NFR-080`)
 *
 * A client may supply either. Supplied values are accepted only when they
 * match a conservative safe format; anything else is replaced with a generated
 * identifier rather than rejected, because these headers are diagnostic
 * infrastructure and must never be the reason a request fails.
 *
 * Validation is not cosmetic: these values reach log output, so an
 * unconstrained header would allow log forging via injected newlines
 * (`SA §12.2`).
 *
 * The request identifier is produced through Fastify's `genReqId`, which makes
 * the value returned in `X-Request-Id` the same value the logger emits as
 * `reqId` — logs and clients therefore reference one identifier.
 *
 * This module deliberately implements headers and request decoration only. The
 * `meta.request_id` / `meta.correlation_id` response envelope (`API §10.1`)
 * and the error shape (`API §9.1`) are separate concerns, not yet implemented.
 */

import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";

import type { FastifyInstance } from "fastify";

export const REQUEST_ID_HEADER = "x-request-id";
export const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Accepted shape for a client-supplied identifier: URL-safe characters plus
 * the separators common to tracing formats, bounded in length.
 */
const SAFE_IDENTIFIER = /^[A-Za-z0-9._:-]{1,128}$/;

declare module "fastify" {
  interface FastifyRequest {
    /** Spans a sequence of related requests (`API §10.4`, `NFR-080`). */
    correlationId: string;
  }
}

/**
 * Returns the header value when present and safe, otherwise `undefined`.
 * Repeated headers are narrowed to the first occurrence.
 */
const readSafeHeader = (
  headers: IncomingHttpHeaders,
  name: string,
): string | undefined => {
  const raw = headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  return SAFE_IDENTIFIER.test(trimmed) ? trimmed : undefined;
};

export const resolveRequestId = (headers: IncomingHttpHeaders): string =>
  readSafeHeader(headers, REQUEST_ID_HEADER) ?? randomUUID();

export const resolveCorrelationId = (headers: IncomingHttpHeaders): string =>
  readSafeHeader(headers, CORRELATION_ID_HEADER) ?? randomUUID();

/**
 * Fastify `genReqId` implementation. Seeds `request.id` — and therefore the
 * logger's `reqId` — from the incoming header when one is usable.
 */
export const generateRequestId = (request: IncomingMessage): string =>
  resolveRequestId(request.headers);

/**
 * Applies correlation handling to the root instance.
 *
 * Registered on the root rather than as an encapsulated plugin so that hooks
 * and decorators are inherited by every route context, present and future.
 * Headers are set in `onRequest` so they are returned on every response —
 * including errors and unmatched routes — not only on successful handlers.
 */
export function registerRequestContext(app: FastifyInstance): void {
  app.decorateRequest("correlationId", "");

  app.addHook("onRequest", async (request, reply) => {
    request.correlationId = resolveCorrelationId(request.headers);

    reply.header("X-Request-Id", request.id);
    reply.header("X-Correlation-Id", request.correlationId);
  });
}
