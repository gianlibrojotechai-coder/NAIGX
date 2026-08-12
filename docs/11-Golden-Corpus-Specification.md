# NAIGX — Golden Corpus Specification

**Authoritative design of the golden test corpus for Version 1.0.**

| Field | Value |
|---|---|
| Product | NAIGX — Automation Intelligence Platform |
| Core engine | NAIGX Intelligence Engine (NIE) |
| Document type | Golden Corpus Specification (canonical) |
| Sources of truth | PRD v1.0 · MVP Scope v1.0 · AI Architecture v1.0 · Engineering Roadmap v1.0 |
| Function | Defines the structure, coverage, storage, and change control of the golden corpus |
| Status | **Design only — no cases authored** |
| Version | 1.0 |
| Last updated | 2026-08-12 |

---

## How this document is used

The golden corpus is a **hard dependency of all reasoning work** (`Roadmap §5.2`): *"Golden corpus before reasoning work — without a baseline, no reasoning change is evaluable."*

This document specifies what the corpus must contain and how it is maintained. **It deliberately contains no cases.** Authoring them is a separate, larger effort requiring its own approval.

> **The corpus is the baseline against which every future reasoning change is measured.** `MVP §7` names careless assembly as a Sprint 0 risk: *"A weak corpus makes every subsequent regression test meaningless."*

---

## 1. Purpose

| Consumer | Use |
|---|---|
| Regression suite (`AI §12.3`) | Fixed inputs with fixed expectations, run on every reasoning-affecting change |
| Classification accuracy (`M-6`, `M-10`) | The ≥95% target is measured against this corpus |
| Quality rubric (`docs/10`) | Supplies comparison cases for criterion `C-7 Consistent` |
| Reasoning development (`Roadmap` Sprint 1) | Exercises stages 1–3 meaningfully before any UI exists |
| Provider substitution (`AI-005`) | Same inputs across providers verify no hidden provider dependence |

---

## 2. Coverage requirements

Reproduced from `AI §12.2`. These are requirements, not targets.

| Property | Requirement |
|---|---|
| Coverage | **≥10 per input type**, including near-boundary and deliberately ambiguous cases |
| Negative cases | At least one requiring a **"do not automate"** conclusion (`AC-013`) |
| Insufficient cases | At least one where the correct behavior is **refusal** (`AI §5.4`) |
| Contradiction cases | At least one with **irreconcilable stated requirements** |
| Expectations | Expected classification, expected artifact set, expected confidence band |
| Stability | **Frozen.** Changing a golden case is a deliberate, recorded decision — a suite that drifts to match output measures nothing |

### 2.1 Minimum corpus size

Four input types (`FR-011`) × ≥10 cases = **≥40 cases minimum**, plus the mandatory special cases of §3 where they are not already counted within a type's ten.

| Input type | Minimum |
|---|---|
| `business_requirement` | 10 |
| `existing_workflow` | 10 |
| `job_description` | 10 |
| `technical_assessment` | 10 |
| **Subtotal** | **40** |
| Mandatory special cases (§3), where not already covered | +3 minimum |

### 2.2 Within-type distribution

`AI §12.2` requires near-boundary and deliberately ambiguous cases. Each input type's ten cases should span:

| Character | Purpose |
|---|---|
| Clear central cases | Unambiguous examples of the type. The baseline |
| Near-boundary cases | Plausibly classifiable as a neighbouring type. Where the ≥95% target is genuinely tested |
| Deliberately ambiguous cases | Genuinely mixed signals; expected classification recorded with the reasoning for choosing it |
| Minimal cases | See §2.3 for the operational definition. Exercises proportionality (`FR-017`, `AC-037`) |
| Substantial cases | Long, detailed input. Exercises depth without over-production |

**The exact split is not prescribed**, because forcing a distribution across four types of differing natural variety would produce artificial cases.

**Applicability rule.** Every character above must appear within each analysable classification **to the extent that the character is semantically applicable to that classification.** Where an unconditional product requirement makes a character impossible for a path, the character is exempt for that path and the exemption is recorded with its cause.

