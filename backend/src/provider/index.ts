/**
 * Provider registry — the seam through which callers obtain an adapter.
 *
 * Adapter identity lives here rather than on the adapter, so it never travels
 * with a response and cannot leak upward (`AI-006`).
 *
 * Scope. This is a registry, not the routing layer. `AI §10.3` routing —
 * per-stage selection, capability-based selection, cost tiers, failover — is a
 * Sprint 1 deliverable and is deliberately absent. So is the retry, backoff,
 * normalization and usage-accounting machinery of `AI §10.1`.
 *
 * `AI-002` requires provider and model be configurable without a code deploy.
 * That configuration surface is Sprint 1's, alongside routing. Sprint 0 needs
 * only that a developer can obtain a working offline adapter, so selection is
 * a defaulted argument rather than an environment variable — adding config for
 * a capability nothing consumes yet would be speculative.
 */

import { createStubProvider } from "./adapters/stub.js";
import type { ProviderAdapter } from "./capability.js";

/** Adapters available in this build. */
const REGISTRY = {
  stub: createStubProvider,
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

export type {
  CapabilityRequest,
  CapabilityResponse,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderFailureClass,
  ProviderUsage,
} from "./capability.js";
export { ProviderError } from "./capability.js";
