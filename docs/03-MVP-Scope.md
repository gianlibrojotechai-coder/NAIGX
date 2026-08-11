# NAIGX — MVP Scope

**Implementation contract for Version 1.0.**

| Field | Value |
|---|---|
| Product | NAIGX — Automation Intelligence Platform |
| Core engine | NAIGX Intelligence Engine (NIE) |
| Document type | MVP Scope (canonical) |
| Sources of truth | Executive Summary v1.1 · Product Vision v1.1 · PRD v1.0 |
| Function | Defines what Engineering builds for v1.0 and what it does not |
| Version | 1.0 |
| Last updated | 2026-08-11 |

---

## How this document is used

The PRD (`PRD §8–§12`) specifies requirements. This document decides **which of them are built first, in what order, and what is deliberately left out.**

It is an implementation contract, not a specification. It contains no new requirements. Where a feature is named here, its behavior is defined by its PRD requirement IDs — this document adds only priority, sequence, dependency, and justification.

**Contract terms**

- **Scope changes require an amendment.** Adding to §5 or removing from §6 is a recorded decision with a stated reason (Appendix B), not a sprint-planning improvisation.
- **Deferred is not excluded.** §6 distinguishes items deferred on sequencing grounds from items excluded on principle. The two are not renegotiable on the same terms.
- **Sprints are ordered, not scheduled.** No dates. A single operator cannot forecast velocity that has not been observed, and dates invented for a planning document become commitments nobody agreed to.

---

## 1. MVP Philosophy

### 1.1 Why this MVP exists

Not to be a small version of the product. To **falsify one claim as cheaply as possible.**

NAIGX rests on a claim that has never been tested: that architectural reasoning, produced by a system rather than a person, can be good enough that a practitioner will trust it, act on it, and present it to someone who is paying them. Every other question — pricing, segment, expansion, team features — is downstream and irrelevant if that claim is false.

The MVP is therefore designed as an experiment with a product attached, not a product with metrics attached. Its scope is determined entirely by what is required to run the experiment honestly.

### 1.2 Why validation outranks completeness

A feature-complete product built on an unvalidated claim is the most expensive possible way to discover the claim was wrong. The cost is not just the build — it is the months during which the wrong thing was being improved, and the credibility spent shipping it.

There is a second reason specific to this product. NAIGX's asset is trust in its reasoning. Trust is asymmetric: it is earned slowly through consistent quality and lost immediately through one confidently wrong output presented to a client. **A broader v1.0 raises the probability of that failure without improving the evidence gathered.** Breadth is not neutral here; it is actively harmful to the experiment.

### 1.3 Why depth over breadth

The hypothesis in §3 cannot be tested by mediocre output. If a user receives an analysis they cannot trust, the result is uninterpretable — it does not tell us whether Automation Intelligence is viable, only that this implementation was not.

Four input paths executed excellently produce a clean test. Twelve executed adequately produce noise, and a product that has spent its scope budget on surface area it cannot defend.

This is `PV §7`, standing tie-breaker one, applied to scope rather than features: **one reasoning path executed excellently beats five executed adequately.**

### 1.4 The constraint that shapes everything

NAIGX is built by one person. This is not context; it is the binding constraint on scope.

Single-operator capacity means the realistic choice is never "build more, slightly worse." It is "build less, or build badly." Every item in §6 is deferred so that every item in §5 can meet `PRD §14.3` — the release gate that asks whether a competent practitioner would consider the output professional work.

---

## 2. MVP Goals

Each goal is stated with the evidence that would satisfy it. Goals without an evidence column are aspirations.

### 2.1 Business validation goals

| ID | Goal | Evidence that satisfies it |
|---|---|---|
| BV-1 | Establish that generated reasoning is trusted enough to use externally | Export rate ≥ 30% of completed analyses (`PRD M-4`) |
| BV-2 | Establish that value recurs rather than being a novelty | Return rate ≥ 40% within 30 days (`PRD M-5`) |
| BV-3 | Identify which segment converts first | Segment attribution on returning users; consultant and job-seeker paths tracked separately |
| BV-4 | Preserve structural neutrality through launch | No partnership, affiliate, or placement arrangement exists at release (`TC-002`) |

### 2.2 Technical validation goals

| ID | Goal | Evidence that satisfies it |
|---|---|---|
| TV-1 | Structured generation is reliable at production rates | Schema validity 100% at presentation; regeneration rate tracked (`PRD FR-039`, `NFR-084`) |
| TV-2 | Provider independence is real, not asserted | Automated test exercises a second provider (`PRD AI-005`) |
| TV-3 | Reasoning output is stable across runs | Regression suite produces consistent classification and artifact sets (`PRD FR-024`) |
| TV-4 | Unit economics are viable | Cost per analysis recorded and within a defined ceiling (`PRD NFR-083`, `R-13`) |
| TV-5 | Latency is tolerable for the use case | `NFR-001` and `NFR-002` met under representative load |

