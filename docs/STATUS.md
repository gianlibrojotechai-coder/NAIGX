# NAIGX Status

**Last updated:** 2026-09-07
**Maintained as:** the operational source of truth. Where this file and any other document disagree about *current state*, this file wins. It does not override specifications — `02-PRD`, `04-SA`, `05-AI`, `06-DB`, `07-API` remain authoritative for *requirements*, and `12-Sprint-1-Decision-Record` for *decisions*.

---

## Current Position

- **Current sprint:** Sprint 3 (Paths and presentation), entered under a recorded deviation — `docs/12` D-37.
- **Current milestones:** M-12 (Frontend foundation) — first increment shipped. M-10 and M-11 open and unstarted. M-08 unrun and carried from Sprint 2.
- **Overall state.** The `business_requirement` and `job_description` reasoning paths run end to end through eight of twelve NIE stages, persist completely to Postgres, and are retrievable and presentable through the API and a working single-page frontend. One genuine live-provider run has been executed and cost $0.2732. Sprint 2's quality gate was never run, and Sprint 3 proceeds only within D-37's narrow transport-and-presentation boundary. All work since commit `4243bba` is uncommitted: roughly 1,000 lines of backend source, the frontend, one applied migration, and eleven test files. The immediate risk is not technical but bookkeeping — a large, verified, unpushed change set.

---

## Completed

Earned against evidence, not against the roadmap's checkboxes.

| Milestone | Evidence |
|---|---|
| **M-01** Project foundation | 8 boundary checks operational, `8 enforcing · 0 failing`; CI workflow at `.github/`; backend lint/format/test gates all green |
| **M-02** Specification gaps closed | Golden corpus committed — 44 cases across 5 categories in `research/golden-corpus/`; `docs/09`, `docs/10`, `docs/11` exist |
| **M-03** Backend foundation | Fastify app, `/health` with dependency probes, structured logging, request/correlation IDs (`src/app.ts`, `src/http/`) |
| **M-04** Provider independence | Boundary check 8: 3 adapters (anthropic, replay, stub) exercised through the abstraction by `tests/contract/provider-conformance.test.ts` |
| **M-06** Traceability | 323 `stage_trace` and 77 `provider_invocation` rows in the trace store; boundary check 6 confirms every stage module is reachable only through `pipeline.ts`, which traces on success and failure. Analysis `d797492d` was fully diagnosed from its trace without re-running — the `FR-100` claim, demonstrated. |
| **M-09** Regression safety | Boundary check 7; 14 fragments manifest-verified; fail-closed activation gate in `src/regression/activation-gate.ts` |

**Increments completed within Sprint 3** (not milestones in themselves):

- **API-020 / API-021 / API-026** — create, retrieve, poll. `src/routes/analyses.ts`.
- **Orchestrator and composition root** — `src/orchestrator/`, replay default, live explicit, no silent fallback.
- **Job-description persistence** — 7 enums, 5 models, migration `20260906120000_job_description_persistence` applied; `prisma migrate status` reports up to date. Verified by 13 real-Postgres tests.
- **`ARTIFACT_SCHEMA` publication** — `portfolio_suggestions` v1 published (`artifact_schema` = 1 row); `schemas:check` green.
- **M-12 first increment** — single-page frontend: paste → submit → poll → render, with the 8-part hierarchy, provenance legend, null-confidence honesty, and failed/omitted artifact handling.
- **Informed regeneration** — Stage 9 forwards schema violations into its single retry. Offline-covered only; see Non-Claims.

