# NAIGX — Session Handoff

**Written:** 2026-09-07
**Purpose:** hand a new chat session everything it needs to continue building NAIGX without re-deriving context or re-litigating settled decisions.

> **Read this first, then `docs/STATUS.md`.** STATUS.md is the authoritative current-state record. This file covers what happened in the most recent working session, what is *not yet reflected* in STATUS.md, and the exact next step.

---

## 1. What NAIGX is

Gian's **personal AI/automation intelligence system**. It analyses job descriptions, assesses client opportunities, identifies automation/AI implementation requirements, and evaluates his fit and gaps.

**It is explicitly NOT primarily a portfolio project.** Do not frame work as portfolio-building.

**Stack:** TypeScript · Node 24 · Fastify · Prisma 7 · two PostgreSQL databases (primary + trace) · `node:test` · oxlint · prettier · React/Vite frontend.

---

## 2. How the owner wants you to work

These are standing instructions given explicitly. **They override default thoroughness instincts.**

- **"I'm vibe coding and learning the engineering concepts while building."** Keep explanations focused on: what we're building, why it exists, what's changing, what he needs to understand.
- **"Build first. Learn along the way. Polish and optimize after the project is built."**
- **"Don't optimize the workflow around exhaustive review cycles or theoretical future blockers."**
- **"No additional audit/review cycle. Build forward."**
- Do **not** repeatedly stop to investigate hypothetical future blockers. Surface a real blocker once, in one or two sentences, then keep building.
- Treat M-08 / D-37 / D-39 as **documented project-state constraints, not reasons to stop**.
- The goal is **BUILD COMPLETION**, not proving completion.

**Escalate only for genuine forks** — decisions where proceeding under any assumption would be wrong. Recent examples that *were* worth asking: the export-vs-auth sequencing conflict (became D-41).

---

## 3. Where the project is

**Sprint 3 of seven (Sprint 0 → Sprint 6), moving into Sprint 4.**

### Completed this session

| Milestone | State |
|---|---|
| **M-11** All analysis paths | **4 of 4 implemented, 0 of 4 measured.** All four reasoning paths run end to end offline. |
| **M-12** Frontend foundation | **Implementation complete, not demonstrated.** Hierarchy, layered depth, streaming, and all five artifact presenters built. |
| **M-14** Degradation | **Complete.** `FR-091`, `FR-093`, `FR-094`, `NFR-011`, `API-032`. |
| **M-13** Export system | **Plan delivered, awaiting approval. No code written yet.** |

### Decision records written this session

- **`docs/15` D-40** — Existing-workflow module mapping. `AI §4.2` is the *path* table; **`AI §7.1` is the reasoning-module table** with the *Applies to* column. The mapping was never missing — the code cited the wrong section. Also records that the observed workflow structure is stored through `ArchitectureModel`/`ArchitectureComponent` ("the entity is the same; the provenance is opposite"), which satisfies `RiskItem.component_id` NOT NULL **with no migration**.
- **`docs/16` D-41** — Anonymous export deviation. See §6.

---

## 4. What was built this session, in order

### M-11 — the two remaining reasoning paths

- **Stage 6W `workflow_review`** (`backend/src/nie/stages/workflow-review.ts`) — Stage 6's *second generator*. Three refusals from `FR-021`: structure stated before findings; every finding cites a resolvable step; empty findings require a `soundness_statement`. Traces under its own `stageKey` via a `stageKey` override on `runStage`.
- **`technical_assessment`** — `parseArchitecture` gained a third parameter requiring `FR-023` accepted trade-offs and ≥1 named rejected alternative *with its reason*, on that path only.
- **Four artifacts rendered, not generated** (`backend/src/nie/stages/derived-artifacts.ts`) — Workflow Recommendation, Risk Assessment, Assessment Feedback, Mermaid Diagram. **No provider call.** They restate reasoning already done, so rendering means the artifact cannot disagree with its source.
- **Persistence with no migration** — `persistWorkflowFindings` writes `RiskItem` rows against components persisted immediately before.

### M-12 — artifact presenters