### 2.3 User validation goals

| ID | Goal | Evidence that satisfies it |
|---|---|---|
| UV-1 | Users can evaluate what they receive | Low-quality flag rate ≤ 5% (`PRD M-7`); qualitative confirmation users can explain recommendations |
| UV-2 | The zero-configuration promise holds | First-time users complete an analysis without documentation (`PRD NFR-070`) |
| UV-3 | Classification is correct enough to be invisible | Classification accuracy ≥ 95%; override rate tracked as the inverse signal (`PRD M-6`) |
| UV-4 | Output is presentation-ready | Exports used externally without reformatting; validated by direct user contact |

### 2.4 Engineering validation goals

| ID | Goal | Evidence that satisfies it |
|---|---|---|
| EV-1 | The architecture supports Stage 2–4 evolution without rewrite | Adding an input type requires no modification to existing paths (`PRD NFR-044`) |
| EV-2 | Reasoning changes are safe to ship | Template versioning, regression gate, and rollback operational (`PRD AI-010`–`AI-014`) |
| EV-3 | Failures are diagnosable without reproduction | Run trace sufficient to diagnose any analysis (`PRD FR-100`) |
| EV-4 | Operational burden is sustainable by one person | No component requires manual intervention in normal operation (`TC-009`) |

---

## 3. Core Product Hypothesis

### 3.1 The hypothesis

> **Automation Intelligence can produce architectural reasoning that practitioners trust enough to act on and present as their own professional work.**

Three clauses, each independently falsifiable:

| Clause | What it claims | Fails if |
|---|---|---|
| **Can produce** | Reasoning quality is achievable, not just plausible-sounding output | Generated architectures do not survive implementation |
| **Trust enough to act on** | Users treat output as a basis for decisions, not a curiosity | Users read and abandon; no behavior changes |
| **Present as their own professional work** | Output meets an external standard, not just an internal one | Users export rarely, or reformat heavily before use |

### 3.2 How success is measured

| Signal | Instrument | Threshold |
|---|---|---|
| **Trust — behavioral** | Export rate (`M-4`) | ≥ 30% |
| **Trust — repeated** | Return rate with a *new* problem (`M-5`) | ≥ 40% / 30 days |
| **Quality — user-reported** | Low-quality flag rate (`M-7`) | ≤ 5% |
| **Quality — reviewed** | Manual review against `M-8` / `M-9` | 100% of sampled outputs traceable and defensible |
| **Quality — external** | Independent implementation review (`PRD §14.1`) | ≥ 5 architectures reviewed as viable |

**Return rate is the load-bearing metric.** Export can be driven by curiosity; a first analysis can be driven by novelty. Returning with a *different* problem is the only signal that cannot be explained by anything except the reasoning having been useful.

### 3.3 Kill criteria

Stated in advance, because thresholds set after seeing data are not thresholds.

The hypothesis is **falsified** — and the product requires reconsideration rather than iteration — if, after a sustained measurement period with adequate volume:

- Return rate remains below 15% while completion rate and latency meet target. *(Users can use it, and choose not to.)*
- Low-quality flag rate exceeds 20%. *(Output is not good enough and the gap is not marginal.)*
- Independent review finds generated architectures unviable at a material rate. *(The core capability claim is false.)*
- Export rate remains below 10%. *(Output is not trusted for external use — the specific claim the product makes.)*

**What is not a kill signal:** low absolute user volume. That is a distribution problem, not a hypothesis problem, and the two must not be confused. A product with 40 users and a 50% return rate has validated its hypothesis. A product with 4,000 users and an 8% return rate has not.

### 3.4 The measurement gap

`PRD O-1` remains open: no operational definition of reasoning quality exists that two reviewers would apply identically. `M-8`, `M-9`, and the §3.2 "quality — reviewed" row therefore rest on single-reviewer judgment.

**This is the largest methodological weakness in the v1.0 plan.** It is addressed in Sprint 0 (§7.1) rather than deferred, because a hypothesis test with an unfalsifiable quality measure is not a test.

---

## 4. MVP Principles

Scope-management principles. They govern what gets built, not how the product behaves — that is `PV §3`.

### 4.1 Depth over Breadth

**One thing done to a standard that convinces, rather than many done to a standard that explains nothing.**

Applied: four input paths, not eight. Two export formats, not five. No settings that alter behavior. When a sprint runs short, the response is to cut a feature entirely, never to ship every feature at reduced quality.

*Test:* if the scope were cut by 20%, would the hypothesis still be testable? If yes, cut it.

### 4.2 Reasoning over Execution

**Every unit of scope goes to the layer being validated.**

The hypothesis concerns reasoning quality. Effort spent on anything that does not affect what the user reads and evaluates is effort not spent on the thing under test. This principle is also the permanent boundary from `PV §3.1` — but in scope terms it is simply the observation that the interface is not the experiment.

