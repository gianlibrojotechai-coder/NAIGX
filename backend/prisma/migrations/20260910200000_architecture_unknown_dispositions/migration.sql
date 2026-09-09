-- D-78 (docs/53) — how Stage 6 disposed of each unknown context element.
--
-- D-38 measured the exposure: an architecture could cite an `unknown` context
-- element as if it were known, with no field recording whether the design
-- assumed it, excluded the part that depends on it, or deferred it. The
-- contract now carries one entry per unknown element — `context_index`,
-- `disposition` (assumed | excluded | deferred), `statement` — and the parser
-- refuses an architecture that leaves an unknown undisposed.
--
-- Stored as JSON beside the model rather than as rows: the entries are read
-- and written as one set with the architecture they belong to, reference
-- context elements by the same index the components' grounding uses, and are
-- never queried individually. Default `[]` keeps every existing row valid.
ALTER TABLE "architecture_model"
  ADD COLUMN "unknown_dispositions" JSONB NOT NULL DEFAULT '[]'::jsonb;
