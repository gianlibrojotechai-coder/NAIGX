-- D-78 (docs/53) — the position of a context element in its set.
--
-- Stage 6 grounds components and disposes of unknowns by the element's index
-- in the Stage 3 context set, and Stage 9's platform generator cites the same
-- index. The sink wrote the elements in that order and kept the id list in
-- memory for the run; nothing persisted the order, so a later read — the
-- `API-032` retry of the platform recommendation — could not rebuild the
-- indices the stored dispositions refer to. Rows stored before this column
-- carry 0 and are read back in storage order, which is what the harness has
-- always done.
ALTER TABLE "context_element"
  ADD COLUMN "ordinal" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "context_element_analysis_id_ordinal_idx"
  ON "context_element" ("analysis_id", "ordinal");