*Test:* does this feature change the quality or comprehensibility of reasoning the user receives?

### 4.3 Quality over Quantity

**Shipping is not the goal. Shipping something that produces interpretable evidence is.**

A v1.0 that ships on time with output that fails `PRD §14.3` has not accelerated anything — it has spent credibility to gather noise. Slipping scope is cheap; slipping trust is not recoverable.

*Test:* would this ship if the only person who saw it were a senior practitioner evaluating it professionally?

### 4.4 Professional Output First

**The artifact is the product.**

The user's actual moment of judgment is the handoff — when they show the output to a client or manager (`PV §5`). Everything upstream serves that moment. This inverts the usual build order: output quality, export fidelity, and rationale presentation are P0 concerns, while account management and history are supporting infrastructure.

*Test:* would a consultant attach this to a proposal without editing it?

### 4.5 Single User First

**No multi-user concern enters v1.0, including in the data model.**

Collaboration, sharing, permissions, and organizations are Stage 3 (`PV §8`). Building for them prematurely imposes cost on every feature and validates nothing — teams do not adopt a reasoning product whose reasoning has not been proven to individuals.

*Test:* does this feature require a concept of "another user"? If so, it is out.

### 4.6 Architecture Before Scale

**Build the boundaries that are expensive to add later; build nothing else early.**

Three things must be right from the first commit because retrofitting them is a rewrite: the provider adapter (`FR-016`), provenance in the data model (`FR-013`), and run tracing (`FR-100`). Everything else — caching, queuing, horizontal scaling, performance optimization — waits for evidence that it is needed.

*Test:* is this expensive to add later, or merely useful now? Only the first justifies early cost.

---

## 5. Included Features

Everything below is in v1.0 scope. Nothing else is.

### 5.1 Scope table

| Feature | Priority | Reason included | Dependencies | Success criteria |
|---|---|---|---|---|
| **Input surface** (`FR-001`–`FR-002`, `FR-005`–`FR-006`) | P0 | The zero-configuration promise is a core UX claim under test (`UV-2`) | — | User submits raw text with no type selection; input survives failure |
| **NIE pipeline** (`FR-010`, `FR-016`–`FR-019`) | P0 | The system under test. Everything else exists to deliver its output | — | Six stages execute in order; provider substitutable; templates versioned |
| **Input classification + override** (`FR-011`, `FR-014`–`FR-015`) | P0 | Zero-configuration depends on it; misclassification invalidates the analysis | NIE pipeline | ≥95% accuracy; visible and correctable; low confidence surfaced |
| **Intent + context extraction** (`FR-012`–`FR-013`) | P0 | Provenance is architectural (`4.6`) and cannot be retrofitted | NIE pipeline | Every context element carries `stated`/`inferred`/`unknown` |
| **Response orchestration** (`FR-017`) | P0 | Over-production is a defect (`PV §3.2`); depth proportionality is tested by `AC-037` | Context extraction | Minimal input yields minimal artifact set; inclusion reasons recorded |
| **Business requirement path** (`FR-020`) | P0 | Highest-value path; serves consultants, engineers, businesses | Orchestration | Full artifact set; capable of "do not automate" conclusion |
| **Existing workflow path** (`FR-021`) | P0 | Serves engineers and technical leads; tests review capability distinctly from generation | Orchestration | Issues specific to submitted workflow, not generic |
| **Job description path** (`FR-022`) | P0 | Lowest-friction acquisition segment; produces public portfolio artifacts | Orchestration | Requirements classified must/nice-have with provenance |
| **Technical assessment path** (`FR-023`) | P1 | Completes the four-input claim; may ship at reduced depth if capacity forces | Orchestration | Names ≥1 rejected alternative with reason |
| **Architecture generator** (`FR-030`) | P0 | The central artifact. The hypothesis is largely a claim about this output | Reasoning stage | Every component traceable to extracted context |
| **Mermaid diagram** (`FR-031`) | P0 | Primary comprehension aid; low cost, high perceived professionalism | Architecture | Parses without correction; nodes match components |
| **Risk analysis** (`FR-032`) | P0 | The differentiating output vs. general-purpose AI; core to `UG-3` | Architecture | Risks name specific components; each has a mitigation |
| **Complexity scoring** (`FR-033`) | P0 | The consultant scoping use case depends on it | Architecture, `O-2` resolved | Score reconstructible from displayed basis; deterministic |
| **Platform recommendation** (`FR-034`) | P0 | Neutrality is the product's structural moat; unproven if unbuilt | Architecture | States criteria and ≥1 rejected alternative; varies with requirement |
| **Rationale + provenance + confidence display** (`FR-042`–`FR-045`) | P0 | The `UV-1` goal. Without these the product fails `PV §3.5` regardless of output quality | Results presentation | Every recommendation shows reasoning, provenance, and confidence |
| **Progressive streaming** (`FR-041`) | P0 | 60s opaque waits cause abandonment (`R-11`); first-artifact latency is a distinct metric | NIE pipeline | First artifact ≤15s p50 |
| **Results presentation** (`FR-040`) | P0 | Hierarchy determines whether output is evaluable | Artifacts | Problem statement visible without scroll |
| **Export — Markdown + PDF** (`FR-050`–`FR-051`) | P0 | The handoff moment is where the hypothesis is tested (`4.4`) | Results | Presentation-ready without reformatting; provenance survives |
| **Copy to clipboard** (`FR-053`) | P1 | Low cost; supports partial use in the user's own documents | Results | Valid Markdown; valid Mermaid source |
| **Authentication** (`FR-070`) | P0 | Prerequisite for history and export attribution | — | Required only at point of use, never before first analysis |
| **Anonymous first analysis** (`FR-004`) | P0 | Value must be demonstrable before commitment; directly affects `UV-2` | Input, NIE | Full analysis completes with no account |
| **History — persist, list, retrieve, delete** (`FR-060`–`FR-061`, `FR-063`) | P0 | Return rate is the load-bearing metric (`3.2`); users must be able to return to something | Authentication | Retrieval reproduces original exactly; deletion permanent |
| **Error handling + degradation** (`FR-090`–`FR-094`) | P0 | Trust is designed in the failure cases (`PV §6`) | NIE pipeline | Partial results labelled; no silent omission |
| **Output schema validation** (`FR-039`) | P0 | Invalid output reaching a user is a trust event, not a bug | Artifacts | 100% validity at presentation |
| **Run tracing** (`FR-100`, `FR-103`) | P0 | Expensive to retrofit (`4.6`); required for `EV-3` and all quality review | NIE pipeline | Any analysis diagnosable without re-running |
| **Metrics instrumentation** (`FR-102`) | P0 | Without it, v1.0 gathers no evidence and the experiment does not run | All flows | All `PRD §3.2` metrics reporting at release |
| **Feedback capture** (`FR-101`) | P1 | Provides `M-7`; cheap and directly serves `UV-1` | Results | Binary signal with optional detail; never required |
| **Settings — minimal** (`FR-071`–`FR-073`) | P1 | Account deletion is non-negotiable (`FR-073` is P0 within this group) | Authentication | No setting required for full function |

