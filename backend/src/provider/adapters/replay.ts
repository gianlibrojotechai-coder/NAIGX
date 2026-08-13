/**
 * Replay adapter — the second provider required by `AI-005`.
 *
 * WHY THIS PROVIDER
 *
 * `AI-005` requires provider substitution be "verified by an automated test
 * that exercises a second provider", and `SA AR-43` names the risk it guards:
 * "an abstraction assumed to work is never exercised". The test must therefore
 * be **continuously passing** (`AI §10.5`), which rules out an adapter needing
 * credentials or a network — a test that only runs when a key is present is a
 * test that stops running.
 *
 * So this adapter replays responses from a supplied fixture set rather than
 * calling anything. That is not a contrivance to dodge the requirement: it is a
 * genuinely different implementation of the same port, with different declared
 * capabilities and its own error classification, and it is the mechanism
 * `AIQ-5` will need in Sprint 2 to run regression against *recorded* provider
 * responses instead of live ones.
 *
 * HOW IT DIFFERS FROM THE STUB — which is the point
 *
 *                      stub                     replay
 *   structuredOutput   false                    true
 *   extendedContext    false                    true
 *   lowVariance        true                     declared per fixture set
 *   output             synthetic digest         the recorded response
 *   failures           none                     classified, fixture-driven
 *
 * The two adapters degrade on *different* `AI §10.2` rows, so the abstraction's
 * degradation handling is exercised rather than merely present.
 *
 * ADAPTER BOUNDARY. This file may name a provider and classify its errors; that
 * is what `adapters/` is for (`AI-001`, AD-03). Nothing provider-shaped leaves
 * it: failures exit as the four `AI §10.4` classes and responses carry no
 * provider identity (`AI-006`).
 */

import { createHash } from "node:crypto";

import {
  ProviderError,
  type CapabilityRequest,
  type CapabilityResponse,
  type ProviderAdapter,
  type ProviderCapabilities,
  type ProviderFailureClass,
} from "../capability.js";

/**
 * What a recorded interaction may replay: either a response body or a
 * classified failure.
 *
 * A fixture declaring `failures` yields them in order before succeeding, which
 * is how a recorded rate-limit-then-success sequence is expressed. It is also
 * what lets the conformance test drive the shared retry path through this
 * adapter without special-casing anything in the abstraction layer.
 */
export interface ReplayFixture {
  /** Output to return once any declared failures are exhausted. */
  readonly output: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  /** Failure classes to raise, in order, before the output is returned. */
  readonly failures?: readonly ProviderFailureClass[];
}

export interface ReplayOptions {
  /** Fixtures by request key — see `replayKeyFor`. */
  readonly fixtures?: Readonly<Record<string, ReplayFixture>>;
  /**
   * Whether this recording was captured under low-variance sampling. Declared
   * honestly per `AI §10.6`: a recording made at default sampling cannot claim
   * determinism just because replaying it is repeatable.
   */
  readonly lowVarianceSampling?: boolean;
  /** ⚠️ UNDEFINED tier vocabulary — see `../capability.ts` and `docs/12` D-10. */
  readonly costLatencyTier?: string;
}

/**
 * Stable key for a request. Exported so a recorder can file a fixture under the
 * same key this adapter will look it up by.
 */
export function replayKeyFor(request: CapabilityRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        request.task,
        request.input,
        request.instructions ?? null,
        request.outputContract ?? null,
        request.preferLowVariance,
      ]),
    )
    .digest("hex")
    .slice(0, 16);
}

export function createReplayProvider(
  options: ReplayOptions = {},
): ProviderAdapter {
  const fixtures = options.fixtures ?? {};
  const lowVarianceSampling = options.lowVarianceSampling ?? false;

  const capabilities: ProviderCapabilities = {
    // A recording reproduces exactly what was captured, including a response
    // that satisfied an output contract.
    structuredOutput: true,
    extendedContext: true,
    lowVarianceSampling,
    costLatencyTier: options.costLatencyTier ?? "replay",
  };

  /** Remaining failures per key, consumed across calls so retries progress. */
  const pending = new Map<string, ProviderFailureClass[]>();

  return {
    capabilities,

    invoke(request: CapabilityRequest): Promise<CapabilityResponse> {
      const key = replayKeyFor(request);
      const fixture = fixtures[key];

      if (fixture === undefined) {
        // Provider-specific classification, made here and nowhere else. A
        // missing recording will not resolve by trying again, so it is
        // persistent — calling it transient would spend the retry budget
        // reproducing a certainty (`AI §10.4`).
        return Promise.reject(
          new ProviderError(
            "persistent",
            `No recorded response for request key ${key}`,
          ),
        );
      }

      if (!pending.has(key)) {
        pending.set(key, [...(fixture.failures ?? [])]);
      }
      const queued = pending.get(key);
      const next = queued?.shift();
      if (next !== undefined) {
        return Promise.reject(
          new ProviderError(next, `Recorded ${next} failure for key ${key}`),
        );
      }

      const degradations: string[] = [];
      if (request.preferLowVariance && !lowVarianceSampling) {
        // `AI §10.2`: degrade to the closest available and record that
        // determinism is reduced. The stub never takes this branch, so the two
        // adapters together cover both sides of it.
        degradations.push(
          "low_variance_unavailable: recording was not captured under low-variance sampling",
        );
      }

      return Promise.resolve({
        output: fixture.output,
        usage: {
          inputTokens: fixture.inputTokens,
          outputTokens: fixture.outputTokens,
          latencyMs: fixture.latencyMs,
        },
        degradations,
      });
    },
  };
}
