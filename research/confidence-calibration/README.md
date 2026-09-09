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