### 5.2 Deliberate inclusions that may look premature

Three items are P0 despite producing no visible user value, because `4.6` applies:

| Item | Why now rather than later |
|---|---|
| **Provider adapter** (`FR-016`) | Provider-specific logic spreads across a codebase by default. Extracting it later is a rewrite of the reasoning core. |
| **Provenance in the data model** (`FR-013`) | Cannot be added to output generated without tracking it. Every analysis produced before it exists is unusable for quality review. |
| **Run tracing** (`FR-100`) | Without it, quality problems are undiagnosable and the manual review protocol in `PRD §14.1` cannot run. |

### 5.3 Deliberate exclusions from within P0 features

| Excluded detail | From | Reason |
|---|---|---|
| File upload (`FR-003`) | Input surface | P1. Paste covers the primary workflow; PDF extraction is disproportionate cost for v1.0. Ships if Sprint 5 has capacity. |
| History search (`FR-062`) | History | P1. Not needed at expected v1.0 per-user volume. |
| Re-analysis (`FR-064`) | History | P2. No validation value; adds versioning complexity. |
| Partial export (`FR-052`) | Export | P1. Full export plus clipboard copy covers the need. |
| Implementation roadmap (`FR-036`) | Artifacts | P1. Valuable but not load-bearing for the hypothesis. First cut if capacity forces. |
| Edge cases & best practices (`FR-037`) | Artifacts | P1. Same. |
| Integration/API requirements (`FR-035`) | Artifacts | P1. Blocked partly by `O-4` (platform knowledge currency). |
| Executive summary artifact (`FR-038`) | Artifacts | P1. Serves the business persona, who is not a primary v1.0 segment. |

**Cut order if capacity forces reduction:** `FR-064` → `FR-052` → `FR-062` → `FR-003` → `FR-038` → `FR-035` → `FR-037` → `FR-036` → `FR-023`. Cutting past `FR-023` means cutting an input path, which changes what the MVP claims — that is a scope amendment, not a sprint decision.

---

## 6. Deferred Features

Two categories, governed by different rules.

### 6.1 Deferred on sequencing — revisitable

These are consistent with the Product Vision and excluded from v1.0 on cost and prerequisite grounds alone.

