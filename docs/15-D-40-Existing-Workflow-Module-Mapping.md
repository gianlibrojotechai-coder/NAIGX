# D-40 — The `existing_workflow` reasoning-module mapping

**Standalone decision-register entry.** Extends the series alongside [D-38](13-D-38-Architecture-Unknown-Disposition.md) and [D-39](14-D-39-D-37-Amendment.md); `docs/12` is not modified.

**Decided 2026-09-07, at owner decision.** Required by D-39's *On the remaining analysis paths*, which authorises `FR-021` on condition that this mapping is recorded as its own decision rather than settled silently inside an implementation.

---

## The gap was a mis-citation

`planReasoning` carried this note:

> `existing_workflow` is **not** settled: `FR-021` requires an architecture review, risk analysis, edge cases and optimisation recommendations, but `AI §4.2` maps that path to no module and no reasoning stage implements it. Naming one here would invent the mapping the specification omits, so the gap is left visible rather than filled.

The caution was right; the citation was wrong. **`AI §4.2` is the *path* table** — it describes what each input type is and what its path does in prose. **`AI §7.1` is the *reasoning-module* table**, and its *Applies to* column maps every module to the paths it serves. `existing_workflow` appears there, explicitly, five times.

Nothing had to be invented. The mapping was in the specification the whole time, one section away from where the code looked.

## The mapping, from `AI §7.1`

| Module | Applies to | `existing_workflow` |
|---|---|---|
| RM-1 Problem Understanding | All | **✓** |
| RM-2 Requirement Analysis | All | **✓** |
| RM-3 Gap Analysis | Workflow, job description | **✓** |
| RM-4 Architecture Design | Requirement, assessment | **✗ excluded** |
| RM-5 Trade-off Evaluation | Requirement, assessment | ✗ |
| RM-6 Platform Selection | Requirement, workflow | **✓** |
| RM-7 Risk Identification | Requirement, workflow | **✓** |
| RM-8 Complexity Assessment | Requirement, workflow | **✓ but blocked** |
| RM-9 Roadmap Planning | Requirement | ✗ |

**`existing_workflow` → RM-1, RM-2, RM-3, RM-6, RM-7, RM-8.**

## RM-4 is excluded deliberately: this path reviews, it does not design

The most consequential line in that table is the absent one. `AI §7.1` gives Architecture Design to *requirement* and *assessment* only, and the rest of the specification agrees:

- `AI §4.2` describes the workflow path as *"Review path: current-structure identification precedes evaluation; optimization and risk emphasis."*
- `AI §9.1` gives it a **Workflow Recommendation** artifact — *"Review findings, structural issues, optimizations"* — and does **not** give it Architecture Recommendation.
- `FR-021` says *"architecture **review**"*, and its first acceptance criterion is *"Output identifies the workflow's current structure before evaluating it."*

So a submitted workflow is the subject of the analysis, not the input to a redesign. The system describes the structure it was given, then evaluates it. Producing a replacement architecture would answer a question the user did not ask, and would discard the thing being reviewed.

This is why the implementation adds a **workflow review** module rather than routing the path into `architecture_analysis`. Reusing Stage 6 would have been less code and the wrong answer.

## RM-8 complexity is mapped and blocked

`AI §7.1` assigns RM-8 to this path, and it cannot be implemented. Three existing decisions say why, and none of them is a permission problem:

| Record | What it establishes |
|---|---|
| **D-33** | `AIQ-4` cannot be calibrated without provider spend; Stage 11 cannot be responsibly implemented until it is |
| **D-35** | Stage 5's complexity pre-assessment has no scale, entity or vocabulary defined anywhere and was not invented |
| **D-36** | `docs/09` never names which stage scores the five factors; `AC-037` is specifiable but not measurable |

The **Complexity Score** artifact is therefore **deferred**, not omitted by choice and not silently dropped. `FR-021`'s risk and optimisation clauses are unaffected — they do not depend on a complexity score.

## Edge Cases & Practices is excluded, not deferred

`FR-021` names edge cases among its four outputs. `MVP §5.3` cuts the **Edge Cases & Best Practices** artifact (`FR-037`) from v1.0 as P1, and lists it in the reduction order ahead of `FR-036` and `FR-023`.

That exclusion predates this record and is not reopened by it. `FR-021` is therefore implemented **without** its edge-case clause, by an MVP scope decision already on the books — recorded here so a later reader does not mistake a documented exclusion for an oversight.

## The identified structure is stored as an architecture, and that needs no migration

`FR-032` requires every risk to name a component, and `DB §4.3` enforces it: `RiskItem.component_id` is **NOT NULL** with a foreign key to `ArchitectureComponent` — *"a risk that cannot name what it affects cannot be stored."* But this path produces no designed architecture, so at first reading a workflow risk has nothing to attach to.

It does. The review's first obligation is to **identify the workflow's current structure** (`FR-021`), and that structure is a set of components with responsibilities, inputs, outputs and failure handling — exactly what `ArchitectureModel` and `ArchitectureComponent` hold. So the identified structure is persisted through those entities, and risks attach to the steps of the workflow under review.

**The entity is the same; the provenance is opposite.** On the requirement and assessment paths, components are *proposed* — RM-4 output. Here they are *observed* — a description of what the user submitted. `ArchitectureModel.summary` describes the workflow as it is, not as it should be. Nothing in `DB §4.3` binds those entities to a design; they model structure, and a reviewed workflow has structure.

Consequences worth stating:

- **No schema change and no migration.** The constraint that looked like an obstacle is satisfied as written.
- **`FR-032` holds unchanged** — a workflow risk names a step of the workflow it belongs to.
- **A reader must not confuse the two.** An `ArchitectureModel` on a `business_requirement` analysis is a recommendation; on an `existing_workflow` analysis it is a transcription. The analysis's classification is what distinguishes them, and no artifact presents an observed structure as a proposal.

## What is implemented under this record

| Element | State |
|---|---|
| RM-1, RM-2 | Already satisfied by Stages 1–3, which run on every path |
| RM-3 Gap Analysis, RM-7 Risk Identification | **Implemented** as the workflow review and its risk findings |
| RM-6 Platform Selection | **Routed**; its *Platform Comparison* artifact was deferred to M-07 and **built 2026-09-10 by [D-87](62-D-87-Workflow-Platform-Comparison.md)** |
| RM-4 | **Excluded by this record** |
| RM-8 | **Blocked** by D-33/D-35/D-36 |
| Edge Cases | **Excluded** by `MVP §5.3` |

## Consequences

**`FR-021` is not fully satisfied by this record**, and no claim to the contrary should be made. Of its four named outputs, architecture review and risk analysis are implemented, optimisation recommendations are carried by the Workflow Recommendation artifact, and edge cases are excluded by `MVP §5.3`. The Complexity Score element remains blocked.

**The code comment that prompted this record is corrected**, not deleted — the reasoning it preserved is why the mapping was checked rather than guessed.

**Fragments authored under this record are inactive** until the activation gate is satisfied (`DB §4.5`, D-39). Both paths will be complete in code and inert at runtime until a capture decision is taken.
