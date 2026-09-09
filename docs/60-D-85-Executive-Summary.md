# D-85 — The executive summary, rendered from the analysis's own settled results so it cannot contradict them

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; no provider spend (rendered)
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `FR-038` (P1: "a non-technical summary suitable for a business stakeholder … consistent with the detailed artifacts; contradiction between them is a defect"; `AI §9.1` Executive Summary, requirement path, listed first; `AI §9.4` "executive summary verified against the recommendation set"). With D-82, D-83 and D-84 this completes the requirement path's `AI §9.1` set
**Affects:** `stages/executive-summary.ts` (new renderer), `backend/schemas/executive_summary.schema.json` (new; seventeen schemas at v3), `contracts.ts` (the type first on the requirement path's list and on `IMPLEMENTED_ARTIFACT_TYPES` — rendered, so not on the generated or path-generated lists), `stages.ts`, `pipeline.ts` (the settled generator results extend Stage 10's context; the summary rendered after the six generators settle), `stages/response-validation.ts` (`ReasoningContext` carries the settled results; a consistency case recomputes every figure), `stages/response-assembly.ts`, `export/artifact-markdown.ts`; the frontend presenter `ExecutiveSummary.tsx`; `tests/integration/export-endpoint.test.ts` re-pointed (it had used `executive_summary` as its example of an unrecognised type). **No fragment, no capture, no recording change**
**Builds on** D-66 (a rendered artifact with a `standing` field that says what it is), D-73/D-77 (rendered from stored reasoning), D-78–D-84 (the sources it projects).

---

## 1. Rendered, and why

`FR-038` has three criteria. The third — consistent with the detailed artifacts, contradiction a defect — is the one that decides the design: a summary *generated* by a model that reads the other artifacts can contradict them, and `AI §9.3` says generators never read each other's output. A summary *rendered* from the settled results cannot contradict them, because every figure in it is a projection of the artifact it summarises:

| Section | Source | Projection |
|---|---|---|
| headline, problem | Stage 2 intent record, Stage 3 context set | the primary objective's own words; the inferred scope; the stated constraints (at most three); the count of unknowns |
| approach | Stage 6 architecture | its own summary, data-flow description and component names, in order |
| platform | D-78 recommendation | the recommended platform (or null for none) and its rationale |
| principal risks | D-79 register | the register's first three — it is already ordered by severity × likelihood |
| complexity | D-80 score | the computed score and its band, the presenter's own thresholds |
| phases | D-82 roadmap | each phase's ordinal, name and outcome |

A section whose source artifact did not generate is absent, and `not_summarised` names it, so the reader is never shown a summary of something that does not exist. `standing` is fixed to `summary_of_detailed_artifacts`, as the intent brief's is to `understanding_only` (D-66): the document says what it is.

**Stage 10 recomputes every projection** against the source it came from (the pipeline extends the reasoning context with the settled results before rendering): the headline against the intent, the components and summary against the architecture, the platform against the recommendation, the three risks against the register, the score and band against the assessment, the phase names against the roadmap — and a section present without its source is a finding. `AI §9.4`'s "executive summary verified against the recommendation set" is done this way, structurally.

**The first criterion — non-technical vocabulary — is met in the renderer's own prose and only partly in the quoted content.** The connective sentences are the renderer's and are plain. The quoted content is the analysis's own words: the objective as the input stated it (plain by nature), the architecture's one-line summary, the register's risk descriptions. Those are as technical as the generators wrote them. A generated paraphrase would read more smoothly and could be wrong; this reads as the analysis does and cannot be. Recorded as the trade-off it is, with the honest statement that a business reader gets the analysis's words, not a rewrite of them.

## 2. Where it runs

On the requirement path, after the six generators settle and before the other rendered artifacts, as a renderer closure over the settled results — so it is planned first (precedence) and rendered last (dependency). The generic renderer's failure event says deterministic and refuses retry, which is correct: a rendered summary that fails its schema is a renderer defect.

## 3. What is not changed

- No fragment, no capture: the campaign in flight for D-82/D-83/D-84 is unaffected, and every existing recording replays with the summary rendered from what it already holds.
- No other path. `AI §9.1` maps the executive summary to the requirement path.

## 4. Verification

| Check | Result |
|---|---|
| Every section is a projection of its source; the document validates; a section whose source did not generate is absent and named; the bands match the presenter's; Stage 10 recomputes every figure and fails a tampered score or platform, and a summary of a register that did not generate | ✅ `tests/unit/nie-executive-summary.test.ts` (4) |
| Planner: the requirement path plans ten artifacts, the summary first | ✅ `tests/unit/nie-derived-artifacts.test.ts` |
| Full suite, lint, format, typecheck, build; `schemas:check` 17 | ✅ 2026-09-10 — 1108 tests, 1104 pass, 0 fail, 4 skipped (the coverage pin made order-insensitive for the concurrent generators) |
| Production | ⏳ deployed with D-82/D-83/D-84 — see [D-84 §5](59-D-84-Integration-Requirements.md) |
