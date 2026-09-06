# NAIGX Status

**Last updated:** 2026-09-07
**Maintained as:** the operational source of truth. Where this file and any other document disagree about *current state*, this file wins. It does not override specifications — `02-PRD`, `04-SA`, `05-AI`, `06-DB`, `07-API` remain authoritative for *requirements*, and `12-Sprint-1-Decision-Record` for *decisions*.

---

## Current Position

- **Current sprint:** Sprint 3 (Paths and presentation) of seven — Sprint 0 through Sprint 6 — entered under a recorded deviation, `docs/12` D-37, **amended 2026-09-07 by [D-39](14-D-39-D-37-Amendment.md)**.
- **Current milestones:** M-12 (Frontend foundation) — first increment shipped. M-10 and M-11 open and unstarted. M-08 unrun and carried from Sprint 2.
- **Overall state.** The `business_requirement` and `job_description` reasoning paths run end to end through eight of twelve NIE stages, persist completely to Postgres, and are retrievable and presentable through the API and a working single-page frontend. One genuine live-provider run has been executed and cost $0.2732. Sprint 2's quality gate was never run. Sprint 3 began within D-37's transport-and-presentation boundary; D-39 has since widened it to a bounded set of reasoning prerequisites, because the gate proved unreachable without them. `FR-034` landed 2026-09-07: Stage 7 now requires stated criteria and a rejected alternative, and the `AIP-4` NOT NULL invariant is restored. That is engineering complete, not evidence complete — no analysis carries that evidence until fragment v3 is activated, which needs a capture nobody has authorised.

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

Nothing is mid-implementation. The working tree is green at every gate and no increment is half-built. The packet audit is stopped rather than paused — 11 packets remain unreviewed by design, not by interruption. Fragment v3 is authored and awaiting an activation decision; that is a deliberate resting state, not work in progress.

---

## Open

| Item | State |
|---|---|
| **M-05** NIE pipeline operational | **Not met.** 8 of 12 stages implemented (1, 2, 3, 5, 6, 7, 8, 9). Stages 4, 10, 11, 12 are `implemented: false` in `src/nie/stages.ts`. |
| **M-07** Structured generation | **Mechanism met, coverage thin.** Validation is enforced before presentation and only `valid` artifacts are presentable. But one artifact type exists (`portfolio_suggestions`); `risk analysis`, `complexity scoring`, `platform recommendation` (the `FR-034` *artifact*, distinct from the Stage 7 criteria/alternatives now implemented), and `Mermaid diagram` are unbuilt. |
| **M-10** Classification accuracy ≥95% | **Unstarted and currently unmeasurable** — see Blocked. |
| **M-11** All analysis paths | **2 of 4.** `business_requirement` and `job_description` run. `existing_workflow` (`FR-021`) and `technical_assessment` (`FR-023`) do not — both need new prompt fragments, and D-39 keeps those paths closed. |
| **M-12** Frontend foundation | **Partially earned.** Hierarchy and layered depth done. **Streaming is not** — `API-025` unimplemented, so `FR-041` is unmet and the Sprint 3 exit criteria on stream resumption cannot be attempted. |
| Stage 11 confidence | Deferred by `docs/12` D-33. `confidence_band` is null everywhere and the UI says so. `FR-045` unmet. |
| **Architecture unknown disposition** ([D-38](13-D-38-Architecture-Unknown-Disposition.md)) | **Specification gap. Remediation now authorised by [D-39](14-D-39-D-37-Amendment.md); activation still gated on a capture.** Stage 6 can cite an unknown context element without recording how it was handled; the output contract has no field for assumed/excluded/deferred. Measured across the 10 architecture-bearing recordings: **71 unknowns, 20 cited (28%)**, citation rate ranging 0–100% between comparable cases, and one recording citing 5 of 5 while acknowledging none. Remediation — an `unknown_disposition[]` field plus a disposition check through the existing regeneration path — may now be authored and tested, but cannot be activated without a capture. |
| `VALIDATION_EVENT` attribution | Table exists with correct columns; **0 rows**. Nothing writes it. |
| `analysis.model_version_id` | Written only by `src/harness/run.ts`. Null for every analysis created through the API — `AI-004` drift attribution is being lost. |
| `provider_invocation.attempt_number` | Reports `1` for both Stage 9 attempts; the regeneration does not thread it. |
| Backend binds `0.0.0.0` | `HOST` is a hardcoded constant in `src/index.ts:28` with no env override. Reachable on the LAN. |
| Uncommitted work | The M-08 reviewer-packet tooling and its generated bundle. Everything else is pushed. |

---

## Blocked