| Classification | central | near-boundary | ambiguous | minimal | substantial |
|---|:---:|:---:|:---:|:---:|:---:|
| `business_requirement` | required | required | required | required | required |
| `existing_workflow` | required | required | required | required | required |
| `job_description` | required | required | required | required | required |
| `technical_assessment` | required | required | required | **N/A — exempt by `FR-023`** (§2.4) | required |

> The exemption is a consequence of a product requirement, not a relaxation of corpus standards. `AI §12.2` — the authoritative coverage requirement — mandates only "near-boundary and deliberately ambiguous cases"; `minimal` and `substantial` are elaborations introduced by this document, so exempting one for cause contradicts nothing upstream.

`unsupported` is not subject to this matrix at all: it produces no analysis, so depth and proportionality do not vary (§5, A-13).

### 2.3 What makes a case `minimal`

Resolves ambiguity A-12. **Owner-approved 2026-08-12.**

> **A `minimal` case is one where the input can be satisfied by a single primary artifact, without requiring downstream solution architecture or implementation design.**

Two conditions, both required:

| Condition | Test |
|---|---|
| **Single primary artifact** | The path's expected artifact set reduces to one artifact that answers the input |
| **No downstream design** | The input does not require `architecture_recommendation`, `mermaid_diagram`, `implementation_roadmap`, or any artifact that constitutes a solution design |

**Character count does not determine `minimal`.** Input length is recorded in `character_count` as metadata and may correlate with minimality, but it is not the test. A one-line input that explicitly requests a design is not minimal; a longer input answerable by a single artifact is.

**Why length was rejected as the criterion.** `FR-017` and `AC-037` concern proportionality of *output* to what the input supports. A character threshold measures the input's size rather than what it demands, so it would classify by the wrong quantity — and would drift as soon as a terse input asked for something substantial.

### 2.4 ✅ Resolved: `technical_assessment` is exempt from `minimal`

**A-14 resolved 2026-08-12 by owner decision, Option 1.** `FR-023` is unchanged, unweakened, and not reinterpreted.

> **Corpus rule.** The five-characteristic coverage requirement applies to each analysable classification **to the extent that each characteristic is semantically applicable to that classification.** `technical_assessment` is explicitly exempt from the `minimal` characteristic, because `FR-023` requires design-bearing outputs for every technical assessment. **This is a corpus coverage exception caused by an unconditional product requirement, not a change to `FR-023`.**

**Why an exemption rather than an amendment.** `FR-023` is a P0-quality product requirement in the PRD, which this document lists among its sources of truth. The `minimal` characteristic is an elaboration introduced here in §2.2 and is absent from `AI §12.2`, the authoritative coverage requirement. When a corpus convention and a product requirement cannot both hold, the convention yields — and the yielding is recorded rather than hidden.

**Effect on the corpus:** `technical_assessment` has no `minimal` case and requires none. No further minimal case is to be authored for that path.

---

#### The finding that produced this resolution

Retained as the evidential record. **No requirement was amended to accommodate it.**

`FR-023` states, without qualification:

> *"Inputs classified as `technical_assessment` **must produce a solution architecture with explicit trade-off reasoning and a diagram**."*

Both named outputs are design-bearing, so §2.3's second condition — no downstream solution architecture or implementation design — cannot be met by any `technical_assessment` case. §2.2 nonetheless requires a `minimal` case within every analysable type. The two requirements cannot both hold.

**Why the permissive reading was rejected.** It was considered that `AI §9.1`'s catalogue might describe typical content rather than a hard requirement, letting a bounded evaluation produce `assessment_feedback` alone. The adjacent path requirements settle it against that reading:

| | `FR-020` (business_requirement) | `FR-023` (technical_assessment) |
|---|---|---|
| Description qualifier | "**subject to orchestration**" | *none* |
| Acceptance conditional | "for any **non-trivial** requirement" | *none — all three criteria unconditional* |
| Negative-conclusion carve-out | present (do-not-automate) | *none* |
| Declares `Depends on: FR-017` | yes | yes |

Both depend on `FR-017`, so the dependency alone is not what makes `FR-020` conditional — `FR-020` needed explicit qualifying language on top of it, and got it. The drafters demonstrably knew how to write an orchestration-conditional path requirement three requirements earlier and did not do so in `FR-023`. `MVP §5.1`'s allowance that `FR-023` "may ship at reduced depth if capacity forces" concerns implementation capacity, not per-input artifact omission.

