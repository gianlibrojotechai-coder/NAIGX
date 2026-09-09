/**
 * Unit — cancellation reaches every layer that could spend (D-65 §7.2, `FR-094`).
 *
 * Three layers, three guarantees, no network:
 *   · the invoker starts no attempt — first or retry — once the signal is
 *     aborted, for every adapter;
 *   · the pipeline starts no provider call for a stage once aborted, and
 *     records the cancellation as that stage's failure;
 *   · the Anthropic adapter forwards the signal to the SDK and classifies the
 *     resulting abort as non-retryable.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import Anthropic from "@anthropic-ai/sdk";

import { createPipeline } from "../../src/nie/pipeline.js";
import type { FragmentResolver } from "../../src/nie/ports.js";
import {
  classifyAnthropicError,
  createAnthropicProvider,
} from "../../src/provider/adapters/anthropic.js";
import {
  ProviderError,
  type CapabilityRequest,
  type ProviderAdapter,
} from "../../src/provider/capability.js";
import { createProviderInvoker } from "../../src/provider/invoke.js";

const request: CapabilityRequest = {
  task: "input_classification",
  input: "some text",
  preferLowVariance: true,
};
const context = {
  stageTraceId: randomUUID(),
  modelVersionId: randomUUID(),
  modelKey: "test",
};
const RATE = { inputUsdPerMillionTokens: "0", outputUsdPerMillionTokens: "0" };

/** An adapter that counts calls and answers as instructed. */
const counting = (
  outcomes: readonly ("ok" | "transient")[],
): { adapter: ProviderAdapter; calls: () => number } => {
  let n = 0;
  return {
    calls: () => n,
    adapter: {
      capabilities: {
        structuredOutput: false,
        extendedContext: false,
        lowVarianceSampling: true,
        costLatencyTier: "test",
      },
      invoke: () => {
        const outcome = outcomes[n] ?? "ok";
        n += 1;
        if (outcome === "transient") {
          return Promise.reject(new ProviderError("transient", "rate limit"));
        }
        return Promise.resolve({
          output:
            '{"determined_type":"unsupported","confidence":1,"candidate_types":[]}',
          usage: { inputTokens: 1, outputTokens: 1, latencyMs: 1 },
          degradations: [],
        });
      },
    },
  };
};

const invoker = (adapter: ProviderAdapter) =>
  createProviderInvoker({
    adapter,
    rate: RATE,
    recorder: { record: () => Promise.resolve() },
    sleep: () => Promise.resolve(),
    random: () => 0,
  });

test("1. invoker: an already-aborted signal starts no attempt at all", async () => {
  const { adapter, calls } = counting(["ok"]);
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    invoker(adapter).invoke(request, context, { signal: controller.signal }),
    (e: unknown) =>
      e instanceof ProviderError &&
      e.failureClass === "persistent" &&
      /cancelled/.test(e.message),
  );
  assert.equal(calls(), 0, "no provider call was made");
});

test("2. invoker: a transient failure is NOT retried once the signal aborts between attempts", async () => {
  const controller = new AbortController();
  let n = 0;
  // The first attempt fails transiently, and the deadline fires while that
  // failure is being classified — before the retry loop's second attempt.
  const adapter: ProviderAdapter = {
    capabilities: {
      structuredOutput: false,
      extendedContext: false,
      lowVarianceSampling: true,
      costLatencyTier: "test",
    },
    invoke: () => {
      n += 1;
      controller.abort();
      return Promise.reject(new ProviderError("transient", "rate limit"));
    },
  };

  await assert.rejects(
    invoker(adapter).invoke(request, context, { signal: controller.signal }),
    (e: unknown) => e instanceof ProviderError && /cancelled/.test(e.message),
  );
  assert.equal(n, 1, "the retry never became a second paid call");
});

test("3. invoker: without a signal, and with one that is not aborted, behaviour is unchanged", async () => {
  const { adapter, calls } = counting(["transient", "ok"]);
  const response = await invoker(adapter).invoke(request, context, {
    signal: new AbortController().signal,
  });
  assert.equal(calls(), 2, "the transient failure was retried as before");
  assert.ok(response.output.length > 0);
});

test("4. pipeline: an aborted signal stops Stage 1 before any call and records the cancellation on the trace", async () => {
  const { adapter, calls } = counting(["ok"]);
  const traces: {
    stageKey: string;
    outcome: string;
    failureReason: string | null;
  }[] = [];
  const resolver: FragmentResolver = {
    resolve: (keys) =>
      Promise.resolve(
        keys.map((fragmentKey) => ({
          fragmentKey,
          fragmentVersionId: `v:${fragmentKey}`,
          version: "1",
          content: `fragment ${fragmentKey}`,
        })),
      ),
  };
  const pipeline = createPipeline({
    invoker: invoker(adapter),
    resolver,
    traceSink: {
      record: (t) => {
        traces.push({
          stageKey: t.stageKey,
          outcome: t.outcome,
          failureReason: t.failureReason,
        });
        return Promise.resolve();
      },
    },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: randomUUID(),
    modelKey: "test",
  });
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    pipeline.run({
      analysisId: randomUUID(),
      text: "x",
      signal: controller.signal,
    }),
    /Cancelled: the analysis reached its deadline/,
  );
  assert.equal(calls(), 0, "no provider call was made");
  const stage1 = traces.find((t) => t.stageKey === "input_classification");
  assert.ok(stage1, "the stage still recorded a trace");
  assert.equal(stage1.outcome, "failure");
  assert.match(stage1.failureReason ?? "", /Cancelled/);
});

test("5. anthropic adapter: the signal reaches the SDK call, and an abort is classified as non-retryable", async () => {
  let received: AbortSignal | undefined;
  const adapter = createAnthropicProvider({
    model: "claude-sonnet-5",
    client: {
      create: (_params, options) => {
        received = options?.signal;
        return Promise.resolve({
          content: [{ type: "text", text: "{}" }],
          usage: { input_tokens: 1, output_tokens: 1 },
          stop_reason: "end_turn",
        });
      },
    },
  });
  const controller = new AbortController();
  await adapter.invoke(request, { signal: controller.signal });
  assert.equal(
    received,
    controller.signal,
    "the same signal object was forwarded",
  );

  const classified = classifyAnthropicError(
    new Anthropic.APIUserAbortError({ message: "Request was aborted." }),
  );
  assert.equal(classified.failureClass, "persistent");
  assert.doesNotMatch(
    classified.message,
    /anthropic/i,
    "no provider identity leaks",
  );
});
