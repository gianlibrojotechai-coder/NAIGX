-- Refusal disposition (`API §9.3`, `FR-092`, `AI §5.4`).
--
-- A refusal is neither a failure nor a completion. Stage 1 declines an
-- unsupported input; Stage 3 stops an insufficient one. Both outcomes were
-- computed by the pipeline and then discarded by the orchestrator, so a
-- refused analysis was stored as `completed` and read back as an ordinary
-- result with empty sections -- the silent gap `PV §5` calls a defining
-- product moment.
--
-- PURELY ADDITIVE. Two nullable columns, no default, no backfill, no change to
-- any existing column or constraint. Every analysis stored before this
-- migration keeps exactly the state it had.
--
-- NULL MEANS "NO REFUSAL", NOT "UNKNOWN". Historical rows reached their own
-- outcomes and none of them was refused through this path; writing a stage or
-- a reason into them would invent a refusal that never happened. That is the
-- same rule `docs/16` D-41 applied to the EXPORT table: a column that is
-- visibly empty is better than one that is quietly wrong.

ALTER TABLE "analysis" ADD COLUMN "halted_at_stage" INTEGER;
ALTER TABLE "analysis" ADD COLUMN "halt_reason" TEXT;

-- Both columns are set together or not at all: a stage with no reason cannot
-- explain itself, and a reason with no stage cannot be located.
ALTER TABLE "analysis" ADD CONSTRAINT "analysis_halt_complete_check"
  CHECK (("halted_at_stage" IS NULL) = ("halt_reason" IS NULL));
