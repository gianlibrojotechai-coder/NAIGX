/**
 * Provider capability interface — the port the NIE addresses (`AI §10.2`).
 *
 * The NIE expresses requests in domain terms — reasoning task, input, output
 * contract, determinism preference — never in provider terms (`AI §10.2`).
 * Nothing in this file names a provider, imports a provider SDK, or performs
 * I/O. Provider-specific code lives only under `adapters/` (`AI-001`, AD-03,
 * `SA` Appendix A check 1).
 *
 * Scope. This is the Sprint 0 minimum: the contract plus capability
 * declaration, enough for a developer to run locally against a stub with no
 * network (`Roadmap` Sprint 0). The abstraction-layer *mechanisms* named in
 * `AI §10.1` — routing, retry and backoff, response normalization, usage
 * accounting — are Sprint 1 deliverables and are deliberately not built here.
 *
 * ⚠️ Several shapes below are **not specified** by the authoritative documents.
 * They are marked `UNDEFINED` and kept as loose as possible so Sprint 1 can fix
 * them without unpicking an invented commitment. See `README.md` in this
 * directory for the full list.
 */

/**
 * Capabilities an adapter declares. Exactly the four in `AI §10.2`.
 *
 * `AI §10.2`: "Detection is explicit, not assumed. Adapters declare
 * capabilities; the abstraction layer selects strategy from declarations."
 * `AI §10.6` prohibits capability assumptions without declaration, so every
 * field here is required — an adapter cannot stay silent about one.
 */
export interface ProviderCapabilities {
  /** Can the provider guarantee output conforming to a supplied contract? */
  readonly structuredOutput: boolean;
  /** Does the provider offer the extended context window tier? */
  readonly extendedContext: boolean;
  /** Can sampling be constrained toward determinism? */
  readonly lowVarianceSampling: boolean;
  /**
   * Cost/latency tier this adapter occupies, used for routing (`AI §10.3`).
   *
   * ⚠️ UNDEFINED: `AI §10.2` requires routing "to the closest available tier"
   * but names no tier vocabulary and no ordering. Typed as an opaque string
   * rather than an invented enum.
   */
  readonly costLatencyTier: string;
}

/**
 * A request expressed in domain terms (`AI §10.2`).
 */
export interface CapabilityRequest {
  /**
   * The reasoning task being performed.
   *
   * ⚠️ UNDEFINED: the task vocabulary belongs to the NIE's stage set
   * (`AI §3`), which does not exist yet. Opaque string until Sprint 1.
   */
  readonly task: string;

  /** The content to reason over. */
  readonly input: string;

  /**
   * The output contract the response must satisfy.
   *
   * ⚠️ UNDEFINED: `AI §10.2` names "output contract" as a request dimension
   * but specifies no representation. `AD-08` establishes schema-validated
   * structured output, and `AI §9.3` has schemas drive both generation
   * guidance and validation — but neither fixes the format crossing this
   * boundary. Optional and opaque until Sprint 1 defines it.
   */
  readonly outputContract?: string;

  /**
   * Whether the caller prefers low-variance sampling.
   *
   * Expressed as a boolean rather than an invented scale, because it maps
   * one-to-one onto the declared `lowVarianceSampling` capability. When the
   * preference cannot be honoured the adapter records a degradation
   * (`AI §10.2`: "record that determinism is reduced").
   */
  readonly preferLowVariance: boolean;
}

/**
 * Usage accounting for one call (`SA §3.5`, `NFR-083`).
 *
 * ⚠️ Cost is deliberately absent. `SA §3.5` requires cost be recorded, but no
 * document fixes a currency, unit, or precision. Recording a number without a
 * unit would be worse than recording nothing. Sprint 1 must define it.
 */
export interface ProviderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
}

/**
 * A normalized response. Provider identity is structurally absent — there is
 * no field for it, so `AI-006` cannot be violated by this type.
 */
export interface CapabilityResponse {
  readonly output: string;
  readonly usage: ProviderUsage;
  /**
   * Fallback strategies applied, if any. Required by `AI §10.2` and `§10.4`,
   * which mandate *recording* that a degradation occurred.
   *
   * ⚠️ UNDEFINED: the documents require the record but specify no vocabulary.
   * Free-text until Sprint 1.
   */
  readonly degradations: readonly string[];
}

/** Failure classes, exactly as tabulated in `AI §10.4`. */
export type ProviderFailureClass =
  "transient" | "persistent" | "capability_mismatch" | "malformed_response";

/**
 * A normalized provider failure.
 *
 * `SA §3.5`: "provider errors never surface upward in provider-specific form".
 * This type carries no provider identifier, and `FR-093` forbids provider
 * detail reaching a user. The underlying error belongs on `cause`, which is
 * for logs and traces only.
 */
export class ProviderError extends Error {
  readonly failureClass: ProviderFailureClass;

  constructor(
    failureClass: ProviderFailureClass,
    message: string,
    options: { readonly cause?: unknown } = {},
  ) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "ProviderError";
    this.failureClass = failureClass;
  }
}

/**
 * The contract every adapter implements (`AI §10.5` step 1).
 *
 * Note there is no `name` or `id` on the adapter itself. Identity is held by
 * the registry that constructs adapters, so it never travels alongside a
 * response and cannot leak upward (`AI-006`).
 */
export interface ProviderAdapter {
  readonly capabilities: ProviderCapabilities;
  invoke(request: CapabilityRequest): Promise<CapabilityResponse>;
}