- Four React components + native Mermaid rendering (dynamically imported, stays out of the main bundle).
- `AnalysisView.tsx`'s hardcoded "section 5 = portfolio suggestions" became a **type→presenter registry**; the artifact block is now whatever the classified path produced, and closing sections renumber after it.
- **Risk score and band derived at presentation from `docs/09` §2, never stored** — a stored band would silently mean something different after a scale revision.

### M-14 — degradation (Phase 1 of Sprint 4)

- **`FR-094` timeout — was entirely absent.** `timed_out` sat in the status enum and `timeoutFlag` was readable through `API-021`/`API-026`, but **nothing ever set either**, so every over-long run reported a plain completion. Now a deadline race writes `status: "timed_out"` + both flags + the terminal event. Preservation is inherited free from `DB §6.2` progressive persistence — the timeout abandons *waiting*, it rolls nothing back.
- **`API-032` retry** — route + `regenerateArtifact` seam on the pipeline. Reads stored reasoning via `src/db/recommendation-reader.ts`; **does not re-run stages 1–8**. Four refusal paths, each naming a corrective action: succeeded → 409, omitted → 409, still running → 409, **deterministic rendered artifact → 409** (a retry would recompute the identical document). No auth gate — `API §7.8` explicitly permits anonymous retry.
- **`artifact_failed` gained `retryAvailable`** — `API §7.4` requires it; ours carried only type and reason. Same predicate the endpoint uses, so the stream cannot advertise a retry the API refuses.
- **`FR-093` verified, not rebuilt** — `ProviderError` has no field a provider name could occupy.

---

## 5. Architectural decisions — do not re-litigate

- **`RecommendationForArtifacts` is deliberately narrower than `RecommendationResult`.** `groundedInContextIndices` are *positions* in the Stage 3 element list; the database stores grounding as `CONTEXT_REFERENCE` rows pointing at element **ids**, and `CONTEXT_ELEMENT` has no ordinal column. Recovering positions would re-derive an order nothing recorded. Stage 9 never reads that field. `StoredRecommendation` stays narrow on purpose.
- **The NIE never imports persistence or transport** (`AD-02`/`AP-3`, boundary check 2). It declares ports; the composition root supplies implementations.
- **Stage modules are reachable only through `pipeline.ts`** (boundary check 6). The `API-032` regeneration seam lives *in the pipeline* for this reason.
- **`GENERATED_ARTIFACT_TYPES` vs rendered** — retryability is a property of how an artifact is produced. Only `portfolio_suggestions` is provider-generated.
- **Mermaid requires a DOM even to parse.** Proven: `DOMPurify.addHook is not a function`. This kills any document-library PDF approach that must render diagrams.
- **`sendSuccess(request, reply, data, status)`** takes status as its *fourth argument* and overrides any earlier `.code()`.

---

## 6. Standing constraints — every one is current

| Constraint | Source |
|---|---|
| **No provider spend, no live capture.** Replay mode is default and free. | Owner, repeatedly |
| **Prompt fragments stay inactive.** Newly authored/changed fragments are recorded in the manifest but not activated. | **D-39** |
| **Do not pull M-15 authentication forward.** | Owner, explicit |
| **No M-08 packet review, no rubric verdicts.** AI review is excluded "in any capacity, for any criterion". | `docs/10` §4.3 |
| **Do not implement `platform_recommendation`** / expand `business_requirement`. Recorded as an open M-07 scope decision. | Owner, explicit |
| **Do not add frontend test infrastructure** (no Vitest) or other unrelated infrastructure. | Owner, explicit |
| **D-41 in force:** anonymous export permitted; `EXPORT` row and the `M-4` metric written **only when a real owner exists**; `APIQ-2` resolved as direct on-demand response — no file storage, no signed URLs. | **D-41** |

---

## 7. THE NEXT STEP

**M-13 — Export System. The plan has been delivered and is awaiting the owner's approval. No export code has been written.**

### Approved constraints for M-13

- Markdown first, **then** PDF.
- Provenance, confidence-unavailable state, metadata, and explicit omitted-artifact disclosure must survive export.
- **One serialization model shared by export and `FR-053` copy-to-clipboard, so they cannot drift.**
- No marketing content (`FR-051`).
- **Markdown is the sanctioned fallback if PDF/diagram rendering proves problematic** — the roadmap says so itself.
- M-14's degradation labels are an *input*: partial/failed/omitted artifacts stay clearly labelled rather than disappearing.

