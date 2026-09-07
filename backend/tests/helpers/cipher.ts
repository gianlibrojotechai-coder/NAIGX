/**
 * A real `FieldCipher` for tests, with no database and no key service.
 *
 * ⚠️ IT ACTUALLY ENCRYPTS, AND THAT IS THE POINT. The tempting shortcut is
 * `createPassThroughCipher()`, which would let every existing test keep passing
 * unchanged — and would mean not one of them exercised encryption. The
 * Postgres-backed suites in particular are the only place the round trip is
 * proved against a real column: sealed on write, opened on read, through the
 * same code the server runs.
 *
 * The key comes from the offline provider, so this needs no AWS account and
 * costs nothing. It is regenerated per call, so no test can depend on another's
 * key.
 */

import {
  loadDataKeyRing,
  type EncryptionKeyStore,
  type FieldCipher,
} from "../../src/crypto/data-key.js";
import { createTestKeyProvider } from "../../src/crypto/providers/test-double.js";

/** An `EncryptionKeyStore` backed by an array. No database involved. */
function memoryKeyStore(): EncryptionKeyStore {
  const rows: {
    version: number;
    wrappedKey: Uint8Array;
    provider: string;
    retiredAt: Date | null;
  }[] = [];

  return {
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

/** A cipher with a freshly generated key. */
export async function createTestCipher(): Promise<FieldCipher> {
  const ring = await loadDataKeyRing(
    memoryKeyStore(),
    createTestKeyProvider(),
    { createIfMissing: true },
  );
  return ring.cipher;
}
