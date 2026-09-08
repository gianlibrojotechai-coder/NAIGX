/**
 * Host-held key file — the v1.0 key provider ([D-61](../../../../docs/36-D-61-Host-Held-Key-File.md)).
 *
 * Replaces the managed key service [D-52](../../../../docs/27-D-52-Managed-Key-Service.md)
 * selected during hardening. **The envelope architecture is unchanged**: this
 * still hands back a *data* key wrapped under a root key, the database still
 * stores only the wrapped half, and `envelope.ts` never learns where either
 * came from.
 *
 * ## ⚠️ WHAT THIS BUYS, AND WHAT IT DOES NOT
 *
 * `DB §13.1` states the property the application-level layer exists for:
 *
 *   > so that a storage-layer compromise does not yield plaintext business
 *   > content
 *
 * **That property holds here.** The root key lives in a file outside the
 * database, outside every backup, and outside the container image — so a
 * stolen dump, a stolen backup or a `pg_dump` exfiltration yields ciphertext
 * and nothing else, exactly as it did under KMS.
 *
 * **What is lost, relative to a managed service** (D-61 §4, and it is not
 * small):
 *
 *   · **No central revocation.** With KMS a suspected compromise could be
 *     answered by disabling the key from anywhere. Here the only remedy is to
 *     replace the root key and re-encrypt, which needs access to the host.
 *   · **No decrypt audit.** KMS logs every `Decrypt` to CloudTrail. Nothing
 *     here records that an unwrap happened.
 *   · **A full host compromise reaches the key.** ⚠️ So did host-resident AWS
 *     credentials under D-59 — this is a narrower loss than it first appears,
 *     and D-61 §3 sets out the comparison honestly rather than claiming
 *     equivalence.
 *
 * ## The permission model, and why it is enforced here
 *
 * The backend container runs as **uid 1000**, non-root (`Dockerfile`, Phase 1).
 * A `root:root 0600` file would therefore be unreadable by the application and
 * fail closed forever, so "root-owned" is the wrong rule. What matters is that
 * **nothing but the owner can read it**, and that is checked on every load
 * rather than trusted to deployment discipline.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import { DATA_KEY_BYTES } from "../envelope.js";
import {
  KeyProviderRejectedError,
  KeyProviderUnavailableError,
  type DataKey,
  type KeyProvider,
  type WrappedDataKey,
} from "../key-provider.js";

/** AES-256-GCM, matching `envelope.ts` so one algorithm choice governs both. */
const ALGORITHM = "aes-256-gcm";

/** 96-bit IV — the GCM-recommended size, as in `envelope.ts`. */
const IV_BYTES = 12;

/** GCM authentication tag. */
const TAG_BYTES = 16;

/** The root key is AES-256, like the data keys it wraps. */
const ROOT_KEY_BYTES = 32;

export interface KeyFileProviderOptions {
  /** Absolute path to the root key file. */
  readonly path: string;
}

/**
 * Reads and validates the root key.
 *
 * ⚠️ EVERY FAILURE PATH HERE IS FAIL-CLOSED, and that is the point. A key file
 * that is missing, readable by other accounts, or the wrong length is not a
 * degraded mode to warn about and continue from — an instance in that state
 * would either be unable to read its own data or be protecting it with
 * something anyone on the box can read. Both are refusals.
 */
