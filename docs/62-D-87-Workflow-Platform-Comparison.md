# D-87 — The workflow path's platform comparison: keep, move or stop, under its own fragment

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; the paid step (recapturing `ew-001`) ran under a stated ceiling recorded in §3
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** the `AI §9.1` Platform Comparison on the `existing_workflow` path — routed by [D-40](15-D-40-Existing-Workflow-Module-Mapping.md) (RM-6 Platform Selection) with "its *Platform Comparison* artifact deferred to M-07". With it, every artifact `AI §9.1` maps to the workflow path is produced but Edge Cases, which `MVP §5.3` excludes there
**Affects:** `prompts/stage/platform_comparison.md` (new; manifest 23), `contracts.ts` (`platform_recommendation` on the workflow path's list), `prompt.ts`, `output-schemas.ts` (the same request schema under the new task), `pipeline.ts` (the platform generator takes the stage key it runs under; the workflow branch runs the comparison beside the complexity assessment; Stage 10's context gains the observed architecture; replay keying; retry on the workflow path regenerates the comparison), `regression/review-packet.ts`; `ew-001` recaptured. **No new schema, parser or presenter**: the artifact is `platform_recommendation`, generated against the same schema and checked by the same parser (D-78), rendered by the same presenter and export
**Builds on** D-78 (the platform generator and its parser), D-40 (the observed structure persists through the architecture entities), D-80 §2 (concurrent generators), D-81 (retry by type and path).

---

## 1. One generator, two framings

The requirement path recommends a platform for a design that does not exist yet; the workflow path compares platforms for a workflow that already runs somewhere. The questions differ — *keep where it is, move it, or stop automating it* — but the answer's shape does not: criteria traced to context elements or components, a recommendation (or `null`), at least one rejected alternative with its reason, a fit line per component, the knowledge-currency note. So the workflow path runs the **same generator under its own fragment**: `generatePlatformRecommendation` takes the stage key it runs under (`platform_comparison`), composes `stage.platform_comparison`, and validates and parses the answer exactly as D-78 does, with the observed structure as the architecture — every step must have a fit line by its exact name, and a criterion must cite an element or a step.

The fragment frames the observed structure as observed ("it disposes of no unknowns"), tells the model not to assume a workflow should move merely because it could, asks that the current platform be one of the rejected alternatives when a move is recommended, and — after the first capture — says that **the absence of something is not a criterion**: "no budget is stated" cites nothing and is refused by the D-78 parser, as it should be; a gap that matters belongs in the rationale.

Stage 10's `internal_consistency` case for the artifact checks fit lines and criteria against the architecture in its context, and on this path that context had never been given the observed architecture — the D-80 complexity check did not need it. It has it now, extended before the generators run.

## 2. Beside the complexity assessment

The workflow path now runs two generators at Stage 9, concurrently (D-80 §2), so it traces `1, 2, 3, 5, 6, 9, 9, 10, 11, 12` and plans five artifacts: workflow recommendation, risk register, platform comparison, complexity score, plus the brief. `API-032` retry of `platform_recommendation` on this path regenerates under the comparison fragment (the retry reader returns the observed architecture, which is what persisted through the architecture entities under D-40).

## 3. The gate, walked

1. Fragment authored; `fragments:write` recorded the twenty-third hash; the m11 suite replays a comparison keyed on the observed handoff.
2. **First capture** (`ew-001`, $0.50 ceiling, Sonnet 5 medium): **failed, $0.1632 billed** — the parser refused a criterion "No budget figure is stated anywhere in the input", traced to nothing (FR-034's rule, D-78). The fragment gained its absence sentence; no recording was invalidated because none existed under it.
3. **Second capture:** captured, five artifacts, **$0.1554**; evaluated clean; admitted, the D-84 `ew-001` superseded with its reason.
4. Targeted run `--fragment=stage.platform_comparison` → **`bd0c8a59df8f7ea4`**. Fifteen cases → 15 passed → **`corpus-regression:corpus-v2+fragments-v1:a249714e093716f7`** (three advisory confidence-band notes, D-86 §2).
5. `fragments:publish --reference=…a249714e093716f7` locally (23 active); the same from the new image in production (§5).
6. **The confidence model was re-fitted** on the recordings now in force (D-86's README rule, applied to a new Stage 3 sample rather than a new fragment): the new `ew-001` recording's features moved (CF-2 0.867 → higher, base 0.855), the grid search settled on clarity weight 0.4, high ≥ 0.827, medium ≥ 0.803, still 34 of 44 reproduced; `jd-002` now reproduces and `ew-001` does not. `model.json`, `fit.md`, `confidence-model.ts` and D-86 §2 were updated together.

Campaign total: **$0.3186**.

## 4. What is not changed

- Edge Cases on the workflow path stay excluded (`MVP §5.3`). The requirement path's generator, fragment and recordings are untouched.
- No schema (the shared `platform_recommendation` schema serves both paths), no migration, no presenter.

## 5. Verification

| Check | Result |
|---|---|
| The workflow path plans five artifacts and generates the comparison beside the score; the browser sees five artifact events; the planner's workflow list; the fragment gate counts 23; the request schema registry has the new task | ✅ `tests/integration/nie-m11-paths.test.ts`, `tests/unit/nie-derived-artifacts.test.ts`, `tests/unit/fragment-gate.test.ts`, `tests/unit/output-schemas.test.ts` — pins updated deliberately |
| Full suite, lint, format, typecheck, build; `fragments:check` 23, `schemas:check` 17, `recordings:check` 15 | ✅ 2026-09-10 — 1118 tests, 1114 pass, 0 fail, 4 skipped |
| Captures, admission, references, replay | ✅ §3 — 15 of 15 reproduce `a249714e093716f7` |
| Production | ⏳ |
