# M-10 — classification accuracy on the golden corpus, measured 2026-09-10

**Criterion** (`docs/08` M-10, `PRD M-6`): ≥ 95 % on the golden corpus.
**Result: 41 of 44 = 93.2 %. NOT MET.**

Taken offline, free, from the Stage 1 answer on record for every corpus case — the fifteen canonical recordings and the twenty-nine Stage 1–3 calibration captures D-86 made — compared with each case's frozen `expected_classification`. No label was changed, no case was recaptured to improve the figure, and every miss is listed.

## Per type

| Type | Correct | Cases |
|---|---|---|
| business_requirement | 11 | 11 |
| existing_workflow | 10 | 10 |
| job_description | 10 | 10 |
| technical_assessment | **8** | 11 |
| unsupported | 2 | 2 |
| **All** | **41** | **44** |

## Every mismatch

| Case | Frozen | Determined | Confidence | Source |
|---|---|---|---|---|
| ta-004 | technical_assessment | business_requirement | 0.75 | calibration capture, 2026-09-09 |
| ta-008 | technical_assessment | existing_workflow | 0.86 | calibration capture, 2026-09-09 |
| ta-011 | technical_assessment | business_requirement | 0.83 | calibration capture, 2026-09-09 |

All three misses are technical assessments read as the artifact they resemble — a requirement, a workflow — rather than as the exercise they are. `AI §4.1`'s purpose-primary rule ("the frame the submitter asks for governs") is the rule these inputs need, and the classification fragment is where it would be stated more strongly. Not changed here: a fragment change is a prompt change, gated and recaptured, and this file measures rather than fixes.

## The confidence-bound expectations, measured on the same answers

The corpus also freezes, per case, whether the classification confidence should sit at or above the 0.6 `FR-011` threshold or below it (the ambiguous cases, where `FR-015` confirmation should trigger). 41 of 44 agree. The three that do not are all **over-confidence on inputs the corpus author judged ambiguous**:

| Case | Expected | Confidence |
|---|---|---|
| ew-003 | below 0.6 | 0.85 |
| jd-001 | below 0.6 | 0.95 |
| ta-004 | below 0.6 | 0.75 (and misclassified) |

`PV §3.4` classifies false confidence as a defect; these are three instances of it at Stage 1. They do not count against the 95 % criterion, which is accuracy, and they are recorded because they bear on `FR-015`.

## What the recordings represent, and what they do not

| Property | The 44 answers measured | Production today |
|---|---|---|
| Classification fragment | `stage.classification` `fb90828bc337…` — **the current authored and active version** — on 42 cases; the two `unsupported` cases are legacy recordings (2026-08-14) whose composition was not persisted | the same fragment |
| Model | `claude-sonnet-5` (42), `claude-sonnet-4-5` (2, legacy) | **Opus 5 at high effort** (D-69) |
| Sampling | `lowVarianceSampling: false` — one sample each, unrepeated | one sample per analysis |
| Captured | 2026-08-14 (2), 2026-09-09 (42) | — |

So the figure measures **the current prompt on Sonnet 5**, one sample per case. It is not a measurement of the production model, and a single sample per case says nothing about variance: D-79 and D-84 saw the same Stage 3 fragment give different answers to the same input on consecutive captures, and Stage 1 is not exempt. A production measurement would cost 44 Stage 1 calls at Opus 5 high — cheap, but paid, and not made here.

## What would move it

Two of the three misses need one more correct answer each for 95 % (42 of 44). The candidates, none taken:

- strengthen the purpose-primary rule for assessments in `stage.classification`, then recapture the eleven `ta-*` cases (a fragment change: through the gate, with the two legacy `un-*` recordings' Stage 1 answers also needing the new composition);
- measure on the production model rather than Sonnet 5, on the chance the misses are model-specific;
- repeat samples per case to separate a wrong prompt from an unlucky draw.

Any of them is a decision with a cost, and the criterion is recorded as **failed on the evidence in hand**, not as pending.
