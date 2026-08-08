# Job Description Matrix

> **Status:** Living document · **Owner:** NAIGX Research · **Last updated:** `YYYY-MM-DD`

---

## Purpose

This document is the central research database for every job description analyzed during the NAIGX project.

Job postings are one of the few public artifacts where companies state, in writing, what work they cannot currently get done. Each posting is a signed admission of an unmet operational need — the tools already in use, the skills missing from the team, and the outcomes being paid for. Read individually, a posting is anecdote. Read in aggregate and structured consistently, postings become market intelligence.

The purpose of this document is to convert unstructured job postings into a structured, queryable dataset that guides NAIGX product decisions and portfolio priorities.

This document exists to answer questions such as:

| Question | What the answer drives |
| --- | --- |
| What business problems appear most frequently? | Core product positioning |
| Which software tools are most in demand? | Native integration roadmap |
| Which AI skills are becoming standard? | Feature baseline vs. differentiator |
| Which automation platforms are companies hiring for? | Build vs. connect strategy |
| Which integrations should NAIGX support first? | Sequencing of connector work |
| Which portfolio projects provide the highest ROI? | Where to spend build time |

It is deliberately a *living* document. Entries accumulate, the dashboard is recalculated, and conclusions are expected to shift as the sample grows. No decision should be made on a sample too small to support it.

---

## How This Document Is Used

Every job description contributes to NAIGX product development through four channels:

**1. Demand evidence.** A posting is a data point that a specific business problem is painful enough to pay a salary to solve. Frequency across postings is the primary demand signal used to rank features.

**2. Integration prioritization.** Tools, platforms, and APIs named in postings form the integration backlog. A tool mentioned repeatedly across independent companies moves ahead of a tool mentioned once, regardless of how interesting it is to build.

**3. Feature hypothesis generation.** Each posting produces at least one candidate feature hypothesis — a statement of what NAIGX could do to make part of the advertised role unnecessary or dramatically faster. Hypotheses accumulate; the ones that recur independently are the strongest.

**4. Portfolio direction.** Each posting suggests a demonstrable artifact — a workflow, dashboard, integration, or automation — that proves capability against a real, documented market need. Portfolio work is selected by priority score, not preference.

**Working rules:**

- One record per posting. Never merge two postings into one record.
- Record what the posting *says*, not what it probably means. Inference belongs in Product Insights, not in Technical Requirements.
- Preserve the original vocabulary. If a posting says "AI-driven reporting," capture that phrase before normalizing it.
- Archive the original posting text or a screenshot. Listings expire; the record must survive.
- Recalculate the Summary Dashboard on a fixed cadence, not opportunistically.

---

## Research Workflow

Every posting moves through seven stages. A record is not complete until all seven have been filled.

```mermaid
flowchart TD
    A[Job Description] --> B[Business Problem]
    B --> C[Required Skills]
    C --> D[Required Tools]
    D --> E[Automation Opportunity]
    E --> F[Feature Hypothesis]
    F --> G[Portfolio Implementation]
```

| Stage | Question answered | Output |
| --- | --- | --- |
| **1. Job Description** | What did the company actually publish? | Raw posting captured and archived with metadata |
| **2. Business Problem** | Why does this role exist? | The underlying operational gap, stated in business terms rather than task terms |
| **3. Required Skills** | What capability is being purchased? | Normalized skill list separating hard technical skills from process and domain skills |
| **4. Required Tools** | What stack does the work live inside? | Software, AI tools, automation platforms, APIs, and reporting surfaces |
| **5. Automation Opportunity** | Which parts of this role are rules-based, repetitive, or high-volume? | Specific tasks that a system could perform partly or fully |
| **6. Feature Hypothesis** | What could NAIGX build to address this? | A falsifiable statement of a capability and the outcome it produces |
| **7. Portfolio Implementation** | What artifact proves it? | A concrete, buildable deliverable with scope and effort estimate |

**Stage notes:**

- Stage 2 is the most commonly rushed and the most important. "Needs a data analyst" is a task. "Cannot see revenue by channel without three days of manual consolidation" is a business problem. Only the second is useful.
- Stage 5 should distinguish *full automation* (the task disappears) from *augmentation* (the task gets faster but still needs a human). These have very different product implications.
- Stage 6 must be falsifiable. A hypothesis that cannot be wrong is not a hypothesis.
- Stage 7 should be scoped to something completable, not aspirational.

---

## Summary Dashboard

> Recalculate on a fixed cadence. Do not update piecemeal — inconsistent refresh dates make trends unreadable.

**Last recalculated:** `YYYY-MM-DD` · **Sample size:** `N` · **Collection window:** `YYYY-MM-DD → YYYY-MM-DD`

### Coverage

| Metric | Value |
| --- | --- |
| Total Jobs Reviewed | `—` |
| Records Fully Validated | `—` |
| Records Pending Analysis | `—` |
| Distinct Companies | `—` |
| Distinct Industries | `—` |

### Industries

| Industry | Count | % of Sample | Notes |
| --- | --- | --- | --- |
| `—` | `—` | `—` | `—` |
| `—` | `—` | `—` | `—` |
| `—` | `—` | `—` | `—` |

### Most Requested Software

| Rank | Software | Mentions | % of Sample | Category |
| --- | --- | --- | --- | --- |
| 1 | `—` | `—` | `—` | `—` |
| 2 | `—` | `—` | `—` | `—` |
| 3 | `—` | `—` | `—` | `—` |

### Most Requested AI Platforms

| Rank | Platform | Mentions | % of Sample | Typical Use Case |
| --- | --- | --- | --- | --- |
| 1 | `—` | `—` | `—` | `—` |
| 2 | `—` | `—` | `—` | `—` |
| 3 | `—` | `—` | `—` | `—` |

### Most Requested Automation Platforms

| Rank | Platform | Mentions | % of Sample | Typical Use Case |
| --- | --- | --- | --- | --- |
| 1 | `—` | `—` | `—` | `—` |
| 2 | `—` | `—` | `—` | `—` |
| 3 | `—` | `—` | `—` | `—` |

### Most Requested APIs / Integrations

| Rank | API / Integration | Mentions | % of Sample | Direction (read / write / both) |
| --- | --- | --- | --- | --- |
| 1 | `—` | `—` | `—` | `—` |
| 2 | `—` | `—` | `—` | `—` |
| 3 | `—` | `—` | `—` | `—` |

### Most Requested Skills

| Rank | Skill | Mentions | % of Sample | Type (technical / process / domain) |
| --- | --- | --- | --- | --- |
| 1 | `—` | `—` | `—` | `—` |
| 2 | `—` | `—` | `—` | `—` |
| 3 | `—` | `—` | `—` | `—` |

