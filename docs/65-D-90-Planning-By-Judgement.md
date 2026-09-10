# D-90 — Planning by judgement, and complexity-appropriate depth

**Date:** 2026-09-10
**Status:** Accepted — owner-directed ("proceed with planning by judgement and complexity-appropriate depth … simple requirements should not automatically receive the full artifact set")
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** the largest known-missing-code item the corpus exposed (M-11 measurement, D-89 §1): the pipeline never omitted an artifact by judgement — `FR-017` ("minimal input yields a minimal artifact set"), `FR-020`'s "automation is unwarranted" conclusion, `PV §3.2` over-production, `AC-037` (not met by construction, `research/ac-037-measurement.md`), and the second depth level `docs/12` D-34 deferred
**Affects:** `contracts.ts`, `stages/intent.ts`, `stages/architecture-analysis.ts`, `stages/reasoning-planning.ts`, `stages/derived-artifacts.ts`, `stages/artifact-planning.ts`, `pipeline.ts`, `output-schemas.ts`; `prompts/stage/intent.md` and `prompts/stage/architecture_analysis.md` (**fragment changes — gated**); one migration; `regression/runner.ts`, `regression/pass-reference.ts`, `regression/expectation-conflicts.ts` (new); the intent-brief and business-analysis schemas (optional properties)
**Builds on** D-66 (the intent brief), D-77 (the business analysis), D-89 (the assertion this is measured by), D-34/D-35 (what Stage 5 was reduced to).

---

## 1. The three judgements

The M-11 measurement found the product doing the opposite of its requirements on three inputs the corpus authored to test exactly that: a submitter who said *"I don't want you to design the solution"* got a design; a process that should not be automated got an architecture, a platform, a register and a score; a two-line requirement got the full ten-artifact set. One defect seen from three inputs — Stage 8 copied the path's list — and it needs three judgements, made in this order of precedence:

| # | Judgement | Read at | Signal | What the requirement path plans |
|---|---|---|---|---|
| 1 | **The submitter declined a design** | Stage 2 | `requested_outcome: understanding_only` with a `decline_quote` **verified verbatim against the input** | the business analysis and nothing that designs, chooses or scores a solution; **Stage 6 is not run** |
| 2 | **Automation is unwarranted** (`FR-020`) | Stage 6 | `automation_verdict: { warranted: false, statement }` with an **empty component list** | the business analysis; the statement is what the system states instead of a design |
| 3 | **Minimal depth** (`FR-017`, `AC-037`) | Stage 5 | the input is at or under **200 characters** | the path's minimal set (§2) |

Otherwise the whole path set is planned, as before. Every entry — kept or omitted — carries its reason, and the reason quotes the signal: the submitter's own words, Stage 6's statement, or the character count and the band. `DB §4.4`'s "chose not to" is legible on each row, and a reader of the plan can see which judgement fired without opening a trace.

**Why the signals are shaped this way.** A declined design is a stated fact or it is nothing: the model must copy the submitter's words, the parser checks them against the input (whitespace-insensitive, case-sensitive), and an unverifiable quote earns the one Stage 2 regeneration — the same shape as Stage 6's traceability regeneration (`AI §3.2`). An unwarranted verdict must come with no components (a design of a process the model says should not be automated is rejected) and with a statement (an empty one states nothing); on the assessment path it is refused outright — an assessment evaluates the design it was given. Depth is a character count because `FR-017` wants orchestration rules "explicit and inspectable, not left entirely to model discretion", and a count is the one property of the input that needs no judgement to read.

## 2. The depth rule, and its limits

`MINIMAL_INPUT_CHARACTERS = 200`. Fitted to the corpus and recorded as such: its four minimal cases are 66–83 characters (`br-004`, `ew-004`, `jd-004`, `ta-005`), the shortest non-minimal case is 355 (`br-005`, an insufficiency refusal), and the shortest that expects a full set is 478 (`ta-009`). 200 sits in that gap with room on both sides; `FR-002`'s floor is 50, so the minimal band is 50–200. **It is not a measure of simplicity in general**: a 250-character input naming one trigger and one system still runs at standard depth. That is the limitation this rule states rather than hides; a rule reading Stage 3's element count was considered and not taken, because the corpus's minimal and non-minimal cases overlap on it (`jd-004` extracts 7 stated elements, `br-010` 6).

