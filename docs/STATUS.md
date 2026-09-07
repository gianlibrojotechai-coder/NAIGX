# NAIGX Status

**Last updated:** 2026-09-07
**Maintained as:** the operational source of truth. Where this file and any other document disagree about *current state*, this file wins. It does not override specifications — `02-PRD`, `04-SA`, `05-AI`, `06-DB`, `07-API` remain authoritative for *requirements*, and `12-Sprint-1-Decision-Record` for *decisions*.

---

## Current Position

- **Current sprint:** Sprint 5 (Persistence, identity, instrumentation) of seven — Sprint 0 through Sprint 6. Sprint 3 was entered under a recorded deviation, `docs/12` D-37, **amended 2026-09-07 by [D-39](14-D-39-D-37-Amendment.md)**; its exit criterion is still not claimed, and Sprint 3 milestones are carried rather than closed.
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
2. **The trace-purge queue is in-process.** A restart between the primary-store commit and the purge loses the instruction, leaving traces the user asked to be deleted. Bounded by `DB §8.3`, which expires stage traces at 7 days regardless, so the worst case is **delay, not indefinite retention**. Closing it needs a durable queue — `M-19` infrastructure of the same kind [D-46](21-D-46-In-Memory-Rate-Limiting.md) deferred. The alternatives were worse: refusing deletion until traces are gone turns a trace-store outage into a refusal to honour `FR-073`.
3. **`FR-062` search matches input text and not artifact content.** The requirement asks for both. Matching content would join exactly the tables `API-022` keeps this query off, and that boundary is a privacy property as much as a performance one. **`FR-062` is therefore partial**, and closing it needs a search index rather than a wider join.
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
| **M-18 `NFR-021` encryption** | **Unimplemented.** Confidential content is stored in plaintext. Needs a managed key service, so it lands with M-19 — and it is the finding that keeps M-18 unpassed. |
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
| **`NFR-005` export latency** | **Unmeasured.** No load measurement exists in this project. |

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
5. **No production deployment exists.** Nothing is deployed anywhere. M-19 Phases 1–2 have built the *means* to deploy — a non-root container with a working Chromium sandbox, and a TLS edge with a production compose — but nothing has been run on a host, no domain exists, and there is no monitoring, alerting or rollback. **Having a deployable stack is not a deployment.**
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
36. **⚠️ M-18 IS NOT PASSED.** Its milestone line is "review complete; **no unresolved high-severity findings**", and finding H-2 — no application-level encryption of confidential content, `DB §13.1` row 3 — is unresolved. The review is complete; the criterion is not met. See [the review](security/M-18-SECURITY-REVIEW.md).
37. **The security review is not independent.** It was performed by the same agent that wrote the code, and shares its blind spots by construction. No project document forbids that — `docs/10` §4.3 excludes AI review for the *reasoning rubric* specifically and nothing extends it here — so the review is admissible evidence and is **not** equivalent to an independent one. `AC-026`'s "review completed" should be read against that, and an independent review belongs before beta.
38. **Two encryption layers are unmet, and they are different requirements** ([D-53](28-D-53-Encryption-Layers.md) §1). `NFR-021` — "stored analysis content encrypted at rest" — maps to **full-volume** encryption and is unmet because nothing is deployed; it costs nothing to fix. `DB §13.1` row 3 requires **application-level** encryption on `raw_content`, `structured_input` and `structured_output`, carries **no requirement number**, and is the one that states the actual security property. All three fields are plaintext today. ⚠️ **The M-18 review originally labelled the second one `NFR-021`; that was wrong and is corrected in place.** The verdict did not change — both are unmet. **Neither may be closed by a locally-held key** ([D-52](27-D-52-Managed-Key-Service.md) §4), and `NFR-021` alone must not be reported as satisfying `DB §13.1`.
39. **`NFR-020` is implemented but UNVERIFIED, and still unmet in practice.** M-19 Phase 2 put Caddy at the edge with automatic Let's Encrypt, TLS 1.2 as the floor and HSTS ([D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md)). **No certificate has ever been issued by that configuration** — the ACME exchange needs a public domain and DNS pointing at a reachable host, and neither exists. Everything *beneath* the TLS layer was verified end to end over plain HTTP against the built images; the TLS layer itself was not. Nothing is deployed, so the requirement is not met — and a green routing check is not evidence toward it.
42. **⚠️ Full-volume encryption on a rented VPS is weak, and only a narrow claim is made for it** ([D-53](28-D-53-Encryption-Layers.md) §3). Unattended reboot needs the unlock material on or near the machine, and the host operator can read RAM. What it genuinely defends is disk decommissioning and physical media handling. It must not be described as protecting content from a host compromise — that is what the application-level layer is for.
43. **`NFR-051` is not met, and a working single-instance deployment is not evidence toward it** ([D-50](25-D-50-Deployment-Topology.md) §3). "Horizontally scalable without code change" is false: the rate limiter holds process state and SSE needs affinity. `AP-3` statelessness is necessary and not sufficient.
44. **Backups do not prove recoverability; a restore drill does** ([D-51](26-D-51-Self-Hosted-PostgreSQL.md) §4). Until a dump has been restored and verified with a recorded date, no recovery claim may be made.
45. **Immediate physical eradication of deleted content from all media is not claimed.** Backups containing it are retained a maximum of **7 days** (`DBQ-7`, resolved by [D-51](26-D-51-Self-Hosted-PostgreSQL.md) §3) and the window is disclosed in the data policy rather than omitted.
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

