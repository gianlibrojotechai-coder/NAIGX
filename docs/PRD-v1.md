# Product Requirements Document (PRD)

**Product:** NAIGX
**Version:** 1.0 (MVP)
**File:** `docs/PRD-v1.md`
**Status:** Draft — scoped as a falsifiable prototype, not a product commitment
**Source of Truth:** `docs/Product-Vision.md` · `research/06-Market-Insights.md` · `research/01-Job-Description-Matrix.md` (`JD-001`→`JD-005`)
**Last Updated:** 2026-08-09

---

## ⚠️ Standing Note on Scope Authority

`docs/Product-Vision.md` defines Horizon 1 as requiring **an insight at 🟢 Validated** and **a closed competitive gate** before a capability is committed to as product direction. Neither condition is currently met: the corpus is five postings from one source type, and `research/05-Competitor-Research.md` is empty.

The vision also states that insights below 🟢 **may be prototyped but may not be committed to as product direction**. Version 1 is therefore scoped as a **prototype built to test the corpus's strongest signal** — deliberately small, deliberately falsifiable, and explicitly reversible if competitor research or broader evidence contradicts it.

This document defines what would be built and how its success would be judged. It does not authorize the build. Closing the competitive gate does.

---

## 1. Executive Summary

Version 1 of NAIGX addresses the single highest-frequency problem in the research corpus: **automations and integrations fail, and the failure is not detected, diagnosed, or explained quickly.**

This problem appears in all five records under its broad reading and in four of five under its narrow, workflow-specific reading. It is the only problem in the corpus that two independent postings promote out of the responsibilities list and into *hiring selection criteria* — `JD-001` names "can debug a broken automation without panicking" as a qualification; `JD-005` makes "how they handled API errors or scaling issues" an evaluation criterion. Companies are not merely assigning this work; they are selecting candidates on it.

V1 delivers one capability against that problem: **connect to a single automation platform, detect failed workflow runs, classify why each failed, and explain the failure in language a non-programmer operator can act on** — together with an honest disclosure of how often that explanation is correct.

V1 does not build workflows, fix failures, act autonomously, or span multiple platforms. Those are deferred by design.

| V1 in one line | Tell the operator what broke, why, and how confident we are. |
|---|---|
| Core problem | Failure detection, classification, and explanation (5/5 broad · 4/5 narrow, 🟡) |
| Platform in V1 | One automation platform (recommended: n8n — see §8) |
| Primary quality bar | Explanation correctness against deliberately seeded failures |
| Explicitly not in V1 | Building, editing, fixing, acting, or multi-platform support |

---

## 2. Problem Statement

### The problem

**Organizations that have connected their software cannot tell when those connections break, why they broke, or whether the same break is recurring — and the ability to find out lives inside one person.**

### Evidence

| Record | Evidence | Framing in the posting |
|---|---|---|
| `JD-001` | "Can debug a broken automation without panicking" | **Hiring qualification** |
| `JD-002` | "Troubleshoot AI-related issues and optimize existing solutions" | Core responsibility |
| `JD-003` | "Troubleshoot technical issues… ensuring minimal downtime and optimal system performance" | Core responsibility |
| `JD-004` | "Improve observability, testability, and release quality"; AI used to "accelerate testing and debugging" | Core responsibility + stated AI use case |
| `JD-005` | "Strong error handling, monitoring, and documentation"; "how they handled API errors or scaling issues" | Responsibility **and evaluation criterion** |

### Why this problem and not another

Ranked against every recurring problem in `06-Market-Insights.md`:

| Candidate problem | Frequency | Nature of work | Selected? |
|---|---|---|---|
| **Failure detection, classification, explanation** | 5/5 broad · 4/5 narrow | Inference over run history — automatable | ✅ **V1** |
| Data does not move correctly between systems | 5/5 | Construction — already served by platforms the corpus runs | ❌ Contradicts "connect, never replace" |
| Operational visibility requires manual assembly | 4/5 | Aggregation — broad and unbounded for a V1 | ❌ Deferred |
| Undocumented systems / key-person risk | 3/5 | Generation — shares components, but no record hires *for* it | ❌ Deferred |
| Data hygiene at point of entry | 3/5 | Mixed rules and judgment | ❌ Deferred |
| Attribution / closed-loop measurement | 2/5 (🔴) | Identity resolution — hard and error-prone | ❌ Out of scope |

