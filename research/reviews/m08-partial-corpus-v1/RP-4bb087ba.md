# Review packet RP-4bb087ba

> **This packet cannot yield a rubric pass.**
> `docs/10` §3.5 requires all seven criteria to pass. C-3 and C-6 have no material in this recording and are marked not assessable below.
> Any review of this set is reported as partial and, unless a second human
> reviews the same packets, single-reviewer (§4.3).

> **Corpus evidence, not current-runtime evidence.** These are captured provider
> responses, replayed since. Per `docs/12` D-24 they are **not** evidence that the
> prompts now in force produce these responses. A verdict here describes the
> reasoning as it was captured, not as the system reasons today.

---

## 1 · The submitted input

```text
We want to automate customer refund processing for our online store.

When a customer requests a refund through our support inbox, we currently check
the order in Shopify, verify the return has been received by the warehouse, then
issue the refund through Stripe and email the customer.

Requirements:

1. Refunds must be fully automated end to end with no human involvement. Our
   support team is overloaded and we need this to run without anyone touching it.

2. Every refund must be reviewed and approved by a member of the finance team
   before the money leaves our account. This is a hard control requirement from
   our auditors and cannot be waived.

3. Refunds must be issued within 60 seconds of the customer's request so we can
   advertise instant refunds as a differentiator against our competitors.

4. Finance reviews refunds in a batch once per day at 4pm. That is when the
   finance manager is in the office and it is not going to change.

5. We process about 200 refunds a week, average value £45, occasionally up to
   £2,000 for bulk orders.

We are on Shopify and Stripe. Support uses Zendesk. Warehouse confirmations come
in as a daily CSV from our 3PL.
```

