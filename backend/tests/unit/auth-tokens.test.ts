/**
 * Unit — token generation and credential hashing (`NFR-022`, `API-001`).
 *
 * The properties here are the ones whose absence is invisible: a token that
 * looks random but repeats, a password check that leaks by timing, an
 * enumeration oracle that answers faster for an unknown email. None of these
 * would fail an ordinary functional test.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateFamilyId,
  generateToken,
  hashIp,
  hashPassword,
  hashToken,
  userAgentClass,
  verifyPassword,
  verifyPasswordAgainstMissingUser,
} from "../../src/auth/tokens.js";

test("tokens are unguessable and never repeat", () => {
  // The property the anonymous principal rests on: possession of a token is
  // proof of ownership only if the token cannot be produced any other way.
  const tokens = new Set(Array.from({ length: 500 }, () => generateToken()));
  assert.equal(tokens.size, 500);

  const sample = generateToken();
  // 32 bytes, base64url: 43 characters, no padding, URL-safe alphabet only.
  assert.equal(sample.length, 43);
  assert.match(sample, /^[A-Za-z0-9_-]+$/);
});

test("family ids are distinct", () => {
  const ids = new Set(Array.from({ length: 100 }, () => generateFamilyId()));
  assert.equal(ids.size, 100);
});

test("token hashing is deterministic and one-way in shape", () => {
  const token = generateToken();
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
  assert.match(hashToken(token), /^[0-9a-f]{64}$/);
});

test("different tokens hash differently", () => {
  assert.notEqual(hashToken(generateToken()), hashToken(generateToken()));
});

// --- credentials ------------------------------------------------------------

test("NFR-022 — a password is never stored in plaintext", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(stored.includes("correct horse battery staple"), false);
  assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
});

test("the same password hashes differently every time", async () => {
  // Per-value salt. Without it, identical passwords are visibly identical in
  // the table, which tells an attacker which accounts to attack together.
  const a = await hashPassword("same password");
  const b = await hashPassword("same password");
  assert.notEqual(a, b);
});

test("a correct password verifies and a wrong one does not", async () => {
  const stored = await hashPassword("s3cret-passphrase");
  assert.equal(await verifyPassword("s3cret-passphrase", stored), true);
  assert.equal(await verifyPassword("s3cret-passphras", stored), false);
  assert.equal(await verifyPassword("", stored), false);
});

test("the algorithm is named in the stored value, not assumed", async () => {
  // So a future change can be rolled out by reading what each row used rather
  // than guessing from its shape.
  const stored = await hashPassword("x".repeat(20));
  assert.equal(stored.split("$")[0], "scrypt");
});

test("a malformed stored hash verifies false rather than throwing", async () => {
  // A row nobody can authenticate against is the safe reading of a corrupt
  // value; an exception here would be a 500 on a login attempt.
  for (const bad of [
    "",
    "not-a-hash",
    "scrypt$deadbeef",
    "bcrypt$aa$bb",
    "scrypt$$",
    "scrypt$zz$zz",
  ]) {
    assert.equal(await verifyPassword("anything", bad), false, bad);
  }
});

test("API-001 — an unknown email is charged the same derivation cost", async () => {
  // The enumeration oracle this exists to close: a login that skips hashing
  // for an unknown email answers in microseconds while a real one pays the
  // scrypt cost, and no amount of response-shape matching hides that.
  //
  // Timed rather than asserted structurally, because the property *is* the
  // timing. The bound is loose — this is a smoke test for "the work happened
  // at all", not a benchmark.
  const stored = await hashPassword("a real password");

  const t0 = process.hrtime.bigint();
  await verifyPassword("a wrong password", stored);
  const real = process.hrtime.bigint() - t0;

  const t1 = process.hrtime.bigint();
  await verifyPasswordAgainstMissingUser("a wrong password");
  const missing = process.hrtime.bigint() - t1;

  // Within an order of magnitude in both directions. A skipped derivation
  // would be hundreds of times faster, which this catches; ordinary scheduler
  // noise, which it should not, is far smaller.
  const ratio = Number(real) / Number(missing);
  assert.ok(
    ratio > 0.1 && ratio < 10,
    `derivation cost differed by ${ratio.toFixed(1)}x — the missing-user path likely skips work`,
  );
});

test("verifyPasswordAgainstMissingUser always denies", async () => {
  assert.equal(await verifyPasswordAgainstMissingUser(""), false);
  assert.equal(await verifyPasswordAgainstMissingUser("anything"), false);
});

// --- pseudonymous attribution -----------------------------------------------

test("DB §4.1 — an IP is hashed with a secret, never stored raw", async () => {
  const hashed = hashIp("203.0.113.7", "server-secret");
  assert.equal(hashed.includes("203.0.113.7"), false);
  assert.match(hashed, /^[0-9a-f]{64}$/);
  assert.equal(hashed, hashIp("203.0.113.7", "server-secret"));
});

test("the IP salt matters — an unsalted hash would be reversible by enumeration", () => {
  // The whole IPv4 space is 2^32 values; an unsalted sha256 table is trivial
  // to build. A server secret is what makes the hash non-reversible.
  assert.notEqual(
    hashIp("203.0.113.7", "secret-a"),
    hashIp("203.0.113.7", "secret-b"),
  );
});

test("the user agent is classed, never stored verbatim", () => {
  // `DB §4.1` says `user_agent_class`. The full string is a fingerprinting
  // surface and identifying data NFR-025 does not ask for.
  assert.equal(userAgentClass(undefined), "unknown");
  assert.equal(userAgentClass(""), "unknown");
  assert.equal(
    userAgentClass("Mozilla/5.0 (Windows NT 10.0) Chrome/120"),
    "browser",
  );
  assert.equal(userAgentClass("Mozilla/5.0 (iPhone; Mobile Safari)"), "mobile");
  assert.equal(userAgentClass("curl/8.4.0"), "other");

  // Nothing identifying survives.
  const classed = userAgentClass(
    "Mozilla/5.0 (Windows NT 10.0; rv:109) Firefox/121",
  );
  assert.equal(classed.includes("Windows"), false);
  assert.equal(classed.includes("109"), false);
});