Failure diagnosis wins on three counts simultaneously: highest frequency, inference-based rather than judgment-based, and the only problem the corpus treats as a *selection* criterion rather than a duty.

### Current state and its cost

The corpus describes the present workaround precisely: hire one person, make them solely accountable, and depend on them. Three records name documentation as standing work (`JD-001`, `JD-002`, `JD-005`) — these organizations know the dependency is fragile and are paying to mitigate it manually.

The costs the corpus names directly: downtime (`JD-003`), late discovery of failures (`JD-005`), and inability to scale as volume grows (`JD-001`, `JD-003`, `JD-004`, `JD-005`).

---

## 3. Goals

| # | Goal | Success looks like | Evidence |
|---|---|---|---|
| **G1** | Surface failed automation runs without the operator checking manually | Operator learns of a failure from NAIGX, not from a downstream complaint | `JD-005` "monitoring"; `JD-003` "minimal downtime" |
| **G2** | Classify each failure into a cause category | Every detected failure carries a cause label, or is explicitly marked unclassified | `JD-005` "error handling"; `JD-001` debugging as a qualification |
| **G3** | Explain each failure in plain language an operator can act on | Explanation is comprehensible without reading code | 3/5 records treat scripting as *preferred*, not required |
| **G4** | Show whether a failure is new or recurring | Operator can distinguish a one-off from a chronic break | `JD-005` "ensure systems scale"; `JD-001` "flawlessly" |
| **G5** | Disclose diagnostic confidence and known blind spots | Every explanation carries a confidence signal; limitations are visible in-product | Vision Core Principle 8 |
| **G6** | Prove correctness before claiming it | Measured accuracy against a seeded failure set exists before any external claim | Vision: "a confident wrong answer is worse than no answer" |

### Non-goals as goals

**G7 — Remain reversible.** V1 must be cheap to abandon. If competitor research shows the problem is well-solved, discarding V1 should cost weeks, not quarters. This is a goal, not a caveat.

---

## 4. Non-Goals

Each exclusion is argued from the vision or the corpus, not from convenience.

| Non-goal | Rationale | Source |
|---|---|---|
| Building or editing workflows | Contradicts "connect, never replace." 2/5 records already run platforms they intend to keep | Vision Principle 3 |
| Automatically fixing failures | Zero records request autonomous action; every AI use case ends in human review | 0/5 records |
| Taking any write action on connected systems | Same as above; V1 is read-only by design | 0/5 records |
| Supporting multiple platforms | Portability is Horizon 2, not Horizon 1. V1 must stay small | Vision H2 |
| Replacing any system of record | Off-mission and unsupported | 5/5 retain their systems |
| Generating documentation | Supported (3/5) but no record hires *for* it; a by-product, deferred to keep V1 small | `06-Market-Insights.md` Opportunity 2 |
| Schema/field mapping between systems | 🔴 at 2/5 and only in agency contexts | `JD-003`, `JD-005` |
| Business reporting, dashboards, attribution | Different problem class; attribution is 🔴 and error-prone | `06-Market-Insights.md` Pattern D |
| Code authoring or IDE assistance | 1/5, already served by named tooling | `JD-004` |
| Team collaboration, multi-tenancy, permissions models | The corpus describes a *single* accountable owner in 5/5 records | 5/5 records |
| Judgment work — architecture, platform selection, quality standards | Classified non-automatable wherever it appears | Matrix automation tables |

---

## 5. Target Users

V1 narrows the vision's primary user to the subset testable at this stage.

| Tier | User | In V1 scope? |
|---|---|---|
| **Primary** | The systems owner — solely accountable for an organization's connected software, operating a supported automation platform | ✅ Yes |
| **Secondary** | The operations leader who consumes visibility but does not operate the tool | ⚠️ Benefits indirectly; not designed for in V1 |
| **Candidate** | Agencies maintaining many client stacks | ❌ Deferred — 🔴 at 2/5, and multi-client support conflicts with V1 smallness |
| **Non-target** | Software engineers seeking development tooling | ❌ Out of scope |