| Feature | Reason deferred | Future stage | Dependency |
|---|---|---|---|
| **Team collaboration** | Teams do not adopt a reasoning product whose reasoning is unproven to individuals | v2.0 (`PV §8` Stage 3) | Validated hypothesis; multi-user data model |
| **Enterprise governance** | Meaningless without collaboration; enterprise buyers require a track record | v3.0 (Stage 3) | Team collaboration |
| **Enterprise SSO** | No enterprise customers exist to require it | v3.0 | Enterprise segment entry |
| **Learning system** | Requires a corpus of feedback and verified outcomes that does not yet exist | v2.0 (Stage 2) | Volume of analyses + `FR-101` feedback |
| **Knowledge graph** | Requires stable output schemas and a corpus; premature before quality is proven | v2.0 (Stage 2) | Schema stability; analysis corpus |
| **Automation estate analysis** | Requires read-only platform access and team features | v3.0 (Stage 4) | Team features; integration layer |
| **Plugin ecosystem** | Introduces quality variance before core quality is established | v3.0+ | Proven core quality; stable API |
| **Mobile application** | Primary use is at a workstation alongside other tools | v2.0+ | Evidence of mobile demand |
| **Multi-language support** | Adds surface area without testing the hypothesis | v2.0+ | Evidence of non-English demand |
| **Platform data integration (read-only)** | Requires credential handling; significant security surface | v2.0 (Stage 2) | Security review; clear value case |
| **Agentic reasoning** (multi-step analysis decomposition) | Only meaningful once single-step reasoning quality is proven | v2.0+ | Validated hypothesis |
| **Voice interface** | No evidence of demand; architectural review is a reading activity | Unlikely | Evidence of demand |

### 6.2 Excluded on principle — not deferred

These are not on a roadmap. They are excluded permanently by `PV §3.1` and `§3.6`, and restated here so that "deferred" is never read into them.

| Excluded | Principle | Why it is permanent |
|---|---|---|
| **Workflow execution** | `PV §3.1` | Executing forfeits the neutrality that makes recommendations worth anything |
| **Workflow deployment** | `PV §3.1` | Same |
| **Scheduling** | `PV §3.1` | Runtime concern; downstream of the decision layer |
| **Runtime monitoring of user workflows** | `PV §3.1` | Operation, not analysis. Estate *analysis* (§6.1) is the permitted form |
| **Autonomous execution** | `PV §3.6` | Industrializes the failure NAIGX exists to correct |
| **Marketplace** | `PV §3.3` | Marketplaces monetize by favoring listed platforms — the exact conflict |
| **User-authored reasoning templates** | `PV §3.4`, `FR-024` | Undermines output consistency and quality accountability |

**A request for any §6.2 item is not a prioritization question.** It is a request to change the Product Vision, and follows `PV` Appendix A amendment procedure — name the principle, state the evidence that made it wrong, amend in writing.

---

## 7. Sprint Roadmap

Ordered, not scheduled. Sprint boundaries are logical checkpoints; a single operator's velocity is unobserved and dates would be fiction.

**Sequencing rationale.** The riskiest unknown is reasoning quality, so the NIE spine is built and evaluated before any supporting infrastructure. Authentication, history, and settings — conventionally built first — are deliberately last, because they carry no hypothesis risk and their absence blocks nothing during quality iteration. **If the product is going to fail, it should fail in Sprint 2, not Sprint 5.**

---

### Sprint 0 — Preconditions

**Purpose:** close the specification gaps that would otherwise be resolved badly under implementation pressure.

| Deliverable | Resolves | Why first |
|---|---|---|
| Reasoning quality rubric | `PRD O-1` | The hypothesis is untestable without it (§3.4). Two reviewers must agree on what "good" means. |
| Complexity scoring factors and weights | `PRD O-2` | `FR-033` cannot be built against an undefined scale |
| Risk severity and likelihood scales | `PRD O-3` | `FR-032` cannot be built against an undefined scale |
| Regression input corpus | `FR-024`, `NFR-043` | ≥10 fixed inputs per type, with expected classification and artifact set. Needed before any template work. |
| Trace retention period | `PRD O-5` | Required for the data policy, which must be published pre-launch |

**Exit:** all four open PRD items resolved in writing; regression corpus committed.

---

### Sprint 1 — NIE spine and reasoning core

**Purpose:** produce a first end-to-end reasoning run for the highest-value path, in a form that can be evaluated.

| Deliverable | Requirements |
|---|---|
| Provider adapter with second-provider test | `FR-016`, `AI-001`–`AI-005` |
| Versioned, externalized reasoning templates | `FR-019`, `AI-010`–`AI-014` |
| Pipeline stages: classification, intent, context extraction | `FR-010`–`FR-013` |
| Provenance in the data model | `FR-013` |
| Run tracing | `FR-100`, `FR-103` |
| Architecture generation, business requirement path | `FR-020`, `FR-030` |
| Output schemas and validation | `FR-039`, `TC-005` |

**Interface at this stage:** minimal. A raw input field and unstyled output is sufficient — the deliverable is reasoning, not presentation.

**Exit:** a business requirement input produces a schema-valid architecture with full provenance, traceable end to end.

