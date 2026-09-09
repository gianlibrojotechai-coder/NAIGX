# D-79 — The requirement path's risk register: generated, against the workflow path's schema

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; the paid step (recapturing the nine requirement cases) ran under a stated ceiling recorded in §4
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `FR-032` (P0: "a risk register with severity, likelihood, affected component, and mitigation"; `PRD §` "architecture, risk, complexity and platform are produced for any non-trivial requirement") on the requirement path. The workflow path has rendered `risk_assessment` from Stage 6W findings since D-40; the requirement path had no findings to render from, and the golden corpus expects the artifact on sixteen requirement cases
**Affects:** `prompts/stage/risk_assessment.md` (new; manifest 18), `stages/risk-assessment.ts` (new parser), `contracts.ts` (`RiskRegister`, the type on the requirement path's list, `PipelineResult.riskRegister`), `output-schemas.ts`, `prompt.ts`, `pipeline.ts` (a third generator; replay keying), `stages/response-validation.ts` (the `risk_assessment` consistency case branches on which path produced it), `stages/response-assembly.ts`, `regression/dry-run-adapter.ts`, `regression/review-packet.ts`, `harness/recordings.ts`; the nine requirement recordings recaptured. **No new schema**: the published `risk_assessment` schema serves both paths
**Builds on** D-40 (the rendered register), D-78 (the requirement path's first generator and the recapture procedure).

---

## 1. One artifact type, two sources

`AI §9.1` lists Risk Assessment for "Requirement, workflow". On the workflow path a review *is* a risk analysis, so the register is rendered from findings and cannot disagree with them. On the requirement path there are no findings — there is a design — so the register is generated, from the same handoff the platform generator receives (the context set and the architecture with its dispositions), against the same published schema. The presenter and the export are unchanged.

What the parser makes checkable (`FR-032`'s acceptance criteria):

- every risk names a component the architecture has, **or an external system one of its components integrates** — a risk against something the design neither has nor touches is the "generic risk" the requirement calls a defect;
- severity and likelihood are integers on the `risk-v1` scales (`docs/09` §2), which the fragment states in full;
- every risk carries a mitigation;
- an empty register must say why (`no_risks_statement`); a populated one must not carry a statement;
- the register is returned ordered by severity × likelihood, highest first.

The fragment asks for coverage of every integration, every fallback that could itself fail, every `assumed` disposition (an assumption is a risk by definition) and every stated threshold — and forbids padding.

Stage 10's `internal_consistency` case for `risk_assessment` now branches: with a workflow review in the reasoning it checks the count against the findings as before; without one, and with an architecture, it checks every risk's component against the architecture's components and external systems.

## 2. Trace, retry and the null

The requirement path now runs two generators at Stage 9 — platform, then risk — each with its own trace, so the path traces `1, 2, 3, 5, 6, 9, 9, 10, 12` (as the job path does on `build_first`); the rendered artifacts attach to the last generator's trace. The pins were updated deliberately.

`API-032` retry is **not** offered for this artifact: the retry route decides by artifact *type*, and on the workflow path the same type is rendered and deterministic. Offering it would either regenerate a rendered register or need a per-path rule the route does not have. A failed requirement-path register therefore reports `retryAvailable: false`, with the route's "deterministic" reason — accurate for the type, imprecise for this path. **Recorded as a limitation**, with the fix being a per-path retry decision.

The published schema has no `null` — an absent statement is absent — while the request schema (constrained decoding) makes every optional field required-but-nullable. The pipeline drops a `null` statement from the wire document before validating it. The first dry runs found this: every generated register failed its schema until it did.

## 3. What is not changed

- No requirement, no schema, no other fragment. The assessment path does not run this generator (`AI §9.1` maps the artifact to requirement and workflow); `ta-005` was not recaptured.
- Complexity scoring (`FR-033`) stays blocked by D-33/D-35/D-36; roadmap and integration requirements (P1) stay open.

## 4. The gate, walked

1. Fragment authored; `fragments:write` recorded the eighteenth hash; the dry-run adapter answers the generator; a dry run of `br-001` made six provider-shaped calls and generated five artifacts.
2. **First campaign** (nine requirement cases, $4.00 ceiling): 4 captured, 4 failed, 1 skipped, **$1.0597**. The D-77 capture refusal did its job — two registers were refused for naming a part the design did not have, one platform answer for companion platforms beside a null recommendation — and the quarantined responses made the diagnosis free: one refusal was a shortened external-system name ("Broker" for "Broker (via email)"), a naming near-miss, not an invented part; one was an "unnamed system"; the platform case was the fragment's silence on the null case. The parser now tolerates the near-miss (`namesDesignPart`: exact, else a parenthetical-stripped, case-insensitive containment), and both fragments say what they had left unsaid. The remaining failures were Stage 1 and Stage 3 sampling (a mis-quoted span, a 0.55 confidence, an unexpected insufficiency halt).
3. **Second campaign** (nine cases, $3.00 ceiling): 8 captured, 1 failed (a mis-quoted span at Stage 3), **$1.2264**. Read-only evaluation: 6 passed; `br-004` halted at Stage 3 again and `br-005` scored 0.55 again.
4. **Third campaign** (`br-004`, `br-009`): both captured and evaluated clean, **$0.3202**. `br-005` was not recaptured: it halts at Stage 3 and composes none of the fragments D-79 touched, so the D-78 recording (confidence 0.75) still reproduces its composition and stays.
5. Admitted; the eight prior recordings superseded with their reasons. Targeted runs: `--fragment=stage.risk_assessment` → `1d0a62c31922f865`; `--fragment=stage.platform_recommendation` → `4c4bd135f0b5fca9`. Fifteen cases → 15 passed → **`corpus-regression:corpus-v2+fragments-v1:f3a702e5885ca15c`**.
6. `fragments:publish --reference=…f3a702e5885ca15c` locally (3 new versions: the risk fragment and the two tightened ones); the same from the new image in production (§5).

Campaign total: **$2.6063**. Every requirement case now carries five artifacts: intent brief, business analysis, architecture recommendation, platform recommendation, risk register, plus the diagram — six planned, six generated.

## 5. Verification

| Check | Result |
|---|---|
| Parser: grounded register validates against the shared schema and is ordered by score; a risk against something the design lacks refused; scales 1–5; mitigation required; empty register must say why; statement forbidden with risks; Stage 10 checks against the architecture on this path | ✅ `tests/unit/nie-risk-register.test.ts` (5) |
| Pipeline, harness, real infrastructure, capture, runner, coverage with the second Stage 9 call | ✅ pins updated deliberately (two Stage 9 traces, six provider calls, six composing stages) |
| Full suite, lint, format, typecheck, build; `fragments:check` 18, `schemas:check` 12, `recordings:check` 15 | ✅ 2026-09-10 — 1076 tests, 1072 pass, 0 fail, 4 skipped |
| Captures, admission, references, replay | ✅ §4 — 15 of 15 reproduce `f3a702e5885ca15c` |
| Production | ⏳ |