**V1 qualifying condition:** the user operates at least one automation platform supported by V1 and can grant read access to its execution history.

---

## 6. User Personas

> These are **composite archetypes synthesized from the corpus**, not real or prospective customers. NAIGX has no users. Each persona cites the records it is drawn from.

### Persona A — The Sole Operator *(primary)*

**Drawn from:** `JD-001`, `JD-002`, `JD-003`, `JD-005`

| Attribute | Detail |
|---|---|
| Role | The only person accountable for how the organization's software fits together |
| Technical profile | Fluent in APIs, webhooks, JSON, and platform configuration. Scripting is optional in 3/5 of the source records |
| Working context | Remote, autonomous, no team, no predecessor, often no documentation |
| What they own | Integrations between a system of record and everything around it |
| What breaks their week | A silent failure discovered late by someone downstream |
| What they cannot do today | Know a workflow failed before its consequences appear |
| Success in their words | "Systems working flawlessly" (`JD-001`); "minimal downtime" (`JD-003`) |

### Persona B — The Operations Leader *(secondary)*

**Drawn from:** `JD-001`, `JD-003`, `JD-005`

| Attribute | Detail |
|---|---|
| Role | Accountable for outcomes that depend on the systems, not for the systems |
| Technical profile | Non-technical to semi-technical; does not read payloads |
| What they need | To know whether operations are healthy without asking a person |
| Current workaround | Waiting — `JD-001` states reporting requires waiting on a data team |
| Relationship to V1 | Consumes what V1 surfaces; is not a V1 operator |

### Persona C — The Agency Integrator *(candidate, not served in V1)*

**Drawn from:** `JD-003`, `JD-005` — 🔴 at 2/5

Maintains near-identical integrations across many client stacks. Highest potential multiplier in the corpus and explicitly **out of V1 scope**: serving them requires multi-client separation, which conflicts with keeping V1 small. Recorded so the deferral is deliberate.

---

## 7. User Stories

### Detection

> **As a** sole operator,
> **I want to** be told when an automation run fails,
> **So that** I learn about the failure from my tools rather than from someone downstream noticing the consequence.
> *(`JD-005` monitoring; `JD-003` minimal downtime)*

> **As a** sole operator,
> **I want to** see all current failures in one place,
> **So that** I do not have to open each platform and check runs individually.
> *(`JD-005` "troubleshoot automation issues")*

### Classification

> **As a** sole operator,
> **I want** each failure labeled with its likely cause category,
> **So that** I can tell an expired credential apart from a rate limit apart from an upstream change without investigating each one.
> *(`JD-005` "how they handled API errors"; `JD-001` debugging as a hiring criterion)*

> **As a** sole operator,
> **I want** failures the system cannot confidently classify to be marked as unclassified,
> **So that** I am never misled into chasing the wrong cause.
> *(Vision Principle 8)*

### Explanation

> **As a** sole operator,
> **I want** a plain-language explanation of why a run failed,
> **So that** I can start fixing it instead of first reconstructing what happened.
> *(3/5 records treat scripting as preferred, not required)*

> **As a** sole operator,
> **I want** the explanation to point to the specific step and data that caused the failure,
> **So that** I know where to look rather than only what category it falls into.
> *(`JD-005` APIs, webhooks, JSON as required literacy)*

### Recurrence

> **As a** sole operator,
> **I want to** see whether this failure has happened before,
> **So that** I can tell a one-off from a chronic problem worth redesigning.
> *(`JD-005` "ensure systems scale as the business grows")*

### Trust

> **As a** sole operator,
> **I want to** see how confident the system is in each explanation,
> **So that** I can decide whether to trust it or investigate myself.
> *(Vision: correctness of explanation is how trust is earned)*

> **As a** sole operator,
> **I want to** know which failure types the system cannot yet diagnose,
> **So that** I am not falsely reassured by silence.
> *(Vision Principle 8)*

### Onboarding

> **As a** sole operator,
> **I want to** connect my automation platform using read-only access,
> **So that** I can adopt the tool without granting it the ability to change anything.
> *(V1 non-goal: no write actions)*

