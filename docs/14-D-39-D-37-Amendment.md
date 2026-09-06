# D-39 — D-37 amended: reasoning work authorised while M-08 remains un-runnable

**Standalone decision-register entry.** Amends `docs/12` D-37 by reference; `docs/12` is not modified. Kept alongside [D-38](13-D-38-Architecture-Unknown-Disposition.md).

**Decided 2026-09-07, at owner decision. This is not an M-08 pass and does not redefine M-08.**

---

## Why D-37 could not be satisfied as written

D-37 closes "by running the M-08 rubric review". Investigation on 2026-09-07 established that the review **cannot presently produce a seven-of-seven pass for any analysis**, for reasons no amount of capture or reviewer time can fix:

| Criterion | Why it is unassessable |
|---|---|
| **C-6** | `FR-034` requires stated criteria plus ≥1 rejected alternative. `platform_recommendation` is unbuilt, `recommendation_alternative` holds 0 rows, `criteria_applied` is null. Structural for **every** input type. C-6 is the `M-9` instrument |
| **C-3** | Requires an artifact plan. `planReasoning` routes `business_requirement` and `technical_assessment` to architecture only; they never reach Stages 8–9. A fresh capture of those types still yields no artifact set |

Under `docs/10` §3.5 an analysis passes only when all seven criteria pass. The gate was therefore unreachable, and the work needed to make it reachable is itself reasoning work D-37 forbade. **D-37 was circular in practice**, and this record breaks the circle by decision rather than by pretending the gate was met.

## What is authorised

Reasoning work is permitted, bounded to the prerequisites identified above:

| # | Authorised |
|---|---|
| 1 | **D-38 remediation** — `unknown_disposition[]` on the Stage 6 contract, its disposition check, the fragment change, the `schema.prisma` field and its migration |
| 2 | **Determine and implement the minimum contract/output changes required to make `FR-034` assessable**: stated criteria plus at least one rejected alternative, while preserving the existing architecture and milestone boundaries. Where that belongs — Stage 7's contract, a `platform_recommendation` artifact, or elsewhere — is to be determined from the existing implementation and specifications, and is deliberately **not** assumed by this record |
| 3 | Whatever artifact planning and generation coverage is required to make **C-3** assessable on the paths under review, within the same minimum-change discipline |
| 4 | Fragment **authoring and testing** for items 1–3, and preparation of the regression capture their activation will require |

## What remains forbidden

| # | Not authorised by this record |
|---|---|
| 1 | Any other new reasoning path — `FR-021` existing-workflow and `FR-023` technical-assessment stay closed |
| 2 | Stages 4, 10, 11, 12; `AIQ-4`, `AIQ-6`, `AIQ-8` |
| 3 | Provider spend of any kind without a separate explicit decision, including the capture that fragment activation will require |
| 4 | Treating the 2026-09-07 AI-assisted packet audit as M-08 evidence. It is **inadmissible under `docs/10` §4.3** — AI review is excluded in any capacity, for any criterion — and remains a source of engineering findings only |

## What M-08 means until this deviation closes

**M-08 is not passed, and is not redefined as passed.**

`C-1`, `C-2`, `C-4`, `C-5` and `C-7` may be assessed once valid review evidence exists — a qualifying human reviewer under §4.3 and an adequate sample under §4.1. `C-3` and `C-6` are recorded **not assessable**, pending their structural prerequisites. Any review conducted in that state is reported as **partial**, names the two deferred criteria, and yields no rubric pass.

## Conditions for closing this deviation

All four conditions must hold before this deviation can close:

1. Artifact planning and generation reach the paths under review, making **C-3** assessable
2. `FR-034` criteria and rejected alternatives exist in stored output, making **C-6** assessable
3. A qualifying human reviewer is secured (§4.3; `docs/10` §8 ambiguity A-1) and the corpus meets §4.1
4. The complete seven-criterion review is run, and its result — pass or fail — is recorded as the M-08 outcome

Until all four hold, no Sprint 2 milestone may be reported as met.

## Consequence to be planned for

Fragment **activation** is a data constraint, not a process step: `DB §4.5` requires a `regression_pass_reference` resolving to a clean run covering every case the fragment composes into (D-24, D-30). So items 1–3 can be authored and tested offline, but **cannot be activated without a capture** — which is provider spend, and is explicitly not authorised here. Expect a separate budget decision before either lands in a running system.
