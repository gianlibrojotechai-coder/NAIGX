# NAIGX — Reasoning Quality Rubric

**Authoritative definition of reasoning quality assessment for Version 1.0.**

| Field | Value |
|---|---|
| Product | NAIGX — Automation Intelligence Platform |
| Core engine | NAIGX Intelligence Engine (NIE) |
| Document type | Reasoning Quality Rubric (canonical) |
| Sources of truth | PRD v1.0 · MVP Scope v1.0 · AI Architecture v1.0 · Engineering Roadmap v1.0 |
| Function | Operationalizes the `AI §7.5` reasoning quality criteria into an applicable review instrument |
| Resolves | `PRD O-1` · `AIQ-1` |
| Version | 1.0 |
| Last updated | 2026-08-12 |

---

## How this document is used

`AI §12.6` states that the rubric is **"the §7.5 criteria, operationalized in Sprint 0."** This document is that operationalization. It introduces no new criteria: the seven criteria in §2 are reproduced from `AI §7.5`, including their "failing looks like" descriptions.

What this document adds is everything needed to *apply* them — a scoring method, a pass condition, a review procedure, an independence requirement, and a way of measuring reviewer agreement.

> **Why this blocks so much.** `M-08` (reasoning quality gate) is, per `Roadmap §0`, "the one that can fail in a way no amount of effort resolves — and every milestone after it is wasted if it fails." Until this rubric exists, `M-08` has no pass condition, `M-8` and `M-9` have no instrument, and the `PRD §14.3` release gate rests on unstructured judgment.

---

## 1. Purpose and scope

### 1.1 What the rubric gates

| Gate | Dependency on this rubric |
|---|---|
| `M-08` / `TM-6` — reasoning quality gate | "Sampled output passes the rubric" |
| `M-8` — recommendation explicability | Instrument for the manual review protocol; target 100% |
| `M-9` — platform recommendation defensibility | Instrument for the manual review protocol; target 100% |
| `AI §12.5` — acceptance threshold "Human quality review: passes the rubric" | Defines what passing means |
| `AI §8.5` — confidence calibration | Supplies the assessed-quality judgment compared against the assigned band |
| `PRD §14.3` — the release gate | Structured input to the qualitative judgment; does not replace it (see §1.3) |

### 1.2 Unit of assessment

One completed analysis. Criteria are assessed against the analysis as a whole, not per artifact, because several criteria — Proportional, Complete, Consistent — are only meaningful at that level.

### 1.3 What the rubric does not do

| Not in scope | Why |
|---|---|
| Replace the `PRD §14.3` release gate | The gate is a deliberately qualitative judgment: *"would a competent automation practitioner consider it professional work?"* A rubric pass is evidence toward it, not a substitute for it |
| Assess mechanical properties | Schema validity, reference integrity, and classification accuracy are verified deterministically (`AI §12.5`). The rubric exists precisely for what mechanical checks cannot verify (`AI §12.6`) |
| Produce a numeric quality score | See §3.2 |
| Assess the user's workflow | The rubric assesses NAIGX's reasoning about the workflow, not the workflow itself |

---

## 2. The seven criteria

Reproduced from `AI §7.5`. The **Criterion** and **Failing looks like** columns are verbatim from that section and must not be altered here; a change to them is a change to `AI §7.5`.

For each criterion the reviewer records a **verdict** (pass or fail) and **evidence** (§3.3). Evidence is mandatory in both directions — a pass without evidence is not a pass.

---

### C-1 · Grounded

| | |
|---|---|
| **Failing looks like** | Claims not traceable to context |
| **Passes when** | Every substantive claim traces to a context element extracted from the input, or is explicitly labelled inferred or unknown (`FR-013`) |
| **Evidence to record** | For the analysis, at least one claim checked against its provenance label. On failure, the specific ungrounded claim |
| **Related** | `FR-013`, `FR-042`, `M-8` |

### C-2 · Specific

| | |
|---|---|
| **Failing looks like** | Generic advice applicable to any input |
| **Passes when** | Recommendations, risks, and components refer to this submission's particulars. A risk that does not name a component fails by construction (`FR-032`) |
| **Evidence to record** | On failure, the generic statement and why it would apply unchanged to a different input |
| **Related** | `FR-032`, `AC-013` |

### C-3 · Proportional

