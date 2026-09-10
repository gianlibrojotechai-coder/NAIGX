# M-11 — artifact sets against the corpus, measured 2026-09-10

**Criterion** (`docs/08` M-11): the four input types produce their specified artifact sets. **The specification is the corpus**: each case freezes `expected_artifact_set` and `expected_omissions` with reasons (`docs/11` §9), and the runner's `artifact_set` assertion — deferred since Sprint 1, evaluated since D-89 — compares them with what the pipeline generated on replay.

**Result on the fifteen recorded cases: 10 agree, 5 contradict. NOT MET on the sample.** The other 29 corpus cases have no recording past Stage 3 and are unmeasured; per-type sampling (≥10 per type) needs paid captures.

## How the comparison is made

- Every type in `expected_artifact_set` must be generated. The corpus's `platform_comparison` is the product's `platform_recommendation` (`docs/11` line 278 reconciliation; D-78, D-87). The product's `intent_brief` and `n8n_workflow` are outside the corpus vocabulary and are ignored.
- Every type in `expected_omissions` must not be generated — **except the four P1 artifacts the corpus froze as "excluded from v1.0 scope (MVP §5.3)"**, which the owner had built on 2026-09-10 (D-82–D-85). Producing those is reported in the detail as a superseded expectation, not a failure, until the corpus is re-versioned under `docs/11` §6.2 (an owner act: the expectation's basis changed, the label did not become wrong on its own).
- Everything else that contradicts fails the case. Nothing below was relabelled.

## The five contradictions

| Case | Frozen expectation | What the pipeline did | What it is |
|---|---|---|---|
| br-003 (`do-not-automate`) | `business_analysis` only; the design artifacts omitted because "automation is unwarranted … the system states this rather than producing a design" (`FR-020`, gap G-2) | generated the full requirement set: architecture, diagram, platform, register, score | **Known missing code.** No stage can conclude "do not automate" and omit the design; Stage 8 plans the whole path set unconditionally. The runner's own `do_not_automate_conclusion` assertion is still deferred for the same reason |
| br-010 | `business_analysis` only; the submitter says "I don't want you to design the solution" and is running their own supplier comparison | generated the full set | **Known missing code.** The plan does not read the intent for a declined design (`FR-017` proportionality; `PV §3.2` over-production) |
| br-004 (minimal, 66 characters) | `business_analysis` + `architecture_recommendation`; diagram, platform, register and score omitted as disproportionate to a two-system, single-trigger requirement (`FR-017`, `FR-020` "non-trivial", A-8, A-12) | generated the full set | **Known missing code**, the same shape as `AC-037`: a single depth level cannot omit anything (D-34) |
| ta-005 (minimal assessment) | `architecture_recommendation` + `mermaid_diagram`; `assessment_feedback` omitted as disproportionate | generated `assessment_feedback` + `mermaid_diagram`, no `architecture_recommendation` | **Two things.** (1) **Known missing code**: `AI §9.1` maps Architecture Recommendation to "Requirement, assessment", and the assessment path never rendered it — fixed by D-89, which renders it on that path from the same architecture. (2) The proportionality omission, as above |
| jd-008 (`apply_now`) | `portfolio_suggestions` expected | not generated: D-29's rule omits the portfolio when the verdict is `apply_now` ("nothing to build") | **Owner decision.** The corpus author and the design record disagree about whether an applicant with no decisive gap gets a portfolio; `docs/11` §6.2 makes changing either a recorded decision |

Ten cases agree, including every refusal and halt (`br-005`, `un-001`, `un-002`: empty sets, nothing generated but the brief) and the requirement cases whose only contradictions were the superseded P1 omissions (`br-001`, `br-002`, `br-007`, `br-009`, `br-011`), the workflow case and `jd-002`.

## What the measurement says about the product

Three of the five are one defect seen from three inputs: **the pipeline never omits an artifact by judgement.** Every path produces its whole `AI §9.1` set whatever the input says — a request not to design, a process that should not be automated, a two-line requirement. `FR-017` ("minimal input yields a minimal artifact set"), `FR-020`'s "automation is unwarranted" conclusion, `PV §3.2` and `AC-037` all point at the same missing capability: a planning judgement, at Stage 5 or Stage 8, fed by Stage 2 (a declined design) and Stage 6 (an unwarranted automation), and a second depth level. That is reasoning work with a corpus to measure it against, and it is the largest piece of known missing code the corpus exposes.

## Consequence for the gate

The `artifact_set` assertion is enforced, as `docs/11` §9 lists it. With five contradictions on the recorded cases, **the fifteen-case run no longer issues a pass reference**, so no fragment can be newly activated until either the pipeline omits what the corpus says it should, or the owner re-versions those expectations. The references already in force stand; production is unaffected. Weakening the assertion to advisory was considered and not done: unlike the confidence band (a calibration finding about a model with two factors), these are the product doing the opposite of what its requirements say on inputs authored to test exactly that.
