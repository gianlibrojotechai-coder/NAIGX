/**
 * Unit — correlation identifier resolution (`API §10.4`, `NFR-080`).
 *
 * A validation class under `Roadmap §6.6`. These values reach log output, so
 * the sanitisation here is a log-forging control, not cosmetics.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  resolveCorrelationId,
  resolveRequestId,
} from "../../src/http/request-context.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("generates a UUID when no identifier is supplied", () => {
  assert.match(resolveRequestId({}), UUID);
  assert.match(resolveCorrelationId({}), UUID);
});

test("generated identifiers are unique per call", () => {
  const ids = new Set(Array.from({ length: 50 }, () => resolveRequestId({})));
  assert.equal(ids.size, 50);
});

test("propagates a supplied identifier unchanged", () => {
  assert.equal(
    resolveRequestId({ [REQUEST_ID_HEADER]: "req-abc-123" }),
    "req-abc-123",
  );
  assert.equal(
    resolveCorrelationId({ [CORRELATION_ID_HEADER]: "analysis-42" }),
    "analysis-42",
  );
});

test("the two identifiers are resolved independently", () => {
  const headers = { [CORRELATION_ID_HEADER]: "corr-1" };
  assert.equal(resolveCorrelationId(headers), "corr-1");
  assert.match(resolveRequestId(headers), UUID);
});

test("rejects unsafe values and substitutes a generated identifier", () => {
  const unsafe = [
    "has spaces",
    "line\nbreak", // log forging
    "carriage\rreturn",
    "tab\there",
    "a".repeat(129), // over the length bound
    "",
    "  ",
    "semi;colon",
    "quote'mark",
  ];
  for (const value of unsafe) {
    const resolved = resolveRequestId({ [REQUEST_ID_HEADER]: value });
    assert.notEqual(resolved, value, `expected '${value}' to be rejected`);
    assert.match(resolved, UUID);
  }
});

test("accepts the documented safe character set and length bound", () => {
  for (const value of [
    "abcXYZ012",
    "with-hyphen",
    "with_underscore",
    "with.dot",
    "with:colon",
    "a".repeat(128), // exactly at the bound
  ]) {
    assert.equal(resolveRequestId({ [REQUEST_ID_HEADER]: value }), value);
  }
});

test("trims surrounding whitespace before validating", () => {
  assert.equal(resolveRequestId({ [REQUEST_ID_HEADER]: "  req-1  " }), "req-1");
});

test("narrows a repeated header to its first occurrence", () => {
  assert.equal(
    resolveRequestId({ [REQUEST_ID_HEADER]: ["first", "second"] }),
    "first",
  );
});