*1177 characters.*

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
  "confidence": 0.95,
  "candidate_types": []
}
```

### Intent

```json
{
  "primary_objective": {
    "content": "Automate the customer refund process from request through to payment and notification, integrating Shopify order verification, warehouse return confirmation, Stripe payment processing and customer email notification",
    "provenance": "stated",
    "source_quote": "We want to automate customer refund processing for our online store"
  },
  "secondary_objectives": [
    {
      "content": "Reduce workload on the support team by removing manual refund processing tasks",
      "provenance": "inferred",
      "inference_basis": "The statement 'Our support team is overloaded and we need this to run without anyone touching it' indicates workload reduction is a driving motivation beyond the automation itself"
    },
    {
      "content": "Enable marketing of instant refunds as a competitive advantage",
      "provenance": "stated",
      "source_quote": "Refunds must be issued within 60 seconds of the customer's request so we can advertise instant refunds as a differentiator against our competitors"
    }
  ],
  "inferred_scope": "The complete refund workflow from customer request receipt in Zendesk through order verification in Shopify, warehouse return confirmation via 3PL CSV, finance approval, Stripe payment processing, and customer notification email",
  "critical_conflict": {
    "description": "Requirements 1, 2, 3, and 4 are mutually incompatible and cannot all be satisfied",
    "contradictions": [
      {
        "requirement_1": {
          "content": "Fully automated end to end with no human involvement",
          "provenance": "stated",
          "source_quote": "Refunds must be fully automated end to end with no human involvement"
        },
        "requirement_2": {
          "content": "Every refund must be reviewed and approved by a member of the finance team before the money leaves our account",
          "provenance": "stated",
          "source_quote": "Every refund must be reviewed and approved by a member of the finance team before the money leaves our account"
        },
        "conflict": "A process requiring human review and approval cannot be fully automated with no human involvement"
      },
      {
        "requirement_3": {
          "content": "Refunds must be issued within 60 seconds of the customer's request",
          "provenance": "stated",
          "source_quote": "Refunds must be issued within 60 seconds of the customer's request"
        },
        "requirement_4": {
          "content": "Finance reviews refunds in a batch once per day at 4pm",
          "provenance": "stated",
          "source_quote": "Finance reviews refunds in a batch once per day at 4pm"
        },
        "conflict": "A refund requested at any time other than immediately before 4pm cannot receive finance approval and be issued within 60 seconds when approval only occurs once daily at 4pm"
      }
    ],
    "resolution_required": "The user must clarify which requirements take precedence, or identify which can be relaxed, before any viable automation design can be produced"
  }
}
```

### Context extraction

```json
{
  "elements": [
    {
      "id": "e1",
      "content": "Refunds must be fully automated end to end with no human involvement",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "Refunds must be fully automated end to end with no human involvement.",
      "specificity_score": 0.9,
      "conflicts_with_id": "e2"
    },
    {
      "id": "e2",
      "content": "Every refund must be reviewed and approved by a member of the finance team before the money leaves the account",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "Every refund must be reviewed and approved by a member of the finance team before the money leaves our account. This is a hard control requirement from our auditors and cannot be waived.",
      "specificity_score": 1,
      "conflicts_with_id": "e1"
    },
    {
      "id": "e3",
      "content": "Refunds must be issued within 60 seconds of the customer's request",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "Refunds must be issued within 60 seconds of the customer's request",
      "specificity_score": 1,
      "conflicts_with_id": "e4"
    },
    {
      "id": "e4",
      "content": "Finance reviews refunds in a batch once per day at 4pm",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "Finance reviews refunds in a batch once per day at 4pm. That is when the finance manager is in the office and it is not going to change.",
      "specificity_score": 1,
      "conflicts_with_id": "e3"
    },
    {
      "id": "e5",
      "content": "Approximately 200 refunds processed per week",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "We process about 200 refunds a week",
      "specificity_score": 0.9
    },
    {
      "id": "e6",
      "content": "Average refund value is £45",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "average value £45",
      "specificity_score": 1
    },
    {
      "id": "e7",
      "content": "Maximum refund value occasionally reaches £2,000 for bulk orders",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "occasionally up to £2,000 for bulk orders",
      "specificity_score": 0.8
    },
    {
      "id": "e8",
      "content": "Shopify is the order management system",
      "category": "system",
      "provenance": "stated",
      "source_quote": "We are on Shopify",
      "specificity_score": 1
    },
    {
      "id": "e9",
      "content": "Stripe is the payment processor",
      "category": "system",
      "provenance": "stated",
      "source_quote": "We are on Shopify and Stripe.",
      "specificity_score": 1
    },
    {
      "id": "e10",
      "content": "Zendesk is the support ticket system where refund requests arrive",
      "category": "system",
      "provenance": "stated",
      "source_quote": "Support uses Zendesk.",
      "specificity_score": 1
    },
    {
      "id": "e11",
      "content": "Warehouse return confirmations arrive as a daily CSV file from the 3PL provider",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "Warehouse confirmations come in as a daily CSV from our 3PL.",
      "specificity_score": 0.9
    },
    {
      "id": "e12",
      "content": "Current manual process involves checking order in Shopify, verifying warehouse receipt, issuing Stripe refund, and emailing customer",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "we currently check the order in Shopify, verify the return has been received by the warehouse, then issue the refund through Stripe and email the customer.",
      "specificity_score": 0.9
    },
    {
      "id": "e13",
      "content": "Support team is overloaded and cannot handle current refund processing workload",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "Our support team is overloaded and we need this to run without anyone touching it.",
      "specificity_score": 0.7
    },
    {
      "id": "e14",
      "content": "The auditor-mandated finance approval is a compliance control that cannot be removed",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "This is a hard control requirement from our auditors and cannot be waived.",
      "specificity_score": 1
    },
    {
      "id": "e15",
      "content": "Timing of 3PL CSV delivery is unknown",
      "category": "dependency",
      "provenance": "unknown",
      "resolution_hint": "What time of day does the 3PL CSV arrive, and is it guaranteed to arrive before the 4pm finance review window?",
      "specificity_score": 0
    },
    {
      "id": "e16",
      "content": "Format and structure of the 3PL CSV file is unknown",
      "category": "dependency",
      "provenance": "unknown",
      "resolution_hint": "What fields are present in the 3PL CSV and how are returned items identified and matched to orders?",
      "specificity_score": 0
    },
    {
      "id": "e17",
      "content": "Method for delivering CSV to automation system is unknown",
      "category": "dependency",
      "provenance": "unknown",
      "resolution_hint": "How is the daily CSV currently delivered (email attachment, SFTP, API, manual download) and can an automation system access it?",
      "specificity_score": 0
    },
    {
      "id": "e18",
      "content": "Budget available for automation implementation is unknown",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "What is the budget available for implementing this automation, including platform costs, development, and ongoing operation?",
      "specificity_score": 0
    },
    {
      "id": "e19",
      "content": "Technical capability of team to build or maintain automation is unknown",
      "category": "environment",
      "provenance": "unknown",
      "resolution_hint": "Does the team have developers who can build custom integrations, or is a no-code/low-code platform required?",
      "specificity_score": 0
    },
    {
      "id": "e20",
      "content": "Interface for finance team approval is unspecified",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "How should the finance team review and approve refunds - through email, a web interface, within an existing system, or another method?",
      "specificity_score": 0
    },
    {
      "id": "e21",
      "content": "Customer refund requests arrive through the support inbox in Zendesk",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "When a customer requests a refund through our support inbox",
      "specificity_score": 0.9
    },
    {
      "id": "e22",
      "content": "Instant refund capability is intended as a competitive differentiator",
      "category": "objective",
      "provenance": "stated",
      "source_quote": "so we can advertise instant refunds as a differentiator against our competitors.",
      "specificity_score": 0.8,
      "conflicts_with_id": "e4"
    }
  ],
  "sufficiency": "thin"
}
```

### Architecture analysis

```json
{
  "summary": "The design addresses a refund workflow that cannot be reconciled as stated. The input demands both full automation with no human involvement and mandatory finance approval before payment, and both 60-second processing and once-daily batch review. These are direct contradictions, not design choices. The architecture presented here assumes the compliance constraint prevails — finance approval is non-negotiable — and structures the system around a daily batch cycle at 4pm. This makes the 60-second promise and the no-human-involvement claim unachievable. The system collects refund requests from Zendesk, verifies orders in Shopify, matches returns from a daily 3PL CSV, queues approved cases for finance review, processes Stripe refunds after approval, and notifies customers. Three unknowns materially limit the design: the CSV delivery method and timing are unspecified, the finance approval interface is undefined, and team capability is unstated.",
  "data_flow_description": "A refund request arrives in Zendesk and triggers the workflow. The system retrieves order details from Shopify to verify the purchase. It then waits for the daily 3PL CSV to confirm the item has been returned to the warehouse. Once the return is confirmed, the refund case is queued for the 4pm finance review. A finance team member reviews the queue and approves or rejects each case. Approved refunds are sent to Stripe for processing. After Stripe confirms the refund, the system sends a notification email to the customer and closes the Zendesk ticket. Rejected cases are returned to the support team with the rejection reason.",
  "components": [
    {
      "name": "Zendesk Request Listener",
      "responsibility": "Monitor Zendesk for incoming refund requests and extract customer and order identifiers",
      "inputs": "Zendesk ticket creation events or API polling results",
      "outputs": "Refund case record containing customer email, order number, and ticket ID",
      "failure_handling": "If Zendesk is unreachable, log the failure and retry with exponential backoff. If a ticket cannot be parsed, flag it for manual review and do not create a case.",
      "external_system": "Zendesk",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        9,
        20
      ]
    },
    {
      "name": "Shopify Order Verifier",
      "responsibility": "Retrieve order details from Shopify and confirm the order exists, the payment method, and the refund eligibility",
      "inputs": "Order number from the refund case",
      "outputs": "Order verification result including payment method, original amount, and eligibility status",
      "failure_handling": "If Shopify is unreachable, mark the case as pending verification and retry. If the order is not found, flag the case for manual investigation and do not proceed.",
      "external_system": "Shopify",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        7,
        11
      ]
    },
    {
      "name": "3PL Return Matcher",
      "responsibility": "Ingest the daily CSV from the 3PL provider and match returned items to pending refund cases by order number or SKU",
      "inputs": "Daily CSV file from 3PL provider",
      "outputs": "List of refund cases with confirmed warehouse returns",
      "failure_handling": "If the CSV does not arrive by a defined cutoff, alert operations and do not proceed with that day's batch. If a CSV row cannot be parsed, log the error and continue processing other rows.",
      "external_system": "3PL provider",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        10,
        11,
        14,
        15,
        16
      ]
    },
    {
      "name": "Finance Approval Queue",
      "responsibility": "Present verified and return-confirmed refund cases to the finance team for review and approval at 4pm daily",
      "inputs": "Refund cases that have passed order verification and return confirmation",
      "outputs": "Approved refund cases and rejected refund cases with rejection reasons",
      "failure_handling": "If no finance team member reviews the queue by a defined deadline, escalate to management. If the approval interface is unavailable, delay the batch and notify finance.",
      "external_system": "Finance approval interface (unspecified)",
      "integration_direction": "bidirectional",
      "grounded_in_context_indices": [
        1,
        3,
        13,
        19
      ]
    },
    {
      "name": "Stripe Refund Processor",
      "responsibility": "Issue refunds through Stripe for finance-approved cases",
      "inputs": "Approved refund cases with payment method and amount",
      "outputs": "Stripe refund confirmation or failure response",
      "failure_handling": "If Stripe rejects the refund, log the error with the Stripe response code and flag the case for manual resolution. If Stripe is unreachable, retry with exponential backoff and alert finance if retries are exhausted.",
      "external_system": "Stripe",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        8,
        11
      ]
    },
    {
      "name": "Customer Notifier",
      "responsibility": "Send refund confirmation emails to customers after Stripe processes the refund",
      "inputs": "Refund case with customer email and refund amount",
      "outputs": "Email sent confirmation",
      "failure_handling": "If the email service is unavailable, queue the notification for retry. If the customer email address is invalid, log the failure and update the Zendesk ticket with the issue.",
      "external_system": "Email service provider (unspecified)",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        11
      ]
    },
    {
      "name": "Zendesk Ticket Closer",
      "responsibility": "Update and close Zendesk tickets after refunds are processed or mark them for manual follow-up if rejected",
      "inputs": "Refund case outcome (approved and processed, or rejected)",
      "outputs": "Zendesk ticket status update",
      "failure_handling": "If Zendesk is unreachable, queue the update for retry. If the ticket cannot be found, log the discrepancy and continue.",
      "external_system": "Zendesk",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        9,
        11
      ]
    },
    {
      "name": "Case State Manager",
      "responsibility": "Maintain the state of each refund case as it moves through verification, return confirmation, approval, payment, and notification stages",
      "inputs": "State transitions from other components",
      "outputs": "Current state and history for each refund case",
      "failure_handling": "If the state store becomes unavailable, halt processing and alert operations. Do not proceed without a reliable record of case state.",
      "grounded_in_context_indices": [
        0,
        1,
        2,
        3,
        11
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

- **Analysis identifier:** RP-4bb087ba
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

**Verdict:** NOT ASSESSABLE. C-3's required evidence is the artifact set produced (ARTIFACT_PLAN_ENTRY). This recording contains no artifact-generating stage — either it predates Stages 8-9, or its path routes to architecture only and never reaches them.

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

**Verdict:** NOT ASSESSABLE. C-6's required evidence is stated criteria plus at least one rejected alternative with a reason (FR-034), which is a Stage 7 output. This recording contains no Stage 7 recommendation — either it predates the stage, or its path produces no recommendation at all.

**Evidence:** see above.

#### C-7 · Consistent

*Failing looks like:* Similar inputs yielding materially different treatment

*Passes when:* Treatment is materially consistent with comparable corpus cases and with repeated runs of the same input (FR-024)

*Evidence to record:* The comparison case used. Requires more than one analysis to assess (§3.4)

*Note:* Use another packet of the same input type as the comparison case, and name it. The repeated-run clause is not assessable: every recording was captured at lowVarianceSampling=false, so repeat-run stability was never measured.

*Comparison candidates (same input type):* RP-07a977a3, RP-14769a97, RP-172cbc4e, RP-27f9fb58, RP-2fa7c3e3, RP-448236a4, RP-5c2b0a40, RP-ac291956, RP-d41a9d08, RP-e755dbdf. Name the one you used.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

### Overall

Per §3.5 an analysis passes only when all seven criteria pass. C-3 and C-6 are not assessable here, so this analysis cannot be recorded as a rubric pass.

- **Overall:** ` fail / not assessable `  (a pass is not reachable — see above)
- **Notes:**

> 

