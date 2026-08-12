# NAIGX — Scoring Scales

**Authoritative scoring specification for complexity and risk output, Version 1.0.**

| Field | Value |
|---|---|
| Product | NAIGX — Automation Intelligence Platform |
| Core engine | NAIGX Intelligence Engine (NIE) |
| Document type | Scoring Scales (canonical) |
| Sources of truth | PRD v1.0 · MVP Scope v1.0 · AI Architecture v1.0 · Database Design v1.0 |
| Function | Defines the complexity factor set and weights, and the risk severity and likelihood scales |
| Resolves | `PRD O-2` · `PRD O-3` · `DBQ-3` · `DBQ-4` · `AIQ-2` · `AIQ-3` |
| Version | 1.0 |
| Last updated | 2026-08-12 |

---

## How this document is used

`FR-032` and `FR-033` require consistent, inspectable scales but do not define them. `DB §4.3` records both `RISK_ITEM` and `COMPLEXITY_ASSESSMENT` as **blocked** on that omission. This document closes it.

It defines scales only. It does not specify how the NIE arrives at a factor score, which is reasoning work belonging to `AI Architecture`, nor how scores are displayed, which belongs to the results presentation requirements.

> **Binding constraint.** Both scales are versioned. `COMPLEXITY_ASSESSMENT.scale_version` and the risk scale version are recorded per analysis so that scores produced under different scale versions are never silently compared (`DB §4.3`).

---

## 1. Complexity Scoring

Resolves `PRD O-2`, `DBQ-4`, `AIQ-2`. Scale version: `complexity-v1`.

### 1.1 Factor set and weights

Five factors. Weights total 100%.

| # | Factor | Weight |
|---|---|---|
| 1 | Workflow Complexity | 25% |
| 2 | Integration Complexity | 20% |
| 3 | Data Transformation / Logic Complexity | 20% |
| 4 | Error / Failure Risk | 20% |
| 5 | Operational / Maintenance Complexity | 15% |
| | **Total** | **100%** |

### 1.2 Per-factor scoring scale

Every factor is scored on the same 1–5 integer scale. A shared scale is what makes the weighted sum meaningful; factors scored on differing ranges could not be combined.

| Score | Label | Meaning |
|---|---|---|
| 1 | Minimal | Trivial in this dimension; requires no special handling |
| 2 | Low | Slightly above trivial; handled by standard approaches |
| 3 | Moderate | Requires deliberate design attention |
| 4 | High | A principal source of difficulty in the design |
| 5 | Severe | Dominates the design; drives the overall approach |

**Integer scores only.** Fractional factor scores would imply a discriminating power the assessment does not have, and would make identical inputs harder to score identically (`FR-033`).

### 1.3 Score computation

Three steps, in order.

| Step | Operation | Range |
|---|---|---|
| 1 | Score each factor 1–5 | 1–5 per factor |
| 2 | **Weighted score** = Σ (factor score × factor weight) | 1.00 – 5.00 |
| 3 | **Complexity score** = weighted score × 20 | 20 – 100 |

The weighted score is retained to two decimal places. The complexity score is the user-facing 0–100 value.

> ⚠️ **The achievable range is 20–100, not 0–100.**
> Because the minimum factor score is 1, the minimum weighted score is 1.00 and the minimum complexity score is 20. The scale is presented on a 0–100 axis for familiarity, but no analysis can produce a value below 20. This is a property of the approved model, recorded here so it is not later mistaken for a defect. See §4, ambiguity A-1.

### 1.4 Worked example — reconstructibility

`FR-033` requires that "a user can reconstruct how the score was reached from what is displayed." The displayed basis is the factor score, the weight, and the contribution for every factor.

| Factor | Score (1–5) | Weight | Contribution |
|---|---|---|---|
| Workflow Complexity | 4 | 25% | 1.00 |
| Integration Complexity | 3 | 20% | 0.60 |
| Data Transformation / Logic Complexity | 5 | 20% | 1.00 |
| Error / Failure Risk | 3 | 20% | 0.60 |
| Operational / Maintenance Complexity | 2 | 15% | 0.30 |
| **Weighted score** | | | **3.50** |
| **Complexity score** | | | **70** |

Contribution = score × weight. Weighted score = Σ contributions. Complexity score = weighted score × 20.

**A score displayed without this table is a defect** (`FR-033`), regardless of whether the number is correct.

### 1.5 What each factor assesses

Anchor descriptors at 1, 3, and 5. Scores of 2 and 4 fall between their neighbours. These anchors exist to make scoring repeatable — `FR-033` requires that identical inputs produce identical scores, which is unachievable if factors are scored on unstated intuition.

#### Factor 1 — Workflow Complexity (25%)

The structural intricacy of the process itself: step count, branching, conditionality, loops, parallelism, and human decision points.

| Score | Anchor |
|---|---|
| 1 | Linear sequence; no branching; few steps |
| 3 | Multiple branches or conditional paths; a moderate number of steps |
| 5 | Deep branching, loops, parallel paths, or many interacting decision points |