### The plan as presented

**Serialization architecture.** `API-040` is server-side, so the serializer must live in the backend — the frontend cannot hold its own copy. Extract `API-021`'s currently-inline read into `src/db/analysis-reader.ts`, then:

```
analysis-reader.ts ──> API-021 (JSON)
                  └──> export/markdown.ts ──> API-040 (Markdown)
                                          └──> export/pdf.ts (Markdown → HTML → PDF)
```

**Copy-to-clipboard is a partial export of one artifact** — `FR-052`'s `artifact_types` selection already specifies exactly this, so the copy control fetches from the same endpoint. One serializer; PDF is downstream of the same Markdown.

**`SA §3.8` is the governing constraint:** *"Export is a pure transformation of stored artifacts. Never generates content, invokes the NIE, or alters analysis substance."*

**PDF approach.** `SA AQ-3` is open and due this sprint. Because Mermaid needs a DOM, a document library (pdfkit/pdfmake) **cannot** render diagrams. The only real option is a **headless browser (Playwright)** — ~300MB dependency, CI implications. Recommendation: complete and ship Markdown first, attempt PDF as a separate increment.

### Three blockers raised, awaiting the owner's response

1. **PDF diagram rendering cannot be verified end-to-end this sprint.** Only `technical_assessment` produces a Mermaid diagram, and no stored analysis of that path exists (fragments inactive under D-39, no recording). Same blocker as M-12 limitation 3.
2. **`API-040` returns `export_id` + `download_url` for a file that is never stored.** Under D-41 no `EXPORT` row is written anonymously, so `export_id` would reference nothing. Proposal: return the document directly from `API-040`; `API-041` regenerates from the analysis id; `export_id` present only when a row was actually written. **This is a further small deviation in the same family as D-41 — the owner was asked whether to amend D-41 to cover it, and has not yet answered.**
3. **`NFR-005` (export ≤10s p95) is unmeasured** and will stay so; no load measurement exists in this project.

---

## 8. Outstanding housekeeping

- **`docs/STATUS.md` has NOT been updated for M-14 / Phase 1 / D-41.** It currently reflects state through M-12. Update it when M-13 lands, or sooner if asked.
- **Nothing has been committed this session.** The working tree carries all of M-11, M-12, M-14 and D-40/D-41. Last commit is `c7f23b3`. Commit only when asked.

---

## 9. Verification — run all of these

```bash
# backend (from backend/)
npm test              # 607 tests, 605 pass, 0 fail, 2 skipped
npm run typecheck
npm run lint
npm run format:check
npm run fragments:check   # 15 fragments match the manifest
npm run schemas:check     # 5 artifact schemas published and matching

# frontend (from frontend/)
npx tsc -b && npm run lint && npm run build

# repo root
node tools/boundary-checks/check.mjs   # 8 enforcing · 0 failing
```

**Known environment note:** 2 tests skip when Docker Desktop is not running (Postgres unreachable). That is environmental, not a regression. When Docker is down the skip count rises sharply — start Docker before treating skips as meaningful.

---

## 10. Document map

| File | What it is |
|---|---|
| `docs/STATUS.md` | **Authoritative current state.** Wins over any other doc on *current state* — but not on requirements. |
| `docs/02-PRD` | `FR-*` and `NFR-*` requirements |
| `docs/04-SA` | System architecture, `AQ-*` open questions |
| `docs/05-AI` | Stage definitions, **`§7.1` is the reasoning-module table** |
| `docs/06-DB` | Schema design, `DB §*` |
| `docs/07-API` | `API-*` endpoint contracts, `§7.x` semantics, `§9.x` errors, `APIQ-*` |
| `docs/08` | Engineering roadmap — sprints, milestones, exit criteria |
| `docs/09` | Scoring scales — **§2 risk severity/likelihood/score/bands** |
| `docs/10` | Reasoning quality rubric (**§4.3 excludes AI review**) |
| `docs/12` | Decision record D-1 … D-37 |
| `docs/13`–`docs/22` | D-38 … D-47 as standalone records |

**Numbering convention:** the next standalone decision record is **`docs/23` D-48**.
