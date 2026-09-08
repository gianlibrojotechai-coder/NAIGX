/**
 * The host-held key provider ([D-61](../../../docs/36-D-61-Host-Held-Key-File.md)).
 *
 * ⚠️ MOST OF THIS FILE IS ABOUT REFUSALS, NOT ROUND TRIPS. A key provider that
 * wraps and unwraps correctly is easy; one that refuses to run on a key
 * anybody on the host can read is the part that carries the security property.
 * `DB §13.1` wants "a storage-layer compromise does not yield plaintext", and
 * a world-readable root key file quietly converts a host account into exactly
 * that compromise while every round-trip test still passes.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { createKeyFileProvider } from "../../src/crypto/providers/key-file.js";
import {
  KeyProviderRejectedError,
  KeyProviderUnavailableError,
} from "../../src/crypto/key-provider.js";

const dir = mkdtempSync(join(tmpdir(), "naigx-keyfile-"));
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes a key file and returns its path. `mode` defaults to owner-only. */
const keyFileAt = (name: string, contents: string, mode = 0o400): string => {
  const path = join(dir, name);
  writeFileSync(path, contents);
  chmodSync(path, mode);
  return path;
};

const validKey = (): string => randomBytes(32).toString("base64");

/**
 * ⚠️ POSIX permission bits are not enforced on Windows, so the mode-based
 * refusals cannot be exercised there — `chmod` is a no-op and the provider
 * would correctly see an unrestricted file that the platform never restricted.
 * Skipping is honest; asserting would test the harness rather than the code.
 */
const posix = process.platform !== "win32";

test("wraps and unwraps a data key", async () => {
  const provider = createKeyFileProvider({
    path: keyFileAt("good.key", validKey()),
  });

  const { plaintext, wrapped } = await provider.generateDataKey();
  assert.equal(plaintext.length, 32, "a data key is AES-256");

  // The wrapped form must not contain the plaintext. This is the assertion
  // that would catch a "wrapping" step that forgot to encrypt.
  assert.ok(
    !Buffer.from(wrapped).includes(Buffer.from(plaintext)),
    "the wrapped key must not embed the plaintext data key",
  );

  const unwrapped = await provider.unwrap(wrapped);
  assert.deepEqual(unwrapped, plaintext);
});

test("two data keys from one root key differ", async () => {
  // A provider that derived the data key from the root key deterministically
  // would round-trip perfectly and give every analysis the same key.
  const provider = createKeyFileProvider({
    path: keyFileAt("distinct.key", validKey()),
  });

  const first = await provider.generateDataKey();
  const second = await provider.generateDataKey();

  assert.notDeepEqual(first.plaintext, second.plaintext);
  assert.notDeepEqual(first.wrapped, second.wrapped);
});

test("accepts hex as well as base64", async () => {
  // `openssl rand` produces either depending on the flag, and an operator
  // should not have to remember which this expects.
  const provider = createKeyFileProvider({
    path: keyFileAt("hex.key", randomBytes(32).toString("hex")),
  });

  const { plaintext, wrapped } = await provider.generateDataKey();
  assert.deepEqual(await provider.unwrap(wrapped), plaintext);
});

test("FAILS CLOSED when the key file is missing", async () => {
  const provider = createKeyFileProvider({
    path: join(dir, "does-not-exist.key"),
  });

  await assert.rejects(
    () => provider.generateDataKey(),
    KeyProviderUnavailableError,
  );
});

test("FAILS CLOSED when the key is the wrong length", async () => {
  const provider = createKeyFileProvider({
    path: keyFileAt("short.key", randomBytes(16).toString("base64")),
  });

  await assert.rejects(
    () => provider.generateDataKey(),
    (error: Error) =>
      error instanceof KeyProviderUnavailableError &&
      error.message.includes("16 bytes"),
  );
});

test(
  "FAILS CLOSED when the key file is group-readable",
  { skip: !posix },
  async () => {
    const provider = createKeyFileProvider({
      path: keyFileAt("group.key", validKey(), 0o440),
    });

    await assert.rejects(
      () => provider.generateDataKey(),
      (error: Error) =>
        error instanceof KeyProviderUnavailableError &&
        error.message.includes("group or other"),
    );
  },
);

test(
  "FAILS CLOSED when the key file is world-readable",
  { skip: !posix },
  async () => {
    const provider = createKeyFileProvider({
      path: keyFileAt("world.key", validKey(), 0o444),
    });

    await assert.rejects(
      () => provider.generateDataKey(),
      (error: Error) =>
        error instanceof KeyProviderUnavailableError &&
        error.message.includes("group or other"),
    );
  },
);

test("REJECTS a wrapped key belonging to a different root key", async () => {
  // Not "unavailable" — the service is fine, the material is foreign. The two
  // demand different operator responses: retry versus stop and investigate.
  const mine = createKeyFileProvider({
    path: keyFileAt("mine.key", validKey()),
  });
  const theirs = createKeyFileProvider({
    path: keyFileAt("theirs.key", validKey()),
  });

  const { wrapped } = await theirs.generateDataKey();

  await assert.rejects(() => mine.unwrap(wrapped), KeyProviderRejectedError);
});

test("REJECTS a tampered wrapped key rather than returning garbage", async () => {
  // GCM's authentication tag is what makes this a rejection instead of a
  // silently wrong 32 bytes that would decrypt every field into noise.
  const provider = createKeyFileProvider({
    path: keyFileAt("tamper.key", validKey()),
  });

  const { wrapped } = await provider.generateDataKey();
  const tampered = Uint8Array.from(wrapped);
  const last = tampered.length - 1;
  tampered[last] = (tampered[last] ?? 0) ^ 0xff;

  await assert.rejects(
    () => provider.unwrap(tampered),
    KeyProviderRejectedError,
  );
});

test("REJECTS a truncated wrapped key", async () => {
  const provider = createKeyFileProvider({
    path: keyFileAt("truncated.key", validKey()),
  });

  await assert.rejects(
    () => provider.unwrap(new Uint8Array(8)),
    KeyProviderRejectedError,
  );
});

test("never puts key material in an error message", async () => {
  // ⚠️ `DB §13.2` classifies a data key CREDENTIAL. Startup errors are read
  // from container logs, which are exactly where key material must not land.
  //
  // The failure is provoked by length rather than permissions so this runs on
  // every platform — the point is what the message contains, not which check
  // rejected it.
  //
  // ⚠️ A 20-byte key, not two 32-byte keys concatenated: Node's base64 decoder
  // stops at the first `=` padding, so `key + key` decodes to a perfectly
  // valid 32 bytes and raises nothing at all. The first version of this test
  // did exactly that and passed for the wrong reason.
  const secret = randomBytes(20).toString("base64");
  const provider = createKeyFileProvider({
    path: keyFileAt("leak.key", secret),
  });

  const error = await provider
    .generateDataKey()
    .then(() => undefined)
    .catch((cause: Error) => cause);

  assert.ok(error instanceof Error);
  assert.ok(
    !error.message.includes(secret) && !error.message.includes(secret.trim()),
    "the root key must never appear in an error message",
  );
});
