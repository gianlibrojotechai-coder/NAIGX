/**
 * The key-service boundary ([D-52](../../../docs/27-D-52-Managed-Key-Service.md) §5).
 *
 * `DB §13.1` requires a **managed key service, never in application
 * configuration**, and states the property it is buying:
 *
 *   > so that a storage-layer compromise does not yield plaintext business
 *   > content
 *
 * ⚠️ THAT PROPERTY IS THE WHOLE REASON THIS INTERFACE IS SO NARROW. It has
 * exactly two operations, and neither of them can return the key that does the
 * unwrapping. A provider hands back an unwrapped **data** key; the key that
 * unwrapped it stays inside the service. Any implementation that reads key
 * material from the host — `.env`, a file, a local vault's unseal token —
 * satisfies the *types* here while delivering none of the property, which is
 * precisely what [D-52](../../../docs/27-D-52-Managed-Key-Service.md) §4
 * rejects at length.
 *
 * Two implementations exist, and the difference between them is deliberate:
 *
 * - `providers/key-file.ts` — the real one
 *   ([D-61](../../../docs/36-D-61-Host-Held-Key-File.md)). A root key held on
 *   the host wraps each data key. ⚠️ It is exercised fully in CI, unlike the
 *   managed service it replaced, which could never be.
 * - `providers/test-double.ts` — offline, deterministic, and **refuses to run
 *   in production**. It is what makes the envelope logic, the migration and
 *   every route testable with no key material at all.
 *
 * ⚠️ THE WARNING ABOVE NOW READS DIFFERENTLY, AND HONESTLY SO. A host-held key
 * *is* "key material read from the host", which the paragraph above describes
 * as satisfying the types while delivering none of the property. D-61 §3
 * explains why that ceased to be true here: once the deployment put cloud
 * credentials on the same host, both arrangements fell to the same attacker,
 * and `DB §13.1`'s managed-key-service row became an explicit v1.0 deviation
 * rather than a satisfied requirement. **The narrow interface is still the
 * right shape** — nothing outside a provider ever sees the wrapping key.
 */

/** An opaque wrapped data key. Safe to store; useless without the service. */
export type WrappedDataKey = Uint8Array;

/** A 32-byte AES-256 data key. ⚠️ Plaintext key material — never log, never persist. */
export type DataKey = Uint8Array;

/**
 * ⚠️ `DataKey` IS PLAINTEXT KEY MATERIAL AND `DB §13.2` CLASSIFIES IT
 * CREDENTIAL. It must never reach a log line, a trace, an error message, an
 * export, or telemetry. Nothing in this codebase serialises one, and nothing
 * should start.
 */

export interface KeyProvider {
  /** A name for logs and startup diagnostics. Never includes key material. */
  readonly name: string;

  /**
   * Generates a fresh data key and returns it **both** unwrapped and wrapped.
   *
   * Both halves come back together because that is the only moment the
   * plaintext data key legitimately exists outside the service: the caller
   * stores the wrapped half and uses the plaintext half. Asking a provider to
   * "wrap this key I already have" would invite generating key material on the
   * host, which is the thing being avoided.
   */
  generateDataKey(): Promise<{
    readonly plaintext: DataKey;
    readonly wrapped: WrappedDataKey;
  }>;

  /**
   * Unwraps a stored data key.
   *
   * @throws {KeyProviderUnavailableError} when the service cannot be reached —
   * distinct from a key that is genuinely invalid, because the two demand
   * different operator responses.
   */
  unwrap(wrapped: WrappedDataKey): Promise<DataKey>;
}

/**
 * The service could not be reached, or refused the request.
 *
 * ⚠️ AN INSTANCE THAT CANNOT UNWRAP ITS DATA KEY MUST NOT START
 * ([D-52](../../../docs/27-D-52-Managed-Key-Service.md) §5, last row). Starting
 * anyway would mean serving reads that return ciphertext where the caller
 * expects text — a failure that looks like data loss and is not detectable by
 * the client.
 */
export class KeyProviderUnavailableError extends Error {
  constructor(provider: string, cause?: unknown) {
    super(
      `Key service ${provider} is unavailable, so the data key cannot be ` +
        `unwrapped. The instance refuses to start rather than serve ` +
        `ciphertext as if it were content (D-52 §5).${detail(cause)}`,
    );
    this.name = "KeyProviderUnavailableError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Appends a string cause to the message.
 *
 * ⚠️ THE DETAIL HAS TO REACH THE MESSAGE, NOT ONLY `cause`. These errors are
 * read at startup, usually from a container log that prints the message and
 * nothing else — so "which key version is missing" or "no key has been
 * provisioned" would be invisible exactly when it is the only thing worth
 * knowing. Only string causes are inlined: a caught provider error goes to
 * `cause` untouched, because its own text can carry service internals.
 */
const detail = (cause: unknown): string =>
  typeof cause === "string" ? ` — ${cause}` : "";

/** The wrapped key was rejected as invalid — wrong key, wrong account, corrupt. */
export class KeyProviderRejectedError extends Error {
  constructor(provider: string, cause?: unknown) {
    super(
      `Key service ${provider} rejected the stored wrapped data key. This is ` +
        `not a transient failure: the key material does not belong to the ` +
        `configured key. ⚠️ Check that NAIGX_KEY_FILE points at the SAME root ` +
        `key this data was sealed under — losing that key destroys this data ` +
        `and every backup of it (D-61 §4).${detail(cause)}`,
    );
    this.name = "KeyProviderRejectedError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
