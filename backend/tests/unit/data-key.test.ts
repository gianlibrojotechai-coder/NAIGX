/**
 * Unit — the data key ring
 * ([D-52](../../../docs/27-D-52-Managed-Key-Service.md) §2, §5).
 *
 * The envelope's own tests cover the cryptography. These cover the lifecycle
 * around it: what is stored, what is refused, and what happens to a row whose
 * key is no longer there.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createPassThroughCipher,
  loadDataKeyRing,
  provisionFirstKey,
  type EncryptionKeyStore,
} from "../../src/crypto/data-key.js";
import { DATA_KEY_BYTES, seal } from "../../src/crypto/envelope.js";
import { KeyProviderUnavailableError } from "../../src/crypto/key-provider.js";
import { createTestKeyProvider } from "../../src/crypto/providers/test-double.js";

interface StoredRow {
  version: number;
  wrappedKey: Uint8Array;
  provider: string;
  retiredAt: Date | null;
}

function store(initial: StoredRow[] = []): EncryptionKeyStore & {
  rows: StoredRow[];
} {
  const rows = [...initial];
  return {
    rows,
    encryptionKey: {
      findMany: () =>
        Promise.resolve([...rows].sort((a, b) => b.version - a.version)),
      create: (args) => {
        rows.push({ ...args.data, retiredAt: null });
        return Promise.resolve(undefined);
      },
    },
  };
}

test("⚠️ provisioning stores the WRAPPED key, never the plaintext one", async () => {
  // A two-character mistake here puts the data key in the database in the
  // clear, and everything still round-trips — no test that only checks
  // seal/open would notice. The migration's `octet_length > 32` CHECK guards
  // the same slip from the database side.
  const s = store();
  const { key } = await provisionFirstKey(s, createTestKeyProvider());

  assert.equal(s.rows.length, 1);
  const stored = s.rows[0]?.wrappedKey as Uint8Array;
  assert.ok(
    stored.length > DATA_KEY_BYTES,
    "the stored key is no longer than a raw AES-256 key — it may be plaintext",
  );
  assert.notDeepEqual(Buffer.from(stored), Buffer.from(key));
});

test("a fresh ring seals and opens its own values", async () => {
  const ring = await loadDataKeyRing(store(), createTestKeyProvider(), {
    createIfMissing: true,
  });

  const sealed = ring.cipher.seal("confidential business content");
  assert.ok(!sealed.includes("confidential"));
  assert.equal(ring.cipher.open(sealed), "confidential business content");
  assert.equal(ring.currentVersion, 1);
});

test("⚠️ refuses to start when no key exists and none may be created", async () => {
  // D-52 §5, last row. An instance that started anyway would accept
  // submissions it cannot store readably and serve history nobody can open —
  // healthy-looking, quietly producing unusable data.
  await assert.rejects(
    () => loadDataKeyRing(store(), createTestKeyProvider()),
    KeyProviderUnavailableError,
  );
});

test("⚠️ refuses to start when the key service cannot unwrap", async () => {
  const s = store();
  await provisionFirstKey(s, createTestKeyProvider());

  await assert.rejects(
    () => loadDataKeyRing(s, createTestKeyProvider({ failUnwrap: true })),
    (error: Error) =>
      error.name === "KeyProviderRejectedError" ||
      error instanceof KeyProviderUnavailableError,
  );
});

test("plaintext passes through during the backfill window, and is counted", async () => {
  // The schema migration cannot seal rows (it has no key), so a table
  // legitimately holds both until `encrypt:backfill` runs. Rejecting plaintext
  // would take the service down; accepting it *silently* would make an
  // unfinished backfill indistinguishable from a finished one.
  const ring = await loadDataKeyRing(store(), createTestKeyProvider(), {
    createIfMissing: true,
  });

  assert.equal(ring.cipher.plaintextReads, 0);
  assert.equal(
    ring.cipher.open("a legacy plaintext row"),
    "a legacy plaintext row",
  );
  assert.equal(ring.cipher.plaintextReads, 1);

  // A sealed read does not move the counter.
  ring.cipher.open(ring.cipher.seal("x"));
  assert.equal(ring.cipher.plaintextReads, 1);
});

test("a value citing a key version that is not loaded fails loudly", async () => {
  // ⚠️ THE SHAPE OF AN UNRECOVERABLE ROW. Deleting a retired key row destroys
  // every value still citing it, including in backups (D-52 §6). It must raise
  // and say so, never return the envelope as though it were content.
  const ring = await loadDataKeyRing(store(), createTestKeyProvider(), {
    createIfMissing: true,
  });

  const orphan = seal("content", Buffer.alloc(DATA_KEY_BYTES, 7), 99);

  assert.throws(
    () => ring.cipher.open(orphan),
    (error: Error) => error.message.includes("99"),
  );
});

test("the offline provider refuses to exist in production", () => {
  // D-52 §4 forbids a locally-held key, and this is the second gate on that
  // rule — `loadConfig` is the first. A single gate on a rule this
  // consequential is one edit away from being removed.
  assert.throws(
    () => createTestKeyProvider({ env: { NODE_ENV: "production" } }),
    (error: Error) =>
      error.message.includes("must never be used in production"),
  );
});

test("the pass-through cipher is inert and counts every read as plaintext", () => {
  const cipher = createPassThroughCipher();
  assert.equal(cipher.seal("x"), "x");
  assert.equal(cipher.open("x"), "x");
  assert.equal(cipher.plaintextReads, 1);
});
