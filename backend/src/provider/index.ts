/**
 * Provider registry — the seam through which callers obtain an adapter.
 *
 * Adapter identity lives here rather than on the adapter, so it never travels
 * with a response and cannot leak upward (`AI-006`).
 *
 * Scope. This is a registry, not the routing layer. `AI §10.3` routing —
 * per-stage selection, capability-based selection, cost tiers, failover — is
 * deferred to Sprint 2 by `docs/12` D-4 (`AIQ-6`/`AQ-4`) and remains absent.
 *
 * The `AI §10.1` mechanisms — retry and backoff, response normalization, usage
 * accounting — now exist in `retry.ts`, `normalization.ts`, `cost.ts` and
 * `invoke.ts`. Compose them with `createProviderInvoker`; call an adapter
 * directly only in tests of the adapter itself.
 *
 * `AI-002` requires provider and model be configurable without a code deploy.
 * That configuration surface is Sprint 1's, alongside routing. Sprint 0 needs
 * only that a developer can obtain a working offline adapter, so selection is
 * a defaulted argument rather than an environment variable — adding config for
 * a capability nothing consumes yet would be speculative.
 */

import { createReplayProvider } from "./adapters/replay.js";
import { createStubProvider } from "./adapters/stub.js";
import type { ProviderAdapter } from "./capability.js";

/** Adapters available in this build. */
const REGISTRY = {
  stub: createStubProvider,
  // `AI-005` / `AI §10.5` step 3, registration only — routing is Sprint 2.
  // Constructed with no fixtures by default: a replay provider that has been
  // handed no recording legitimately answers nothing, and pre-loading one here
  // would make the registry own test data.
  replay: () => createReplayProvider(),
} as const satisfies Record<string, () => ProviderAdapter>;

export type ProviderId = keyof typeof REGISTRY;

export const DEFAULT_PROVIDER_ID: ProviderId = "stub";

export const availableProviders = (): readonly ProviderId[] =>
  Object.keys(REGISTRY) as ProviderId[];

/**
 * Constructs an adapter. Defaults to the offline stub so local development and
 * tests require no credentials and no network (`Roadmap` Sprint 0).
 */
export function createProvider(
  id: ProviderId = DEFAULT_PROVIDER_ID,
): ProviderAdapter {
  return REGISTRY[id]();
}

export {
  createProviderInvoker,
  type InvocationContext,
  type ProviderInvocationRecord,
  type ProviderInvocationRecorder,
  type ProviderInvoker,
  type ProviderInvokerDependencies,
} from "./invoke.js";
export {
  COST_SCALE,
  computeEstimatedCostUsd,
  formatUsd,
  parseUsd,
  rateFor,
  type TokenRate,
  type TokenRateTable,
  type TokenUsage,
} from "./cost.js";
export { normalizeError, normalizeResponse } from "./normalization.js";
// The real adapter is NOT in the registry: it needs a credential and a model,
// which the zero-argument registry signature cannot supply. `AI-002` configurability
// is unaffected — the composition root selects and constructs it. Adding it to
// the registry would mean either a partially-constructed adapter or the
// registry reading the environment, and both are worse.
export {
  createAnthropicProvider,
  classifyAnthropicError,
  type AnthropicAdapterOptions,
  type AnthropicMessagesClient,
} from "./adapters/anthropic.js";
export {
  createReplayProvider,
  replayKeyFor,
  type ReplayFixture,
  type ReplayOptions,
} from "./adapters/replay.js";
export { createStubProvider } from "./adapters/stub.js";
export {
  backoffDelayMs,
  executeWithRetry,
  MALFORMED_RESPONSE_MAX_ATTEMPTS,
  maxAttemptsFor,
  PROVISIONAL_TRANSIENT_RETRY_POLICY,
  type RetryPolicy,
} from "./retry.js";

export type {
  CapabilityRequest,
  CapabilityResponse,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderFailureClass,
  ProviderUsage,
} from "./capability.js";
export { ProviderError } from "./capability.js";
