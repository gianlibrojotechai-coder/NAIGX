# D-78 — Stage 6 disposes of every unknown; the requirement path recommends a platform

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; the paid step (recapturing every requirement and assessment recording) ran under a stated ceiling recorded in §5
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** two open items at once, because they change the same fragment and the same recordings. (1) [D-38](13-D-38-Architecture-Unknown-Disposition.md): Stage 6 could cite an `unknown` context element as if it were known, with no field saying whether the design assumed it, excluded the part that depends on it, or deferred it; its remediation — an architecture-level `unknown_disposition` and a parser that refuses an undisposed unknown — was preserved "for when reasoning work resumes". (2) STATUS's open scope decision: the requirement path produced no `FR-034` platform recommendation, the one artifact the owner's decision kept open because it is reasoning work
**Affects:** `prompts/stage/architecture_analysis.md` (the disposition section — every architecture-producing path), `prompts/stage/platform_recommendation.md` (new; manifest now 17), `contracts.ts` (`UnknownDisposition`, `ArchitectureResult.unknownDispositions`, `PlatformRecommendation`, the type in every list), `stages/architecture-analysis.ts` (coverage check), `stages/platform-recommendation.ts` (new parser), `output-schemas.ts`, `prompt.ts`, `stages.ts`, `pipeline.ts` (the requirement branch generates, then renders on the generator's trace; replay keying; `API-032` retry), `db/analysis-result-sink.ts` and two migrations (`architecture_model.unknown_dispositions`, `context_element.ordinal`), `db/architecture-reader.ts` (new, for retry), `orchestrator/analysis-runner.ts`, `stages/response-validation.ts`, `stages/response-assembly.ts`, `stages/derived-artifacts.ts` (dispositions carried on both architecture artifacts), `export/artifact-markdown.ts`, `regression/dry-run-adapter.ts`, `regression/review-packet.ts`, `harness/recordings.ts`; **`ARTIFACT_SCHEMA_VERSION` 2 → 3** (two published schemas gained a field; a published version is immutable); frontend presenter, types and registry; every requirement and assessment recording recaptured
**Builds on** D-38, D-40, D-64, D-70 (the procedure), D-73, D-76, D-77.

---

## 1. The disposition (D-38, closed)

The Stage 6 fragment now instructs, on every path: list every `unknown` context element exactly once in `unknown_disposition`, by its `index`, as `assumed` (with the assumption stated), `excluded` (with what is left out) or `deferred` (with where the design would differ). The parser enforces it as `ArchitectureTraceabilityError` — the class the pipeline regenerates once on, with the addendum naming the undisposed indices — and also refuses an entry for a stated or inferred element, a duplicate, or an index out of range. An absent key reads as an empty list, which is correct only when the context has no unknown; a context with one then fails coverage.

The dispositions are persisted beside the architecture (`architecture_model.unknown_dispositions`, JSON, default `[]`), carried on both architecture artifacts (`unknown_dispositions`, with the element's content when the renderer had the context), shown in the presenters under "How the unknowns were handled" — an artifact stored before D-78 says "not recorded" rather than hiding the section — and re-checked by Stage 10's `internal_consistency` class against the reasoning.

## 2. The platform recommendation (FR-034)

The requirement path's Stage 9 generator, given the context set and the architecture (components, integrations, dispositions) and nothing else. `FR-034` in checkable form:

- **criteria first**, each traced to a context element or a component the architecture has — a criterion traced to neither is refused as invented;
- **`recommended_platform` may be null** — "no platform, do not automate" is a permitted and valuable outcome; the rationale carries it;
- **at least one alternative rejected** with its reason, and the recommendation cannot reject itself;
- **a fit line per component**, by name, none invented and none missing;
- **the knowledge-currency note is required** (`FR-035`: uncertainty about a platform's current capability is disclosed, not asserted).

Neutrality (`PV §3.3`, `AC-032`) is enforced by absence: the schema has no field a preference, partner tier or ranking weight could occupy; the fragment forbids promotional language and default favouritism. `AC-014` — recommendations vary with requirement — is what the nine recaptured requirement cases let a reviewer check.

`DB §4.4`'s `PLATFORM_RECOMMENDATION` table is 1:1 with a Stage 7 *recommendation*, which the requirement path never produces; this artifact is stored like every other artifact (jsonb, validated against its published schema). **Recorded as a deviation from the table design, not from the requirement.**

## 3. Trace and retry shape

On the requirement path the generator runs first and the three rendered artifacts (business analysis, architecture recommendation, diagram) attach to its Stage 9 trace, as the job path's rendered artifacts attach to the portfolio's — so the path still traces `1, 2, 3, 5, 6, 9, 10, 12`, and Stage 9 now carries a provider invocation on this path (the harness and real-infrastructure pins were updated). The assessment path is unchanged.

`API-032` retry regenerates from the stored architecture and context set. That needed one thing the store did not have: the context elements' **order** — Stage 6 grounds and Stage 9 cites by index, and the sink kept the id list in memory only. `context_element.ordinal` now persists it (rows stored before carry 0 and read back in storage order). `readArchitectureForRetry` rebuilds both exactly.

## 4. What is not changed

- No requirement. `FR-034` is implemented as written; `FR-020` gains nothing it did not ask for.
- The workflow path's Platform Comparison (`AI §9.1`: "Requirement, workflow") stays deferred as D-40 left it: reviewing an existing workflow's platform is a different framing and a different fragment.
- `platform_comparison` in the golden corpus's expected artifact sets is served by this `platform_recommendation` artifact; the corpus's `artifact_set` assertion remains deferred.

## 5. The gate, walked

1. Both fragments authored; `fragments:write` recorded the seventeenth hash. Dry runs of all ten cases through the dry-run adapter (which now answers the generator and carries an empty disposition list) exercised the composition: 47 provider-shaped calls, nothing spent.
2. **Paid capture** of the nine requirement cases and `ta-005` into a held folder: Sonnet 5 medium, 47 calls, **$1.1669** under the $6.00 ceiling. `capture` (D-77) reported every case's artifacts as generated — 4 on each requirement case, 1 on the halting `br-005`, 2 on `ta-005`. Read-only evaluation passed all ten, `artifact_generation` included.
3. Every unknown disposed of exactly once (2–6 per case); the platform answers: Zapier, Make ×3, Microsoft Power Automate ×2, **no platform ×2** — recommendations vary with the requirement (`AC-014`), and "do not automate" was reached twice without prompting.
4. Admitted; the ten prior recordings moved to `research/regression-superseded/` with their reasons. Targeted runs: `--fragment=stage.platform_recommendation` → `0e66d334d6693c34`; `--fragment=stage.architecture_analysis` → `6d77a360c6175f97`.
5. The fifteen-case run **failed on br-005**: its fresh Stage 1 answer scored 0.55 against the ≥0.6 bound. Stage 1's fragment is unchanged, so this is sampling variance; recaptured once ($0.0359, confidence 0.75), the first capture superseded with its reason. Fifteen cases → 15 passed → **`corpus-regression:corpus-v2+fragments-v1:420014f023f83f7c`**.
6. `fragments:publish --reference=…420014f023f83f7c` locally (2 new versions, 15 unchanged); the same from the new image in production, after the two migrations (§6).

Campaign total: **$1.2028**.

## 6. Verification

| Check | Result |
|---|---|
| Parser: grounded document; null platform; invented criterion, out-of-range index, unknown component refused; ≥1 rejected, no self-rejection; fit covers every component, none invented; Stage 10 re-check; export order | ✅ `tests/unit/nie-platform-recommendation.test.ts` |
| Disposition: every unknown exactly once; a stated element, a duplicate, an undisposed unknown refused with indices named; absent key with no unknown reads as none | ✅ same suite |
| Pipeline, harness, real infrastructure, runner, capture, replay corpus with the new Stage 9 call and the disposition-bearing fixtures | ✅ pins updated deliberately (Stage 9 is a provider call on the requirement path; five composing stages; the recorded stage set) |
| Full suite, lint, format, typecheck, build; `schemas:check` 12 at v3; `fragments:check` 17; `recordings:check` 15 | ✅ 2026-09-10 — 1070 tests, 1066 pass, 0 fail, 4 skipped |
| Captures, admission, references, replay | ✅ §5 — 15 of 15 reproduce `420014f023f83f7c` |
| Production | ✅ **Production, 2026-09-10:** deployed as image `948838c7ff38` at `12f5af9` (rollback tags `rollback-e3220a2`), both migrations applied by the `migrate` service (`architecture_model.unknown_dispositions`, `context_element.ordinal`), twelve schemas published at v3, `stage.architecture_analysis` and `stage.platform_recommendation` activated under `420014f023f83f7c` (17 active), live mode unchanged. One billed requirement analysis (`br-001`, id `52ef6491-4c7a-408a-a14f-42053316c5e3`) under a temporary allowlisted address, removed afterwards (`deploy/.env` restored byte-for-byte, the address refused 403): **completed in 206 s, 5 provider calls, $0.5620** (platform generator $0.2152); stage traces `1, 2, 3, 5, 6, 9 (platform_recommendation), 10, 12`, every one `success`; the dispositions persisted on the architecture row; the browser received all eleven stream frames in order and the page reported "Produced 5 artifacts: Platform recommendation, Business analysis, Architecture recommendation, Mermaid diagram, Intent brief" |