The PRD is listed among this document's sources of truth, so `FR-023` outranks a corpus convention.

**Consequences for the corpus, recorded and not acted upon:**

| Case | Status |
|---|---|
| `ta-009` | Expects `assessment_feedback` alone. **Violates `FR-023`.** Left unmodified pending decision |
| `ta-005` | Expects `architecture_recommendation` + `mermaid_diagram`. **Conforms to `FR-023`**; fails only §2.3. Its `minimal` label, not its expectations, is what is in question |

**Options considered:**

1. ✅ **Adopted.** Exempt `technical_assessment` from §2.2's `minimal` requirement — justified by `FR-023` rather than by corpus convenience.
2. Rejected — amending §2.3's second condition would weaken a definition approved two decisions earlier, to accommodate one path.
3. Rejected — amending `FR-023` to add "subject to orchestration" is a PRD change with reach far beyond the corpus.
4. Rejected in favour of 1 — recording an unexplained gap is weaker than recording an exemption with its cause.

**Resolution of the two affected cases:**

| Case | Outcome |
|---|---|
| `ta-009` | Reclassified `minimal` → `central`, and its expected artifact set corrected to the `FR-023` set. The correction is recorded under §6.2: the original expectation was **wrong against `FR-023`**, not merely different from output. Input content unchanged |
| `ta-005` | Preserved unchanged. Its expectations conform to `FR-023`; only its `minimal` label was ever in question, and under this resolution that label no longer claims coverage |

#### Superseded definition

The original wording — *"At or near the 50-character floor (`FR-002`)"* — is recorded here rather than deleted. It defined `minimal` by length, which this decision replaces. Cases authored under it must be re-verified against §2.3; see the corpus README for the outcome of that review.

---

## 3. Mandatory special cases

At least one of each must exist somewhere in the corpus.

| Class | Expected behavior | Source |
|---|---|---|
| **Do not automate** | The analysis concludes automation is not advisable, with reasoning | `AC-013`, `MVP §5.1` |
| **Insufficient context** | The system **refuses** rather than proceeding, naming the specific unknowns | `AI §5.4`, `AI §11.7`, `FR-044`, `API §9.3` |
| **Contradiction** | Irreconcilable stated requirements surfaced rather than silently resolved | `AI §12.2` |
| **Unsupported** | Classified `unsupported`; does not proceed to reasoning | `FR-011`, `FR-092` |

The `unsupported` case is added here because `FR-011` names it as one of five classification values and `FR-092` defines its behaviour; a corpus that never exercises it leaves a classification path untested.

**These four cases test refusal behaviour, which is the hardest thing to keep working.** `AI §11.7` treats graceful refusal as a quality behaviour, and `PV §5` identifies the insufficient-input moment as a defining product moment. A regression here is a product regression, not an edge case.

### 3.1 Artifact proportionality for a do-not-automate conclusion

Resolves ambiguity A-6 / gap G-2. Derived entirely from existing requirements; **no artifact type is invented and none is made mandatory without an authoritative basis.**

The governing distinction is **whether an artifact presupposes a design**. `FR-020` requires that where automation is unwarranted the system "states this rather than producing a design", so any artifact that cannot exist without a design must not be produced.

**Produced — explains the requirement, presupposes no design**

| Artifact | Authoritative basis |
|---|---|
| `business_analysis` | `AI §9.1` defines it as "Problem as understood, objectives, constraints" and marks it "Precedes all solution artifacts". `FR-020` requires "The problem as understood is stated before any solution artifact" (`PV §3.4`). It is what carries the negative conclusion and its reasoning |

**Not produced — each presupposes the design that was deliberately withheld**

