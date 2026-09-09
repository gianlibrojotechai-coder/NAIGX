# D-80 — The complexity score: five factors scored by the generator, the arithmetic done by the pipeline

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; the paid step (recapturing the nine requirement cases and the workflow case) ran under a stated ceiling recorded in §4
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `FR-033` (P0: a complexity score "with the factors and weights that produced it"; `docs/09` §1, the `complexity-v1` scale) on the requirement and workflow paths. D-33/D-35/D-36 had left complexity blocked on one open question — *which stage scores the factors* — and this record closes it (§1). Also the `AC-037` precondition ("unmeasurable until complexity scoring exists")
**Affects:** `prompts/stage/complexity_assessment.md` (new; manifest 19), `stages/complexity-assessment.ts` (new: parser, arithmetic, renderer), `backend/schemas/complexity_score.schema.json` (new; thirteen schemas at v3), `contracts.ts` (`COMPLEXITY_FACTORS` with their weights, `ComplexityAssessment`, `complexity_score` on both paths' artifact lists), `output-schemas.ts`, `prompt.ts`, `pipeline.ts` (a third requirement-path generator; the workflow path's first; **the requirement path's three generators now run concurrently**, §2), `stages/response-validation.ts` (Stage 10 recomputes the arithmetic), `regression/dry-run-adapter.ts`, `regression/review-packet.ts`, `harness/recordings.ts`, `export/artifact-markdown.ts`; the frontend presenter `ComplexityScore.tsx`; nine requirement recordings and `ew-001` recaptured
**Builds on** D-36 (the scale as specified), D-78/D-79 (the requirement path's generators and the recapture procedure), D-40 (the workflow path's rendered artifacts).

---

## 1. The model scores; the pipeline computes

`docs/09` §1 fixes five factors, a shared 1–5 anchor scale, fixed weights (workflow .25, integration .20, data/logic .20, failure risk .20, operational .15) and the arithmetic that turns factor scores into a 20–100 complexity score. `FR-033` requires that a reader can reconstruct the score from what is shown and that identical inputs score identically. D-36 left open which stage scores the factors.

The answer here: **the factor scores are the generator's judgement at Stage 9**, made against the anchors the fragment states in full, from the same handoff the platform and risk generators receive (the context set, the architecture with its dispositions; on the workflow path, the submitted workflow as observed). **Everything after the factor scores is arithmetic done by the pipeline** — contribution, weighted score, complexity score — never by the model. So:

- the table `FR-033` requires is always present and always correct, because the pipeline renders it from the scores it computed;
- the parser accepts exactly the five factors, each once, integer 1–5, each with a justification, and refuses anything else (a missing factor, a duplicate, a 6, an empty justification);
- Stage 10's `internal_consistency` case for `complexity_score` recomputes the arithmetic from the document's factors and fails a document whose score does not follow from them;
- the artifact is the rendered document — `scale_version`, the five factors with label, score, weight, contribution and justification, `weighted_score`, `complexity_score` — validated against the new published schema before it is emitted.

The fragment states the anchors at 1, 3 and 5 for every factor, distinguishes `failure_risk` (how demanding failure handling makes the design) from the risk register, asks for a justification naming *this* design's parts, and says that identical designs must receive identical scores. The presenter shows the score on an axis whose lowest achievable value is 20 (every factor scores at least 1) and, beneath it, the table with the two totals — `docs/09` §1.4: a score displayed without the table is a defect regardless of whether the number is correct.

## 2. Three generators, concurrently

The requirement path now runs three generators at Stage 9 — platform, risk, complexity — each with its own trace, so the path traces `1, 2, 3, 5, 6, 9, 9, 9, 10, 12`. The workflow path runs one, after the review, so it traces `1, 2, 3, 5, 6, 9, 10, 12` where before it traced no Stage 9 at all; its rendered artifacts (`workflow_recommendation`, `risk_assessment`) attach to that trace.

D-79's live verification measured the cost of running the generators in series: at Opus 5 high effort the requirement path completed in 380 s of its 420 s deadline, with Stage 6 and the two generators taking 94, 99 and 112 s each. A third generator in series would have breached the deadline on an ordinary case. The three generators take the same handoff and none reads another's answer, so **they now run concurrently** (`Promise.all`) and the path's wall time is the slowest generator rather than the sum. What is preserved: each generator's own trace, regeneration and deep validation; the deadline signal cancelling all three together (`FR-094`); and a fixed settlement order — platform, risk, complexity — so the events, the persisted artifacts and the validation records keep the precedence the plan states. What changes: the three traces' completion order is the provider's. The rendered artifacts attach to the last trace to finish. The replay adapter keys on the request, not on order, so every recording replays unchanged.

`API-032` retry is not offered for `complexity_score`, for the same reason as D-79's register: the route decides by artifact type and the same type is generated on two paths — the per-path retry decision stayed a recorded limitation until [D-81](56-D-81-Per-Path-Artifact-Retry.md), which made it.

## 3. What is not changed

- No other fragment, no requirement. The job-description and assessment paths do not run this generator (`AI §9.1` maps complexity to requirement and workflow).
- Platform comparison on the workflow path, roadmap and integration requirements (P1) stay open.

## 4. The gate, walked

1. Fragment authored; `fragments:write` recorded the nineteenth hash; the schema published locally (thirteen at v3); the dry-run adapter answers the generator; a dry run of `br-001` made seven provider-shaped calls and generated six artifacts.
2. **One campaign** (nine requirement cases and `ew-001`, $4.00 ceiling, Sonnet 5 medium): **10 captured, 0 failed, $1.7242**, 64 provider calls. Every planned artifact generated on every case — six on each requirement case, four on the workflow case, one on `br-005`, which halted at Stage 3 as the case expects (confidence 0.62, at the bound). Read-only evaluation: 10 of 10 passed.
3. Admitted; the ten prior recordings superseded with their reasons (`research/regression-superseded/README.md`). Targeted run `--fragment=stage.complexity_assessment` → **`aba7455cd483a8c8`** (nine cases). Fifteen cases → 15 passed → **`corpus-regression:corpus-v2+fragments-v1:20f278148df1d139`**.
4. `fragments:publish --reference=…20f278148df1d139` locally (1 new version, 18 unchanged; 19 active); the same from the new image in production (§5).

Campaign total: **$1.7242**. Every requirement case now carries six artifacts — intent brief, business analysis, architecture recommendation, platform recommendation, risk register, complexity score, plus the diagram — and the workflow case its recommendation, register and score.

## 5. Verification

| Check | Result |
|---|---|
| Arithmetic reproduces `docs/09` §1.4's worked example (weighted 3.50, complexity 70, contributions 1 / .6 / 1 / .6 / .3); the achievable range is 20–100; the parser refuses a missing factor, an out-of-range score, a duplicate, an empty justification; Stage 10 fails a tampered score | ✅ `tests/unit/nie-complexity-assessment.test.ts` (4) |
| Pipeline, harness, real infrastructure, capture, runner, coverage, m11 workflow path with the third Stage 9 call; derived-artifact planner with six requirement artifacts and three workflow artifacts | ✅ pins updated deliberately (three Stage 9 traces, seven provider calls, seven composing stages, usages 41) |
| Full suite, lint, format, typecheck, build; `fragments:check` 19, `schemas:check` 13, `recordings:check` 15 | ✅ 2026-09-10 — 1080 tests, 1076 pass, 0 fail, 4 skipped (one pin corrected: the "no registered schema" test had used `complexity_score` as its unregistered type) |
| Captures, admission, references, replay | ✅ §4 — 15 of 15 reproduce `20f278148df1d139` |
| Production | ⏳ |