**Defect fixes earned along the way:** jsonb key-order comparison in the schema publisher; `API-020` violating `analysis_exactly_one_owner_check` (every submission 500'd against a real database before this).

---

## In Progress

Nothing is mid-implementation. The working tree is complete and green at every gate; no increment is half-built.

---

## Open

| Item | State |
|---|---|
| **M-05** NIE pipeline operational | **Not met.** 8 of 12 stages implemented (1, 2, 3, 5, 6, 7, 8, 9). Stages 4, 10, 11, 12 are `implemented: false` in `src/nie/stages.ts`. |
| **M-07** Structured generation | **Mechanism met, coverage thin.** Validation is enforced before presentation and only `valid` artifacts are presentable. But one artifact type exists (`portfolio_suggestions`); `risk analysis`, `complexity scoring`, `platform recommendation`, `Mermaid diagram` are unbuilt. |
| **M-10** Classification accuracy ≥95% | **Unstarted and currently unmeasurable** — see Blocked. |
| **M-11** All analysis paths | **2 of 4.** `business_requirement` and `job_description` run. `existing_workflow` (`FR-021`) and `technical_assessment` (`FR-023`) do not — both need new prompt fragments, which D-37 decision 4 forbids. |
| **M-12** Frontend foundation | **Partially earned.** Hierarchy and layered depth done. **Streaming is not** — `API-025` unimplemented, so `FR-041` is unmet and the Sprint 3 exit criteria on stream resumption cannot be attempted. |
| Stage 11 confidence | Deferred by `docs/12` D-33. `confidence_band` is null everywhere and the UI says so. `FR-045` unmet. |
| `VALIDATION_EVENT` attribution | Table exists with correct columns; **0 rows**. Nothing writes it. |
| `analysis.model_version_id` | Written only by `src/harness/run.ts`. Null for every analysis created through the API — `AI-004` drift attribution is being lost. |
| `provider_invocation.attempt_number` | Reports `1` for both Stage 9 attempts; the regeneration does not thread it. |
| Backend binds `0.0.0.0` | `HOST` is a hardcoded constant in `src/index.ts:28` with no env override. Reachable on the LAN. |
| Uncommitted work | 32 entries. Nothing pushed since `4243bba`. |

---

## Blocked

| Blocked | Exact blocker |
|---|---|
| **M-10** classification accuracy | 13 recordings exist, all `br-*` and `un-*`. Measuring ≥95% across a 44-case corpus spanning 5 categories requires capture against the other three types — a live-provider spend, which is deferred by owner decision. |
| **M-11** remaining two paths | `docs/12` D-37 decision 4: "No new prompt fragment may be authored or activated under this deviation." Both paths require new fragments. Unblocking requires either running M-08 or an explicit amendment to D-37. |
| **M-08** closure | Full review needs capture across the three unrecorded types (budget decision, `docs/12` D-33). A **partial** review against the 13 committed `br`/`un` recordings costs nothing and is not blocked. |
| `AC-037` artifact-set testability | `docs/08` Appendix C item 9: unmeasurable until complexity scoring exists. |

---

## Deferred

Deliberate, evidence-backed deferrals.

| Deferred | Decided | Closes when |
|---|---|---|
| **Second live-provider smoke test** for informed regeneration | Owner, 2026-09-07 | NAIGX is otherwise complete. Explicitly not to be run before then. |
| **M-08 formal quality-gate review** | Owner, 2026-09-06 (`docs/12` D-37) | The rubric review is run. Unrun, not failed. |
| **Stage 11 / confidence weights** | `docs/12` D-32, D-33 | The corpus can supply weights; it currently refuses the cap rule. |
| **`API-025` SSE** | Owner, at M-12 scoping | Polling is sufficient for now; `SA AR-06` required the fallback in the same sprint regardless. |
| **`VALIDATION_EVENT` attribution** | `docs/12` D-37 out-of-scope list | A dedicated increment. The live failure of `d797492d` is the argument for doing it. |
| **Schema-as-Output-Contract** | Diagnosis of `d797492d`, 2026-09-07 | Larger change; touches a fragment, so blocked by D-37 decision 4. |
| Authentication, history, export | Roadmap Sprints 4–5 | On plan, not skipped. |

---

## Important Non-Claims

Statements that must **not** be made, regardless of how the work looks.

1. **M-08 is not passed.** The live smoke test completing does not run the rubric. `docs/12` D-37: "unstarted, not passed-with-caveats." No Sprint 2 milestone may be reported as met on the strength of Sprint 3 work.
2. **M-10 and M-11 are not passed by the live smoke test.** One analysis of one job description is not 95% classification accuracy across 44 cases, and is not four paths.
3. **Informed regeneration is not proven against a real provider.** It is covered by five offline regression tests using the replay adapter. Whether a real model acts on the correction is unverified and deferred by decision.
4. **The Sprint 2 quality gate is not claimed as passed**, and its requirements are not waived.
5. **No production deployment exists.** Nothing is deployed anywhere. M-19 is untouched, and there is no hosting, monitoring, or rollback to speak of.
6. **Do not claim production Zapier experience.** Not evidenced by this project or the capability profile.
7. **`FR-041` progressive streaming is not met.** Results arrive whole, after the run finishes.
8. **`FR-045` confidence display is not met.** No confidence is computed; null is displayed honestly as unavailable.
9. **The 44-case corpus is not exercised end to end.** The last regression run (`4ea7eef7`, 2026-08-14) covered 13 cases in `recorded` mode, with `artifact_set`, `confidence_band` and `do_not_automate_conclusion` assertions deferred. Its own attestation: this is "NOT evidence that the current prompt produces these responses."
10. **`FR-004` claimability is unmet.** Anonymous analyses store an owner hash whose token is never issued, so no analysis is claimable.

---

## Current Live Smoke-Test Evidence

The only live-provider run of the product path to date.

| Field | Value |
|---|---|
| Analysis ID | `d797492d-af90-4435-a814-50ba34e657d3` |
| Date | 2026-09-06, 07:41:45Z → 07:45:58Z |
| Execution | **Genuinely live** — startup logged `mode=live, metered=true`; model `claude-sonnet-4-5` via `anthropic` |
| Main analysis | **Completed.** Status `completed`; 21 requirements, 4 decisive technical gaps (`req-5`, `req-8`, `req-9`, `req-10`); verdict `build_first`; 33 context elements |
| Failure | `portfolio_suggestions` failed JSON Schema validation: `/projects/1 must have required property 'why_not_consolidated'` and `/projects/1 must match "then" schema` |
| Attempts | 2 — regeneration fired, both attempts billed identically (3,469 in / 2,907 out), confirming the retry was blind |
| Cost | **$0.2732** across 6 provider invocations |
| Degradation | `degradation_flag = true`; failed artifact stored, content withheld; frontend rendered the failure honestly |
| Outcome | **PARTIAL PASS** |
| Follow-up | Informed regeneration implemented 2026-09-07 and covered by offline regression tests |
| Second live verification | **Deliberately deferred** — see Deferred |

Cumulative provider spend across the whole project to date: **$0.9860** (77 invocations).

---

## Next Recommended Increment

**Commit and push the current working tree.**

Not a feature. Four approved, verified increments plus two defect fixes sit uncommitted on top of `4243bba` — the entire job-description persistence layer, the orchestrator, the M-12 frontend, the jsonb fix, the `API-020` owner fix, and informed regeneration. Every gate is green. The single largest risk to this project right now is that this work is unrecoverable if the working tree is lost, and it is the only item on this page that is blocked by nothing at all.

It also unblocks honest bookkeeping: the roadmap's Appendix B carry-forward register is empty while M-08 is demonstrably carried, and that cannot be corrected against a tree whose state is unrecorded.

After that lands, the next *implementation* increment is a decision between two, and it is the owner's:

- **Run the partial M-08 rubric review** against the 13 committed `br`/`un` recordings. Costs nothing, closes part of the Sprint 2 debt, and is the only path that unblocks M-11.
- **Write `VALIDATION_EVENT`.** Small, self-contained, within D-37's boundary, and directly motivated by `d797492d` — the failure detail currently survives only as free text on a trace row.

---

## Git State

| | |
|---|---|
| Branch | `main` |
| HEAD | `4243bbaedb1905888d0b0e85116cc77e3c438d13` — "Enforce the fragment activation regression gate", 2026-09-06 |
| Working tree | **Dirty.** 32 entries: 15 modified/deleted tracked files, 17 untracked paths |
| Unpushed | All of it. No commit since `4243bba`. |
| Remote | Last push was Sprint 2's seven-commit series |

Modified: `backend/package.json`, `prisma/schema.prisma`, `src/app.ts`, `src/db/analysis-result-sink.ts`, `src/index.ts`, `src/nie/artifact-validation.ts`, `src/nie/pipeline.ts`, `src/nie/ports.ts`, `tests/integration/nie-jd-path.test.ts`, `docs/12-Sprint-1-Decision-Record.md`, and five frontend files (`src/App.css` deleted).

Untracked: the migration directory, `scripts/artifact-schemas.mts`, `src/db/artifact-schema-publisher.ts`, `src/orchestrator/`, `src/routes/analyses.ts`, six test files, and five frontend source files.

---

## Verification

All run 2026-09-07 against the current working tree.

| Gate | Result |
|---|---|
| Backend tests | **491 tests · 489 pass · 0 fail · 2 skipped** |
| Backend typecheck | pass (`src` + tests) |
| Backend lint (oxlint) | pass |
| Backend format (prettier) | pass |
| Boundary checks | **8 enforcing · 0 inactive · 0 failing** |
| Frontend typecheck | pass |
| Frontend lint | pass |
| Frontend production build | pass |
| `prisma migrate status` | Database schema is up to date (3 migrations) |
| `schemas:check` | 1 artifact schema published and matching |

The 2 skips are credential-gated live-provider tests, skipped by design. Database-backed tests **run** — both stores are reachable.

**Database state:** primary — 20 analyses, 1 recommendation, 21 required capabilities, 1 artifact, 1 artifact schema, 261 context elements, 14 active fragment versions. Trace — 323 stage traces, 77 provider invocations, **0 validation events**.

---

## Discrepancies Against Other Documents

Recorded, not silently reconciled. **This file does not amend the roadmap or the decision register.**

1. **Roadmap Appendix B (Carry-Forward Register) is empty** while `docs/12` D-37 records M-08 as carried into Sprint 3. The register should hold that entry and does not.
2. **Sprint 3's stated dependency — "Sprint 2 quality gate passed" — is unmet.** D-37 records this as a deliberate deviation. The roadmap itself is unamended.
3. **D-37's out-of-scope list names "`ARTIFACT` persistence and the `VALIDATION_EVENT` attribution."** `ARTIFACT` persistence was subsequently implemented under an explicit owner decision ("model ARTIFACT now", 2026-09-06). D-37 has not been amended to reflect that. `VALIDATION_EVENT` remains out of scope and unimplemented.
4. **Roadmap Appendix C item 6** lists `AIQ-5` fragment storage as Sprint 1 and open; it was resolved earlier. Appendix C has been stale before on this exact item.
5. **M-05 is listed as a Sprint 1–2 milestone** but 4 of 12 stages remain unimplemented. It is neither claimed nor formally carried forward anywhere.
6. **Sprint 3 exit criteria include stream resumption and a streaming/polling comparison.** `API-025` is not implemented, so two of five exit criteria are currently unattemptable.