### Highest Demand Business Problems

| Rank | Business Problem | Frequency | Avg. Business Impact | Candidate NAIGX Feature |
| --- | --- | --- | --- | --- |
| 1 | `—` | `—` | `—` | `—` |
| 2 | `—` | `—` | `—` | `—` |
| 3 | `—` | `—` | `—` | `—` |

### Highest Demand Workflows

| Rank | Workflow | Frequency | Automation Potential (full / partial / none) | Priority Score |
| --- | --- | --- | --- | --- |
| 1 | `—` | `—` | `—` | `—` |
| 2 | `—` | `—` | `—` | `—` |
| 3 | `—` | `—` | `—` | `—` |

---

## Job Description Record Template

> Copy this block for every posting. Do not delete unused fields — record `Not stated` so that gaps in the data remain visible and countable.

---

### `JD-000` — `Company` — `Job Title`

#### General Information

| Field | Value |
| --- | --- |
| Job ID | `JD-000` |
| Company | `—` |
| Job Title | `—` |
| Industry | `—` |
| Employment Type | `Full-time / Part-time / Contract / Freelance / Internship` |
| Location | `City, Country` + `On-site / Hybrid / Remote` |
| Salary | `Range + currency + period`, or `Not stated` |
| Source | `Job board / company site / referral / other` |
| Date Collected | `YYYY-MM-DD` |
| Link to Original Posting | `URL` |
| Archive Reference | `Path to saved copy or screenshot` |

---

#### Business Analysis

**Business Problems**

What operational gap caused this role to be opened? State in business terms, not task terms.

| # | Business Problem | Evidence from Posting |
| --- | --- | --- |
| 1 | `—` | `—` |
| 2 | `—` | `—` |

**Business Goals**

What outcome is the company trying to reach? Include stated targets and metrics where given.

- `—`
- `—`

**Current Pain Points**

Friction the posting reveals, whether stated directly or implied by the responsibilities listed.

| Pain Point | Stated or Inferred | Frequency / Volume (if given) |
| --- | --- | --- |
| `—` | `—` | `—` |
| `—` | `—` | `—` |

---

#### Technical Requirements

**Required Skills**

| Skill | Type (technical / process / domain) | Level (required / preferred) |
| --- | --- | --- |
| `—` | `—` | `—` |
| `—` | `—` | `—` |

**Required Software**

| Software | Category | Level (required / preferred) |
| --- | --- | --- |
| `—` | `—` | `—` |

**Required AI Tools**

| AI Tool / Platform | Stated Use Case | Level (required / preferred) |
| --- | --- | --- |
| `—` | `—` | `—` |

**Required Automation Platforms**

| Platform | Stated Use Case | Level (required / preferred) |
| --- | --- | --- |
| `—` | `—` | `—` |

**APIs / Integrations Mentioned**

| API / System | Direction (read / write / both) | Stated Purpose |
| --- | --- | --- |
| `—` | `—` | `—` |

**Reporting / Analytics Requirements**

| Requirement | Audience | Cadence | Delivery Format |
| --- | --- | --- | --- |
| `—` | `—` | `—` | `—` |

---

#### Product Insights

**Automation Opportunities**

| # | Task | Automation Potential (full / partial / none) | Rationale |
| --- | --- | --- | --- |
| 1 | `—` | `—` | `—` |

**AI Opportunities**

| # | Task | AI Role (generate / classify / extract / summarize / decide) | Rationale |
| --- | --- | --- | --- |
| 1 | `—` | `—` | `—` |

**Potential NAIGX Feature**

State as a falsifiable hypothesis.

> If NAIGX provided `—`, then `—` would be able to `—`, reducing `—`.

| Field | Value |
| --- | --- |
| Feature Name | `—` |
| Problem It Solves | `—` |
| Dependencies / Prerequisites | `—` |
| Related Existing Hypotheses | `JD-000`, `JD-000` |

**Portfolio Opportunity**

| Field | Value |
| --- | --- |
| Deliverable | `—` |
| Scope | `—` |
| Estimated Effort | `—` |
| What It Proves | `—` |
| Reusable Assets Produced | `—` |

**Scoring**

| Dimension | Score (1–5) | Justification |
| --- | --- | --- |
| Difficulty | `—` | `—` |
| Business Impact | `—` | `—` |
| Priority Score | `—` | `—` |

Scoring reference:

| Score | Difficulty | Business Impact | Priority |
| --- | --- | --- | --- |
| 1 | Trivial — hours, known tools | Marginal — convenience only | Backlog, revisit later |
| 2 | Low — days, minor unknowns | Small — one team benefits | Low |
| 3 | Moderate — weeks, some unknowns | Meaningful — measurable time or cost saved | Medium |
| 4 | High — significant unknowns or dependencies | Large — affects a core process | High |
| 5 | Very high — new capability required | Critical — addresses the stated reason the role exists | Build next |

> Priority is a judgment, not a formula. Difficulty and Business Impact inform it; recurrence across multiple records should raise it. Record the reasoning in the justification column.

---

#### Personal Notes

Free-form. Use for anything that does not fit the structure above: doubts about the data, patterns noticed, questions to investigate, language worth reusing, or reasons a record may be misleading.

```
—
```

---

## Records

### `JD-001` — `Not stated (recruiter contact: Sammy@somewhere.com)` — `Marketing Automation Lead (HubSpot Expert)`

#### General Information

| Field | Value |
| --- | --- |
| Job ID | `JD-001` |
| Company | `Not stated` — posting is unbranded; applications route through a third-party contact (`Sammy@somewhere.com`), suggesting a recruiter/agency rather than the hiring company directly |
| Job Title | Marketing Automation Lead (HubSpot Expert) |
| Industry | Information Technology |
| Employment Type | `Not stated` |
| Location | Remote — aligned to CET / UTC+2 (EU business hours) |
| Salary | `Not stated` — posting asks the *candidate* to state expected monthly salary in USD rather than disclosing a range |
| Source | `Not stated` — posting text supplied directly, no board or URL given |
| Date Collected | 2026-08-08 |
| Link to Original Posting | `Not stated` |
| Archive Reference | Posting text captured verbatim in NAIGX research conversation, 2026-08-08 — recommend saving a standalone copy, since no live URL exists to archive against |

---

#### Business Analysis

**Business Problems**

