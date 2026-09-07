/**
 * The offline key provider — for tests, local development, and nothing else.
 *
 * ⚠️ THIS IS THE THING [D-52](../../../../docs/27-D-52-Managed-Key-Service.md)
 * §4 FORBIDS IN PRODUCTION, AND IT ENFORCES THAT ITSELF.
 *
 * D-52 is explicit that a local key "is not a cheaper version of this
 * decision, it is the absence of it": the application-level layer exists so a
 * storage-layer compromise yields no plaintext, and a key on the same host
 * yields plaintext to anyone who has the host. So this provider is not a
 * fallback, a development shortcut that might survive to production, or
 * something to reach for when KMS credentials are inconvenient.
 *
 * It exists so the envelope logic, the backfill, the search path and every
 * route are testable with **no AWS account and no spend** — which is the only
 * reason the rest of Phase 3 could be built and verified before credentials
 * existed.
 *
 * The guard below is the difference between a test double and a security
 * hole. `createTestKeyProvider` throws under `NODE_ENV=production`, so the
 * forbidden configuration cannot boot even if someone wires it there
 * deliberately.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { DATA_KEY_BYTES, EnvelopeError } from "../envelope.js";
import {
  KeyProviderRejectedError,
  type DataKey,
  type KeyProvider,
  type WrappedDataKey,
} from "../key-provider.js";

/**
 * A fixed "root key", standing in for the CMK.
 *
 * It is a constant in this repository, which is exactly why the production
 * guard exists. Being deterministic is a feature *for a test*: a wrapped key
 * written by one test run opens in the next, so fixtures are stable.
 */
const DOUBLE_ROOT_KEY = Buffer.alloc(DATA_KEY_BYTES, 0x2a);

const IV_BYTES = 12;

export interface TestKeyProviderOptions {
  /** Forces failures, so the refuse-to-start path can be tested. */
  readonly failUnwrap?: boolean;
  /** Overrides the environment check. Only tests of the guard itself pass this. */
  readonly env?: NodeJS.ProcessEnv;
}

export function createTestKeyProvider(
  options: TestKeyProviderOptions = {},
): KeyProvider {
  const env = options.env ?? process.env;

  // ⚠️ THE GUARD. Not advisory — the process does not get a provider.
  if (env["NODE_ENV"]?.trim() === "production") {
    throw new Error(
      "The offline key provider must never be used in production. " +
        "DB §13.1 requires a managed key service and D-52 §4 rejects a " +
        "locally-held key as the absence of that decision, not a cheaper " +
        "form of it. Configure NAIGX_KMS_KEY_ID and AWS credentials.",
    );
  }

  return {
    name: "test-double",

    generateDataKey() {
      const plaintext = randomBytes(DATA_KEY_BYTES);
      return Promise.resolve({ plaintext, wrapped: wrap(plaintext) });
    },

    unwrap(wrapped: WrappedDataKey) {
      if (options.failUnwrap === true) {
        return Promise.reject(
          new KeyProviderRejectedError("test-double", "forced failure"),
        );
      }
      return Promise.resolve(unwrapKey(wrapped));
    },
  };
}

/** AES-GCM under the fixed root key. Real enough that a tampered blob is rejected. */
function wrap(plaintext: DataKey): WrappedDataKey {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", DOUBLE_ROOT_KEY, iv);
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function unwrapKey(wrapped: WrappedDataKey): DataKey {
  const buffer = Buffer.from(wrapped);
  if (buffer.length < IV_BYTES + 16) {
    throw new KeyProviderRejectedError("test-double", "wrapped key too short");
  }
  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(IV_BYTES, IV_BYTES + 16);
  const body = buffer.subarray(IV_BYTES + 16);

  const decipher = createDecipheriv("aes-256-gcm", DOUBLE_ROOT_KEY, iv);
  decipher.setAuthTag(tag);
  try {
    const key = Buffer.concat([decipher.update(body), decipher.final()]);
    if (key.length !== DATA_KEY_BYTES) {
      throw new EnvelopeError("unwrapped key has the wrong length");
    }
    return key;
  } catch (error) {
    throw new KeyProviderRejectedError("test-double", error);
  }
}