**Two independent decisions, either of which unblocks real work.**

**A. Decide whether the Chromium dependency is acceptable on the deployment host** — and, if so, verify PDF on Linux. `SA AQ-3` itself is closed by [D-43](18-D-43-PDF-Rendering-Approach.md); what is open is operational. PDF export works and is unverified anywhere but Windows, because nothing is deployed. Verifying it needs either a container for the app (there is none — `docker-compose.yml` runs Postgres only) or a host with `chromium` installed. **Markdown needs none of this**, so the decision is about PDF alone and can wait without blocking export.

**B. Authorise the JD capture and fragment activation, or not.** Unchanged, and still the gate on M-08, M-10 and M-11 measurement.

**C. Sprint 4 is deliverable-complete as of 2026-09-07.** Nothing remains on its list.

### The next roadmap milestone

**M-15 is done.** What follows is the rest of Sprint 5, in the order its dependencies allow:

| Milestone | State | What it now needs |
|---|---|---|
| **M-16** Instrumentation | Unstarted, **unblocked by M-15** | `EXPORT` exists so `M-4` can report; `FEEDBACK` exists so `API-050` and `M-7` can be built; identity exists so `M-5` return rate is definable. `API-050` feedback capture is the missing endpoint |
| **M-17** Accessibility | Unstarted | A WCAG 2.1 AA pass over the primary flows. Sprint 3 avoided colour-only encoding specifically to keep this cheap |
| **M-18** Security | **Reviewed, not passed** | Done, and it did receive D-46/D-48 as inputs rather than discoveries. Blocked on `NFR-021`, which needs M-19 key management |
| **M-19** Deployment | **Phases 1–2 of 4 done, not passed** | Phase 1 containerised it (non-root, Chromium sandbox genuinely on, proved by differential). Phase 2 added the TLS edge, same-origin client and production compose ([D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md)) — **TLS itself unverified**. Phase 3 is encryption + durable purge queue; Phase 4 is monitoring, alerting, rollback drill and the data-policy page. The criterion is a *deployed* service with verified rollback |
| **M-20** Performance | Unstarted | `NFR-001`/`NFR-002` under load. `NFR-005` export latency also remains unmeasured |

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
| HEAD | `dcabef5` — "Close Sprint 4: export, degradation, refusals and correction", 2026-09-07 |
| Working tree | **Clean.** |
| Sprint 4 checkpoint | `dcabef5` — 101 files, +15,723 / −612. Everything uncommitted since `c7f23b3`, committed as one coherent checkpoint |

**What `dcabef5` contains.** The Sprint 3 carry-over (M-11 paths, M-12 presenters) *and* all of Sprint 4 (M-13 export in both formats, M-14 degradation, `API §9.3` refusal handling, `FR-006`, `FR-014`), plus [D-40](15-D-40-Existing-Workflow-Module-Mapping.md), [D-41](16-D-41-Anonymous-Export-Deviation.md), [D-42](17-D-42-Export-Response-Contract.md) and [D-43](18-D-43-PDF-Rendering-Approach.md).

The two sprints are in one commit because they **cannot be separated**: the export renders the artifact types M-11 added, and M-12's presenters are what its section order mirrors. Splitting them would produce a commit that does not build.

Earlier work, pushed 2026-09-07: `3df4c55` (persistence, publication, orchestrator, API, jsonb fix, `API-020` owner fix, informed regeneration), `edd4401` (M-12 frontend), `d9f0479` (D-37 and this file), `c7f23b3` (`FR-034` at Stage 7, D-39 amendment).

Uncommitted: `backend/package.json` (one script), `backend/src/regression/review-packet.ts`, `backend/scripts/review-packets.mts`, `backend/tests/unit/review-packet.test.ts`, and the generated `research/reviews/` bundle.

---

## Verification

All run 2026-09-07 against the current working tree.

| Gate | Result |
|---|---|
| Backend tests | **839 tests · 837 pass · 0 fail · 2 skipped** |
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
