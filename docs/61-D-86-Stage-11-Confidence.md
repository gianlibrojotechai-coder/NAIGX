# D-86 — Stage 11: the reduced v1 confidence model, fitted against the corpus once the corpus could supply the features

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; the paid step (Stage 1–3 captures for the 29 corpus cases with no recording) ran under a stated ceiling recorded in §3
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `FR-045` (confidence per analysis, with its factors), `AIQ-4` (weights and thresholds — recorded as BLOCKED by D-33 §3 because "closing the gap requires Stage 3 output for the remaining 33 cases, which requires provider execution and capture", prohibited under the zero-spend constraint the owner has since lifted), and M-05's eleventh stage. `AI-021`/`AC-007` (per-recommendation confidence) stay deferred (D-31 decision 5)
**Affects:** `stages/confidence-evaluation.ts` (new: CF-2, CF-4, CF-3, the rules, the evaluation), `confidence-model.ts` (the fitted constants), `confidence-wire.ts`, `contracts.ts` (`ConfidenceModel`, `ConfidenceFactor`, `ConfidenceEvaluation`, `PipelineResult.confidence`), `pipeline.ts` (Stage 11 between 10 and 12, on every result; `stopAfterStage` for the feature capture), `stages.ts` (Stage 11 implemented), `ports.ts`/`db/analysis-result-sink.ts` (`persistConfidence`), `prisma` (`analysis.overall_confidence_factors`, one migration), `db/analysis-reader.ts` (`overall_confidence`), `events.ts`/`orchestrator/execute-analysis.ts` (`complete` carries the band), `regression/assertions.ts` (`confidence_band` evaluated), `regression/capture.ts` + `scripts/regression.mts` (`--through=3`), `scripts/confidence-features.mts`, `scripts/confidence-fit.mts`, `export/markdown.ts`; the frontend `OverallConfidence.tsx`; `research/confidence-calibration/` (the Stage 1–3 captures, the features, the fit, the model)
**Builds on** D-31 (the ratified rules), D-32 (CF-1 excluded), D-33 (CF-6 excluded, CF-7's trigger withdrawn, the blocker stated), D-19 (stated spans verified — CF-2's measurement rests on it).

---

## 1. What v1 computes, and what it says it does not

Stage 11 is deterministic (`AI §3.3`): computed from measured factors, never model-reported (`AIP-2`). The v1 model is the reduced one the `AI §8.2` note describes:

| Factor | v1 treatment | Measured from |
|---|---|---|
| CF-2 requirement clarity | **weighted** | stated ÷ (stated + inferred) context elements |
| CF-4 evidence quality | **weighted** | mean `specificity_score` of the stated elements |
| CF-3 conflicting information | **cap at `medium`** (D-31 decision 2) | elements Stage 3 flagged `conflicts_with_index` |
| CF-1 input completeness | weight 0, versioned (D-32) | — |
| CF-5 platform certainty | weight 0, versioned (D-31 decision 4) | — |
| CF-6 reasoning consistency | weight 0, versioned (D-33) | — |
| CF-7 unknown materiality | cap with no computable trigger (D-33 §1) | — |

Two rules come before the weighted base: an analysis that generated no artifact beyond the intent brief carries `low` (D-31 decision 1 — a refusal at Stage 1, an insufficiency halt at Stage 3), and a flagged conflict caps a `high` base at `medium`. "Absence lowers, never raises" (`AI §8.4`): a factor that cannot be measured contributes 0 and says so.

**All seven factors are exposed on every result** — value, weight, role (`weighted` / `cap` / `unmeasured`) and a note saying why — so a reader sees that the band rests on two measured factors, not seven. The band travels as `overall_confidence_band` (the column `DB §6.1` reserved for Stage 11) with the factors beside it in `overall_confidence_factors`, reaches the API as `overall_confidence`, the `complete` event as `confidenceBand`, the export as a line under the analysis header, and the frontend as a table under the analysis. Per-recommendation confidence stays null and the presenter says why.

## 2. Fitted, not chosen

D-31 decision 6 requires the weights and thresholds to be calibrated against the 44 frozen band labels; D-33 §3 found only 10 usable measured cases and refused to fit four parameters to them. The blocker was evidence, and the evidence costs three provider calls per case:

- `regression:capture --through=3 --out=…` (new) stops a run cleanly after Stage 3 — the pipeline's `stopAfterStage`, refused without a held `--out` so a Stage 1–3 recording never lands in the canonical corpus, where the runner would read it as an unexpected halt.
- `confidence:features` computes CF-2, CF-4, the conflict count and the sufficiency for every case with a Stage 3 answer on record — the canonical recordings first, the calibration captures for the rest — and writes `research/confidence-calibration/features.{json,md}`.
- `confidence:fit` applies the rules, then grid-searches the clarity weight (CF-4 takes the remainder) and the two thresholds for the highest accuracy over the weighted cases, ties broken by the widest margin, and writes `fit.md` (with the confusion matrix and every case's prediction) and `model.json`. `CONFIDENCE_MODEL_V1` is copied from it and a unit test fails if they drift.

**The fit (`research/confidence-calibration/fit.md`):** clarity weight **0.4** (CF-2), evidence weight **0.6** (CF-4); `high` at base ≥ **0.827**, `medium` at ≥ **0.803**, `low` below (re-fitted the same day after D-87 recaptured `ew-001` — a new Stage 3 sample moved its features; the first fit was 0.45 / 0.846 / 0.807 with the same 34 of 44). It reproduces **31 of the 41** cases the weighted base decides and **34 of 44** overall with the rules applied — the 6 frozen `low` cases all reproduce (three by rule, three by the base), the 23 `high` cases 19, the 15 `medium` cases 9. The confusion is between `high` and `medium`: five `medium` cases score high and three `high` cases score medium, and the two thresholds sit 0.04 apart. **That is the honest capacity of two measured factors**: D-33 §3 row 5 anticipated it — the corpus author graded the *input*, the model measures Stage 3's *output* — and no third feature is invented to close the gap.

**What the accuracy means for the gate.** `confidence_band` is now evaluated by the runner on every case, and it is **advisory**: a mismatch is printed, recorded on the run and counted as evaluated, but it never fails the case, because a band that disagrees with the corpus author is a finding about the confidence model, not a regression of the fragment under test. Two of the fifteen canonical cases disagree — `br-004` (frozen medium, measured low at base 0.700) and `ew-001` (frozen medium, measured high at base 0.855) — and the run says so on each. The fit's rounding was aligned with the pipeline's (three decimals before the comparison) after `ta-005` was classified differently by the two on the boundary.

## 3. The evidence campaign

- **Stage 1–3 captures, 29 cases, $3.00 ceiling, Sonnet 5 medium:** 28 captured, 1 failed (`jd-004`, a Stage 3 quote with an elision the D-19 rule refuses), **$1.4825**; `jd-004` recaptured alone, **$0.0322**. Every capture halted after Stage 3 as requested, one artifact (the brief) each. They live in `research/confidence-calibration/stage3/corpus-v1`, outside the canonical corpus, with their own manifest.
- **Features:** 42 of 44 cases measured — 13 from the canonical recordings, 29 from the captures; `un-001`/`un-002` halt at Stage 1 and are decided by rule. `research/confidence-calibration/features.md` tabulates every case.
- **Campaign total: $1.5147.** The D-33 table's figures for the canonical cases are not reproduced here because those recordings were superseded three times since (D-78, D-79, D-80, D-84); the features are Stage 3's current output.

## 4. What is not changed

- Per-recommendation adjustment (`AI §8.3`, `AI-021`, `AC-007`) stays deferred; `Recommendation.confidence_band` stays null and both presenters say so.
- CF-1, CF-5, CF-6 and CF-7 stay as D-31/D-32/D-33 left them; the record that reweights them is the one that builds their sources (Stage 4 for CF-5).
- No fragment changed; the canonical recordings are untouched. The calibration captures are evidence for this record only.

## 5. Verification

| Check | Result |
|---|---|
| CF-2 and CF-4 measured as D-33 tabulated them; the weighted base against the thresholds; a conflict caps a high base and never raises; no artifact beyond the brief → low, whatever the base; all seven factors exposed with the unmeasured ones as such; the wire form | ✅ `tests/unit/nie-confidence-evaluation.test.ts` (5) |
| The pipeline's constants equal the fitted `model.json`, parameter for parameter | ✅ `tests/unit/confidence-model.test.ts` (2) |
| Stage 11 traces after Stage 10 on every result; the result carries a band with seven factors; the same input evaluates to the same band; `stopAfterStage` halts after Stage 3 with three provider calls | ✅ `tests/integration/nie-pipeline.test.ts` (+2) |
| `confidence_band` evaluated by the runner and the capture, advisory; a mismatch is reported and does not fail the case; a halted synthetic case expects `low`; every trace pin gains Stage 11 | ✅ `tests/integration/regression-runner.test.ts` (+1), pins updated deliberately |
| Full suite, lint, format, typecheck, build | ✅ 2026-09-10 — 1118 tests, 1114 pass, 0 fail, 4 skipped |
| Fifteen-case gate with `confidence_band` evaluated | ✅ 15 passed, two advisory mismatches printed (`br-004`, `jd-002`) → `efa67a16d03574d1` (no fragment changed, so no activation rests on it) |
| Production | ✅ **Deployed, 2026-09-10:** image `2e47ffbbea36` at `dfb9693` (rollback tag `rollback-8afa2bc`, the D-84 image), the `analysis.overall_confidence_factors` migration applied by the `migrate` service, no schema or fragment change, live mode unchanged; health 200, the live bundle carries the confidence table. ✅ **Live, 2026-09-10 00:01 UTC:** one billed requirement analysis (`br-001`, id `221a8e4c-693c-4853-a89d-6e1cfedaa55b`) under a temporary allowlisted address: **completed in 280 s, ten provider calls, $1.5622**, the page reported "Produced 11 artifacts: Intent brief, Platform recommendation, Risk assessment, Executive summary, Business analysis, Architecture recommendation, Complexity score, Implementation roadmap, Integration requirements, Edge cases and practices, Mermaid diagram", seventeen stream frames received in order; the row carries band `medium` with its seven factors. ⚠️ **One presentation defect found and fixed the same hour:** the browser check saw no confidence table on the page although the row held the band and factors — the view had been placed inside the Classification section, which opens closed. Moved into the always-open first section and redeployed (edge only, `4a1b481`). |

## 6. Minimum authoritative amendments to ratify

The `AI §8.2` v1 note (Stage 11 v1 exists; the base set and the fitted parameters); the `AIQ-4` row (answered by fit, with the accuracy stated); `docs/12` D-33's "blocked" register entry (unblocked by D-86); `STATUS` M-05 (11 of 12 stages) and the Stage 11 row.
