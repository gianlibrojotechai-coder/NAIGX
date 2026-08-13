/**
 * Contract — provider substitution (`AI-005`, `SA AR-43`, `AC-024`).
 *
 * `SA AR-43`: "an abstraction assumed to work is never exercised." This file is
 * the exercise. It runs **every** registered adapter through the same
 * provider-neutral abstraction and asserts identical behaviour, so that
 * substituting a provider is demonstrated rather than claimed.
 *
 * Boundary check 8 reads this file and fails the build if an adapter exists
 * that it does not cover, so adding a third adapter cannot silently skip it.
 *
 * `AI §10.5` step 3 is registration only — routing is Sprint 2 (`AIQ-6`).
 * Step 4, "run the full regression suite against it", awaits the Sprint 2
 * regression runner; step 5 (`AI-006`) is asserted here.
 *
 * Offline and deterministic by construction: no credentials, no network, no
 * database, no wall-clock or RNG dependence.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ProviderError,
  type CapabilityRequest,
  type ProviderAdapter,
} from "../../src/provider/capability.js";
import type { TokenRate } from "../../src/provider/cost.js";
import {
  createProviderInvoker,
  type ProviderInvocationRecord,
} from "../../src/provider/invoke.js";
import {
  availableProviders,
  createProvider,
} from "../../src/provider/index.js";
import {
  createReplayProvider,
  replayKeyFor,
} from "../../src/provider/adapters/replay.js";
import { createStubProvider } from "../../src/provider/adapters/stub.js";
import {
  classifyAnthropicError,
  createAnthropicProvider,
  type AnthropicMessagesClient,
} from "../../src/provider/adapters/anthropic.js";

const request: CapabilityRequest = {
  task: "classification",
  input: "Invoices arrive by email and are keyed into the ledger by hand.",
  preferLowVariance: true,
};

const context = {
  stageTraceId: "11111111-1111-4111-8111-111111111111",
  modelVersionId: "22222222-2222-4222-8222-222222222222",
  modelKey: "conformance-model",
};

/**
 * Rates are supplied explicitly because `docs/12` D-10 item 5 records that no
 * persistent rate configuration surface is defined. Both adapters are priced
 * identically so that any cost difference between them is attributable to
 * token usage alone.
 */
const rate: TokenRate = {
  inputUsdPerMillionTokens: "3.00",
  outputUsdPerMillionTokens: "15.00",
};