| # | Business Problem | Evidence from Posting |
| --- | --- | --- |
| 1 | GTM organization lacks an owned, well-architected data backbone — HubSpot is being run without a dedicated owner for data model and system design | "we are looking for a Marketing Automation Expert that can build the backbone of data for our GTM organization" |
| 2 | Demand-gen systems are not reliably delivering a consistent experience across touchpoints | "ensure that our demand gen systems are working flawlessly to provide next-level customer experiences across every touchpoint" |
| 3 | No clear visibility into true demand source / attribution | "UTM/attribution modeling. Knows how to track where demand actually comes from" |
| 4 | Leadership and marketing are bottlenecked on a central data team for reporting | "Basic SQL or data querying. Able to pull their own reports without waiting on a data team" |
| 5 | Data hygiene and lead routing are unmanaged or inconsistent | "Comfortable with data hygiene and lead routing logic" |

**Business Goals**

- Stand up marketing automation/CRM systems that run "flawlessly" across every customer touchpoint
- Give leadership self-serve, visualized reporting to make informed decisions
- Establish data and automation flows that span Product, Engineering, Sales, and Leadership, not just Marketing

**Current Pain Points**

| Pain Point | Stated or Inferred | Frequency / Volume (if given) |
| --- | --- | --- |
| Reporting requires waiting on a data team | Stated | Not stated |
| Automations break and require calm, methodical debugging | Stated | Not stated |
| Workflows are being built without being mapped/documented first | Inferred (from "map and document complex workflows before building them") | Not stated |
| Funnel-stage definitions (MQL/SQL/pipeline) may be inconsistent across teams | Inferred | Not stated |

---

#### Technical Requirements

**Required Skills**

| Skill | Type (technical / process / domain) | Level (required / preferred) |
| --- | --- | --- |
| HubSpot data model & system design ownership | technical | required |
| SQL / data querying | technical | required |
| Webhook/API literacy (non-coding) | technical | required |
| UTM/attribution modeling | technical | required |
| Reporting & data visualization | technical | required |
| Workflow mapping & documentation | process | required |
| Data hygiene & lead routing logic | process | required |
| Funnel stage knowledge (MQL/SQL/pipeline) | domain | required |
| Automation debugging under pressure | technical | required |
| Paid media fundamentals (agency briefing / budget mgmt) | domain | required |
| Email nurture strategy (segmentation, sequencing, personalization) | domain | required |
| Webinar / content syndication ops | domain | preferred |
| PLG / developer-tools marketing experience | domain | preferred |
| Product usage data familiarity | technical | preferred |
| Community-led / open-source GTM exposure | domain | preferred |

**Required Software**

| Software | Category | Level (required / preferred) |
| --- | --- | --- |
| HubSpot | Marketing Automation / CRM | required |

**Required AI Tools**

| AI Tool / Platform | Stated Use Case | Level (required / preferred) |
| --- | --- | --- |
| `—` | Not stated | `—` |

**Required Automation Platforms**

| Platform | Stated Use Case | Level (required / preferred) |
| --- | --- | --- |
| `—` | Not stated by name — only described generically as "data and automation flows across the organization" | `—` |

**APIs / Integrations Mentioned**

| API / System | Direction (read / write / both) | Stated Purpose |
| --- | --- | --- |
| Generic webhooks/APIs | both | "understands how systems talk to each other" — no specific system named |
| Amplitude (nice to have) | read | Product usage data feeding into marketing automation |
| "Database" (nice to have, as named in posting) | read | Product usage data — ambiguous term, unclear if a specific product or used generically |

**Reporting / Analytics Requirements**

| Requirement | Audience | Cadence | Delivery Format |
| --- | --- | --- | --- |
| Demand/pipeline visibility for decision-making | Leadership | Not stated | Not stated (implied visualization/dashboard) |
| Self-serve SQL pulls | Marketing Automation Lead (self-service) | Not stated | Not stated |

---

#### Product Insights

**Automation Opportunities**

| # | Task | Automation Potential (full / partial / none) | Rationale |
| --- | --- | --- | --- |
| 1 | UTM/attribution tagging and rollup reporting | full | Rules-based tagging plus automated dashboarding once conventions are set |
| 2 | Lead routing execution | partial | Rules can run automatically, but hygiene exceptions still need human judgment |
| 3 | Leadership reporting pack assembly | partial | SQL pulls and chart generation can be templated; narrative framing still benefits from a human |
| 4 | Pre-build workflow mapping/documentation | partial | AI can draft a flow diagram from a description, but validation against real systems needs a human |

**AI Opportunities**

| # | Task | AI Role (generate / classify / extract / summarize / decide) | Rationale |
| --- | --- | --- | --- |
| 1 | Diagnosing broken HubSpot automations | extract / decide | Reading workflow config + run history to isolate a failure point is a diagnostic-reasoning task explicitly named as a required human skill ("debug a broken automation without panicking") |
| 2 | Attribution/UTM analysis | classify / extract | Mapping inconsistent UTM tagging to real demand sources is pattern classification |
| 3 | Leadership report generation | summarize | Converting SQL output into a leadership-ready narrative and visualization |
| 4 | Lead routing rule audit | decide | Recommending routing logic changes based on observed data hygiene issues |

**Potential NAIGX Feature**

> If NAIGX provided an AI copilot that reads a HubSpot workflow's configuration and recent run history, then a Marketing Automation Lead would be able to diagnose and explain a broken automation in minutes instead of manually tracing each step, reducing time-to-resolution on demand-gen system outages.

| Field | Value |
| --- | --- |
| Feature Name | HubSpot Automation Debugger / Workflow Diagnostic Copilot |
| Problem It Solves | "Can debug a broken automation without panicking" is stated as a hiring requirement — evidence that this diagnostic work is currently manual and skill-gated |
| Dependencies / Prerequisites | HubSpot API/webhook read access; access to workflow history or run logs |
| Related Existing Hypotheses | None yet — JD-001 is the first record in this matrix |

**Portfolio Opportunity**

| Field | Value |
| --- | --- |
| Deliverable | Demo tool that ingests a HubSpot workflow's config plus recent run history and outputs a plain-English root-cause diagnosis with a suggested fix |
| Scope | Single-workflow diagnostic; mock HubSpot data acceptable if no live sandbox is available; output a readable report artifact |
| Estimated Effort | Days for a functional prototype; weeks for a polished version wired to a real HubSpot sandbox |
| What It Proves | NAIGX can operationalize a skill explicitly named in a live job posting as hard to hire for |
| Reusable Assets Produced | HubSpot API client wrapper, workflow/run-log parser, diagnostic-report template |

**Scoring**

| Dimension | Score (1–5) | Justification |
| --- | --- | --- |
| Difficulty | 3 | Requires HubSpot API familiarity and enough sandbox/log examples to generalize; integration work, not a new capability |
| Business Impact | 3 | Addresses a named skill gap, but this is a single record — impact is speculative until recurrence is observed |
| Priority Score | 3 (Medium) | Single-record evidence only; revisit once 2–3 more HubSpot/RevOps postings are collected to test recurrence |

