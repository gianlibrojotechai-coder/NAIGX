/**
 * Unit — the data-format guard (`M-19` Phase 4a).
 *
 * ## What this prevents
 *
 * The Phase 4 rollback rehearsal deployed the pre-encryption build against the
 * current database. It **started cleanly, passed its health check, and served
 * base64 envelopes where users' documents should have been** — with no error
 * anywhere. `SA §9.3`'s migration-compatibility requirement was satisfied, and
 * satisfied requirements did not help: the schema rolled back perfectly, and
 * the *data format* was what had changed.
 *
 * ⚠️ THE RENAME IS THE OTHER HALF, AND IT IS NOT TESTED HERE because it cannot
 * be. Builds that already exist cannot be changed, so `raw_content` →
 * `raw_content_sealed` is what stops *them* — verified by running the Phase 2
 * image against the migrated database and observing
 * `The column analysis_input.raw_content does not exist`. This guard protects
 * the rollback after next: any build carrying it refuses to start against data
 * newer than it understands.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assertDataFormatReadable,
  DataFormatTooNewError,
  SUPPORTED_DATA_FORMAT,
  type DataFormatStore,
} from "../../src/db/data-format.js";

const store = (version: number | null): DataFormatStore => ({
  dataFormat: {
    findFirst: () => Promise.resolve(version === null ? null : { version }),
  },
});

test("a database at this build's format starts", async () => {
  assert.equal(
    await assertDataFormatReadable(store(SUPPORTED_DATA_FORMAT)),
    SUPPORTED_DATA_FORMAT,
  );
});

test("an older database starts — the format only moves forward", async () => {
  // Format 1 is plaintext. This build reads it through the envelope's
  // plaintext pass-through (D-55 §7), which is the documented backfill window.
  assert.equal(await assertDataFormatReadable(store(1), 2), 1);
});

test("a database predating the guard starts", async () => {
  // No row at all: a database from before `data_format` existed, which is by
  // definition older rather than newer. Treating absence as fatal would refuse
  // to start against every pre-Phase-4a database — including a restored
  // backup, at exactly the moment somebody needs one.
  assert.equal(await assertDataFormatReadable(store(null), 2), 1);
});

test("⚠️ a NEWER database refuses to start — the rollback guard", async () => {
  // The whole point. A build that finds data it cannot correctly interpret
  // must stop before serving a request, not serve wrong answers cheerfully.
  await assert.rejects(
    () => assertDataFormatReadable(store(3), 2),
    DataFormatTooNewError,
  );
});

test("the refusal says what happened and what to do about it", async () => {
  // An operator meets this message mid-incident, in a container log, with the
  // service down. "Invalid data format" would tell them nothing; the two ways
  // out and the deadline on one of them are the useful part.
  // Typed explicitly: the happy path resolves to a `number`, so an untyped
  // `.catch` widens to `number | Error` and `.message` does not exist on it.
  let error: Error | undefined;
  try {
    await assertDataFormatReadable(store(5), 2);
  } catch (caught) {
    error = caught as Error;
  }
  assert.ok(error !== undefined, "expected a refusal");

  assert.match(error.message, /data format 5/);
  assert.match(error.message, /at most 2/);
  // Names the failure mode, so nobody "fixes" it by removing the guard.
  assert.match(error.message, /base64 envelope/);
  // Both remedies, and the fact that one of them expires.
  assert.match(error.message, /restore a backup/);
  assert.match(error.message, /7 days/);
});

test("SUPPORTED_DATA_FORMAT matches the format the migration writes", () => {
  // ⚠️ These two numbers must move together. Raising the constant without a
  // migration writing the same value makes the guard compare against a stale
  // row and pass when it should not; writing the migration without raising the
  // constant refuses to start on a database this build can actually read.
  //
  // 2 = envelope encryption + sealed column names
  //     (prisma/migrations/20260908130000_sealed_columns_and_format_guard)
  assert.equal(SUPPORTED_DATA_FORMAT, 2);
});
