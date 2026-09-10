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

*10 stage(s) recorded: Classification → Intent → Context extraction → Architecture analysis → Complexity assessment → Edge cases and practices → Integration requirements → Implementation roadmap → Risk register → Platform recommendation.*

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
  "candidate_types": [
    "business_requirement"
  ],
  "dominant_type": "business_requirement"
}
```

### Intent

```json
{
  "primary_objective": {
    "content": "Automate customer refund processing for the online store, from customer request through to issuing the refund and notifying the customer",
    "provenance": "stated"
  },
  "secondary_objectives": [
    {
      "content": "Eliminate human involvement in the refund process to relieve an overloaded support team",
      "provenance": "stated"
    },
    {
      "content": "Ensure every refund is reviewed and approved by finance before money leaves the account, per auditor requirement",
      "provenance": "stated"
    },
    {
      "content": "Issue refunds within 60 seconds of request to advertise instant refunds as a competitive differentiator",
      "provenance": "stated"
    },
    {
      "content": "Accommodate finance's fixed once-daily 4pm batch review process",
      "provenance": "stated"
    },
    {
      "content": "Integrate with existing systems: Shopify, Stripe, Zendesk, and the 3PL's daily CSV warehouse confirmation feed",
      "provenance": "stated"
    }
  ],
  "inferred_scope": "The customer refund workflow for an online store, from receipt of a refund request in the support inbox through order verification in Shopify, warehouse return confirmation from the 3PL, refund issuance via Stripe, and customer notification — including the finance approval control point.",
  "requested_outcome": "design",
  "decline_quote": null
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
      "specificity_score": 0.9,
      "source_quote": "Refunds must be fully automated end to end with no human involvement.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": "e2"
    },
    {
      "id": "e2",
      "content": "Every refund must be reviewed and approved by finance before money leaves the account, a hard auditor control",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "Every refund must be reviewed and approved by a member of the finance team\n   before the money leaves our account.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": "e1"
    },
    {
      "id": "e3",
      "content": "Refunds must be issued within 60 seconds of the customer's request",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 1,
      "source_quote": "Refunds must be issued within 60 seconds of the customer's request",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": "e4"
    },
    {
      "id": "e4",
      "content": "Finance reviews refunds in a batch once per day at 4pm, fixed and unchangeable",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 1,
      "source_quote": "Finance reviews refunds in a batch once per day at 4pm.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": "e3"
    },
    {
      "id": "e5",
      "content": "Volume of about 200 refunds a week, average value £45, occasionally up to £2,000",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 1,
      "source_quote": "We process about 200 refunds a week, average value £45, occasionally up to\n   £2,000 for bulk orders.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e6",
      "content": "Systems involved: Shopify, Stripe, Zendesk, and a 3PL warehouse system",
      "category": "system",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "We are on Shopify and Stripe. Support uses Zendesk.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e7",
      "content": "Warehouse return confirmations arrive as a daily CSV from the 3PL",
      "category": "dependency",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "Warehouse confirmations come\nin as a daily CSV from our 3PL.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e8",
      "content": "Current manual process: check order in Shopify, verify return received by warehouse, issue refund via Stripe, email customer",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.8,
      "source_quote": "we currently check\nthe order in Shopify, verify the return has been received by the warehouse, then\nissue the refund through Stripe and email the customer.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e9",
      "content": "Support requests arrive through a support inbox / Zendesk",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.6,
      "source_quote": "When a customer requests a refund through our support inbox",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e10",
      "content": "Whether the CSV-based warehouse confirmation (daily) can support a 60-second refund SLA is unresolved, since confirmation is itself batch-delayed",
      "category": "dependency",
      "provenance": "inferred",
      "specificity_score": 0.6,
      "source_quote": null,
      "inference_basis": "The warehouse confirmation feed is stated to arrive only once per day as a CSV, which structurally limits how fast the 'return received' check needed before refund issuance can occur.",
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e11",
      "content": "Who will operate, monitor, and maintain the automation, and what technical capability exists in-house",
      "category": "environment",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Does the team have in-house developer capability, or does this need to be built and maintained by non-technical staff?",
      "conflicts_with_id": null
    },
    {
      "id": "e12",
      "content": "Budget available for building or licensing an automation platform",
      "category": "constraint",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What budget, if any, is allocated for tooling, platform licensing, or development of this automation?",
      "conflicts_with_id": null
    },
    {
      "id": "e13",
      "content": "What should happen when finance rejects a refund that was already promised/issued instantly, or how a rejected-after-payment scenario is handled",
      "category": "constraint",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "If refunds are issued before finance's daily review, what is the process for reversing or flagging a refund that finance later rejects?",
      "conflicts_with_id": null
    }
  ],
  "sufficiency": "thin"
}
```

### Architecture analysis

```json
{
  "summary": "The design automates the customer refund workflow from request intake through order verification, warehouse-return matching, and Stripe execution, but routes every refund through the finance approval control before money moves, because that control is stated as a hard, unchangeable auditor requirement. It cannot also deliver the stated 60-second instant-refund promise or a fully human-free process, since those two objectives directly conflict with the finance batch requirement and with the daily-CSV nature of warehouse confirmation. Both conflicts are structural, not solvable by picking a side, and are surfaced here rather than resolved silently.",
  "data_flow_description": "A refund request enters via the support inbox/Zendesk and becomes a structured record. That record is checked against Shopify to verify the order and its eligibility, and matched against the 3PL's daily CSV to confirm the warehouse actually received the return — a check that itself cannot run faster than once a day given the CSV cadence. Verified, return-confirmed candidates accumulate in a finance approval queue that is only processed once, at the fixed 4pm daily batch. Only after that human approval step does a refund get executed through Stripe. The outcome — paid, rejected, or still pending confirmation — is then pushed back out to the customer via Zendesk/email. Nothing in this flow can complete inside 60 seconds of the original request, because both the warehouse confirmation and the finance approval are batch-bound by design and by stated auditor requirement.",
  "components": [
    {
      "name": "Refund Request Intake",
      "responsibility": "Capture a customer refund request from the support channel and convert it into a structured, trackable record.",
      "inputs": "Customer refund request arriving through the support inbox/Zendesk.",
      "outputs": "A structured refund request record with a unique identifier for downstream tracking.",
      "failure_handling": "If intake fails to create a record, the request remains only in the inbox and is not tracked through the automated pipeline, so it must be visible for manual re-entry.",
      "external_system": "Zendesk",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        8,
        7
      ]
    },
    {
      "name": "Order Verification",
      "responsibility": "Check the refund request against Shopify to confirm the order exists and is eligible for refund.",
      "inputs": "Refund request record; order data from Shopify.",
      "outputs": "Verified order details, or a rejection if the order is not found or ineligible.",
      "failure_handling": "If the Shopify lookup fails or times out, the request is held in an unverified state rather than passed forward, pending retry or manual check.",
      "external_system": "Shopify",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        7,
        5
      ]
    },
    {
      "name": "Warehouse Return Matcher",
      "responsibility": "Match verified refund requests against the 3PL's daily CSV feed to confirm the physical return has actually been received.",
      "inputs": "Verified order details; the 3PL's daily CSV warehouse confirmation feed.",
      "outputs": "A return-confirmed status, or a pending status for requests not yet matched to a confirmed return.",
      "failure_handling": "Because the CSV arrives only once a day, a request with no match simply stays pending until the next day's file; there is no faster confirmation path, and this component cannot be made to answer within the 60-second target.",
      "external_system": "3PL warehouse system",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        6,
        9
      ]
    },
    {
      "name": "Finance Approval Queue",
      "responsibility": "Stage every verified, return-confirmed refund candidate for a single, fixed daily human review by finance before any money moves.",
      "inputs": "Verified and return-confirmed refund candidates.",
      "outputs": "A list of finance-approved refunds and a list of finance-rejected refunds, produced once per day at the fixed 4pm batch.",
      "failure_handling": "If the daily batch review does not run or is incomplete, all queued candidates carry over to the next day's batch rather than being auto-approved or auto-issued, since finance sign-off is a stated hard control.",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        1,
        3
      ]
    },
    {
      "name": "Refund Execution",
      "responsibility": "Issue the actual refund payment through Stripe for candidates that finance has approved.",
      "inputs": "The finance-approved refund list from the approval batch.",
      "outputs": "A completed Stripe refund transaction per approved request.",
      "failure_handling": "If a Stripe refund call fails, the item is flagged as unpaid-despite-approval and held for retry rather than silently dropped, since finance already signed off on it.",
      "external_system": "Stripe",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        7,
        5,
        1
      ]
    },
    {
      "name": "Customer Notification",
      "responsibility": "Inform the customer of the outcome of their refund request at each meaningful state change.",
      "inputs": "Refund outcome: pending verification, pending finance approval, approved-and-paid, or rejected.",
      "outputs": "A notification to the customer via email or Zendesk update reflecting current status.",
      "failure_handling": "If a notification fails to send, the refund's internal state is unaffected but the customer is left uninformed, requiring the failure to be visible for manual follow-up.",
      "external_system": "Zendesk",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        7,
        8
      ]
    }
  ],
  "unknown_disposition": [
    {
      "context_index": 10,
      "disposition": "excluded",
      "statement": "The design does not assign an operator, monitor, or maintainer for the pipeline; who runs and maintains it, and what technical capability exists in-house, is left out until answered."
    },
    {
      "context_index": 11,
      "disposition": "excluded",
      "statement": "No budget figure is available, so the design does not assume any particular platform cost tier or build-vs-license posture; this is left for the reader to establish."
    },
    {
      "context_index": 12,
      "disposition": "excluded",
      "statement": "Because this design defers Stripe payment until after finance approval, the specific scenario of reversing an already-issued refund that finance later rejects should not arise under this design, but the design does not address related edge cases (e.g. a Stripe failure after approval, or a future change to issue-before-approval) and leaves the reversal/failure process for those cases unspecified."
    }
  ],
  "trade_offs": [],
  "rejected_approaches": [],
  "automation_verdict": {
    "warranted": true,
    "statement": "The design automates the repeatable parts of refund handling — request intake, order verification, warehouse-return matching, approved-refund execution, and customer notification — because these are high-volume, rule-based steps (about 200 refunds a week) well suited to automation; however, it cannot also deliver the stated 60-second refund promise or a fully human-free process, since the auditor-mandated finance approval batch and the daily-CSV warehouse confirmation are both stated as fixed and structurally preclude sub-minute, human-free completion."
  }
}
```

### Complexity assessment

```json
{
  "factors": [
    {
      "factor": "workflow",
      "score": 3,
      "justification": "The pipeline has multiple sequential stages (intake, order verification, warehouse matching, finance batch approval, execution, notification) with branching on verification failure, pending-match status, and finance approve/reject outcomes, but no loops or parallel paths beyond simple carry-over-to-next-day retries."
    },
    {
      "factor": "integration",
      "score": 4,
      "justification": "Four heterogeneous systems are involved (Shopify, Stripe, Zendesk, 3PL), one of which exposes data only via a daily CSV file rather than a real-time API, which is a poor/unstable interface for this use case and pushes the score above the 'several conventional interfaces' anchor."
    },
    {
      "factor": "data_logic",
      "score": 3,
      "justification": "The design performs matching/reconciliation between refund requests, Shopify order data, and CSV-based warehouse confirmations, plus state transitions across pending/approved/rejected — a moderate, recognisable mapping and rule set rather than trivial pass-through or extensive multi-source reconciliation."
    },
    {
      "factor": "failure_risk",
      "score": 4,
      "justification": "The architecture surfaces two unresolved structural conflicts (60-second SLA vs daily finance batch vs daily CSV cadence) plus stated failure paths for Stripe execution failure post-approval, unmatched CSV records, and unnotified customers; consequences include real money movement (up to £2,000) and an auditor-mandated control, demanding careful ordering and correctness rather than trivial retry handling."
    },
    {
      "factor": "operational",
      "score": 3,
      "justification": "The daily 4pm finance batch and daily CSV ingestion require routine recurring attention and reconciliation of carried-over pending items, though the design implies no continuous monitoring beyond these fixed daily touchpoints; who operates it is unknown per the unresolved context item."
    }
  ]
}
```

### Edge cases and practices

```json
{
  "edge_cases": [
    {
      "component": "Warehouse Return Matcher",
      "scenario": "A customer's refund request is verified in Shopify but the 3PL's daily CSV never includes a matching return confirmation (e.g. item lost in transit or logged under a mismatched order number)",
      "consequence": "The request stays pending indefinitely with no path to resolution, and the customer never receives a refund despite having returned the item",
      "handling": "Not addressed by the stated failure_handling, which only covers 'not yet matched' as a same-day timing issue; the design needs an escalation path for requests that remain unmatched after multiple daily CSV cycles"
    },
    {
      "component": "Finance Approval Queue",
      "scenario": "A refund candidate for the occasional high-value case (up to £2,000, per the £45 average/£2,000 occasional stated volume) reaches the daily batch alongside routine £45 refunds",
      "consequence": "High-value refunds are approved with the same blanket process as routine ones, with no differentiated scrutiny despite the auditor control being the reason for review",
      "handling": "Not addressed in the component design; finance queue currently treats all candidates identically with no value-based tiering"
    },
    {
      "component": "Refund Execution",
      "scenario": "Finance rejects a refund candidate at the 4pm batch",
      "consequence": "The customer's refund request is denied but the design's Customer Notification only lists 'approved-and-paid, or rejected' as outcomes without describing what information or recourse the customer receives on rejection",
      "handling": "Customer Notification's inputs list 'rejected' as a state but failure_handling does not specify content or recourse process for a rejected notification, leaving the rejection communication unspecified"
    },
    {
      "component": "Refund Request Intake",
      "scenario": "The same customer, or the same order, generates two refund requests in Zendesk (e.g. customer messages twice, or contacts via two channels) before the first is resolved",
      "consequence": "Duplicate refund request records could both proceed through verification and matching, risking a double refund through Stripe for a single return",
      "handling": "Not addressed; Intake's failure_handling only covers records failing to be created, not duplicate record creation for the same order"
    },
    {
      "component": "3PL warehouse system",
      "scenario": "The daily CSV itself is late, malformed, or missing entirely on a given day",
      "consequence": "The Warehouse Return Matcher has no data to match against, so all pending candidates for that day silently stall a full extra day, compounding the delay against the 60-second SLA that is already unmet",
      "handling": "Not addressed by the current design; no fallback or alert for an absent/late/malformed CSV file is described"
    },
    {
      "component": "Finance Approval Queue",
      "scenario": "The stated conflict between the 60-second refund SLA (index 2) and the fixed 4pm daily batch (index 3) means every refund request arriving after 4pm on a given day must wait until the next day's batch",
      "consequence": "Customers are told or expect a near-instant refund but experience a delay of up to nearly 24 hours, breaching the stated SLA on every single request, not just an edge case but the default outcome",
      "handling": "The architecture surfaces this as an unresolved structural conflict rather than resolving it; the design does not silently pick a side, per its own summary, but no interim customer-facing communication of the real timeline is defined"
    },
    {
      "component": "Refund Execution",
      "scenario": "Finance approves a refund at the 4pm batch, but the Stripe refund call subsequently fails for that item",
      "consequence": "The customer is told (or the system assumes) they were refunded, but no money has moved, creating a discrepancy against the auditor control that required approval before money leaves the account",
      "handling": "Covered by stated failure_handling: item is flagged as unpaid-despite-approval and held for retry rather than dropped"
    }
  ],
  "practices": [
    {
      "applies_to": "Finance Approval Queue",
      "practice": "Tag each candidate in the daily batch with its refund value (e.g. flag anything approaching the stated £2,000 occasional high end) so finance can apply differentiated scrutiny within the single daily review",
      "rationale": "The stated volume shows most refunds average £45 but occasionally reach £2,000; treating all candidates identically in one batch undermines the purpose of the auditor control for the outlier cases"
    },
    {
      "applies_to": "Refund Request Intake",
      "practice": "Deduplicate incoming requests against an existing open request for the same Shopify order before creating a new record",
      "rationale": "Requests enter through Zendesk/support inbox from customers who may re-contact support before their original request resolves, and the design has no stated mechanism to prevent two records tracking one refund"
    },
    {
      "applies_to": "Warehouse Return Matcher",
      "practice": "Escalate to a manual check after a fixed number of missed daily CSV cycles rather than leaving unmatched requests pending indefinitely",
      "rationale": "The component's own failure_handling states unmatched requests 'simply stay pending until the next day's file' with no stated limit, which as designed has no exit condition"
    },
    {
      "applies_to": "Customer Notification",
      "practice": "Send an explicit interim message stating the real expected timeline (batch-bound, not instant) at the point of intake",
      "rationale": "The architecture itself states the 60-second SLA cannot be met by this design's structure, so customers should not be left assuming an instant outcome while the request sits in a daily batch queue"
    }
  ]
}
```

### Integration requirements

```json
{
  "integrations": [
    {
      "system": "Zendesk",
      "component": "Refund Request Intake",
      "purpose": "Capture the customer's refund request as it arrives through the support channel and convert it into a structured, trackable record.",
      "direction": "inbound",
      "capabilities_required": [
        "Receive or poll for new support tickets/requests",
        "Read ticket content and requester/order references",
        "Trigger on ticket creation (webhook or polling)"
      ],
      "constraints": [
        {
          "constraint": "Support requests arrive through a support inbox / Zendesk",
          "provenance": "stated",
          "context_index": 8
        },
        {
          "constraint": "Zendesk's API is subject to per-account rate limits and requires an authenticated API token or OAuth connection",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether the Zendesk plan in use supports webhooks for new-ticket triggers or only polling",
        "Whether ticket fields carry enough structured order/refund data or require custom fields to be added"
      ]
    },
    {
      "system": "Shopify",
      "component": "Order Verification",
      "purpose": "Check the refund request against Shopify to confirm the order exists and is eligible for refund.",
      "direction": "inbound",
      "capabilities_required": [
        "Read order by identifier",
        "Check order/refund eligibility status",
        "Return stable order identifiers for downstream matching"
      ],
      "constraints": [
        {
          "constraint": "Shopify's Admin API enforces call-rate limits (REST bucket or GraphQL cost-based throttling) per store/app",
          "provenance": "general_knowledge",
          "context_index": null
        },
        {
          "constraint": "Access requires an authenticated app (API key/OAuth) with scoped permissions to read orders",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether order records expose a field indicating refund eligibility directly, or whether eligibility must be derived elsewhere",
        "Whether the Shopify plan/app scopes in use permit the needed read access"
      ]
    },
    {
      "system": "3PL warehouse system",
      "component": "Warehouse Return Matcher",
      "purpose": "Match verified refund requests against the 3PL's return-confirmation feed to establish that the physical return was received.",
      "direction": "inbound",
      "capabilities_required": [
        "Ingest a daily CSV file of return confirmations",
        "Parse CSV rows to order/return identifiers for matching",
        "Handle unmatched or late-arriving rows across batch cycles"
      ],
      "constraints": [
        {
          "constraint": "Warehouse return confirmations arrive as a daily CSV from the 3PL",
          "provenance": "stated",
          "context_index": 6
        },
        {
          "constraint": "The CSV-based confirmation is itself batch-delayed, structurally limiting how fast a 'return received' check can occur",
          "provenance": "stated",
          "context_index": 9
        }
      ],
      "uncertainties": [
        "Whether the 3PL offers any faster or event-based confirmation channel (API/webhook) as an alternative to the daily CSV",
        "Whether the CSV's schema and delivery timing are stable and documented, or subject to change without notice"
      ]
    },
    {
      "system": "Stripe",
      "component": "Refund Execution",
      "purpose": "Issue the actual refund payment for requests that finance has approved.",
      "direction": "outbound",
      "capabilities_required": [
        "Create a refund against an original charge",
        "Idempotent refund creation to avoid duplicate payouts",
        "Report refund transaction status back to the pipeline"
      ],
      "constraints": [
        {
          "constraint": "Stripe's API enforces per-account request rate limits and requires an authenticated API key",
          "provenance": "general_knowledge",
          "context_index": null
        },
        {
          "constraint": "A Stripe refund cannot exceed the original charge amount and may be time-limited relative to the original transaction",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether the Stripe account/plan in use supports idempotency keys as needed for safe retries",
        "Whether occasional higher-value refunds (up to £2,000 per the stated volume) trigger any additional review or hold within Stripe itself"
      ]
    },
    {
      "system": "Zendesk",
      "component": "Customer Notification",
      "purpose": "Inform the customer of the outcome of their refund request at each meaningful state change.",
      "direction": "outbound",
      "capabilities_required": [
        "Update an existing ticket with status/outcome",
        "Send an outbound email or ticket reply to the customer",
        "Reliable delivery/acknowledgement of the outbound message"
      ],
      "constraints": [
        {
          "constraint": "Zendesk's API is subject to per-account rate limits and requires an authenticated API token or OAuth connection",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether the notification channel (email vs. ticket update) is fixed or configurable per the plan in use",
        "Whether failed outbound notifications are surfaced anywhere for manual follow-up, beyond what the architecture states"
      ]
    }
  ],
  "no_integrations_statement": null,
  "knowledge_currency_note": "Platform capabilities, rate limits, pricing, and plan-tier features for Zendesk, Shopify, Stripe, and any 3PL system change over time; every general_knowledge constraint and every capability listed here must be verified against each system's current documentation before this is built."
}
```

### Implementation roadmap

```json
{
  "phases": [
    {
      "ordinal": 1,
      "name": "Request Intake and Order Verification",
      "objective": "Build the entry point that turns a Zendesk support request into a tracked refund record and verifies it against Shopify order data, plus the first notification state (acknowledgement or ineligibility) so a customer sees something happen immediately even though the full refund cannot yet be issued.",
      "components": [
        "Refund Request Intake",
        "Order Verification",
        "Customer Notification"
      ],
      "depends_on": [],
      "outcome": "A refund request arriving through Zendesk becomes a structured, trackable record and is checked against Shopify for existence and eligibility; the customer receives an initial status update. No refund has moved money yet.",
      "estimate": null
    },
    {
      "ordinal": 2,
      "name": "Warehouse Return Matching",
      "objective": "Build the component that matches verified orders against the 3PL's daily CSV to confirm the physical return was received, extending it to hold unmatched requests pending the next day's file. This phase resolves the disposed-of unknown (index 9) about CSV cadence structurally limiting confirmation speed, and extends Customer Notification with a 'pending warehouse confirmation' state.",
      "components": [
        "Warehouse Return Matcher",
        "Customer Notification"
      ],
      "depends_on": [
        1
      ],
      "outcome": "Verified orders are checked against the daily warehouse CSV; requests with a matching confirmed return move forward, others wait for the next day's file. Customers see a pending-return-confirmation status. Still no refund has been paid.",
      "estimate": null
    },
    {
      "ordinal": 3,
      "name": "Finance Approval Batch",
      "objective": "Build the Finance Approval Queue that stages every return-confirmed candidate for the single fixed 4pm daily human review, enforcing the stated hard auditor control (context index 1) over the conflicting instant-refund expectation (indices 0, 2), and extend Customer Notification with a 'pending finance approval' state.",
      "components": [
        "Finance Approval Queue",
        "Customer Notification"
      ],
      "depends_on": [
        2
      ],
      "outcome": "Return-confirmed candidates accumulate and are reviewed once daily at the fixed batch time, producing approved and rejected lists. Customers see their request is awaiting finance sign-off. Money still has not moved for any refund.",
      "estimate": null
    },
    {
      "ordinal": 4,
      "name": "Refund Execution and Outcome Notification",
      "objective": "Build Refund Execution to issue Stripe refunds for finance-approved candidates, including the fallback path for a Stripe call that fails despite approval, and complete Customer Notification with the final paid/rejected states.",
      "components": [
        "Refund Execution",
        "Customer Notification"
      ],
      "depends_on": [
        3
      ],
      "outcome": "Finance-approved refunds are paid out through Stripe, with failed payments flagged for retry rather than dropped; customers receive a final outcome notification (paid or rejected). The full pipeline now runs end to end from request intake through payment, within the constraints of the daily warehouse CSV and the fixed daily finance batch — the whole design as specified now exists, though it cannot meet the stated 60-second SLA (indices 0, 2) given the batch-bound components built in phases 2 and 3.",
      "estimate": null
    }
  ],
  "sequencing_rationale": "The order follows the data flow the architecture describes: a request must exist as a tracked record before anything can be checked against it, so intake and Shopify verification come first. The warehouse match is next because Finance Approval Queue explicitly requires a return-confirmed candidate as its input, and the CSV's daily cadence (context index 9) is the first structural constraint that must be built and understood before the finance batch is designed around it — building it early also surfaces the SLA conflict (indices 0/2 vs 9) as early as possible rather than late. Finance Approval Queue is built third because it consumes the matcher's output and enforces the hard auditor control (index 1) that the whole design defers payment behind; it is the second point where the stated 60-second SLA (index 2) is structurally violated, and building it before execution keeps that conflict visible before money can move. Refund Execution comes last among the pipeline stages because it consumes only the finance-approved list, so nothing about it can be built or tested until approval output exists. Customer Notification is extended in every phase rather than built once, because each phase introduces a new state (verification, pending return, pending approval, final outcome) that a customer needs to see, and the fallback-handling rule requires each component's failure path to be built alongside the component itself rather than deferred."
}
```

### Risk register

```json
{
  "risks": [
    {
      "component": "Finance Approval Queue",
      "description": "The finance approval batch (index 1, index 3) runs once daily at a fixed 4pm, which structurally cannot satisfy the stated 60-second refund SLA (index 2) or the stated requirement that refunds be fully automated with no human involvement (index 0); every single refund request is subject to this conflict, not just edge cases.",
      "severity": 5,
      "likelihood": 5,
      "mitigation": "Surface this as an unresolved conflict to the business rather than building against it silently; require a decision on which constraint is authoritative (drop the 60-second promise, remove the finance gate for low-value refunds, or add a same-day emergency approval path) before implementation proceeds."
    },
    {
      "component": "Warehouse Return Matcher",
      "description": "Warehouse return confirmation arrives only once a day as a CSV (index 6), so this component cannot confirm a return, and therefore cannot clear a refund, any faster than a full day's cadence — directly conflicting with the 60-second SLA for every refund that depends on return confirmation.",
      "severity": 5,
      "likelihood": 5,
      "mitigation": "Either move to a real-time return-confirmation feed from the 3PL, or explicitly scope the 60-second SLA to apply only to refund categories that do not require a physical return (e.g. goodwill refunds), leaving return-dependent refunds on a slower, clearly communicated timeline."
    },
    {
      "component": "Refund Execution",
      "description": "When a Stripe refund call fails after finance has already approved it, the item is flagged for retry, but no operator or team has been assigned to act on that flag, since who operates and maintains the pipeline is an unresolved unknown (index 10); a stuck approved-but-unpaid refund could sit indefinitely.",
      "severity": 4,
      "likelihood": 2,
      "mitigation": "Assign a named owner (e.g. a finance or ops role) responsible for clearing the Stripe-failure queue daily, and set an escalation threshold (e.g. alert if unpaid-approved items exceed 24 hours old)."
    },
    {
      "component": "3PL warehouse system",
      "description": "The daily CSV feed is an external, loosely-coupled input with no stated format guarantee; a malformed row, a missed file, or a mismatched order reference would leave refund candidates permanently unmatched with no faster confirmation path available, given the batch-only cadence (index 9).",
      "severity": 3,
      "likelihood": 3,
      "mitigation": "Add validation on CSV ingestion (row count, required fields, order-ID format checks) and an alert if the daily file fails to arrive or fails validation, so unmatched items are caught rather than silently stuck."
    },
    {
      "component": "Finance Approval Queue",
      "description": "Refund values range up to £2,000 (index 4), and all refunds — regardless of value — wait for the same fixed once-daily batch; a customer awaiting a large refund experiences the same delay as one awaiting the average £45 refund, with no differentiated handling for higher-value or higher-risk cases.",
      "severity": 3,
      "likelihood": 3,
      "mitigation": "Consider a value-based or risk-based triage within the approval queue so high-value refunds are flagged for finance's earliest attention within the daily batch, rather than treated identically to low-value ones."
    },
    {
      "component": "Refund Request Intake",
      "description": "If intake fails to convert a support request into a structured record, the request remains only in the Zendesk inbox and falls outside the automated pipeline entirely, with no automated detection that this happened.",
      "severity": 3,
      "likelihood": 2,
      "mitigation": "Add a reconciliation check that compares refund-tagged Zendesk tickets against records the intake component actually created, flagging any gap for manual follow-up."
    },
    {
      "component": "Shopify",
      "description": "If the Shopify order lookup fails or times out, the request is held in an unverified state with no stated timeout or retry policy, and no assigned operator to intervene (unknown 10), so it could remain stuck indefinitely without visibility.",
      "severity": 3,
      "likelihood": 2,
      "mitigation": "Define an explicit retry count and timeout for the Shopify lookup, and route items that exceed it to a visible manual-review queue rather than leaving them silently unverified."
    },
    {
      "component": "Zendesk",
      "description": "If a customer notification fails to send at a status change, the refund's internal state proceeds correctly but the customer receives no update, which is inconsistent with a support-facing workflow and could prompt duplicate refund requests.",
      "severity": 2,
      "likelihood": 2,
      "mitigation": "Log notification failures separately from refund-state failures and add a low-priority daily check for any refund whose latest status change has no corresponding customer notification sent."
    }
  ],
  "no_risks_statement": null
}
```

### Platform recommendation

```json
{
  "criteria_applied": [
    {
      "criterion": "Weekly volume is low (about 200 refunds/week, average £45, occasionally up to £2,000), which does not by itself require a high-throughput enterprise platform",
      "context_index": 4,
      "component": null
    },
    {
      "criterion": "The pipeline must integrate with four named external systems (Shopify, Stripe, Zendesk, and a 3PL warehouse system), so the platform needs native or API-level connectivity to each",
      "context_index": 5,
      "component": null
    },
    {
      "criterion": "Warehouse confirmations arrive only as a daily CSV, so the platform must support batch file ingestion, not just event-driven webhooks",
      "context_index": 6,
      "component": "Warehouse Return Matcher"
    },
    {
      "criterion": "Finance approval is a stated hard, unchangeable auditor control that must gate every refund before Stripe execution, so the platform must support a genuine human-in-loop approval step with an audit trail, not just automated branching",
      "context_index": 1,
      "component": "Finance Approval Queue"
    },
    {
      "criterion": "Finance review runs on a fixed once-daily batch at 4pm, so the platform must support scheduled batch processing rather than assuming continuous real-time flow",
      "context_index": 3,
      "component": "Finance Approval Queue"
    },
    {
      "criterion": "Who will operate, monitor, and maintain the automation, and whether in-house developer capability exists, is unresolved, which materially determines whether a no-code, low-code, or custom-built platform is viable",
      "context_index": 10,
      "component": null
    },
    {
      "criterion": "Budget for building or licensing an automation platform is unresolved, which determines whether a paid iPaaS, an open-source/self-hosted tool, or a custom build is affordable",
      "context_index": 11,
      "component": null
    },
    {
      "criterion": "The stated 60-second refund SLA and the stated fixed daily finance batch are in direct, structural conflict; no platform choice can reconcile them, since the conflict is procedural, not technical",
      "context_index": 2,
      "component": null
    }
  ],
  "recommended_platform": null,
  "also_required": [],
  "rationale": "The architecture's integration and control requirements (multi-system connectivity to Shopify, Stripe, Zendesk and a 3PL CSV feed; a genuine human-approval gate with audit trail; scheduled batch processing) are clear enough to describe what any suitable platform must do. But two unknowns the context leaves unresolved — who will operate and maintain the automation and what technical capability exists in-house (context 10), and what budget is available for building or licensing a platform (context 11) — are exactly the factors that decide whether the right answer is a no-code/low-code connector tool, a self-hosted open-source workflow engine, or a custom-built service, and what tier of each is affordable. Naming a specific platform without those answers would mean inventing a team profile or a budget the context does not state. Separately, even the best-chosen platform cannot deliver both the stated 60-second refund SLA and the stated fixed 4pm daily finance batch (context 2 vs. context 3); that conflict is a process decision for the business to resolve, not something platform selection can fix. The honest recommendation is therefore to resolve the operator-capability and budget unknowns, and the SLA-versus-batch conflict, before committing to a specific platform.",
  "alternatives_rejected": [
    {
      "platform": "A simple no-code connector tool used at the level of a small number of point-to-point triggers (e.g. a basic Zapier/Make-style workflow with no custom logic)",
      "rejection_reason": "This class of tool is generally strong at simple trigger-action integration, but a workflow needing daily CSV batch matching against warehouse returns, a genuine audited human-approval gate before payment, and multi-branch state tracking (pending verification, pending approval, paid, rejected) typically exceeds what basic no-code connector logic is designed to express reliably; whether it is adequate here still depends on the unresolved in-house capability (context 10)."
    },
    {
      "platform": "A fully custom-built bespoke software service (developed and hosted in-house or via a contractor)",
      "rejection_reason": "A custom build could in principle satisfy every integration and control requirement, but the context states no budget figure and leaves in-house technical capability unresolved (contexts 10, 11); recommending a custom build would assume both the funding and the developer capacity to build and maintain it, neither of which the input supports."
    }
  ],
  "fit": [
    {
      "component": "Refund Request Intake",
      "how": "Coverage cannot be assigned to a specific platform yet; whatever platform is eventually chosen must be able to receive or poll Zendesk for new refund requests and create a structured, trackable record, a capability that is common but whose implementation depends on the unresolved operator-capability question."
    },
    {
      "component": "Order Verification",
      "how": "Any candidate platform needs API-level read access to Shopify order data; this is a standard integration requirement but the specific platform's ability to hold a request in an 'unverified' retry state without invention is a design detail, not a platform-name decision."
    },
    {
      "component": "Warehouse Return Matcher",
      "how": "The chosen platform must be able to ingest and parse a daily CSV file and match it against pending requests on a schedule; this rules out purely event/webhook-only tools but does not by itself select one platform over another given the unresolved budget and capability questions."
    },
    {
      "component": "Finance Approval Queue",
      "how": "The platform must provide a genuine, audit-trailed human-approval step gated to a fixed daily batch; this is the component most sensitive to who operates it (context 10), since a finance team with no automation background needs a materially different interface than one with technical staff."
    },
    {
      "component": "Refund Execution",
      "how": "The platform must call the Stripe refund API only after approval and must flag failed calls for retry; this is a common integration pattern across many platforms and is not itself the deciding factor here."
    },
    {
      "component": "Customer Notification",
      "how": "The platform must push status updates back to Zendesk/email at each state change; like Refund Execution, this is broadly available across platform classes and does not resolve which platform to name."
    }
  ],
  "knowledge_currency_note": "No specific platform is named in this recommendation, so no platform capability claim is being made here; however, if a platform is later selected based on resolved budget and team-capability answers, its current integration capabilities, approval/workflow features, CSV/batch handling, and pricing should be verified directly against that platform's current documentation before committing, since these details change over time and are not asserted here."
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

*Comparison candidates (same input type):* RP-07a977a3, RP-27f9fb58, RP-2fa7c3e3, RP-448236a4, RP-5c2b0a40, RP-ac291956, RP-d41a9d08, RP-e755dbdf. Name the one you used.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

### Overall

Per §3.5 an analysis passes only when all seven criteria pass. C-3 and C-6 are not assessable here, so this analysis cannot be recorded as a rubric pass.

- **Overall:** ` fail / not assessable `  (a pass is not reachable — see above)
- **Notes:**

> 