---

#### Personal Notes

```
- This posting asks applicants to send expected salary, reasons for leaving the last three roles, and an
  "unrestricted, public, non-expiring" Google Drive video introduction to a generic address
  (Sammy@somewhere.com — note the placeholder-looking domain). Requesting job-history justification and an
  openly public video link before any interview is a pattern more associated with data-harvesting/scam
  postings than a genuine first-stage screen. Flagging for awareness, not scoring as a market signal.
- Salary asymmetry: the posting requires the candidate's number but discloses none of its own. Worth watching
  whether this is common across the sample or specific to this listing.
- No automation platform (e.g. Zapier, Make, n8n) is named despite "automation flows across the organization"
  language — worth checking in future records whether HubSpot-native workflows alone typically satisfy this,
  or whether a connector platform is usually named alongside HubSpot.
- Sample size is 1. Per this document's own guidance, no dashboard recalculation or ranking should be drawn
  from a single record — Summary Dashboard intentionally left untouched until more records exist.
```

---

### `JD-002` — `Not stated (identified internally as Req #20684; certified woman-owned small business, mission-critical aviation services)` — `AI Automation Engineer`

#### General Information

| Field | Value |
| --- | --- |
| Job ID | `JD-002` |
| Company | `Not stated` — posting withholds the company name; described only as "a certified woman-owned small business providing end-to-end mission-critical aviation services, including aircraft leasing, ISR configuration, program management, and logistics support for government and commercial clients worldwide" |
| Job Title | AI Automation Engineer (posting header also uses "AI Data Engineer" once when describing the sought role — inconsistent internally, see Personal Notes) |
| Industry | Aerospace / Aviation (government and commercial, incl. ISR/defense-adjacent logistics) |
| Employment Type | `Not stated` — no Full-time/Part-time/Contract label given, though "Mon–Fri, 9:00 AM–5:00 PM PST" hours and a monthly pay range imply a standard ongoing engagement |
| Location | Location of Search: Philippines, South Africa, Latin America · Work Location: Remote |
| Salary | $4,000–$5,000/month (USD implied, not stated explicitly), "varies based on skill set and experience level" |
| Source | `Not stated` — posting text supplied directly, no board or URL given |
| Date Collected | 2026-08-08 |
| Link to Original Posting | `Not stated` |
| Archive Reference | Posting text captured verbatim in NAIGX research conversation, 2026-08-08 — recommend saving a standalone copy, since no live URL exists to archive against |

---

#### Business Analysis

**Business Problems**

| # | Business Problem | Evidence from Posting |
| --- | --- | --- |
| 1 | Company has no dedicated internal owner for AI infrastructure or strategy — AI adoption is ad hoc rather than centrally driven | "help build and scale their internal AI infrastructure" / "serve as the organization's technical lead for artificial intelligence initiatives" / "Opportunity to shape the company's long-term AI roadmap" |
| 2 | Cross-departmental administrative and operational workflows are manual, repetitive, and consuming staff time | "Automate business processes including: Scheduling, Data entry, Travel coordination, Administrative workflows, Operational reporting" |
| 3 | No single point of contact exists for AI/automation questions or troubleshooting across teams | "Serve as the organization's primary point of contact for AI and automation initiatives" / "Provide guidance and support to internal teams on AI best practices" |
| 4 | Existing AI platforms/assistants are not being systematically maintained or optimized | "Help evolve and optimize existing AI platforms and internal AI assistants" / "Troubleshoot AI-related issues and optimize existing solutions" |
| 5 | AI workflows and technical solutions are undocumented, creating risk of tribal knowledge | "Document AI workflows, processes, and technical solutions" |

**Business Goals**

- Build and scale an internal AI infrastructure/ecosystem owned by a single technical lead
- Automate manual administrative processes (scheduling, data entry, travel coordination, reporting) across multiple departments
- Increase operational efficiency and reduce manual work as a measurable outcome ("Reduction in manual administrative processes" is listed as a success metric)
- Drive broader "digital transformation" across the organization, not just a single department
- Maintain and expand internal AI assistants built on Claude (Claude for Work/Cowork)

**Current Pain Points**

| Pain Point | Stated or Inferred | Frequency / Volume (if given) |
| --- | --- | --- |
| Repetitive manual tasks across scheduling, data entry, travel coordination, and reporting | Stated | Not stated |
| No formal AI governance/best-practices guidance for internal teams | Inferred (from "Provide guidance and support to internal teams on AI best practices") | Not stated |
| AI initiatives currently lack a single accountable owner | Inferred (from "primary point of contact" and "technical lead" framing) | Not stated |
| Executive/admin support tasks (personal scheduling, travel) are being handled without dedicated support | Stated ("Personal Assistance" section) | Occasional ("Assist with occasional personal administrative tasks") |

---

#### Technical Requirements

**Required Skills**

| Skill | Type (technical / process / domain) | Level (required / preferred) |
| --- | --- | --- |
| AI Engineering / Data Engineering / Software Engineering experience (2–5 yrs) | technical | required |
| Hands-on experience building AI workflows/assistants/automations with Claude (Claude for Work/Cowork) | technical | required |
| Workflow automation solution building | technical | required |
| Understanding of AI concepts and modern AI tools | technical | required |
| API and system integration experience | technical | required |
| Data management and analytical skills | technical | required |
| Developing scalable technical solutions | technical | required |
| Problem-solving and troubleshooting | process | required |
| Written and verbal English communication | domain | required |
| Independent management of multiple technical initiatives | process | required |
| AI assistants / LLM experience | technical | preferred |
| Workflow automation platform experience | technical | preferred |
| Multi-system/API integration experience | technical | preferred |
| Cloud-based AI services familiarity | technical | preferred |
| Building internal productivity tools | technical | preferred |
| Scripting/programming (Python, JavaScript, or SQL) | technical | preferred |
| Operational/administrative process automation support | process | preferred |
| Government, aviation, logistics, or regulated-industry background | domain | preferred |

**Required Software**

| Software | Category | Level (required / preferred) |
| --- | --- | --- |
| Microsoft Office Suite | Productivity | preferred (listed under "Technology & Tools") |
| Google Workspace | Productivity | preferred (listed under "Technology & Tools") |

**Required AI Tools**

| AI Tool / Platform | Stated Use Case | Level (required / preferred) |
| --- | --- | --- |
| Claude / Claude Cowork | Building AI workflows, assistants, and automations; maintaining internal AI assistants | required |
| ChatGPT | Listed under "Technology & Tools" as preferred, no specific use case stated | preferred |
| Large Language Models (LLMs), general | Underpins AI assistants and automation solutions | preferred |
| Cloud-based AI services (unnamed) | Not stated beyond "familiarity" | preferred |