| Blocked | Exact blocker |
|---|---|
| **M-10** classification accuracy | 13 recordings exist, all `br-*` and `un-*`. Measuring ≥95% across a 44-case corpus spanning 5 categories requires capture against the other three types — a live-provider spend, which is deferred by owner decision. |
| **M-11** remaining two paths | D-39 authorises fragment work only for the M-08 prerequisites and explicitly keeps `FR-021` and `FR-023` closed. Unblocking needs a further decision. |
| **M-08** closure — two independent blockers | **(1) No qualifying reviewer.** `docs/10` §4.3 excludes AI review in any capacity, for any criterion; §8 ambiguity A-1 records that the independent reviewer "has not been named" and "requires owner action before M-08". **(2) C-6 has no stored evidence.** The engineering is done; activation and a capture are not. See below. |
| **C-6 — engineering complete, evidence prerequisite not** | The `FR-034` implementation landed 2026-09-07 (see *FR-034 / C-6* below). Stage 7 now requires stated criteria and ≥1 rejected alternative; they persist and reach API-021 and the UI. **C-6 is still not assessable**, because no stored analysis carries that evidence yet: the active fragment is v2, which does not ask for it. Assessability needs activation, then a capture. |
| **C-3 — structurally available on the JD path, not passed** | `job_description` reaches Stages 8–9 and produces `ARTIFACT_PLAN_ENTRY` rows with inclusion and omission reasons — C-3's required evidence. That makes the criterion *assessable* for that path; it is **not a pass**, and a human reviewer still has to judge it. `business_requirement` and `technical_assessment` route to architecture only, so they produce no artifact set and C-3 stays unassessable for them however much is captured. |
| Consequence for §3.5 | Until an activated fragment produces stored criteria and alternatives, **no analysis of any type can be recorded as a rubric pass**, because a seven-of-seven verdict is unreachable. |
| `AC-037` artifact-set testability | `docs/08` Appendix C item 9: unmeasurable until complexity scoring exists. |

---

## Deferred

Deliberate, evidence-backed deferrals.

| Deferred | Decided | Closes when |
|---|---|---|
| **Second live-provider smoke test** for informed regeneration | Owner, 2026-09-07 | NAIGX is otherwise complete. Explicitly not to be run before then. |
| **M-08 formal quality-gate review** | Owner, 2026-09-06 (`docs/12` D-37) | The rubric review is run. **Partially attempted 2026-09-07 and stopped** — see below. Still not passed. |
| **Stage 11 / confidence weights** | `docs/12` D-32, D-33 | The corpus can supply weights; it currently refuses the cap rule. |
| **`API-025` SSE** | Owner, at M-12 scoping | Polling is sufficient for now; `SA AR-06` required the fallback in the same sprint regardless. |
| **`VALIDATION_EVENT` attribution** | `docs/12` D-37 out-of-scope list | A dedicated increment. The live failure of `d797492d` is the argument for doing it. |
| **Schema-as-Output-Contract** | Diagnosis of `d797492d`, 2026-09-07 | Larger change; outside D-39's bounded scope. |
| Authentication, history, export | Roadmap Sprints 4–5 | On plan, not skipped. |

---

## Important Non-Claims

Statements that must **not** be made, regardless of how the work looks.

1. **M-08 is not passed.** The live smoke test completing does not run the rubric. `docs/12` D-37: "unstarted, not passed-with-caveats." No Sprint 2 milestone may be reported as met on the strength of Sprint 3 work. **Nor is it passed, or partially passed, on the strength of the 2026-09-07 packet audit** — those verdicts are AI-authored and inadmissible under `docs/10` §4.3, only 2 of 13 packets were assessed, and C-3/C-6 make a pass structurally unreachable in this sample.
2. **M-10 and M-11 are not passed by the live smoke test.** One analysis of one job description is not 95% classification accuracy across 44 cases, and is not four paths.
3. **No Sprint 2 milestone newly passed on 2026-09-07.** The `FR-034` implementation is engineering, not evidence. **Implementation complete is not evidence complete**: C-6 needs an activated fragment producing stored criteria and rejected alternatives in a real analysis, and none exists. C-3 is *assessable* on the JD path and is **not passed** — a human reviewer must still judge it. M-07 is unchanged; the `platform_recommendation` artifact remains unbuilt.
3. **Informed regeneration is not proven against a real provider.** It is covered by five offline regression tests using the replay adapter. Whether a real model acts on the correction is unverified and deferred by decision.
4. **The Sprint 2 quality gate is not claimed as passed**, and its requirements are not waived.
5. **No production deployment exists.** Nothing is deployed anywhere. M-19 is untouched, and there is no hosting, monitoring, or rollback to speak of.
6. **Do not claim production Zapier experience.** Not evidenced by this project or the capability profile.
7. **`FR-041` progressive streaming is not met.** Results arrive whole, after the run finishes.
8. **`FR-045` confidence display is not met.** No confidence is computed; null is displayed honestly as unavailable.
9. **The 44-case corpus is not exercised end to end.** The last regression run (`4ea7eef7`, 2026-08-14) covered 13 cases in `recorded` mode, with `artifact_set`, `confidence_band` and `do_not_automate_conclusion` assertions deferred. Its own attestation: this is "NOT evidence that the current prompt produces these responses."
10. **`FR-004` claimability is unmet.** Anonymous analyses store an owner hash whose token is never issued, so no analysis is claimable.