| Artifact | Why it cannot exist |
|---|---|
| `architecture_recommendation` | It **is** the design. `FR-020` states the system must not produce one |
| `mermaid_diagram` | `AI §9.1` defines it as a "Renderable architecture diagram" whose schema-critical property is "Nodes match architecture components". With no components there is nothing to render |
| `risk_assessment` | `AI §9.1` requires "Every risk names a component and a mitigation"; `RISK_ITEM.component_id` is non-nullable (`DB §4.3`). A risk against a design that does not exist is structurally unstorable |
| `complexity_score` | `docs/09` §1 scores a proposed solution. With no solution there is nothing to score |
| `platform_comparison` | `AI §9.1` defines it as a "Recommendation with criteria and rejected alternatives". Recommending a platform on which to build contradicts the conclusion not to build |

**Scope of this rule.** It governs `special_class: do-not-automate` only. It does not license omission elsewhere, and it does not imply that every catalogue artifact is otherwise mandatory — `FR-020` conditions architecture, risk, complexity and platform on the requirement being "non-trivial", a term the requirements do not define (ambiguity A-12).

**Why the rule is structural rather than editorial.** Four of the five exclusions follow from a definition or a non-nullable constraint, not from a judgement about proportionality. That is what makes the rule defensible without new requirements: the artifacts are not withheld because they would be excessive, but because they cannot be constructed.

---

## 4. Per-case record structure

Every case is a single file containing input and expectations.

### 4.1 Required fields

| Field | Content | Source |
|---|---|---|
| `case_id` | Stable unique identifier (§5) | — |
| `input_type` | The expected classification | `FR-011` |
| `content` | The raw input text, 50–50,000 characters | `FR-002` |
| `character_count` | Recorded for boundary cases | `FR-002` |
| `expected_classification` | One of the five `FR-011` values | `AI §12.2` |
| `expected_artifact_set` | Artifact types expected to be produced | `AI §12.2` |
| `expected_omissions` | Artifact types expected **not** to be produced, with reason | `FR-017`, `ARTIFACT_PLAN_ENTRY` |
| `expected_confidence_band` | `high` · `medium` · `low` | `AI §12.2`, `AI §8` |
| `expected_classification_confidence` | Threshold-bounded expectation for the `FR-011` numeric confidence | §4.4 |
| `expected_complexity` | Complexity expectation, or an explicit statement that none is determinable | §4.5 |
| `expected_risk` | Risk expectation, or an explicit statement that none is determinable | §4.5 |
| `case_character` | Central · near-boundary · ambiguous · minimal · substantial | §2.2 |
| `special_class` | Where applicable: do-not-automate · insufficient · contradiction · unsupported | §3 |
| `rationale` | Why these expectations are correct | §4.2 |
| `provenance` | Origin of the input (§4.6) | — |
| `added` / `frozen_at` | ISO 8601 dates | §6 |
| `corpus_version` | Version at which the case entered | §6 |

**`expected_omissions` is not in `AI §12.2`** but follows from `FR-017` and `AC-037`: over-production is a defect, so a corpus that records only what should be produced cannot detect it.

### 4.2 The rationale field

Each case records *why* its expectations are correct. Without it, a future maintainer facing a failing case cannot tell whether the system regressed or the expectation was always wrong — which is precisely when a corpus starts drifting to match output.

### 4.3 Artifact type identifiers

Resolves gap G-1. **v1 convention:** an artifact type identifier is the `lower_snake_case` form of the artifact's display name in the `AI §9.1` catalogue.

| Rule | Detail |
|---|---|
| Casing | `lower_snake_case` (`API §10.3` — "Enumerations: `lower_snake_case`") |
| Word separator | Single underscore |
| `&` | Normalised to `and`. The only symbol appearing in the catalogue — "Edge Cases & Practices" → `edge_cases_and_practices` |
| Source of truth | `AI §9.1` remains the owner of artifact names. A catalogue rename is an identifier change |

The catalogue as identifiers:

| `AI §9.1` name | Identifier |
|---|---|
| Executive Summary | `executive_summary` |
| Business Analysis | `business_analysis` |
| Architecture Recommendation | `architecture_recommendation` |
| Workflow Recommendation | `workflow_recommendation` |
| Platform Comparison | `platform_comparison` |
| Mermaid Diagram | `mermaid_diagram` |
| Risk Assessment | `risk_assessment` |
| Complexity Score | `complexity_score` |
| Implementation Roadmap | `implementation_roadmap` |
| Edge Cases & Practices | `edge_cases_and_practices` |
| Integration Requirements | `integration_requirements` |
| Skill Gap Analysis | `skill_gap_analysis` |
| Portfolio Suggestions | `portfolio_suggestions` |
| Interview Guidance | `interview_guidance` |
| Assessment Feedback | `assessment_feedback` |

