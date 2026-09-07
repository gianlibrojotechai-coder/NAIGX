/**
 * Token generation and credential hashing (`API §3.1`, `NFR-022`).
 *
 * TOKENS ARE OPAQUE AND SERVER-VALIDATED, NOT JWT. `API §3.1` chose this so
 * revocation is immediate: "a stateless JWT cannot be revoked before expiry,
 * which is unacceptable when a session grants access to confidential business
 * content". A token here carries no claims and means nothing without the row
 * it hashes to.
 *
 * ⚠️ TOKENS ARE STORED HASHED, NEVER RAW (`DB §4.1`, `§13.2`). The raw value
 * is returned to the caller once, at issuance, and never persisted. Theft of
 * the database yields hashes that cannot be presented.
 *
 * WHY SHA-256 FOR TOKENS AND SCRYPT FOR PASSWORDS. They defend against
 * different attacks. A token is 256 bits of CSPRNG output, so an attacker
 * holding its hash cannot search the space and a slow hash buys nothing while
 * costing a lookup on every request. A password is chosen by a person and is
 * therefore guessable, so `NFR-022`'s "current password-hashing standard"
 * means a deliberately slow, salted, memory-hard function.
 *
 * WHY SCRYPT AND NOT ARGON2 OR BCRYPT. `NFR-022` names a standard, not a
 * library. `scrypt` is in Node's core crypto, is memory-hard, and adds **no
 * native dependency** — argon2 and bcrypt each add one, and a native module is
 * a build and deployment cost this project has so far avoided entirely.
 */

import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * 32 bytes of CSPRNG output, base64url.
 *
 * Unguessable by construction, which is what lets a token be the *sole*
 * evidence of anonymous ownership: an analysis id is a name, a token is a
 * credential, and only this function produces the second.
 */
export const generateToken = (): string =>
  randomBytes(32).toString("base64url");

/** A family identifier for a refresh-token lineage (`D-44` §3.4). */
export const generateFamilyId = (): string => randomUUID();

/**
 * How a token is stored and looked up.
 *
 * Unsalted deliberately: the lookup is by hash, so a per-value salt would make
 * the row unfindable from the presented token. Safe here only because the
 * input is high-entropy — never use this for a password.
 */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

// --- credentials ------------------------------------------------------------

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;

/**
 * `NFR-022` — hashed, never plaintext.
 *
 * Stored as `scrypt$<salt-hex>$<key-hex>`. The algorithm is named in the
 * stored value rather than assumed, so a future change can be rolled out by
 * reading what each row actually used instead of guessing from its shape.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = await scrypt(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Whether a password matches a stored hash.
 *
 * ⚠️ CONSTANT-TIME COMPARISON. `timingSafeEqual`, not `===`: a short-circuiting
 * comparison leaks how much of the derived key matched, which is enough to
 * recover it byte by byte. `API-001` also requires the *whole endpoint* to be
 * timing-indistinguishable — see `verifyPasswordAgainstMissingUser`.
 *
 * Returns false rather than throwing on a malformed stored value. A row that
 * cannot be parsed is a row nobody can authenticate against, which is the
 * safe reading.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1] ?? "", "hex");
  const expected = Buffer.from(parts[2] ?? "", "hex");
  if (salt.length === 0 || expected.length !== SCRYPT_KEY_LENGTH) return false;

  const derived = await scrypt(password, salt, SCRYPT_KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}

/**
 * The work a login does when the email matches no account.
 *
 * ⚠️ THIS IS NOT DEAD CODE, AND DELETING IT WOULD BE A SECURITY REGRESSION.
 * `API-001` requires that "invalid credentials return an identical response
 * shape **and timing profile** regardless of whether the email exists". A
 * login that skips hashing for an unknown email answers in microseconds while
 * a real one takes the scrypt cost — turning the endpoint into an account
 * enumeration oracle that no response-shape matching can hide.
 *
 * So an unknown email is charged the same derivation against a dummy hash.
 * Always returns false.
 */
const DUMMY_SALT = randomBytes(SCRYPT_SALT_BYTES);

export async function verifyPasswordAgainstMissingUser(
  password: string,
): Promise<false> {
  await scrypt(password, DUMMY_SALT, SCRYPT_KEY_LENGTH);
  return false;
}

/**
 * Pseudonymous client attribution for `SESSION` and `AUDIT_EVENT`.
 *
 * `DB §4.1`: "`ip_hash` and `user_agent_class` support abuse detection
 * (`NFR-025`) without storing identifying network data. **Raw IP is never
 * persisted.**" Salted with a server secret so the hash cannot be reversed by
 * enumerating the IPv4 space, which an unsalted hash trivially would be.
 */
export const hashIp = (ip: string, secret: string): string =>
  createHash("sha256").update(`${secret}:${ip}`, "utf8").digest("hex");

/**
 * A coarse client class, never the raw user-agent string.
 *
 * `DB §4.1` says `user_agent_class`, and a class is what is stored: the full
 * string is a fingerprinting surface and identifying data `NFR-025` does not
 * ask for.
 */
export const userAgentClass = (userAgent: string | undefined): string => {
  if (userAgent === undefined || userAgent.trim() === "") return "unknown";
  const value = userAgent.toLowerCase();
  if (value.includes("mobile") || value.includes("android")) return "mobile";
  if (
    value.includes("mozilla") ||
    value.includes("safari") ||
    value.includes("chrome")
  ) {
    return "browser";
  }
  return "other";
};