**Required Automation Platforms**

| Platform | Stated Use Case | Level (required / preferred) |
| --- | --- | --- |
| Workflow automation tools (unnamed) | Automating scheduling, data entry, travel coordination, admin workflows, and operational reporting | preferred — listed generically under "Technology & Tools," no specific platform (e.g. Zapier/Make/n8n) named |

**APIs / Integrations Mentioned**

| API / System | Direction (read / write / both) | Stated Purpose |
| --- | --- | --- |
| Generic APIs / system integrations (unnamed) | both | "Experience working with APIs and system integrations"; "Experience integrating multiple business systems and APIs" |
| Data engineering / ETL tools (unnamed) | both | Listed under "Technology & Tools," no specific tool named |

**Reporting / Analytics Requirements**

| Requirement | Audience | Cadence | Delivery Format |
| --- | --- | --- | --- |
| Operational reporting automation | Not stated (internal business functions, implied) | Not stated | Not stated |

---

#### Product Insights

**Automation Opportunities**

| # | Task | Automation Potential (full / partial / none) | Rationale |
| --- | --- | --- | --- |
| 1 | Scheduling (business and personal) | full | Rules-based calendar coordination is a well-established automation target, explicitly named twice in the posting |
| 2 | Data entry | full | Repetitive, structured-input task explicitly named as an automation target |
| 3 | Travel coordination | partial | Booking logistics can be automated, but exceptions (preferences, disruptions) still need human judgment, especially for the "personal assistance" variant |
| 4 | Operational reporting | partial | Data aggregation/formatting can be automated; interpretation and distribution to stakeholders likely still needs review |
| 5 | Administrative workflows (general) | partial | Too broadly defined in the posting to guarantee full automation across all cases |

**AI Opportunities**

| # | Task | AI Role (generate / classify / extract / summarize / decide) | Rationale |
| --- | --- | --- | --- |
| 1 | Internal AI assistant maintenance/optimization | decide / generate | "Help evolve and optimize existing AI platforms and internal AI assistants" implies ongoing tuning of prompts, tools, and assistant behavior |
| 2 | Operational reporting | extract / summarize | Converting raw operational data into reporting output is a summarization task |
| 3 | Troubleshooting AI-related issues | classify / decide | Diagnosing failures in AI-powered workflows before they can be fixed |
| 4 | Documentation of AI workflows and processes | summarize / generate | "Document AI workflows, processes, and technical solutions" is a generation task well-suited to AI-assisted drafting |

**Potential NAIGX Feature**

> If NAIGX provided a Claude-based internal-assistant scaffolding kit (prebuilt patterns for scheduling, data entry, and operational-reporting assistants, with built-in documentation generation), then a solo AI Automation Engineer would be able to stand up and document department-level automations in days instead of building each one from scratch, reducing the time-to-value for single-owner AI infrastructure initiatives.

| Field | Value |
| --- | --- |
| Feature Name | Claude Cowork Assistant Starter Kit (Scheduling / Data-Entry / Reporting templates) |
| Problem It Solves | Posting explicitly requires hands-on Claude/Claude Cowork experience for building workflows and assistants, with one engineer solely responsible for infrastructure, maintenance, troubleshooting, and documentation — evidence that this is currently a from-scratch, single-owner effort |
| Dependencies / Prerequisites | Claude for Work/Cowork access; API/system integration credentials for target business systems (unnamed in posting); a documentation template format |
| Related Existing Hypotheses | None yet — no recurrence observed across JD-001 and JD-002 (different tool ecosystems: HubSpot vs. Claude Cowork) |

**Portfolio Opportunity**

| Field | Value |
| --- | --- |
| Deliverable | A small library of Claude-based automation templates (e.g., meeting-scheduling assistant, structured data-entry assistant, operational-report generator) packaged with auto-generated documentation for each |
| Scope | 2–3 template assistants with mock data/business systems; auto-generated docs as the differentiator, since documentation is explicitly named as a required deliverable in this role |
| Estimated Effort | Days for one template end-to-end; a week or two for a 2–3 template library with consistent documentation output |
| What It Proves | NAIGX can operationalize the exact tool stack (Claude/Claude Cowork) and task set named as this role's core responsibilities |
| Reusable Assets Produced | Claude Cowork assistant templates, a documentation-generation pattern reusable across future automation records |

**Scoring**

| Dimension | Score (1–5) | Justification |
| --- | --- | --- |
| Difficulty | 2 | Templates use Claude/Claude Cowork directly with mock data; no novel integration required for a first version |
| Business Impact | 3 | Addresses a named, specific tool requirement (Claude Cowork) with clear stated tasks, but based on a single posting — recurrence unconfirmed |
| Priority Score | 3 (Medium) | Single-record evidence; revisit once more Claude/Cowork-specific postings are collected to test recurrence against JD-001's HubSpot-centric pattern |

---

#### Personal Notes

```
- The posting is internally inconsistent about the role's own name: the header and most of the body say
  "AI Automation Engineer," but the "About the Company" paragraph says "They are seeking an AI Data Engineer."
  Recorded the discrepancy rather than silently picking one.
- Company identity is deliberately withheld beyond a generic description and an internal requisition number
  (20684). No company name, board, or URL was provided — flagged as Not stated throughout rather than guessed.
- This is the first posting in the matrix naming Claude/Claude Cowork specifically as a required tool, which is
  directly relevant to NAIGX's own toolchain — worth watching closely for recurrence across future records, as
  it would be a strong, low-effort integration signal.
- "Personal Assistance" duties (personal scheduling, travel, confidentiality) sit oddly alongside a formal
  "technical lead for AI initiatives" role — likely reflects a small/founder-led organization where one hire
  covers both executive support and technical ownership. Worth checking if this pattern recurs in similarly
  small companies.
- No specific automation platform (Zapier/Make/n8n), cloud provider, or ETL tool is named despite being
  listed as tool categories — unusually vague compared to JD-001, which at least named HubSpot as the core
  system. This posting reads as earlier-stage / less mature in its AI tooling than JD-001.
- Sample size is 2. Per this document's own guidance, dashboard recalculation should wait for a larger,
  more diverse sample before drawing trend conclusions — Summary Dashboard intentionally left untouched.
```

---

### `JD-003` — `Not stated (posting reference 52037504280; marketing/media agency serving fitness & wellness clients)` — `Senior Digital & Automations Developer`

#### General Information