| | |
|---|---|
| **Failing looks like** | Depth mismatched to problem complexity |
| **Passes when** | The artifact set and depth match what the input supports. Minimal input yields a minimal artifact set (`FR-017`); over-production is a defect (`PV §3.2`) |
| **Evidence to record** | The artifact set produced, and whether the plan's inclusion and omission reasons justify it (`ARTIFACT_PLAN_ENTRY`) |
| **Related** | `FR-017`, `AC-037` |

### C-4 · Complete

| | |
|---|---|
| **Failing looks like** | Material consideration omitted silently |
| **Passes when** | Nothing material is missing without being named as omitted or unknown. Deliberate omission with a stated reason is a pass; silent omission is a fail |
| **Evidence to record** | On failure, the omitted consideration and why it is material |
| **Related** | `FR-044`, `FR-091` |

### C-5 · Honest

| | |
|---|---|
| **Failing looks like** | Uncertainty concealed; unknowns filled with plausible defaults |
| **Passes when** | Unknowns are surfaced with what would resolve them (`FR-044`); uncertain platform characteristics are disclosed rather than asserted (`AI-042`); confidence is not uniformly presented across non-uniform certainty (`FR-045`) |
| **Evidence to record** | On failure, the invented detail or the concealed uncertainty |
| **Related** | `FR-044`, `FR-045`, `AI-042` |

### C-6 · Defensible

| | |
|---|---|
| **Failing looks like** | The user cannot answer "why this, not the alternative?" |
| **Passes when** | Recommendations state their criteria and at least one rejected alternative with a reason (`FR-034`) |
| **Evidence to record** | The stated criteria and rejected alternative, or their absence. **This criterion is the direct instrument for `M-9`** |
| **Related** | `FR-034`, `M-9` |

### C-7 · Consistent

| | |
|---|---|
| **Failing looks like** | Similar inputs yielding materially different treatment |
| **Passes when** | Treatment is materially consistent with comparable corpus cases and with repeated runs of the same input (`FR-024`) |
| **Evidence to record** | The comparison case used. **Requires more than one analysis to assess** — see §3.4 |
| **Related** | `FR-024`, `AI §12.3` |

---

## 3. Scoring method

### 3.1 Pass/fail per criterion

Each criterion receives **pass** or **fail**. There is no partial credit and no weighting between criteria.

### 3.2 Why not a numeric score

No authoritative NAIGX requirement asks for a numeric reasoning-quality score. `AI §12.5` states the threshold as "Passes the rubric" — a binary. `M-8` and `M-9` are percentages *of sampled outputs meeting a condition*, which requires a per-analysis binary, not a scale.

A numeric score would also imply a precision the instrument does not have. The same reasoning appears in `AI §8.5` for confidence: **"Bands, not scores. A numeric score implies a precision the underlying measurement does not have, and invites false comparison."** That argument applies here with equal force.

### 3.3 Evidence requirement

Every verdict records evidence. This is what makes reviewer agreement measurable — two reviewers can agree on a verdict for different reasons, and without recorded evidence that disagreement is invisible.

| Verdict | Evidence recorded |
|---|---|
| Pass | The specific element checked that satisfied the criterion |
| Fail | The specific element that failed, and why |

A verdict submitted without evidence is **not recorded as a verdict** and the review is incomplete.

### 3.4 The Consistent criterion

`C-7` cannot be assessed from a single analysis in isolation — it is comparative by definition. It is therefore assessed:

| Context | Method |
|---|---|
| Within a review sample | Against another analysis of the same input type in the same sample |
| Against the corpus | Against the expected treatment of a comparable golden corpus case (`docs/11`) |
| Across runs | Against a repeat run of the same input (`FR-024`) |

Where no comparison case is available, `C-7` is recorded as **not assessable** rather than as a pass. Not-assessable is excluded from agreement calculations (§6.1).

### 3.5 Pass condition

| Level | Condition |
|---|---|
| **Per analysis** | All seven criteria pass. Any fail means the analysis fails the rubric |
| **Per sample** | Reported as the proportion of analyses passing, and as a per-criterion failure breakdown |
| **`M-8` / `M-9`** | Both target 100% of sampled outputs (`PRD §3.2`). `C-1` is the instrument for `M-8`; `C-6` for `M-9` |

