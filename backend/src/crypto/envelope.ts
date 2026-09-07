/**
 * The envelope: AES-256-GCM sealing, and a versioned wire format
 * ([D-52](../../../docs/27-D-52-Managed-Key-Service.md) §5,
 * [D-53](../../../docs/28-D-53-Encryption-Layers.md) §2).
 *
 * Applies to the three fields `DB §13.1` row 3 names — `raw_content`,
 * `structured_input`, `structured_output` — and to nothing else.
 *
 * ## The format
 *
 *     naigx.v1.<dekVersion>.<iv>.<tag>.<ciphertext>
 *
 * Six dot-separated parts, the last three base64url. It is text rather than
 * binary for one reason: `raw_content` is a `String` column and
 * `structured_input`/`structured_output` are `Json`, so one text encoding
 * stores in all three without a column type migration and without a second
 * codec to keep in step.
 *
 * ⚠️ `dekVersion` IS WHAT MAKES ROTATION POSSIBLE WITHOUT REWRITING EVERY ROW
 * (`SA §10.4` — "rotation possible without code change"). A row records which
 * data key sealed it, so a new key can start sealing new rows while old rows
 * stay readable under the old one. Dropping this field would turn every
 * rotation into a full-table rewrite with no way to tell how far it had got.
 *
 * ## Why GCM, and why a fresh IV every time
 *
 * GCM is authenticated: a tampered ciphertext **fails to open** instead of
 * decrypting to plausible garbage. That matters here because these fields feed
 * reasoning and exports, and silently-corrupted input would surface as a bad
 * analysis rather than as an error.
 *
 * ⚠️ THE IV IS RANDOM PER VALUE AND MUST STAY THAT WAY. Reusing an IV under one
 * key does not weaken GCM gradually — it breaks it catastrophically, leaking
 * the XOR of the plaintexts and, with a little work, the authentication
 * subkey. There is no counter here and no derivation from the content; every
 * seal calls `randomBytes`.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import type { DataKey } from "./key-provider.js";

/** The format marker. Also the plaintext/ciphertext discriminator — see `isSealed`. */
export const ENVELOPE_PREFIX = "naigx.v1";

/** 96 bits, the size GCM is specified for. Other sizes trigger a slower, weaker path. */
const IV_BYTES = 12;

/** GCM's authentication tag, at full length. */
const TAG_BYTES = 16;

/** AES-256. */
export const DATA_KEY_BYTES = 32;

const b64 = (value: Uint8Array): string =>
  Buffer.from(value).toString("base64url");

const unb64 = (value: string): Buffer => Buffer.from(value, "base64url");

/** A sealed value failed to open. The cause is never included — it can carry plaintext. */
export class EnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvelopeError";
  }
}

/**
 * Is this value already sealed?
 *
 * ⚠️ PREFIX DETECTION IS DELIBERATE AND HAS ONE SHARP EDGE.
 * [D-53](../../../docs/28-D-53-Encryption-Layers.md) §6 chose it: "the
 * envelope's version prefix distinguishes encrypted from not", because the
 * backfill cannot be a SQL migration (it needs the data key) and so there is a
 * window in which a table holds both.
 *
 * The edge: a user could submit a document that literally begins
 * `naigx.v1.`. That value would then be *read back* as though it were sealed,
 * fail to open, and raise — their own analysis becomes unreadable. It cannot
 * leak anything or decrypt anything else, and `open` raises rather than
 * guessing, so the failure is loud. Accepted over a schema change, and noted
 * here so the next person meets it as a known edge rather than a mystery.
 */
export const isSealed = (value: string): boolean =>
  value.startsWith(`${ENVELOPE_PREFIX}.`);

/**
 * Seals a plaintext string under `key`, recording `dekVersion` in the output.
 */
export function seal(
  plaintext: string,
  key: DataKey,
  dekVersion: number,
): string {
  assertKeyLength(key);

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  // ⚠️ THE VERSION IS AUTHENTICATED, NOT MERELY WRITTEN ALONGSIDE. Binding it
  // as additional authenticated data means an attacker cannot relabel a row to
  // point at a different (say, deliberately weakened or leaked) key version:
  // the tag check fails. Without this, the version prefix would be attacker-
  // editable metadata sitting outside the integrity guarantee.
  const aad = Buffer.from(`${ENVELOPE_PREFIX}.${String(dekVersion)}`, "utf8");
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    String(dekVersion),
    b64(iv),
    b64(tag),
    b64(ciphertext),
  ].join(".");
}

/** Which data key sealed this value. Read before `open`, to pick the key. */
export function sealedKeyVersion(sealedValue: string): number {
  const parts = sealedValue.split(".");
  // "naigx", "v1", version, iv, tag, ciphertext
  if (parts.length !== 6) {
    throw new EnvelopeError("Malformed envelope: expected 6 parts");
  }
  const version = Number(parts[2]);
  if (!Number.isInteger(version) || version < 1) {
    throw new EnvelopeError("Malformed envelope: bad data key version");
  }
  return version;
}

/**
 * Opens a sealed value.
 *
 * @throws {EnvelopeError} if the value is not a well-formed envelope, or if
 * the tag does not verify. **Both are refusals, never a fallback to returning
 * the input** — a decrypt path that hands back its own ciphertext on failure
 * is how ciphertext reaches a user's screen looking like corruption.
 */
export function open(sealedValue: string, key: DataKey): string {
  assertKeyLength(key);

  const parts = sealedValue.split(".");
  if (parts.length !== 6 || `${parts[0]}.${parts[1]}` !== ENVELOPE_PREFIX) {
    throw new EnvelopeError("Malformed envelope: not a NAIGX v1 envelope");
  }

  const version = sealedKeyVersion(sealedValue);
  const iv = unb64(parts[3] as string);
  const tag = unb64(parts[4] as string);
  const ciphertext = unb64(parts[5] as string);

  if (iv.length !== IV_BYTES) {
    throw new EnvelopeError("Malformed envelope: bad IV length");
  }
  if (tag.length !== TAG_BYTES) {
    // A short tag is a real attack, not a typo: GCM will happily verify against
    // a truncated tag, and each byte dropped divides the forgery cost by 256.
    throw new EnvelopeError(
      "Malformed envelope: bad authentication tag length",
    );
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(`${ENVELOPE_PREFIX}.${String(version)}`, "utf8"));
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // The underlying error is swallowed on purpose: OpenSSL's message says
    // nothing useful here, and the decipher object can hold plaintext
    // fragments that must not reach a log.
    throw new EnvelopeError(
      "Authentication failed: the value was sealed with a different key, or " +
        "has been altered since it was written",
    );
  }
}

function assertKeyLength(key: DataKey): void {
  if (key.length !== DATA_KEY_BYTES) {
    throw new EnvelopeError(
      `Data key must be ${String(DATA_KEY_BYTES)} bytes for AES-256`,
    );
  }
}

/**
 * Constant-time comparison, for tests and for any future check that compares
 * key-derived material. Exported so nobody reaches for `===` on a secret.
 */
export function secretEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
