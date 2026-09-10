# D-89 — The artifact-set assertion evaluated, and four recorded defects closed

**Date:** 2026-09-10
**Status:** Accepted — free work on the known-missing-code list (STATUS ledger); no provider call, no spend
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** the runner's deferred `artifact_set` assertion (`docs/11` §9; the evidence M-11 is measured by); the assessment path's missing Architecture Recommendation (`AI §9.1`: "Requirement, assessment"); and four defects STATUS had carried as open: `analysis.model_version_id` null for API-created analyses (`AI-004`), `provider_invocation.attempt_number` not threaded through a regeneration (`DB §4.7`), `API-060` readiness not probing the artifact schemas, and a call cancelled at the deadline recorded at $0 (`NFR-083`)
**Affects:** `regression/assertions.ts`, `contracts.ts` (the assessment path's list), `orchestrator/execute-analysis.ts` + `analysis-runner.ts`, `provider/invoke.ts`, `nie/pipeline.ts`, `routes/health.ts` + `app.ts` + `index.ts`; tests in `tests/unit/provider-invoke.test.ts`, `tests/contract/health.test.ts`, `tests/integration/regression-runner.test.ts`, `nie-m11-paths.test.ts`, `nie-derived-artifacts.test.ts`
**Builds on** D-76 §4 (the runner sees what it can measure), D-77 (`artifact_generation`), D-86 (an advisory assertion, and why this one is not), D-82–D-85 (the P1 artifacts the corpus froze as excluded).

---

## 1. `artifact_set`, evaluated

The corpus freezes, per case, the artifact types expected and the types expected omitted with a reason. The assertion now checks both against what the pipeline generated on replay:

- every expected type must be generated — the corpus's `platform_comparison` is the product's `platform_recommendation` on both paths (`docs/11` line 278's reconciliation), and the product's `intent_brief` and `n8n_workflow`, outside the corpus vocabulary, are ignored;
- every expected omission must not be generated — **except the four P1 artifacts** the corpus froze as "excluded from v1.0 scope (`MVP §5.3`)" and the owner had built on 2026-09-10 (D-82–D-85). Producing them is reported in the assertion's detail as a superseded expectation, not a failure, until the corpus is re-versioned under `docs/11` §6.2; any other omission that is produced fails the case.

**What it found on the fifteen recorded cases: 10 agree, 5 contradict** — [research/m11-artifact-set-measurement.md](../research/m11-artifact-set-measurement.md). Three of the five are one missing capability: the pipeline never omits an artifact by judgement (`br-003` "do not automate", `br-010` "I don't want you to design the solution", `br-004` a two-line requirement). One is a disagreement between the corpus author and D-29 (`jd-008`, a portfolio on `apply_now`) for the owner. One was a gap this record closes (§2) plus a proportionality omission.

**The assertion is enforced, not advisory**, and the consequence is stated rather than softened: the fifteen-case run now fails five cases and issues no pass reference, so **no fragment can be newly activated** until the pipeline omits what the corpus says it should or the owner re-versions the expectations. The references in force stand; production is unaffected. D-86 made `confidence_band` advisory because a band mismatch is a finding about a two-factor calibration; these are the product doing the opposite of `FR-017` and `FR-020` on inputs authored to test exactly that, and a gate that let them through would be measuring nothing.

## 2. The assessment path's architecture recommendation

`AI §9.1` maps Architecture Recommendation to "Requirement, assessment". The assessment path rendered `assessment_feedback` and the diagram from its Stage 6 architecture and never the recommendation; `ta-005` expects it. It is on the path's list now, rendered from the same architecture and context by the D-73 renderer. No provider call, no recording change: the `ta-005` recording replays with the new artifact rendered.

## 3. The four recorded defects

| Defect | What was wrong | What changed |
|---|---|---|
| `analysis.model_version_id` null for API analyses (`AI-004`) | only the harness wrote it; drift attribution was lost for every real analysis | the executor writes the model version with the claim (`queued` → `running`); the runner passes it |
| `attempt_number` reported 1 for a Stage 9 regeneration (`DB §4.7`) | a regeneration is a fresh invocation, so its provider row could not be told from the first attempt | `InvocationContext.attemptBase`; the pipeline passes 2 on the regeneration; provider retries count on from there |
| `API-060` readiness did not probe the artifact schemas | on 2026-09-09 readiness answered 200 with zero schema rows and three paths failed at Stage 9 behind it | a fourth dependency, `schemas`: every `IMPLEMENTED_ARTIFACT_TYPES` entry has a published schema, or readiness is 503 |
| a call cancelled at the `FR-094` deadline recorded at $0 (`NFR-083`) | no usage comes back from an aborted call, so the ledger and the spend guard understated real spend | the prompt's input tokens are estimated from its length (≈ 4 characters per token) and priced at the input rate; output is unknowable and recorded as 0 — **a lower bound, labelled by the failure class** |

Historical rows are not backfilled: the analyses created before this record keep a null model version and the cancelled calls of 2026-09-09 keep their $0, which the handoff's spend line already carries at their upper bounds.

## 4. What is not changed

- The pipeline still plans every path's whole set. The planning judgement `FR-017`/`FR-020` need is the largest known-missing-code item and is not attempted here.
- The corpus's expectations are untouched (`docs/11` §6.2 makes changing one an owner act with a recorded justification).
- `API-041`, the second depth level, Stage 4: as the ledger lists them.

## 5. Verification

| Check | Result |
|---|---|
| `artifact_set` on the fifteen recorded cases | 10 agree, 5 contradict, each named with its frozen reason (research file) |
| A regeneration's provider row records attempt 2; a cancelled call records the prompt's estimated input cost, not $0 | ✅ `tests/unit/provider-invoke.test.ts` (+2) |
| Readiness reports four dependencies and fails on missing schemas | ✅ `tests/contract/health.test.ts` |
| The assessment path plans and renders three artifacts; the planner's assessment list | ✅ `nie-m11-paths.test.ts`, `nie-derived-artifacts.test.ts` |
| Runner: a halting synthetic case expects no artifact; the evaluated assertion counts as coverage | ✅ `regression-runner.test.ts` |
| Full suite, lint, format, typecheck, build | ✅ 2026-09-10 — 1120 tests, 1116 pass, 0 fail, 4 skipped |
| Production | ✅ **Deployed, 2026-09-10:** image `48958722db57` at `496d0e2` (rollback tag `rollback-858d42e`), migrations a no-op, no fragment or schema change; readiness now answers `{database, provider, templates, schemas}` all `available`, health 200. Free: no billed run was needed to verify a readiness probe and three ledger fields. |