async function readRootKey(path: string): Promise<Buffer> {
  let info;
  try {
    info = await stat(path);
  } catch {
    // The underlying errno is deliberately dropped: "no such file" and
    // "permission denied on the directory" both mean the same thing to an
    // operator here, and the guidance below is the same for either.
    throw new KeyProviderUnavailableError(
      `key-file(${path})`,
      `no key file at ${path}. Create it with 32 random bytes, base64 or hex, ` +
        `readable only by the account the application runs as`,
    );
  }

  if (!info.isFile()) {
    throw new KeyProviderUnavailableError(
      `key-file(${path})`,
      `${path} is not a regular file`,
    );
  }

  // ⚠️ THE CHECK THAT MATTERS. `0o077` is every group and other permission
  // bit; any of them set means an account that is not the owner can read the
  // key that unwraps every sealed field in the database. Refusing here is the
  // only enforcement there is — nothing else in the stack can tell.
  //
  // Ownership is deliberately NOT required to be root: the container runs as
  // uid 1000, so a root-owned 0600 file would be unreadable and this provider
  // would fail closed permanently (D-61 §5).
  //
  // ⚠️ POSIX ONLY, AND THIS IS NOT A WEAKENING. Windows does not implement
  // mode bits — it reports `0444` for a file `chmod 0400` just created, because
  // the bits are a compatibility shim over an ACL model they cannot express.
  // Enforcing them there would refuse every key file on a developer machine
  // while proving nothing about who can actually read it. **Production is
  // Linux in a container** (`Dockerfile`), so the check always runs where the
  // property is claimed. On Windows the file's real protection is its ACL,
  // which this cannot see and does not pretend to.
  if (process.platform !== "win32") {
    const mode = info.mode & 0o777;
    if ((mode & 0o077) !== 0) {
      throw new KeyProviderUnavailableError(
        `key-file(${path})`,
        `${path} is mode ${mode.toString(8).padStart(4, "0")}; it must not be ` +
          `readable or writable by group or other. Use chmod 0400`,
      );
    }
  }

  const raw = (await readFile(path, "utf8")).trim();

  // Accepted in base64 or hex because both are what `openssl rand` produces
  // and an operator should not have to remember which. Length is what is
  // actually checked.
  const decoded = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (decoded.length !== ROOT_KEY_BYTES) {
    throw new KeyProviderUnavailableError(
      `key-file(${path})`,
      `key file decodes to ${String(decoded.length)} bytes; ${String(ROOT_KEY_BYTES)} are required. ` +
        `Generate with: openssl rand -base64 32`,
    );
  }

  return decoded;
}

/**
 * A `KeyProvider` backed by a root key on the host filesystem.
 *
 * The wrapped form is `iv || tag || ciphertext` — the same layout discipline as
 * `envelope.ts`, kept deliberately boring so a wrapped key is inspectable
 * without a tool.
 */
export function createKeyFileProvider(
  options: KeyFileProviderOptions,
): KeyProvider {
  const name = `key-file(${options.path})`;

  return {
    name,

    async generateDataKey() {
      const rootKey = await readRootKey(options.path);
      // The data key is generated here rather than derived from the root key.
      // Derivation would make every data key recoverable from the root key
      // alone with no stored material, which quietly removes the point of
      // storing a wrapped key at all.
      const plaintext = randomBytes(DATA_KEY_BYTES);
      const iv = randomBytes(IV_BYTES);

      const cipher = createCipheriv(ALGORITHM, rootKey, iv);
      const ciphertext = Buffer.concat([
        cipher.update(plaintext),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();

      return {
        plaintext: new Uint8Array(plaintext),
        wrapped: new Uint8Array(Buffer.concat([iv, tag, ciphertext])),
      };
    },

    async unwrap(wrapped: WrappedDataKey): Promise<DataKey> {
      const rootKey = await readRootKey(options.path);
      const buffer = Buffer.from(wrapped);

      if (buffer.length <= IV_BYTES + TAG_BYTES) {
        throw new KeyProviderRejectedError(
          name,
          "wrapped key is too short to contain an IV, a tag and ciphertext",
        );
      }

      const iv = buffer.subarray(0, IV_BYTES);
      const tag = buffer.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
      const ciphertext = buffer.subarray(IV_BYTES + TAG_BYTES);

      let plaintext: Buffer;
      try {
        const decipher = createDecipheriv(ALGORITHM, rootKey, iv);
        decipher.setAuthTag(tag);
        plaintext = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
      } catch (error) {
        // ⚠️ REJECTED, NOT UNAVAILABLE. A failed GCM tag means this wrapped key
        // does not belong to this root key — a different key file, or tampering.
        // Retrying cannot help, and the two cases demand different operator
        // responses (D-52 §5, preserved by D-61).
        throw new KeyProviderRejectedError(name, error);
      }

      if (plaintext.length !== DATA_KEY_BYTES) {
        throw new KeyProviderRejectedError(
          name,
          `unwrapped ${String(plaintext.length)} bytes; a data key is ${String(DATA_KEY_BYTES)}`,
        );
      }

      return new Uint8Array(plaintext);
    },
  };
}