> **As a** sole operator,
> **I want** the system to be useful on a platform it has never seen my workflows on,
> **So that** I get value without configuring it first.
> *(Vision: "useful on first contact with a system it has never seen")*

### Secondary persona

> **As an** operations leader,
> **I want to** see whether the systems my team depends on are currently healthy,
> **So that** I do not have to ask the one person who knows.
> *(`JD-001` waiting on a data team)*

---

## 8. MVP Scope

### Platform selection for V1

V1 supports **one** automation platform. The corpus names Make.com in 2/5 records and n8n in 1/5, so Make has marginally stronger evidence — but V1 selects **n8n**, for a reason that overrides mention count at this stage:

**The primary success metric for V1 is explanation correctness measured against deliberately seeded failures.** That measurement requires the freedom to break workflows repeatedly and observe the result. A self-hostable platform makes this possible without a commercial tenant; a hosted-only platform does not.

The trade-off is recorded as **Risk R6**. Make.com is the first platform added after V1 and doubles as the Horizon 2 portability test.

### Included in Version 1

| # | Included | Why it is in V1 |
|---|---|---|
| 1 | Read-only connection to one automation platform | Prerequisite for everything else |
| 2 | Detection of failed workflow runs | G1 — the problem starts with not knowing |
| 3 | Classification of failures into cause categories | G2 — turns noise into a starting point |
| 4 | Plain-language explanation per failure | G3 — the actual deliverable |
| 5 | Recurrence indication (new vs. seen before) | G4 — separates one-offs from chronic breaks |
| 6 | Confidence signal and stated blind spots | G5 — trust and honesty are product requirements |
| 7 | Single consolidated view of active failures | Story: "see all current failures in one place" |
| 8 | One operator-chosen notification path | G1 — detection without polling |
| 9 | Seeded-failure accuracy evaluation | G6 — correctness proven, not asserted |

### Excluded from Version 1

| Excluded | Deferred to | Reason |
|---|---|---|
| Second and subsequent platforms | V2 / Horizon 2 | Portability is a separate horizon |
| Suggested fixes | Post-V1, evidence-gated | Suggestion is a different claim than explanation; requires its own accuracy bar |
| Any write or remediation action | Gated on evidence | 0/5 records request autonomy |
| Documentation generation | Post-V1 | Supported at 3/5 but not what anyone hires for |
| Schema / field mapping | Post-V1 | 🔴 at 2/5, agency-specific |
| Business reporting, dashboards, attribution | Out of scope | Different problem class |
| Multi-client / multi-tenant separation | Post-V1 | Persona C deferred |
| Team accounts, roles, permissions | Post-V1 | Corpus describes a single owner in 5/5 |
| Historical analytics and trend reporting | Post-V1 | Recurrence in V1 is a flag, not an analytics surface |
| Custom classification rules authored by the user | Post-V1 | Would require the operator to configure before receiving value |
| Mobile experience | Post-V1 | No supporting evidence |

### Evidence traceability

Every V1 inclusion traces to at least one record. No inclusion exists without one.

| V1 inclusion | `JD-001` | `JD-002` | `JD-003` | `JD-004` | `JD-005` |
|---|:---:|:---:|:---:|:---:|:---:|
| Failure detection | ✅ | ✅ | ✅ | ✅ | ✅ |
| Failure classification | ✅ | ✅ | ✅ | ✅ | ✅ |
| Plain-language explanation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Recurrence indication | ✅ | — | ✅ | ✅ | ✅ |
| Confidence disclosure | — | — | — | ✅ | ✅ |
| Read-only operation | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 9. Core Features

Five features. Each states purpose, user value, and acceptance criteria. No implementation.

---

### F1 — Platform Connection (read-only)

**Purpose.** Establish a read-only link to one automation platform so NAIGX can observe run outcomes.

**User value.** The operator adopts NAIGX without granting it the ability to change, trigger, or delete anything. Risk of adoption is near zero.

**Acceptance criteria**

