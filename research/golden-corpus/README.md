# NAIGX Golden Corpus

Fixed inputs with frozen expectations, used as the baseline for every reasoning change.

**Specification:** [`docs/11-Golden-Corpus-Specification.md`](../../docs/11-Golden-Corpus-Specification.md)
**Status:** 🔒 **FROZEN — `corpus-v1`, 44 cases.**
**Frozen at:** `2026-08-12T07:52:30Z` (single UTC stamp across all 44 cases)

> The corpus is frozen. Per `AI §12.2` and `docs/11` §6, **changing a golden case is now a deliberate, recorded decision.** Adding cases is permitted and increments the corpus version. Changing an expectation requires recorded justification of *why the original was wrong* — never that output differs. Changing case content and deleting cases are not permitted.

> This directory holds specification artifacts, not test fixtures. **No application or runtime code may import, read, or depend on it** (`docs/11` §7). The regression suite reads the corpus; NAIGX does not.

---

## Why this exists

`Roadmap §5.2` makes the corpus a hard dependency of all reasoning work: *"Golden corpus before reasoning work — without a baseline, no reasoning change is evaluable."*

`MVP §7` names careless assembly as a Sprint 0 risk: *"A weak corpus makes every subsequent regression test meaningless."*

---

## Directory structure

```
research/golden-corpus/
├── README.md
├── business-requirement/     br-NNN.yaml
├── existing-workflow/        ew-NNN.yaml
├── job-description/          jd-NNN.yaml
└── technical-assessment/     ta-NNN.yaml
```

One subdirectory per classification value (`docs/11` §7). One case per file (`D6`).

## File format — YAML

Selected against the requirement in `docs/11` §7.2: *"a format holding structured expectations alongside a long free-text `content` field, readable by both a human reviewer and the regression suite."*

| Candidate | Assessment |
|---|---|
| **YAML** ✅ | Structured expectations as native mappings and sequences; `content` as a literal block scalar preserving line breaks and formatting verbatim; readable unrendered; parsed by standard tooling |
| JSON | Fails the human-readability half. A 2,000-character `content` field becomes one line of `\n`-escaped text — unreviewable, and unusable for a reviewer checking whether the input reads naturally |
| Markdown + front-matter | Handles `content` well but forces nested expectations (`expected_omissions` with per-item reasons) into front-matter YAML anyway, or into prose that cannot be asserted against |

YAML is chosen because it satisfies both halves of the stated requirement, not by general preference. Resolves `docs/11` ambiguity A-1.

**Conventions:** UTF-8, LF line endings, two-space indent, `content` always a literal block scalar (`|`), no tab characters.

---

## Case identity

`<type-abbrev>-<NNN>` per `docs/11` §5, zero-padded, sequential within type, **never reused**.

All five `FR-011` classification values have a prefix and a directory (`docs/11` §5).

| Abbrev | Classification | Directory |
|---|---|---|
| `br` | `business_requirement` | `business-requirement/` |
| `ew` | `existing_workflow` | `existing-workflow/` |
| `jd` | `job_description` | `job-description/` |
| `ta` | `technical_assessment` | `technical-assessment/` |
| `un` | `unsupported` | `unsupported/` |

---

## Required fields

Exactly the set in `docs/11` §4.1. No field is added or omitted.

| Field | Notes |
|---|---|
| `case_id` | Matches the filename |
| `input_type` | Authoritative enum (below) |
| `content` | 50–50,000 characters (`FR-002`), literal block scalar |
| `character_count` | Character length of `content`, **excluding the trailing newline** that the YAML block scalar appends. That newline is an artifact of the file format, not part of the submitted text `FR-002` bounds. Computed, never estimated |
| `expected_classification` | Authoritative enum |
| `expected_artifact_set` | Artifact type identifiers (below) |
| `expected_omissions` | Each with `artifact_type` and `reason` |
| `expected_confidence_band` | `high` · `medium` · `low` — about the **recommendations** |
| `expected_classification_confidence` | `bound` (`below_threshold` \| `at_or_above_threshold`), `threshold`, `rationale` — about **which type this is**. See below |
| `expected_complexity` | `status` (`specified` \| `not_applicable` \| `not_determinable`) plus values when specified |
| `expected_risk` | Same status model |
| `case_character` | `central` · `near-boundary` · `ambiguous` · `minimal` · `substantial` |
| `special_class` | `do-not-automate` · `insufficient` · `contradiction` · `unsupported`, or `null` |
| `rationale` | Why these expectations are correct (`docs/11` §4.2) |
| `provenance` | `synthetic` · `derived` · `public-source`, with `notes` |
| `added` / `frozen_at` | ISO 8601. `frozen_at` is `null` until corpus freeze |
| `corpus_version` | Version at which the case entered |

