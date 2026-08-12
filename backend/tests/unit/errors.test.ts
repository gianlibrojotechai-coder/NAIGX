/**
 * Unit — error taxonomy and envelope (`API §9.1`–`§9.5`, `API §10.1`).
 *
 * `Roadmap §6.6` makes "all error paths in `API §9.2`" mandatory coverage.
 * The load-bearing assertion here is negative: `cause` and `stack` must be
 * structurally absent from anything serialised to a client (`API §9.5`).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AppError,
  ERROR_STATUS,
  internalError,
  isAppError,
  notFoundError,
} from "../../src/http/errors.js";
import { errorResponse, successResponse } from "../../src/http/responses.js";
import { API_VERSION } from "../../src/http/meta.js";

/** Minimal stand-in for the request fields the meta builder reads. */
const fakeRequest = {
  id: "req-1",
  correlationId: "corr-1",
} as unknown as Parameters<typeof successResponse>[0];

test("every documented API §9.2 code maps to its documented status", () => {
  const expected: Record<string, number> = {
    validation_failed: 400,
    content_too_short: 400,
    content_too_long: 400,
    unsupported_file_type: 400,
    file_too_large: 400,
    unauthenticated: 401,
    invalid_credentials: 401,
    invalid_token: 401,
    token_expired: 401,
    token_reused: 401,
    forbidden: 403,
    anonymous_limit_reached: 403,
    operator_only: 403,
    not_found: 404,
    email_in_use: 409,
    invalid_state: 409,
    expired: 410,
    unsupported_input_type: 422,
    insufficient_context: 422,
    rate_limited: 429,
    internal_error: 500,
    service_unavailable: 503,
    analysis_timeout: 504,
  };
  assert.deepEqual({ ...ERROR_STATUS }, expected);
});

test("the two domain refusals are 422, not 400 or 500 (`API §9.3`)", () => {
  assert.equal(ERROR_STATUS.unsupported_input_type, 422);
  assert.equal(ERROR_STATUS.insufficient_context, 422);
});

test("AppError derives status from its code", () => {
  assert.equal(new AppError("not_found", "x").status, 404);
  assert.equal(new AppError("rate_limited", "x").status, 429);
});

test("isAppError distinguishes AppError from a plain Error", () => {
  assert.ok(isAppError(new AppError("not_found", "x")));
  assert.ok(!isAppError(new Error("plain")));
  assert.ok(!isAppError(undefined));
});

test("framework errors carry an action (`FR-090`)", () => {
  assert.ok((notFoundError().action ?? "").length > 0);
  assert.ok((internalError(new Error("boom")).action ?? "").length > 0);
});

test("internalError keeps the cause off the client surface", () => {
  const secret = new Error("connect ECONNREFUSED password=hunter2");
  const body = errorResponse(fakeRequest, internalError(secret));
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes("hunter2"));
  assert.ok(!serialized.includes("ECONNREFUSED"));
  assert.ok(!serialized.includes("stack"));
  assert.equal(body.error.message, "Something went wrong on our side.");
});

test("error envelope carries only the client-safe surface", () => {
  const error = new AppError("content_too_short", "Input is too short.", {
    action: "Add more detail.",
    field: "content",
    details: { minimum: 50, provided: 23 },
    cause: new Error("INTERNAL: fragment v3"),
  });
  const body = errorResponse(fakeRequest, error);

  assert.deepEqual(body.error, {
    code: "content_too_short",
    message: "Input is too short.",
    action: "Add more detail.",
    field: "content",
    details: { minimum: 50, provided: 23 },
  });
  assert.ok(!JSON.stringify(body).includes("fragment v3"));
});

test("optional error fields are omitted rather than set to undefined", () => {
  const body = errorResponse(fakeRequest, new AppError("not_found", "gone"));
  assert.ok(!("action" in body.error));
  assert.ok(!("field" in body.error));
  assert.ok(!("details" in body.error));
});

test("both envelopes carry the same meta block (`API §10.1`)", () => {
  for (const body of [
    successResponse(fakeRequest, { example: true }),
    errorResponse(fakeRequest, notFoundError()),
  ]) {
    assert.equal(body.meta.request_id, "req-1");
    assert.equal(body.meta.correlation_id, "corr-1");
    assert.equal(body.meta.api_version, API_VERSION);
    assert.match(body.meta.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  }
});

test("success envelope nests payload under `data`", () => {
  const body = successResponse(fakeRequest, { example: true });
  assert.deepEqual(body.data, { example: true });
});