> **This is a corpus convention, not an API contract.** If the application later publishes its own artifact type identifiers, the two must be reconciled — under §6.2, since a mismatch would silently invalidate every `expected_artifact_set`.

### 4.4 Expected classification confidence

Resolves gap G-3.

`FR-011` requires a classification confidence in `[0,1]`, and `FR-015` is triggered below `0.6`. That is a **different quantity** from `expected_confidence_band`, and the two must not be conflated:

| Field | Measures | Vocabulary | Source |
|---|---|---|---|
| `expected_classification_confidence` | How certain the system is about **which input type this is** | Numeric `[0,1]`, threshold `0.6` | `FR-011`, `FR-015` |
| `expected_confidence_band` | How certain the system is about **its recommendations** | `high` · `medium` · `low` | `AI §8` |

An input can be confidently classified and analysed with low confidence, or the reverse.

**Expectations are threshold-bounded, not point values.** A corpus asserting an exact figure such as `0.42` would encode precision the specification does not define and no calibration data supports. What `FR-015` makes behaviourally meaningful is which side of `0.6` the value falls on.

| Field | Values |
|---|---|
| `bound` | `below_threshold` — expected in `[0, 0.6)`; `FR-015` confirmation expected to trigger<br>`at_or_above_threshold` — expected in `[0.6, 1.0]`; no confirmation expected |
| `threshold` | `0.6`. Recorded per case so a future threshold change is visible rather than silently retroactive |
| `rationale` | Why this bound is correct for this input |

`FR-015` triggering is implied by `below_threshold` and is not recorded separately, so the two cannot drift apart.

### 4.5 Expected complexity and risk

Resolves gap G-4. Both use the scales in `docs/09-Scoring-Scales.md`. **No second scoring system is introduced.**

Each field carries a `status`:

| Status | Meaning |
|---|---|
| `specified` | The specification and input jointly determine a defensible expected value, recorded in full |
| `not_applicable` | The artifact is not produced for this case — wrong path, or deliberately omitted. There is nothing to score |
| `not_determinable` | The artifact **is** expected, but no authoritative basis exists for predicting its values |

**`not_determinable` is a finding, not a placeholder.** Factor scoring and risk identification are reasoning outputs. `docs/09` A-3 records that no calibration data exists, so asserting factor values now would be guessing dressed as an expectation — precisely the drift `AI §12.2` freezes the corpus against.

When `status: specified`:

| Field | Content |
|---|---|
| `expected_complexity.factors` | The five `docs/09` §1.1 factors, each scored 1–5 |
| `expected_complexity.weighted_score` | 1.00–5.00 |
| `expected_complexity.complexity_score` | 20–100 (`docs/09` §1.3) |
| `expected_complexity.scale_version` | `complexity-v1` |
| `expected_risk.items` | Each with `severity` 1–5, `likelihood` 1–5, `expected_band` |
| `expected_risk.scale_version` | `risk-v1` |

#### Deterministic assertions available regardless of status

These follow from the scales themselves and hold for every case whose artifact is produced. They are corpus-wide invariants, asserted by the regression suite rather than restated per case:

| Invariant | Source |
|---|---|
| `complexity_score` = weighted score × 20, reconstructible from the displayed breakdown | `FR-033`, `docs/09` §1.3, §1.7 |
| `complexity_score` within 20–100 | `docs/09` §1.3 |
| Factor scores are integers 1–5; weights match §1.1 and total 100% | `docs/09` §1.1, §1.2 |
| Risk score = severity × likelihood; band per §2.4 | `docs/09` §2.3, §2.4 |
| Severity and likelihood are integers 1–5 | `docs/09` §2.1, §2.2 |
| Every risk names a component and carries a mitigation | `FR-032`, `DB §4.3` |

This is what makes the deterministic half of the scoring model testable while the judgement half remains unasserted.

### 4.6 Case provenance and confidentiality

