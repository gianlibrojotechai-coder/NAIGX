# D-38 — Stage 6 can cite an unknown without disposing of it

**Standalone decision-register entry.** Kept outside `docs/12-Sprint-1-Decision-Record.md` by owner decision, 2026-09-07. `docs/12` remains the register for D-1 through D-37; this record extends the series without modifying that file.

**Status:** Decided. Remediation specified and **deferred under D-37**.

---

**Decided. The Stage 6 output contract has no representation for how an unknown context element was handled. Remediation is specified below and deferred under D-37.**

Found 2026-09-07 during the M-08 partial review. Recorded as a specification gap, not a defect: nothing in the contract is being violated.

## What is being stated

| # | Statement |
|---|---|
| 1 | Stage 3 identifies unknowns; Stage 6 sees them in full through `contextHandoffView` |
| 2 | The Stage 6 contract — `summary`, `data_flow_description`, `components{name, responsibility, inputs, outputs, failure_handling, external_system, integration_direction, grounded_in_context_indices}` — has no field for an assumption, an exclusion, or a deferral |
| 3 | `parseArchitecture` verifies only that every component cites ≥1 index and every index is in range. Both are necessary-direction checks |
| 4 | **Citation does not establish disposition.** A component may cite an unknown and then assert the thing that is unknown |
| 5 | The fragment already instructs acknowledgement (*"let the unknown stand"*); compliance is near zero because there is nowhere for it to land |
| 6 | **Remediation is deferred under D-37** — it changes the output contract, which lives in a prompt fragment |

## Evidence

Measured across the 10 architecture-bearing recordings in `corpus-v1`:

- **71 unknown elements; 20 cited by any component (28%)**
- Citation rate ranges **0% to 100%** across comparable `business_requirement` cases — the variance is itself `C-7` evidence
- One packet cites **5 of 5** unknowns and acknowledges none in prose: citation without disposition
- Exactly one recording contains an explicit exclusion, and the excluded item's own unknown is uncited — the correct behaviour is as unstructured as the failures
- One recording asserts a component that contradicts a **stated** constraint (*"protocol rules are not available via REST API"*) while citing both that element and the related unknown

## Remediation, preserved for when reasoning work resumes

1. **Contract.** Architecture-level `unknown_disposition: [{ context_index, disposition: "assumed" | "excluded" | "deferred", statement }]`
2. **Validation.** Every element with `provenance: "unknown"` must appear exactly once. Absence raises `ArchitectureTraceabilityError`, carrying the uncited indices, through the existing one-regeneration path with the informed-regeneration addendum

The contract is load-bearing and must land first: a check with no field to check can only fail runs, never let them succeed. Stated elements are deliberately excluded from the rule — 3–13 are uncited per packet and mostly benignly so.

## How this is closed

By D-37 closing. Requires a fragment change, a `schema.prisma` field and a migration. **M-08 remains not passed; this finding does not change the quality-gate status.**

## Provenance of the finding

Surfaced by an AI-assisted packet audit and **verified against the recordings before being recorded here**. That verification mattered: of the two audit findings checked, one headline example was wrong — a claimed ungrounded "apply margin" claim rested on reading element id `e7` as index 7, when the citation was 0-based and correct — and one was overstated. The underlying concern survived scrutiny; the specific examples did not always.

Per `docs/10` §4.3, none of that audit is admissible as `M-08` rubric evidence, and this record does not treat it as such.
