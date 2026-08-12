/**
 * Centralised error handling (`API §9.4`, `SA §11.2`).
 *
 * Single exit point for every failed request. Its purpose is twofold: produce
 * the documented error shape, and guarantee that nothing internal escapes.
 *
 * The invariant (`SA §11.2`, invariant 3): full detail goes to the log, and
 * only deliberately-written text reaches the client. An unrecognised error is
 * therefore never described to the caller — it becomes `internal_error` with a
 * fixed message, while the original is logged in full.
 *
 * Correlation headers are set in `onRequest`, so they remain present on error
 * responses without this handler restating them.
 */

import type { FastifyInstance } from "fastify";

import { internalError, isAppError, notFoundError, AppError } from "./errors.js";
import { sendError } from "./responses.js";

/** Fastify surfaces its own errors as `unknown`; narrow before inspecting. */
const statusCodeOf = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const { statusCode } = error as { statusCode?: unknown };

  return typeof statusCode === "number" ? statusCode : undefined;
};

/**
 * Fastify raises client errors of its own — malformed JSON bodies and
 * unsupported content types among them — carrying a 4xx `statusCode`. Passing
 * these through the unknown-error path would report a caller's mistake as a
 * server fault, so 400 is mapped onto the documented validation code. The
 * framework's own message is discarded, not forwarded.
 */
const asClientError = (error: unknown): AppError | undefined => {
  if (statusCodeOf(error) === 400) {
    return new AppError("validation_failed", "The request could not be read.", {
      action: "Check the request format and try again.",
      cause: error,
    });
  }

  return undefined;
};

export function registerErrorHandler(app: FastifyInstance): void {
  // Replaces Fastify's default 404, which names the unmatched route and the
  // framework's own error vocabulary — internal detail by `API §9.5`.
  app.setNotFoundHandler((request, reply) => {
    request.log.info(
      { method: request.method, url: request.url },
      "Route not found",
    );

    return sendError(request, reply, notFoundError());
  });

  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      // Expected and already client-safe: the raiser chose every field.
      request.log.warn(
        { err: error, code: error.code, status: error.status },
        "Request failed",
      );

      return sendError(request, reply, error);
    }

    const clientError = asClientError(error);

    if (clientError !== undefined) {
      request.log.warn({ err: error }, "Malformed request");

      return sendError(request, reply, clientError);
    }

    // Unrecognised. Log everything, disclose nothing.
    request.log.error({ err: error }, "Unhandled error");

    return sendError(request, reply, internalError(error));
  });
}