- [ ] The operator can connect one supported platform and see confirmation that the connection is live.
- [ ] NAIGX performs no write, trigger, or modification action against the connected platform under any circumstance.
- [ ] If access is partial (some workflows visible, others not), NAIGX states what it can and cannot see rather than failing entirely.
- [ ] If the connection lapses or credentials expire, the operator is told — NAIGX never appears healthy while blind.
- [ ] Disconnecting removes NAIGX's access and is confirmed to the operator.

---

### F2 — Failure Detection

**Purpose.** Identify failed workflow runs on the connected platform without the operator checking manually.

**User value.** The operator learns about failures from NAIGX rather than from the downstream consequence — the specific gap `JD-005` describes as "monitoring" and `JD-003` as "minimal downtime."

**Acceptance criteria**

- [ ] Every failed run on the connected platform appears in NAIGX.
- [ ] Detection occurs without operator action.
- [ ] Each detected failure records which workflow failed, when, and at which step.
- [ ] A single consolidated view lists all currently unresolved failures.
- [ ] The operator can mark a failure resolved or acknowledged, and it leaves the active view.
- [ ] At least one notification path exists so the operator does not need to watch the view.
- [ ] Detection gaps (periods where NAIGX could not observe the platform) are visible, not silently absent.

---

### F3 — Failure Classification

**Purpose.** Assign each detected failure a likely cause category.

**User value.** Converts an error into a starting point. The operator can tell an expired credential from a rate limit from an upstream change without investigating each failure from scratch — the work `JD-001` and `JD-005` treat as a hiring-grade skill.

**Acceptance criteria**

- [ ] Every detected failure receives either a cause category or an explicit `Unclassified` label.
- [ ] The category set is defined independently of any single platform, so it can carry forward to future platforms unchanged.
- [ ] Categories cover, at minimum: authentication/credential, rate limiting/throttling, upstream unavailability, data shape or validation, timeout, and configuration.
- [ ] `Unclassified` is used rather than guessing when confidence is below the disclosed threshold.
- [ ] Classification accuracy is measured against the seeded failure set (F5) before V1 is considered complete.

---

### F4 — Plain-Language Explanation

**Purpose.** Explain, in operator-readable language, why a specific run failed and where.

**User value.** The core deliverable. The operator starts fixing instead of reconstructing. Written for the technically-literate non-programmer that 3/5 records describe.

**Acceptance criteria**

- [ ] Each classified failure has an explanation stating what happened, at which step, and why it most likely occurred.
- [ ] Explanations are comprehensible without reading code.
- [ ] Explanations reference the specific workflow step and the relevant data or error detail, not only the category.
- [ ] Where the cause is uncertain, the explanation says so plainly rather than presenting a guess as fact.
- [ ] Explanations contain no suggested remediation action — V1 explains, it does not advise.
- [ ] Any sensitive values surfaced in an explanation are redacted (see NFR-S2).

---

### F5 — Confidence and Blind-Spot Disclosure

**Purpose.** Tell the operator how far to trust each explanation, and what NAIGX cannot diagnose at all.

**User value.** The vision states that for a product whose output is an explanation, a confident wrong answer is worse than no answer. This feature is what makes the other four safe to rely on — and it directly implements Core Principle 8.

**Acceptance criteria**

- [ ] Every explanation carries a visible confidence signal.
- [ ] The confidence signal is derived from measured accuracy on the seeded failure set, not asserted.
- [ ] A stated list of known blind spots — failure types NAIGX cannot currently classify — is visible in-product, not only in documentation.
- [ ] Measured accuracy per failure category is available to the operator.
- [ ] Recurrence is indicated: the operator can see whether this failure has been seen before on this workflow.
- [ ] When accuracy for a category falls below the disclosed threshold, that category is reported as a blind spot rather than shown with a low-confidence guess.

---

## 10. Functional Requirements