---

### Sprint 2 — Quality evaluation and artifact completion

**Purpose:** determine whether the reasoning is good enough to continue. **This is the decision sprint.**

| Deliverable | Requirements |
|---|---|
| Risk analysis, complexity scoring, platform recommendation | `FR-032`–`FR-034` |
| Mermaid diagram generation | `FR-031` |
| Response orchestration with depth proportionality | `FR-017` |
| Confidence generation and propagation | `FR-018`, `AI-020`–`AI-024` |
| Regression suite operational against the corpus | `FR-024`, `NFR-043` |
| **First formal quality review** against the Sprint 0 rubric | `M-8`, `M-9` |

**Gate — this sprint has a stop condition.** If reviewed output does not meet the rubric, the response is to iterate on reasoning templates, not to proceed to Sprint 3. Building presentation, export, and history on top of reasoning that does not meet standard is the single most expensive mistake available in this plan.

**Exit:** all P0 artifacts generating; regression suite stable; quality review passed or iteration underway with no downstream work started.

---

### Sprint 3 — Remaining paths and presentation

**Purpose:** complete the four-input claim and make output evaluable by a real user.

| Deliverable | Requirements |
|---|---|
| Existing workflow path | `FR-021` |
| Job description path | `FR-022` |
| Technical assessment path | `FR-023` (P1) |
| Results hierarchy and presentation | `FR-040` |
| Rationale, provenance, confidence display | `FR-042`–`FR-045` |
| Progressive streaming | `FR-041` |
| Unknowns and insufficiency disclosure | `FR-044` |

**Exit:** all four paths produce presented results a practitioner can evaluate without assistance.

---

### Sprint 4 — Handoff surface

**Purpose:** build the moment where the hypothesis is actually tested (`4.4`).

| Deliverable | Requirements |
|---|---|
| Markdown and PDF export | `FR-050`–`FR-051` |
| Copy to clipboard | `FR-053` |
| Input surface: validation, persistence across failure | `FR-002`, `FR-005`–`FR-006` |
| Error handling and graceful degradation | `FR-090`–`FR-094` |
| Classification visibility and override | `FR-014`–`FR-015` |
| Unsupported input handling | `FR-092` |

**Exit:** a complete analysis can be exported as a document presentable to a third party; all failure paths handled and labelled.

---

### Sprint 5 — Persistence, instrumentation, release readiness

**Purpose:** make the experiment measurable and the product operable.

| Deliverable | Requirements |
|---|---|
| Authentication | `FR-070` |
| Anonymous first analysis with claim-on-signup | `FR-004` |
| History: persist, list, retrieve, delete | `FR-060`–`FR-061`, `FR-063` |
| Settings and account deletion | `FR-071`–`FR-073` |
| Feedback capture | `FR-101` |
| Metrics instrumentation | `FR-102` |
| Logging, monitoring, alerting | `NFR-080`–`NFR-085` |
| Accessibility conformance pass | `NFR-060`–`NFR-065` |
| Security review | `PRD §9.3`, `AC-026` |
| Data policy published | `NFR-031` |
| Deployment and operational runbook | `TC-009` |

**Exit:** `PRD §14.1` completion criteria and `§15` acceptance criteria satisfied.

---

### Sprint capacity note

If a sprint overruns, the response is `4.1`: cut a P1 feature entirely per the §5.3 cut order. **Never compress quality on a P0 item to preserve sprint boundaries** — the boundaries are planning conveniences and the quality is the experiment.

---

## 8. Technical Milestones

Milestones are verifiable states, independent of sprint boundaries. Each is either true or false.

| # | Milestone | Verified when | Sprint |
|---|---|---|---|
| TM-1 | **Backend foundation** | API skeleton operational; stateless request handling; `TC-003`, `TC-004` satisfied | 1 |
| TM-2 | **Provider independence** | Automated test exercises a second provider without touching reasoning logic (`AI-005`) | 1 |
| TM-3 | **NIE pipeline operational** | All six stages execute in sequence with structured handoff (`FR-010`) | 1 |
| TM-4 | **Traceability** | Any analysis fully diagnosable from its trace without re-running (`FR-100`) | 1 |
| TM-5 | **Structured generation** | 100% of artifacts pass schema validation before presentation (`FR-039`) | 1–2 |
| TM-6 | **Reasoning quality gate** | Sampled output passes the Sprint 0 rubric (`M-8`, `M-9`) | 2 |
| TM-7 | **Regression safety** | Template changes gated by a passing regression suite (`NFR-043`) | 2 |
| TM-8 | **Classification accuracy** | ≥95% on the regression corpus (`M-6`) | 2–3 |
| TM-9 | **All analysis paths** | Four input types produce their specified artifact sets | 3 |
| TM-10 | **Frontend foundation** | Results presentation with hierarchy, layered depth, streaming (`FR-040`–`FR-041`) | 3 |
| TM-11 | **Export system** | Markdown and PDF presentation-ready without reformatting (`FR-050`) | 4 |
| TM-12 | **Degradation** | Partial failure yields labelled partial results in all tested failure modes (`FR-091`) | 4 |
| TM-13 | **Authentication & history** | Analyses persist and retrieve exactly; deletion permanent (`FR-060`, `FR-063`) | 5 |
| TM-14 | **Instrumentation** | All `PRD §3.2` metrics reporting (`FR-102`) | 5 |
| TM-15 | **Accessibility** | WCAG 2.1 AA verified on primary flows (`NFR-060`) | 5 |
| TM-16 | **Security** | Review complete; no unresolved high-severity findings (`AC-026`) | 5 |
| TM-17 | **Deployment** | Production deploy with monitoring and alerting; rollback verified | 5 |
| TM-18 | **Performance** | `NFR-001`, `NFR-002` met under representative load | 5 |

