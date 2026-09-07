/**
 * The data-format guard (`M-19` Phase 4a).
 *
 * ## What went wrong, and why a schema check could not see it
 *
 * The Phase 4 rollback rehearsal deployed the pre-encryption build against the
 * current database. It **started cleanly, passed its health check, and served
 * every user a base64 envelope where their submitted document should be** —
 * without one error, in any log, anywhere.
 *
 * `SA §9.3` requires "migrations backward-compatible within one version", and
 * that requirement was *met*: the Phase 3 migration is purely additive and the
 * schema rolls back perfectly. What changed was the **data format**, and a
 * schema-compatibility check is structurally incapable of noticing that the
 * bytes in a column now mean something different.
 *
 * ⚠️ A ROLLBACK THAT PRESENTS CIPHERTEXT AS CONTENT IS A DATA-VISIBILITY
 * INCIDENT, NOT A ROLLBACK.
 *
 * ## Two mechanisms, and this file is only one of them
 *
 * 1. **The sealed columns were renamed** (`raw_content_sealed`,
 *    `structured_input_sealed`, `structured_output_sealed`). That is what stops
 *    builds *that already exist* — they cannot be changed, so the data is made
 *    unreachable under the name they ask for, and Postgres answers
 *    `42703 undefined_column` instead of handing over an envelope.
 *
 * 2. **This guard**, which protects the *next* rollback rather than that one. A
 *    build carrying it refuses to start against data written in a format newer
 *    than it understands — before serving a single request, rather than at the
 *    thousandth read.
 *
 * Neither alone is enough. The rename cannot help against a build that does not
 * exist yet; the guard cannot help against a build that predates it.
 *
 * ## Why refusing to start is the right failure
 *
 * The same reasoning as the key ring
 * ([D-52](../../../docs/27-D-52-Managed-Key-Service.md) §5): an instance that
 * cannot correctly interpret stored content must not serve it. Starting and
 * failing individual reads is worse — the service looks healthy while
 * producing wrong answers, and "wrong" here means a user's confidential
 * document rendered as gibberish.
 */

/**
 * The highest data format this build understands.
 *
 * ⚠️ INCREMENT THIS ONLY ALONGSIDE A MIGRATION THAT WRITES THE SAME NUMBER
 * INTO `data_format`, and understand what it costs: every build with a lower
 * number becomes undeployable against that database, permanently. That is the
 * intended effect — it is what makes a silent rollback impossible — but it does
 * mean the deployable floor rises with it.
 *
 *   1 = plaintext (pre-`M-19` Phase 3)
 *   2 = application-level envelope encryption, sealed column names
 */
export const SUPPORTED_DATA_FORMAT = 2;

/** The subset of the primary client this needs. Injected; opens no connection. */
export interface DataFormatStore {
  readonly dataFormat: {
    findFirst(args: {
      where: { id: number };
      select: { version: true };
    }): Promise<{ version: number } | null>;
  };
}

export class DataFormatTooNewError extends Error {
  constructor(stored: number, supported: number) {
    super(
      `This database is written in data format ${String(stored)}; this build ` +
        `understands at most ${String(supported)}. Refusing to start.\n\n` +
        `⚠️ THIS IS A ROLLBACK PAST A DATA-FORMAT CHANGE. Starting anyway ` +
        `would not fail — it would serve stored content as though it were ` +
        `still in the older format, which for encrypted fields means handing ` +
        `users a base64 envelope where their document should be, silently.\n\n` +
        `Deploy a build that understands format ${String(stored)}, or restore ` +
        `a backup taken before the format changed. ⚠️ Backups are retained ` +
        `for 7 days (DBQ-7), so that second option has a deadline.`,
    );
    this.name = "DataFormatTooNewError";
  }
}

/**
 * Verifies this build can read what is stored, or throws.
 *
 * A missing row means the database predates the guard — format 1, plaintext —
 * which this build reads happily via the envelope's plaintext pass-through
 * ([D-55](../../../docs/30-D-55-Envelope-Format-And-Purge-Outbox.md) §7). Only
 * a stored version *higher* than this build's is fatal.
 *
 * @throws {DataFormatTooNewError} when the data is newer than the code.
 */
export async function assertDataFormatReadable(
  store: DataFormatStore,
  supported: number = SUPPORTED_DATA_FORMAT,
): Promise<number> {
  const row = await store.dataFormat.findFirst({
    where: { id: 1 },
    select: { version: true },
  });

  // No row: a database from before the guard existed. Older, never newer — so
  // it is readable, and treating its absence as an error would refuse to start
  // against every pre-Phase-4a database including a restored backup.
  const stored = row?.version ?? 1;

  if (stored > supported) {
    throw new DataFormatTooNewError(stored, supported);
  }

  return stored;
}