---

## FR-034 / C-6 — Engineering Complete, Evidence Prerequisite Not

**Landed 2026-09-07 under [D-39](14-D-39-D-37-Amendment.md) item 2.** The distinction in this heading is the whole point of the section: the code is finished; the evidence C-6 needs does not exist yet.

**Where it went, and why there.** `AI §3.2` has always specified Stage 7's output as including "the criteria applied" and "rejected alternatives with reasons", and `AI-031` makes naming what was rejected a Stage 7 responsibility. Stage 7 was under-implemented against its own specification — nothing new was invented, and `platform_recommendation` was correctly left alone (it is a `business_requirement` artifact per `AI §9.1`, outside this scope).

| Layer | State |
|---|---|
| Contract | `RecommendationVerdict.criteriaApplied` and `alternatives[]` — **done** |
| Parser | Non-empty criteria and ≥1 alternative-with-reason enforced at Stage 7 — **done** |
| Persistence | `criteria_applied` written; `RecommendationAlternative` rows created with ordinals — **done** |
| Schema | `criteria_applied` **restored to NOT NULL** (`AIP-4`, `DD-04`) — **done** |
| API-021 | `criteria_applied` returned beside the existing `alternatives` — **done** |
| Frontend | *Criteria applied* rendered beside the rationale — **done** |
| Tests | 7 new parser tests, 1 new API-021 test, real-Postgres assertions on stored alternatives — **done** |
| **Fragment v3** | **Authored and manifest-recorded. NOT activated.** |
| **Stored evidence** | **None.** No analysis carries criteria or alternatives yet |

**Why the schema changed back.** The job-description persistence migration relaxed `criteria_applied` to nullable alongside the two confidence columns. Only the confidence columns are justified by `docs/12` D-33; criteria are governed by `AIP-4`, which `DB §4.4` calls "the most important constraint in the schema… the database is the enforcement point". The relaxation was a workaround for a Stage 7 that produced no criteria. Stage 7 now produces them, so the invariant is restored rather than worked around.

**The `d797492d` recommendation was backfilled, not deleted.** It is referenced by 24 `context_reference` rows through a deliberately non-foreign-key `referencing_id` (`DB §4.3`), and it belongs to the project's only live-run evidence. The backfill records the absence of captured criteria without inventing any.

⚠️ **The system must not be run against a provider until v3 is activated.** The parser now requires fields the active v2 fragment does not request, so a live or replay JD run would fail at Stage 7. This is the intended state of authored-but-not-activated work, and it is what the activation gate exists to hold.

**What C-6 still needs:** activation (blocked on a clean regression pass reference) → a JD capture (blocked on a spend decision) → stored criteria and alternatives in a real analysis. Only then is C-6 assessable — and assessable is still not passed.

---

## M-08 Partial Review — Attempted and Stopped, 2026-09-07

**M-08 is not passed. Nothing below is a rubric pass, and none of it counts toward one.**

| | |
|---|---|
| Materials | 13 reviewer packets, `research/reviews/m08-partial-corpus-v1/`, generated deterministically from the manifest-verified recordings |
| Packets assessed | **2 of 13** — `RP-07a977a3`, `RP-14769a97`. The audit was stopped by owner decision |
| Verdict authorship | **AI-authored.** `docs/10` §4.3 excludes an AI reviewer "in any capacity, for any criterion", so these are **not admissible rubric verdicts** and are recorded as findings, not as review records |
| Independent human reviewer | Still none. `docs/10` §8 ambiguity A-1 remains open |
| Structural ceiling | C-3 and C-6 have no material in any recording, so under §3.5 **no packet in this set can pass** regardless of quality. §4.1 sampling (≥20 per input type) is also unmet |

**What the attempt produced.** One substantive finding, verified against the data and recorded as D-38 (see Open). Of the two AI-authored findings checked, one headline example was **wrong** — a C-1 "ungrounded margin claim" that rested on reading element id `e7` as index 7 when the citation was 0-based and correct — and one was overstated. The underlying concern survived both times, but only because it was checked against the recordings rather than accepted.

That is the honest summary of the exercise: it found something real, and it demonstrated why §4.3 excludes AI review.

---

## Gate and Deviation State — as of 2026-09-07

The single place to read what is and is not permitted right now.

