# D-82 — The implementation roadmap: sequenced phases, each naming what it builds, what it depends on, and what exists when it is done

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; the paid step (recapturing the nine requirement cases) ran under a stated ceiling recorded in §4
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `FR-036` (P1: "sequenced implementation phases with dependencies and per-phase outcomes"; `AI §9.1` Implementation Roadmap, requirement path; `AI §9.4` "roadmap phases verified against components"). `MVP §5.3` lists it as the P1 artifact to cut last — "valuable but not load-bearing for the hypothesis" — and it is the first of the four P1 requirement-path artifacts built
**Affects:** `prompts/stage/implementation_roadmap.md` (new; manifest 20), `stages/implementation-roadmap.ts` (new parser), `backend/schemas/implementation_roadmap.schema.json` (new; fourteen schemas at v3), `contracts.ts` (`RoadmapPhase`, `ImplementationRoadmap`, the type on the requirement path's list, on `IMPLEMENTED_ARTIFACT_TYPES` and on `PATH_GENERATED_ARTIFACT_TYPES`), `output-schemas.ts`, `prompt.ts`, `stages.ts`, `pipeline.ts` (a fourth concurrent generator; retry branch; replay keying), `stages/response-validation.ts` (Stage 10 checks phases against the architecture), `stages/response-assembly.ts`, `orchestrator/analysis-runner.ts`, `regression/dry-run-adapter.ts`, `regression/review-packet.ts`, `harness/recordings.ts`, `export/artifact-markdown.ts`; the frontend presenter `ImplementationRoadmap.tsx`; nine requirement recordings recaptured
**Builds on** D-78/D-79/D-80 (the requirement path's generators and the recapture procedure), D-81 (per-path retry, which this type joins).

---

## 1. What the parser makes checkable

`FR-036`'s four acceptance criteria, each enforced rather than requested:

- **Phases are ordered with explicit dependencies.** Phases carry ordinals 1..n in the order given; `depends_on` names ordinals, and a dependency may name only an *earlier* phase — a cycle, a self-dependency or a dependency on a phase not yet built is refused, so the sequence stays a sequence.
- **Each phase states what exists at its completion.** `outcome` is required and non-empty; the fragment asks for the state of the system, not "phase complete".
- **Phases reference components defined in the architecture.** Every component a phase builds must be one the architecture has (the risk register's tolerant match, so a naming near-miss is accepted and an invented part is not), **and every component of the architecture must be built by some phase** — a roadmap that never builds part of the design does not deliver the design at the end of its last phase. `unbuiltComponents` is shared with Stage 10, which recomputes both checks (`AI §9.4`).
- **No calendar estimates unless the input supplied a basis.** An estimate is optional; when present it carries `basis_context_index`, which must resolve to a context element. A figure with no basis is refused at the parser rather than shown. The fragment says most inputs supply no basis and that the honest estimate is then none.

The published schema has no `null`; the request schema makes `estimate` required-but-nullable, and the pipeline drops a null estimate from every phase before validating (the D-79 pattern).

## 2. A fourth concurrent generator

The requirement path now runs four generators at Stage 9 — platform, risk, complexity, roadmap — concurrently (D-80 §2), each with its own trace, so the path traces `1, 2, 3, 5, 6, 9, 9, 9, 9, 10, 12` (six Stage 9 traces once D-83 and D-84 land with it); settlement stays in plan order and the rendered artifacts attach to the last trace to finish. The roadmap joins `PATH_GENERATED_ARTIFACT_TYPES` on the requirement path, so `API-032` retry regenerates it from the stored architecture and context (D-81). Every requirement case now plans seven artifacts.

The cost of the path rises by one Opus call per live analysis (the D-80 campaign priced a generator at roughly $0.02–0.03 per case at Sonnet 5 medium; at Opus 5 high the D-79 live run priced one at $0.24–0.26). Recorded, not resolved: the live path now makes eight provider calls.

## 3. What is not changed

- No other fragment, no requirement. The workflow and assessment paths do not run this generator (`AI §9.1` maps the roadmap to the requirement path).
- The other three P1 requirement-path artifacts — edge cases and practices (`FR-037`), integration requirements (`FR-035`), the executive summary (`FR-038`) — stay open.

## 4. The gate, walked

The D-82 campaign was started, then ordered stopped mid-`br-001` once it was clear D-83 and D-84 would each recapture the same nine cases — **but the stop did not reach the capture process**, which ran to completion in the background: 7 captured, 2 failed, **$1.7759 billed** for recordings that were superseded before admission (they lack the D-83/D-84 stages). Found when its held folder turned up in a commit; removed, and the spend recorded. ⚠️ A background task reported as stopped may leave its child process running: check the log, not the task status. One campaign then served all three records — see [D-84 §4](59-D-84-Integration-Requirements.md). The D-82 targeted run is recorded there.

## 5. Verification

| Check | Result |
|---|---|
| Parser: a grounded, ordered roadmap validates; a phase building something the design lacks refused; a roadmap leaving a component unbuilt refused (near-miss counts as built); ordinals in order; a dependency only on an earlier phase, listed once; a phase must name a component; an estimate only with a basis the input supplied; Stage 10 recomputes the grounding | ✅ `tests/unit/nie-implementation-roadmap.test.ts` (6) |
| Pipeline, harness, real infrastructure, capture, runner, coverage, planner with the fourth Stage 9 call | ✅ pins updated deliberately (four Stage 9 traces, eight provider calls, eight composing stages, usages 47, seven planned artifacts) |
| Full suite, lint, format, typecheck, build; `fragments:check` 22, `schemas:check` 17, `recordings:check` 15 | ✅ 2026-09-10 — 1108 tests, 1104 pass, 0 fail, 4 skipped (the coverage pin made order-insensitive for the concurrent generators) |
| Captures, admission, references, replay | See [D-84 §4–5](59-D-84-Integration-Requirements.md) |
| Production | See [D-84 §5](59-D-84-Integration-Requirements.md) |
