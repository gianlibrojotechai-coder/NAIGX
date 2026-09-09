# D-75 — Skill Gap Analysis: the job-description path's second artifact, rendered from the verdict

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build ("keep on building … no need to ask for my permission"); closes one of the two D-29 "no generator" omission rows on the job-description path
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `AI §9.1` gives the job-description path a *Skill Gap Analysis* — "required skills, gaps, priority; requirements classified must/nice-have". Since D-29 every job-description plan has carried the row `skill_gap_analysis: omitted — No generator for this artifact type yet`, on every run, while the Stage 7 recommendation already held every field the artifact is specified to contain
**Affects:** `backend/schemas/skill_gap_analysis.schema.json` (new, v2), `contracts.ts` (`IMPLEMENTED_ARTIFACT_TYPES`), `stages/artifact-planning.ts` (planned on every verdict), `stages/derived-artifacts.ts` (renderer), `pipeline.ts` (rendered at Stage 9 on both job-path branches), `stages.ts`, `stages/response-validation.ts` (an `internal_consistency` case), `export/artifact-markdown.ts`, frontend type guard, presenter and registry
**Builds on** D-29, D-40 (rendered, not generated), D-72, D-73. **Changes no prompt, recording or requirement.**

---

## 1. Why rendered, and why on every verdict

The artifact's specified content — requirements with necessity, matches with evidence, gaps with priority — is Stage 7's output (`FR-022`), field for field. A generator would pay a provider call to restate it and could disagree with the verdict it came from; a renderer cannot. Stage 10's `internal_consistency` class re-checks the rendering against the recommendation (requirement count, gap count, decisive count, the decision) and fails the artifact if they diverge.

It is planned whichever way the verdict went. The portfolio artifact is planned only for `build_first`, because a project recommended after an `apply_now` verdict contradicts the decision. A gap analysis after `apply_now` contradicts nothing: it says every requirement is evidenced and there is nothing to close, which is the finding a reader most wants stated rather than inferred from an absence (`FR-091`). The planner now carries three cases for the path — the gap analysis always, the portfolio by verdict, the interview guidance omitted with its reason (still no generator; it needs one, and it is listed with the paid items).

## 2. What the document adds that the hierarchy does not

The reasoning hierarchy already shows each requirement with its evidence and gaps. The artifact adds one thing: **the order to close the gaps** — decisive first, then high → medium → low, then must-have before nice-to-have — and flags which gaps a build could close (`docs/12` D-28: technical only). A reader who takes one thing away takes that list. The summary line (requirements, must/nice-have, evidenced, gaps, decisive) makes the verdict's arithmetic visible.

## 3. Trace and event shape

The gap analysis is attributed to the same Stage 9 trace as the portfolio and announced right after it (`plan`, `artifact` portfolio, `artifact` gap analysis, then the D-71 n8n decision). On `apply_now`, where no portfolio is generated, Stage 9 is now traced for the rendering — deterministic, no provider call — so the job path's trace is `1, 2, 3, 5, 7, 8, 9, 10, 12` on both verdicts. The pinned event order and stage lists were updated deliberately.

## 4. Verification

| Check | Result |
|---|---|
| Renderer: every requirement with necessity, kind, provenance, evidence or gap; the priorities ordered decisive → priority → necessity; `apply_now` with no gaps renders an empty list the export states in words; validates against the published schema | ✅ `tests/unit/nie-skill-gap-analysis.test.ts` (5) |
| Stage 10 fails a rendering that disagrees with its recommendation | ✅ same suite |
| Planner: planned on both verdicts with a reason; interview guidance still omitted with its reason; `withOutcome` leaves it untouched | ✅ `tests/unit/nie-artifact-planning.test.ts` |
| Job path end to end: both verdicts, event order, stage lists | ✅ `tests/integration/nie-jd-path.test.ts` |
| Full suite, lint, format, typecheck, build; `schemas:check` 9 published and matching | ⏳ |
| Fifteen recordings replay | ⏳ |
| Production | ⏳ |
