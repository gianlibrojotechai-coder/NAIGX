-- M-15 identity and operational domains.
--
-- Six things, all additive. No existing column, constraint or row is altered,
-- and no data is written or deleted.
--
--   1. REFRESH_TOKEN  -- D-44. SESSION cannot express API-002.
--   2. EXPORT, 3. FEEDBACK, 4. AUDIT_EVENT -- DB §4.4 and §4.6, previously
--      excluded because each needs an owner and identity did not exist.
--   5. A CHECK tying `credential_hash` nullability to `deleted_at`.
--   6. The anonymous-expiry boundary instant -- D-45 §3.

-- ---------------------------------------------------------------------------
-- 1. REFRESH_TOKEN (D-44)
--
-- A consumed row is RETAINED rather than deleted. That is the mechanism, not
-- an oversight: API-002 detects reuse by recognising a token that has already
-- been spent, and a token deleted on rotation cannot be recognised on reuse.
-- ---------------------------------------------------------------------------

CREATE TABLE "refresh_token" (
  "refresh_token_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id"       UUID NOT NULL,
  "family_id"        UUID NOT NULL,
  "token_hash"       TEXT NOT NULL,
  "issued_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"       TIMESTAMP(3) NOT NULL,
  "consumed_at"      TIMESTAMP(3),
  "replaced_by_id"   UUID,
  "revoked_at"       TIMESTAMP(3),

  CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("refresh_token_id"),
  CONSTRAINT "refresh_token_session_id_fkey" FOREIGN KEY ("session_id")
    REFERENCES "session"("session_id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- A token cannot expire before it was issued.
  CONSTRAINT "refresh_token_expiry_check" CHECK ("expires_at" > "issued_at")
);

CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");
CREATE INDEX "refresh_token_family_id_idx"  ON "refresh_token"("family_id");
CREATE INDEX "refresh_token_session_id_idx" ON "refresh_token"("session_id");
CREATE INDEX "refresh_token_expires_at_idx" ON "refresh_token"("expires_at");

-- ---------------------------------------------------------------------------
-- 2. EXPORT (DB §4.4)
--
-- `user_id` is NOT NULL by design (D-41 §3): this table exists to instrument
-- M-4, and a row attributable to nobody would corrupt the metric it serves.
-- An anonymous export writes nothing here.
-- ---------------------------------------------------------------------------

CREATE TABLE "export" (
  "export_id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "analysis_id"        UUID NOT NULL,
  "user_id"            UUID NOT NULL,
  "format"             "export_format" NOT NULL,
  -- Null means the full analysis; a list means an FR-052 partial export.
  "artifact_selection" JSONB,
  "generated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata_snapshot"  JSONB NOT NULL,

  CONSTRAINT "export_pkey" PRIMARY KEY ("export_id"),
  CONSTRAINT "export_analysis_id_fkey" FOREIGN KEY ("analysis_id")
    REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "export_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "export_analysis_id_idx" ON "export"("analysis_id");
CREATE INDEX "export_user_id_generated_at_idx" ON "export"("user_id", "generated_at");

-- ---------------------------------------------------------------------------
-- 3. FEEDBACK (DB §4.6) -- the one permitted exception to DP-3, because it is
-- user-authored rather than system-generated.
-- ---------------------------------------------------------------------------

CREATE TABLE "feedback" (
  "feedback_id"  UUID NOT NULL DEFAULT gen_random_uuid(),
  "analysis_id"  UUID NOT NULL,
  "user_id"      UUID NOT NULL,
  "helpful"      BOOLEAN NOT NULL,
  "detail"       TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feedback_pkey" PRIMARY KEY ("feedback_id"),
  CONSTRAINT "feedback_analysis_id_fkey" FOREIGN KEY ("analysis_id")
    REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One feedback record per analysis (§4.6 Constraints).
CREATE UNIQUE INDEX "feedback_analysis_id_key" ON "feedback"("analysis_id");
CREATE INDEX "feedback_helpful_idx" ON "feedback"("helpful");

-- ---------------------------------------------------------------------------
-- 4. AUDIT_EVENT (DB §4.6)
--
-- ON DELETE SET NULL, deliberately, and the only place in this schema where a
-- user reference is severed rather than cascaded. §4.6: the event that an
-- action occurred survives; the identity attached to it does not. That is what
-- lets FR-073 deletion completeness and the audit trail both hold.
--
-- No column here can hold user business content (NFR-081).
-- ---------------------------------------------------------------------------

CREATE TABLE "audit_event" (
  "audit_event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        UUID,
  "event_type"     TEXT NOT NULL,
  "resource_type"  TEXT NOT NULL,
  "resource_id"    TEXT,
  "occurred_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correlation_id" TEXT,
  "outcome"        TEXT NOT NULL,
  "ip_hash"        TEXT,

  CONSTRAINT "audit_event_pkey" PRIMARY KEY ("audit_event_id"),
  CONSTRAINT "audit_event_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "audit_event_user_id_occurred_at_idx" ON "audit_event"("user_id", "occurred_at");
CREATE INDEX "audit_event_resource_idx" ON "audit_event"("resource_type", "resource_id");
CREATE INDEX "audit_event_correlation_id_idx" ON "audit_event"("correlation_id");

-- ---------------------------------------------------------------------------
-- 5. `credential_hash` never null for an active account (DB §4.1 Constraints)
--
-- Expressible only now that nullability has a meaning: a deleted account keeps
-- its row until the cascade completes, and has no credential.
-- ---------------------------------------------------------------------------

ALTER TABLE "user" ADD CONSTRAINT "user_active_credential_check"
  CHECK ("deleted_at" IS NOT NULL OR "credential_hash" IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 6. THE ANONYMOUS-EXPIRY BOUNDARY -- D-45 §3
--
-- 2026-09-07T00:00:00Z is a FIXED INSTANT, recorded here and mirrored as a
-- frozen constant in src/db/anonymous-expiry.ts. It is not now() and must
-- never be recomputed: an instant that moves would silently change which rows
-- are exempt, which is the one property this boundary exists to pin.
--
-- WHY IT IS WHERE IT IS. The 22 unowned analyses in this store predate
-- anonymous-token issuance -- API-020 has always hashed a UUID and discarded
-- it, so no token for them has ever existed and they were never claimable.
-- Under D-45 they would expire on the day the mechanism lands, having never
-- had the 24-hour window the policy grants. They are also cited evidence: the
-- single live-provider run that cost 0.2732 USD, and analysis d797492d, which
-- STATUS.md cites as M-06 demonstrated FR-100 claim.
--
-- The newest such row is 2026-09-06T11:46:44.817Z, so this instant falls after
-- all of them and before anything created from this migration forward.
--
-- THIS IS A MIGRATION-ERA EVIDENCE EXEMPTION, NOT A RETENTION EXCEPTION. It
-- grants no standing category of exempt content, and deliberately adds NO
-- COLUMN to `analysis` -- a flag would be a permanent mechanism for what is a
-- one-off boundary. The sweep compares created_at against the constant.
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN "analysis"."anonymous_token_hash" IS
  'Hashed anonymous ownership token (FR-004, DB 10.3). Rows created before 2026-09-07T00:00:00Z predate token issuance and are exempt from the anonymous-expiry sweep -- see docs/20-D-45.';
