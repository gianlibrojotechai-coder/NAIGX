/**
 * Unit — provider port and offline stub adapter (`AI §10`).
 *
 * Covers the degradation path, which `Roadmap §6.6` makes mandatory, and the
 * Sprint 0 exit criterion that a developer can run locally against a stub with
 * no network, credentials, or database.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  availableProviders,
  createProvider,
  DEFAULT_PROVIDER_ID,
  ProviderError,
} from "../../src/provider/index.js";
import type { CapabilityRequest } from "../../src/provider/index.js";

const request: CapabilityRequest = {
  task: "classification",
  input: "A workflow that syncs orders nightly.",
  preferLowVariance: true,
};

test("registry exposes the stub and defaults to it", () => {
  assert.equal(DEFAULT_PROVIDER_ID, "stub");
  assert.deepEqual([...availableProviders()], ["stub"]);
});

test("declares all four AI §10.2 capabilities explicitly", () => {
  const { capabilities } = createProvider();
  for (const key of [
    "structuredOutput",
    "extendedContext",
    "lowVarianceSampling",
    "costLatencyTier",
  ]) {
    assert.ok(key in capabilities, `capability '${key}' must be declared`);
  }
});

test("declares structuredOutput false — a false declaration is worse than none", () => {
  assert.equal(createProvider().capabilities.structuredOutput, false);
  assert.equal(createProvider().capabilities.lowVarianceSampling, true);
});

test("invocation returns output and usage accounting", async () => {
  const response = await createProvider().invoke(request);
  assert.ok(response.output.length > 0);
  assert.ok(Number.isInteger(response.usage.inputTokens));
  assert.ok(Number.isInteger(response.usage.outputTokens));
  assert.ok(Number.isInteger(response.usage.latencyMs));
});

test("is deterministic — identical input yields an identical response", async () => {
  const provider = createProvider();
  const a = await provider.invoke(request);
  const b = await provider.invoke(request);
  assert.deepEqual(a, b);
});

test("determinism holds across separate instances", async () => {
  const a = await createProvider().invoke(request);
  const b = await createProvider().invoke(request);
  assert.deepEqual(a, b);
});

test("distinct inputs yield distinct outputs", async () => {
  const provider = createProvider();
  const base = await provider.invoke(request);
  for (const variant of [
    { ...request, input: "Something else entirely." },
    { ...request, task: "intent" },
    { ...request, preferLowVariance: false },
  ]) {
    const other = await provider.invoke(variant);
    assert.notEqual(other.output, base.output);
  }
});

test("records a degradation when an output contract cannot be honoured", async () => {
  const provider = createProvider();
  const withContract = await provider.invoke({
    ...request,
    outputContract: '{"type":"object"}',
  });
  assert.ok(withContract.degradations.length > 0);
  assert.match(withContract.degradations[0] ?? "", /structured_output/);
});

test("records no degradation when none was needed", async () => {
  const response = await createProvider().invoke(request);
  assert.deepEqual(response.degradations, []);
});

test("never surfaces provider identity upward (`AI-006`)", async () => {
  const provider = createProvider();
  const serialized = JSON.stringify(
    await provider.invoke(request),
  ).toLowerCase();
  for (const name of [
    "openai",
    "anthropic",
    "claude",
    "gemini",
    "gpt",
    "cohere",
    "mistral",
  ]) {
    assert.ok(!serialized.includes(name), `response leaked '${name}'`);
  }
  assert.ok(!("name" in provider), "adapter must not expose an identity field");
  assert.ok(!("id" in provider));
});

test("does not reason — output is an obviously synthetic marker", async () => {
  const response = await createProvider().invoke(request);
  assert.match(response.output, /^STUB_PROVIDER_RESPONSE /);
});

test("ProviderError carries a normalized failure class and no provider detail", () => {
  const error = new ProviderError("transient", "Upstream unavailable.", {
    cause: new Error("openai 429"),
  });
  assert.equal(error.failureClass, "transient");
  assert.equal(error.name, "ProviderError");
  assert.ok(
    !JSON.stringify({ ...error })
      .toLowerCase()
      .includes("openai"),
  );
});