---

## Authoritative enumerations

### Classification — `FR-011`

`business_requirement` · `existing_workflow` · `job_description` · `technical_assessment` · `unsupported`

### Confidence band — `AI §8.4`

`high` · `medium` · `low`. Bands, not scores.

**Capping rule (`AI §8.3`):** conflicting information (CF-3) or material unknowns (CF-7) cap confidence — it **cannot exceed `medium`** regardless of other factors. Contradiction cases therefore never expect `high`.

### Two different confidences — do not conflate

| Field | Answers | Vocabulary | Source |
|---|---|---|---|
| `expected_classification_confidence` | "How sure are we **which type** this is?" | Numeric `[0,1]`, threshold `0.6` | `FR-011`, `FR-015` |
| `expected_confidence_band` | "How sure are we of **the recommendations**?" | `high` · `medium` · `low` | `AI §8` |

Independent by design. `br-002` expects classification `at_or_above_threshold` with an analysis band of `medium`; `jd-001` expects `below_threshold` with `medium`.

**Expectations are threshold-bounded, not point values** (`docs/11` §4.4). Asserting `0.42` would encode precision the specification does not define. What `FR-015` makes behaviourally meaningful is which side of `0.6` the value falls on. `FR-015` triggering is implied by `below_threshold` and is not recorded separately, so the two cannot drift apart.

### Complexity and risk expectations

Uses the `docs/09-Scoring-Scales.md` model. No second scoring system exists.

| Status | Meaning |
|---|---|
| `specified` | Specification and input jointly determine a defensible value |
| `not_applicable` | The artifact is not produced — wrong path, or deliberately omitted |
| `not_determinable` | The artifact **is** expected, but no authoritative basis exists for predicting its values |

**`not_determinable` is a finding, not a placeholder.** Factor scoring and risk identification are reasoning outputs, and `docs/09` A-3 records that no calibration data exists. Deterministic assertions — score reconstruction, ranges, the S × L formula, every risk naming a component — hold corpus-wide and are listed in `docs/11` §4.5 rather than repeated per case.

### Artifact type identifiers — v1 convention

Resolves G-1. An identifier is the **`lower_snake_case` form of the artifact's display name in the `AI §9.1` catalogue** (`API §10.3`: "Enumerations: `lower_snake_case`").

| Rule | Detail |
|---|---|
| Word separator | Single underscore |
| `&` | Normalised to `and` — the only symbol in the catalogue: "Edge Cases & Practices" → `edge_cases_and_practices` |
| Ownership | `AI §9.1` owns the names. A catalogue rename is an identifier change |

> ⚠️ **This is a corpus convention, not a published API contract** (`docs/11` §4.3, A-7). If the application later publishes its own artifact identifiers, the two must be reconciled under §6.2 — a silent mismatch would invalidate every `expected_artifact_set`.

| Identifier | `AI §9.1` name | Applicable paths | v1.0 priority |
|---|---|---|---|
| `executive_summary` | Executive Summary | requirement | P1 (`MVP §5.3`, `FR-038`) |
| `business_analysis` | Business Analysis | requirement | P0 (`FR-020`) |
| `architecture_recommendation` | Architecture Recommendation | requirement, assessment | P0 (`FR-030`) |
| `workflow_recommendation` | Workflow Recommendation | workflow | P0 (`FR-021`) |
| `platform_comparison` | Platform Comparison | requirement, workflow | P0 (`FR-034`) |
| `mermaid_diagram` | Mermaid Diagram | requirement, assessment | P0 (`FR-031`) |
| `risk_assessment` | Risk Assessment | requirement, workflow | P0 (`FR-032`) |
| `complexity_score` | Complexity Score | requirement, workflow | P0 (`FR-033`) |
| `implementation_roadmap` | Implementation Roadmap | requirement | P1 (`MVP §5.3`, `FR-036`) |
| `edge_cases_and_practices` | Edge Cases & Practices | requirement, workflow | P1 (`MVP §5.3`, `FR-037`) |
| `integration_requirements` | Integration Requirements | requirement | P1 (`MVP §5.3`, `FR-035`) |
| `skill_gap_analysis` | Skill Gap Analysis | job description | P0 (`FR-022`) |
| `portfolio_suggestions` | Portfolio Suggestions | job description | P0 (`FR-022`) |
| `interview_guidance` | Interview Guidance | job description | P0 (`FR-022`) |
| `assessment_feedback` | Assessment Feedback | assessment | P1 path (`FR-023`) |