| Rule | Rationale |
|---|---|
| No real customer or third-party confidential content | The corpus is committed to the repository |
| Synthetic or derived-and-anonymised input | Realism without confidentiality exposure |
| Provenance recorded per case | Distinguishes synthetic from derived material |
| Public-source input records its source | Attribution and licence traceability |

**NAIGX has no customers** (`MVP §4.5`), so this rule is preventative rather than corrective. Recording it now avoids a bad decision under corpus-authoring pressure.

---

## 5. Case identity and naming

| Element | Convention |
|---|---|
| `case_id` | `<type-abbrev>-<NNN>` — e.g. `br-001`, `ew-001`, `jd-001`, `ta-001`, `un-001` |
| Numbering | Sequential within type, zero-padded to three digits, **never reused** |
| Special cases | Numbered within their input type; `special_class` marks them, not the identifier |
| Filename | `<case_id>.<ext>` |

**All five `FR-011` classification values have a prefix and a directory.** Resolves ambiguity A-11.

| `FR-011` classification | Prefix | Directory |
|---|---|---|
| `business_requirement` | `br` | `business-requirement/` |
| `existing_workflow` | `ew` | `existing-workflow/` |
| `job_description` | `jd` | `job-description/` |
| `technical_assessment` | `ta` | `technical-assessment/` |
| `unsupported` | `un` | `unsupported/` |

Directory names are the classification value with underscores replaced by hyphens, which makes the mapping mechanical and checkable.

> `unsupported` is both an `FR-011` classification and a `docs/11` §3 mandatory special class. As a classification it needs a home; as a special class it needs at least one case. It is **not** subject to the §2.1 per-type target of ≥10 — that target covers the four analysable paths, since `unsupported` produces no analysis to vary. See ambiguity A-13.
>
> **The `FR-011` classification names themselves are unchanged.** This section defines corpus storage conventions only.

Identifiers are never reused, so a regression report naming `br-007` refers to one case for the life of the project.

---

## 6. Freeze and change control

`AI §12.2` requires the corpus be **frozen**: *"Changing a golden case is a deliberate, recorded decision — a suite that drifts to match output measures nothing."*

### 6.1 Permitted operations

| Operation | Permitted | Requirement |
|---|---|---|
| **Add** a case | Yes | Increments corpus version. Additive; breaks nothing |
| **Change an expectation** | Only with recorded justification | The critical control — see §6.2 |
| **Change case content** | **No** | Changing input creates a different case. Add a new one and retire the old |
| **Retire** a case | Yes, with reason | Marked retired, not deleted. Identifier never reused |
| **Delete** a case | **No** | Deletion destroys the record of what was once expected |

### 6.2 Changing an expectation

The operation the freeze exists to control. A failing case has exactly two explanations, and they demand opposite responses:

| Explanation | Correct response |
|---|---|
| The system regressed | Fix the system. **Do not touch the case** |
| The expectation was wrong | Change the expectation, with recorded justification |

Assuming the second is how a suite drifts into measuring nothing.

Required to change an expectation: the case identifier and field, old and new values, **why the original was wrong** (not merely that output differs), the corpus version increment, and the date. A change justified only by "the system now produces X" is rejected.

### 6.3 Corpus versioning

| Rule | Detail |
|---|---|
| Corpus carries a version | Referenced by regression runs and review records |
| Additions and expectation changes increment it | Both alter what the suite measures |
| Regression results record the corpus version | Results from different versions are not directly comparable |

---

## 7. Storage

Per `D6`.

| Property | Decision |
|---|---|
| Location | **`research/golden-corpus/`** |
| Granularity | **One case per file** |
| Organisation | Subdirectory per classification value: `business-requirement/`, `existing-workflow/`, `job-description/`, `technical-assessment/`, `unsupported/` (§5) |
| Runtime dependency | **None.** No backend or frontend code may import, read, or depend on the corpus at this stage |
| Version control | Committed. The corpus is a specification artifact, not test fixture data |

### 7.1 Why `research/`, not `backend/`