**TM-6 is the milestone that matters.** Every other milestone is engineering work with a known solution shape. TM-6 is the one that can fail in a way no amount of effort resolves — and every milestone after it is wasted if it fails.

---

## 9. MVP Exit Criteria

v1.0 ships when all of the following are true. Full criteria are in `PRD §14.1` and `§15`; this section states the gates and the ones added by scope.

### 9.1 Functional completion

- All P0 features in §5.1 implemented and passing their PRD acceptance criteria.
- All four analysis paths operational; `FR-023` permitted at P1 depth with the deviation recorded.
- Full journey traversable: landing → input → classification → reasoning → results → export → history.
- All `PRD §15.1` functional acceptance criteria (AC-001–AC-014) pass.

### 9.2 Quality

- `PRD §15.2` quality acceptance criteria (AC-020–AC-028) pass.
- **`PRD §15.3` vision-conformance criteria (AC-030–AC-037) pass.** No exceptions; a vision-conformance failure blocks release regardless of functional completeness.
- Manual quality review complete: ≥20 analyses per input type assessed against the Sprint 0 rubric.
- ≥5 generated architectures reviewed by someone other than the author for implementation viability.
- No open severity-1 or severity-2 defects.

### 9.3 Performance

- `NFR-001` (first artifact ≤15s p50 / ≤40s p95) and `NFR-002` (completion ≤60s p50 / ≤120s p95) met under representative load.
- Completion rate ≥95% sustained (`NFR-010`).
- Cost per analysis within the ceiling defined in Sprint 0 (`TV-4`).

### 9.4 UX

- A first-time user completes a full analysis without documentation (`NFR-070`).
- Zero configuration required before value (`UX-001`).
- WCAG 2.1 AA verified; no color-only encoding of provenance or confidence (`NFR-063`).
- No engagement mechanics present in any surface (`UX-012`).

### 9.5 Testing

- Regression suite covers all four input types and gates template changes (`NFR-043`).
- Provider substitution verified by automated test (`AI-005`).
- All failure and degradation paths exercised (`FR-090`–`FR-094`).
- Security review complete against `PRD §9.3`.

### 9.6 Documentation

- Data handling policy published and accessible before first submission (`NFR-031`).
- Reasoning quality rubric documented and applied (`O-1` closed).
- Operational runbook exists covering deployment, rollback, and incident response.
- All `PRD` Appendix B open items closed or explicitly carried forward with a stated reason.

### 9.7 The qualitative gate

`PRD §14.3` applies and overrides checklist completion:

> **Would a competent automation practitioner, shown a generated analysis without knowing its origin, consider it professional work?**

If no, v1.0 does not ship. A checklist-complete release that fails this gate gathers evidence about the wrong product and spends credibility that a later release cannot re-earn.

---

## 10. Explicit Non-Goals

What v1.0 is **not** trying to achieve. This section exists to make feature creep a visible violation rather than a gradual drift.

| Non-goal | Why not | The pressure it resists |
|---|---|---|
| **Feature completeness** | The PRD describes an eventual product; v1.0 tests one claim | "The PRD says we need X" — the PRD is scope, this document is sequence |
| **Serving all seven segments equally** | Consultants and job seekers are prioritized (`PRD §4`) | Broad appeal requests that dilute the paths under test |
| **User growth** | Volume is a distribution problem, not a hypothesis problem (`3.3`) | Growth features, referral mechanics, virality work |
| **Revenue** | Monetization before validated value produces uninterpretable signal | Pricing and billing work before the hypothesis resolves |
| **Platform integrations** | Requires credential handling; conflicts with `TC-008` | "It would be so much easier if we just connected to n8n" |
| **Multi-user anything** | `4.5`. Including in the data model | Sharing, links, comments, "just a share button" |
| **Performance optimization beyond targets** | `4.6`. Meeting `NFR-001`/`NFR-002` is sufficient | Premature scaling and caching work |
| **Configurability** | Zero-configuration is a claim under test (`UV-2`) | "Let power users choose the model / adjust depth / pick a template" |
| **Mobile experience** | Desktop workstation use is the primary context | Responsive polish beyond tablet readability |
| **Marketing surface** | The product is the evidence; the site is not under test | Landing page iteration displacing product work |
| **Model or infrastructure novelty** | The differentiator is reasoning discipline, not the stack (`ES §9.2`) | Technically interesting work with no hypothesis relevance |
| **Impressive demos** | Demo quality and use quality diverge; only the second is measured | Features that show well and serve nobody |

