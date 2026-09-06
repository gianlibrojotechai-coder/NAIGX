# Review packet RP-172cbc4e

> **This is not an M-08 pass, and cannot become one.**
> `docs/10` §3.5 requires all seven criteria to pass per analysis. Two criteria
> (C-3, C-6) have no material in this recording and are marked not assessable
> below, so no packet in this set can yield a rubric pass. §4.1 also requires
> ≥20 analyses per input type; this set has fewer. This is partial evidence for
> one input type, and must be reported as partial and single-reviewer (§4.3).

> **Corpus evidence, not current-runtime evidence.** These are provider responses
> captured on 2026-08-14 and replayed since. Per `docs/12` D-24 they are **not**
> evidence that the prompts now in force produce these responses. A verdict here
> describes the reasoning as it was captured, not as the system reasons today.

---

## 1 · The submitted input

```text
Automation Engineer - what we'd want you to build

We're a wholesale food distributor, 200 staff, and we're hiring someone to own
automation. Before we advertise the role I want to be clear in my own head about
what the first six months would actually involve, so I've written up the main
project.

The project: purchase order confirmations. Suppliers send us order confirmations by
email - some as PDF attachments, some as text in the body, a handful through a
portal we have to log into. Someone in purchasing opens each one, checks the
confirmed quantities and delivery dates against what we ordered in our ERP
(Microsoft Dynamics 365 Business Central), and flags discrepancies to a buyer.

About 700 confirmations a week. Roughly one in nine has a discrepancy - short
quantity, changed date, or a substituted product code. Those are the ones that
matter; the other eight are pure clerical checking.

What we'd want built: automatic capture and matching, so purchasing only sees the
exceptions. The eight-in-nine clean confirmations should reconcile themselves.

Skills we think this needs: Business Central integration, document extraction, and
whatever automation platform makes sense - we don't have a preference and we don't
have developers, so something maintainable by a non-programmer would be better.

Is this a sensible first project for someone, and is it the right shape? I'd rather
know now than after we've hired.
```

*1429 characters.*

---

## 2 · What the system produced

*4 stage(s) recorded: Classification → Intent → Context extraction → Architecture analysis.*

> **Reading the grounding.** Context elements are an ordered array. Where a
> later stage cites `grounded_in_context_indices`, those are **0-based**
> positions into that array — the first element is index 0. `C-1` is checked
> by following a cited index back to the element it names and to that
> element's own `provenance` and `source_quote`.

### Classification

```json
{
  "determined_type": "business_requirement",
  "confidence": 0.85,
  "candidate_types": [
    "job_description"
  ]
}
```

### Intent

```json
{
  "primary_objective": {
    "content": "Validate whether automating purchase order confirmation processing is an appropriate first project for a new automation engineer hire, including assessing project scope, complexity, and suitability",
    "provenance": "inferred",
    "inference_basis": "The input asks 'Is this a sensible first project for someone, and is it the right shape? I'd rather know now than after we've hired' — the user seeks validation of the project's appropriateness before hiring, not a design to implement immediately."
  },
  "secondary_objectives": [
    {
      "content": "Determine the appropriate automation approach and platform for purchase order confirmation processing given the constraint of no in-house developers",
      "provenance": "stated",
      "source_quote": "whatever automation platform makes sense - we don't have a preference and we don't have developers, so something maintainable by a non-programmer would be better"
    },
    {
      "content": "Understand what technical capabilities and integrations are required for the described automation",
      "provenance": "stated",
      "source_quote": "Skills we think this needs: Business Central integration, document extraction, and whatever automation platform makes sense"
    }
  ],
  "inferred_scope": "A single business process within the purchasing function: the receipt, validation, and exception handling of supplier purchase order confirmations across email, PDF, and portal channels, integrated with Microsoft Dynamics 365 Business Central ERP system, for a 200-person wholesale food distribution company with no development team."
}
```

### Context extraction

