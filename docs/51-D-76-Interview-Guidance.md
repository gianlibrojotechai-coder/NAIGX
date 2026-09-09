# D-76 — Interview Guidance: the second Stage 9 generator, through the fragment gate

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction ("keep on building … no need to ask for my permission"); the paid steps ran under a stated $2.00 ceiling and cost $0.6560 in three captures
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `AI §9.1` gives the job-description path an *Interview Guidance* artifact — "architectural competencies the posting implies; derived from the posting, not generic". It was the last D-29 "no generator" omission row on the path. It also discharges the D-29 outstanding item *"Stage 9 fragment resolution is per-generator … must become per-generator resolution when a second generator lands"*: the registration is the map entry `STAGE_FRAGMENT_KEYS.interview_guidance`, exactly as `workflow_review` registered Stage 6's second prompt
**Affects:** `prompts/stage/interview_guidance.md` (new fragment, manifest now 16), `backend/schemas/interview_guidance.schema.json` (tenth schema, v2), `contracts.ts` (types, `IMPLEMENTED`, `GENERATED`), `output-schemas.ts` (constrained-decoding shape), `prompt.ts` (fragment key), `stages/interview-guidance.ts` (parser), `stages/artifact-planning.ts` (planned on both verdicts), `pipeline.ts` (generator on both job-path branches; `API-032` retry by type), `orchestrator/analysis-runner.ts` (passes the type), `stages/response-validation.ts` (grounding re-check), `stages/response-assembly.ts`, `export/artifact-markdown.ts`, frontend type guard, presenter and registry; two recordings recaptured and admitted
**Builds on** D-29, D-64 (the gate), D-70 (the procedure), D-72, D-75.

---

## 1. What it generates, and what makes it "derived from the posting"

Given the Stage 7 recommendation and nothing else — requirements with ids, the matches with the capability ids the operator may cite, the gaps, the verdict — the generator returns ranked competencies, each with the requirement ids it is derived from, why *this* posting implies it, what to be ready to explain, a likely question, the capabilities to cite, and a standing (`evidenced` or `gap`, with how to handle a gap honestly), plus a framing paragraph.

The `AI §9.1` validation rule, "derived from the posting, not generic", is enforced three times: the fragment forbids the generic canon and requires `derived_from`; the parser refuses a competency whose `derived_from` names a requirement Stage 7 did not extract, or whose `evidence_to_cite` names a capability Stage 7 did not match, or whose standing disagrees with its citations; and Stage 10's `internal_consistency` class re-checks both id sets against the recommendation at validation time. `rank` is a total order from 1, as the portfolio's is.

It is planned on both verdicts: an `apply_now` operator is about to be interviewed; a `build_first` operator will be once the build is done. The planner now has no "no generator" row left on the job-description path.

## 2. Trace and event shape

Each provider-called generator has its own Stage 9 trace, keyed by generator (`portfolio_suggestions`, `interview_guidance`), the way Stage 6's two generators are keyed. The rendered artifacts attach to a generator's trace: on `build_first` the job path traces `1, 2, 3, 5, 7, 8, 9, 9, 10, 12` (portfolio, then interview guidance); on `apply_now` the interview guidance's trace carries the D-75 gap-analysis rendering, so the path traces `1, 2, 3, 5, 7, 8, 9, 10, 12`. The interview guidance is announced last (`plan`, portfolio `artifact`, gap-analysis `artifact`, the n8n `plan`, then `artifact`). The pinned lists were updated deliberately.

## 3. The gate, walked