**The general test:** does this change the reasoning a user receives, or their ability to evaluate and present it? If not, it is not v1.0 work — regardless of how small, how requested, or how nearly finished it is.

---

## 11. Future Releases

Strategic direction only. No commitments, no feature definitions, no dates. Each release is gated on the previous one's evidence.

### Version 1.1 — Consolidation

**Strategic intent: act on what v1.0 measured.**

The first release after real usage exists to close the gap between what was designed and what was observed — reasoning quality iteration against actual feedback, the P1 features deferred in §5.3 that usage proves necessary, and correction of whatever the metrics reveal was wrong. Deliberately not an expansion release. The most common failure after an MVP is treating first usage as permission to broaden rather than as data to act on.

*Gated on:* v1.0 hypothesis signals, positive or ambiguous. If falsified per `3.3`, v1.1 is a reconsideration, not a release.

### Version 2.0 — From isolated decisions to accumulated judgment

**Strategic intent: reasoning that knows the user's context.**

`PV §8` Stage 2. NAIGX moves from evaluating each input in isolation toward understanding a user's environment, constraints, and history — so recommendations account for what already exists. This is where the learning system and knowledge graph become meaningful, because a corpus finally exists to build them on.

*The governing constraint:* context must improve reasoning quality and must never become lock-in. The moment accumulated context makes output less portable, it has stopped serving the user and started retaining them.

*Gated on:* validated hypothesis; sufficient analysis corpus; stable schemas.

### Version 3.0 — From individual practice to shared standards

**Strategic intent: the reasoning layer for teams, then organizations.**

`PV §8` Stage 3, extending toward Stage 4. Collaboration, design review, and organizational standards — followed eventually by reasoning across an entire automation estate rather than individual workflows. This is where the commercial model shifts from individual to organizational, and where the segment sequencing in `ES §7` completes.

*The governing constraint:* collaboration must not dilute reasoning into consensus, and estate work remains analysis, never operation. `PV §3.1` does not relax at scale.

*Gated on:* proven individual product; demonstrated team demand rather than assumed.

---

## Appendix A — Scope Summary

| | Count |
|---|---|
| P0 features in v1.0 | 22 |
| P1 features in v1.0 | 6 |
| Requirements deferred within included features | 8 |
| Features deferred on sequencing | 12 |
| Features excluded on principle | 7 |
| Sprints (including Sprint 0) | 6 |
| Technical milestones | 18 |

**Included PRD requirement groups:** `FR-001`–`FR-002`, `FR-004`–`FR-006`, `FR-010`–`FR-024`, `FR-030`–`FR-034`, `FR-039`–`FR-045`, `FR-050`–`FR-051`, `FR-053`, `FR-060`–`FR-061`, `FR-063`, `FR-070`–`FR-073`, `FR-090`–`FR-094`, `FR-100`–`FR-103`.

**Deferred from PRD:** `FR-003`, `FR-035`–`FR-038`, `FR-052`, `FR-062`, `FR-064`.

---

## Appendix B — Scope Change Log

Scope changes are recorded here. An undocumented scope change is a contract breach, not a decision.

| Date | Change | Direction | Reason | Impact |
|---|---|---|---|---|
| 2026-08-11 | Initial scope established | — | Derived from PRD v1.0 | — |

**Amendment procedure**

- **Adding to §5:** state the requirement ID, the hypothesis-validation contribution, and what is cut to accommodate it. Net scope additions without a corresponding cut are refused by default.
- **Removing from §5:** state the requirement ID, the reason, and the effect on the hypothesis test.
- **Moving from §6.1 to §5:** requires evidence that the deferred item now blocks hypothesis validation.
- **Moving from §6.2 to §5:** not a scope change. Requires a Product Vision amendment first (`PV` Appendix A).

---

## Appendix C — Provenance

This document plans implementation for a pre-build product developed by a single operator. It contains no delivery dates, no capacity forecasts, and no claims of customers, revenue, or team.

**Document hierarchy.** Product Vision governs the PRD. The PRD governs this document's requirement definitions. This document governs sequence and inclusion. Where this document appears to add a requirement, it is defective — requirements belong in the PRD.

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-11 | Initial MVP Scope. Derived from Executive Summary v1.1, Product Vision v1.1, PRD v1.0. |