```json
{
  "elements": [
    {
      "id": "e1",
      "content": "700 purchase order confirmations processed per week",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "About 700 confirmations a week.",
      "specificity_score": 1
    },
    {
      "id": "e2",
      "content": "Approximately 11% of confirmations contain discrepancies requiring human review",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "Roughly one in nine has a discrepancy",
      "specificity_score": 0.9
    },
    {
      "id": "e3",
      "content": "Confirmations arrive via three channels: email with PDF attachments, email body text, and supplier portals requiring login",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "Suppliers send us order confirmations by email - some as PDF attachments, some as text in the body, a handful through a portal we have to log into.",
      "specificity_score": 0.8
    },
    {
      "id": "e4",
      "content": "Microsoft Dynamics 365 Business Central is the system of record for purchase orders",
      "category": "system",
      "provenance": "stated",
      "source_quote": "checks the confirmed quantities and delivery dates against what we ordered in our ERP (Microsoft Dynamics 365 Business Central)",
      "specificity_score": 1
    },
    {
      "id": "e5",
      "content": "No in-house software developers available to maintain the solution",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "we don't have developers, so something maintainable by a non-programmer would be better",
      "specificity_score": 1
    },
    {
      "id": "e6",
      "content": "Solution must extract and match three data points: quantities, delivery dates, and product codes",
      "category": "objective",
      "provenance": "stated",
      "source_quote": "checks the confirmed quantities and delivery dates against what we ordered",
      "specificity_score": 0.9
    },
    {
      "id": "e7",
      "content": "Discrepancy types include short quantities, changed dates, and substituted product codes",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "short quantity, changed date, or a substituted product code",
      "specificity_score": 0.9
    },
    {
      "id": "e8",
      "content": "Solution must route exceptions to buyers for decision",
      "category": "objective",
      "provenance": "stated",
      "source_quote": "flags discrepancies to a buyer",
      "specificity_score": 0.7
    },
    {
      "id": "e9",
      "content": "Matching confirmations should reconcile automatically without human intervention",
      "category": "objective",
      "provenance": "stated",
      "source_quote": "The eight-in-nine clean confirmations should reconcile themselves.",
      "specificity_score": 0.9
    },
    {
      "id": "e10",
      "content": "200 staff in the organization",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "200 staff",
      "specificity_score": 1
    },
    {
      "id": "e11",
      "content": "Wholesale food distribution industry",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "We're a wholesale food distributor",
      "specificity_score": 1
    },
    {
      "id": "e12",
      "content": "This is intended as a first project for a new automation engineer hire",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "Is this a sensible first project for someone",
      "specificity_score": 1
    },
    {
      "id": "e13",
      "content": "Project timeline expectation of six months",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "what the first six months would actually involve",
      "specificity_score": 0.8
    },
    {
      "id": "e14",
      "content": "Number of unique suppliers sending confirmations",
      "category": "scale",
      "provenance": "unknown",
      "resolution_hint": "How many different suppliers send confirmations, and does each use consistent formatting?",
      "specificity_score": 0
    },
    {
      "id": "e15",
      "content": "Variability in confirmation document formats across suppliers",
      "category": "environment",
      "provenance": "unknown",
      "resolution_hint": "Do suppliers use standardized formats, or does each supplier have unique layouts and terminology?",
      "specificity_score": 0
    },
    {
      "id": "e16",
      "content": "Budget allocated for automation platform licensing and implementation",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "What is the budget for platform licenses, implementation services, and ongoing operational costs?",
      "specificity_score": 0
    },
    {
      "id": "e17",
      "content": "Current time spent by purchasing staff on confirmation processing",
      "category": "scale",
      "provenance": "unknown",
      "resolution_hint": "How many hours per week does the purchasing team currently spend processing these 700 confirmations?",
      "specificity_score": 0
    },
    {
      "id": "e18",
      "content": "Business Central API access and integration capabilities available",
      "category": "dependency",
      "provenance": "unknown",
      "resolution_hint": "Does the Business Central instance have API access enabled, and what integration methods are supported?",
      "specificity_score": 0
    },
    {
      "id": "e19",
      "content": "Authentication and access requirements for supplier portals",
      "category": "environment",
      "provenance": "unknown",
      "resolution_hint": "How many portals require login, what authentication methods do they use, and how frequently do credentials change?",
      "specificity_score": 0
    },
    {
      "id": "e20",
      "content": "Acceptable error rate for automated matching",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "What percentage of false positives (incorrectly auto-reconciled) or false negatives (incorrectly flagged) is acceptable?",
      "specificity_score": 0
    },
    {
      "id": "e21",
      "content": "Regulatory or audit requirements for purchase order documentation",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "Are there compliance, audit trail, or record retention requirements that the automation must satisfy?",
      "specificity_score": 0
    },
    {
      "id": "e22",
      "content": "Technical skill level of the automation engineer to be hired",
      "category": "environment",
      "provenance": "unknown",
      "resolution_hint": "What technical background and automation platform experience will the new hire have?",
      "specificity_score": 0
    },
    {
      "id": "e23",
      "content": "Email system in use for receiving confirmations",
      "category": "system",
      "provenance": "unknown",
      "resolution_hint": "What email platform is used (Microsoft 365, Google Workspace, on-premise Exchange) and what integration options does it support?",
      "specificity_score": 0
    },
    {
      "id": "e24",
      "content": "Existing IT infrastructure and cloud service usage",
      "category": "environment",
      "provenance": "unknown",
      "resolution_hint": "Is the organization cloud-first, hybrid, or primarily on-premise, and are there existing cloud platform relationships?",
      "specificity_score": 0
    }
  ],
  "sufficiency": "thin"
}
```