**Per-criterion reporting is required, not optional.** A sample where 60% of analyses pass tells you little; a sample where every failure is `C-5 Honest` tells you exactly where to look.

---

## 4. Review procedure

### 4.1 Sampling

| Property | Requirement | Source |
|---|---|---|
| Volume before v1.0 | ≥20 analyses per input type | `PRD §14.1`, `AI §12.6` |
| Independent viability check | ≥5 generated architectures reviewed for implementation viability | `PRD §14.1` |
| Cadence | Sampled continuously; comprehensive before any release | `AI §12.6` |
| Stratification | Across confidence bands | `AI §8.5` |

Stratification matters because `AI §8.5` compares assessed quality against assigned confidence band. A sample drawn only from `high` confidence analyses cannot detect under-confidence.

### 4.2 Blind review

Reviewers assess **without knowing the fragment version**, to avoid anchoring (`AI §12.6`). Where practical, the reviewer should also not know whether the analysis is expected to pass.

### 4.3 Reviewer independence

`D4`, and consistent with `PRD §14.1`'s existing requirement that architectures be "reviewed by someone other than the author."

| Rule | Detail |
|---|---|
| **Independent reviewer required** | At least one human reviewer who did not create the original assessment |
| **AI review is not a substitute** | An AI reviewer may not be counted as the independent reviewer, in any capacity, for any criterion |
| **Author participation** | The author may review, but an author-only review is recorded as single-reviewer and cannot satisfy an agreement measurement |
| **Reporting obligation** | Where only single-reviewer judgment was available, results are reported as single-reviewer (`AI §12.6`) |

**Why AI review is excluded.** The rubric exists to assess the output of an AI reasoning system. Using an AI to judge it would make the instrument share the failure modes of the thing measured — most acutely for `C-5 Honest` and `C-1 Grounded`, where a model that invents plausible detail is poorly placed to detect invented plausible detail.

### 4.4 Review record

Each reviewed analysis produces one record:

| Field | Content |
|---|---|
| Analysis identifier | — |
| Input type | `business_requirement` · `existing_workflow` · `job_description` · `technical_assessment` |
| Assigned confidence band | `high` · `medium` · `low` |
| Reviewer identifier | Distinguishes author from independent reviewer |
| Per criterion | Verdict (pass / fail / not assessable) + evidence |
| Overall | Pass / fail per §3.5 |
| Date | ISO 8601 |

Records are retained; they are the evidence base for `PRD §14.1`'s evidential criteria.

---

## 5. Agreement measurement

`D4` requires that agreement and disagreement be measured and recorded. This section defines how.

### 5.1 Percentage agreement per criterion

Where two reviewers assess the same analysis:

```
agreement(criterion) = matching verdicts / analyses assessed by both reviewers
```

| Rule | Detail |
|---|---|
| Computed **per criterion**, not overall | An instrument can agree strongly on `C-2` and poorly on `C-4`; a single figure conceals exactly what needs fixing |
| Verdicts of `not assessable` are excluded | From both numerator and denominator, for that criterion only |
| Reported alongside the sample size | A percentage without its denominator is not interpretable |

### 5.2 No Cohen's κ in v1

Percentage agreement does not correct for agreement expected by chance, and κ would. It is deliberately excluded from v1 for two reasons: the dual-reviewed sample is expected to be small, and κ is unstable at small n and on skewed distributions — which a criterion passing 95% of the time will be.

**Revisit when** the dual-reviewed sample is large enough for κ to be stable. Recorded as ambiguity A-2.

### 5.3 Disagreement log

Every disagreement produces an entry. **The log is the primary output of agreement measurement** — the percentage tells you agreement is imperfect; the log tells you why.

| Field | Content |
|---|---|
| Analysis identifier | — |
| Criterion | Which of `C-1`–`C-7` |
| Verdict A / Verdict B | Each reviewer's verdict |
| Evidence A / Evidence B | Each reviewer's recorded evidence |
| Disagreement type | §5.4 |
| Resolution | §5.5 |
| Rubric change required | Yes / no, with reference |

### 5.4 Disagreement types

Classifying the disagreement is what turns the log into rubric improvement rather than a tally.

