/**
 * The data key's lifecycle — read wrapped, unwrapped once, cached in memory
 * ([D-52](../../../docs/27-D-52-Managed-Key-Service.md) §2, §5).
 *
 * ## Why it is cached
 *
 * D-52 chose a cached data key over a key-service call per row, and the reason
 * is cost shape rather than latency: one `Decrypt` per process start is tens of
 * requests a month against a 20,000 free allowance, and — the part that
 * matters — **it does not grow with analysis volume**. A call per row would
 * scale the bill with usage and put a network round trip inside every read.
 *
 * ## Why a failure here stops the process
 *
 * ⚠️ AN INSTANCE THAT CANNOT UNWRAP ITS DATA KEY MUST NOT SERVE (D-52 §5, last
 * row). The tempting alternative — start, and fail individual reads — is much
 * worse than it looks: the fields involved are the analysis input and the
 * stage traces, so a running instance without the key serves history listings
 * whose entries cannot be read and accepts submissions it cannot store
 * readably. It looks healthy while quietly producing unusable data. Refusing
 * to start is loud, immediate, and cannot be mistaken for anything else.
 */

import {
  DATA_KEY_BYTES,
  isSealed,
  open,
  seal,
  sealedKeyVersion,
} from "./envelope.js";
import {
  KeyProviderUnavailableError,
  type DataKey,
  type KeyProvider,
} from "./key-provider.js";

/** The subset of the primary client this module needs. Injected, never opened here. */
export interface EncryptionKeyStore {
  readonly encryptionKey: {
    findMany(args: { orderBy: { version: "desc" } }): Promise<
      readonly {
        version: number;
        wrappedKey: Uint8Array;
        provider: string;
        retiredAt: Date | null;
      }[]
    >;
    create(args: {
      data: {
        version: number;
        wrappedKey: Uint8Array;
        provider: string;
      };
    }): Promise<unknown>;
  };
}

/**
 * The sealing service the rest of the application uses.
 *
 * Deliberately not "an encryptor": it holds every key version that has ever
 * sealed a row, seals with the newest, and opens with whichever the value
 * cites. That is what makes rotation a data operation rather than a code
 * change (`SA §10.4`).
 */
export interface FieldCipher {
  /** Seals a value under the current key. */
  seal(plaintext: string): string;
  /**
   * Opens a sealed value, or returns a plaintext one unchanged.
   *
   * ⚠️ THE PASS-THROUGH IS FOR THE BACKFILL WINDOW ONLY, and it is why
   * `plaintextReads` exists below. The schema migration cannot seal rows (it
   * has no key), so between migrating and running `encrypt:backfill` a table
   * legitimately holds both. Rejecting plaintext there would take the service
   * down; silently accepting it forever would let an unfinished backfill look
   * exactly like a finished one. So it is accepted **and counted**.
   */
  open(stored: string): string;
  /** How many plaintext values have been read. Non-zero ⇒ the backfill is unfinished. */
  readonly plaintextReads: number;
  /** The version new values are sealed under. */
  readonly currentVersion: number;
}

export interface DataKeyRing {
  readonly cipher: FieldCipher;
  readonly providerName: string;
  readonly currentVersion: number;
}

/**
 * Loads every key version, unwrapping each through the provider.
 *
 * @throws {KeyProviderUnavailableError} if the service cannot be reached, or
 * if no key exists and `createIfMissing` was not requested.
 */
export async function loadDataKeyRing(
  store: EncryptionKeyStore,
  provider: KeyProvider,
  options: { readonly createIfMissing?: boolean } = {},
): Promise<DataKeyRing> {
  const rows = await store.encryptionKey.findMany({
    orderBy: { version: "desc" },
  });

  if (rows.length === 0) {
    if (options.createIfMissing !== true) {
      throw new KeyProviderUnavailableError(
        provider.name,
        "no encryption key has been provisioned — run `npm run encrypt:init`",
      );
    }
    const created = await provisionFirstKey(store, provider);
    return ring(
      new Map([[created.version, created.key]]),
      created.version,
      provider.name,
    );
  }

  // Every version is unwrapped, not just the newest: a row sealed under an
  // older key must still open, and discovering at read time that a retired key
  // was never loaded would surface as an unreadable analysis.
  const keys = new Map<number, DataKey>();
  for (const row of rows) {
    const key = await provider.unwrap(row.wrappedKey);
    if (key.length !== DATA_KEY_BYTES) {
      throw new KeyProviderUnavailableError(
        provider.name,
        `key version ${String(row.version)} unwrapped to the wrong length`,
      );
    }
    keys.set(row.version, key);
  }

  // The newest key that has not been retired seals new values. Retired keys
  // stay loaded — they open, they do not seal.
  const active = rows.find((row) => row.retiredAt === null);
  const currentVersion =
    active?.version ?? (rows[0] as { version: number }).version;

  return ring(keys, currentVersion, provider.name);
}

/** Creates key version 1. Used by `encrypt:init` and by tests. */
export async function provisionFirstKey(
  store: EncryptionKeyStore,
  provider: KeyProvider,
): Promise<{ version: number; key: DataKey }> {
  const { plaintext, wrapped } = await provider.generateDataKey();

  // ⚠️ THE WRAPPED HALF IS WHAT IS STORED. Writing `plaintext` here instead
  // would put the data key in the database in the clear — the exact failure
  // the migration's `wrapped_key` length CHECK also guards against, because
  // this is a two-character mistake with no visible symptom.
  await store.encryptionKey.create({
    data: { version: 1, wrappedKey: wrapped, provider: provider.name },
  });

  return { version: 1, key: plaintext };
}

function ring(
  keys: Map<number, DataKey>,
  currentVersion: number,
  providerName: string,
): DataKeyRing {
  const currentKey = keys.get(currentVersion);
  if (currentKey === undefined) {
    throw new KeyProviderUnavailableError(
      providerName,
      `key version ${String(currentVersion)} is missing from the ring`,
    );
  }

  let plaintextReads = 0;

  const cipher: FieldCipher = {
    seal: (plaintext) => seal(plaintext, currentKey, currentVersion),

    open: (stored) => {
      if (!isSealed(stored)) {
        // The backfill window. Counted, never silent.
        plaintextReads += 1;
        return stored;
      }
      const version = sealedKeyVersion(stored);
      const key = keys.get(version);
      if (key === undefined) {
        throw new KeyProviderUnavailableError(
          providerName,
          `a stored value cites key version ${String(version)}, which is not ` +
            `loaded. The key row was deleted — the value cannot be recovered.`,
        );
      }
      return open(stored, key);
    },

    get plaintextReads() {
      return plaintextReads;
    },

    get currentVersion() {
      return currentVersion;
    },
  };

  return { cipher, providerName, currentVersion };
}

/**
 * A cipher that seals nothing — for the tests and CLI paths that never touch
 * the three encrypted fields.
 *
 * ⚠️ NOT A FALLBACK. Nothing selects this because a key was unavailable; the
 * composition root refuses to start in that case. It exists so a unit test of
 * an unrelated route need not stand up a key provider.
 */
export function createPassThroughCipher(): FieldCipher {
  let plaintextReads = 0;
  return {
    seal: (plaintext) => plaintext,
    open: (stored) => {
      plaintextReads += 1;
      return stored;
    },
    get plaintextReads() {
      return plaintextReads;
    },
    get currentVersion() {
      return 0;
    },
  };
}