**P1 artifacts are expected as omissions in v1.0 cases**, with the `MVP §5.3` exclusion as the reason. If a P1 artifact later ships, affected expectations change under the `docs/11` §6.2 procedure.

---

## The two negative-conclusion classes are different

`docs/11` §3 distinguishes them, and conflating them would destroy the distinction the corpus exists to test.

| Class | Behaviour | Analysis runs? | Source |
|---|---|---|---|
| `insufficient` | The system **refuses**. Any analysis would be substantially invented. Names the specific unknowns | **No** — does not proceed to reasoning | `AI §5.4`, `AI §11.7`, `FR-044`, `API §9.3` (422 `insufficient_context`) |
| `do-not-automate` | The system **analyses fully** and concludes automation is unwarranted, stating this rather than producing a design | **Yes** | `AC-013`, `FR-020` acceptance, `PV §3.2` |

The first produces no artifacts. The second produces a reduced set with a reasoned negative conclusion.

---

## Change control

Per `docs/11` §6. Summarised — the specification governs.

| Operation | Permitted |
|---|---|
| Add a case | ✅ Increments corpus version |
| Change an expectation | ⚠️ Only with recorded justification of **why the original was wrong** — never because output differs |
| Change case content | ❌ Creates a different case. Add new, retire old |
| Retire a case | ✅ Marked retired, never deleted. ID never reused |
| Delete a case | ❌ |

---

## Coverage — 44 cases · all requirements met

### By classification (`docs/11` §2.1, §5)

| Type | Target | Now | Status | Cases |
|---|---|---|---|---|
| `business_requirement` | ≥10 | 11 | ✅ | `br-001`…`br-011` |
| `existing_workflow` | ≥10 | 10 | ✅ | `ew-001`…`ew-010` |
| `job_description` | ≥10 | 10 | ✅ | `jd-001`…`jd-010` |
| `technical_assessment` | ≥10 | 11 | ✅ | `ta-001`…`ta-011` |
| `unsupported` | ≥1 (§3) | 2 | ✅ | `un-001` `un-002` |
| **Total** | **≥42** | **44** | ✅ | |

### Mandatory special classes (`docs/11` §3)

| Class | Required | Now | Case |
|---|---|---|---|
| `contradiction` | ≥1 | ✅ 1 | `br-002` |
| `do-not-automate` | ≥1 | ✅ 1 | `br-003` |
| `insufficient` (refusal) | ≥1 | ✅ 1 | `br-005` |
| `unsupported` | ≥1 | ✅ 2 | `un-001` `un-002` |

**All four mandatory special classes are now covered.**

### Case characters by classification (`docs/11` §2.2)

§2.2 requires every character to appear **within each type**. ✅ = present.

Coverage applies **where each characteristic is semantically applicable** to the classification (`docs/11` §2.2).

| Type | central | near-boundary | ambiguous | minimal | substantial | Complete? |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `business_requirement` | ✅ ×6 | ✅ `br-007` | ✅ `br-008` | ✅ `br-010` | ✅ `br-006` | ✅ |
| `existing_workflow` | ✅ ×6 | ✅ `ew-001` `ew-008` | ✅ `ew-003` | ✅ `ew-004` | ✅ `ew-005` | ✅ |
| `job_description` | ✅ ×7 | ✅ `jd-003` | ✅ `jd-001` | ✅ `jd-004` | ✅ `jd-005` | ✅ |
| `technical_assessment` | ✅ ×7 | ✅ `ta-003` `ta-008` | ✅ `ta-004` | **N/A — exempt by `FR-023`** | ✅ `ta-002` | ✅ |
| `unsupported` | ✅ `un-001` | ✅ `un-002` | — | — | — | n/a |

**Every applicable characteristic is covered.** `technical_assessment` is exempt from `minimal` because `FR-023` requires a solution architecture *and* a diagram for every technical assessment — design-bearing outputs that §2.3 forbids. The exemption is caused by a product requirement, not a relaxation: `FR-023` is unchanged (`docs/11` §2.4, A-14). No further minimal case is to be authored for that path.

