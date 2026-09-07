-- M-19 Phase 4a — make a rollback across the encryption boundary IMPOSSIBLE
-- to perform silently.
--
-- ## The incident this prevents
--
-- The Phase 4 rollback rehearsal found that a pre-encryption build, deployed
-- against the current database, **starts cleanly, passes its health check, and
-- serves every user a base64 envelope where their submitted document should
-- be** — without raising a single error. `SA §9.3`'s "migrations
-- backward-compatible within one version" does not catch it, because the schema
-- rolls back perfectly. It is the DATA FORMAT that changed, and a schema check
-- cannot see that.
--
-- ⚠️ A ROLLBACK THAT PRESENTS CIPHERTEXT AS CONTENT IS A DATA-VISIBILITY
-- INCIDENT, NOT A ROLLBACK. Users read nonsense, search matches nothing,
-- exports contain envelopes, and no log line says why.
--
-- ## Two mechanisms, because they solve different halves
--
-- 1. **The columns are renamed** (below). Builds that already exist cannot be
--    changed, so the only way to stop one misreading this data is to make the
--    data unreachable under the name it asks for. An old build issues
--    `SELECT ... raw_content ...`, Postgres answers `42703 undefined_column`,
--    and the request fails loudly instead of returning an envelope.
--
--    This is deliberately a HARD break. It is the point.
--
-- 2. **A data-format version** (below), checked by the application at startup.
--    That protects the NEXT rollback rather than this one: any future build
--    carrying the check refuses to start against data written in a format newer
--    than it understands, before it serves a single request. Rename protects
--    against builds that predate the guard; the guard protects against builds
--    that follow it.
--
-- ## Consequences, stated
--
-- · The deployable floor is now the first build that reads `*_sealed`.
--   Rolling back past it is not supported and will fail visibly.
-- · ⚠️ Dumps taken BEFORE this migration carry the old column names. Restoring
--   one means restoring, then applying migrations — the normal order, and the
--   restore drill exercises the current schema.
-- · Rows are untouched. This renames columns and adds one small table; no
--   value is read, rewritten, or re-encrypted.

-- ---------------------------------------------------------------------------
-- 1. The rename
--
-- `analysis_input.raw_content` holds a `naigx.v1.…` envelope since the Phase 3
-- backfill. The name now says so, and the old name no longer resolves.
-- ---------------------------------------------------------------------------

ALTER TABLE "analysis_input" RENAME COLUMN "raw_content" TO "raw_content_sealed";

-- ---------------------------------------------------------------------------
-- 2. The data-format version
--
-- One row, one integer. The application compares it against the highest format
-- it can read and REFUSES TO START if the stored value is higher.
--
--   1 = plaintext (pre-M-19 Phase 3)
--   2 = application-level envelope encryption, sealed column names
--
-- ⚠️ `CHECK (id = 1)` keeps this a singleton. Two rows would make "the current
-- format" ambiguous, and the guard would then compare against whichever row it
-- happened to read first.
-- ---------------------------------------------------------------------------

CREATE TABLE "data_format" (
  "id"         INTEGER NOT NULL DEFAULT 1,
  "version"    INTEGER NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "data_format_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "data_format_singleton" CHECK ("id" = 1),
  CONSTRAINT "data_format_version_positive" CHECK ("version" >= 1)
);

INSERT INTO "data_format" ("id", "version") VALUES (1, 2);