| Field | Value |
| --- | --- |
| Job ID | `JD-003` |
| Company | `Not stated` — posting refers to the employer only as "Client" and "company"; the agency framing is inferred from "various client CRMs," "client campaigns," "our client portal," and the preferred qualification "experience working with multiple client CRMs in an agency environment" |
| Job Title | Senior Digital & Automations Developer |
| Industry | Media (as labeled in the posting) — client base is fitness & wellness, inferred from the named client CRMs (Mindbody, Mariana Tek, ClubReady) and "familiarity with the wellness and fitness industry is a plus" |
| Employment Type | Full-time ("Remote (Full-time, exclusive)" — "exclusive" indicates no concurrent employment permitted) |
| Location | Remote — PST or MST overlap required |
| Salary | $1,200–$2,200 USD per month, "depending on experience" |
| Source | `Not stated` — posting text supplied directly, no board or URL given; the trailing number in the title (`52037504280`) appears to be a posting/requisition reference |
| Date Collected | 2026-08-08 |
| Link to Original Posting | `Not stated` |
| Archive Reference | Posting text captured verbatim in NAIGX research conversation, 2026-08-08 — recommend saving a standalone copy, since no live URL exists to archive against |

---

#### Business Analysis

**Business Problems**

| # | Business Problem | Evidence from Posting |
| --- | --- | --- |
| 1 | Agency's own CRM is disconnected from the CRMs its clients run on, so data does not move between the two without manual work | "Build and maintain API integrations to connect CRM platforms to third-party tools, ensuring seamless and efficient data flow" / "Connect and maintain integrations between HubSpot and various client CRMs, including Mindbody, Mariana Tek, ClubReady, and similar platforms" |
| 2 | Every client arrives on a different vertical-specific CRM, so integration work is rebuilt per client instead of reused | Three distinct fitness/wellness CRMs named plus "and similar platforms"; preferred qualification "experience working with multiple client CRMs in an agency environment" |
| 3 | Internal operations and client-facing processes are manual enough to justify a dedicated automation hire | "Create and manage AI automations to streamline internal operations and enhance client processes" |
| 4 | CRM data quality and segmentation are not reliable enough to support campaign execution | "including accurate data entry, effective segmentation, and workflow setup to support client campaigns and internal processes" |
| 5 | Paid media execution across Meta and Google lacks technical/automation support | "Support automation and technical workflows across Meta and Google Ads ecosystems" |
| 6 | System failures cause downtime that the current team cannot resolve quickly | "troubleshoot technical issues and implement effective solutions, ensuring minimal downtime and optimal system performance" |
| 7 | The client portal is under-featured and not yet proven at scale | "Support the development of new features for our client portal, focusing on functionality, scalability, and user engagement" |
| 8 | Technical capability is spread thin — one hire is expected to cover front-end, back-end, database, integration, QA, and DevOps | "possess a skillset more closely aligned with a full-stack developer. Front-End Development, Back-End Architecture, Database Management, System Integration, Quality Assurance & DevOps & Deployment" |

**Business Goals**

- Achieve "seamless and efficient data flow" between HubSpot and each client's CRM
- Streamline internal operations and improve client processes through AI automations
- Keep systems at "minimal downtime and optimal system performance"
- Maintain web assets (WordPress and Next.js) that are "user-friendly, optimized, and aligned with company's branding"
- Grow the client portal along three named axes: functionality, scalability, and user engagement
- Keep projects "aligned with company's goals and timely completion," supported by regular status updates
- No numeric targets or metrics are stated anywhere in the posting

**Current Pain Points**

| Pain Point | Stated or Inferred | Frequency / Volume (if given) |
| --- | --- | --- |
| Integrations between HubSpot and client CRMs break or need ongoing upkeep | Stated ("maintain integrations"; "Assist with API setups, integrations, and troubleshooting") | Not stated |
| Inaccurate CRM data entry and weak segmentation | Stated | Not stated |
| Technical issues currently cause downtime | Stated | Not stated |
| Project status is not visible without someone actively reporting it | Inferred (from "Provide regular updates on projects, ensuring alignment with company's goals") | "Regular" — cadence not defined |
| Client onboarding requires bespoke integration work per CRM | Inferred (from three named CRMs plus "and similar platforms") | Not stated |
| Team lacks a single person able to work across the full stack | Inferred (from the breadth of the "Role Overview" skill list vs. a 2-year minimum experience bar) | Not stated |
| Ads work is handled without technical/automation tooling | Inferred (from "Support automation and technical workflows across Meta and Google Ads ecosystems") | Not stated |

---

#### Technical Requirements

**Required Skills**

| Skill | Type (technical / process / domain) | Level (required / preferred) |
| --- | --- | --- |
| API integration build and maintenance | technical | required |
| Full-stack development (front-end, back-end architecture) | technical | required |
| Database management | technical | required |
| System integration | technical | required |
| Quality assurance | technical | required |
| DevOps & deployment | technical | required |
| Web design and development | technical | required |
| CRM workflow, segmentation, and reporting configuration (HubSpot) | technical | required |
| AI automation creation and management | technical | required |
| Automation building with best-practice/efficiency focus | technical | required |
| Technical troubleshooting, independently and with a team | process | required |
| Excellent written and verbal English communication | process | required |
| Proactive status reporting and remote task management | process | required |
| Remote work capability with US time-zone alignment | process | required |
| Minimum 2 years experience | domain | required |
| Basic scripting or automation experience | technical | preferred |
| Working with multiple client CRMs in an agency environment | domain | preferred |
| Wellness and fitness industry familiarity | domain | preferred |
| Prior experience supporting a CTO or technical lead | domain | preferred |

**Required Software**

| Software | Category | Level (required / preferred) |
| --- | --- | --- |
| HubSpot | CRM / Marketing Automation | required |
| Mindbody | Client CRM (fitness & wellness) — integration target | required |
| Mariana Tek | Client CRM (fitness & wellness) — integration target | required |
| ClubReady | Client CRM (fitness & wellness) — integration target | required |
| Meta Ads | Advertising platform | required |
| Google Ads | Advertising platform | required |
| WordPress | CMS / Web | required |
| Next.js | Web framework | required (posting writes it as "Net.js" in the proficiency line and "Next.js" in the responsibilities — see Personal Notes) |
| BaseDash | Database interface / admin tooling | required |

**Required AI Tools**

| AI Tool / Platform | Stated Use Case | Level (required / preferred) |
| --- | --- | --- |
| `Not stated` | "Create and manage AI automations to streamline internal operations and enhance client processes" — the capability is required but no AI tool, model, or vendor is named anywhere in the posting | required (capability), tool unspecified |

**Required Automation Platforms**

| Platform | Stated Use Case | Level (required / preferred) |
| --- | --- | --- |
| Zapier | "Proficiency in creating automations with tools like Zapier, with a focus on best practices and efficiency"; also listed again in the explicit proficiency line | required |
| Make | "Basic scripting or automation experience using tools such as Zapier, Make, or similar" | preferred |
| Unnamed "similar" automation tools | Same line as Make — category left open | preferred |