const recorderCollecting = () => {
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

const deterministic = {
  sleep: () => Promise.resolve(),
  random: () => 0,
  now: () => 0,
};

/** A replay adapter primed to answer the shared request. */
const primedReplay = (
  overrides: {
    readonly failures?: readonly ProviderError["failureClass"][];
  } = {},
): ProviderAdapter =>
  createReplayProvider({
    fixtures: {
      [replayKeyFor(request)]: {
        output: '{"determined_type":"business_requirement"}',
        inputTokens: 16,
        outputTokens: 17,
        latencyMs: 42,
        ...(overrides.failures !== undefined
          ? { failures: overrides.failures }
          : {}),
      },
    },
  });

/**
 * A fake Anthropic transport. The real adapter is exercised here with no
 * credential and no network: what is under test is its translation of the
 * capability contract and its failure classification, both of which are pure.
 * The live path is covered by `provider-live.test.ts`, which runs only when a
 * credential is configured.
 */
const fakeAnthropicClient = (
  behaviour: { readonly reject?: unknown; readonly content?: unknown } = {},
): AnthropicMessagesClient => ({
  create: (params) => {
    if (behaviour.reject !== undefined) {
      return Promise.reject(behaviour.reject);
    }
    return Promise.resolve({
      content: (behaviour.content ?? [
        { type: "text", text: '{"determined_type":"business_requirement"}' },
      ]) as readonly { type: string; text?: string }[],
      usage: {
        input_tokens: params.messages[0]?.content.length ?? 0,
        output_tokens: 42,
      },
    });
  },
});

/**
 * The subjects. **Every adapter file must appear here** — boundary check 8
 * verifies that by name, so a fourth adapter cannot be added without being
 * exercised through the abstraction.
 */
const SUBJECTS: readonly {
  readonly id: string;
  readonly build: () => ProviderAdapter;
}[] = [
  { id: "stub", build: createStubProvider },
  { id: "replay", build: () => primedReplay() },
  {
    id: "anthropic",
    build: () =>
      createAnthropicProvider({
        model: "test-model",
        client: fakeAnthropicClient(),
      }),
  },
];

// --- registration --------------------------------------------------------

test("the registry exposes the zero-argument adapters, both constructible", () => {
  // The real adapter is not registered: it requires a credential and a model,
  // which the zero-argument registry signature cannot supply. The composition
  // root constructs it instead.
  const ids = availableProviders();
  assert.deepEqual([...ids].sort(), ["replay", "stub"]);
  for (const id of ids) {
    const adapter = createProvider(id);
    assert.equal(typeof adapter.invoke, "function");
    assert.equal(typeof adapter.capabilities.costLatencyTier, "string");
  }
});

test("every subject is a distinct implementation, not the same one twice", () => {
  // An adapter that is another one under a new name would satisfy the letter of
  // AI-005 and none of its purpose.
  const tiers = SUBJECTS.map((s) => s.build().capabilities.costLatencyTier);
  assert.equal(
    new Set(tiers).size,
    SUBJECTS.length,
    "each adapter occupies a distinct tier",
  );

  const [stub, replay] = SUBJECTS.map((s) => s.build());
  assert.ok(stub && replay);
  assert.notEqual(
    stub.capabilities.structuredOutput,
    replay.capabilities.structuredOutput,
    "adapters must declare materially different capabilities",
  );
});

// --- the same neutral path, per adapter ----------------------------------

for (const subject of SUBJECTS) {
  test(`[${subject.id}] invokes through the abstraction and records accounting`, async () => {
    const { records, recorder } = recorderCollecting();
    const invoker = createProviderInvoker({
      adapter: subject.build(),
      rate,
      recorder,
      ...deterministic,
    });

    const response = await invoker.invoke(request, context);

    assert.equal(typeof response.output, "string");
    assert.ok(response.output.length > 0);
    assert.equal(records.length, 1);

    const record = records[0];
    assert.ok(record);
    assert.equal(record.outcome, "success");
    assert.equal(record.attemptNumber, 1);
    assert.equal(record.stageTraceId, context.stageTraceId);
    // Cost accounting is the same computation for both providers.
    assert.ok(
      Number(record.estimatedCostUsd) > 0,
      "usage must produce a non-zero cost through the shared path",
    );
    assert.match(record.estimatedCostUsd, /^\d+\.\d{8}$/);
  });

  test(`[${subject.id}] surfaces no provider identity in its response (AI-006)`, async () => {
    // `AI §10.5` step 5, and `AI-006`: no user-facing surface, output, or
    // export may name the underlying provider.
    const { records, recorder } = recorderCollecting();
    const invoker = createProviderInvoker({
      adapter: subject.build(),
      rate,
      recorder,
      ...deterministic,
    });

    const response = await invoker.invoke(request, context);
    const serialized = JSON.stringify(response);

    for (const id of availableProviders()) {
      assert.ok(
        !serialized.includes(id),
        `response must not name the provider ("${id}")`,
      );
    }
    assert.ok(
      !Object.prototype.hasOwnProperty.call(response, "provider"),
      "the response type has no provider field, and must gain none",
    );
    // The invocation record identifies the model by opaque identifier only —
    // never a provider name (`DB §4.7`).
    assert.equal(records[0]?.modelVersionId, context.modelVersionId);
  });

  test(`[${subject.id}] normalizes a malformed response identically`, async () => {
    const broken: ProviderAdapter = {
      capabilities: subject.build().capabilities,
      invoke: () => Promise.resolve({ nonsense: true } as never),
    };
    const { records, recorder } = recorderCollecting();
    const invoker = createProviderInvoker({
      adapter: broken,
      rate,
      recorder,
      ...deterministic,
    });

    await assert.rejects(
      invoker.invoke(request, context),
      (error: unknown) =>
        error instanceof ProviderError &&
        error.failureClass === "malformed_response",
    );
    // §10.4's one retry, applied to both providers by the same code.
    assert.equal(records.length, 2);
  });
}

// --- substitution properties ---------------------------------------------

test("the shared retry path recovers a transient failure on the second provider", async () => {
  // Driven entirely by adapter-side data: the abstraction has no knowledge that
  // this provider differs from the stub.
  const { records, recorder } = recorderCollecting();
  const invoker = createProviderInvoker({
    adapter: primedReplay({ failures: ["transient", "transient"] }),
    rate,
    recorder,
    ...deterministic,
  });

  const response = await invoker.invoke(request, context);
  assert.match(response.output, /business_requirement/);
  assert.deepEqual(
    records.map((r) => [r.attemptNumber, r.outcome]),
    [
      [1, "failure"],
      [2, "failure"],
      [3, "success"],
    ],
  );
});

test("adapter-classified failures reach the shared layer unaltered", async () => {
  // A replay with no fixture classifies the miss itself, inside the adapter
  // boundary; the abstraction honours that classification rather than
  // re-deriving it (`AI-001`).
  const { records, recorder } = recorderCollecting();
  const invoker = createProviderInvoker({
    adapter: createReplayProvider(),
    rate,
    recorder,
    ...deterministic,
  });

  await assert.rejects(
    invoker.invoke(request, context),
    (error: unknown) =>
      error instanceof ProviderError && error.failureClass === "persistent",
  );
  assert.equal(records.length, 1, "persistent failures are not retried");
  assert.equal(records[0]?.errorClass, "persistent");
});

test("each adapter degrades on the capability it lacks, and records it", async () => {
  // The stub cannot honour an output contract; the replay recording was not
  // captured under low-variance sampling. Two different `AI §10.2` rows,
  // handled by one unchanged abstraction.
  const withContract: CapabilityRequest = {
    ...request,
    outputContract: '{"type":"object"}',
  };

  const stubRun = recorderCollecting();
  await createProviderInvoker({
    adapter: createStubProvider(),
    rate,
    recorder: stubRun.recorder,
    ...deterministic,
  }).invoke(withContract, context);

  const replayRun = recorderCollecting();
  const replayResponse = await createProviderInvoker({
    adapter: createReplayProvider({
      fixtures: {
        [replayKeyFor(request)]: {
          output: "recorded",
          inputTokens: 5,
          outputTokens: 5,
          latencyMs: 1,
        },
      },
      lowVarianceSampling: false,
    }),
    rate,
    recorder: replayRun.recorder,
    ...deterministic,
  }).invoke(request, context);

  assert.equal(stubRun.records[0]?.fallbackUsed, true);
  assert.equal(replayRun.records[0]?.fallbackUsed, true);
  assert.match(
    replayResponse.degradations[0] ?? "",
    /low_variance_unavailable/,
  );
});

test("substituting the provider changes no reasoning-facing type", async () => {
  // The proof that substitution requires no reasoning change: both adapters are
  // invoked through one identical call shape, and both return the same
  // structural surface.
  const shapes = await Promise.all(
    SUBJECTS.map(async (subject) => {
      const { recorder } = recorderCollecting();
      const response = await createProviderInvoker({
        adapter: subject.build(),
        rate,
        recorder,
        ...deterministic,
      }).invoke(request, context);
      return Object.keys(response).sort();
    }),
  );

  assert.deepEqual(shapes[0], ["degradations", "output", "usage"]);
  assert.deepEqual(
    shapes[0],
    shapes[1],
    "one response shape for all providers",
  );
});

// --- real-adapter classification, offline (AI §10.4) ---------------------

test("the real adapter classifies provider failures inside its own boundary", () => {
  // Classification requires knowing the provider, which is why it may not move
  // above `adapters/` (`AI-001`). These are the mappings `AI §10.4` names.
  const cases: readonly [unknown, string][] = [
    [{ status: 429 }, "transient"],
    [{ status: 500 }, "transient"],
    [{ status: 503 }, "transient"],
    [{ status: 401 }, "persistent"],
    [{ status: 403 }, "persistent"],
    [{ status: 400 }, "persistent"],
    [{ status: 404 }, "persistent"],
    [new Error("something unexpected"), "persistent"],
  ];

  for (const [error, expected] of cases) {
    const classified = classifyAnthropicError(error);
    assert.ok(classified instanceof ProviderError);
    assert.equal(
      classified.failureClass,
      expected,
      `${JSON.stringify(error)} must classify as ${expected}`,
    );
  }
});

test("classified failures carry no provider identity (AI-006, FR-093)", () => {
  // The SDK's own message names the vendor, the model and sometimes the
  // account. It belongs on `cause` — for logs and traces — never on the
  // message that can surface to a user.
  const leaky = Object.assign(
    new Error(
      "anthropic: model claude-x rejected key sk-ant-EXAMPLE-NOT-A-REAL-KEY",
    ),
    { status: 401 },
  );
  const classified = classifyAnthropicError(leaky);

  for (const secret of ["anthropic", "claude", "sk-ant", "not-a-real-key"]) {
    assert.ok(
      !classified.message.toLowerCase().includes(secret),
      `normalized message must not contain "${secret}"`,
    );
  }
  assert.equal(classified.cause, leaky, "the original is preserved for traces");
});

test("an empty response is a malformed_response, not an empty analysis", async () => {
  const adapter = createAnthropicProvider({
    model: "test-model",
    client: fakeAnthropicClient({ content: [] }),
  });

  await assert.rejects(
    adapter.invoke(request),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.failureClass === "malformed_response",
  );
});

test("the composed instructions are sent as framing, not as user content", async () => {
  // `docs/12` D-12: instructions are the composed fragment set. Merging them
  // into the user's text would blur exactly the line provenance depends on.
  let captured: {
    system?: string;
    messages: readonly { content: string }[];
  } | null = null;

  const adapter = createAnthropicProvider({
    model: "test-model",
    client: {
      create: (params) => {
        captured = params;
        return Promise.resolve({
          content: [{ type: "text", text: "ok" }],
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      },
    },
  });

  await adapter.invoke({ ...request, instructions: "FRAGMENT SET" });

  assert.ok(captured);
  assert.equal(
    (captured as { system?: string }).system,
    "FRAGMENT SET",
    "instructions become the system prompt",
  );
  assert.equal(
    (captured as { messages: readonly { content: string }[] }).messages[0]
      ?.content,
    request.input,
    "the user's text is sent unaltered",
  );
});