| Reason | Detail |
|---|---|
| Not runtime data | No application code path reads it |
| It is evidence | `research/` holds the project's evidence base; the corpus is the reasoning-quality equivalent |
| Keeps the boundary honest | A corpus inside `backend/` invites an import, at which point test data becomes a runtime dependency |
| Consumed by tooling, not the product | The regression suite reads it; NAIGX does not |

**This placement is expected to be revisited** when the regression suite is built in Sprint 2 (ambiguity A-2).

### 7.2 File format

✅ **Decided 2026-08-12: YAML.** The requirement is a format holding structured expectations alongside a long free-text `content` field, readable by both a human reviewer and the regression suite.

| Candidate | Assessment |
|---|---|
| **YAML** ✅ | Structured expectations as native mappings and sequences; `content` as a literal block scalar preserving formatting verbatim; readable unrendered; parsed by standard tooling |
| JSON | Fails the human-readability half — a long `content` field becomes one line of `\n`-escaped text, unreviewable |
| Markdown + front-matter | Handles `content` well, but forces nested expectations back into front-matter YAML anyway |

Chosen because it satisfies both halves of the stated requirement, not from general preference. Conventions: UTF-8, LF, two-space indent, `content` always a literal block scalar (`|`), no tabs. `character_count` excludes the trailing newline the block scalar appends, since that newline is an artifact of the format rather than part of the text `FR-002` bounds.

---

## 8. Authoring sequence

Proposed order for later approval. **No cases are authored under this document.**

| Step | Work | Rationale |
|---|---|---|
| 1 | Fix the file format (A-1) and commit one complete exemplar case | A worked example surfaces structural problems before 40 cases inherit them |
| 2 | `business_requirement` — 10 cases | Highest-value path (`MVP §5.1`); the first Sprint 1 path |
| 3 | The four mandatory special cases (§3) | Refusal behaviour is the hardest to keep working |
| 4 | `existing_workflow` — 10 cases | Second Sprint 1 path |
| 5 | `job_description` — 10 cases | — |
| 6 | `technical_assessment` — 10 cases | P1 path (`FR-023`); may ship at reduced depth |
| 7 | Freeze; record corpus version `corpus-v1` | Baseline established |

Steps 1–3 are the minimum for Sprint 1 to proceed on the business requirement path. Steps 4–6 are required before `M-10` classification accuracy can be measured across all four types.

---

## 9. Relationship to the regression suite

The corpus supplies inputs and expectations; `AI §12.3` defines execution. Under the `D5` policy (recorded on every change, live on a schedule), the corpus is read in both modes — the difference is whether provider responses are replayed or requested.

**Deterministic assertions** (`AI §12.3`) map directly to corpus fields:

| Assertion | Corpus field |
|---|---|
| Classification | `expected_classification` |
| Artifact set | `expected_artifact_set`, `expected_omissions` |
| Confidence band | `expected_confidence_band` |
| Schema validity | Not corpus-derived — structural |
| Reference integrity | Not corpus-derived — structural |

Non-deterministic content is compared to baseline and flagged for human review rather than auto-failed (`AI §12.3`). **The corpus does not encode expected prose**, only structural expectations.

---

## 10. Remaining ambiguity