| ID | Requirement | Feature | Priority |
|---|---|---|---|
| FR-1 | The system shall allow an operator to connect exactly one supported automation platform in V1 | F1 | Must |
| FR-2 | The system shall operate read-only and shall never perform a write, trigger, or delete action on a connected platform | F1 | Must |
| FR-3 | The system shall confirm connection status and notify the operator when access lapses | F1 | Must |
| FR-4 | The system shall state explicitly which workflows it can and cannot observe when access is partial | F1 | Must |
| FR-5 | The system shall allow disconnection, after which it retains no further access | F1 | Must |
| FR-6 | The system shall detect every failed workflow run on the connected platform without operator action | F2 | Must |
| FR-7 | The system shall record, for each failure, the workflow, timestamp, and failing step | F2 | Must |
| FR-8 | The system shall present all unresolved failures in a single consolidated view | F2 | Must |
| FR-9 | The system shall allow an operator to acknowledge or resolve a failure, removing it from the active view | F2 | Must |
| FR-10 | The system shall deliver notification of new failures through at least one operator-chosen path | F2 | Must |
| FR-11 | The system shall make observation gaps visible rather than omitting them silently | F2 | Must |
| FR-12 | The system shall assign each failure a cause category or an explicit `Unclassified` label | F3 | Must |
| FR-13 | The system shall define its cause categories independently of any specific platform | F3 | Must |
| FR-14 | The system shall support, at minimum, the six baseline cause categories named in F3 | F3 | Must |
| FR-15 | The system shall prefer `Unclassified` over a low-confidence classification | F3 | Must |
| FR-16 | The system shall produce a plain-language explanation for each classified failure | F4 | Must |
| FR-17 | The system shall identify, in each explanation, the specific step and relevant data involved | F4 | Must |
| FR-18 | The system shall express uncertainty plainly where the cause is not determinable | F4 | Must |
| FR-19 | The system shall not include remediation advice in V1 explanations | F4 | Must |
| FR-20 | The system shall display a confidence signal with every explanation | F5 | Must |
| FR-21 | The system shall derive confidence from measured accuracy, not from assertion | F5 | Must |
| FR-22 | The system shall publish its known blind spots in-product | F5 | Must |
| FR-23 | The system shall indicate whether a failure has previously occurred on the same workflow | F5 | Must |
| FR-24 | The system shall report per-category measured accuracy to the operator | F5 | Should |
| FR-25 | The system shall be usable without the operator writing code or scripts | All | Must |
| FR-26 | The system shall provide value on first connection, with no prior configuration of workflows or rules | All | Must |
| FR-27 | The system shall redact sensitive values before displaying any payload-derived content | F4 | Must |

---

## 11. Non-Functional Requirements

### Performance

| ID | Requirement |
|---|---|
| NFR-P1 | A failure shall become visible to the operator within a window short enough that NAIGX is the first notification of the problem, not the second. Initial target: within 5 minutes of the failed run. |
| NFR-P2 | The consolidated failure view shall remain responsive at the workflow volumes a single operator manages. Initial target: 200 workflows, 10,000 runs/day. |
| NFR-P3 | Explanation generation shall complete quickly enough to be read in the same session the failure is reviewed. Initial target: under 30 seconds. |

### Reliability

| ID | Requirement |
|---|---|
| NFR-R1 | **NAIGX shall never fail silently.** A monitoring tool that stops monitoring without saying so is worse than no monitoring — this is the product's single worst failure mode. |
| NFR-R2 | Loss of platform connectivity shall surface to the operator as an explicit degraded state, never as an empty failure list. |
| NFR-R3 | No detected failure shall be lost. Missed detection is a more serious defect than a wrong classification. |
| NFR-R4 | The system shall degrade gracefully under partial access, remaining useful for what it can observe. |

### Security

| ID | Requirement |
|---|---|
| NFR-S1 | Access to connected platforms shall be least-privilege and read-only. V1 requires no write scope. |
| NFR-S2 | Payload-derived content shall be redacted before display. The corpus includes customer records (`JD-005`), member data (`JD-003`), and financial transactions (`JD-004`) — payloads must be assumed to contain personal or financial data. |
| NFR-S3 | Credentials for connected platforms shall be stored encrypted and shall never appear in explanations, notifications, or logs. |
| NFR-S4 | Payload content shall be retained only as long as needed to explain a failure, and no longer. |
| NFR-S5 | Disconnection shall revoke access and remove retained payload content. |

### Scalability

