/**
 * Response envelopes (`API §9.1`, `API §10.1`).
 *
 *   success  { data, meta }
 *   error    { error, meta }
 *
 * `meta` appears on both, so a client has one uniform diagnostic path
 * regardless of outcome.
 *
 * NOTE: `/health` deliberately does not use these helpers. It predates the
 * envelope, its current body is depended upon by the frontend, and changing it
 * belongs with the `API-060` work rather than here.
 */

import type { FastifyReply, FastifyRequest } from "fastify";

import type { AppError, ApiErrorCode } from "./errors.js";
import { buildMeta } from "./meta.js";
import type { ResponseMeta } from "./meta.js";

/**
 * `data` is constrained to an object because `API §10.1` requires it: a bare
 * value or array leaves no room to add fields alongside it later without a
 * breaking change. Collections use the `{ items, pagination }` shape from
 * `API §10.2` inside `data`.
 */
export interface SuccessResponse<T extends object> {
  readonly data: T;
  readonly meta: ResponseMeta;
}

export interface ErrorBody {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly action?: string;
  readonly field?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ErrorResponse {
  readonly error: ErrorBody;
  readonly meta: ResponseMeta;
}

export function successResponse<T extends object>(
  request: FastifyRequest,
  data: T,
): SuccessResponse<T> {
  return { data, meta: buildMeta(request) };
}

/**
 * Serialises only the client-safe surface of an `AppError`. `cause`, `stack`,
 * and `name` are structurally absent rather than filtered — there is no path
 * by which they can reach a client (`API §9.5`).
 */
export function errorResponse(
  request: FastifyRequest,
  error: AppError,
): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.action !== undefined && { action: error.action }),
      ...(error.field !== undefined && { field: error.field }),
      ...(error.details !== undefined && { details: error.details }),
    },
    meta: buildMeta(request),
  };
}

export function sendSuccess<T extends object>(
  request: FastifyRequest,
  reply: FastifyReply,
  data: T,
  status = 200,
): FastifyReply {
  return reply.code(status).send(successResponse(request, data));
}

export function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: AppError,
): FastifyReply {
  return reply.code(error.status).send(errorResponse(request, error));
}
