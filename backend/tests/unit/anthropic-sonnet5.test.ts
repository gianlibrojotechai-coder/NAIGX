/**
 * Unit — what the Anthropic adapter sends, per model generation (D-65).
 *
 * ⚠️ THE 2026-09-08 PILOT FAILED ON EXACTLY THESE. Three of three Sonnet 5
 * analyses failed schema validation and `temperature: 0` could not be sent.
 * These assert the request the adapter now builds, against an injected
 * client, with no network and no key — so the next model change fails here
 * rather than after a paid run.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  acceptsSamplingParameters,
  createAnthropicProvider,
  type AnthropicMessageParams,
  type AnthropicMessageResponse,
} from "../../src/provider/adapters/anthropic.js";
import { ProviderError } from "../../src/provider/capability.js";
import type { CapabilityRequest } from "../../src/provider/capability.js";

const request: CapabilityRequest = {
  task: "context_extraction",
  input: "Invoices arrive by email and are keyed into the ledger by hand.",
  instructions: "Extract the context set as JSON.",
  preferLowVariance: true,
};

const SCHEMA = {
  type: "object",
  properties: { elements: { type: "array", items: { type: "string" } } },
  required: ["elements"],
  additionalProperties: false,
} as const;

/** Records the params and answers with a canned response. */
const capture = (
  response: Partial<AnthropicMessageResponse> = {},
): {
  sent: AnthropicMessageParams[];
  client: {
    create: (p: AnthropicMessageParams) => Promise<AnthropicMessageResponse>;
  };
} => {
  const sent: AnthropicMessageParams[] = [];
  return {
    sent,
    client: {
      create: (params) => {
        sent.push(params);
        return Promise.resolve({
          content: [{ type: "text", text: '{"elements":[]}' }],
          usage: { input_tokens: 10, output_tokens: 5 },
          stop_reason: "end_turn",
          ...response,
        });
      },
    },
  };
};

test("1. the generation table: 5-generation models reject sampling parameters, 4.5 does not", () => {
  assert.equal(acceptsSamplingParameters("claude-sonnet-4-5"), true);
  assert.equal(acceptsSamplingParameters("claude-sonnet-4-5-20250929"), true);
  assert.equal(acceptsSamplingParameters("claude-haiku-4-5-20251001"), true);
  assert.equal(acceptsSamplingParameters("claude-sonnet-5"), false);
  assert.equal(acceptsSamplingParameters("claude-opus-5"), false);
  assert.equal(acceptsSamplingParameters("claude-fable-5-1"), false);
});

test("2. Sonnet 4.5: temperature 0 is sent, no degradation, no output_config without schemas", async () => {
  const { sent, client } = capture();
  const adapter = createAnthropicProvider({
    model: "claude-sonnet-4-5",
    client,
  });
  const response = await adapter.invoke(request);

  assert.equal(sent[0]?.temperature, 0);
  assert.equal(sent[0]?.output_config, undefined);
  assert.equal(sent[0]?.max_tokens, 8_000);
  assert.deepEqual(response.degradations, []);
  assert.equal(adapter.capabilities.lowVarianceSampling, true);
  assert.equal(adapter.capabilities.structuredOutput, false);
});

test("3. Sonnet 5: NO temperature is sent, the low-variance degradation is recorded, the budget allows for thinking", async () => {
  const { sent, client } = capture();
  const adapter = createAnthropicProvider({ model: "claude-sonnet-5", client });
  const response = await adapter.invoke(request);

  // ⚠️ THE 400 THE PILOT HIT. Any non-default temperature is rejected there.
  assert.equal("temperature" in (sent[0] ?? {}), false);
  assert.equal(sent[0]?.max_tokens, 16_000);
  assert.equal(adapter.capabilities.lowVarianceSampling, false);
  assert.equal(response.degradations.length, 1);
  assert.match(response.degradations[0] ?? "", /^low_variance_unavailable/);
});

test("4. a schema registry sends output_config.format for the task, and declares structuredOutput", async () => {
  const { sent, client } = capture();
  const adapter = createAnthropicProvider({
    model: "claude-sonnet-5",
    client,
    outputSchemas: { context_extraction: SCHEMA },
    effort: "medium",
  });
  const response = await adapter.invoke(request);

  assert.equal(adapter.capabilities.structuredOutput, true);
  assert.deepEqual(sent[0]?.output_config, {
    effort: "medium",
    format: { type: "json_schema", schema: SCHEMA },
  });
  // Structured output was honoured; only the sampling degradation remains.
  assert.deepEqual(
    response.degradations.map((d) => d.split(":")[0]),
    ["low_variance_unavailable"],
  );
});

test("5. a task the registry does not name is a recorded degradation, never a guessed schema", async () => {
  const { sent, client } = capture();
  const adapter = createAnthropicProvider({
    model: "claude-sonnet-4-5",
    client,
    outputSchemas: { context_extraction: SCHEMA },
  });
  const response = await adapter.invoke({ ...request, task: "something_new" });

  assert.equal(sent[0]?.output_config, undefined);
  assert.ok(
    response.degradations.some((d) =>
      d.startsWith("structured_output_unavailable"),
    ),
  );
});

test("6. the request shape is unchanged: task, input, instructions only — so replay keys do not move", async () => {
  const { sent, client } = capture();
  const adapter = createAnthropicProvider({
    model: "claude-sonnet-5",
    client,
    outputSchemas: { context_extraction: SCHEMA },
  });
  await adapter.invoke(request);
  assert.equal(sent[0]?.system, request.instructions);
  assert.deepEqual(sent[0]?.messages, [
    { role: "user", content: request.input },
  ]);
});

test("7. thinking blocks before the text block are skipped — content is selected by type", async () => {
  const { client } = capture({
    content: [
      { type: "thinking" },
      { type: "text", text: '{"elements":["a"]}' },
    ],
  });
  const adapter = createAnthropicProvider({ model: "claude-sonnet-5", client });
  const response = await adapter.invoke(request);
  assert.equal(response.output, '{"elements":["a"]}');
});

test("8. stop_reason refusal is a persistent failure; max_tokens is a malformed_response granted one retry", async () => {
  const refused = createAnthropicProvider({
    model: "claude-sonnet-5",
    client: capture({ stop_reason: "refusal", content: [] }).client,
  });
  await assert.rejects(
    refused.invoke(request),
    (e: unknown) =>
      e instanceof ProviderError && e.failureClass === "persistent",
  );

  const truncated = createAnthropicProvider({
    model: "claude-sonnet-5",
    client: capture({ stop_reason: "max_tokens" }).client,
  });
  await assert.rejects(
    truncated.invoke(request),
    (e: unknown) =>
      e instanceof ProviderError && e.failureClass === "malformed_response",
  );
});
