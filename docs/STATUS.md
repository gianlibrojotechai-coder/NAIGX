# NAIGX Status

**Last updated:** 2026-09-07
**Maintained as:** the operational source of truth. Where this file and any other document disagree about *current state*, this file wins. It does not override specifications — `02-PRD`, `04-SA`, `05-AI`, `06-DB`, `07-API` remain authoritative for *requirements*, and `12-Sprint-1-Decision-Record` for *decisions*.

---

## Current Position

- **Current sprint:** Sprint 5 (Persistence, identity, instrumentation) of seven — Sprint 0 through Sprint 6. Sprint 3 was entered under a recorded deviation, `docs/12` D-37, **amended 2026-09-07 by [D-39](14-D-39-D-37-Amendment.md)**; its exit criterion is still not claimed, and Sprint 3 milestones are carried rather than closed.
- **Sprint 5, most recent first:** **M-20 (Performance) — measured, NOT passed.** `NFR-003`/`004`/`005` are measured and passing; ⚠️ `NFR-001`/`NFR-002` — the two the milestone actually names — are **UNMEASURED**, because both are provider-dominated and every run is replay under the no-spend constraint ([D-58](33-D-58-Representative-Load.md), [the log](performance/M-20-LATENCY-LOG.md)). **M-19 (Deployment) — all four phases built, NOT passed; nothing is deployed anywhere.** **M-18 (Security) — reviewed, not passed.** **M-17 (Accessibility) — implemented, manual walk unwalked.** **M-16 (Instrumentation) — complete** on the seven automatable metrics.
- **⚠️ Sprint 5 has no remaining code increment.** All four outstanding items need a human, a host, or an authorisation — see Next Recommended Increment. ⚠️ **SUPERSEDED for M-20, 2026-09-09:** on the owner's instruction, [D-66](41-D-66-Intent-Brief-Early-Artifact.md) added the **intent brief** — an artifact rendered from the Stage 2 intent record the moment Stage 2 completes, on every reasoning path — the one route the latency decomposition found to `NFR-001` **as written**. Implemented, gate-green, verified on all four paths in replay; **not yet deployed and not yet measured live**, so `NFR-001` stays unmet and M-20 stays open.
- **Current milestones:** **M-15 (Authentication and history) — implemented across all seven planned phases and verified live.** The milestone line is "analyses persist and retrieve exactly; deletion permanent and verified", and `DB §12.2`'s mandated deletion-completeness test is written and passing. M-14 (Degradation) — **complete**. **Sprint 4's deliverable list is now complete**: refusal handling (`API §9.3`), `FR-006` input persistence and `FR-014` classification correction all landed 2026-09-07. M-13 (Export) — **Markdown and PDF both built and gate-green**, under three recorded deviations; `SA AQ-3` is resolved by [D-43](18-D-43-PDF-Rendering-Approach.md). M-12 (Frontend foundation) — **implementation complete, not demonstrated**: hierarchy, layered depth, streaming and all five artifact presenters are built; `FR-045` stays partial under D-33, and the Sprint 3 exit criterion is not claimed. M-11 (All analysis paths) — the authorised scope is implemented, with documented deferments; the milestone is earned by measurement, and no path has been measured. M-10 open and unstarted. M-08 unrun and carried from Sprint 2.
- **Overall state.** All four reasoning paths — `business_requirement`, `job_description`, `existing_workflow`, `technical_assessment` — now run end to end through eight of twelve NIE stages and persist to Postgres. `business_requirement` and `job_description` are additionally retrievable and presentable through the API and a working single-page frontend; the two paths M-11 added are exercised offline only, because their prompt fragments are inactive under D-39. One genuine live-provider run has been executed and cost $0.2732. Sprint 2's quality gate was never run. Sprint 3 began within D-37's transport-and-presentation boundary; D-39 has since widened it to a bounded set of reasoning prerequisites, because the gate proved unreachable without them. `FR-034` landed 2026-09-07: Stage 7 now requires stated criteria and a rejected alternative, and the `AIP-4` NOT NULL invariant is restored. That is engineering complete, not evidence complete — no analysis carries that evidence until fragment v3 is activated, which needs a capture nobody has authorised. **Sprint 4 has since delivered M-14 degradation, M-13 export in both formats, and `API §9.3` refusal handling**, all without provider spend: a completed analysis can be exported as a self-contained Markdown document or as a typeset PDF with its diagram rendered, and each artifact copied individually — through one server-side serialiser shared by all three. **M-13 is engineering complete**; what remains on it is operational and is stated as such below. Three deviations govern that work — D-41 permits anonymous export and withholds the `M-4` metric, D-42 removes the response fields that metric would have identified, and [D-43](18-D-43-PDF-Rendering-Approach.md) resolves `SA AQ-3` in favour of a headless system browser, which is what finally renders the Mermaid diagram that no document library can.

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
| **M-09** Regression safety | Boundary check 7; 15 fragments manifest-verified; fail-closed activation gate in `src/regression/activation-gate.ts` |
| **M-19** Deployment — **CLOSED 2026-09-09** | Criterion (`docs/08`): *production deploy with monitoring, alerting, verified rollback.* **Deploy:** `https://naigx.tech`, Let's Encrypt TLS, readiness 200, 15 fragments active under `d4abcd42626452df`, 5 schemas published, all four paths completing recorded inputs. **Monitoring:** Prometheus on the host scrapes `backend:3000/internal/metrics`, `health: up`. **Alerting:** one owner-authorised test alert delivered to the configured ntfy receiver in 30 s, verified by reading the topic back. **Verified rollback:** production drill `1da10e3` → `56d7269` → forward, ~1.7 s / ~2.0 s outage, all four D-50 §4 criteria — [ROLLBACK-DRILL-LOG](deployment/ROLLBACK-DRILL-LOG.md). Plus the D-51 §4 restore drill on production data from staging **and** from the off-site copies — [RESTORE-DRILL-LOG](deployment/RESTORE-DRILL-LOG.md). ⚠️ Closed in **replay** mode: the instance serves the 15 corpus inputs (D-62 §5). ⚠️ Not exercised: a rollback across a migration; device-level receipt of the alert is the owner's to confirm. |

**Increments completed within Sprint 3** (not milestones in themselves):

- **API-020 / API-021 / API-026** — create, retrieve, poll. `src/routes/analyses.ts`.
- **Orchestrator and composition root** — `src/orchestrator/`, replay default, live explicit, no silent fallback.
- **Job-description persistence** — 7 enums, 5 models, migration `20260906120000_job_description_persistence` applied; `prisma migrate status` reports up to date. Verified by 13 real-Postgres tests.
- **`ARTIFACT_SCHEMA` publication** — 5 artifact types published v1 (`portfolio_suggestions`, `workflow_recommendation`, `risk_assessment`, `assessment_feedback`, `mermaid_diagram`); `schemas:check` green.
- **M-12 first increment** — single-page frontend: paste → submit → poll → render, with the 8-part hierarchy, provenance legend, null-confidence honesty, and failed/omitted artifact handling.
- **Informed regeneration** — Stage 9 forwards schema violations into its single retry. Offline-covered only; see Non-Claims.
- **M-11 authorised scope** ([D-40](15-D-40-Existing-Workflow-Module-Mapping.md)) — the two remaining paths implemented. Stage 6 gained a second generator (`workflow_review`), the architecture contract gained accepted trade-offs and named rejected approaches on the assessment path, and four artifact types were built: Workflow Recommendation, Risk Assessment, Assessment Feedback, Mermaid Diagram. All four are *rendered* from reasoning already done rather than generated, so they cost nothing and cannot disagree with their source. Findings persist as `RISK_ITEM` rows with **no migration** — D-40 records why. 5 artifact schemas published; 594 tests green.
- **M-12 artifact presenters** — the four M-11 artifact types are rendered rather than merely listed. The hardcoded "section 5 is portfolio suggestions" became a type→presenter registry, so the artifact block is whatever the classified path produced and the closing sections renumber after it. Risk score and band are **derived at presentation from `docs/09` §2 and never stored**, so a scale revision cannot silently change what an old row means. Mermaid is dynamically imported, keeping it out of the main bundle (285.94 kB, from 269.77 kB). An artifact type with no presenter still appears in Artifact status, so nothing is dropped for want of a view.

**Increments completed within Sprint 5:**

