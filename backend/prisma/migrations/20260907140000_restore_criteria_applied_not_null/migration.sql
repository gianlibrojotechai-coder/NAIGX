-- Restore `AIP-4` / `DD-04`: an unexplained recommendation is unrepresentable.
--
-- `criteria_applied` was created NOT NULL by the primary-domain migration.
-- `20260906120000_job_description_persistence` relaxed it alongside the two
-- confidence columns, but only those two are justified by `docs/12` D-33 —
-- criteria are governed by `AIP-4`, and `DB §4.4` calls this "the most
-- important constraint in the schema... the database is the enforcement point".
--
-- Stage 7 now produces `criteria_applied` (`AI §3.2`), so the invariant is
-- restored rather than worked around.
--
-- BACKFILL BEFORE THE CONSTRAINT. One row predates Stage 7 producing criteria:
-- the recommendation from live smoke-test analysis d797492d. It is NOT deleted
-- — 24 `context_reference` rows point at it through a deliberately
-- non-foreign-key `referencing_id` (`DB §4.3`), so deleting it would orphan
-- them silently, and the analysis is the project's only live-run evidence.
-- The backfill states what the row is rather than inventing criteria for it.
UPDATE "recommendation"
SET "criteria_applied" =
  'Not recorded: this recommendation predates Stage 7 producing criteria_applied (FR-034, AI §3.2). Backfilled by migration 20260907140000; no criteria were captured at generation time.'
WHERE "criteria_applied" IS NULL;

ALTER TABLE "recommendation" ALTER COLUMN "criteria_applied" SET NOT NULL;
