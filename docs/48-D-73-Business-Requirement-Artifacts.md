# D-73 — The requirement path's rendered artifacts: Architecture Recommendation and the diagram

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; supersedes the "plans nothing" reading of `PATH_ARTIFACT_TYPES.business_requirement` for the two artifacts that are pure projections, and leaves `platform_recommendation` exactly where STATUS records it: an open owner decision
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `AI §9.1` gives the requirement path an *Architecture Recommendation* and a *Mermaid Diagram*; until now the path reasoned to an architecture and handed the reader nothing but the reasoning hierarchy (STATUS: "`business_requirement` produces no artifacts — OPEN SCOPE DECISION"). `C-3` was unassessable for the path on every capture, however many were taken (STATUS, C-3 row)
**Affects:** `backend/schemas/architecture_recommendation.schema.json` (new), `contracts.ts` (`ARTIFACT_TYPES`, `PATH_ARTIFACT_TYPES`, `IMPLEMENTED_ARTIFACT_TYPES`), `stages/derived-artifacts.ts` (renderer), `pipeline.ts` (the requirement branch now plans and renders), `stages.ts` (Stage 9 produces the type), `stages/response-validation.ts` (an `internal_consistency` case), `export/artifact-markdown.ts` (renderer), frontend type guard, presenter and registry
**Builds on** D-40 (rendered, not generated), D-66, D-72. **Changes no prompt, recording or requirement.** One new schema, published to `ARTIFACT_SCHEMA` at version 2 like the others.

---

## 1. What the path produces now

| Artifact | Source | New? |
|---|---|---|
| `intent_brief` | Stage 2 intent record (D-66) | no |
| `architecture_recommendation` | Stage 6 architecture | **yes** |
| `mermaid_diagram` | Stage 6 architecture (the assessment path's renderer, unchanged) | new on this path |

Both are rendered at Stage 9 by the D-40 discipline: every field is Stage 6's own value, so the artifact cannot disagree with the reasoning it came from, and a rendering defect is a schema failure caught the same way. Stage 10's `internal_consistency` class re-checks each against the architecture at validation time (component count and names, standing, trade-off and rejection counts) and fails the artifact if they diverge.

## 2. Why this is not the `platform_recommendation` decision

STATUS records the requirement path's artifact gap as an owner decision because closing it *properly* — a platform recommendation — is reasoning work: a further prompt fragment, a capture campaign, an activation through the gate. Nothing here is that. The two artifacts added are projections of an output the path already produces on every run; they cost no provider call, need no fragment, and change no recording. The decision STATUS records is untouched and is listed with the paid items.

The reading superseded is narrower than it looked. `PATH_ARTIFACT_TYPES` said the list was empty "because its artifacts … are M-07 work and unbuilt". Two of those artifacts were buildable from stored reasoning the day D-40 landed; they were left out because the path's *whole* set could not be delivered, and a partial set was read as dishonest. `DB §4.4`'s omission rows exist for that case — but a declared type with no generator would be planned and omitted on every run, which is why the four reasoning artifacts are still not declared. The two rendered ones are.

## 3. What the recommendation says that the feedback does not

`FR-020` (requirement path) and `FR-023` (assessment path) ask different things of the same architecture, and the two artifacts differ accordingly:

- **Standing.** `standing: "recommendation"` is a constant in the schema. The document says it is a shape to build from, not a critique of something submitted — the frontend and the export both lead with that line.
- **Inputs and outputs per component.** A reader of a recommendation is about to build it. Stage 6 already produces both fields; the assessment feedback omits them because its reader is defending a design, not constructing one.
- **Integration and direction**, where Stage 6 named an external system.
- **Trade-offs and rejected approaches are carried, not required.** `FR-023`'s minimum of one rejected alternative binds the assessment path only. On this path both lists may be empty; the renderer says so in words rather than inventing an alternative to satisfy a rule that does not apply.

## 4. Effects on evidence and review

- **`C-3` becomes structurally assessable on the requirement path** — for a *new* capture. The recordings in `research/regression-recordings/corpus-v1` were made before D-73 and carry no Stage 9 trace for `br-*` cases; `assessabilityOf` derives from the recording, so they still report C-3 not assessable, and the review-packet test that pins that stays true. A recapture is a paid item and is not started here.
- **Replay is unaffected.** Stage 9 makes no provider call on this path, so the fifteen recordings replay to the same pass reference; the requirement cases now additionally produce two artifacts from their recorded architectures.
- **Trace shape.** A requirement-path response now traces Stage 9 (`portfolio_suggestions` is the stage key, per `stages.ts`'s one-generator note) between Stages 6 and 10. The pinned stage lists were updated deliberately; `docs/47` D-72 §3 records the previous shape.

## 5. Verification

| Check | Result |
|---|---|
| Renderer: every component with ordinal, inputs, outputs; absent trade-offs rendered as empty, not invented; validates against the published schema | ✅ `tests/unit/nie-derived-artifacts.test.ts` |
| Plan: the requirement path plans exactly its two rendered artifacts; unsupported still plans nothing | ✅ |
| Pipeline and real infrastructure: requirement-path traces `1, 2, 3, 5, 6, 9, 10, 12`, both artifacts `generated`, persisted end to end | ✅ `nie-pipeline`, `nie-real-infrastructure` |
| Retry of the rendered type is refused as deterministic (`API-032`) | ✅ `degradation.test.ts` |
| Export renders the type in Markdown and PDF paths | ✅ shared renderer |
| Full suite, lint, format, typecheck, build; `schemas:check` reports 8 published and matching | ✅ 2026-09-10 — 1038 tests, 1034 pass, 0 fail, 4 skipped |
| Live, in production | ✅ **Production, 2026-09-10:** deployed as image `47669ecdfaf3` at `df6886f` (outgoing `e9e3f7c75a3b` kept as `rollback-af04454`, edge likewise), live mode unchanged (caps 6.00/50.00, anonymous disabled, allowlist 1 account, key absent from the environment), readiness 200, `schemas check` 8 published and matching. One billed business-requirement analysis (`br-001`, id `81516808-a180-4934-b323-b0ceaac50ad4`) under a temporary allowlisted verification address, removed again the same minute (`deploy/.env` restored byte-for-byte, the address now refused 403): **completed in 140.6 s, 4 provider calls, $0.3741**; the page reported "Produced 3 artifacts: Intent brief, Architecture recommendation, Mermaid diagram", the recommendation rendered every component with inputs, outputs and failure handling, and the diagram drew |
| Fifteen recordings replay | ✅ 15 passed — reproduced `d1b67b9017b86257`; the nine `br-*` cases now render two artifacts each from their recorded architectures |
