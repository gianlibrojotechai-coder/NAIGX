# Confidence calibration — the evidence behind Stage 11's v1 model

Created 2026-09-10 by [D-86](../../docs/61-D-86-Stage-11-Confidence.md). Everything here is calibration evidence for the confidence model and **not** corpus evidence: nothing in this folder is read by `regression:run`, and nothing here activates a fragment.

| Path | What it is | How it is made |
|---|---|---|
| `stage3/corpus-v1/*.json` | Stage 1–3 recordings for the corpus cases that have no canonical recording — the pipeline stopped after Stage 3 by request, one artifact (the brief) each | `npm run regression:capture -- --through=3 --out=research/confidence-calibration/stage3 --case=…` (paid) |
| `stage3/corpus-v1/recordings.manifest.json` | The hashes of those recordings | written by the capture |
| `features.json`, `features.md` | CF-2 (stated ÷ stated + inferred), CF-4 (mean specificity of the stated elements), the conflict count and the sufficiency for every case with a Stage 3 answer on record — canonical recordings first, these captures for the rest — beside the frozen band | `npm run confidence:features -- --write` (free) |
| `fit.md`, `model.json` | The grid-searched clarity weight and two thresholds, with the confusion matrix and every case's prediction; `model.json` is what `backend/src/nie/confidence-model.ts` copies, and a unit test fails if they drift | `npm run confidence:fit -- --write` (free) |

**Re-fit when Stage 3's fragment changes.** The features are Stage 3's output; a canonical recording recaptured under a new Stage 3 fragment changes its features, and the calibration captures here were made under the fragment in force on 2026-09-10 (`stage.context_extraction` as recorded in each file's `composition`). A Stage 3 change should recapture these too — three calls per case — before re-fitting.

**What the fit says.** 34 of 44 labels reproduced; the six `low` cases all reproduce; the confusion is between `high` and `medium`. That is the capacity of two measured factors, and the record says so rather than adding a third.

## Re-measured 2026-09-10 after the D-90 recapture — model kept

D-90 changed `stage.intent` and `stage.architecture_analysis`, not Stage 3, but the twelve admitted D-90 recordings carry fresh Stage 3 answers (the intent handoff Stage 3 receives gained two fields), so `features.json` and `features.md` were regenerated from the recordings in force (`npm run confidence:features -- --write`: 42 of 44 measured — 13 canonical, 29 stage3). **The model was not re-fitted.** On the regenerated features the v1 model (`clarityWeight` 0.4, thresholds 0.827 / 0.803, fitted 2026-09-09) reproduces **33 of 44** labels (34 before; `br-003`'s new Stage 3 answer moved it from `high` to a predicted `low`), and the best grid fit on the same features (0.35, 0.835 / 0.799) also reproduces 33 of 44 with a different set of misses. A refit that gains nothing and moves four parameters would be chasing one recapture's sampling; `model.json` and `CONFIDENCE_MODEL_V1` stay at the 2026-09-09 fit and this note is the record of the check. The `jd-002` row is still the pre-D-90 recording's features.