| ID | Requirement |
|---|---|
| NFR-SC1 | V1 targets a single operator and a single connected platform. Multi-tenancy is explicitly out of scope. |
| NFR-SC2 | The cause-category taxonomy shall be platform-independent so that adding a platform does not require redefining it. This is the Horizon 2 precondition. |
| NFR-SC3 | V1 shall be cheap to abandon — see G7. Scale is not a V1 concern; reversibility is. |

### Usability

| ID | Requirement |
|---|---|
| NFR-U1 | Every operator-facing output shall be comprehensible to a technically-literate non-programmer. 3/5 corpus records treat scripting as optional. |
| NFR-U2 | The system shall be useful on first connection without prior configuration. |
| NFR-U3 | Uncertainty shall always be visible. The operator shall never be unable to tell a confident diagnosis from a tentative one. |
| NFR-U4 | The active failure view shall be readable at a glance — the operator's first question is "is anything broken right now?" |

---

## 12. Success Metrics

V1 has no users. Every metric below is measurable by the builder alone. Metrics presupposing customers are excluded.

### Primary — is the explanation correct?

| Metric | Definition | Initial target |
|---|---|---|
| **Classification accuracy** | % of seeded failures assigned the correct cause category | ≥ 85% |
| **False-confidence rate** | % of *incorrect* explanations presented at high confidence. The metric that matters most | ≤ 2% |
| **Unclassified rate** | % of seeded failures NAIGX declines to classify | ≤ 20%, and honestly reported |
| **Detection completeness** | % of seeded failures detected at all | 100% — a miss is a defect |

> Targets are **initial thresholds chosen by the builder**, not evidence-derived. No record in the corpus states an accuracy requirement. They exist to be argued with.

### Secondary — is it usable and portable?

| Metric | Definition | Initial target |
|---|---|---|
| Time to first value | Connection → first useful explanation | < 15 minutes |
| Time to understanding | Failure surfaced → operator knows what broke, measured in self-testing | < 2 minutes |
| Category portability | Cause categories requiring redefinition when a second platform is added | 0 |
| Code requirement | Operator actions requiring code | 0 |

### Process — is the discipline holding?

| Metric | Definition | Target |
|---|---|---|
| Feature traceability | % of V1 features traceable to ≥1 corpus record | 100% |
| Backward legibility | Can an unfamiliar reader trace any feature to its evidence? | Yes |
| Rejection rate | Candidate features stopped by missing evidence or competitor findings | > 0 — a zero means the gates are decorative |

### Explicitly not measured

Revenue, users, retention, engagement, NPS, market share. None exist.

---

## 13. Risks

### Product risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| **R1** | **The problem is already well-solved.** Automation platforms ship execution history and error handling natively. The corpus proves companies *pay salaries* for this work — not that existing tooling fails at it | **Critical — invalidates V1** | Close the competitive gate before building. This is the cheapest possible invalidation and the highest-value next action |
| R2 | Confident wrong explanations destroy trust faster than no product earns it | High | False-confidence rate is the primary metric; `Unclassified` is preferred over guessing (FR-15) |
| R3 | The taxonomy overfits to seeded failures and fails on real ones | High | Seeded set built from failure types named in the corpus, not invented; category set defined platform-independently |
| R4 | Platform access may not expose enough run detail to explain failures — feasibility recorded as **unverified** in `JD-005` | High | Verify before building. If run detail is insufficient, V1 as scoped is not buildable |
| R5 | An operator may not adopt a tool that explains but cannot fix | Medium | The corpus supports explanation and gives zero support for autonomy. If this risk materialises it is evidence *against the corpus*, which is itself a valuable finding |
| R6 | Platform choice (n8n, 1/5 records) is weaker on evidence than Make.com (2/5) | Medium | Accepted deliberately — seeded-failure measurement requires a self-hostable platform. Make.com is the first addition and the Horizon 2 test |

