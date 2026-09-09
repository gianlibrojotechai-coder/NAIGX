# D-83 — Edge cases and practices: every scenario and every practice named to a part of the design

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; captured in one campaign with D-82 and D-84 (§4)
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `FR-037` (P1: "edge cases and applicable practices specific to the generated design"; `AI §9.1` Edge Cases & Practices) on the requirement path. `MVP §5.3` excludes the artifact on the workflow path, and it stays excluded there
**Affects:** `prompts/stage/edge_case_analysis.md` (new; manifest 21), `stages/edge-case-analysis.ts` (new parser), `backend/schemas/edge_cases_and_practices.schema.json` (new), `contracts.ts` (`EdgeCase`, `Practice`, `EdgeCaseAnalysis`; the type on the requirement path's list, on `IMPLEMENTED_ARTIFACT_TYPES` and on `PATH_GENERATED_ARTIFACT_TYPES`), `output-schemas.ts`, `prompt.ts`, `stages.ts`, `pipeline.ts` (a fifth concurrent generator; retry branch; replay keying), `stages/response-validation.ts`, `stages/response-assembly.ts`, `orchestrator/analysis-runner.ts`, `regression/dry-run-adapter.ts`, `regression/review-packet.ts`, `harness/recordings.ts`, `export/artifact-markdown.ts`; the frontend presenter `EdgeCasesAndPractices.tsx`
**Builds on** D-79 (the tolerant design-part match), D-82 (the generator pattern), D-81 (per-path retry).

---

## 1. Specific to the design, enforced

`FR-037`'s acceptance criteria, each enforced:

- **Each edge case describes a concrete scenario and its consequence.** `scenario`, `consequence` and `handling` are required, non-empty; the fragment asks for the input, the state, the volume, the timing, and forbids "unexpected input".
- **Practices reference the specific component or decision they apply to.** `applies_to` must name a component of the architecture or an external system one names (the D-79 tolerant match); a practice tied to "all services" is refused as the generic advice the requirement calls a defect.
- **Generic advice not tied to the submitted design is a defect.** Every edge case's `component` is checked the same way, so a scenario in "the database" of a design that has none is refused; and the practices list *may be empty* — the fragment says an empty list is better than generic advice, and the presenter says so when it is.

Stage 10 recomputes both groundings against the architecture. At least one edge case is required: every design has a boundary condition worth stating.

## 2. A fifth concurrent generator

Runs beside the other requirement-path generators (D-80 §2) with its own trace; retryable on this path (D-81). The path traces `1, 2, 3, 5, 6, 9 ×6, 10, 12` once D-84 lands with it.

## 3. What is not changed

- The workflow path does not produce this artifact (`MVP §5.3`); no other fragment or requirement.

## 4. The gate, walked

Captured in one campaign with D-82 and D-84 — see [D-84 §4](59-D-84-Integration-Requirements.md).

## 5. Verification

| Check | Result |
|---|---|
| Parser: grounded edge cases and practices validate; an edge case in something the design lacks refused; a practice not tied to a part refused; at least one edge case; practices may be empty; Stage 10 recomputes the grounding | ✅ `tests/unit/nie-edge-case-analysis.test.ts` (5) |
| Pipeline, harness, real infrastructure, capture, runner, coverage, planner with the extra Stage 9 calls | ✅ pins updated deliberately (see D-84 §5) |
| Captures, admission, references, replay; production | See [D-84 §4–5](59-D-84-Integration-Requirements.md) |
