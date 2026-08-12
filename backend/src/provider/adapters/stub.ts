/**
 * Deterministic offline stub adapter — `Roadmap` Sprint 0 environment
 * deliverable: "Local development with stubbed provider; no network required
 * for NIE work."
 *
 * This is the only file in the Sprint 0 provider work that sits inside the
 * adapter boundary, and it is deliberately the least interesting one. It
 * performs no I/O, opens no socket, reads no credential, and imports no SDK.
 *
 * **It does not reason.** Producing plausible-looking analysis here would
 * invent behaviour that belongs to the NIE (`AI §3`), and would let a wiring
 * bug masquerade as a working pipeline. The output is an obviously synthetic
 * marker carrying a digest of the request, which is useful for asserting that
 * a request reached the provider unchanged and useless for anything else.
 */

import { createHash } from "node:crypto";

import type {
  CapabilityRequest,
  CapabilityResponse,
  ProviderAdapter,
  ProviderCapabilities,
} from "../capability.js";

/**
 * Declared honestly, per `AI §10.6` — "capability assumptions without
 * declaration" are prohibited, and a false declaration is worse than none.
 *
 * `structuredOutput` is **false**: the representation of `outputContract` is
 * undefined by the specifications (see `../capability.ts`), so this adapter
 * cannot conform to a contract it has no way to read. Declaring it false
 * routes callers down the `AI §10.2` degradation path, which is the correct
 * behaviour and has the side benefit of exercising that path locally.
 */
const STUB_CAPABILITIES: ProviderCapabilities = {
  structuredOutput: false,
  extendedContext: false,
  lowVarianceSampling: true, // trivially true: the stub is fully deterministic
  costLatencyTier: "stub",
};

/** Stable digest of everything that can vary a response. */
const digestOf = (request: CapabilityRequest): string =>
  createHash("sha256")
    .update(
      JSON.stringify([
        request.task,
        request.input,
        request.outputContract ?? null,
        request.preferLowVariance,
      ]),
    )
    .digest("hex")
    .slice(0, 16);

/**
 * Token counts are a deterministic proxy, not a tokenization. Real counts come
 * from a real provider's response in Sprint 1.
 */
const approximateTokens = (text: string): number => Math.ceil(text.length / 4);

export function createStubProvider(): ProviderAdapter {
  return {
    capabilities: STUB_CAPABILITIES,

    invoke(request: CapabilityRequest): Promise<CapabilityResponse> {
      const digest = digestOf(request);
      const output = `STUB_PROVIDER_RESPONSE task=${request.task} digest=${digest}`;

      const degradations: string[] = [];
      if (request.outputContract !== undefined) {
        degradations.push(
          "structured_output_unavailable: stub adapter cannot conform to an output contract",
        );
      }

      return Promise.resolve({
        output,
        usage: {
          inputTokens: approximateTokens(request.input),
          outputTokens: approximateTokens(output),
          // Fixed, so repeated calls are byte-identical. Real latency
          // measurement belongs to a real adapter in Sprint 1.
          latencyMs: 0,
        },
        degradations,
      });
    },
  };
}
