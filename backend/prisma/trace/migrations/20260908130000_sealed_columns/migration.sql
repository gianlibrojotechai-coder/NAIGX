-- M-19 Phase 4a — the trace store's half of the sealed-column rename.
--
-- The reasoning is in the primary store's migration of the same date. In short:
-- a pre-encryption build cannot be changed, so the only way to stop it
-- misreading sealed data is to make the data unreachable under the name it asks
-- for. `SELECT ... structured_input ...` now fails with `42703
-- undefined_column` instead of returning an envelope.
--
-- ⚠️ BOTH STORES, OR NEITHER. `structured_input` and `structured_output` live
-- here while `raw_content` lives in the primary store (`DB §1.4` — separate
-- databases, no foreign key between them). Renaming only one store would leave
-- an old build failing on analyses and quietly succeeding on traces, which is
-- the same silent-misread problem with a smaller blast radius rather than a
-- solved one.
--
-- No value is read, rewritten or re-encrypted. Columns only.
--
-- The data-format version lives in the PRIMARY store, not here: it is one
-- deployment-wide fact, and duplicating it across two databases would create a
-- pair that can disagree.

ALTER TABLE "stage_trace"
  RENAME COLUMN "structured_input" TO "structured_input_sealed";

ALTER TABLE "stage_trace"
  RENAME COLUMN "structured_output" TO "structured_output_sealed";
