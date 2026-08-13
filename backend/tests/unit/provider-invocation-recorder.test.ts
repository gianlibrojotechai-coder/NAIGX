/**
 * Unit — provider calls reach `PROVIDER_INVOCATION` (`DB §4.7`, `§8.2`,
 * `FR-093`, `NFR-083`).
 *
 * The abstraction layer already builds a record per attempt and the recorder
 * already maps it to the trace store; what was missing was the composition
 * root wiring them together, so a real run's latency, tokens and cost were
 * collected in memory and thrown away (`docs/12` D-20, outstanding item).
 *
 * These tests drive the **production** recorder through the **production**
 * invoker against a recording Prisma double, so the whole path is exercised
 * with no database, no network and no credential.
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
import { createProviderInvoker } from "../../src/provider/invoke.js";
import { createProviderInvocationRecorder } from "../../src/db/provider-invocation-recorder.js";
import type { PrismaClient } from "../../src/generated/prisma-trace/client.js";

const rate: TokenRate = {
  inputUsdPerMillionTokens: "3.00",
  outputUsdPerMillionTokens: "15.00",
};

const request: CapabilityRequest = {
  task: "classification",
  input: "Invoices arrive by email and are keyed into the ledger by hand.",
  preferLowVariance: true,
};

/** The identifiers the row links by — both identifier references (D-9). */
const STAGE_TRACE_ID = "11111111-1111-4111-8111-111111111111";
const MODEL_VERSION_ID = "22222222-2222-4222-8222-222222222222";

const context = {
  stageTraceId: STAGE_TRACE_ID,
  modelVersionId: MODEL_VERSION_ID,
  modelKey: "recorded",
};

const ok: CapabilityResponse = {
  output: "ok",
  usage: { inputTokens: 1000, outputTokens: 500, latencyMs: 5 },
  degradations: [],
};

/** A trace Prisma client that records the `data` of every row created. */
const recordingTracePrisma = () => {
  const rows: Record<string, unknown>[] = [];
  const prisma = {
    providerInvocation: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
        return Promise.resolve(data);
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, rows };
};

const adapterReturning = (values: readonly unknown[]): ProviderAdapter => {
  let call = 0;
  return {
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
  };
};

const invokerOver = (adapter: ProviderAdapter, prisma: PrismaClient) =>
  createProviderInvoker({
    adapter,
    rate,
    recorder: createProviderInvocationRecorder(prisma),
    now: (() => {
      // Deterministic latency: 40 ms per attempt.
      let t = 0;
      return () => (t += 40);
    })(),
    sleep: () => Promise.resolve(),
    random: () => 0,
  });

// --- a successful call ---------------------------------------------------

test("a successful invocation is persisted with its usage and cost", async () => {
  const { prisma, rows } = recordingTracePrisma();

  await invokerOver(adapterReturning([ok]), prisma).invoke(request, context);

  assert.equal(rows.length, 1, "one row per call");
  assert.deepEqual(rows[0], {
    stageTraceId: STAGE_TRACE_ID,
    modelVersionId: MODEL_VERSION_ID,
    latencyMs: 40,
    inputTokens: 1000,
    outputTokens: 500,
    // 1000 × $3/Mtok + 500 × $15/Mtok = $0.0105, at COST_SCALE places.
    estimatedCost: "0.01050000",
    outcome: "success",
    errorClass: null,
    attemptNumber: 1,
    fallbackUsed: false,
  });
});

test("a degraded call records the fallback (AI §10.2)", async () => {
  const { prisma, rows } = recordingTracePrisma();

  await invokerOver(
    adapterReturning([{ ...ok, degradations: ["output_contract"] }]),
    prisma,
  ).invoke(request, context);

  assert.equal(rows[0]?.["fallbackUsed"], true);
  assert.equal(rows[0]?.["outcome"], "success");
});

// --- a retried call ------------------------------------------------------

test("a retried call persists one row per attempt, both linked to the stage trace", async () => {
  const { prisma, rows } = recordingTracePrisma();

  const response = await invokerOver(
    adapterReturning([
      new ProviderError("transient", "upstream unavailable"),
      ok,
    ]),
    prisma,
  ).invoke(request, context);

  assert.equal(response.output, "ok", "the retry still succeeds");
  assert.equal(
    rows.length,
    2,
    "one row per attempt, which is what makes attempt_number meaningful",
  );

  assert.equal(rows[0]?.["outcome"], "failure");
  assert.equal(rows[0]?.["errorClass"], "transient");
  assert.equal(rows[0]?.["attemptNumber"], 1);
  // A failed call consumed no accountable tokens.
  assert.equal(rows[0]?.["inputTokens"], 0);
  assert.equal(rows[0]?.["outputTokens"], 0);
  assert.equal(rows[0]?.["estimatedCost"], "0.00000000");

  assert.equal(rows[1]?.["outcome"], "success");
  assert.equal(rows[1]?.["errorClass"], null);
  assert.equal(rows[1]?.["attemptNumber"], 2);
  assert.equal(rows[1]?.["inputTokens"], 1000);

  // `FR-100` reconstruction depends on the linkage: every attempt of a stage
  // resolves to that stage's trace, and to the model version that served it.
  for (const row of rows) {
    assert.equal(row["stageTraceId"], STAGE_TRACE_ID);
    assert.equal(row["modelVersionId"], MODEL_VERSION_ID);
  }
});

// --- an exhausted call ---------------------------------------------------

test("a persistent failure is persisted before it is thrown", async () => {
  const { prisma, rows } = recordingTracePrisma();

  await assert.rejects(
    invokerOver(
      adapterReturning([new ProviderError("persistent", "bad request")]),
      prisma,
    ).invoke(request, context),
    (error: unknown) =>
      error instanceof ProviderError && error.failureClass === "persistent",
  );

  // `AI §10.4`: persistent is not retried, so exactly one attempt is recorded.
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.["outcome"], "failure");
  assert.equal(rows[0]?.["errorClass"], "persistent");
  assert.equal(rows[0]?.["attemptNumber"], 1);
  assert.equal(rows[0]?.["stageTraceId"], STAGE_TRACE_ID);
});

test("every transient attempt is recorded when the retry budget is exhausted", async () => {
  const { prisma, rows } = recordingTracePrisma();

  await assert.rejects(
    invokerOver(
      adapterReturning([
        new ProviderError("transient", "upstream unavailable"),
      ]),
      prisma,
    ).invoke(request, context),
  );

  assert.equal(
    rows.length,
    3,
    "the provisional bound is 3 attempts (docs/12 D-10 item 1); each is a row",
  );
  assert.deepEqual(
    rows.map((r) => r["attemptNumber"]),
    [1, 2, 3],
  );
  assert.ok(rows.every((r) => r["outcome"] === "failure"));
});

// --- the non-blocking guarantee is unchanged ------------------------------

test("a failed trace write does not fail the provider call (DB §6.2)", async () => {
  const failing = {
    providerInvocation: {
      create: () => Promise.reject(new Error("trace store unreachable")),
    },
  } as unknown as PrismaClient;

  const errors: unknown[] = [];
  const invoker = createProviderInvoker({
    adapter: adapterReturning([ok]),
    rate,
    recorder: createProviderInvocationRecorder(failing),
    sleep: () => Promise.resolve(),
    random: () => 0,
    onRecordError: (error) => errors.push(error),
  });

  const response = await invoker.invoke(request, context);

  assert.equal(response.output, "ok", "the analysis is unaffected");
  assert.equal(errors.length, 1, "but the failure is surfaced, not silent");
});