- **M-20 performance — three requirements measured and passing, the two the milestone names UNMEASURED** ([D-58](33-D-58-Representative-Load.md), [the log](performance/M-20-LATENCY-LOG.md)). `backend/src/ops/bench.ts` measures the `API §12.1` classes that involve no provider. On a dev machine at 1,000 analyses of history: `NFR-003` reads at 2.5–6.7ms p95 against a 200ms budget, `NFR-004` listing at 2.1ms and search at 80.9ms against 1s, `NFR-005` export at 1.54s against 10s. Envelope cost is **21–24µs to open a value**, which is [D-53](28-D-53-Encryption-Layers.md) §4's "microseconds per row" assumption measured rather than asserted.
- **⚠️ `M-20` IS NOT PASSED, AND THE REASON IS ITS OWN CRITERION.** The milestone is "`NFR-001`, `NFR-002` met under representative load", and both are dominated by model provider latency. Under the standing no-spend constraint every run is replay, where the adapter answers instantly from a fixture — so a number from this benchmark measures **this system's overhead** and nothing about either target. Publishing one beside `NFR-001` would be a measurement of the wrong thing, in the right units, next to the right requirement. They are **UNMEASURED**. D-58 §4 records the two ways that closes: authorised provider spend (~$8 for a 30-run sample), or production traffic read through `M-16`'s instrumentation, which costs nothing and needs the deployment `M-19` is already blocked on.
- **"Representative load" was undefined in every document that required it** — `Roadmap` M-20 and `AC-020` both name it and nothing defined it. [D-58](33-D-58-Representative-Load.md) settles it from what the deployed system will actually admit rather than an invented traffic model: **one concurrent analysis** (`SA §9.4` in-process execution, [D-50](25-D-50-Deployment-Topology.md) one instance), **10 analyses per account-hour** ([D-47](22-D-47-Provisional-Rate-Limits.md)'s own limiter ceiling), single-digit accounts, and **1,000 analyses of history**. Concurrency is deliberately **not** the load dimension at v1.0; history size is, because it is the only one that grows without bound.
- **Two measurement defects were caught, both of which had already printed plausible numbers.** Listing and search were first measured **unauthenticated** — `GET /analyses` 401s before reaching the query, so confident sub-millisecond figures described the authorization rejection, not the decrypt path. Fixing that added a status-code assertion to the harness, which within seconds exposed the second: `GET /health` was measured with **no readiness probes wired**, so `probe()` returned `unavailable` without doing any work and the endpoint answered **503** in 0.4ms — the cost of declining to check anything, reported as an excellent `NFR-003` result. ⚠️ **A rejected request still produces a timing, and a fast one.** Every measurement now declares the status it must receive.
- **M-18 security — reviewed against `PRD §9.3`, one high-severity finding fixed, one unresolved, milestone not passed** ([the review](security/M-18-SECURITY-REVIEW.md)). `NFR-020` – `NFR-027` examined. **`NFR-027` was genuinely violated**: `renderExportHtml` passed artifact content through `marked`, which emits raw HTML by default, into a Chromium context launched `--no-sandbox`. Artifact content is model output derived from the user's own submitted text, so the path was reachable rather than theoretical. Six vectors were reproduced live — block and **inline** `<script>`/`onerror`, an `<iframe>` in a table cell, and a `javascript:` link — and all six are closed and pinned by regression tests.
- **The inline case is the one worth remembering.** `marked` produces inline HTML from a separate tokenizer, so overriding the renderer alone closes the block vectors and leaves `<img onerror>` mid-paragraph live. A renderer-only fix would have looked complete and passed a test suite written against block HTML.
- **`NFR-021` is unmet and could not be fixed here.** `DB §13.1` requires application-level encryption on `raw_content`, `structured_input` and `structured_output`; the schema records the intent as a comment and nothing implements it. The same section requires a managed key service and forbids keys in application configuration, and there is no deployment — so the only fix available today is the one the requirement names as wrong. **This is the finding that fails M-18**, and it must not be closed by encrypting with a key sitting in `.env`.
- **D-46 and D-48 arrived as inputs, not discoveries**, which is what this file asked for at line 23 before the review ran. The in-memory rate limiter and the single shared operator credential are Medium findings the review *confirms*; it did not find them. That is the intended outcome and it also means a first review of unfamiliar code would have surfaced more.
- **The review is not independent**, and says so in its own first section rather than a footnote. It was written by the agent that wrote the code. `docs/10` §4.3 bars AI review only for the reasoning rubric, so nothing forbids this one — it is admissible, weaker than an independent review, and `AC-026` should be read against that.
- **M-17 accessibility — four violations fixed, automated checks added, verification incomplete by design** ([D-49](24-D-49-Accessibility-Verification.md)). Two of the four were **Level A** failures, which matters because `NFR-060` claims AA and A is its prerequisite: the history search and filter controls had no accessible name (a placeholder is not a label, WCAG 3.3.2), and there was no skip link (WCAG 2.4.1). The other two were `NFR-064` — the Mermaid diagram was an unlabelled SVG a screen reader could say nothing useful about — and a decorative chevron below the contrast threshold, raised rather than argued into an exemption.
- **The diagram now carries a textual equivalent derived from its own source**, so the picture and the description cannot disagree, and it is **visible to everyone** rather than hidden in an `aria-label`: a description sighted users never see is one nobody proofreads.
- **Sprint 3's design work held up.** `NFR-063` needed no change — every provenance badge already carried a word and a glyph alongside its tint, exactly as `docs/08`'s Sprint 3 risk note said it would ("accessibility requirement designed in, not audited in Sprint 5").
- **`@axe-core/playwright` added**, running through the Playwright already present from [D-43](18-D-43-PDF-Rendering-Approach.md). One dev dependency, ~3.2 MB, **no test runner**: it runs under `node:test` against the built application served over HTTP, and tests nothing in isolation. D-49 §4 records why that is not a Vitest expansion.


- **M-16 instrumentation** ([D-48](23-D-48-Operator-Authentication.md)). `API-050` feedback, `VALIDATION_EVENT` writes, `API-070` `/internal/metrics`, and the `FR-102` lifecycle data. Every metric is computed from tables that already exist for their own reasons rather than from a parallel event pipeline — which satisfies `FR-102`'s "queryable without code changes" in the strongest available sense and avoids a second source of truth that can disagree with the first.
- **`VALIDATION_EVENT` has a writer at last.** The table has existed since Sprint 1 with **0 rows**, carried in this file as an open item, and `M-10` — "outputs passing schema validation before presentation, 100%" — was unmeasurable in consequence. Both artifact paths now record an outcome whether they pass or fail, because a rate computed only from failures has no denominator. `regenerationTriggered` is structurally `false` for rendered artifacts (a deterministic renderer has nothing to retry, the same reasoning `API-032` uses to refuse them a retry) and reports a real value for `portfolio_suggestions`, the one type with `FR-039`'s single informed regeneration.
- **`APIQ-6` resolved** ([D-48](23-D-48-Operator-Authentication.md)) — a static operator credential from configuration, resolved into a **distinct principal type** by a function that never reads sessions, refresh tokens or anonymous ownership. `APIQ-6` requires operator auth "separable from user auth", and the separation is structural: there is no role check to get wrong, which is what keeps `API §10.4`'s "one role and no permission model". Absent configuration **disables** `/internal/*` rather than opening it.

### M-16 — the scope reading, recorded rather than assumed

M-16's milestone line is "all `PRD §3.2` metrics reporting". **Three of the ten cannot be instrumented, by the PRD's own definition**, and the reading adopted here is that the seven automatable ones report real values while the three review-based ones are named as such:

| Metric | Instrumented by `PRD §3.2` | State |
|---|---|---|
| M-1, M-2, M-3, M-4, M-5, M-7, M-10 | `FR-102` / `FR-101` | **Computed and reported** |
| **M-6** classification accuracy | "manually sampled" | **Not computed.** A proxy would measure agreement with the classifier rather than correctness |
| **M-8** recommendation explicability | "Manual review protocol" | **Not computed.** Whether a rationale traces to a stated constraint is a judgement, not a query |
| **M-9** platform recommendation defensibility | "Manual review protocol" | **Not computed.** Its artifact is also unbuilt (`platform_recommendation`, M-07) |

The three appear in `/internal/metrics` as **comments, never as series** — a series with no value scrapes as `0` and is indistinguishable from a measured zero, which is precisely the misreading `PRD §3.1` warns against when it says targets exist "to make the first real numbers interpretable". A test asserts they are never emitted as series.

**No deviation record was written for `VALIDATION_EVENT`.** `docs/12` D-37 listed it out of scope, but D-37 was a **Sprint 3** constraint and `M-16` is the milestone the roadmap assigns this work to. The constraint expired with its sprint; recording a deviation from an expired constraint would misrepresent what is being deviated from.


- **M-15 authentication and history — all seven phases, and verified live.** Sessions with opaque server-validated tokens (`API §3.1`), `scrypt` credential hashing from Node core (`NFR-022`, no native dependency), single-use refresh rotation with family-wide revocation on reuse, ownership enforced on every analysis read, history with a summary-only query boundary, account settings and deletion, and the anonymous claim and expiry. Four decision records govern it: [D-44](19-D-44-Refresh-Token-Table.md), [D-45](20-D-45-Anonymous-Expiry-And-Token-Lifetime.md), [D-46](21-D-46-In-Memory-Rate-Limiting.md), [D-47](22-D-47-Provisional-Rate-Limits.md).
- **`FR-004` claimability closed — the defect this project carried since `API-020` was written.** That endpoint had always stored `hashContent(randomUUID())` and discarded the UUID, so the owner hash satisfied `analysis_exactly_one_owner_check` and **nobody held the credential**; an analysis "claimable into history" was claimable by no one. The token is now issued once at creation, returned once, and stored only as a hash. Claiming rewrites ownership, clears the hash and writes an `AUDIT_EVENT` (`DB §10.3`).
- **Ownership enforced, and an id is never a credential.** `API-021`, `API-025`, `API-026`, `API-032` and `API-040` all ask one predicate. A non-owner receives **404, not 403**: a 403 confirms the analysis exists, turning the id space into an oracle for what this system has analysed. The anonymous principal is established **only** by a token whose hash matches a stored row — the analysis is the *result* of verification, never an input to it.
- **D-41 and D-42 unwound exactly as written.** D-41 §4.4 wrote the export ownership branch before there was an identity to check, expecting M-15 to "supply an identity rather than a new branch"; that is what happened and the branch shape is unchanged. An owned export now writes its `EXPORT` row, so **`M-4` begins at the M-15 date and is never backfilled** (D-41 §6).
- **`DB §12.2`'s mandated verification exists.** "Deletion completeness is verified by test, not asserted." A user with a full analysis set is created, the account deleted, and every table that can reference a user or an analysis is checked — exhaustively rather than sampled, because a cascade that missed one child is the failure `FR-073` cannot tolerate. Audit events survive with `user_id` nullified, the one place in the schema a user reference is severed rather than cascaded.
- **`PROVIDER_INVOCATION` is deliberately not purged.** The obvious reading is that deleting an analysis deletes everything about it. `DB §4.7` and `§8.3` say otherwise: it holds no user content, carries no `analysis_id`, and is retained 30 days against StageTrace's 7 *because* "cost and reliability analysis over a long window is valuable, and it should not require retaining user business content to obtain". Purging it would destroy what `TV-4` and `NFR-083` depend on, to remove data identifying nobody.
- **Verified live, not only by test.** The running application was exercised end to end: registration, account read, history, an anonymous analysis, and the claim. Confirmed against the live server — a read with no token is **404**, with the token **200**, and **with the analysis id presented as the token, 404**; a refresh token used as a `Bearer` credential is **401**; reuse of a spent refresh token returns `token_reused` and revokes the rotated token too; deletion without confirmation is refused, with it returns 202 and a stated window, and the token dies with the account. Test data was removed afterwards and **the 22 legacy evidence rows were re-counted at 22**.

**Increments completed within Sprint 4:**

- **M-14 degradation — complete.** `FR-091`, `FR-093`, `FR-094`, `NFR-011`, `API-032`. The substantive find was that **`FR-094` timeout was entirely absent**: `timed_out` sat in the status enum and `timeoutFlag` was readable through `API-021`/`API-026`, but nothing ever set either, so every over-long run reported a plain completion. A deadline race now writes `status: "timed_out"`, both flags and the terminal event; preservation is inherited free from `DB §6.2` progressive persistence, because the timeout abandons *waiting* and rolls nothing back. `API-032` retry reuses stored reasoning through a `regenerateArtifact` seam on the pipeline and **does not re-run stages 1–8**, with four refusal paths each naming a corrective action — succeeded, omitted, still running, and **deterministic rendered artifact**, the last because a retry would recompute the identical document. `artifact_failed` gained the `retryAvailable` field `API §7.4` requires, computed by the same predicate the endpoint uses, so the stream cannot advertise a retry the API refuses. `FR-093` was **verified, not rebuilt** — `ProviderError` has no field a provider name could occupy.
- **M-13 export — both formats built.** `API-040` returns a self-contained Markdown document for a terminal analysis. **One serialiser, on the server**, shared by the download and by `FR-053` copy-to-clipboard: copying an artifact is a partial export of that artifact, which is exactly what `FR-052`'s `artifact_types` selection specifies, so the frontend holds no Markdown writer that could drift. `API-021`'s previously inline read was extracted to `src/db/analysis-reader.ts` and both the JSON view and the export now consume the same object, so anything visible through the API is exportable by construction. The document carries provenance with its legend spelled out, the confidence-unavailable state with its reason, `FR-051` metadata and the professional-review disclaimer, and `FR-091`'s omitted-versus-failed distinction in a section accounting for every planned artifact. **M-14's degradation labels are an input**: a timed-out or degraded analysis is exportable and says so above everything else. Risk score and band are derived at export from `docs/09` §2 exactly as on screen, and the scale version travels with them.
- **Two deviations recorded for export, both about not inventing things.** [D-41](16-D-41-Anonymous-Export-Deviation.md) permits anonymous export — `API-040` specifies `Auth: Required`, and authentication is M-15, Sprint 5 — and writes **no `EXPORT` row without a real owner**, leaving `M-4` unmeasured rather than populated with rows attributable to nobody. [D-42](17-D-42-Export-Response-Contract.md) follows from it: `export_id`, `download_url` and `expires_at` are **unsatisfiable** under D-41 (the id would key no row, the URL is built from that id, and `DB §4.4` stores no file to expire), so they are structurally absent rather than null or fabricated, the document is the response body, and the status is `200` rather than `201` because nothing is created. `API-041` stays specified and unimplemented — it is reachable only via an `export_id` that is never issued.
- **Refusal handling — `API §9.3`'s "two domain errors that are not failures".** A defect, not a new feature: the pipeline **already** declined an unsupported input at Stage 1 (`FR-092`) and stopped an insufficient one at Stage 3 (`AI §5.4`), and the orchestrator computed the halt, used it for its own return value and **discarded it**. The row was written as a plain `completed`, so `API-021` served a refused analysis as an ordinary 200 with every section empty — indistinguishable from a run that quietly produced nothing, and the precise silence `PV §5` calls a defining product moment. Now: `halted_at_stage` and `halt_reason` persist through an **additive** migration (two nullable columns, a CHECK that they are set together, **no backfill**); the shared `analysis-reader` derives a `refusal` that `API-021`, Markdown and PDF all read from one place; `API-021` answers **422** — `unsupported_input_type` naming the four types that *are* supported (`FR-092`), `insufficient_context` carrying the unknowns with their resolution hints (`AI §5.4`); the frontend has a distinct `refused` phase and a `RefusalView` rather than an error box; and the export produces a refusal document instead of eight headings over nothing. **Null means "no refusal", never "unknown"** — nothing was invented for any historical row.
- **`FR-006` input persistence across failure.** A user's pasted text is no longer destroyed by *our* failure. `localStorage` in their own browser — no server storage and no identity, because `FR-006` is about not losing what was typed, not about syncing it, and a server-side draft would need an owner that `M-15` has not delivered. Saved as it is typed (debounced) and again before the request leaves, so a crash, a closed tab or a submission that never returns all survive. **Cleared on successful retrieval and nowhere else** — a failed or refused run is exactly when the text is still needed, so `reset` deliberately keeps it and "submit a different input" after an `insufficient_context` refusal starts from what the user wrote rather than from a blank box. Recovery is **offered, never applied**: silently repopulating the textarea would leave the user unsure whose text they are looking at. Every access is wrapped — `localStorage` throws in a private window and when site data is blocked, and a storage fault must never take down the form.
- **`FR-014` classification correction** (`API §7.5`). Previously the determination was visible and **not** correctable; the field was documented as absent rather than stubbed. Now: `POST /analyses` accepts `classification_override`, and a correction **creates a new analysis** — `API §7.5` "deliberately does not mutate the original", because `DB DP-3` makes analyses immutable and an update "would destroy both the record of what the system originally concluded and the accuracy signal". The original is never written to. The corrected run **fixes Stage 1 rather than running it**: the type was decided by the user, so asking a model to determine it would spend a request to produce an answer that is then discarded — the correction therefore costs **nothing**. `userOverrideType`/`overriddenAt` are written on the *new* analysis for `M-6`, and `supersedesAnalysisId` records the lineage when the client names it. `unsupported` is refused as a correction: it is a refusal outcome, not a frame anything can be reasoned under.
- **PDF export, and `SA AQ-3` resolved** ([D-43](18-D-43-PDF-Rendering-Approach.md)). The open question was decided by experiment rather than by argument: **Mermaid cannot parse without a DOM** — `DOMPurify.addHook is not a function` — so every library that composes a PDF without a browser can typeset the text and silently drop the diagram `FR-050` requires. A probe built to fail (node count and labels checked, because Mermaid renders its *errors* as diagrams; all network aborted, so a hidden CDN could not pass) **passed**: 4 nodes, correct labels, a real PDF. The implementation is the smallest form of that — `playwright-core` (14 MB, downloads nothing) driving a Chromium-family browser **already on the machine**, discovered at `NAIGX_BROWSER_PATH` or from a per-platform list. **PDF is a rendering of the Markdown, not a second document**: `AnalysisView` → Markdown → HTML → PDF, with the serialiser still the single source of substance. Where no browser exists the request is refused with `503` naming Markdown — never Markdown under a PDF content type.

**Defect fixes earned along the way:** jsonb key-order comparison in the schema publisher; `API-020` violating `analysis_exactly_one_owner_check` (every submission 500'd against a real database before this).

### M-12 limitations — three, stated rather than discovered later

These are evidence and infrastructure gaps, not open code. The renderers are implemented, gate-green, and unproven in the one environment that matters.

1. **There is no frontend test infrastructure.** `frontend/package.json` defines `dev`, `build`, `lint` and `preview` — no test script and no runner. The four presenters therefore have **no automated regression protection**. What was done instead was a one-off seam check: the documents the backend actually renders were fed to the frontend narrowing functions, confirming all four are schema-valid and accepted, that the soundness and no-risks statements survive the empty-findings paths, and that malformed documents are rejected rather than half-read. **That script was temporary and is not in any suite.** Adding a runner was deliberately out of scope and remains an open decision.
2. **Mermaid rendering is unverified in a browser.** An attempt to parse the generated source headlessly failed with `DOMPurify.addHook is not a function` — Mermaid requires a DOM even to parse, so the render path cannot be exercised outside a browser. The component's failure branch exists precisely because that path is unproven: on a parse failure it shows the stored source rather than a blank box.
3. **No stored `existing_workflow` or `technical_assessment` analysis exists to render.** Their prompt fragments are authored and **inactive** under D-39, and no recording exists for either path. The presenters are verified against documents the backend produces, **not** against one retrieved through `API-021`. This is the specific reason the Sprint 3 exit criterion is not claimed.

### M-15 limitations — five, stated rather than discovered later

1. **`FR-041` progressive streaming is degraded for owned analyses.** `API-025` became owner-scoped, and `EventSource` **cannot set an `Authorization` header** — the browser API has no facility for it. The two workarounds are worse than the gap: a token in the query string puts a credential into URLs, server logs and `Referer` headers, and a cookie introduces a second credential class `API §3.1` deliberately does not have. A stream against an owned analysis is refused and the client falls back to **polling**, which `SA AR-06` requires to work with streaming disabled anyway and which `useAnalysis` already runs alongside. Progressive rendering is therefore degraded, not broken.
2. **The trace-purge queue is durable as of `M-19` Phase 3.** It was in-process, and a restart between the primary-store commit and the purge lost the instruction silently. It is now an outbox table in the **primary** store, written in the same transaction as the deletion ([D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md) §5), so there is no instant where the deletion is durable and the instruction is not. An instruction that exhausts its retries is **marked failed and retained**, never deleted — the row is the only evidence a purge is still owed. No API contract changed.
3. **`FR-062` search matches input text and not artifact content.** The requirement asks for both. Matching content would join exactly the tables `API-022` keeps this query off, and that boundary is a privacy property as much as a performance one. **`FR-062` is therefore partial**, and closing it needs a search index rather than a wider join.

   **Since `M-19` Phase 3 it is also `O(the user's analyses)`** ([D-53](28-D-53-Encryption-Layers.md) §4). `raw_content` is encrypted, and a database cannot substring-match ciphertext, so a search fetches that user's rows, decrypts them in process and filters on the plaintext. Semantics are unchanged — still case-insensitive substring matching — and an unsearched listing still runs the original indexed keyset query untouched. At v1.0 volume (tens of analyses, microseconds per row) the cost is invisible. **M-20 measured this rather than assuming it** ([the log](performance/M-20-LATENCY-LOG.md) §3): opening a value costs **21–24µs**, so D-53 §4's stated assumption holds; listing is **flat** from 10 to 1,000 analyses while search grows **2.5ms → 75.1ms p50**, which is exactly the shape D-53 predicted. **The revisit trigger is now quantified** — extrapolating, one user's search consumes the whole 1s `NFR-004` budget somewhere around **10,000–12,000 analyses on that machine**, which is an extrapolation from four points on a dev laptop and ⚠️ **never a production limit**. The options then are a blind index over normalised tokens (leaks token presence, changes substring semantics) or leaving `raw_content` in plaintext (abandons `DB §13.1` row 3). Neither is worth taking before the problem exists.
4. **Rate limiting does not compose across instances** ([D-46](21-D-46-In-Memory-Rate-Limiting.md)), and its values are provisional ([D-47](22-D-47-Provisional-Rate-Limits.md)). `NFR-025` holds for one instance and not for a fleet; `NFR-051` is not met for this component. `APIQ-3` stays open.
5. **The frontend auth and history surface has no automated coverage.** There is still no frontend test runner (M-12 limitation 1) and adding one remains out of scope by standing instruction. `AuthPanel`, `HistoryView` and the token store are typecheck- and build-verified, and the API contracts they depend on are pinned from the backend — 37 tests across auth, history and deletion, plus the live end-to-end run recorded above.

### M-15 — implemented, versus measured or verified

| Criterion | Implemented | Measured / verified |
|---|---|---|
| `FR-070` authentication | **Yes** | Live run + 19 integration tests |
| `FR-004` anonymous claim | **Yes** | Live run: token issued, claim transfers, old token dies |
| `FR-060` persistence and exact retrieval | **Yes** | Test-covered; retrieval reproduces and never regenerates |
| `FR-061` history listing | **Yes** | Test-covered incl. the two distinct empty states |
| `FR-062` history search | **Partial** — text yes, artifact content no | Text search test-covered; content search **not built** |
| `FR-063` deletion | **Yes** | `DB §12.2` verification test |
| `FR-071` settings | **Yes** | Round-trip test-covered |
| `FR-072` data export | **Yes** | Test-covered; excludes credential material |
| `FR-073` account deletion | **Yes** | `DB §12.2` verification test + live run |
| `NFR-022` credential hashing | **Yes** — `scrypt` | Test-covered incl. timing equivalence |
| `NFR-025` rate limiting | **Yes, single-instance** | **Not met for a fleet** — D-46 |
| `NFR-026` server-side authorization | **Yes** | Test-covered on every guarded endpoint + live run |
| `M-4` export rate | **Instrumented** | **No data.** The series starts now; nothing is backfilled |

### M-13 — implemented, versus measured or verified

**M-13 is engineering complete.** Every deliverable is built, gate-green and covered by tests. What is *not* complete is the evidence, and the two are recorded separately here because conflating them is how a project starts believing its own roadmap.

| Criterion | Implemented | Measured / verified |
|---|---|---|
| `FR-050` export as a self-contained document | **Yes**, Markdown and PDF | Markdown exercised in tests against constructed analyses; **no stored `existing_workflow` or `technical_assessment` analysis has ever been exported** |
| `FR-050` "diagrams render in the export" | **Yes** — PDF draws the Mermaid diagram; Markdown carries its source | Verified by a test asserting node count and labels, **on Windows against Chrome only** |
| `FR-051` metadata, disclaimer, no marketing | **Yes** | Test-covered, including a phrase check on both the document and the stylesheet |
| `FR-052` partial export names omissions | **Yes** | Test-covered |
| `FR-053` copy as formatted Markdown | **Yes**, per artifact, via the same endpoint | Test-covered on the API; **the browser control itself has no automated coverage** — there is still no frontend test runner (M-12 limitation 1) |
| `AC-008` presentation-ready in both formats | **Testable** | **Not claimed.** No human has judged an exported PDF against it |
| `NFR-005` export p95 ≤ 10 s | n/a | **Not measured, and not being measured.** See limitation 3 |
| Linux / deployment behaviour | Code written for it | **Verified in-container** (M-19 Phase 1, re-confirmed Phase 2). Renders non-root under distribution Chromium with the sandbox on; fails without the seccomp profile — that differential is the proof |

**Dependency and resource impact of the PDF path**, recorded because it is the part of M-13 that outlives the milestone:

| | |
|---|---|
| `playwright-core` | 14 MB. Downloads **no** browser, unlike `playwright` (~300 MB) |
| `mermaid` | 83 MB installed; only its 3.5 MB browser bundle is read at runtime. The rest is its dependency tree (cytoscape, katex, d3) |
| `marked` | 0.5 MB, MIT, zero dependencies |
| **Total added to `backend/node_modules`** | **~155 MB** |
| **Host requirement** | A Chromium-family browser — `apt-get install -y chromium`, ~120–150 MB plus shared libraries — or `NAIGX_BROWSER_PATH`. **This is the real cost**, and it is operational rather than code |
| Per export | One browser process, launched per request and closed in a `finally`. ~2.4 s observed once, unloaded. Leak-free rather than fast |
| Markdown export | Needs **none** of the above |

### M-13 limitations — three, stated rather than discovered later

1. **PDF needs a browser on the machine — now verified on Linux as well as Windows.** `SA AQ-3` is resolved ([D-43](18-D-43-PDF-Rendering-Approach.md)) and PDF renders through a Chromium-family browser the machine must already have. M-19 Phase 1 supplied that browser from the distribution in `backend/Dockerfile` and verified a non-root render **with the sandbox genuinely enabled** — `chromiumSandbox: true`, not merely `--no-sandbox` removed, which is a no-op. Re-confirmed in Phase 2 against the rebuilt image: renders with `deploy/seccomp/chromium.json` (`%PDF-`), **fails without it**. That differential is the evidence; a successful render alone is not. Where no browser is found the request is refused with `503` naming Markdown — never Markdown under a PDF content type.
2. **The Markdown export has never rendered a real `existing_workflow` or `technical_assessment` analysis.** Same root cause as M-12 limitation 3, inherited: no stored analysis of either path exists. The workflow, risk, assessment and diagram renderers are covered by unit tests against documents in the shape the backend produces and validated by the published schemas, **not** against anything retrieved from the database. The Mermaid export path is therefore unverified end to end for the same reason the browser render is.
3. **`NFR-005` — export p95 ≤ 10s — is unmeasured, and stays unmeasured.** No load measurement exists anywhere in this project and none was invented for this increment. Markdown is a single indexed read plus a pure in-memory transformation; PDF adds a browser launch, observed at roughly 2.4 s wall on a developer machine with no load. **That observation is not a p95 and must not be quoted as one** — D-43 §6 records why it was taken at all. Under concurrency the per-request browser launch is the first thing that would need attention, and concurrency has not been measured either.

---

## In Progress

Nothing is mid-implementation. **M-13 shipped Markdown and stopped there deliberately** — PDF is a separate increment waiting on `SA AQ-3`, not a half-built one. `API-041` is unimplemented by decision rather than by interruption.

The working tree is green at every gate and no increment is half-built. The packet audit is stopped rather than paused — 11 packets remain unreviewed by design, not by interruption. Fragment v3 is authored and awaiting an activation decision; that is a deliberate resting state, not work in progress.

---

## Open

| Item | State |
|---|---|
| **M-05** NIE pipeline operational | **Not met.** 8 of 12 stages implemented (1, 2, 3, 5, 6, 7, 8, 9). Stages 4, 10, 11, 12 are `implemented: false` in `src/nie/stages.ts`. |
| **M-07** Structured generation | **Mechanism met, coverage improved but incomplete.** Validation is enforced before presentation and only `valid` artifacts are presentable. Five artifact types now exist, are published, and have frontend presenters: `portfolio_suggestions`, `workflow_recommendation`, `risk_assessment`, `assessment_feedback`, `mermaid_diagram`. Still unbuilt: `platform_recommendation` (the `FR-034` *artifact*, distinct from the Stage 7 criteria/alternatives), Platform Comparison (deferred by D-40), and complexity scoring (blocked by D-33/D-35/D-36). |
| **`business_requirement` produces no artifacts — OPEN SCOPE DECISION** | It is now the only path of four that reasons and then hands the user nothing but an architecture; its artifact block renders empty, which is honest but thin. `platform_recommendation` is what would close it. **Deliberately not implemented** — it is reasoning work rather than presentation, it was explicitly excluded from M-12, and it would need a further prompt fragment that D-39 keeps inactive until a capture. **M-07 cannot close while this stands.** Recorded here as a decision awaiting the owner, not as an oversight. |
| **M-10** Classification accuracy ≥95% | **Unstarted and currently unmeasurable** — see Blocked. |
| **M-18 `DB §13.1` row 3 encryption** | **Application layer: implemented, deployed and verified** — sealed under a host-held key file ([D-61](36-D-61-Host-Held-Key-File.md), which retired KMS); the fail-closed tests ran on the VPS with 0 skips (D-61 §8), production logs `Field encryption active`, and both restore drills found intact `naigx.v1.` envelopes in real dumps. **Full-volume layer (`NFR-021`): NOT IMPLEMENTED, and not free.** ⚠️ Checked read-only on the VPS 2026-09-09: root is a plain `ext4` partition on `sda1`, `dmsetup ls` reports no devices, `/etc/crypttab` is empty — no dm-crypt/LUKS. Adding it to a running Hostinger VPS means re-provisioning the machine and managing an unlock secret for unattended reboot (D-53 §3's weak-claim caveat applies). That is new infrastructure work and an owner decision; **M-18 H-2 stays open** on this half. |
| **M-17 manual verification** | **Unwalked.** `docs/accessibility/WCAG-AA-CHECKLIST.md` exists with an empty result table. Needs a person with a screen reader — the same shape of blocker as the M-08 reviewer. |
| **`FR-014` correction is session-scoped** | Implemented, with a real limit: the correction re-submits "the same content" (`API §7.5` step 1) and `API-021` does not return the text — `AnalysisInput` carries a character count and a source type, not the content. The session that submitted it holds the text, so **an analysis opened by id alone cannot be corrected** and the control is hidden rather than offered and broken. History is `M-15`; this closes with it. |
| **M-11** All analysis paths | **4 of 4 implemented, 0 of 4 measured.** All four paths now run end to end offline. `existing_workflow` reaches Stage 6W Workflow Review; `technical_assessment` reaches Architecture Analysis under `FR-023`'s trade-off and rejected-alternative requirements. **This is engineering complete, not milestone complete** — the milestone is earned by measurement against the corpus, and no path has been measured. The two new prompt fragments are authored and **inactive** per D-39, so neither path can be run live until a capture is authorised. Documented deferments remain inside the two paths: Platform Comparison deferred, Complexity Score blocked by D-33/D-35/D-36, Edge Cases & Practices excluded by `MVP §5.3`. |
| **M-12** Frontend foundation | **Implementation complete; the milestone is not demonstrated.** The `docs/08` milestone line asks for "results presentation with hierarchy, layered depth, streaming" and all three are built, including presenters for the four M-11 artifact types. Against the five Sprint 3 frontend deliverables: input surface (`FR-001`/`UX-002`) **met**; hierarchy and layered depth (`FR-040`) **met**; unknowns and insufficiency disclosure (`FR-044`) **met**; progressive rendering from the event stream (`FR-041`) **met** via `API-025` SSE with `Last-Event-ID` resumption; rationale, provenance and confidence (`FR-042`–`FR-045`) **partial** — rationale and provenance are displayed, `FR-045` confidence is **not met** because Stage 11 is deferred by D-33 and the UI states there is no band rather than inventing one. **The Sprint 3 exit criterion "all four paths produce presented results a practitioner can evaluate unaided" is NOT demonstrated** — see the three limitations below. |
| Stage 11 confidence | Deferred by `docs/12` D-33. `confidence_band` is null everywhere and the UI says so. `FR-045` unmet. |
| **Architecture unknown disposition** ([D-38](13-D-38-Architecture-Unknown-Disposition.md)) | **Specification gap. Remediation now authorised by [D-39](14-D-39-D-37-Amendment.md); activation still gated on a capture.** Stage 6 can cite an unknown context element without recording how it was handled; the output contract has no field for assumed/excluded/deferred. Measured across the 10 architecture-bearing recordings: **71 unknowns, 20 cited (28%)**, citation rate ranging 0–100% between comparable cases, and one recording citing 5 of 5 while acknowledging none. Remediation — an `unknown_disposition[]` field plus a disposition check through the existing regeneration path — may now be authored and tested, but cannot be activated without a capture. |
| `VALIDATION_EVENT` attribution | **Closed by M-16.** Both artifact paths now record a schema-validation outcome, so `M-10` is measurable. Rows accrue from the next analysis run onward; nothing is backfilled. |
| `analysis.model_version_id` | Written only by `src/harness/run.ts`. Null for every analysis created through the API — `AI-004` drift attribution is being lost. |
| `provider_invocation.attempt_number` | Reports `1` for both Stage 9 attempts; the regeneration does not thread it. |
| Backend binds `0.0.0.0` | `HOST` is a hardcoded constant in `src/index.ts:28` with no env override. Reachable on the LAN. |
| Uncommitted work | **Everything from M-11, M-12, M-14 and M-13, plus D-40, D-41 and D-42.** Last commit is `c7f23b3`. Nothing has been committed since. |
| **`M-4` export rate** | **Unmeasurable until M-15**, by decision — [D-41](16-D-41-Anonymous-Export-Deviation.md) §5. Anonymous export volume in this period is **not recoverable retrospectively**, because the rows are not being written and cannot be backfilled. `MVP §3.2` calls `M-4` the primary behavioural trust signal; it records nothing today. |
| **`API-041` download** | **Specified, unimplemented.** Reachable only through an `export_id`, and D-42 issues none. Regeneration from the analysis id is what an anonymous caller has, and it is `API-040` called again. |
| **`SA AQ-3` PDF rendering approach** | **Resolved 2026-09-07** by [D-43](18-D-43-PDF-Rendering-Approach.md) — a headless system browser via `playwright-core`. Decided by experiment; the probe is described in D-43 §2. |
| **Chromium on the deployment host** | **New operational dependency.** PDF export needs `apt-get install -y chromium` (~120–150 MB) or `NAIGX_BROWSER_PATH`. Unverified on Linux, because nothing is deployed. Markdown is unaffected and needs nothing. |
| **`NFR-005` export latency** | **Measured and passing** — 1.36s p50 / 1.54s p95 against a 10s budget (n=10), [the log](performance/M-20-LATENCY-LOG.md) §6. Corroborates [D-43](18-D-43-PDF-Rendering-Approach.md)'s per-call browser launch as the right trade. ⚠️ Measured against **this machine's** Chromium, not the container's under seccomp; re-take on the first real deploy. |
| **`NFR-001` / `NFR-002` latency** | **UNMEASURED, and this is what fails `M-20`.** Both are dominated by provider latency and every run is replay, so no honest number exists under the no-spend constraint. [D-58](33-D-58-Representative-Load.md) §4 defines what would discharge them. |
| **M-20** Performance | **Open — and now NOT MET on evidence rather than unmeasured.** `NFR-003`/`004`/`005` measured and passing. ✅ **`NFR-001`/`NFR-002` were MEASURED LIVE on 2026-09-09** under owner-authorised spend, per D-58 §4 option 1: 11 live analyses attempted (8 completed, 1 timed out at the 180 s cap with every stage succeeding, 1 failed on a Stage 3 model output outside the `category` enum, 1 killed mid-run by provider credit exhaustion), Sonnet 4.5, one analysis at a time, the same 15-fragment composition production runs. **`NFR-002` full completion: p50 74.3 s / p95 161.6 s (n=8) against 60/120. `NFR-001` first artifact: p50 85.3 s / p95 161.6 s (n=4) against 15/40.** Both over budget at p50, and `NFR-001` is **structurally out of reach for this pipeline shape** — no artifact exists before Stage 6/7 reasoning completes (Stages 1–3 alone take ~45 s), and the job-description path's only artifact is Stage 9, the last thing that happens. ⚠️ The sample is 8, not the 30 D-58 planned: the provider account's credit balance ran out mid-run. ⚠️ Spend: **$1.2370** (65 invocations; corrected from the harness's $1.1319 after reconciling the trace store — the timed-out run's two post-deadline Stage 9 calls were billed, which is the cancellation defect D-65 §7.2 fixed). [The log](performance/M-20-LATENCY-LOG.md) §7 and `performance/evidence/`. No replay number was substituted and no implementation was changed. **What closes it is now a requirements decision, not a measurement.** ✅ **Re-measured on Sonnet 5 the same day, full 30-run sample, 180 s default, nothing excluded** ([the log](performance/M-20-LATENCY-LOG.md) §8): 30 of 30 completed, 0 timed out, 1 degraded; `NFR-002` **p50 77.2 s / p95 128.0 s**; `NFR-001` **p50 91.4 s / p95 126.6 s** (n=21). Same miss, same shape, $3.1895. The two samples are kept separate and not ranked. ▶ **2026-09-09, later: [D-66](41-D-66-Intent-Brief-Early-Artifact.md) implemented** — the `intent_brief` artifact (Stage 2, deterministic, `standing: understanding_only`, sixth published schema) is the first artifact of every reasoning path, so `M-16`'s `time_to_first_artifact` will measure it. Expected from the recorded Stage 2 timings: ~7.6 s p50 / 11.4 s p95 on Sonnet 5. ⚠️ **Not measured live, not deployed**: needs an owner-authorised deploy (with the schema publish, a production write) and a D-58 sample. `NFR-002` is untouched by it. |
| **`API-060` readiness does not probe artifact schemas** — OPEN ISSUE, 2026-09-09 | On the deployed instance readiness answered **200** while `artifact_schema` held zero rows and `/app/schemas` did not exist, so three of four paths failed at Stage 9 behind a green health check. `API-060` names database, provider and templates; schemas are none of those. **Recorded, not fixed** — the owner has said not to expand `API-060` yet. Until it is, the first-deploy runbook step (`schemas check`) and one recorded input per artifact-bearing path are the guard. |
| **An aborted provider call is recorded at $0.00** — OPEN ISSUE, 2026-09-09 | D-65 §7.2 added cancellation at the `FR-094` deadline. An aborted response carries no `usage`, so `provider_invocation.estimated_cost` is `0` for it while the provider bills the tokens generated before the abort. `NFR-083` per-call accounting therefore **understates** the cost of every cancelled call; the true figure exists only in the Console. Bounded above by a full call of that stage. Not fixable from the response; recorded, not hidden. |
| ~~The off-site backup sync lives only on the host~~ | ✅ **CLOSED 2026-09-09.** Preserved byte-for-byte under [`deploy/offsite/`](../deploy/offsite/README.md) with install and recovery steps, encryption parameters and required key paths; secrets and the private receiver URL excluded. Host configuration unchanged. |

---

## Blocked

| Blocked | Exact blocker |
|---|---|
| **M-10** classification accuracy | 13 recordings exist, all `br-*` and `un-*`. Measuring ≥95% across a 44-case corpus spanning 5 categories requires capture against the other three types — a live-provider spend, which is deferred by owner decision. |
| **M-11** measurement | The paths are built; measuring them is not. `stage.workflow_review` and the amended `stage.architecture_analysis` are authored and inactive per D-39, and no recording exists for an `ew-*` or `ta-*` case. Both need an activation decision and a live capture. |
| **M-08** closure — two independent blockers | **(1) No qualifying reviewer.** `docs/10` §4.3 excludes AI review in any capacity, for any criterion; §8 ambiguity A-1 records that the independent reviewer "has not been named" and "requires owner action before M-08". **(2) C-6 has no stored evidence.** The engineering is done; activation and a capture are not. See below. |
| **C-6 — engineering complete, evidence prerequisite not** | The `FR-034` implementation landed 2026-09-07 (see *FR-034 / C-6* below). Stage 7 now requires stated criteria and ≥1 rejected alternative; they persist and reach API-021 and the UI. **C-6 is still not assessable**, because no stored analysis carries that evidence yet: the active fragment is v2, which does not ask for it. Assessability needs activation, then a capture. |
| **C-3 — structurally available on the JD path, not passed** | `job_description` reaches Stages 8–9 and produces `ARTIFACT_PLAN_ENTRY` rows with inclusion and omission reasons — C-3's required evidence. That makes the criterion *assessable* for that path; it is **not a pass**, and a human reviewer still has to judge it. As of M-11, `existing_workflow` and `technical_assessment` also produce artifact plans and artifacts, so C-3 is structurally available on three of four paths — **in code, not in any stored analysis**, since no recording exists for either new path. `business_requirement` still routes to architecture only and produces no artifact set, so C-3 stays unassessable for it however much is captured. |
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
| **`VALIDATION_EVENT` attribution** | `docs/12` D-37 out-of-scope list | A dedicated increment. The live failure of `d797492d` is the argument for doing it. |
| **Schema-as-Output-Contract** | Diagnosis of `d797492d`, 2026-09-07 | Larger change; outside D-39's bounded scope. |
| Authentication and history | Roadmap Sprint 5 | On plan, not skipped. **Export no longer waits on it** — D-41 decoupled them. |
| **PDF verification on Linux** | D-43 §6, 2026-09-07 | **Discharged by M-19 Phase 1**, re-confirmed Phase 2. The container exists now, and PDF renders in it non-root with the Chromium sandbox on — and fails without the seccomp profile, which is the proof the sandbox is engaged rather than merely tolerated. |
| **Browser pooling for PDF** | D-43 §3.6 | Export volume justifies it. A browser is launched per request today — leak-free rather than fast, and nothing measured argues for changing that yet. |
| **`M-4` instrumentation** | [D-41](16-D-41-Anonymous-Export-Deviation.md) | M-15 supplies the identity that makes the metric meaningful. Its start date is recorded as the M-15 date, never the M-13 date. |

---

## Important Non-Claims

Statements that must **not** be made, regardless of how the work looks.

1. **M-08 is not passed.** The live smoke test completing does not run the rubric. `docs/12` D-37: "unstarted, not passed-with-caveats." No Sprint 2 milestone may be reported as met on the strength of Sprint 3 work. **Nor is it passed, or partially passed, on the strength of the 2026-09-07 packet audit** — those verdicts are AI-authored and inadmissible under `docs/10` §4.3, only 2 of 13 packets were assessed, and C-3/C-6 make a pass structurally unreachable in this sample.
2. **M-10 and M-11 are not passed by the live smoke test.** One analysis of one job description is not 95% classification accuracy across 44 cases, and is not four paths.
3. **No Sprint 2 milestone newly passed on 2026-09-07.** The `FR-034` implementation is engineering, not evidence. **Implementation complete is not evidence complete**: C-6 needs an activated fragment producing stored criteria and rejected alternatives in a real analysis, and none exists. C-3 is *assessable* on the JD path and is **not passed** — a human reviewer must still judge it. M-07 is unchanged; the `platform_recommendation` artifact remains unbuilt.
3. **Informed regeneration is not proven against a real provider.** It is covered by five offline regression tests using the replay adapter. Whether a real model acts on the correction is unverified and deferred by decision.
4. **The Sprint 2 quality gate is not claimed as passed**, and its requirements are not waived.
5. **No production deployment exists.** Nothing is deployed anywhere. All four M-19 phases are built — a non-root container with a working Chromium sandbox, a TLS edge, application-level encryption with a durable purge queue, and monitoring/alerting/backup with a passing restore drill — but **nothing has been run on a host and no domain exists**. ⚠️ **Having a deployable stack is not a deployment**, and M-19 is not passed: its criterion is a production deploy with monitoring, alerting and *verified rollback*. The rollback drill (D-50 §4) requires production and has not happened.
6. **Do not claim production Zapier experience.** Not evidenced by this project or the capability profile.
7. **`FR-041` streaming is implemented but its Sprint 3 exit criteria are unproven.** `API-025` SSE with `Last-Event-ID` resumption exists and the browser consumes it. **Stream resumption after a forced disconnect has not been demonstrated**, and no streaming-versus-polling comparison has been run. Implemented is not demonstrated.
8. **`FR-045` confidence display is not met.** No confidence is computed; null is displayed honestly as unavailable.
9. **M-12 is not claimed as passed, and the Sprint 3 exit criterion is not claimed.** The presenters are implemented and gate-green. No `existing_workflow` or `technical_assessment` analysis has ever been rendered from stored data, the Mermaid render has never run in a browser, and there is no frontend test suite. "All four paths produce presented results a practitioner can evaluate unaided" is a statement about four paths that have been *presented*; two of them have only been *coded*.
9. **The 44-case corpus is not exercised end to end.** The last regression run (`4ea7eef7`, 2026-08-14) covered 13 cases in `recorded` mode, with `artifact_set`, `confidence_band` and `do_not_automate_conclusion` assertions deferred. Its own attestation: this is "NOT evidence that the current prompt produces these responses."
10. **`FR-004` claimability is unmet.** Anonymous analyses store an owner hash whose token is never issued, so no analysis is claimable.
11. **`API-040` is not implemented to specification.** It is implemented to D-41 plus [D-42](17-D-42-Export-Response-Contract.md). It returns no `export_id`, no `download_url` and no `expires_at`; it writes no `EXPORT` row; it returns `200` rather than `201`; and it is reachable without authentication, which `API-040` and `API §7.8` both forbid. Every one of those is recorded, and none is a reinterpretation of the specification.
12. **`M-4` is not instrumented, in whole or in part.** No export row exists. A chart implying the metric existed before M-15 would be the exact lie D-41 was written to avoid.
13. **PDF export is built but unproven on the platform it will deploy to.** Both formats exist, so the `FR-050` format requirement is met in code; `AC-008` ("presentation-ready in both formats") is now **testable and not claimed** — no human has judged a PDF against it. Diagrams **do** render into the PDF, verified by a test that checks node count and labels rather than byte count, because Mermaid draws its own errors as diagrams. **Verified on Windows only.**
14. **`NFR-005` is not met and not measured.** Nothing in this project measures export latency. The ~2.4 s figure in D-43 is a single observation taken while deciding, on one machine, with no load — not a p95, not a benchmark, and not to be quoted as either.
15. **The export has never been run against a real `existing_workflow` or `technical_assessment` analysis**, because none is stored. Four of the five artifact renderers are exercised only against constructed documents.
16. **Refusal handling has never been exercised end to end from a real submission.** Both paths are covered from the pipeline result forward — orchestrator, persistence, retrieval, 422, export — and against real Postgres. What is **not** covered is a real input actually classifying as `unsupported` or scoring `insufficient`, because that needs a provider run and none was authorised. The refusals are reproduced from constructed pipeline results, not observed.
17. **The frontend refusal state has no automated test.** There is still no frontend test runner (M-12 limitation 1), and adding one remains out of scope by standing instruction. `RefusalView` and the `refused` phase are typecheck- and build-verified only; the 422 envelope they narrow **is** pinned, from the backend side.
36. **⚠️ M-18 IS STILL NOT PASSED, AND M-19 PHASE 3 DID NOT CHANGE THAT.** Its milestone line is "review complete; **no unresolved high-severity findings**", and finding H-2 — no application-level encryption of confidential content, `DB §13.1` row 3 — is **implemented but unverified**, which is not the same as resolved. Phase 3 built the envelope, the key ring, the KMS adapter and the backfill ([D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md)), and every part of it is proved against an **offline test double**: faithful evidence about the interface, none at all about the service. **AWS KMS has never been called** — no account exists. [D-53](28-D-53-Encryption-Layers.md) §6 is explicit that H-2 closes when **both** layers are *deployed and verified*, not when the code merges, and the full-volume layer (`NFR-021`) needs a host that also does not exist. The four skipped tests in `tests/integration/kms-live.test.ts` are the only thing that can discharge the application-level half; **a skip is "not checked", never "passed"**. See [the review](security/M-18-SECURITY-REVIEW.md).
37. **The security review is not independent.** It was performed by the same agent that wrote the code, and shares its blind spots by construction. No project document forbids that — `docs/10` §4.3 excludes AI review for the *reasoning rubric* specifically and nothing extends it here — so the review is admissible evidence and is **not** equivalent to an independent one. `AC-026`'s "review completed" should be read against that, and an independent review belongs before beta.
38. **Two encryption layers, still different requirements, and neither is verified** ([D-53](28-D-53-Encryption-Layers.md) §1). `NFR-021` — "stored analysis content encrypted at rest" — maps to **full-volume** encryption, is **unimplemented**, and needs a host; it costs nothing once one exists. `DB §13.1` row 3 requires **application-level** encryption on `raw_content`, `structured_input` and `structured_output`, carries **no requirement number**, and states the actual security property. As of `M-19` Phase 3 those three fields are **sealed, not plaintext** — AES-256-GCM under a KMS-wrapped data key ([D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md)) — but every part of that is proved against an **offline test double**, and **AWS KMS has never been called**. So the layer is implemented and unverified, which is not met. ⚠️ **The M-18 review originally labelled the second one `NFR-021`; that was wrong and is corrected in place.** **Neither may be closed by a locally-held key** ([D-52](27-D-52-Managed-Key-Service.md) §4) — two independent gates now refuse one in code — and `NFR-021` alone must not be reported as satisfying `DB §13.1`.
39. **`NFR-020` is implemented but UNVERIFIED, and still unmet in practice.** M-19 Phase 2 put Caddy at the edge with automatic Let's Encrypt, TLS 1.2 as the floor and HSTS ([D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md)). **No certificate has ever been issued by that configuration** — the ACME exchange needs a public domain and DNS pointing at a reachable host, and neither exists. Everything *beneath* the TLS layer was verified end to end over plain HTTP against the built images; the TLS layer itself was not. Nothing is deployed, so the requirement is not met — and a green routing check is not evidence toward it.
42. **⚠️ Full-volume encryption on a rented VPS is weak, and only a narrow claim is made for it** ([D-53](28-D-53-Encryption-Layers.md) §3). Unattended reboot needs the unlock material on or near the machine, and the host operator can read RAM. What it genuinely defends is disk decommissioning and physical media handling. It must not be described as protecting content from a host compromise — that is what the application-level layer is for.
43. **`NFR-051` is not met, and a working single-instance deployment is not evidence toward it** ([D-50](25-D-50-Deployment-Topology.md) §3). "Horizontally scalable without code change" is false: the rate limiter holds process state and SSE needs affinity. `AP-3` statelessness is necessary and not sufficient.
44. **Backups do not prove recoverability; a restore drill does** ([D-51](26-D-51-Self-Hosted-PostgreSQL.md) §4). ⚠️ **A drill has now been performed and recorded** — [RESTORE-DRILL-LOG](deployment/RESTORE-DRILL-LOG.md), 2026-09-07: both databases restored into scratch, 8 table row counts matched, one analysis spot-checked with its sealed envelope intact, and the drill script itself verified by differential against a primary-only and a truncated backup set. **It ran against the DEVELOPMENT database**, because no production deployment exists. The mechanism is proven; D-51 §4's obligation is **not discharged** until a drill runs against a real backup of deployed data. Separately, **off-host storage is unverifiable by any script** — it is a property of where `NAIGX_BACKUP_DIR` points.
46. **⚠️ THE ROLLBACK DRILL HAS NOT HAPPENED, AND M-19 CANNOT PASS WITHOUT IT** ([D-50](25-D-50-Deployment-Topology.md) §4, `TM-17`). The whole argument for skipping a staging environment rests on drilling rollback against the production deployment itself, and there is no production deployment. A rehearsal against the development database ([ROLLBACK-DRILL-LOG](deployment/ROLLBACK-DRILL-LOG.md)) found something worse than it set out to check: **rolling back past the encryption boundary was a data-visibility incident, not a rollback** — the pre-encryption build started, passed its health check, and served base64 envelopes **without erroring**, because the Phase 3 migration was perfectly additive and `SA §9.3`'s migration check cannot see a change in what stored bytes *mean*. ✅ **That incompatibility is fixed** ([D-57](32-D-57-Rollback-Across-A-Data-Format-Change.md)): the sealed columns are renamed so an old build gets `42703 undefined_column`, and a `data_format` version refuses startup when the data is newer than the build — both verified. ⚠️ **The fix removes the blocker; it does not perform the drill**, and the drill still requires a deployed environment.
47. **Monitoring and alerting are built and verified as a mechanism, not as a running deployment** ([D-56](31-D-56-Monitoring-Alerting-And-The-Drills.md)). Prometheus scraped the real endpoint with the operator token, all 8 rules loaded, every referenced series resolved, `CompletionRateBelowTarget` fired with its message rendered, and a test alert reached a webhook receiver through Alertmanager. ⚠️ **None of that is a deployed monitoring stack**, and Alertmanager starts happily with an unreachable receiver — whether a real alert reaches a real person is a first-deploy check that has not been run.
53. **⚠️ THE REGRESSION PASS REFERENCE IS PARTIAL AND RECORDED-MODE. IT PROVES LESS THAN ITS NAME SUGGESTS.** `corpus-regression:corpus-v2+fragments-v1:35af47fbdabae5eb` (2026-09-08, `research/regression-runs/`) is a genuine passing run — 13 passed, 0 failed, 0 blocked, 0 stale, 0 errored — and it legitimately satisfies the `DB §4.5` / [D-24](12-Sprint-1-Decision-Record.md) activation gate for the four foundation fragments (`system_frame`, `neutrality_constraints`, `provenance_rules`, `refusal_and_uncertainty`). **Two limits are part of the claim, not footnotes to it:**
    - **13 of 44 cases.** `selectionScope: "partial"` — `br-001`…`br-011` plus `un-001`/`un-002`, the first vertical only. It covers the foundation fragments and **nothing beyond them**. It is not a full-corpus run and must never be cited as one.
    - ⚠️ **Recorded mode, and the run says so itself:** *"the pipeline, parser and deterministic corpus expectations hold against previously captured provider responses. **This is NOT evidence that the current prompt produces these responses**."* It proves deterministic pipeline behaviour against recordings captured earlier. It proves **nothing** about what a live model would return from today's prompts. `assertionsEvaluated` covers classification, confidence bound, refusal behaviour, reference integrity, conflict detection and run completeness; `artifact_set`, `confidence_band` and `do_not_automate_conclusion` remain **deferred**.

    **It cost nothing** — the 13 recordings were captured in an earlier sprint against a real provider (`adapter: anthropic`), so no new provider call was made. ⚠️ It therefore does **not** advance `M-08` or `M-10`, which need the other **31 unrecorded cases** across the remaining input types.
49. **⚠️ M-20 IS NOT PASSED, AND THE MEASUREMENTS THAT PASS ARE NOT THE ONES IT NAMES.** The milestone is "`NFR-001`, `NFR-002` met under representative load". Those two — first artifact visible and full analysis completion — are **dominated by model provider latency**, and the standing no-spend constraint makes every run replay mode, where the adapter answers instantly from a fixture. So the benchmark measures **this system's own overhead** and says nothing about either target. ⚠️ **Publishing a replay number beside `NFR-001` would be a measurement of the wrong thing, in the right units, next to the right requirement** — do not do it, and do not let three passing requirements stand in for the two that are unmeasured. `NFR-003`, `NFR-004` and `NFR-005` are measured and passing; `NFR-001` and `NFR-002` are **UNMEASURED**. [D-58](33-D-58-Representative-Load.md) §4 records what would discharge them. ⚠️ **Ratified by the owner 2026-09-08:** M-20 stays not passed, `NFR-001`/`NFR-002` stay explicitly unmeasured unless provider spend is authorised, **replay latency is never substituted for a provider-dominated metric**, and **no implementation change may be made whose purpose is to manufacture M-20 evidence**.
50. **The M-20 figures are development-machine numbers and are not production performance.** One process, one local Postgres, `app.inject` in-process dispatch — **no TLS, no proxy hop, no network, no concurrency**, which are exactly the parts a real client experiences. Every figure is a **lower bound** on user-observed latency. What they establish is the *shape of a curve* and a regression baseline on that machine. The ~10,000–12,000-analysis search ceiling is an **extrapolation from four points on a laptop**, stated in [the log](performance/M-20-LATENCY-LOG.md) §3.3 with the caveat that the last segment is the steepest, so linear extrapolation is the optimistic reading. It is never a production limit.
51. **`NFR-005` is measured on this machine's Chromium, not the container's.** 1.36s p50 / 1.54s p95 against a 10s budget is a real result, and the deployed path renders inside the backend image under the seccomp profile with `chromiumSandbox: true`, which was not exercised. Headroom is ~6.5×, so the conclusion is unlikely to invert — but the in-container figure is **unmeasured** and is one to re-take on the first real deploy.
52. **D-58's "representative load" is a v1.0 definition and is not a capacity claim.** It describes what the deployed system will admit — one concurrent analysis, [D-47](22-D-47-Provisional-Rate-Limits.md)'s 10 per account-hour, single-digit accounts, 1,000 analyses of history — not what it can withstand. **No concurrency was measured at all**, because [D-50](25-D-50-Deployment-Topology.md) deploys one instance and `SA §9.4` executes jobs in-process. The revisit trigger is the first private-beta user, the same trigger as D-50 §4.
48. **Immediate physical eradication of deleted content from all media is not claimed.** Backups containing it are retained a maximum of **7 days** (`DBQ-7`, resolved by [D-51](26-D-51-Self-Hosted-PostgreSQL.md) §3) and the window is disclosed in the data policy rather than omitted.
40. **No penetration testing, dependency-vulnerability scanning, or threat modelling has been performed.** Each is a separate exercise and none was in M-18's scope. The review examined eight named requirements and reports what it found in them — it does not establish that the system is secure.
41. **The `NFR-027` fix is a real result and is stated as one.** The export path passed raw HTML and `javascript:` links into a Chromium context running `--no-sandbox`; six vectors were reproduced live, closed, and pinned by regression tests. That evidence stands regardless of who found it — but one fixed finding does not generalise to the rest of the surface.
31. **⚠️ M-17 IS NOT PASSED, AND A GREEN AXE RUN NEVER MAKES IT PASSED.** [D-49](24-D-49-Accessibility-Verification.md) §3.3. The automated checks are necessary, repeatable evidence and are **not sufficient** to establish WCAG 2.1 AA conformance: they evaluate the success criteria decidable from a rendered DOM, and keyboard traversal, focus order, whether a textual equivalent actually describes what it labels, and screen-reader announcement are not among them.
32. **The `M-17` "verified" claim requires the manual walk**, recorded in `docs/accessibility/WCAG-AA-CHECKLIST.md` with an outcome and a name. That table is **empty**. Until it is filled in, M-17 is *implemented and unverified* — the same distinction this file already draws for M-11 ("implemented, 0 of 4 measured") and M-08.
33. **The manual walk has no owner**, the same gap `docs/10` §8 ambiguity A-1 records for the M-08 reviewer. It needs a person with a screen reader; nothing schedules one.
34. **The automated checks cover the input and sign-in surfaces only.** Flows behind a completed analysis — results, artifacts, history, refusal — need a live backend and a stored analysis. Those are the checklist's territory, and faking them with a mock would check markup nobody ships.
35. **No accessibility audit by a qualified reviewer has been performed.** D-49 §6.
26. **M-16 does not report M-6, M-8 or M-9, and must never be described as reporting "all" `PRD §3.2` metrics without that qualification.** Three of the ten are manual review protocols by the PRD's own definition. See the scope reading above.
27. **The metric values have no interpretive weight yet.** They are computed from a development database with a handful of analyses. `PRD §3.1` says the targets themselves are "provisional and unvalidated" with no baseline; the numbers now reporting are the first data, not a measurement against a target. Latency percentiles in particular are over single-digit sample counts, and the sample count is emitted beside each so a reader can see that.
28. **`M-4` still has almost no data.** Its series began at the M-15 date and nothing is backfilled (D-41 §6).
29. **The operator credential is a single shared secret** with no rotation and no per-operator attribution ([D-48](23-D-48-Operator-Authentication.md) §4). An audit event records *that* an operator read metrics, never *which* one — with one operator that distinction records nothing, and with a team it would matter.
30. **`API-071`, `API-072` and `API-073` are not implemented, and the existence of operator authentication is not a reason to build them.** `API-073` in particular is "the highest-privilege read in the system" and requires every access to be independently audited; the credential is a prerequisite, not a licence. D-48 §5 states this.
21. **M-15 is not claimed as passed against Sprint 5's exit criteria.** Its own milestone line — "analyses persist and retrieve exactly; deletion permanent and verified" — is met and verified. Sprint 5's *exit* criteria are wider: they include all `PRD §3.2` metrics reporting real values (M-16), WCAG 2.1 AA (M-17), a security review (M-18) and a production deploy with verified rollback (M-19). **None of those is started.**
22. **`M-4` is instrumented and has no data.** The `EXPORT` row is written for an owned export from today. Its series begins at the M-15 date and nothing is backfilled — D-41 §6: "a chart that implies the metric existed earlier would be the same lie this record exists to avoid."
23. **The security review is done, and M-18 is still not passed.** Superseded by non-claims 36-41 and [the review](security/M-18-SECURITY-REVIEW.md). D-46 and D-48 were received as declared inputs rather than discovered, as this line asked. The review found one new high-severity issue (`NFR-027`, fixed) and one unresolved (`NFR-021`).
24. **`FR-062` is partial.** History search matches submitted text and not artifact content. See M-15 limitation 3.
25. **The 22 legacy evidence rows remain exempt and intact**, re-counted at 22 after the live verification run. [D-45](20-D-45-Anonymous-Expiry-And-Token-Lifetime.md) §3 governs them.
18. **Sprint 4's deliverables are complete; its exit criteria are not all demonstrated.** Every row of the roadmap's Sprint 4 table is implemented and gate-green. Two exit criteria remain unproven for reasons recorded elsewhere: "a complete analysis exports as a third-party-presentable document" is **implemented but not judged by a human** (`AC-008`), and "every failure mode yields labelled partial results" is covered for the modes that can be reproduced offline — no failure mode has been observed against a live provider.
19. **`FR-006` and `FR-014` have no automated frontend coverage.** Both are largely frontend behaviour, there is still no frontend test runner (M-12 limitation 1), and adding one remains out of scope by standing instruction. `draftStorage.ts`, the recovery banner and the correction control are typecheck- and build-verified only. What **is** pinned, from the backend, is the API contract they depend on: 11 tests cover the correction endpoint including that the original analysis is never written to.
20. **The classification correction has never been run end to end against a provider.** The seam is proven — an overridden run makes no classification call, and an ordinary one does — but no corrected analysis has been produced from a real submission, because that needs a capture nobody has authorised.

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

## Sonnet 5 Pilot — Attempted and Rejected, 2026-09-08 — ⚠️ SUPERSEDED BY D-65, 2026-09-09

> **The rejection below is superseded.** On the owner's instruction the live
> provider model is now **`claude-sonnet-5`**, and the pilot's blocker was
> fixed at its cause rather than worked around: [D-65](40-D-65-Structured-Outputs-And-Sonnet-5.md)
> sends each stage's output schema as `output_config.format`, keeps
> `temperature` off the 5-generation with the `AI §10.2` degradation recorded,
> and steers thinking with `PROVIDER_EFFORT`. Re-verified live on the new,
> owner-confirmed account (organisation `50a4c891-…`): all four paths
> completed on the compiled application, including **jd-002 through Stage 9
> with a schema-valid artifact on the first generation**, at $0.06–$0.15 per
> analysis. Two things were found and fixed on the way (D-65 §7.2). The
> pilot's facts stand as history; its verdict does not. **Production remains
> in replay mode with no provider credentials.**

**`claude-sonnet-5` was evaluated as a replacement provider model and REJECTED on 2026-09-08. The configured model remained `claude-sonnet-4-5` until D-65.** All pilot code was reverted; nothing below changed the shipped configuration at the time.

| | |
|---|---|
| Configuration tested | `claude-sonnet-5`, adaptive thinking, `output_config.effort: medium`, rates $2/$10 per MTok |
| Runs | **3** — `br-001` (business_requirement), `jd-001` (job_description), and a **repeat of `br-001`** |
| Spend | **$0.2122** across 10 provider calls, against a $1.00 authorised ceiling |
| Completed analyses | **0 of 3** |
| Schema validation | **3 of 3 failed** |

**The three failures, each different:**

| Run | Stage | Failure |
|---|---|---|
| 1 `br-001` | 3 `context_extraction` | `Field "category" must be one of constraint, environment, scale, dependency, system, objective (received "unknown")` |
| 2 `jd-001` | 7 `recommendation_generation` | `Field "decisive_gaps" must be an array` |
| 3 `br-001` **repeat** | 3 `context_extraction` | `Field "specificity_score" must be a finite number` |

**⚠️ The repeat is the finding that matters.** Identical input, same stage, **different failure mode**. That is the `FR-024`/`AIP-7` reproducibility loss **measured rather than predicted**: Sonnet 5 removed sampling parameters, so `temperature: 0` cannot be sent, and `AI §10.2`'s low-variance degradation applies on every call. The degradation mechanism itself **worked correctly** — a clean differential shows all 80 historical Sonnet 4.5 calls recorded `fallback_used = false` and all 10 Sonnet 5 calls `true`.

**Cost was not the reason for rejection.** Adaptive thinking at `medium` did **not** inflate output tokens — per stage, output was flat or lower than Sonnet 4.5 (`context_extraction` 3,932 → 2,812; `recommendation_generation` 3,932 → 3,947; `input_classification` 41 → 35). Projected cost remained **~$0.23 per complete 12-stage analysis**, above the $0.10–$0.20 target but not the disqualifier. **Schema validity was.**

⚠️ **Latency rose sharply** and is recorded as an observation, not milestone evidence: `recommendation_generation` 37.2s and `context_extraction` 21.1s per call.

### ⚠️ The comparison is UNCONTROLLED, and the conclusion is bounded by that

`analysis_input` holds no historical row at these inputs' character counts — **Sonnet 4.5 was never given `br-001` or `jd-001`**. So the pilot cannot distinguish *"Sonnet 5 is less compliant with prompt-instructed schemas"* from *"these corpus cases are harder and Sonnet 4.5 would also fail them"*. **The first is not claimed.** A single Sonnet 4.5 control run (~$0.06) would resolve it; it was **deliberately not run** — the owner judged it not worth the budget for this decision.

### What it points at, not adopted

All three failures are one class: the model emitting JSON that does not conform. The adapter declares `structuredOutput: false`, so conformance rests entirely on prompt instruction plus validation (`AI §10.2`'s documented degradation). **`output_config.format` — real structured outputs — directly targets this and is the indicated architectural lever.** ⚠️ **Not adopted, not scheduled, and it would require its own decision record.**

**Not done, deliberately:** no D-record for the rejected configuration; no DB-contract change to capture `thinking_tokens` (available from the API, not carried through persistence); no rename of `fallbackUsed`, which collapses `AI §10.2` degradation strings to a boolean under a misleading name — a real wart, but no acceptance criterion requires it.

**The Sonnet 4.5 measurements elsewhere in this file remain Sonnet 4.5 measurements and are not relabelled.**

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
| **[D-41](16-D-41-Anonymous-Export-Deviation.md)** | Active. Anonymous export permitted; **no `EXPORT` row and no `M-4` signal** until a real authenticated owner exists. Ownership checks are written now and enforced when there is something to enforce. `APIQ-2` resolved as the direct on-demand response |
| **[D-42](17-D-42-Export-Response-Contract.md)** | Active. `export_id`, `download_url` and `expires_at` are **absent, not null**; the document is the response body; success is `200`. Extends D-41 and invents nothing |
| **Export authentication** | **Not built, and not being deferred quietly** — D-41 §6 leaves whether anonymous export survives M-15 as an owner decision. `API §7.8` currently says it should not |
| **[D-43](18-D-43-PDF-Rendering-Approach.md)** | Active. `SA AQ-3` resolved: headless system browser via `playwright-core`, no bundled browser, no paid service. PDF is a rendering of the Markdown — **no second content model** |
| **`FR-006` input persistence** | **Built.** Client-side only — `localStorage`, no server storage, no identity |
| **`FR-014` correction** | **Built.** Creates a new analysis; the original is never mutated (`API §7.5`, `DB DP-3`). Skips Stage 1, so a correction costs nothing |
| **Sprint 4 deliverables** | **Complete.** Exit criteria not all demonstrated — see Non-Claims 18 |
| **M-17 accessibility** | **Implemented, NOT verified.** Four violations fixed and axe running; the manual checklist is unwalked and M-17 stays unearned (D-49) |
| **M-18 security** | **Reviewed, NOT passed.** Complete against `PRD §9.3`; `NFR-027` found and fixed, `NFR-021` unresolved. Its own criterion forbids a pass with an open high-severity finding |
| **M-16 instrumentation** | **Built.** Seven metrics computed; M-6/M-8/M-9 named as manual review and never emitted as series |
| **`/internal/*`** | **Operator credential only** (D-48). A user or anonymous token is refused. Absent configuration disables the surface |
| **`API-071`/`072`/`073`** | **Not implemented, and not authorised by D-48.** `API-073` needs its own scope |
| **M-15 authentication** | **Built and live-verified.** Sessions, rotation with reuse detection, ownership enforcement, history, deletion, anonymous claim and expiry |
| **`M-4` export rate** | **Instrumented, no data.** Series starts at the M-15 date; never backfilled (D-41 §6) |
| **Rate limiting** | **In-memory only** (D-46). Single-instance; values provisional (D-47). `APIQ-3` open |
| **Refusal handling** | **Built.** `API §9.3` 422s on retrieval, halt persisted additively, no historical data invented. Never exercised from a real provider run |
| **PDF export** | **Built.** Needs a Chromium-family browser on the host; refuses with a corrective action where there is none, never silently downgraded |
| **M-15 authentication** | **Not pulled forward, in whole or in part.** D-41 §7 and the owner's explicit instruction |

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

⚠️ **SPRINT 5 HAS NO REMAINING CODE INCREMENT — recorded on the owner's instruction, 2026-09-08.** Every remaining item is an external or evidence dependency. That is a real state to report, not a stall to work around, and **no code task should be invented to fill it**.

**The five dependencies, and what each one discharges.** They are listed separately and do not substitute for one another — collapsing them is how a milestone gets reported as passed on the strength of a different dependency being met:

| Dependency | Discharges |
|---|---|
| **Host / domain** | **M-19** deployment verification — and with it `NFR-020` TLS, the rollback drill, a restore drill on real data, off-host backup storage, alert delivery to a real person |
| **AWS KMS credentials + key** | **Real encryption verification** — `DB §13.1` row 3, closing `M-18` H-2 |
| **Optional provider spend (~$8)** | **M-20 provider metrics** — `NFR-001`/`NFR-002`. ⚠️ Optional; declining is a complete answer |
| **A human reviewer** | **M-08** rubric review |
| **A screen-reader / keyboard reviewer** | **M-17** manual WCAG walk |

**The owner is deciding what to provision next.** The items below give the detail behind each.

**A. Provision a production host and a domain.** This is the one that unblocks the most: `M-19` cannot close without it, and neither can TLS verification (`NFR-020`), the rollback drill ([D-50](25-D-50-Deployment-Topology.md) §4), a restore drill against real data ([D-51](26-D-51-Self-Hosted-PostgreSQL.md) §4), off-host backup storage, or alert delivery to a real person. **`M-20` now also depends on it** — production traffic through `M-16`'s instrumentation is the free way to measure `NFR-001`/`NFR-002` ([D-58](33-D-58-Representative-Load.md) §4). Owner's to provision.

**B. Create the AWS KMS key.** 4 skipped tests in `tests/integration/kms-live.test.ts` are the only thing that can verify `DB §13.1` row 3 and close `M-18` H-2. Owner has taken this; no credentials exist yet. Re-verify pricing against the official page before creating the key — the D-52 §3 figures were re-checked 2026-09-08 and are an estimate on their date.

**C. Authorise ~$8 of provider spend for an `NFR-001`/`NFR-002` measurement**, *or* decline it and wait for production traffic. Either answer closes the question D-58 §4 leaves open; declining is the cheaper and stronger option, and it folds into A. ▶ **2026-09-09 update:** both were measured (log §7, §8) and NOT MET; [D-66](41-D-66-Intent-Brief-Early-Artifact.md) is now built for `NFR-001`. **What is next is the owner's authorisation to deploy it in replay mode (rebuild, publish the sixth artifact schema, rollback tag) and then a live D-58 sample of first-artifact time** — the remaining task budget is stated in the handoff.

**D. Walk the WCAG AA checklist** (`docs/accessibility/WCAG-AA-CHECKLIST.md`, empty result table) — needs a person with a screen reader. **E. The M-08 rubric review** — needs a human reviewer, carried since Sprint 2.

**F. Authorise the JD capture and fragment activation, or not.** Unchanged, and still the gate on M-08, M-10 and M-11 measurement.

**A. (resolved)** The old item A here — whether the Chromium dependency is acceptable on the deployment host — was **discharged by `M-19` Phase 1**: `backend/Dockerfile` installs distribution Chromium and a non-root render was verified in-container, with and without the seccomp profile.

### The next roadmap milestone

**M-15 is done.** What follows is the rest of Sprint 5, in the order its dependencies allow:

| Milestone | State | What it now needs |
|---|---|---|
| **M-16** Instrumentation | Unstarted, **unblocked by M-15** | `EXPORT` exists so `M-4` can report; `FEEDBACK` exists so `API-050` and `M-7` can be built; identity exists so `M-5` return rate is definable. `API-050` feedback capture is the missing endpoint |
| **M-17** Accessibility | Unstarted | A WCAG 2.1 AA pass over the primary flows. Sprint 3 avoided colour-only encoding specifically to keep this cheap |
| **M-18** Security | **Reviewed, not passed** | Done, and it did receive D-46/D-48 as inputs rather than discoveries. Blocked on `NFR-021`, which needs M-19 key management |
| **M-19** Deployment | **All 4 phases built, NOT passed** | Phase 1 containerised it (non-root, Chromium sandbox genuinely on, proved by differential). Phase 2 added the TLS edge, same-origin client and production compose ([D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md)) — **TLS itself unverified**. Phase 3 added application-level encryption and the durable purge outbox ([D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md)) — **KMS itself unverified**. Phase 4 added monitoring, alerting, backups, a **passing restore drill** and the data-policy page ([D-56](31-D-56-Monitoring-Alerting-And-The-Drills.md)) — but the restore drill ran on the development database and **the rollback drill has not happened**, because D-50 §4 requires it on production. ⚠️ The criterion is a *deployed* service with verified rollback; nothing is deployed |
| **M-20** Performance | **Measured, NOT passed** | [D-58](33-D-58-Representative-Load.md) defines "representative load", which no document previously did. `NFR-003`/`004`/`005` are **measured and passing** on a dev machine at 1,000 analyses of history ([the log](performance/M-20-LATENCY-LOG.md)). ⚠️ `NFR-001`/`NFR-002` — the two the milestone actually names — are **UNMEASURED**: both are provider-dominated and every run is replay. Closes on authorised spend (~$8) or on production traffic through `M-16`'s metrics |

**The superseded next-increment note:**

**M-15 — Authentication and history (Sprint 5).** `docs/08` lists Sprint 5 as M-15 through M-20, and M-15 is first because everything else in that sprint depends on identity: history (`FR-060`–`FR-063`) needs an owner, `M-16` instrumentation needs `M-4` to mean something, account settings and deletion need an account, and `API-050` feedback is `Auth: Required`.

**M-15 also closes four things this project is currently carrying as debt**, each recorded above:

| Carried debt | How M-15 closes it |
|---|---|
| `FR-004` claimability unmet — `API-020` stores an anonymous token nobody is issued | Token issuance and the claim-on-signup flow |
| **D-41 / D-42** — no `EXPORT` row, no `M-4`, no `export_id` | An authenticated owner exists, so the row is written and the fields become real |
| Ownership unenforced on `API-021`, `API-026`, `API-040` | The branches are already written and read `user_id`; M-15 supplies the identity |
| `FR-014` correction is session-scoped | History makes the stored content retrievable, so any analysis becomes correctable |

⚠️ **M-15 is explicitly out of bounds under the standing constraint** ("do not pull M-15 authentication forward"), which was written while Sprint 4 was open. Sprint 4 is now closed, so that constraint has served its purpose and starting Sprint 5 is an owner decision rather than a deviation.

**M-19 deployment also acquires a new prerequisite** from [D-43](18-D-43-PDF-Rendering-Approach.md): a Chromium-family browser on the host, and the Linux verification deferred there.

`FR-034` is implemented and offline-verified, so the engineering half of D-39's condition 2 is done and condition 1 was already met on the JD path. What remains between here and a runnable M-08 is not code:

1. **Activate fragment v3** — blocked by `DB §4.5`, which requires a clean regression pass reference covering the cases the fragment composes into
2. **Capture the JD corpus** — roughly 10 cases, on the order of £3, and the same run supplies the reference activation needs
3. **Secure a qualifying human reviewer** — `docs/10` §4.3; ambiguity A-1 has been open since the rubric was written
4. **Run the review** and record its result, pass or fail

Steps 1 and 2 are one spend decision. Step 3 is a resourcing decision and is independent of it.

Decision B would also close **M-13 limitation 2** as a side effect: a stored `technical_assessment` analysis is the only thing standing between the Mermaid export path and end-to-end verification.

Still authorised under D-39 and not started:

- **D-38 remediation** — `unknown_disposition[]` plus its disposition check. Independent of `FR-034`; also unactivatable without a capture

Still permitted and still non-reasoning, if preferred first:

- `analysis.model_version_id` is never written on the API path — `AI-004` drift attribution is lost on every run
- `provider_invocation.attempt_number` always reports `1`
- The backend binds `0.0.0.0` with no env override
- `API-025` SSE — implemented; closing the two Sprint 3 exit criteria still needs a forced-disconnect test and a streaming/polling comparison

`VALIDATION_EVENT` is **not** in that list: D-37's out-of-scope section names it, so it needs an explicit deviation of the kind `ARTIFACT` persistence received.

---

## Git State

| | |
|---|---|
| Branch | `main` |
| HEAD | `6af9c11` — "M-20 performance: measured, defined the bar, and did not pass the milestone", 2026-09-08 |
| Working tree | **Clean** as of the M-20 commit below |

**Sprint 5 commits, most recent first:**

| Commit | What |
|---|---|
| `6af9c11` | **M-20 performance** — the benchmark, [D-58](33-D-58-Representative-Load.md) defining representative load, and [the latency log](performance/M-20-LATENCY-LOG.md) |
| `1c0a86c` | M-19 Phase 4a — sealed column rename + `data_format` startup guard, [D-57](32-D-57-Rollback-Across-A-Data-Format-Change.md) |
| `7c0f7e2` | M-19 Phase 4 — monitoring, alerting, restore drill, data policy, [D-56](31-D-56-Monitoring-Alerting-And-The-Drills.md) |
| `a7d06c2` | M-19 Phase 3 — application-level encryption, durable purge outbox, [D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md) |
| `d7fd2e0` | M-19 Phase 2 — TLS edge, same-origin client, proxy trust, IP-hash salt, [D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md) |
| `54ac225` | M-19 Phase 1 — containerise, non-root, sandbox actually enabled |
| `ef90788` | M-19 decisions D-50 … D-53 + the M-18 mislabel correction |
| `07d5a55` | M-18 security review |
| `4b138ba` | M-17 accessibility |

**Earlier — what `dcabef5` contains.** The Sprint 3 carry-over (M-11 paths, M-12 presenters) *and* all of Sprint 4 (M-13 export in both formats, M-14 degradation, `API §9.3` refusal handling, `FR-006`, `FR-014`), plus [D-40](15-D-40-Existing-Workflow-Module-Mapping.md), [D-41](16-D-41-Anonymous-Export-Deviation.md), [D-42](17-D-42-Export-Response-Contract.md) and [D-43](18-D-43-PDF-Rendering-Approach.md).

The two sprints are in one commit because they **cannot be separated**: the export renders the artifact types M-11 added, and M-12's presenters are what its section order mirrors. Splitting them would produce a commit that does not build.

Earlier work, pushed 2026-09-07: `3df4c55` (persistence, publication, orchestrator, API, jsonb fix, `API-020` owner fix, informed regeneration), `edd4401` (M-12 frontend), `d9f0479` (D-37 and this file), `c7f23b3` (`FR-034` at Stage 7, D-39 amendment).

⚠️ **The "Uncommitted" list that used to sit here is gone because it is empty.** The review-packet work it named was committed with Sprint 4.

---

## Verification

All re-run 2026-09-08 against the current working tree.

⚠️ **`npm run bench` is NOT part of this gate.** It seeds and deletes real rows
in the development database and takes a couple of minutes. It is run
deliberately, and its results live in
[the latency log](performance/M-20-LATENCY-LOG.md) — never inferred from a green
test run.

| Gate | Result |
|---|---|
| Backend tests | **897 tests · 891 pass · 0 fail · 6 skipped** |
| Backend typecheck | pass (`src` + tests) |
| Backend lint (oxlint) | pass |
| Backend format (prettier) | pass |
| Boundary checks | **8 enforcing · 0 inactive · 0 failing** |
| Frontend typecheck | pass |
| Frontend lint | pass |
| Frontend production build | pass |
| `prisma migrate status` | Database schema is up to date |
| `schemas:check` | 5 artifact schemas published and matching |
| `fragments:check` | 15 fragments match the manifest (v3 and the two M-11 fragments authored, **not activated**) |

⚠️ **The 6 skips are 2 live-provider tests and 4 live-KMS tests**, all credential-gated. The KMS four are the only evidence real key management works, and while they skip `DB §13.1` row 3 is implemented but **unverified**. The paragraph below describes the earlier 839-test run and its 2 skips; it is retained because the reasoning about *reading* a skip count still applies.

The 2 skips are credential-gated live-provider tests, skipped by design. Database-backed tests **run** — both stores are reachable. **`FR-014` correction added 11 tests**, including a **control test**: one asserts that an overridden run never reaches a provider for classification, and its pair asserts that an ordinary run *does* — without the second, the first would pass for the wrong reason if Stage 1 stopped calling anything at all. **Refusal handling added 25 tests**: 19 offline (both halt paths persisted, both 422 shapes with their payloads, the export refusal document, and — deliberately — that completed, degraded, timed-out and historical-null analyses are all **unchanged**) and 6 against real Postgres (round-trip of both refusals, the additive-migration guarantee, and both halves of the CHECK constraint). **M-13 added 65 tests**: 32 unit for the Markdown document and the `docs/09` §2 risk scale (every matrix cell pinned against the published table), 17 integration for `API-040` (including the D-42 behaviours that most need protecting from a later "fix" that mints an id), and 16 for the PDF path — 9 unit on Markdown → HTML, 7 integration through a real browser. **The 7 browser tests skip where no Chromium-family browser exists**, the way the live-provider tests skip without credentials; a skip there means PDF was not exercised on that run, not that it passed.

⚠️ **The 2 skips in this run are the live-provider tests, not the browser tests.** Chrome was present, so **all 7 browser tests ran and passed** and the browser-skip count was **0**. The distinction matters when reading a future run: "2 skipped" with a browser present is the normal result, while "9 skipped" would mean PDF went unexercised entirely.

⚠️ **The skip count is only meaningful with Docker running.** When Docker Desktop is down, Postgres is unreachable and the skips rise sharply — this run showed 29 skipped before Docker was started and 2 after, with the same 656 tests. Start Docker before reading anything into a skip count.

**Database state:** primary — 20 analyses, 1 recommendation, 21 required capabilities, 1 artifact, 1 artifact schema, 261 context elements, 14 active fragment versions. Trace — 323 stage traces, 77 provider invocations, **0 validation events**. **`EXPORT` — 0 rows, by decision (D-41).**

---

## Discrepancies Against Other Documents

Recorded, not silently reconciled. **This file does not amend the roadmap or the decision register.**

1. **Roadmap Appendix B (Carry-Forward Register) is empty** while `docs/12` D-37 records M-08 as carried into Sprint 3. The register should hold that entry and does not.
2. **Sprint 3's stated dependency — "Sprint 2 quality gate passed" — is unmet.** D-37 records this as a deliberate deviation. The roadmap itself is unamended.
3. **D-37's out-of-scope list names "`ARTIFACT` persistence and the `VALIDATION_EVENT` attribution."** `ARTIFACT` persistence was subsequently implemented under an explicit owner decision ("model ARTIFACT now", 2026-09-06). D-37 has not been amended to reflect that. `VALIDATION_EVENT` remains out of scope and unimplemented.
4. **Roadmap Appendix C item 6** lists `AIQ-5` fragment storage as Sprint 1 and open; it was resolved earlier. Appendix C has been stale before on this exact item.
5. **M-05 is listed as a Sprint 1–2 milestone** but 4 of 12 stages remain unimplemented. It is neither claimed nor formally carried forward anywhere.
6. **Sprint 3 exit criteria include stream resumption and a streaming/polling comparison.** `API-025` is now implemented, so both are attemptable — neither has been attempted.
7. **`API-040` forbids anonymous export in three places** — its own `Auth: Required` row, `API §7.8`'s "Not permitted" table, and `DB §4.4`'s non-null `user_id` — and the implementation permits it. [D-41](16-D-41-Anonymous-Export-Deviation.md) records the deviation; `docs/07` is unamended.
8. **`API-040`'s output contract is unconditional and the implementation returns none of it.** [D-42](17-D-42-Export-Response-Contract.md) explains why each of the three fields is unsatisfiable under D-41; `docs/07` §6.5 is unamended and still specifies them.
9. **`SA AQ-3` was due Sprint 4 and is open.** The investigation is complete — Mermaid needs a DOM, so only a headless browser renders diagrams — but no approach has been chosen, so the question stands rather than resolves.
10. **`API §9.4`'s error flow places the two 422s inside request processing**, which assumes a synchronous analysis. Execution is asynchronous — `API-020` returns 202 before Stage 1 runs — so the refusal cannot be known while the creating request is open, and the 422 is raised on `API-021` retrieval instead. The status codes and payloads are exactly as `API §9.3` specifies; only the endpoint that carries them differs, and `docs/07` is unamended.
11. **`SA §14` deployment assumes a Node runtime and nothing else.** PDF export adds a Chromium-family browser as a host requirement. No deployment document records it, because no deployment exists; [D-43](18-D-43-PDF-Rendering-Approach.md) §5 states the cost and M-19 is where it lands.