### Architecture analysis

```json
{
  "summary": "The architecture processes purchase order confirmations from three input channels—email PDF attachments, email body text, and supplier portals—extracting quantities, delivery dates, and product codes, then matching them against purchase orders in Microsoft Dynamics 365 Business Central. Confirmations that match reconcile automatically; discrepancies route to buyers for decision. The design assumes a low-code platform operated by a single automation engineer with no developer support.",
  "data_flow_description": "Confirmations enter through three parallel ingestion components, one per channel. Each extracts the three required data points and normalizes them into a common structure. The normalized data passes to a matching component that retrieves the corresponding purchase order from Business Central and compares quantities, dates, and product codes. Matches proceed to an automatic reconciliation component that updates Business Central without human intervention. Discrepancies proceed to an exception routing component that assigns them to the appropriate buyer. All processing events and outcomes are logged for audit and monitoring.",
  "components": [
    {
      "name": "Email PDF Ingestion",
      "responsibility": "Monitor a designated email inbox or folder, retrieve PDF attachments from incoming messages, and extract quantities, delivery dates, and product codes from the PDF content",
      "inputs": "Email messages containing PDF attachments sent by suppliers",
      "outputs": "Normalized confirmation records containing extracted quantities, delivery dates, product codes, and supplier identifier",
      "failure_handling": "Unreadable PDFs or extraction failures are logged and routed to the exception queue with a parsing error flag, preserving the original attachment for manual review",
      "external_system": "Email system",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        2,
        5
      ]
    },
    {
      "name": "Email Body Text Ingestion",
      "responsibility": "Monitor the same email inbox for messages containing confirmation data in the body text rather than attachments, and extract the three required data points from unstructured or semi-structured text",
      "inputs": "Email messages with confirmation details in the message body",
      "outputs": "Normalized confirmation records containing extracted quantities, delivery dates, product codes, and supplier identifier",
      "failure_handling": "Messages that cannot be parsed or lack required fields are logged and routed to the exception queue with a parsing error flag, preserving the original message",
      "external_system": "Email system",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        2,
        5
      ]
    },
    {
      "name": "Supplier Portal Ingestion",
      "responsibility": "Log into supplier portals on a scheduled basis, retrieve new purchase order confirmations, and extract quantities, delivery dates, and product codes from portal pages or downloadable files",
      "inputs": "Credentials for supplier portals and scheduled trigger events",
      "outputs": "Normalized confirmation records containing extracted quantities, delivery dates, product codes, and supplier identifier",
      "failure_handling": "Authentication failures, portal unavailability, or extraction errors are logged with retry logic for transient failures; persistent failures generate alerts and halt processing for that supplier until resolved",
      "external_system": "Supplier portals",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        2,
        5
      ]
    },
    {
      "name": "Confirmation Matching",
      "responsibility": "Retrieve the corresponding purchase order from Business Central for each normalized confirmation record and compare quantities, delivery dates, and product codes to determine whether the confirmation matches or contains discrepancies",
      "inputs": "Normalized confirmation records from any ingestion component",
      "outputs": "Match result indicating either full match or specific discrepancy type (short quantity, changed date, substituted product code), along with the original confirmation data and retrieved purchase order data",
      "failure_handling": "Purchase orders not found in Business Central are flagged as orphaned confirmations and routed to exceptions; API failures trigger retry logic with exponential backoff, and persistent failures halt processing with alerts",
      "external_system": "Microsoft Dynamics 365 Business Central",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        3,
        5,
        6
      ]
    },
    {
      "name": "Automatic Reconciliation",
      "responsibility": "Update Business Central to mark the purchase order as confirmed when the confirmation matches without discrepancies, completing the reconciliation without human intervention",
      "inputs": "Match results indicating full match, along with purchase order identifier and confirmation data",
      "outputs": "Confirmation status update written to Business Central and success log entry",
      "failure_handling": "API write failures trigger retry logic; if retries are exhausted, the confirmation is routed to exceptions with a system error flag to prevent silent data loss",
      "external_system": "Microsoft Dynamics 365 Business Central",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        3,
        8
      ]
    },
    {
      "name": "Exception Routing",
      "responsibility": "Route confirmations with discrepancies or processing errors to the appropriate buyer for decision, providing the discrepancy details and access to both the confirmation and the original purchase order",
      "inputs": "Match results indicating discrepancies or processing errors, along with confirmation data, purchase order data, and discrepancy type",
      "outputs": "Task or notification sent to the assigned buyer containing discrepancy details and links to relevant records",
      "failure_handling": "Routing failures are logged and escalated to a fallback recipient or queue to ensure no exceptions are lost; the system retries delivery once before escalation",
      "grounded_in_context_indices": [
        1,
        6,
        7
      ]
    },
    {
      "name": "Audit and Monitoring Log",
      "responsibility": "Record all processing events, outcomes, and errors in a persistent log for operational monitoring, troubleshooting, and audit purposes",
      "inputs": "Event data from all other components including ingestion attempts, match results, reconciliation actions, exception routing, and errors",
      "outputs": "Structured log entries stored in a queryable format with timestamps, component identifiers, and outcome status",
      "failure_handling": "Logging failures are written to a local fallback log and generate immediate alerts, as loss of audit trail is a critical failure; the system does not halt processing but flags the gap",
      "grounded_in_context_indices": [
        0,
        1
      ]
    }
  ]
}
```

