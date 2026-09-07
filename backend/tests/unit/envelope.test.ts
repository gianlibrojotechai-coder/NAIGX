/**
 * Unit — the encryption envelope
 * ([D-52](../../../docs/27-D-52-Managed-Key-Service.md) §5,
 * [D-53](../../../docs/28-D-53-Encryption-Layers.md)).
 *
 * `Roadmap §6.6` makes "all validation classes" mandatory coverage, and this is
 * the one where a passing test proves least by default: **encryption code that
 * is subtly wrong still round-trips**. A reused IV round-trips. A truncated tag
 * round-trips. Unauthenticated version metadata round-trips. So most of what is
 * below tests the properties a round trip does not show.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import {
  DATA_KEY_BYTES,
  ENVELOPE_PREFIX,
  EnvelopeError,
  isSealed,
  open,
  seal,
  sealedKeyVersion,
  secretEquals,
} from "../../src/crypto/envelope.js";

const key = () => randomBytes(DATA_KEY_BYTES);

test("round-trips text, including unicode and the empty string", () => {
  const k = key();
  for (const plaintext of [
    "a job description",
    "",
    "unicode: café — 日本語 — 🔐",
    "x".repeat(50_000), // FR-002's upper bound
  ]) {
    assert.equal(open(seal(plaintext, k, 1), k), plaintext);
  }
});

test("⚠️ never reuses an IV — the failure that breaks GCM outright", () => {
  // Reusing an IV under one key does not degrade GCM, it collapses it: the
  // XOR of the two plaintexts falls out immediately. Sealing the same value
  // twice must therefore produce different bytes, and if this ever fails the
  // cause is a derived or counter-based IV, never a flake.
  const k = key();
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    const sealed = seal("identical plaintext", k, 1);
    // Index 3, not 2. The layout is naigx . v1 . version . iv . tag . ct —
    // reading index 2 gets the version, which is constant, and the assertion
    // then "fails" on the very first repeat for a reason unrelated to IVs.
    const iv = sealed.split(".")[3] as string;
    assert.ok(!seen.has(iv), "an IV was reused across seals");
    seen.add(iv);
  }
});

test("a tampered ciphertext fails to open rather than decrypting to garbage", () => {
  const k = key();
  const sealed = seal("sensitive business content", k, 1);
  const parts = sealed.split(".");

  // Flip one bit of the ciphertext.
  const ct = Buffer.from(parts[5] as string, "base64url");
  ct[0] = (ct[0] as number) ^ 0x01;
  parts[5] = ct.toString("base64url");

  assert.throws(() => open(parts.join("."), k), EnvelopeError);
});

test("a tampered authentication tag is rejected", () => {
  const k = key();
  const parts = seal("content", k, 1).split(".");
  const tag = Buffer.from(parts[4] as string, "base64url");
  tag[0] = (tag[0] as number) ^ 0xff;
  parts[4] = tag.toString("base64url");

  assert.throws(() => open(parts.join("."), k), EnvelopeError);
});

test("⚠️ a truncated tag is refused, not quietly verified against", () => {
  // GCM will verify happily against a short tag, and every byte dropped
  // divides the forgery cost by 256. A length check is the only defence, and
  // its absence would be invisible in a round-trip test.
  const k = key();
  const parts = seal("content", k, 1).split(".");
  const tag = Buffer.from(parts[4] as string, "base64url");
  parts[4] = tag.subarray(0, 8).toString("base64url");

  assert.throws(
    () => open(parts.join("."), k),
    (error: Error) => error.message.includes("tag length"),
  );
});

test("⚠️ the key version is authenticated, so a row cannot be relabelled", () => {
  // The version is bound as additional authenticated data. Without that it
  // would be attacker-editable metadata sitting outside the integrity
  // guarantee — repointing a row at a weaker or leaked key version. Rewriting
  // it must break the tag.
  const k = key();
  const parts = seal("content", k, 1).split(".");
  parts[2] = "2";

  assert.throws(() => open(parts.join("."), k), EnvelopeError);
});

test("a value sealed under one key does not open under another", () => {
  const sealed = seal("content", key(), 1);
  assert.throws(() => open(sealed, key()), EnvelopeError);
});

test("open refuses malformed envelopes instead of returning the input", () => {
  // ⚠️ The failure mode this forbids: a decrypt path that hands back its own
  // ciphertext when it cannot open it. That is how ciphertext reaches a user's
  // screen looking like corrupted data.
  const k = key();
  for (const malformed of [
    "naigx.v1.1.short",
    "naigx.v1.1.aaa.bbb.ccc.ddd",
    "naigx.v2.1.aaa.bbb.ccc",
    "not an envelope at all",
    "",
  ]) {
    assert.throws(() => open(malformed, k), EnvelopeError, malformed);
  }
});

test("rejects a key that is not 32 bytes", () => {
  for (const size of [16, 24, 31, 33]) {
    assert.throws(() => seal("x", randomBytes(size), 1), EnvelopeError);
  }
});

test("isSealed distinguishes sealed values from plaintext", () => {
  assert.equal(isSealed(seal("x", key(), 1)), true);
  assert.equal(isSealed("a normal job description"), false);
  assert.equal(isSealed(""), false);
  // The documented sharp edge: content that literally starts with the prefix
  // reads as sealed. Recorded in `envelope.ts`; asserted so the behaviour is
  // known rather than discovered.
  assert.equal(isSealed(`${ENVELOPE_PREFIX}.but not really`), true);
});

test("sealedKeyVersion reads the version back", () => {
  const k = key();
  for (const version of [1, 2, 47]) {
    assert.equal(sealedKeyVersion(seal("x", k, version)), version);
  }
  assert.throws(() => sealedKeyVersion("naigx.v1.0.a.b.c"), EnvelopeError);
  assert.throws(() => sealedKeyVersion("naigx.v1.x.a.b.c"), EnvelopeError);
});

test("the sealed form leaks no plaintext", () => {
  const sealed = seal("HIGHLY-DISTINCTIVE-SECRET-STRING", key(), 1);
  assert.ok(!sealed.includes("HIGHLY"));
  assert.ok(!sealed.includes("SECRET"));
});

test("secretEquals compares without leaking length-independent timing", () => {
  const a = randomBytes(32);
  assert.equal(secretEquals(a, Buffer.from(a)), true);
  assert.equal(secretEquals(a, randomBytes(32)), false);
  assert.equal(secretEquals(a, randomBytes(16)), false);
});