### Market and evidence risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R7 | Evidence is 🟡 at best: n=5, one source type | High | V1 is scoped as a prototype, not a commitment (see standing note). Broaden source types before committing |
| R8 | Company independence is unverifiable — 4/5 records are anonymous, so frequencies may be inflated by undetected overlap | High | Prioritise records from employers who post under their own name |
| R9 | Postings are aspirational; stated pain may exceed real pain. `JD-003` pairs the broadest stack in the corpus with its lowest salary band | Medium | Corroborate with community and review evidence — the required second source type |
| R10 | Possible sourcing concentration: `JD-003` and `JD-004` share a reference-number format | Medium | Diversify collection sources |
| R11 | Building a monitoring product for a market that self-hosts may imply deployment expectations V1 has not considered | Low–Medium | Recorded; resolved at design time, not here |

---

## 14. Assumptions

Each requires validation. Each would change V1 if false.

| # | Assumption | If false | Test |
|---|---|---|---|
| A1 | Failure diagnosis is not already adequately solved by the platforms operators run | V1 is invalidated entirely | Competitor research — **blocking** |
| A2 | Connected platforms expose enough run detail to determine cause | V1 as scoped is not buildable | Feasibility check before build |
| A3 | Failure causes fall into a small, learnable set of categories | Classification accuracy will not reach target | Seeded failure evaluation |
| A4 | Operators will trust an explanation carrying a confidence signal more than one without | Confidence disclosure is overhead, not value | Self-testing; later, user feedback |
| A5 | The 3/5 operator-not-programmer ratio holds beyond n=5 | Usability requirements are aimed at the wrong user | Corpus growth |
| A6 | Explanation alone is valuable without remediation | V1 under-delivers | Self-testing; corpus growth |
| A7 | A platform-independent taxonomy is achievable | Horizon 2 portability fails; V1 becomes vendor-locked | Second-platform test in V2 |
| A8 | The five corpus employers are genuinely independent | Every frequency in this PRD is inflated | Collect attributable postings |
| A9 | Failure frequency is high enough for detection to be worth automating | The problem is real but not painful enough to buy | No record states failure volume — genuine gap |

---

## 15. Future Enhancements

Deferred deliberately. None is committed; each requires its own evidence gate.

| Enhancement | Evidence | Gate before consideration |
|---|---|---|
| **Second platform (Make.com)** | 2/5 records | V1 accuracy targets met. Doubles as the Horizon 2 portability test |
| **Suggested fixes** | Implied by 4/5 troubleshooting demand | Explanation accuracy proven first; suggestion needs its own accuracy bar |
| **Documentation generated from workflow definitions** | 3/5 (`JD-001`, `JD-002`, `JD-005`) | V1 complete. Shares components with V1 |
| **Zapier support** | 2/5, explicitly "optional" in `JD-005` | Demand confirmed at larger sample |
| **CRM-side connections (HubSpot)** | 3/5 — the most-mentioned named tool | Portability proven on automation platforms first |
| **Schema / field mapping across CRMs** | 2/5 (🔴), agency-specific | Persona C validated as a real segment |
| **Multi-client separation for agencies** | 2/5 (🔴) | Persona C validated |
| **Operational reporting and visibility** | 4/5 | Horizon 3; requires visibility demand to survive larger samples |
| **MCP packaging** | 1/5 (`JD-004`) | A distribution decision, not a capability. Revisit when there is a capability worth distributing |
| **Test generation for event-driven services** | 1/5 (`JD-004`) | Distinct product bet; recurrence required first |
| **Autonomous remediation** | **0/5** | Ahead of 100% of current evidence. Requires demand to appear before it is designed |
| **Unified workspace** | **0/5** | Horizon 4. Named in the canonical mission but unsupported by any record |

---

## Appendix — Document Relationships

| Document | Relationship to this PRD |
|---|---|
| `research/00-Market-Discovery.md` | Defines the validation thresholds and gates this PRD operates under |
| `research/01-Job-Description-Matrix.md` | Primary evidence. Every feature traces to records `JD-001`–`JD-005` |
| `research/06-Market-Insights.md` | Cross-record synthesis; source of all frequency counts |
| `docs/Product-Vision.md` | Defines scope boundaries, principles, and horizons this PRD must obey |
| `research/05-Competitor-Research.md` | **Empty — blocking gate for R1/A1** |

---

*This is a living document. V1 is intentionally small, intentionally falsifiable, and intentionally cheap to abandon. If competitor research or broader evidence contradicts its premise, the correct outcome is to discard it — and to record that as the process working.*