| # | Ambiguity | Status |
|---|---|---|
| A-1 | ~~**File format undecided.**~~ | ✅ **Resolved 2026-08-12** — YAML, §7.2 |
| A-6 | ~~**Do-not-automate artifact set is a v1 interpretation.**~~ | ✅ **Resolved 2026-08-12** — §3.1 defines the rule from existing requirements. Four of five exclusions are structural (a definition or a non-nullable constraint), not editorial |
| A-8 | ~~**Proportionality reduction for do-not-automate undefined.**~~ | ✅ **Resolved 2026-08-12** — §3.1. The residual "non-trivial" question is re-filed as A-12 |
| A-9 | **No document states whether an analysis that produced no artifacts carries a confidence band.** Applies to both `special_class: insufficient` (refusal, `AI §5.4`) and `special_class: unsupported` (`FR-092`). §4.1 makes `expected_confidence_band` required with no not-applicable option | ⏸️ **Left open by owner decision, 2026-08-12.** No N/A value is to be invented and the `AI §8.4` vocabulary is not to be altered. Corpus convention: record `low`, on the basis that no confident recommendation exists. Recorded as a convention, not a requirement |
| A-10 | **A workflow-path analysis cannot produce a target design.** `AI §9.1` scopes `architecture_recommendation` to the requirement and assessment paths, even where a submitter explicitly asks whether to replace the workflow | ⏸️ **Left open by owner decision, 2026-08-12.** No target-design artifact is to be produced on the workflow path without authoritative support. Whether `workflow_recommendation` should carry replacement-design content, or such inputs should be resubmitted under `classification_override` (`API §7.5`), remains unstated |
| A-11 | ~~**`unsupported` has no case-ID prefix and no directory.**~~ | ✅ **Resolved 2026-08-12** — §5. Prefix `un`, directory `unsupported/` |
| A-12 | ~~**`FR-020` conditions architecture, risk, complexity and platform on the requirement being "non-trivial", but defines neither the term nor which artifacts survive a reduction for a trivial one.** Distinct from A-8: this concerns a requirement the system *does* analyse and design for, not one it declines.~~ *(Original text preserved.)* | ✅ **Resolved 2026-08-12** — §2.3 defines `minimal` operationally: satisfiable by a single primary artifact, with no downstream solution architecture or implementation design. Length is metadata, not the test. **Two cases authored under the superseded length-based definition do not satisfy it — `br-004` and `ta-005`. Reported for review; not silently reclassified** |
| A-13 | **No per-type volume target for `unsupported`.** §2.1 sets ≥10 for the four analysable paths; §3 requires ≥1 unsupported case. Whether more are wanted is unstated | ⚠️ **Open, low impact.** Corpus currently treats §3's ≥1 as the floor |
| A-14 | ~~**§2.2's `minimal` requirement is unsatisfiable for `technical_assessment`, because `FR-023` mandates two design-bearing artifacts unconditionally.**~~ *(Original finding preserved in §2.4.)* | ✅ **Resolved 2026-08-12 — Option 1.** §2.2 coverage applies per characteristic *where semantically applicable*; `technical_assessment` is exempt from `minimal`, caused by `FR-023`. **`FR-023` unchanged.** `ta-009` reclassified to `central` with its artifact set corrected; `ta-005` preserved |
| A-7 | **Corpus artifact identifiers are a corpus convention**, not a published API contract (§4.3). If the application later publishes its own, the two must be reconciled | Recorded. Reconciliation would proceed under §6.2 |
| A-2 | **Storage location may need revisiting in Sprint 2** when the regression suite is built and needs a stable read path | Recorded. `research/golden-corpus/` stands for now |
| A-3 | **`expected_artifact_set` cannot be fully specified** until the artifact type set is fixed in Sprint 1–2 | Expected. Cases may be authored with classification and confidence expectations first, artifact sets completed once types are fixed |
| A-4 | **Baseline capture for non-deterministic content is unspecified.** `AI §12.3` compares to baseline but does not say where the baseline lives, or how it is refreshed under the `D5` recorded-results policy | Requires resolution alongside `DBQ-1` / Sprint 2 regression work |
| A-5 | **Corpus authorship review is unspecified.** `MVP §7` names careless assembly as a risk but no review requirement exists for cases themselves | Suggest the `docs/10` §4.3 independent reviewer also reviews corpus expectations. Not decided |

---

## 11. Traceability

| Requirement | Satisfied by |
|---|---|
| `AI §12.2` — golden test case properties | §2, §3, §4 |
| `MVP` Sprint 0 — corpus with expected classification, artifact set, confidence band | §4.1 |
| `Roadmap §5.2` — golden corpus before reasoning work | §8 sequence |
| `FR-024`, `NFR-043` — regression baseline | §9 |
| `FR-011` — five classification values exercised | §2.1, §3 |
| `AC-013` — "do not automate" | §3 |
| `AI §5.4`, `AI §11.7` — refusal | §3 |
| `FR-017`, `AC-037` — proportionality | §2.2, §4.1 |
| `D6` — storage under `research/golden-corpus/`, one case per file, no runtime dependency | §7 |

---

*This document specifies the corpus. It does not contain it. Per `Roadmap §5.2`, reasoning work remains blocked until the corpus exists — `M-02` is not satisfied by this document alone.*