### §2.3 minimal-case compliance

| Case | Artifact set | Conforms | Status |
|---|---|:---:|---|
| `br-010` | `business_analysis` | ✅ | Conforming |
| `ew-004` | `workflow_recommendation` | ✅ | Conforming |
| `jd-004` | `skill_gap_analysis` | ✅ | Conforming |
| `br-004` | `business_analysis` + `architecture_recommendation` | ❌ | **Known conflict, preserved unmodified** |
| `ta-005` | `architecture_recommendation` + `mermaid_diagram` | ❌ | **Known conflict, preserved unmodified.** Note its *expectations* conform to `FR-023`; only the `minimal` label was ever in question |

`br-004` and `ta-005` are retained unchanged as documented edge cases under the §6 change-control rules. They record what the superseded length-based definition produced, and are evidence that §2.3 changed something real. **Neither counts toward coverage.** Their rationales still reference the superseded definition and pre-freeze status — that is deliberate historical record, not staleness to be corrected.

`ta-009` was previously listed here. It was reclassified `minimal` → `central` and its artifact set corrected to the `FR-023` set on 2026-08-12 under §6.2; its input content is unchanged.

`unsupported` is not subject to the §2.2 character matrix: it produces no analysis, so depth and proportionality do not vary. Two cases give the boundary from both sides (`docs/11` A-13).

### The near-boundary / ambiguous distinction

Established across five cases and now enforced by validation:

| | Meaning | Classification confidence | Cases |
|---|---|---|---|
| **near-boundary** | Competing **surface** signals; substance is decisive | `at_or_above_threshold` | `ew-001` `ta-003` `jd-003` |
| **ambiguous** | Genuinely competing **substance**; both readings complete | `below_threshold`, triggering `FR-015` | `jd-001` `ew-003` |

The three near-boundary cases deliberately test different axes: prose framing vs. running-system substance (`ew-001`), informal framing vs. evaluation substance (`ta-003`), and an embedded assessment problem vs. posting substance (`jd-003`).

---

## Known gaps

Carried from `docs/11` §10 plus gaps found during pilot authoring. Each is flagged rather than decided.

| # | Gap | Status |
|---|---|---|
| G-1 | Artifact type identifiers not stated authoritatively | ✅ **Resolved 2026-08-12.** v1 convention documented above and in `docs/11` §4.3. Carried forward as A-7: this is a corpus convention, not an API contract |
| G-2 | No document specifies which artifacts survive a `do-not-automate` conclusion | ✅ **Resolved 2026-08-12** — `docs/11` §3.1. An artifact is produced only if it does not presuppose a design. Four of the five exclusions are structural (a definition or a non-nullable constraint), not editorial. `br-003` unchanged |
| G-3 | No field for expected classification confidence | ✅ **Resolved 2026-08-12.** `expected_classification_confidence` added (`docs/11` §4.4). `jd-001` now asserts `below_threshold` explicitly |
| G-4 | Complexity and risk expectations absent from the schema | ✅ **Resolved 2026-08-12.** `expected_complexity` and `expected_risk` added with a three-state status model (`docs/11` §4.5). **All five pilot cases are `not_applicable` or `not_determinable`** — see below |
| G-5 | `expected_artifact_set` may shift when artifact types are fixed in Sprint 1–2 | ⏸️ **Left open deliberately.** A corpus-versioning concern; revision proceeds under `docs/11` §6.2. The artifact catalogue is not being redesigned now |
| G-6 | Baseline capture for non-deterministic content unspecified (`docs/11` A-4) | ⏸️ **Left open deliberately.** No live-provider baseline policy is being invented. Belongs with Sprint 2 regression work |

### 📌 Preserved conflict cases — `br-004` and `ta-005`

Retained deliberately under §6 change control. **Neither counts toward coverage**; both are frozen as-is. The record below is the original finding that produced §2.3 and, later, the A-14 exemption.

`docs/11` §2.3 (owner-approved 2026-08-12) defines `minimal` as: *satisfiable by a single primary artifact, without requiring downstream solution architecture or implementation design.* All four cases authored under the superseded length-based definition were re-verified against it.