| | |
|---|---|
| **M-08** | **Not passed.** Not redefined as passed. Not partially passed. |
| **D-37** | Active, **amended by [D-39](14-D-39-D-37-Amendment.md)** |
| **Why amended** | D-37 closed "by running the M-08 review", but the review cannot produce a seven-of-seven pass for any analysis: `C-6` needs `FR-034` output that is unbuilt, and `C-3` needs artifact plans the `business_requirement` and `technical_assessment` paths never reach. The work to fix that was itself reasoning work D-37 forbade — the deviation was circular in practice |
| **Reasoning work** | **Authorised, bounded.** Only D-38 remediation, the minimum change making `FR-034` assessable, and the artifact-planning coverage making `C-3` assessable. Every other reasoning path, and Stages 4/10/11/12, remain closed |
| **Fragment authoring/testing** | Permitted within that scope. `FR-034` authoring is **done**; D-38 is not started |
| **Active recommendation fragment** | **v2** — the version that does not ask for criteria or alternatives. v3 is authored and manifest-recorded, **not activated** |
| **Fragment activation** | **Not permitted.** `DB §4.5` makes activation conditional on a clean regression pass reference, which requires a capture |
| **Provider spend** | **Not authorised.** No capture, no live run, no corpus work. Cumulative spend remains $0.9860 |
| **Human reviewer** | Not secured. `docs/10` §8 ambiguity A-1 still open |
| **2026-09-07 AI packet audit** | **Inadmissible** as M-08 evidence under `docs/10` §4.3. Engineering findings only — it produced [D-38](13-D-38-Architecture-Unknown-Disposition.md) |

**Closing D-39 requires all four conditions in that record** — C-3 assessable, C-6 assessable, a qualifying reviewer with an adequate corpus, and the full seven-criterion review run with its result recorded. Until then no Sprint 2 milestone may be reported as met.

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

**Owner decision: authorise the JD capture and fragment activation, or not.**

`FR-034` is implemented and offline-verified, so the engineering half of D-39's condition 2 is done and condition 1 was already met on the JD path. What remains between here and a runnable M-08 is not code:

1. **Activate fragment v3** — blocked by `DB §4.5`, which requires a clean regression pass reference covering the cases the fragment composes into
2. **Capture the JD corpus** — roughly 10 cases, on the order of £3, and the same run supplies the reference activation needs
3. **Secure a qualifying human reviewer** — `docs/10` §4.3; ambiguity A-1 has been open since the rubric was written
4. **Run the review** and record its result, pass or fail

Steps 1 and 2 are one spend decision. Step 3 is a resourcing decision and is independent of it.

Still authorised under D-39 and not started:

- **D-38 remediation** — `unknown_disposition[]` plus its disposition check. Independent of `FR-034`; also unactivatable without a capture

Still permitted and still non-reasoning, if preferred first:

- `analysis.model_version_id` is never written on the API path — `AI-004` drift attribution is lost on every run
- `provider_invocation.attempt_number` always reports `1`
- The backend binds `0.0.0.0` with no env override
- `API-025` SSE — named in D-37 as in scope; would close `FR-041` and two Sprint 3 exit criteria

`VALIDATION_EVENT` is **not** in that list: D-37's out-of-scope section names it, so it needs an explicit deviation of the kind `ARTIFACT` persistence received.

---

## Git State

| | |
|---|---|
| Branch | `main`, in sync with `origin/main` |
| HEAD | `d9f0479e69f5529aff606b7b55d9e06a919dfb46` — "Record D-37 and add STATUS.md as the current-state source of truth", 2026-09-07 |
| Working tree | **Dirty**, 5 entries — the M-08 reviewer-packet tooling only |
| Unpushed | None. 0 commits ahead of `origin/main`. |

Pushed 2026-09-07 in three commits: `3df4c55` (persistence, publication, orchestrator, API, jsonb fix, `API-020` owner fix, informed regeneration), `edd4401` (M-12 frontend), `d9f0479` (D-37 and this file).

Uncommitted: `backend/package.json` (one script), `backend/src/regression/review-packet.ts`, `backend/scripts/review-packets.mts`, `backend/tests/unit/review-packet.test.ts`, and the generated `research/reviews/` bundle.

---

## Verification

All run 2026-09-07 against the current working tree.

| Gate | Result |
|---|---|
| Backend tests | **524 tests · 522 pass · 0 fail · 2 skipped** |
| Backend typecheck | pass (`src` + tests) |
| Backend lint (oxlint) | pass |
| Backend format (prettier) | pass |
| Boundary checks | **8 enforcing · 0 inactive · 0 failing** |
| Frontend typecheck | pass |
| Frontend lint | pass |
| Frontend production build | pass |
| `prisma migrate status` | Database schema is up to date (3 migrations) |
| `schemas:check` | 1 artifact schema published and matching |
| `fragments:check` | 14 fragments match the manifest (v3 authored, **not activated**) |

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