The minimal sets, per path, are fitted to the four minimal cases and not re-fitted to pass anything else:

| Path | Minimal set | Omitted, with the reason on the entry |
|---|---|---|
| requirement | business analysis, architecture recommendation | diagram, platform, register, score, roadmap, integrations, edge cases, executive summary |
| workflow | workflow recommendation | platform comparison, risk register, score |
| assessment | architecture recommendation, diagram | assessment feedback (`FR-023`'s trade-off defence would reject alternatives on grounds the input did not give) |
| posting | skill-gap analysis | portfolio, interview guidance (`FR-022`: nothing "specific and buildable" from a posting that names tools and nothing else) |

## 3. What changed in the pipeline

- **Stage 2** records `requestedOutcome` and `declineQuote`; the intent brief and the business analysis carry both (D-66, D-77 — the brief says up front whether a design is coming). The read model and the Markdown export state a declined design in the submitter's words.
- **Stage 5** reads the depth from `{ characterCount }` and records the signal with the plan.
- **Stage 6** parses `automation_verdict`; the unwarranted statement is persisted on the architecture row.
- **Stage 8** is `planPathArtifacts` on the requirement, workflow and assessment paths (the posting path's planner gains the depth) and is **traced as a deterministic stage** on every path that reaches it, as `AI` App. A lists it — previously only the posting path recorded it.
- A declined design returns after Stage 3 with the plan and the business analysis: not a halt, the run did what was asked. An unwarranted verdict returns after Stage 6 with no generator called.
- The requirement and assessment paths' results now carry the intent brief in `artifactPlan`, as the other paths already did.

**Two fragments changed** (`stage.intent`, `stage.architecture_analysis`), so every recording from Stage 2 on is stale against the new composition and the gate cannot activate either version without fresh evidence — see §6. **The new keys are required in the request schemas.** They were optional in the first cut, on the `why_not_consolidated` precedent, and the first capture showed why that was wrong: Sonnet 5 omitted `automation_verdict` on `br-002` although the prompt asked for it, and a judgement the model can skip is a judgement that never fires. The parsers still read absence as `design` / warranted — a tolerance for the pre-D-90 recordings, not for new responses.

## 4. What the corpus says, and what it does not

The corpus's frozen expectations for the five contradicting cases are the specification this was built to (`br-003`, `br-004`, `br-010`, `ta-005` — and `jd-008`, which it does not resolve). **No expectation was changed to obtain a pass**, and the thresholds were not re-versioned. Two limits are stated plainly:

- The decline and the verdict are model judgements on the new fragments. Whether the model reads `br-010`'s decline and `br-003`'s once-a-year review the way the corpus author did is a measured fact (§6), not a property of the code.
- The P1 artifacts the corpus froze as omitted (`MVP §5.3`) are still produced at standard depth and reported as superseded expectations (D-89); re-versioning those expectations remains the owner's.

## 5. The expectation-conflict register

`jd-008` expects a portfolio on an `apply_now` verdict; `docs/12` D-29 plans the portfolio only on `build_first`. The corpus author and the design record disagree, and `docs/11` §6.2 makes changing either an owner act. Until D-89 the runner's only options were dishonest — fail the case (blaming the product for following its own record) or change one side. The register (`regression/expectation-conflicts.ts`) adds the honest one: a case whose **only** non-advisory failures are registered is reported as **`conflict`** — counted apart from passed and failed, printed apart, and **named in every pass reference the run issues** (`expectationConflicts`), so a reader of the reference sees the disagreement without opening the run. Three rules keep it from becoming a bypass:

1. the assertion itself still reads `failed` — the register reports, it never relabels;
2. an unregistered failure alongside a registered one fails the case as usual;
3. an entry whose contradiction stops manifesting is reported as stale, so the register cannot outlive the disagreement.

Adding an entry is a recorded engineering act with the decision cited; removing one is the owner's, when the expectation or the decision changes. **D-29 is not changed** by this record.

**The register's first entry was withdrawn the day it was registered.** `jd-008` was entered as "the corpus expects a portfolio; D-29 omits it on `apply_now`". The D-90 recapture returned a **`build_first`** verdict for the same input (the 2026-09-09 recording said `apply_now`), the portfolio was generated, and the case passed `artifact_set` outright — the runner reported the entry as no longer manifesting, which is the rule working. The corpus freezes no verdict for `jd-008`, so the two captures do not measure a conflict with D-29; they measure **Stage 7 verdict variance on one input** (`FR-024`), which is recorded as a finding in `research/m11-artifact-set-measurement.md` and not resolved by this record. The register is empty; the mechanism stays, with the withdrawn entry's history in the file.

## 6. Verification

| Check | Result |
|---|---|
| Unit: the depth rule at its boundaries; each judgement's plan, reasons and precedence; the minimal sets equal the corpus's; the decline verified, unverifiable, absent and stray; the verdict with and without components, on both paths; the posting planner at minimal depth | ✅ `tests/unit/nie-planning-by-judgement.test.ts` (+18) |
| Integration: a declined design skips Stage 6 (3 provider calls, traces `1,2,3,5,8,9,10,11,12`), an unwarranted verdict runs no generator, a minimal assessment omits the feedback with its reason; the runner's `conflict` status, totals, reference and stale-entry report | ✅ `nie-pipeline.test.ts`, `nie-m11-paths.test.ts`, `regression-runner.test.ts` |
| Full suite, lint, typecheck, format | ✅ 2026-09-10 — 1145 tests, **1138 pass, 3 fail, 4 skipped**: the three tests that replay or schema-check every pinned canonical recording, which fail on `jd-002` alone — its recording predates D-90 and could not be recaptured (below). Lint 0 errors, typecheck clean |
| Dry-run capture of the five judgement cases | ✅ free rehearsal: `br-004` 3 generated / 8 omitted, `ta-005` 3 / 1, `jd-008` 4 / 1 (`ew-001` fails in the dry-run adapter, which has no `workflow_review` fixture — pre-existing, not a D-90 regression) |
| **Paid recapture of the 13 canonical cases** (`stage.intent` and `stage.architecture_analysis` changed) | **12 of 13 admitted, $3.4421 in four batches** (ceiling stated at $6.50 before the first; the ceiling refuses to start a case past it and does not cancel one in flight, so the true bound was one case more). Batch 1 aborted on two consecutive generator validation slips ($0.6255, nothing admissible — and showed Sonnet 5 omitting an optional `automation_verdict`, so both keys became required); batch 2 captured 12 ($2.5475; `jd-002` failed Stage 10); batch 3 recaptured `br-005` and failed `jd-002` at Stage 7 ($0.1506); batch 4 failed `jd-002` at Stage 7 again, identically ($0.1185) — sampling stopped there. The three judgement cases fired as designed: `br-003` unwarranted with zero components, `br-010` declined with the verified quote, `br-004` and `ta-005` minimal. `br-005` returned a Stage 1 confidence of **0.55 on both samples** (frozen ≥ 0.6; not sampled a third time). Superseded recordings and the campaign record: `research/regression-superseded/README.md`; held evidence and quarantined failures: `research/regression-pending/d90-2026-09-10/` |
| M-11 and `AC-037` re-measured (`npm run measure:artifact-sets`) | **`artifact_set` agrees on 14 of 14 replayable cases** ([research/m11-artifact-set-measurement.md](../research/m11-artifact-set-measurement.md)); **`AC-037` not shown met** by its prescribed measure — the cases that plan fewer artifacts carry no complexity score, and the depth rule is a length rule ([research/ac-037-measurement.md](../research/ac-037-measurement.md)). Two assertions learned the D-90 outcomes: `run_completeness` accepts a declined design without an architecture and an unwarranted one without components; a fixture-builder defect that could not key Stage 3 for a declined intent was fixed (br-010 replayed as "no recorded response" until it was) |
| Default regression run (`regression:run`, 13-case vertical) | **10 passed · 1 failed (`br-005`, confidence bound) · 2 blocked (no recording) · no pass reference issued.** The D-90 fragments are candidates only |
| Production | ⚠️ **NOT deployed.** Production stays on `48958722db57` (D-89) with the pre-D-90 fragments active. What would unblock it: `br-005`'s bound — a classification-fragment change with fresh evidence, or a `docs/11` §6.2 re-versioning (the owner's) — and, for any selection naming it, a `jd-002` recording |