#### Factor 2 — Integration Complexity (20%)

The difficulty introduced by the systems the workflow must connect: how many, how heterogeneous, and how well they expose what is needed.

| Score | Anchor |
|---|---|
| 1 | No integration, or a single well-documented system |
| 3 | Several systems with conventional interfaces |
| 5 | Many systems, or systems with poor, absent, or unstable interfaces |

#### Factor 3 — Data Transformation / Logic Complexity (20%)

The work required to move data between representations and to express the rules the process encodes: mapping, reshaping, validation, enrichment, and business-rule density.

| Score | Anchor |
|---|---|
| 1 | Data passes through substantially unchanged; rules are trivial |
| 3 | Recognisable mapping between differing representations; a moderate rule set |
| 5 | Extensive reshaping, reconciliation across sources, or dense interacting rules |

#### Factor 4 — Error / Failure Risk (20%)

How exposed the workflow is to failure and how demanding correct failure handling is: failure modes, consequence of failure, idempotency and ordering requirements, and recoverability.

| Score | Anchor |
|---|---|
| 1 | Few failure modes; failure is inconsequential and trivially retried |
| 3 | Several failure modes requiring deliberate handling |
| 5 | Many failure modes, severe consequences, or demanding correctness properties such as idempotency or ordering |

**Relationship to the risk register.** This factor scores *how difficult failure handling makes the design*. It is not the risk register of §2, which enumerates specific risks against specific components. A design may score low here and still carry one critical risk, and the reverse. The two are deliberately separate outputs.

#### Factor 5 — Operational / Maintenance Complexity (15%)

The ongoing cost of running the workflow once built: monitoring, intervention, change frequency, and the knowledge required to keep it working.

| Score | Anchor |
|---|---|
| 1 | Runs unattended; changes rarely; needs no specialist knowledge |
| 3 | Periodic attention or routine change |
| 5 | Frequent intervention, continuous monitoring, or specialist knowledge to maintain |

**Lowest weight, deliberately.** At 15% this factor carries the least influence. It is the dimension a submitted input most often describes least, so weighting it higher would amplify the least-evidenced judgment in the assessment.

### 1.6 Determinism

`FR-033` requires identical inputs to produce identical scores. Three properties support this:

| Property | Effect |
|---|---|
| Integer factor scores | No fractional judgment to drift between runs |
| Fixed anchor descriptors (§1.5) | Scoring is against stated criteria, not unstated intuition |
| Fixed weights | The combination step is pure arithmetic |

Determinism of the *factor scores themselves* is a property of the reasoning stage, verified by the consistency requirement in `AI §12.3` and `FR-024`. This document guarantees only that identical factor scores always produce an identical complexity score.

### 1.7 Persistence

`COMPLEXITY_ASSESSMENT` (`DB §4.3`) stores `score`, `factor_breakdown` (factor, value, weight, contribution), and `scale_version`.

| Field | Value under this specification |
|---|---|
| `score` | The 20–100 complexity score |
| `factor_breakdown` | Five rows, one per factor, exactly as displayed in §1.4 |
| `scale_version` | `complexity-v1` |

The `DB §4.3` constraint that "contributions must reconstruct `score`" is verified as: Σ contributions × 20 = `score`, within two-decimal rounding.

---

## 2. Risk Scoring

Resolves `PRD O-3`, `DBQ-3`, `AIQ-3`. Scale version: `risk-v1`.

### 2.1 Severity scale

| Score | Label | Meaning |
|---|---|---|
| 1 | Minimal | Negligible consequence if it occurs |
| 2 | Low | Minor, contained consequence |
| 3 | Moderate | Material consequence requiring response |
| 4 | High | Serious consequence affecting the workflow's purpose |
| 5 | Critical | Severe consequence; the workflow fails its purpose or causes harm beyond itself |

### 2.2 Likelihood scale

| Score | Label | Meaning |
|---|---|---|
| 1 | Rare | Would require an exceptional combination of circumstances |
| 2 | Unlikely | Possible but not expected |
| 3 | Possible | Could reasonably occur |
| 4 | Likely | Expected to occur at some point |
| 5 | Almost Certain | Expected to occur routinely |

### 2.3 Risk score

**Risk Score = Severity × Likelihood**, producing a value from 1 to 25.

### 2.4 Risk bands

| Band | Risk Score |
|---|---|
| Low | 1 – 4 |
| Moderate | 5 – 9 |
| High | 10 – 14 |
| Very High | 15 – 19 |
| Critical | 20 – 25 |

### 2.5 Achievable products and band distribution

The bands are contiguous integer ranges, but a 1–5 × 1–5 product cannot take every integer value. Recording this explicitly prevents the sparseness from being mistaken later for a scoring error.

**Achievable products** — 14 distinct values:

`1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 20, 25`

**Unreachable values** — no severity/likelihood pair produces them:

`7, 11, 13, 14, 17, 18, 19, 21, 22, 23, 24`

The full matrix, with each cell's band:

| S \ L | 1 Rare | 2 Unlikely | 3 Possible | 4 Likely | 5 Almost Certain |
|---|---|---|---|---|---|
| **5 Critical** | 5 · Moderate | 10 · High | 15 · Very High | 20 · Critical | 25 · Critical |
| **4 High** | 4 · Low | 8 · Moderate | 12 · High | 16 · Very High | 20 · Critical |
| **3 Moderate** | 3 · Low | 6 · Moderate | 9 · Moderate | 12 · High | 15 · Very High |
| **2 Low** | 2 · Low | 4 · Low | 6 · Moderate | 8 · Moderate | 10 · High |
| **1 Minimal** | 1 · Low | 2 · Low | 3 · Low | 4 · Low | 5 · Moderate |

**Distribution across the 25 cells:**

| Band | Cells | Achievable scores in band |
|---|---|---|
| Low | 8 | 1, 2, 3, 4 |
| Moderate | 7 | 5, 6, 8, 9 |
| High | 4 | 10, 12 |
| Very High | 3 | 15, 16 |
| Critical | 3 | 20, 25 |

Two consequences worth stating:

- **`Very High` and `Critical` are narrow by construction.** Only three cells reach each. A risk classified `Critical` therefore represents one of just three severity/likelihood combinations, which makes the label meaningful rather than routine.
- **Band boundaries at 11, 13, 14, 17, 18, 19, 21–24 are inert.** They fall in the unreachable set, so moving them would not change any classification. The ranges are stated as approved rather than compressed to the achievable set, so that the bands remain readable as ordinary numeric ranges.

### 2.6 Constraints carried from `RISK_ITEM`

`DB §4.3` imposes constraints this specification must not weaken:

| Constraint | Effect on scoring |
|---|---|
| `component_id` non-nullable | **Every risk names the component or integration it affects** (`FR-032`). A risk that cannot name one cannot be stored, and therefore cannot be scored |
| `mitigation` non-empty | Every scored risk carries at least one concrete mitigation (`FR-032`) |
| `severity` and `likelihood` from the defined scales | The 1–5 integer scales in §2.1 and §2.2 |
| Index on `(severity, likelihood)` | Scores are stored as their component values, not only as the product |

**Generic risks remain a defect** (`FR-032`). A high risk score does not excuse a risk that is not specific to the submitted design.

### 2.7 Persistence

`RISK_ITEM` stores `severity` and `likelihood` as integers 1–5. The risk score and band are **derived**, not stored, so a band-boundary revision does not require rewriting stored analyses. The scale version applicable to an analysis is `risk-v1`.

---

## 3. Versioning and revision

| Rule | Rationale |
|---|---|
| Both scales carry a version identifier | Scores from different scale versions must never be silently compared (`DB §4.3`) |
| A change to any factor, weight, label, or band boundary increments the version | Any of these changes the meaning of a score |
| Stored analyses retain the version under which they were produced | Analyses are immutable (`DB DP-3`) |
| Historical analyses are never rescored | Rescoring would alter a record of what the system concluded |

Current versions: `complexity-v1`, `risk-v1`.

---

## 4. Remaining ambiguity

Recorded rather than concealed, consistent with the practice of the other specification documents.

| # | Ambiguity | Status |
|---|---|---|
| A-1 | **The complexity scale is labelled 0–100 but achieves only 20–100.** A consequence of a 1-based factor minimum combined with ×20 conversion. Alternatives, if this is later judged undesirable: score factors 0–5, or map [1.00, 5.00] onto [0, 100] linearly | Recorded, not decided. Owner-approved model retained as specified |
| A-2 | **Factor anchor descriptors are drafted, not derived from an authoritative source.** No existing NAIGX document defines what "Workflow Complexity 4" means. §1.5 is the first statement of it | Requires owner review. Everything else in §1 follows directly from the approved decision |
| A-3 | **No calibration data exists yet.** Whether the weights produce intuitively correct relative scores is untested until the golden corpus (`docs/11`) is built and scored | Expected. `AI §8.5` calibration adjusts weights, not individual outputs |

---

## 5. Traceability

| Requirement | Satisfied by |
|---|---|
| `FR-032` — risk register with severity, likelihood, affected component, mitigation | §2 |
| `FR-033` — complexity score with itemized, inspectable, reconstructible basis | §1.3, §1.4, §1.7 |
| `FR-033` — identical inputs produce identical scores | §1.6 |
| `PRD O-2` — complexity factor set and weights | §1.1, §1.2 |
| `PRD O-3` — risk severity and likelihood scales | §2.1, §2.2 |
| `DBQ-3` — unblocks `RISK_ITEM` | §2.6, §2.7 |
| `DBQ-4` — unblocks `COMPLEXITY_ASSESSMENT` | §1.7 |
| `AIQ-2`, `AIQ-3` | §1, §2 |

---

*This document resolves `PRD O-2` and `PRD O-3`. It is versioned with the scales it defines; a scale change is a document revision, not an amendment in place.*