**APIs / Integrations Mentioned**

| API / System | Direction (read / write / both) | Stated Purpose |
| --- | --- | --- |
| HubSpot API | both | Hub of the integration model — connected outward to client CRMs and third-party tools |
| Mindbody API | both | "Connect and maintain integrations between HubSpot and various client CRMs" |
| Mariana Tek API | both | Same as above |
| ClubReady API | both | Same as above |
| Meta Ads | both | "Support automation and technical workflows across Meta and Google Ads ecosystems"; also named as an API integration target alongside HubSpot |
| Google Ads | both | "Support automation and technical workflows across Meta and Google Ads ecosystems" |
| Unnamed third-party tools | both | "connect CRM platforms to third-party tools, ensuring seamless and efficient data flow" |

**Reporting / Analytics Requirements**

| Requirement | Audience | Cadence | Delivery Format |
| --- | --- | --- | --- |
| HubSpot reporting (named as part of required CRM knowledge) | Not stated | Not stated | Not stated |
| Project status updates | Not stated (internal — implied leadership or a CTO/technical lead, given the preferred qualification) | "Regular" — not defined | Not stated |

---

#### Product Insights

**Automation Opportunities**

| # | Task | Automation Potential (full / partial / none) | Rationale |
| --- | --- | --- | --- |
| 1 | Contact/member data sync between HubSpot and client CRMs (Mindbody, Mariana Tek, ClubReady) | full | Deterministic record mapping once field mappings are agreed; this is the posting's most-repeated responsibility |
| 2 | CRM data entry | full | "Accurate data entry" is explicitly named as a problem; structured-input work with a defined target schema |
| 3 | Pushing CRM segments into Meta/Google Ads audiences | full | Both sides expose audience APIs and the posting frames ads work as "technical or automation" rather than creative |
| 4 | Integration health monitoring and failure alerting | full | Failures are detectable programmatically; the posting's goal of "minimal downtime" depends on detection speed |
| 5 | Per-client integration setup during onboarding | partial | Repeatable scaffolding is automatable, but each client's field/schema differences still need human confirmation |
| 6 | Segmentation and workflow setup in HubSpot | partial | Rules execute automatically once defined; the definition itself follows campaign strategy set by a human |
| 7 | Project status updates | partial | Status can be assembled from system activity; alignment commentary and priority calls remain human |
| 8 | Technical troubleshooting / root-cause resolution | partial | Detection and triage automate well; fixes vary case by case |
| 9 | Web asset updates (WordPress, Next.js) and client portal feature development | none | Design judgment and feature-level engineering are not rules-based work |

**AI Opportunities**

| # | Task | AI Role (generate / classify / extract / summarize / decide) | Rationale |
| --- | --- | --- | --- |
| 1 | Mapping fields between HubSpot and an unfamiliar client CRM schema | extract / decide | Each new client CRM presents a different schema for the same underlying concepts (member, booking, membership status); inferring the correspondence is exactly the repetitive judgment work implied by "and similar platforms" |
| 2 | Diagnosing failed API integrations | classify / decide | "Assist with API setups, integrations, and troubleshooting" — reading error responses and payloads to isolate a cause is diagnostic reasoning |
| 3 | Proposing HubSpot segments from CRM data patterns | classify | "Effective segmentation" is named as a problem; grouping records by behavioral signals is a classification task |
| 4 | Drafting regular project status updates | summarize | Converting integration/deployment activity into a written update matches the stated "proactive approach to providing updates" |
| 5 | Generating integration documentation for each client connector | generate / summarize | Not stated as a requirement, but implied by an agency maintaining many similar-but-different connectors — flagged as inference, not evidence |

**Potential NAIGX Feature**

State as a falsifiable hypothesis.

> If NAIGX provided a multi-CRM connector hub with AI-assisted field mapping — a HubSpot-centered integration layer that inspects an unfamiliar client CRM's schema, proposes a field mapping, and monitors the resulting sync — then an agency onboarding a new fitness/wellness client would be able to stand up a working two-way integration in hours instead of building a bespoke connector per client, reducing per-client integration build time and the downtime caused by silently broken syncs.

| Field | Value |
| --- | --- |
| Feature Name | Multi-CRM Connector Hub with AI-Assisted Field Mapping |
| Problem It Solves | The posting names three distinct client CRMs plus "and similar platforms" and asks one hire to connect and maintain all of them against HubSpot — direct evidence that per-client integration work is recurring, manual, and currently unstandardized |
| Dependencies / Prerequisites | HubSpot API access; API access to each client CRM (Mindbody, Mariana Tek, ClubReady — availability and partner-approval requirements unverified); a schema-inspection layer; sync monitoring and alerting |
| Related Existing Hypotheses | `JD-001` — HubSpot as the system of record and the first record to name automation debugging as a hire-worthy skill; this record repeats both signals. `JD-002` — generic "integrating multiple business systems and APIs" requirement, same underlying problem with no named tools |

**Portfolio Opportunity**