| Case | Artifact set | Single primary artifact? | No downstream design? | Verdict |
|---|---|:---:|:---:|---|
| `ew-004` | `workflow_recommendation` | ✅ | ✅ | ✅ **Satisfies** |
| `jd-004` | `skill_gap_analysis` | ✅ | ✅ | ✅ **Satisfies** |
| `br-004` | `business_analysis` + `architecture_recommendation` | ❌ two | ❌ `architecture_recommendation` **is** solution architecture | ❌ **Fails** |
| `ta-005` | `architecture_recommendation` + `mermaid_diagram` | ❌ two | ❌ input explicitly requests a design ("diagram plus notes") | ❌ **Fails** |

**Neither failing case has been changed.** Both retain `case_character: minimal` pending review, as instructed.

The two failures are not the same. `br-004` could satisfy the definition by reducing to `business_analysis` alone — but that would make its artifact set identical to `br-003`'s do-not-automate set, conflating "trivial but worth building" with "not worth building". `ta-005` cannot satisfy it at all: the input asks for a design in so many words, so any conforming version would have to ignore a stated instruction.

**Consequence for coverage:** if both are reclassified, `business_requirement` and `technical_assessment` lose their `minimal` character and would need replacement cases. `existing_workflow` and `job_description` are unaffected.

### Ambiguities found while authoring cases 6–15

Recorded, not decided. Each is flagged in the case that surfaced it.

| # | Ambiguity | Surfaced by | Status |
|---|---|---|---|
| A-8 | Proportionality reduction for do-not-automate undefined | `br-003` | ✅ **Resolved 2026-08-12** — `docs/11` §3.1 |
| A-9 | **No document states whether an analysis that produced no artifacts carries a confidence band.** Applies to both `insufficient` and `unsupported`; §4.1 makes the field required with no not-applicable option | `br-005`, extended by `un-001` | ⏸️ **Open by owner decision.** Corpus convention: record `low`. Not a requirement |
| A-10 | **A workflow-path analysis cannot produce a target design** (`AI §9.1`), even where a submitter explicitly asks whether to replace the workflow | `ew-003`, recurs in `ew-005` | ⏸️ **Open by owner decision.** No target-design artifact produced on the workflow path |
| A-11 | `unsupported` had no case-ID prefix and no directory | Attempting to author it | ✅ **Resolved 2026-08-12** — `docs/11` §5. Prefix `un`, directory `unsupported/` |
| A-12 | `minimal` was defined by character count, leaving the artifact reduction undefined *(original text preserved in `docs/11` A-12)* | `br-004`, `ew-004`, `jd-004`, `ta-005` | ✅ **Resolved 2026-08-12** — `docs/11` §2.3. **2 of 4 cases fail the new definition — see below** |
| A-13 | **No per-type volume target for `unsupported`.** §2.1 sets ≥10 for the four analysable paths; §3 requires ≥1 unsupported case | `un-001` | ⚠️ **Open, low impact.** Corpus treats §3's ≥1 as the floor and holds 2 |
| A-14 | §2.2's `minimal` requirement was unsatisfiable for `technical_assessment`; `FR-023` requires a solution architecture *and* a diagram unconditionally, and §2.3 forbids both | `ta-009` | ✅ **Resolved 2026-08-12 — Option 1.** Coverage applies per characteristic **where semantically applicable**; `technical_assessment` is exempt from `minimal`. **`FR-023` unchanged, unweakened, not reinterpreted.** `AI §12.2` — the authoritative coverage requirement — mandates only near-boundary and ambiguous cases, so exempting a `docs/11`-only elaboration contradicts nothing upstream |

### Why no pilot case specifies complexity or risk

All five are `not_applicable` or `not_determinable`. This is the honest result, not an omission:

| Case | Complexity | Risk | Why |
|---|---|---|---|
| `br-001` | `not_determinable` | `not_determinable` | Artifacts expected, but factor scores and risk items are reasoning outputs |
| `br-002` | `not_determinable` | `not_determinable` | Contradictions plausibly raise Error / Failure Risk, but no rule maps a stated contradiction onto a factor score or severity |
| `br-003` | `not_applicable` | `not_applicable` | Both artifacts omitted — nothing to score |
| `ew-001` | `not_determinable` | `not_determinable` | Defects are described, but no rule maps a symptom onto severity or likelihood |
| `jd-001` | `not_applicable` | `not_applicable` | Neither artifact is on the job description path |

A `specified` expectation becomes possible once calibration data exists (`docs/09` A-3) or the specifications add rules linking input characteristics to factor scores. Until then, asserting values would be guessing dressed as an expectation.