---

## 3 · What is absent, and why

Stated so an absence is not read as a silent omission by the reasoning:

- **No recommendation, artifact plan, or artifacts.** Stages 7, 8 and 9 did not
  exist when this was captured. This is a gap in the *evidence*, not in the
  analysis under review.
- **No confidence band.** Stage 11 is deferred (`docs/12` D-33), so none was ever
  assigned. `docs/10` §4.4 asks for the assigned band; the honest entry is
  *not available*, and §4.1 stratification across bands is impossible.

⚠️ **Two kinds of absence, and only the first is explained above.** A stage that
did not exist at capture time is a gap in the evidence. A stage that existed and
did not run is a decision the analysis made — and whether that decision was right
is exactly what `C-4` and `C-5` ask. The stage list in §2 is the record of what
ran; this document does not tell you which kind any absence is, because that
reading is the review.

---

## 4 · Review record — `docs/10` §4.4

Fill this in. A verdict without evidence is not recorded as a verdict (§3.3).

- **Analysis identifier:** RP-172cbc4e
- **Input type:** business_requirement
- **Assigned confidence band:** not available — Stage 11 deferred (`docs/12` D-33)
- **Rubric version:** rubric-v1  (§6)
- **Reviewer identifier:** _______________  (author / independent — §4.3)
- **Date (ISO 8601):** _______________

### Per criterion

#### C-1 · Grounded

*Failing looks like:* Claims not traceable to context

