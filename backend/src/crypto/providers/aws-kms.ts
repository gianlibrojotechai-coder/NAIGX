/**
 * AWS KMS — the real key provider
 * ([D-52](../../../../docs/27-D-52-Managed-Key-Service.md) §2).
 *
 * ⚠️ **UNVERIFIED AGAINST A LIVE SERVICE.** As of 2026-09-08 no AWS account or
 * credentials exist for this project, so this adapter has never made a real
 * KMS call. Its shape follows the documented API and the types check, and that
 * is *not* the same thing as working — this project has been bitten more than
 * once by code that compiled, ran, and did nothing
 * (`Playwright.chromiumSandbox`, `axe` on `file://`). Do not report `DB §13.1`
 * as satisfied on the strength of this file existing.
 *
 * **The integration test that discharges this is `tests/integration/kms-live.test.ts`.**
 * It skips unless `NAIGX_KMS_LIVE_TEST=1`, and it is the only thing that
 * proves the round trip. A skip means *not checked*, never *passed*.
 *
 * ## What it does
 *
 * Envelope encryption, exactly as D-52 §5 draws it. `GenerateDataKey` returns
 * a fresh AES-256 key **twice** — once in the clear for immediate use, once
 * wrapped under the CMK for storage. `Decrypt` turns the wrapped half back
 * into the plaintext half at process start. The CMK itself never leaves KMS,
 * which is the entire property being bought.
 *
 * ## Cost
 *
 * ⚠️ **Verify current pricing before provisioning.** D-52 §3 recorded
 * $1.00/month for one customer-managed key with 20,000 free requests, checked
 * on 2026-09-08 — that is a decision-record estimate on its date, not a
 * standing guarantee. Read the official pricing page again before creating the
 * key.
 *
 * The design keeps usage far inside the free allowance regardless: one
 * `GenerateDataKey` for the lifetime of the key, and one `Decrypt` per process
 * start. Tens of requests a month, not thousands, and it does not grow with
 * analysis volume.
 */

import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from "@aws-sdk/client-kms";

import { DATA_KEY_BYTES } from "../envelope.js";
import {
  KeyProviderRejectedError,
  KeyProviderUnavailableError,
  type KeyProvider,
  type WrappedDataKey,
} from "../key-provider.js";

export interface AwsKmsOptions {
  /** The CMK: a key id, alias (`alias/naigx`), or full ARN. */
  readonly keyId: string;
  /** Required — KMS is regional, and a key does not exist outside its region. */
  readonly region: string;
  /**
   * Injected only by the live integration test, which needs to point at a
   * specific endpoint. Production reads credentials from the ambient provider
   * chain (`SA §10.4` — "injected at runtime", never in source or images).
   */
  readonly client?: KMSClient;
}

/**
 * Errors that mean "the key is wrong" rather than "the network is down".
 *
 * The distinction matters operationally: unavailable is worth retrying and
 * paging about, rejected means the deployment is pointed at the wrong key or
 * the key is gone — and ⚠️ a *gone* CMK means this data and every backup of it
 * are unrecoverable (D-52 §6). The two must not read the same in a log.
 */
const REJECTION_NAMES = new Set([
  "IncorrectKeyException",
  "InvalidCiphertextException",
  "NotFoundException",
  "DisabledException",
  "KMSInvalidStateException",
  "AccessDeniedException",
]);

const classify = (error: unknown, name: string): Error => {
  const errorName =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  return REJECTION_NAMES.has(errorName)
    ? new KeyProviderRejectedError(name, error)
    : new KeyProviderUnavailableError(name, error);
};

export function createAwsKmsProvider(options: AwsKmsOptions): KeyProvider {
  const name = `aws-kms(${options.region})`;
  const client = options.client ?? new KMSClient({ region: options.region });

  return {
    name,

    async generateDataKey() {
      try {
        const result = await client.send(
          new GenerateDataKeyCommand({
            KeyId: options.keyId,
            // 256-bit, to match AES-256-GCM in `envelope.ts`. `KeySpec` rather
            // than `NumberOfBytes` because it is the named, self-documenting
            // form and cannot be off by a factor of eight.
            KeySpec: "AES_256",
          }),
        );

        const plaintext = result.Plaintext;
        const wrapped = result.CiphertextBlob;
        if (plaintext === undefined || wrapped === undefined) {
          throw new KeyProviderUnavailableError(
            name,
            "KMS returned no key material",
          );
        }
        if (plaintext.length !== DATA_KEY_BYTES) {
          throw new KeyProviderUnavailableError(
            name,
            `KMS returned a ${String(plaintext.length)}-byte key; AES-256 needs ${String(DATA_KEY_BYTES)}`,
          );
        }

        return { plaintext, wrapped };
      } catch (error) {
        if (
          error instanceof KeyProviderUnavailableError ||
          error instanceof KeyProviderRejectedError
        ) {
          throw error;
        }
        throw classify(error, name);
      }
    },

    async unwrap(wrapped: WrappedDataKey) {
      try {
        const result = await client.send(
          new DecryptCommand({
            CiphertextBlob: wrapped,
            // Naming the key is not redundant even though the blob identifies
            // it. It stops a blob wrapped under some *other* key this
            // principal can also use from silently decrypting — the confused
            // deputy KMS documents for symmetric decrypt.
            KeyId: options.keyId,
          }),
        );

        const plaintext = result.Plaintext;
        if (plaintext === undefined || plaintext.length !== DATA_KEY_BYTES) {
          throw new KeyProviderRejectedError(
            name,
            "KMS returned no usable key material",
          );
        }
        return plaintext;
      } catch (error) {
        if (
          error instanceof KeyProviderUnavailableError ||
          error instanceof KeyProviderRejectedError
        ) {
          throw error;
        }
        throw classify(error, name);
      }
    },
  };
}
