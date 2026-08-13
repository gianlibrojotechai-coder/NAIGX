/**
 * Unit — response normalization and the composed abstraction layer
 * (`AI §10.1`, `§10.4`, `SA §3.5`).
 *
 * Two boundaries matter here. Outward: everything the layer throws carries one
 * of the four `AI §10.4` classes and no provider detail (`FR-093`, `AI-006`).
 * Inward: a trace-write failure never fails a provider call (`DB §6.2`).
 *
 * Runs entirely offline — no database, no network, no credentials.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ProviderError,
  type CapabilityRequest,
  type CapabilityResponse,
  type ProviderAdapter,
} from "../../src/provider/capability.js";
import type { TokenRate } from "../../src/provider/cost.js";
import {
  normalizeError,
  normalizeResponse,
} from "../../src/provider/normalization.js";
import {
  createProviderInvoker,
  type ProviderInvocationRecord,
} from "../../src/provider/invoke.js";
import { createStubProvider } from "../../src/provider/adapters/stub.js";

const rate: TokenRate = {
  inputUsdPerMillionTokens: "3.00",
  outputUsdPerMillionTokens: "15.00",
};

const request: CapabilityRequest = {
  task: "classification",
  input: "Invoices arrive by email and are keyed into the ledger by hand.",
  preferLowVariance: true,
};

const context = {
  stageTraceId: "11111111-1111-4111-8111-111111111111",
  modelVersionId: "22222222-2222-4222-8222-222222222222",
  modelKey: "stub-model",
};

const wellFormed: CapabilityResponse = {
  output: "ok",
  usage: { inputTokens: 10, outputTokens: 20, latencyMs: 5 },
  degradations: [],
};

const adapterReturning = (
  values: readonly unknown[],
): { adapter: ProviderAdapter; calls: () => number } => {
  let call = 0;
  return {
    calls: () => call,
    adapter: {
      capabilities: {
        structuredOutput: false,
        extendedContext: false,
        lowVarianceSampling: true,
        costLatencyTier: "test",
      },
      invoke: () => {
        const value = values[Math.min(call, values.length - 1)];
        call += 1;
        return value instanceof Error
          ? Promise.reject(value)
          : Promise.resolve(value as CapabilityResponse);
      },
    },
  };
};

const collectingRecorder = () => {
  const records: ProviderInvocationRecord[] = [];
  return {
    records,
    recorder: {
      record: (r: ProviderInvocationRecord) => {
        records.push(r);
        return Promise.resolve();
      },
    },
  };
};

const noWait = {
  sleep: () => Promise.resolve(),
  random: () => 0,
};

// --- normalization -------------------------------------------------------

test("a well-formed adapter response passes normalization unchanged", () => {
  assert.deepEqual(normalizeResponse(wellFormed), wellFormed);
});

test("structurally invalid responses become malformed_response", () => {
  const cases: readonly [string, unknown][] = [
    ["null", null],
    ["a string", "not an object"],
    ["missing output", { usage: wellFormed.usage, degradations: [] }],
    ["non-string output", { ...wellFormed, output: 42 }],
    ["missing usage", { output: "x", degradations: [] }],
    [
      "negative tokens",
      { ...wellFormed, usage: { ...wellFormed.usage, inputTokens: -1 } },
    ],
    [
      "fractional tokens",
      { ...wellFormed, usage: { ...wellFormed.usage, outputTokens: 1.5 } },
    ],
    ["missing degradations", { output: "x", usage: wellFormed.usage }],
    ["non-string degradations", { ...wellFormed, degradations: [1] }],
  ];
  for (const [label, value] of cases) {
    assert.throws(
      () => normalizeResponse(value),
      (error: unknown) =>
        error instanceof ProviderError &&
        error.failureClass === "malformed_response",
      `expected ${label} to normalize to malformed_response`,
    );
  }
});

test("an adapter's own classification is preserved, not overwritten", () => {
  const original = new ProviderError("transient", "rate limited");
  assert.equal(normalizeError(original), original);
});

test("an unclassified throwable becomes persistent, not retryable", () => {
  // No document classifies an unclassified adapter failure (`docs/12` D-10).
  // Treating it as transient would invent permission to retry a bug.
  const normalized = normalizeError(
    new TypeError("undefined is not a function"),
  );
  assert.ok(normalized instanceof ProviderError);
  assert.equal(normalized.failureClass, "persistent");
  assert.equal(normalized.cause instanceof TypeError, true);
});

test("normalization never carries provider detail on its message surface", () => {
  const normalized = normalizeError(new Error("openai: 401 invalid api key"));
  assert.ok(
    !/openai/i.test(normalized.message),
    "provider identity must not reach the normalized message (`AI-006`, `FR-093`)",
  );
});

// --- composed layer ------------------------------------------------------

test("a successful call returns the response and records one invocation", async () => {
  const { adapter } = adapterReturning([wellFormed]);
  const { records, recorder } = collectingRecorder();
  let clock = 1000;

  const invoker = createProviderInvoker({
    adapter,
    rate,
    recorder,
    ...noWait,
    now: () => (clock += 25),
  });

  const response = await invoker.invoke(request, context);
  assert.equal(response.output, "ok");
  assert.equal(records.length, 1);

  const record = records[0];
  assert.ok(record);
  assert.equal(record.outcome, "success");
  assert.equal(record.errorClass, null);
  assert.equal(record.attemptNumber, 1);
  assert.equal(record.inputTokens, 10);
  assert.equal(record.outputTokens, 20);
  assert.equal(record.latencyMs, 25, "latency is measured by the layer");
  assert.equal(record.stageTraceId, context.stageTraceId);
  assert.equal(record.modelVersionId, context.modelVersionId);
  // 10 × $3/M + 20 × $15/M = 0.00003 + 0.0003
  assert.equal(record.estimatedCostUsd, "0.00033000");
});

test("one row is recorded per attempt, not per logical invocation", async () => {
  // `DB §4.7`: ProviderInvocation is "written per call", and attempt_number
  // only means something if each attempt has its own row.
  const { adapter } = adapterReturning([
    new ProviderError("transient", "429"),
    new ProviderError("transient", "429"),
    wellFormed,
  ]);
  const { records, recorder } = collectingRecorder();

  const invoker = createProviderInvoker({
    adapter,
    rate,
    recorder,
    ...noWait,
    now: () => 0,
  });

  await invoker.invoke(request, context);
  assert.equal(records.length, 3);
  assert.deepEqual(
    records.map((r) => [r.attemptNumber, r.outcome, r.errorClass]),
    [
      [1, "failure", "transient"],
      [2, "failure", "transient"],
      [3, "success", null],
    ],
  );
});

test("a failed call records zero tokens and zero cost", async () => {
  const { adapter } = adapterReturning([
    new ProviderError("persistent", "quota"),
  ]);
  const { records, recorder } = collectingRecorder();

  const invoker = createProviderInvoker({
    adapter,
    rate,
    recorder,
    ...noWait,
    now: () => 0,
  });

  await assert.rejects(invoker.invoke(request, context));
  const record = records[0];
  assert.ok(record);
  assert.equal(record.inputTokens, 0);
  assert.equal(record.outputTokens, 0);
  assert.equal(record.estimatedCostUsd, "0.00000000");
});

test("a malformed response is retried once through the composed layer", async () => {
  const { adapter, calls } = adapterReturning([{ nonsense: true }]);
  const { records, recorder } = collectingRecorder();

  const invoker = createProviderInvoker({
    adapter,
    rate,
    recorder,
    ...noWait,
    now: () => 0,
  });

  await assert.rejects(
    invoker.invoke(request, context),
    (error: ProviderError) => error.failureClass === "malformed_response",
  );
  assert.equal(calls(), 2, "initial call plus the one retry §10.4 grants");
  assert.equal(records.length, 2);
});

test("a degradation is recorded as a fallback (`AI §10.2`)", async () => {
  const { adapter } = adapterReturning([
    { ...wellFormed, degradations: ["structured_output_unavailable"] },
  ]);
  const { records, recorder } = collectingRecorder();

  const invoker = createProviderInvoker({
    adapter,
    rate,
    recorder,
    ...noWait,
    now: () => 0,
  });

  await invoker.invoke(request, context);
  assert.equal(records[0]?.fallbackUsed, true);
});

test("a trace-write failure never fails the provider call", async () => {
  // `DB §6.2` / `SA §3.10`: trace writes are non-blocking and a trace failure
  // never fails an analysis.
  const { adapter } = adapterReturning([wellFormed]);
  const seen: unknown[] = [];

  const invoker = createProviderInvoker({
    adapter,
    rate,
    recorder: { record: () => Promise.reject(new Error("trace store down")) },
    onRecordError: (error) => seen.push(error),
    ...noWait,
    now: () => 0,
  });

  const response = await invoker.invoke(request, context);
  assert.equal(response.output, "ok");
  assert.equal(
    seen.length,
    1,
    "the failure is surfaced, not swallowed silently",
  );
});

test("the layer runs offline against the stub adapter end to end", async () => {
  const { records, recorder } = collectingRecorder();
  const invoker = createProviderInvoker({
    adapter: createStubProvider(),
    rate,
    recorder,
    ...noWait,
    now: () => 0,
  });

  const response = await invoker.invoke(request, context);
  assert.match(response.output, /^STUB_PROVIDER_RESPONSE/);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.outcome, "success");
  assert.ok(
    Number(records[0]?.estimatedCostUsd) > 0,
    "token usage from the stub produces a real cost",
  );
});
