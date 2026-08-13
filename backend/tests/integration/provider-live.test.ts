/**
 * Integration — the real provider adapter against the live API.
 *
 * OPT-IN, AND DELIBERATELY SO. This test spends money and needs a personal
 * credential, so it runs only when explicitly enabled:
 *
 *   LIVE_PROVIDER_TESTS=1 ANTHROPIC_API_KEY=sk-... PROVIDER_MODEL=<model> \
 *   PROVIDER_INPUT_USD_PER_MTOK=3 PROVIDER_OUTPUT_USD_PER_MTOK=15 \
 *   npm test
 *
 * CI must never require a personal credential, so it skips there — and that is
 * safe precisely because it is the *only* skipping test in the suite: the
 * offline conformance suite already exercises this adapter's translation and
 * classification on every build (`AI-005`, boundary check 8). What this adds is
 * the one thing a fake client cannot prove: that the request shape is accepted
 * by the real API.
 *
 * Nothing here asserts on reasoning content. A live model is not deterministic,
 * and a test that demanded a particular architecture would be flaky by design.
 * It asserts the contract: a usable response, honest token accounting, and no
 * credential or provider identity anywhere in what comes back.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import { createAnthropicProvider } from "../../src/provider/adapters/anthropic.js";
import { createProviderInvoker } from "../../src/provider/invoke.js";
import type { ProviderInvocationRecord } from "../../src/provider/invoke.js";

const apiKey = process.env["ANTHROPIC_API_KEY"];
const model = process.env["PROVIDER_MODEL"];
const enabled = process.env["LIVE_PROVIDER_TESTS"] === "1";

const skip =
  enabled && apiKey !== undefined && model !== undefined
    ? false
    : "set LIVE_PROVIDER_TESTS=1 with ANTHROPIC_API_KEY and PROVIDER_MODEL to run";

test(
  "a real model request satisfies the capability contract",
  { skip },
  async () => {
    const adapter = createAnthropicProvider({
      apiKey: apiKey as string,
      model: model as string,
      maxTokens: 256,
    });

    const response = await adapter.invoke({
      task: "input_classification",
      instructions:
        'Reply with a single JSON object and nothing else: {"ok": true}',
      input: "This is a connectivity check for the NAIGX provider adapter.",
      preferLowVariance: true,
    });

    assert.equal(typeof response.output, "string");
    assert.ok(response.output.length > 0, "the model returned usable text");

    // Token accounting must be real — cost is computed from it (`SA §3.5`).
    assert.ok(response.usage.inputTokens > 0);
    assert.ok(response.usage.outputTokens > 0);
    assert.ok(response.usage.latencyMs >= 0);

    // `AI-006` / credential hygiene: neither the vendor nor the key may appear.
    const serialized = JSON.stringify(response);
    assert.ok(
      !serialized.includes(apiKey as string),
      "the credential never returns",
    );
    assert.ok(
      !Object.prototype.hasOwnProperty.call(response, "provider"),
      "the response type has no provider field",
    );
  },
);

test(
  "a real request flows through the shared cost path",
  { skip },
  async () => {
    const invocations: ProviderInvocationRecord[] = [];

    const invoker = createProviderInvoker({
      adapter: createAnthropicProvider({
        apiKey: apiKey as string,
        model: model as string,
        maxTokens: 128,
      }),
      rate: {
        inputUsdPerMillionTokens:
          process.env["PROVIDER_INPUT_USD_PER_MTOK"] ?? "3.00",
        outputUsdPerMillionTokens:
          process.env["PROVIDER_OUTPUT_USD_PER_MTOK"] ?? "15.00",
      },
      recorder: {
        record: (record) => {
          invocations.push(record);
          return Promise.resolve();
        },
      },
    });

    await invoker.invoke(
      {
        task: "input_classification",
        instructions:
          'Reply with a single JSON object and nothing else: {"ok": true}',
        input: "This is a connectivity check for the NAIGX provider adapter.",
        preferLowVariance: true,
      },
      {
        stageTraceId: "11111111-1111-4111-8111-111111111111",
        modelVersionId: "22222222-2222-4222-8222-222222222222",
        modelKey: model as string,
      },
    );

    assert.equal(invocations.length, 1);
    const invocation = invocations[0];
    assert.ok(invocation);
    assert.equal(invocation.outcome, "success");
    assert.equal(invocation.errorClass, null);
    assert.match(invocation.estimatedCostUsd, /^\d+\.\d{8}$/);
    assert.ok(
      Number(invocation.estimatedCostUsd) > 0,
      "a real call costs a real, non-zero amount",
    );
  },
);