| Field | Value |
| --- | --- |
| Deliverable | A working HubSpot ↔ fitness-CRM connector demo: schema inspection, AI-proposed field mapping presented for human approval, two-way sync, and an integration health dashboard showing sync status and failures |
| Scope | One client CRM end-to-end (or a mock CRM with a realistic member/booking/membership schema if API access is gated), plus a second mock schema to prove the mapping step generalizes rather than being hardcoded |
| Estimated Effort | Days for the mapping and sync prototype against mock schemas; weeks if live API access to a real fitness CRM must be obtained and certified |
| What It Proves | NAIGX can absorb the "connect HubSpot to whatever CRM this client happens to use" problem that agencies currently solve by hiring — and that the mapping step, not the transport, is where the leverage is |
| Reusable Assets Produced | HubSpot API client wrapper (shared with `JD-001`'s deliverable), schema-inspection module, AI field-mapping prompt/eval pair, sync-health monitoring component |

**Scoring**

| Dimension | Score (1–5) | Justification |
| --- | --- | --- |
| Difficulty | 4 | Multiple third-party APIs, each with its own auth model and likely partner-approval gating; two-way sync introduces conflict-resolution and idempotency problems that a one-way demo can hide |
| Business Impact | 4 | Addresses the posting's single most-repeated responsibility, and the underlying "connect our CRM to their systems" problem now appears in all three records collected so far |
| Priority Score | 4 (High) | HubSpot is named in 2 of 3 records and cross-system integration in 3 of 3 — the first recurrence signal in this matrix. Per this document's rules, recurrence raises priority; the sample is still too small to treat as settled |

---

#### Personal Notes

```
- First record to answer the open question logged in JD-001's notes: whether a connector platform is typically
  named alongside HubSpot. Here it is — Zapier (required) and Make (preferred), explicitly. Worth revisiting
  JD-001's assumption that HubSpot-native workflows alone might satisfy "automation flows."
- HubSpot now appears in 2 of 3 records (JD-001, JD-003), and cross-system API integration in 3 of 3. This is
  the first recurrence in the matrix. Noting it, not acting on it — 3 records is far below the ~20 this
  document sets as the threshold where ranking stops being noise.
- Third record in a row where AI/automation capability is requested. JD-001 named no AI tool, JD-002 named
  Claude specifically, JD-003 requires "AI automations" but names no AI tool at all. The pattern to watch is
  whether "AI automation" is being used as a generic label for workflow automation rather than as LLM work.
- The posting has several transcription errors that were preserved rather than silently corrected: "Net.js"
  (Next.js, spelled correctly earlier in the same posting), "Client is looking for a candidates," and an
  uncapitalized "proficiency in Zapier,BaseDash..." line. Reads like a lightly-edited internal req rather
  than a polished public listing.
- Compensation asymmetry is stark. $1,200–$2,200/month for full-stack development, database management,
  DevOps, QA, multi-CRM API integration, HubSpot administration, two ad platforms, AI automation, WordPress,
  Next.js, and client portal feature work — against JD-002's $4,000–$5,000/month for a narrower AI automation
  scope. Both target offshore talent markets. Either the scope here is aspirational (per this document's own
  "postings are aspirational" limitation) or the role is significantly under-scoped against its pay band.
  Do not read the tool list as a confirmed current stack.
- "Remote (Full-time, exclusive)" — the exclusivity clause is unusual enough to note; it suggests prior
  experience with contractors splitting time across employers.
- BaseDash is the first niche tool named in this matrix that is not a household platform. Listed as a
  required proficiency with no stated use case, which is odd for a tool of that size — possibly reflects an
  existing internal setup the hire is expected to inherit rather than a considered requirement.
- Industry is labeled "Media" in the posting, but every named client CRM is fitness/wellness. Recorded the
  posting's own label with the inferred client vertical alongside it, rather than overriding.
- Company identity is withheld; the posting refers to the employer in the third person as "Client," which
  suggests it was published by a recruiter or staffing intermediary rather than the agency itself.
- Sample size is 3. Summary Dashboard intentionally left untouched, consistent with JD-001 and JD-002.
```

---

## Validation Checklist

A record is not counted in the Summary Dashboard until every box is checked.

**Capture**

- [ ] Original posting archived (text or screenshot), independent of the live URL
- [ ] Job ID assigned and unique
- [ ] All General Information fields completed or marked `Not stated`
- [ ] Date Collected recorded

**Analysis**

- [ ] At least one business problem stated in business terms, not task terms
- [ ] Each business problem traceable to specific evidence in the posting
- [ ] Business goals recorded, including any stated metrics
- [ ] Pain points marked as stated or inferred

**Technical**

- [ ] Skills captured and classified as technical, process, or domain
- [ ] Software, AI tools, and automation platforms recorded separately, not merged
- [ ] Tool names normalized against the naming convention, with original phrasing preserved
- [ ] APIs and integrations listed with direction and purpose
- [ ] Reporting requirements captured with audience and cadence
- [ ] Required vs. preferred distinction recorded for each item

**Product**

- [ ] Automation opportunities classified as full, partial, or none
- [ ] AI opportunities distinguished from general automation
- [ ] At least one feature hypothesis written in falsifiable form
- [ ] Hypothesis cross-referenced against existing records for recurrence
- [ ] Portfolio deliverable scoped to something completable
- [ ] Difficulty, Business Impact, and Priority scored with written justification

**Integration**

- [ ] Summary Dashboard counters updated
- [ ] Cross-references added to related records
- [ ] Record marked complete with reviewer and date

**Reviewer:** `—` · **Completed:** `YYYY-MM-DD`

---

## Success Metrics

This document earns its place only if it changes decisions. The following measures indicate whether it is doing so.

### Signal quality

| Metric | Definition | Why it matters |
| --- | --- | --- |
| Sample size | Total validated records | Below roughly 20 records, ranking is noise |
| Industry spread | Distinct industries as % of sample | A single-industry sample produces single-industry conclusions |
| Company independence | Distinct companies ÷ total records | Multiple postings from one company inflate demand signals |
| Recurrence rate | % of feature hypotheses appearing in 3+ independent records | Recurrence is the strongest validation available here |
| Data completeness | % of fields recorded vs. marked `Not stated` | Reveals whether gaps are in the market or in the research |

### Decision impact

| Metric | Definition |
| --- | --- |
| Roadmap traceability | % of planned NAIGX features traceable to at least one record |
| Integration coverage | % of top-ranked tools with shipped or planned connectors |
| Portfolio alignment | % of portfolio projects mapped to a business problem with impact ≥ 4 |
| Prioritization accuracy | Retrospective comparison of predicted vs. observed impact of shipped features |

### How prioritization actually works

1. **Frequency establishes demand.** A problem appearing across many independent companies is real. A problem appearing once may be a single company's idiosyncrasy.
2. **Impact scores separate the significant from the merely common.** High frequency with low impact indicates a nuisance, not an opportunity.
3. **Difficulty converts opportunity into sequencing.** High impact and low difficulty is where work should start; high impact and high difficulty is where it should be planned.
4. **Integration demand orders connector work.** Tools appear in the roadmap in order of independent mention count, not in order of technical interest.
5. **Portfolio follows priority.** Build the artifacts that demonstrate the highest-priority capabilities, so that evidence of demand and evidence of capability point at the same thing.

### Known limitations

Record these alongside conclusions so the dataset is not over-read:

- Job postings describe *hiring* demand, not total demand. Problems solved internally, or tolerated silently, never appear.
- Postings are aspirational. Listed tools are sometimes wish lists rather than current stack.
- Collection is biased by where postings are sourced. Two job boards produce two different markets.
- Salary and location data are frequently absent or misleading.
- Recurrence within one industry is weaker evidence than recurrence across several.

---

## Appendix: Conventions

**Job ID format:** `JD-###`, assigned sequentially and never reused.

**Tool naming:** Use the vendor's official product name. Record the posting's original phrasing in Personal Notes where it differs, so that variant terminology remains searchable.

**Required vs. preferred:** Follow the posting's own framing. Where ambiguous, mark as preferred and note the ambiguity.

**Stated vs. inferred:** Anything not explicitly written in the posting is inferred and must be labeled as such. This distinction is what keeps the dataset trustworthy as it grows.

**Dates:** ISO 8601 (`YYYY-MM-DD`) throughout.