*Passes when:* Every substantive claim traces to a context element extracted from the input, or is explicitly labelled inferred or unknown (FR-013)

*Evidence to record:* At least one claim checked against its provenance label. On failure, the specific ungrounded claim

*Note:* Direct instrument for M-8.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

#### C-2 · Specific

*Failing looks like:* Generic advice applicable to any input

*Passes when:* Recommendations, risks, and components refer to this submission's particulars. A risk that does not name a component fails by construction (FR-032)

*Evidence to record:* On failure, the generic statement and why it would apply unchanged to a different input

*Note:* Assess against the architecture components present. The AC-013 do-not-automate clause has no material here — that is a Stage 7 output.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

#### C-3 · Proportional

*Failing looks like:* Depth mismatched to problem complexity

*Passes when:* The artifact set and depth match what the input supports. Minimal input yields a minimal artifact set (FR-017); over-production is a defect (PV §3.2)

*Evidence to record:* The artifact set produced, and whether the plan's inclusion and omission reasons justify it (ARTIFACT_PLAN_ENTRY)

**Verdict:** NOT ASSESSABLE. C-3's required evidence is the artifact set produced and whether the plan's inclusion and omission reasons justify it (ARTIFACT_PLAN_ENTRY). These recordings contain no artifact plan and no artifacts: they were captured 2026-08-14, before Stages 8 and 9 existed. The regression suite records the same gap as the deferred `artifact_set` assertion (deferred to Stages 8-9).

**Evidence:** see above.

#### C-4 · Complete

*Failing looks like:* Material consideration omitted silently

*Passes when:* Nothing material is missing without being named as omitted or unknown. Deliberate omission with a stated reason is a pass; silent omission is a fail

*Evidence to record:* On failure, the omitted consideration and why it is material

*Note:* Assessable at the context and architecture level only. Artifact-level omission has no material here.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

#### C-5 · Honest

*Failing looks like:* Uncertainty concealed; unknowns filled with plausible defaults

*Passes when:* Unknowns are surfaced with what would resolve them (FR-044); uncertain platform characteristics are disclosed rather than asserted (AI-042); confidence is not uniformly presented across non-uniform certainty (FR-045)

*Evidence to record:* On failure, the invented detail or the concealed uncertainty

*Note:* The FR-044 and AI-042 clauses are assessable. The FR-045 confidence clause is not — no confidence band exists (Stage 11 deferred, docs/12 D-33).

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

#### C-6 · Defensible

*Failing looks like:* The user cannot answer "why this, not the alternative?"

*Passes when:* Recommendations state their criteria and at least one rejected alternative with a reason (FR-034)

*Evidence to record:* The stated criteria and rejected alternative, or their absence

*Note:* Direct instrument for M-9.

**Verdict:** NOT ASSESSABLE. C-6's required evidence is stated criteria plus at least one rejected alternative with a reason (FR-034). That is a Stage 7 output. These recordings contain no Stage 7 recommendation: they were captured 2026-08-14, before Stage 7 existed. The regression suite records the same gap as the deferred `do_not_automate_conclusion` assertion (deferred to Stage 7).

**Evidence:** see above.

#### C-7 · Consistent

*Failing looks like:* Similar inputs yielding materially different treatment

*Passes when:* Treatment is materially consistent with comparable corpus cases and with repeated runs of the same input (FR-024)

*Evidence to record:* The comparison case used. Requires more than one analysis to assess (§3.4)

*Note:* Use another packet of the same input type as the comparison case, and name it. The repeated-run clause is not assessable: every recording was captured at lowVarianceSampling=false, so repeat-run stability was never measured.

*Comparison candidates (same input type):* RP-07a977a3, RP-14769a97, RP-27f9fb58, RP-2fa7c3e3, RP-448236a4, RP-4bb087ba, RP-5c2b0a40, RP-ac291956, RP-d41a9d08, RP-e755dbdf. Name the one you used.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

### Overall

Per §3.5 an analysis passes only when all seven criteria pass. C-3 and C-6 are
not assessable here, so this analysis cannot be recorded as a rubric pass.

- **Overall:** ` fail / not assessable `  (a pass is not reachable — see above)
- **Notes:**

> 