| Type | Meaning | Typical response |
|---|---|---|
| **Interpretive** | Reviewers applied the criterion differently | Sharpen the criterion's "passes when" wording |
| **Evidential** | Reviewers examined different parts of the analysis | Tighten the evidence requirement |
| **Threshold** | Agreement on the facts, disagreement on whether they clear the bar | Add an anchor or a boundary example |
| **Error** | One reviewer was demonstrably mistaken | No rubric change |

### 5.5 Resolution procedure

| Step | Action |
|---|---|
| 1 | Both reviewers re-examine the analysis against the recorded evidence |
| 2 | If one reviewer accepts the other's evidence, record the resolved verdict and the type as `Error` |
| 3 | If disagreement persists, **the failing verdict stands.** The analysis is recorded as failing that criterion |
| 4 | Classify the disagreement type and record whether a rubric change is required |
| 5 | Apply any rubric change as a version increment (§6). Do not silently re-score past reviews |

**Why the failing verdict stands.** A quality instrument that resolves ambiguity in favour of passing measures optimism. `AI §8.5` establishes the same asymmetry for confidence: over-confidence "damages trust irrecoverably" while under-confidence "merely annoys."

### 5.6 Reporting

Each review round reports: analyses reviewed, dual-reviewed count, per-criterion pass rate, per-criterion agreement percentage with denominators, open disagreement count, and rubric changes made.

---

## 6. Rubric versioning

| Rule | Rationale |
|---|---|
| Version recorded on every review record | Reviews under different rubric versions are not directly comparable |
| Any change to a criterion's "passes when", evidence requirement, or pass condition increments the version | Each alters what a verdict means |
| Changes to `AI §7.5` criterion text are changes to that document | This rubric reproduces those criteria; it does not own them |
| Past reviews are never re-scored under a new version | The record of what was assessed, when, and against what standard is preserved |

Current version: `rubric-v1`.

---

## 7. Relationship to confidence calibration

`AI §8.5` compares assessed quality against assigned confidence band. This rubric supplies the assessed-quality side.

| `AI §8.5` step | Supplied by |
|---|---|
| Sample | §4.1 stratified sampling |
| Assess | §2 criteria, §3 method |
| Compare | Rubric verdict against assigned band |
| Detect | `high` band on rubric-failing output = over-confidence (severe) |
| Adjust | Confidence factor weights — **not individual outputs** |

`AI §12.5` states the calibration threshold as "no `high` on rubric-failing output." Under §3.5, "rubric-failing" means at least one criterion failed.

---

## 8. Remaining ambiguity

| # | Ambiguity | Status |
|---|---|---|
| A-1 | **Who the independent reviewer is has not been named.** `D4` requires one; `Roadmap EP-6` requires demonstrating to someone who isn't you. For a solo operator this is a resourcing question the rubric cannot answer | Requires owner action before `M-08` |
| A-2 | **Agreement target unset.** No authoritative document states what agreement percentage is acceptable. `PRD O-1` says "specific enough for two reviewers to agree" without quantifying | Recorded. Suggest setting after the first dual-reviewed round supplies a baseline |
| A-3 | **`C-7 Consistent` may be frequently not assessable** early on, when few comparable analyses exist | Expected to resolve as the corpus is built (`docs/11`) |
| A-4 | **Criterion "passes when" statements are drafted here**, not reproduced from an authoritative source. Only the criterion names and "failing looks like" are verbatim from `AI §7.5` | Requires owner review |

---

## 9. Traceability

| Requirement | Satisfied by |
|---|---|
| `PRD O-1` — operational definition of reasoning quality | §2, §3, §4 |
| `AIQ-1` — rubric achieving inter-reviewer agreement | §5 |
| `AI §12.6` — rubric as "the §7.5 criteria, operationalized" | §2 |
| `AI §12.5` — "Human quality review: passes the rubric" | §3.5 |
| `PRD §14.1` — ≥20 per input type; ≥5 independently reviewed | §4.1 |
| `PRD §3.2` `M-8`, `M-9` | `C-1`, `C-6`; §3.5 |
| `AI §8.5` — calibration | §7 |
| `D4` — independent human reviewer, agreement measured and recorded | §4.3, §5 |

---

*This document resolves `PRD O-1` and `AIQ-1`. `AI §12.6` describes the open rubric as "the largest methodological weakness in the v1.0 quality apparatus" — that weakness is reduced by this document but not eliminated while ambiguity A-1 stands.*
