/**
 * The provider abstraction layer (`AI §10.1`).
 *
 * Composes the three mechanisms `AI §10.1` places between the NIE and an
 * adapter — retry and backoff, response normalization, usage accounting — into
 * one entry point the NIE will call in place of an adapter.
 *
 * DELIBERATELY ABSENT: model routing. `AI §10.3` routing is deferred to
 * Sprint 2 by `docs/12` D-4 (`AIQ-6`/`AQ-4`), so this takes the adapter it is
 * given rather than selecting one. When routing arrives it wraps this, and
 * nothing here changes.
 *
 * The NIE stays provider-neutral: the invoker's request type is the
 * domain-expressed `CapabilityRequest`, its response carries no provider
 * identity, and its failures are the four `AI §10.4` classes. Nothing in this
 * file imports an adapter or names a provider.
 */

import {
  ProviderError,
  type CapabilityRequest,
  type CapabilityResponse,
  type InvokeOptions,
  type ProviderAdapter,
  type ProviderFailureClass,
} from "./capability.js";
import { computeEstimatedCostUsd, type TokenRate } from "./cost.js";
import { normalizeError, normalizeResponse } from "./normalization.js";
import {
  executeWithRetry,
  PROVISIONAL_TRANSIENT_RETRY_POLICY,
  type RetryPolicy,
} from "./retry.js";

/**
 * One row of `ProviderInvocation` (`DB §4.7`), written per *call* — so a
 * retried invocation produces one row per attempt, which is what makes
 * `attempt_number` meaningful and what `FR-093` means by "provider failure is
 * recorded in the trace with full detail".
 *
 * `stageTraceId` and `modelVersionId` are identifier references, not foreign
 * keys (`docs/12` D-9, `DB §1.4`). They are supplied by the caller because the
 * stage that owns them is NIE territory.
 */
export interface ProviderInvocationRecord {
  readonly stageTraceId: string;
  readonly modelVersionId: string;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Decimal string, USD, `COST_SCALE` places (`docs/12` D-4). */
  readonly estimatedCostUsd: string;
  /**
   * ⚠️ VOCABULARY UNSPECIFIED (`docs/12` D-10). `DB §4.7` requires an
   * `outcome` and names no values; detail lives in `errorClass`.
   */
  readonly outcome: "success" | "failure";
  readonly errorClass: ProviderFailureClass | null;
  readonly attemptNumber: number;
  /** True when a `AI §10.2` degradation was applied on this call. */
  readonly fallbackUsed: boolean;
}

export interface ProviderInvocationRecorder {
  record(invocation: ProviderInvocationRecord): Promise<void>;
}

/** Identifiers the trace row needs, which only the calling stage knows. */
export interface InvocationContext {
  readonly stageTraceId: string;
  readonly modelVersionId: string;
  /** `MODEL_VERSION.model_key`, used to select the configured rate. */
  readonly modelKey: string;
}

export interface ProviderInvokerDependencies {
  readonly adapter: ProviderAdapter;
  /** Rate for the model this adapter serves (`docs/12` D-4). */
  readonly rate: TokenRate;
  readonly recorder: ProviderInvocationRecorder;
  readonly policy?: RetryPolicy;
  /** Monotonic-ish millisecond source; injected so latency is testable. */
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
  /**
   * Notified when a trace write fails. Trace writes are non-blocking and a
   * trace failure never fails an analysis (`DB §6.2`, `SA §3.10`), so the
   * error is surfaced here rather than thrown.
   */
  readonly onRecordError?: (error: unknown) => void;
}

export interface ProviderInvoker {
  invoke(
    request: CapabilityRequest,
    context: InvocationContext,
    options?: InvokeOptions,
  ): Promise<CapabilityResponse>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function createProviderInvoker(
  deps: ProviderInvokerDependencies,
): ProviderInvoker {
  const policy = deps.policy ?? PROVISIONAL_TRANSIENT_RETRY_POLICY;
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? defaultSleep;
  const random = deps.random ?? Math.random;

  /**
   * Records one attempt. Never throws: a failed trace write must not turn a
   * successful provider call into a failed one (`DB §6.2`).
   */
  const record = async (
    invocation: ProviderInvocationRecord,
  ): Promise<void> => {
    try {
      await deps.recorder.record(invocation);
    } catch (error) {
      deps.onRecordError?.(error);
    }
  };

  const invoke = async (
    request: CapabilityRequest,
    context: InvocationContext,
    options: InvokeOptions = {},
  ): Promise<CapabilityResponse> =>
    executeWithRetry(
      async (attempt) => {
        // ⚠️ NO ATTEMPT — first or retry — STARTS AFTER CANCELLATION. This is
        // the half every adapter gets regardless of whether it can abort a
        // request in flight: once the analysis is terminal (`FR-094`), a
        // retry of a transient failure would be a paid call for an answer
        // nobody is waiting on. Persistent, so the retry loop stops here.
        if (options.signal?.aborted === true) {
          throw new ProviderError(
            "persistent",
            "Provider call not started: the analysis was cancelled at its deadline",
          );
        }

        const startedAt = now();

        try {
          const response = normalizeResponse(
            await deps.adapter.invoke(request, options),
          );
          const latencyMs = Math.max(0, now() - startedAt);

          await record({
            stageTraceId: context.stageTraceId,
            modelVersionId: context.modelVersionId,
            latencyMs,
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            estimatedCostUsd: computeEstimatedCostUsd(
              response.usage,
              deps.rate,
            ),
            outcome: "success",
            errorClass: null,
            attemptNumber: attempt,
            fallbackUsed: response.degradations.length > 0,
          });

          return response;
        } catch (error) {
          const failure = normalizeError(error);
          const latencyMs = Math.max(0, now() - startedAt);

          // A failed call consumed no accountable tokens: the provider either
          // did not answer or answered unusably. Recording an invented token
          // count would corrupt the unit economics `TV-4` rests on.
          await record({
            stageTraceId: context.stageTraceId,
            modelVersionId: context.modelVersionId,
            latencyMs,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: "0.00000000",
            outcome: "failure",
            errorClass: failure.failureClass,
            attemptNumber: attempt,
            fallbackUsed: false,
          });

          throw failure;
        }
      },
      { policy, sleep, random },
    );

  return { invoke };
}
