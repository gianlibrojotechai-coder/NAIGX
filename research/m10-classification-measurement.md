# M-10 — classification accuracy on the golden corpus, measured 2026-09-10 (later, on the corrected classification fragment)

**Criterion** (`docs/08` M-10, `PRD M-6`): ≥ 95 % on the golden corpus.
**Result: 40 of 43 measured cases correct = 93.0 %. NOT MET.** One case (`jd-003`) has no Stage 1 answer on the current fragment: its two Stage 1–3 captures both failed at Stage 3 on a paraphrased source quote, the same slip class `br-001` showed, and it was not sampled a third time. Counting it as unmeasured, not as wrong.

**Regenerate:** `npm run measure:classification` — every table below is that script's output over the recordings in force: the 15 canonical recordings of the D-90b campaign (`research/regression-recordings`) and the 28 Stage 1–3 captures retaken the same day (`research/confidence-calibration/stage3`, **$1.5600** with the failed `jd-003` re-run). **Single model, single fragment:** every answer is `claude-sonnet-5`, one sample, on `stage.classification` as corrected by [D-90 §7](../docs/65-D-90-Planning-By-Judgement.md) (one sentence: type-confidence is not a measure of the input's detail). The mixed-model caveat of the morning measurement no longer applies — the two Sonnet 4.5 legacy recordings were superseded by this campaign. Still not the production model (Opus 5 at high effort).

**What the correction changed, and what it did not.** It was aimed at one thing and moved one thing: `br-005` now classifies at 0.75 against its frozen bound of ≥ 0.6 (0.55 on both D-90 samples, 0.62 on 2026-09-09). The three misclassifications are the same three technical assessments read as the artifact they resemble (`ta-004`, `ta-008`, `ta-011`) and the three over-confidence cases are the same (`ew-003`, `jd-001`, `ta-004`); the purpose-primary rule for assessments that the morning measurement pointed at was deliberately **not** bundled into this change, so its effect could be attributed. That remains the lever for the 95 % criterion, and it is a fragment change with its own recapture, not taken here.



## Per frozen type

| Type | Correct | Cases | Accuracy |
|---|---|---|---|
| business_requirement | 11 | 11 | 100.0 % |
| existing_workflow | 10 | 10 | 100.0 % |
| job_description | 9 | 9 | 100.0 % |
| technical_assessment | 8 | 11 | 72.7 % |
| unsupported | 2 | 2 | 100.0 % |
| **All** | **40** | **43** | **93.0 %** |

Unrecorded (no Stage 1 answer on file): jd-003

Models: claude-sonnet-5 (43)

## Every mismatch

| Case | Frozen | Determined | Confidence | Source | Captured |
|---|---|---|---|---|---|
| ta-004 | technical_assessment | business_requirement | 0.72 | stage3 | 2026-09-10 |
| ta-008 | technical_assessment | existing_workflow | 0.85 | stage3 | 2026-09-10 |
| ta-011 | technical_assessment | business_requirement | 0.82 | stage3 | 2026-09-10 |

## Confidence-bound expectations: 40 of 43 agree

- ew-003: expected < 0.6, got 0.85
- jd-001: expected < 0.6, got 0.92
- ta-004: expected < 0.6, got 0.72 (and misclassified)

## Every case

| Case | Frozen type | Determined | Confidence | Frozen bound | Bound met | Source | Model | Captured |
|---|---|---|---|---|---|---|---|---|
| br-001 | business_requirement | business_requirement | 0.97 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| br-002 | business_requirement | business_requirement | 0.95 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| br-003 | business_requirement | business_requirement | 0.93 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| br-004 | business_requirement | business_requirement | 0.85 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| br-005 | business_requirement | business_requirement | 0.75 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| br-006 | business_requirement | business_requirement | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| br-007 | business_requirement | business_requirement | 0.92 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| br-008 | business_requirement | business_requirement | 0.75 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| br-009 | business_requirement | business_requirement | 0.95 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| br-010 | business_requirement | business_requirement | 0.95 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| br-011 | business_requirement | business_requirement | 0.95 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| ew-001 | existing_workflow | existing_workflow | 0.98 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| ew-002 | existing_workflow | existing_workflow | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ew-003 | existing_workflow | existing_workflow | 0.85 | < 0.6 | **no** | stage3 | claude-sonnet-5 | 2026-09-10 |
| ew-004 | existing_workflow | existing_workflow | 0.95 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ew-005 | existing_workflow | existing_workflow | 0.98 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ew-006 | existing_workflow | existing_workflow | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ew-007 | existing_workflow | existing_workflow | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ew-008 | existing_workflow | existing_workflow | 0.93 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ew-009 | existing_workflow | existing_workflow | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ew-010 | existing_workflow | existing_workflow | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| jd-001 | job_description | job_description | 0.92 | < 0.6 | **no** | stage3 | claude-sonnet-5 | 2026-09-10 |
| jd-002 | job_description | job_description | 0.98 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| jd-004 | job_description | job_description | 0.95 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| jd-005 | job_description | job_description | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| jd-006 | job_description | job_description | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| jd-007 | job_description | job_description | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| jd-008 | job_description | job_description | 0.97 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| jd-009 | job_description | job_description | 0.98 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| jd-010 | job_description | job_description | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-001 | technical_assessment | technical_assessment | 0.98 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-002 | technical_assessment | technical_assessment | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-003 | technical_assessment | technical_assessment | 0.95 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-004 | technical_assessment | **business_requirement** | 0.72 | < 0.6 | **no** | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-005 | technical_assessment | technical_assessment | 0.90 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| ta-006 | technical_assessment | technical_assessment | 0.95 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-007 | technical_assessment | technical_assessment | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-008 | technical_assessment | **existing_workflow** | 0.85 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-009 | technical_assessment | technical_assessment | 0.90 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-010 | technical_assessment | technical_assessment | 0.97 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| ta-011 | technical_assessment | **business_requirement** | 0.82 | ≥ 0.6 | yes | stage3 | claude-sonnet-5 | 2026-09-10 |
| un-001 | unsupported | unsupported | 0.97 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
| un-002 | unsupported | unsupported | 0.75 | ≥ 0.6 | yes | canonical | claude-sonnet-5 | 2026-09-10 |
