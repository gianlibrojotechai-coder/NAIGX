/**
 * Response metadata (`API §9.1`, `API §10.1`).
 *
 * Every response — success or error — carries the same `meta` block, giving
 * clients one uniform diagnostic path. The identifiers are read from the
 * request context established in `request-context.ts`; this module deliberately
 * generates no identifiers of its own, so a response and its headers always
 * quote the same values.
 */

import type { FastifyRequest } from "fastify";

/**
 * API contract version (`API §4.1`). Distinct from the application version:
 * this changes only on a breaking contract change, never on a release.
 */
export const API_VERSION = "v1";

export interface ResponseMeta {
  readonly request_id: string;
  readonly correlation_id: string;
  readonly api_version: string;
  readonly timestamp: string;
}

/**
 * ISO 8601, UTC, `Z` suffix (`API §10.3`), at second precision to match the
 * shape published in the specification examples.
 */
const timestamp = (): string =>
  new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export function buildMeta(request: FastifyRequest): ResponseMeta {
  return {
    request_id: request.id,
    correlation_id: request.correlationId,
    api_version: API_VERSION,
    timestamp: timestamp(),
  };
}
