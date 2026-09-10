-- D-90 (docs/65) — planning by judgement.
--
-- Stage 2 now records what the submitter asked to receive, and Stage 6 can
-- conclude that automation is unwarranted (FR-020) instead of designing.
-- Both are facts the read-back must carry: the artifact plan's omission
-- reasons quote them, and a reader has to be able to see the source.
ALTER TABLE "intent_record"
  ADD COLUMN "requested_outcome" TEXT NOT NULL DEFAULT 'design',
  ADD COLUMN "decline_quote" TEXT;
ALTER TABLE "intent_record"
  ADD CONSTRAINT "intent_record_requested_outcome_check"
    CHECK ("requested_outcome" IN ('design', 'understanding_only')),
  ADD CONSTRAINT "intent_record_decline_quote_check"
    CHECK (("requested_outcome" = 'understanding_only') = ("decline_quote" IS NOT NULL));

ALTER TABLE "architecture_model"
  ADD COLUMN "automation_unwarranted_statement" TEXT;

-- depth_level was a single value (docs/12 D-34); D-90 adds `minimal`. The
-- column had no CHECK, so no constraint changes; this records the domain.
COMMENT ON COLUMN "artifact_plan_entry"."depth_level" IS 'standard | minimal (D-90)';
