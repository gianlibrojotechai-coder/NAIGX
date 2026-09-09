-- D-86 (docs/61) — the factors behind the analysis's confidence band.
--
-- `overall_confidence_band` has been "written at Stage 11" since the schema
-- was designed; Stage 11 now exists. `AI §8.4` requires the factors to be
-- exposed with the band, and a read-back that had only the band could not
-- honour that, so the seven factors land beside it as Stage 11 rendered them.
ALTER TABLE "analysis"
  ADD COLUMN "overall_confidence_factors" JSONB;