1. Fragment authored; `fragments:write` recorded the sixteenth hash.
2. **Paid capture** of `jd-002` and `jd-008` against the candidate composition, held outside the canonical store (`research/regression-pending-d76`): Sonnet 5 medium, 11 provider calls, **$0.2463 + $0.1852 = $0.4316**, under the $2.00 ceiling. `jd-002` produced 9 competencies (2 evidenced, citing `cap-004`/`cap-005`; 7 gaps), `jd-008` 5 (2 evidenced, 3 gaps); every `derived_from` resolved, every citation was a matched capability, every standing agreed with its citations — the parser accepted both at capture time, and `regression:evaluate` passed both read-only.
3. Admitted: the prior recordings moved to `research/regression-superseded/` with their reasons (`jd-002-pre-D-76-2026-09-10.json`, `jd-008-pre-D-76-2026-09-10.json`); the manifest rewritten (15 recordings).
4. Targeted run `--fragment=stage.interview_guidance` → 2 passed → `19f89fb8a3433584`; all fifteen → 15 passed → `b539f5bccb7c0581`. **Both superseded the same hour** — see §4: the first `jd-002` capture's *portfolio* answer was one the parser rejects, and neither run could see it.
5. **Recapture of `jd-002`** ($0.2244; one project claiming the four eligible gaps, six-step n8n plan; eight competencies, one evidenced) — parser-checked directly before admission this time. The first D-76 capture moved to `research/regression-superseded/jd-002-D-76-first-capture-2026-09-10.json` with its reason. Targeted run → 2 passed → **`corpus-regression:corpus-v2+fragments-v1:be3b5a805ba95031`**; all fifteen → 15 passed → **`corpus-regression:corpus-v2+fragments-v1:0294795b4da49f78`** (a new reference: the two job recordings changed, so `d1b67b9017b86257` is no longer the run this corpus reproduces). The replay-corpus suite then served all 15 recordings, 56 fixtures, and the merged adapter ran `jd-002` through the production pipeline with every planned artifact `generated`.
6. `fragments:publish --reference=…be3b5a805ba95031` locally (the row first activated under `19f89fb8a3433584` is re-referenced); the same from the new image in production (§6).

## 4. Two findings in the gate, recorded

**A new stage is invisible to the runner.** Before the old recordings were replaced, `regression:run --case=jd-002 --case=jd-008` **passed** against the new pipeline. `run_completeness` judges a run against the stages the recording holds, and `composition_mismatch` compares the compositions of recorded stages only — so a stage *added* to a path is invisible to both. A changed fragment invalidates a recording; a new fragment on a path does not. The exploratory run record was deleted rather than kept as evidence of anything.

**A parser-rejected artifact is invisible to the runner and to capture.** The first D-76 capture of `jd-002` recorded a portfolio answer with a bogus second project ("(merged) — no standalone project required") that the redundancy rule refuses. The capture tool stores provider responses whether or not the artifact parsed; `artifact_set` is a deferred assertion; so the targeted run and the fifteen-case run both **passed** on a recording whose Stage 9 evidence was a labelled failure. It was caught by `tests/unit/replay-corpus.test.ts` test 3, which runs a served case through the production pipeline and refuses a `failed` portfolio — the test that exists because of the earlier "recorded answer never keyed" defect. The recapture was parser-checked directly before admission.

The second is closed in the same record: `captureCase` now refuses a run whose planned artifact ended `failed` (`CaptureArtifactError` — the paid responses are quarantined like any failure, nothing is written) and reports each case's artifact outcomes (`tests/integration/regression-capture.test.ts`, two tests). The first remains runner work, listed as follow-up: the recording should carry the path's composed stage-key set, so an unrecorded stage reads as `composition_mismatch`.

## 5. What is not changed

- No other fragment, and no recording outside the two job cases. The thirteen other recordings reproduce their compositions.
- No requirement. `FR-022` is served by one more of its named artifacts.
- The thin point stays thin, and gets a little thinner: `stage.interview_guidance` rests on **two** recordings, both from one capture each.

## 6. Verification

| Check | Result |
|---|---|
| Parser: grounded document parses and validates; unknown requirement id refused; unmatched capability refused; standing/citation disagreement refused; missing gap handling refused; rank total order; empty list refused; Stage 10 re-check | ✅ `tests/unit/nie-interview-guidance.test.ts` (7) |
| Output-schema dialect: the new entry uses only supported keywords; every admitted recording's Stage 9 outputs validate against the relaxed request schemas | ✅ `tests/unit/output-schemas.test.ts` |
| Planner: planned on both verdicts; job path end to end on both verdicts with the fixture; trace and event pins | ✅ `nie-artifact-planning`, `nie-jd-path` (24) |
| Fragment gate: 16 fragments match the manifest; every composer key exists | ✅ |
| Paid captures ($0.4316 + $0.2244 = $0.6560), evaluation, admission, targeted and full references | ✅ §3 |
| Replay corpus: 15 served, 56 fixtures, `jd-002` through the production pipeline with every planned artifact generated | ✅ `tests/unit/replay-corpus.test.ts` |
| Full suite, lint, format, typecheck, build; `fragments:check` 16, `schemas:check` 10, `recordings:check` 15 | ✅ 2026-09-10 — 1057 tests, 1053 pass, 0 fail, 4 skipped |
| Production: image, tenth schema, fragment activated under the targeted reference, one billed job-description run | ⏳ |
