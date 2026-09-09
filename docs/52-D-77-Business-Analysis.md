# D-77 — Business Analysis: the problem as understood, rendered before any solution artifact; and the runner learns to see a failed artifact

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; no provider call, no fragment, no recording changed
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `AI §9.1` gives the requirement path a *Business Analysis* — "problem as understood, objectives, constraints; **precedes all solution artifacts**" — and the golden corpus expects it on ten requirement cases. Every field it names is Stage 2's and Stage 3's output. Also closes the first of D-76 §4's two runner gaps by making a failed planned artifact fail a regression case
**Affects:** `backend/schemas/business_analysis.schema.json` (eleventh schema, v2), `contracts.ts` (`ARTIFACT_TYPES`, `PATH_ARTIFACT_TYPES.business_requirement` — now three, in precedence order), `stages/derived-artifacts.ts` (renderer), `pipeline.ts` (rendered on the requirement branch), `stages.ts`, `stages/response-validation.ts` (an `internal_consistency` case), `stages/response-assembly.ts` (rests on intent and context), `export/artifact-markdown.ts`, frontend type guard, presenter and registry; `regression/assertions.ts` (new evaluated assertion `artifact_generation`); `regression/capture.ts` (refuses to admit a run whose planned artifact failed — D-76 §4)
**Builds on** D-40, D-66, D-73, D-76.

---

## 1. The artifact

A projection of the intent record and the context set, and of nothing later: the objective and secondary objectives with their provenance, the inferred scope, every `constraint` element, every other stated or inferred element with its category, every `unknown` with its resolution hint (`FR-044`), the sufficiency judgement, and the provenance counts. `standing: "problem_statement"` is a schema constant; the export and the presenter lead with it, so a reader who skims to the artifacts meets the problem before the architecture and cannot mistake it for a conclusion.

It is listed first in `PATH_ARTIFACT_TYPES.business_requirement` because order there is precedence and `AI §9.1` says the analysis precedes the solution artifacts. Stage 10's `internal_consistency` class checks the element and unknown counts against the context set and the objective against the intent record.

## 2. The runner change

D-76 §4 recorded that a recording whose Stage 9 answer the parser rejected passed every evaluated assertion, because `artifact_set` is deferred and `run_completeness` looks at reasoning stages only. `artifact_generation` is now an **evaluated** assertion: a planned artifact that ended `failed` fails the case, naming the type. It is distinct from the still-deferred `artifact_set` (which compares the produced set with the corpus expectation, `docs/11 §9`) — this one asks only whether what was planned was produced. The first D-76 capture would have failed it. All fifteen admitted recordings pass it.

`captureCase` now also refuses to write a recording whose planned artifact failed (`CaptureArtifactError`; the paid responses are quarantined like any failure) and reports each case's artifact outcomes. The second D-76 §4 gap — a stage added to a path being invisible to `composition_mismatch` — remains open.

## 3. Verification

| Check | Result |
|---|---|
| Renderer: objective, scope, constraints, environment (with inference basis), unknowns with hints, counts; validates against the published schema | ✅ `tests/unit/nie-business-analysis.test.ts` (3) |
| Stage 10 fails a rendering that disagrees with its sources | ✅ same suite |
| Export leads with the standing, marks provenance, lists unknowns with resolutions | ✅ same suite |
| Requirement path plans three artifacts in precedence order; retry refused as deterministic | ✅ `nie-derived-artifacts`, `degradation` |
| Runner: `artifact_generation` evaluated; capture refuses a failed artifact and reports outcomes | ✅ `regression-assertions`, `regression-runner`, `regression-capture` (+2) |
| Full suite, lint, format, typecheck, build; `schemas:check` 11 published and matching | ✅ 2026-09-10 — 1062 tests, 1058 pass, 0 fail, 4 skipped |
| Production | ⏳ |
