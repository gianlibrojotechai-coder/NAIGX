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
| 1 | ~~Any other new reasoning path — `FR-021` existing-workflow and `FR-023` technical-assessment stay closed~~ **Amended 2026-09-07 — see *On the remaining analysis paths*. Any reasoning path beyond the four `FR-011` input types remains closed.** |
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
3. A qualifying human reviewer is secured (§4.3; `docs/10` §8 ambiguity A-1), and the review covers **every recorded case of the path under review**
4. The complete seven-criterion review is run, and its result — pass or fail — is recorded as the M-08 outcome

Until all four hold, no Sprint 2 milestone may be reported as met.

### On sample size

**Amended 2026-09-07 at owner decision.** Condition 3 previously read "and the corpus meets §4.1".

`docs/10` §4.1 states ≥20 analyses per input type, sourced to `PRD §14.1`, whose own heading is **"v1.0 completion criteria"** and whose wording is *"at least 20 analyses per input type reviewed manually against M-8 and M-9"*. M-08's gate wording is narrower: *"Sampled output passes the rubric."* The two are not the same test.

**This record reads condition 3 as M-08's requirement, not v1.0's.** M-08 may be run on every recorded case of a path — for `job_description`, the 10 cases `docs/11` §2.1 sets as that type's corpus. The corpus is not enlarged to reach 20; `docs/11` §2.1 fixes 10 per type, and authoring cases to satisfy a counting rule would produce evidence shaped by the count rather than by the coverage `docs/11` §2.2 requires.

**`PRD §14.1`'s ≥20 per input type is unchanged and remains a v1.0 completion criterion.** It is not lowered, waived, or deemed met by an M-08 run under this record. A v1.0 release still requires 20 reviewed analyses per input type, and reaching it will require either corpus growth or review of non-corpus analyses. Any M-08 result recorded under this condition states the sample size it actually used, and is **not** reported as satisfying `PRD §14.1`.

**`PRD §14.1`'s separate "≥5 generated architectures reviewed by someone other than the author" is likewise untouched.** It remains a v1.0 criterion, and note that the `job_description` path cannot contribute to it at all — that path generates no architecture (`AI §9.1`).

⚠️ **Two consequences of this reading, recorded rather than smoothed over.** It interprets a specification more narrowly than `docs/10` §4.1 does on its face; the narrowing is defensible from §4.1's own source, but it is a judgement, and §4.1 and this record will appear to disagree until §4.1 is amended or this deviation closes. And an M-08 run under condition 3 is a smaller sample than v1.0 will eventually demand, so its result is evidence for the sprint gate and not for release.

### On the remaining analysis paths

**Amended 2026-09-07 at owner decision.** Forbidden item 1 previously closed `FR-021` and `FR-023` outright.

**Both paths are authorised.** `M-11` requires all four `FR-011` input types to produce their specified artifact sets, and it is the next roadmap milestone. Closing two of the four made the milestone unbuildable, which was correct while D-39's scope was the M-08 prerequisites alone and is not correct now that the build is proceeding through the roadmap.

#### What this authorises, and only this

| # | Authorised |
|---|---|
| 1 | `FR-021` — the `existing_workflow` path: architecture review, risk analysis, edge cases, optimisation recommendations |
| 2 | `FR-023` — the `technical_assessment` path: solution architecture with explicit trade-off reasoning and named rejected alternatives |
| 3 | The reasoning-module routing, contract fields, prompt fragments and artifact generators those two paths require |
| 4 | A decision record for the `AI §4.2` mapping gap below, when it is made |

**The `FR-011` type set is not widened.** Four input types plus `unsupported`; this authorises the two that were closed and creates no fifth.

#### A specification gap this surfaces

`AI §4.2` maps `existing_workflow` to **no reasoning module**, while `FR-021` requires four outputs from it. `planReasoning` records the conflict rather than resolving it — *"naming one here would invent the mapping the specification omits, so the gap is left visible rather than filled."* Implementing `FR-021` means choosing that mapping. This record authorises the choice being made and requires it to be **recorded as its own decision**, not settled silently inside an implementation.

#### What is unchanged

| | |
|---|---|
| **M-08** | Not passed, not redefined. Its evidence requirements, the four closing conditions, and the sample-size reading above all stand unaltered |
| **Provider spend** | Still not authorised. No capture, no live run, no corpus work. Fragment **activation** still requires a clean regression pass reference (`DB §4.5`), which requires a capture, which requires a separate decision |
| **[D-38](13-D-38-Architecture-Unknown-Disposition.md)** | Untouched. Its remediation remains separately authorised and separately traceable |
| **Stages 4, 10, 11, 12** | Still closed. `AIQ-4`, `AIQ-6`, `AIQ-8` still closed |
| **Sprints 5 and 6** | Untouched. Authentication, history, export, instrumentation, accessibility, security, deployment and release remain where the roadmap puts them |

⚠️ **Authored, not active.** New or changed fragments for these paths can be written and tested offline, and cannot run in a live system until activation — which needs the capture nobody has authorised. Expect these paths to be complete in code and inert at runtime until that decision is taken.

## Consequence to be planned for

Fragment **activation** is a data constraint, not a process step: `DB §4.5` requires a `regression_pass_reference` resolving to a clean run covering every case the fragment composes into (D-24, D-30). So items 1–3 can be authored and tested offline, but **cannot be activated without a capture** — which is provider spend, and is explicitly not authorised here. Expect a separate budget decision before either lands in a running system.
