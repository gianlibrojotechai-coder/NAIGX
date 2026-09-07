-- M-19 Phase 3 — application-level encryption, and a durable trace purge.
--
-- Two tables, both additive. No existing column is altered and no existing row
-- is written or deleted by this file.
--
--   1. ENCRYPTION_KEY      -- D-52 §2, the wrapped data key
--   2. TRACE_PURGE_OUTBOX  -- DB §5.4 step 2, made durable
--
-- ⚠️ THIS MIGRATION DOES NOT ENCRYPT ANYTHING, AND IT CANNOT.
--
-- Sealing `raw_content`, `structured_input` and `structured_output` requires
-- the data key, which requires a call to the key service. SQL has no way to
-- make that call, so the backfill is an application command run AFTER this
-- migration and after the key exists:
--
--     npm run encrypt:status     -- how many rows are still plaintext
--     npm run encrypt:backfill   -- seals them, resumable, idempotent
--
-- Between this migration and that command the tables hold a MIXTURE of sealed
-- and plaintext values. That is expected and handled: the envelope's version
-- prefix distinguishes them (D-53 §6), and the read path accepts both during
-- the window. It is a window, not a permanent mode — `encrypt:status` is what
-- tells you it has closed.

-- ---------------------------------------------------------------------------
-- 1. ENCRYPTION_KEY (D-52 §2)
--
-- Holds the data key WRAPPED under the customer-managed key. The CMK never
-- leaves the key service, so this table is ciphertext: reading it yields a
-- blob that is useless without a call the reading host cannot make. That
-- asymmetry is the property DB §13.1 row 3 is buying.
--
-- ⚠️ NEVER DELETE A ROW HERE. Every sealed value cites the version that sealed
-- it. Removing a retired key destroys every row still citing it — in the
-- database and in every backup (D-52 §6).
-- ---------------------------------------------------------------------------

CREATE TABLE "encryption_key" (
  "version"     INTEGER NOT NULL,
  "wrapped_key" BYTEA NOT NULL,
  "provider"    TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retired_at"  TIMESTAMP(3),

  CONSTRAINT "encryption_key_pkey" PRIMARY KEY ("version")
);

-- Versions start at 1 and only ever climb. A zero or negative version would
-- mean an envelope could cite a key that sorts before the first one.
ALTER TABLE "encryption_key"
  ADD CONSTRAINT "encryption_key_version_positive" CHECK ("version" >= 1);

-- A wrapped AES-256 key is never a handful of bytes. This catches the one
-- mistake that would be catastrophic and silent: storing the PLAINTEXT data
-- key here by wiring the wrong half of `generateDataKey`. A raw AES-256 key is
-- exactly 32 bytes; every real KMS wrapping is substantially longer.
ALTER TABLE "encryption_key"
  ADD CONSTRAINT "encryption_key_wrapped_not_raw"
  CHECK (octet_length("wrapped_key") > 32);

-- ---------------------------------------------------------------------------
-- 2. TRACE_PURGE_OUTBOX (DB §5.4 step 2)
--
-- The instruction is written in the SAME transaction as the analysis deletion,
-- which is why this table is in the primary store. Before it, the queue was in
-- memory and a restart between the deletion and the purge lost the instruction
-- silently — bounded only by DB §8.3's 7-day trace expiry.
-- ---------------------------------------------------------------------------

CREATE TABLE "trace_purge_outbox" (
  "purge_id"       UUID NOT NULL DEFAULT gen_random_uuid(),
  "analysis_ids"   UUID[] NOT NULL,
  "user_id"        UUID,
  "correlation_id" TEXT,
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "enqueued_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error_at"  TIMESTAMP(3),
  "failed_at"      TIMESTAMP(3),

  CONSTRAINT "trace_purge_outbox_pkey" PRIMARY KEY ("purge_id")
);

-- An empty instruction is a bug that would otherwise sit in the table forever
-- being "drained" to no effect.
ALTER TABLE "trace_purge_outbox"
  ADD CONSTRAINT "trace_purge_outbox_ids_not_empty"
  CHECK (array_length("analysis_ids", 1) >= 1);

-- The drain's only query: pending rows, oldest first.
CREATE INDEX "trace_purge_outbox_failed_at_enqueued_at_idx"
  ON "trace_purge_outbox" ("failed_at", "enqueued_at");

-- ⚠️ NO FOREIGN KEY ON "user_id", DELIBERATELY. The common case for this table
-- is precisely that the user's analyses — and often the user — have just been
-- deleted. A cascade would remove the instruction along with them, and a
-- restrict would block the deletion the instruction exists to follow up.
