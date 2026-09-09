# D-81 — Retry decided by type and path: the register and the score are retryable where they are generated

**Date:** 2026-09-10
**Status:** Accepted — closes the limitation D-79 §2 and D-80 §2 both recorded
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `API-032` / `FR-091` ("retry of a failed artifact is available without re-running the analysis") for `risk_assessment` on the requirement path and `complexity_score` on the requirement and workflow paths, which the type-only decision had refused with an inaccurate reason
**Affects:** `contracts.ts` (`PATH_GENERATED_ARTIFACT_TYPES`, `RetryableArtifactType`, `isRetryableArtifact`), `pipeline.ts` (the two generators' `artifact_failed` events; `regenerateArtifact` runs the risk and complexity generators from the stored architecture), `orchestrator/analysis-runner.ts` (the architecture reader serves three types), `routes/analyses.ts` (the decision reads the stored classification). No schema, fragment, migration or frontend change
**Builds on** D-40 (rendered artifacts are deterministic; retry refused), D-76/D-78 (retry by generator), D-79/D-80 (the two path-dependent types).

---

## 1. The problem was the shape of the question

`API-032` refuses to retry a rendered artifact because a deterministic renderer given the same stored reasoning produces the same document — the refusal is the honest answer. The route decided that by artifact *type*, which was exact until D-79: `risk_assessment` is rendered from findings on the workflow path and generated against the architecture on the requirement path, and `complexity_score` (D-80) is generated on both paths that produce it. A failed requirement-path register therefore reported `retryAvailable: false` with the "deterministic" reason — accurate for the type, false for that analysis.

The decision is now a function of type **and** path. `PATH_GENERATED_ARTIFACT_TYPES` names the paths on which each dual-source type is generated; `isRetryableArtifact(type, classifiedAs)` is true for the types generated everywhere (portfolio, interview guidance, platform) and for a dual-source type on a path that generates it. The route reads the analysis's stored classification for the decision, and the generators' `artifact_failed` events use the same predicate with the path they ran on — one predicate, so the stream cannot advertise a retry the endpoint refuses. The message for a refused type is unchanged, and now true whenever it is sent.

## 2. What a retry runs

The runner's D-78 branch — read the stored context set and architecture back in persisted order, regenerate with no reasoning stage re-run — now serves three types. `regenerateArtifact` runs the risk-register or complexity generator with the same inputs the first attempt had; on the workflow path the stored architecture is the observed workflow, which is what its complexity generator scored the first time. The outcome is stored as a labelled second attempt either way (`DB §4.4`), as for the other generators.

## 3. Verification

| Check | Result |
|---|---|
| The predicate: generated-everywhere types retryable on every path; the register retryable on the requirement path and not the workflow path; the score on both of its paths and nowhere else; rendered-only types never | ✅ `tests/unit/artifact-retry.test.ts` (4) |
| The route: 202 and the runner called for the register and the score on the requirement path and the score on the workflow path; 409 `deterministic` for the register on the workflow path and the score on the job path; the earlier refusals unchanged | ✅ `tests/integration/degradation.test.ts` (+1) |
| Pipeline, m11, full suite, lint, format, typecheck, build | ✅ 2026-09-10 — 1085 tests, 1081 pass, 0 fail, 4 skipped |
| Production | ⏳ |
