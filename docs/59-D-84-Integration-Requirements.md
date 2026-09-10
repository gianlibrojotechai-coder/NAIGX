# D-84 — Integration requirements: every system the design touches, with constraints labelled by provenance and uncertainty disclosed

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; the paid step (one campaign recapturing the nine requirement cases for D-82, D-83 and D-84 together) ran under a stated ceiling recorded in §4
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `FR-035` (P1: "the required integrations and the API capabilities each demands"; `AI §9.1` Integration Requirements, requirement path; "blocked partly by `O-4`" — the knowledge-currency mitigation D-78 established for the platform recommendation is reused). With D-82 and D-83 this completes the requirement path's `AI §9.1` set but for the executive summary (`FR-038`)
**Affects:** `prompts/stage/integration_requirements.md` (new; manifest 22), `stages/integration-requirements.ts` (new parser), `backend/schemas/integration_requirements.schema.json` (new; sixteen schemas at v3), `contracts.ts` (`INTEGRATION_DIRECTIONS`, `CONSTRAINT_PROVENANCES`, `IntegrationRequirement(s)`; the type on the requirement path's list, on `IMPLEMENTED_ARTIFACT_TYPES` and on `PATH_GENERATED_ARTIFACT_TYPES`), `output-schemas.ts`, `prompt.ts`, `stages.ts`, `pipeline.ts` (a sixth concurrent generator; retry branch; replay keying), `stages/response-validation.ts`, `stages/response-assembly.ts`, `orchestrator/analysis-runner.ts`, `regression/dry-run-adapter.ts`, `regression/review-packet.ts`, `harness/recordings.ts`, `export/artifact-markdown.ts`; the frontend presenter `IntegrationRequirements.tsx`; nine requirement recordings recaptured
**Builds on** D-78 (the knowledge-currency note; criteria traced to context), D-79 (the tolerant match), D-82/D-83 (the generator pattern), D-81 (per-path retry).

---

## 1. What the parser makes checkable

`FR-035`'s acceptance criteria, each enforced:

- **Each integration names the system, purpose, and direction.** `system` must be an external system the architecture names and `component` the component that integrates it (tolerant match, so "Xero" covers "Xero (accounting API)"); `direction` is one of `inbound`, `outbound`, `bidirectional` and must agree with the component's stated direction when it states one of the three. **Every external system the architecture names must be covered** — integration requirements that omit one of the design's integrations are incomplete — and a design with no external system says so in `no_integrations_statement`, and only then. `uncoveredSystems` and `integrationOf` are shared with Stage 10.
- **Known constraints are stated where applicable, labelled by provenance.** A constraint is `stated` (and cites `context_index`, which must resolve) or `general_knowledge` (and cites nothing) — the second is exactly the knowledge `O-4` says goes stale, and the always-required `knowledge_currency_note` covers it, as it does for the platform recommendation.
- **Uncertainty about a platform's current capability is disclosed rather than asserted.** `uncertainties` is a required list per integration — what the builder must verify before relying on it — and the fragment forbids asserting an unsure capability as required-and-available. `capabilities_required` (at least one) is what the API must offer, stated as operations, triggers, data and guarantees.

The published schema has no `null`; the request schema makes the statement and a constraint's `context_index` required-but-nullable, and the pipeline drops both before validating.

## 2. Six concurrent generators, one campaign

With D-82 and D-83 the requirement path runs six generators at Stage 9 concurrently (D-80 §2), so the path traces `1, 2, 3, 5, 6, 9, 9, 9, 9, 9, 9, 10, 12` and plans nine artifacts — business analysis, architecture recommendation, platform recommendation, risk register, complexity score, implementation roadmap, integration requirements, edge cases and practices, diagram — ten with the rendered executive summary of [D-85](60-D-85-Executive-Summary.md), which follows the same day. Each is retryable on this path (D-81).

**Cost, recorded.** A live requirement analysis now makes ten provider calls, six of them at Stage 9. Concurrency keeps the wall time at the slowest generator, but the money is additive: at Opus 5 high effort the D-79 live run priced a generator at about $0.24–0.26, so a requirement analysis is now roughly $1.9–2.1 against a $6.00 day cap — about three analyses a day. The caps are the owner's configuration and are not changed here.

**One campaign for three records.** The D-82 campaign was ordered stopped mid-`br-001` once it was clear D-83 and D-84 would each need the same nine cases recaptured — but the stop did not reach the capture process, which ran on to **7 captured, 2 failed, $1.7759**, all superseded before admission (D-82 §4). Bundling the three still saved one campaign. The recapture covers all three fragments; the targeted runs are per fragment.

## 3. What is not changed

- The workflow and assessment paths do not produce this artifact (`AI §9.1`). No other fragment or requirement.
- The executive summary (`FR-038`) is the last of the requirement path's `AI §9.1` set and is rendered, not generated, by [D-85](60-D-85-Executive-Summary.md).

## 4. The gate, walked

1. Three fragments authored (D-82, D-83, D-84); `fragments:write` recorded the twentieth to twenty-second hashes; three schemas published locally (sixteen at v3); the dry-run adapter answers all three generators; a dry run of `br-001` made ten provider-shaped calls and generated nine artifacts.
2. **First campaign** (nine requirement cases, $5.00 ceiling, Sonnet 5 medium): **aborted after two consecutive failures, $0.6480 billed for nothing admissible.** Both cases generated every artifact but the integration requirements, and the quarantined responses made the diagnosis free:
   - `br-001` was **a defect in this record's parser**: the integration-to-component match compared the component name against the whole design part — name *or* external system — so "Xero via Xero Sync" resolved to "Duplicate Check", whose external system is also Xero, and the direction check then contradicted it. The match now compares the component against component names only and the system against external systems only, preferring an exact name; pinned by a two-components-one-system test.
   - `br-002` was **the model labelling the design's own failure handling as `stated` constraints with no citation** ("on Stripe API failure, submission is retried with backoff"). The fragment now says a constraint is a property of the external system, not of this design, that `stated` requires the context index, and that what cannot be pointed at is general knowledge; the parser refuses the uncited label with a message that says which of the two it should have been.
   Re-parsed against the fixed parser, `br-001`'s quarantined answers pass all three new generators; `br-002`'s integration answer is refused for the citation, as intended — the fragment change is what addresses it.
3. **Second campaign** (nine cases, $5.00 ceiling): **5 captured, 3 failed, 1 skipped, $1.3765** — aborted by the two-consecutive-failures guard. The failures were sampling: two Stage 3 mis-quoted spans (`br-003`, `br-009`), and `br-010`'s edge cases naming the literal field `external_system` as a component, which the parser refused as designed. Read-only evaluation of the five: `br-004` halted at Stage 3 (insufficiency, as in D-79) and `br-005` scored 0.55 (as in D-78) — both sampling, both recaptured; `br-001`, `br-002`, `br-007` admitted. **No fragment was changed** for `br-010`: a one-off slip is not a prompt defect, and changing the fragment would have invalidated the three good captures.
4. **Third campaign** (`br-003`, `br-004`, `br-005`, `br-009`, `br-010`, `br-011`; $3.00 ceiling): **5 captured, 1 failed, $1.2432**; all five evaluated clean and admitted. `br-003` failed at Stage 3 again with the same span — the model quoting "It feels manual" for the input's "it feels manual", a capitalisation the D-19 exact-span rule refuses.
5. **Fourth campaign** (`br-003` alone; $1.00 ceiling): **captured, $0.2415**, ten artifacts, evaluated clean, admitted.
6. Admitted; the nine prior recordings superseded with their reasons. Targeted runs: `--fragment=stage.implementation_roadmap` → `53943a31449b7c49`; `--fragment=stage.edge_case_analysis` → `abe111f65fcbc226`; `--fragment=stage.integration_requirements` → `3ac9000d238acbd1` (eight cases each). Fifteen cases → 15 passed → **`corpus-regression:corpus-v2+fragments-v1:89613348d27b3d4f`**.
7. `fragments:publish --reference=…89613348d27b3d4f` locally (3 new versions; 22 active); the same from the new image in production (§5).

Campaign total for the three records: **$3.5092** ($0.6480 + $1.3765 + $1.2432 + $0.2415), plus the D-82 campaign that ran on after its stop, **$1.7759** — $5.2851 for the three records in all. Every requirement case now carries ten artifacts.

## 5. Verification

| Check | Result |
|---|---|
| Parser: grounded, complete requirements validate; an integration the architecture does not name refused; an uncovered system refused (a shortened name covers it); direction must agree; a stated constraint cites the context and general knowledge does not; an uncited `stated` label refused with the alternative named; two components on one system resolve by component name; at least one capability; no external system says so and only then; Stage 10 recomputes grounding and coverage | ✅ `tests/unit/nie-integration-requirements.test.ts` (7) |
| Pipeline, harness, real infrastructure, capture, runner, coverage, planner with six Stage 9 calls | ✅ pins updated deliberately (six Stage 9 traces, ten provider calls, ten composing stages, usages 59, nine planned artifacts) |
| Full suite, lint, format, typecheck, build; `fragments:check` 22, `schemas:check` 17, `recordings:check` 15 | ✅ 2026-09-10 — 1108 tests, 1104 pass, 0 fail, 4 skipped (the coverage pin made order-insensitive for the concurrent generators) |
| Captures, admission, references, replay | ✅ §4 — 15 of 15 reproduce `89613348d27b3d4f`; eight of eight on each targeted run |
| Production | ✅ **Deployed, 2026-09-10:** image `06633fea23a2` at `8afa2bc` (rollback tag `rollback-dd55cd9`, the D-80 image), migrations a no-op, four schemas published (seventeen at v3: roadmap, edge cases, integration requirements, executive summary), the three fragments activated under `89613348d27b3d4f` (22 active), live mode unchanged; health 200, the live bundle carries the four presenters. ✅ **Live, 2026-09-10 00:01 UTC:** one billed requirement analysis (`br-001`, id `221a8e4c-693c-4853-a89d-6e1cfedaa55b`) under a temporary allowlisted address: **completed in 280 s, ten provider calls, $1.5622**, the page reported "Produced 11 artifacts: Intent brief, Platform recommendation, Risk assessment, Executive summary, Business analysis, Architecture recommendation, Complexity score, Implementation roadmap, Integration requirements, Edge cases and practices, Mermaid diagram", seventeen stream frames received in order; the row carries band `medium` with its seven factors. Both addresses were removed afterwards (403 at sign-in for each; `deploy/.env` owner-only, the backend restarted with it). |
