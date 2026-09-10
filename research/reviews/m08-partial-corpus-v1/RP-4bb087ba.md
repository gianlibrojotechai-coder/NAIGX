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

*10 stage(s) recorded: Classification → Intent → Context extraction → Architecture analysis → Complexity assessment → Integration requirements → Risk register → Implementation roadmap → Edge cases and practices → Platform recommendation.*

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
    "content": "Decide whether and how to automate the customer refund process (Shopify order check, warehouse return confirmation, Stripe refund, customer email) currently run manually through the support inbox.",
    "provenance": "stated"
  },
  "secondary_objectives": [
    {
      "content": "Automate refund processing end to end with no human involvement so the overloaded support team does not need to touch it.",
      "provenance": "stated"
    },
    {
      "content": "Ensure every refund is reviewed and approved by a member of finance before money leaves the account, per a hard auditor control requirement.",
      "provenance": "stated"
    },
    {
      "content": "Issue refunds within 60 seconds of the customer's request to advertise instant refunds as a competitive differentiator.",
      "provenance": "stated"
    },
    {
      "content": "Accommodate finance's daily batch review at 4pm as the fixed timing for approvals.",
      "provenance": "stated"
    },
    {
      "content": "Handle the current volume and value profile (about 200 refunds/week, average £45, occasionally up to £2,000) reliably.",
      "provenance": "stated"
    },
    {
      "content": "Reconcile the conflict between requirement 1 (no human involvement, full automation) and requirement 2 (mandatory human finance approval before funds leave) plus requirement 3 (60-second turnaround) versus requirement 4 (once-daily 4pm batch review) — these pairs of stated requirements directly contradict each other and cannot both be satisfied as written.",
      "provenance": "inferred"
    }
  ],
  "inferred_scope": "The refund workflow spanning customer request intake (Zendesk support inbox), order verification (Shopify), return confirmation (daily CSV from 3PL warehouse), refund execution (Stripe), customer notification (email), and finance approval — bounded to this single process and its named systems; no other business processes or systems are in scope."
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
      "specificity_score": 0.8,
      "source_quote": "Refunds must be fully automated end to end with no human involvement.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": "e2"
    },
    {
      "id": "e2",
      "content": "Every refund must be reviewed and approved by a member of the finance team before the money leaves the account, a hard auditor control requirement",
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
      "content": "Finance reviews refunds in a batch once per day at 4pm, fixed schedule",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "Finance reviews refunds in a batch once per day at 4pm.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": "e3"
    },
    {
      "id": "e5",
      "content": "About 200 refunds a week, average value £45, occasionally up to £2,000 for bulk orders",
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
      "content": "System: Shopify (order records)",
      "category": "system",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "we currently check\nthe order in Shopify",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e7",
      "content": "System: Stripe (refund issuance)",
      "category": "system",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "issue the refund through Stripe",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e8",
      "content": "System: Zendesk (support inbox intake)",
      "category": "system",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "Support uses Zendesk.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e9",
      "content": "Warehouse confirmations arrive as a daily CSV from the 3PL",
      "category": "dependency",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "Warehouse confirmations come\nin as a daily CSV from our 3PL.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e10",
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
      "id": "e11",
      "content": "Warehouse confirmation is only available once daily via CSV, which limits how quickly a return can be verified as received relative to a 60-second refund target",
      "category": "dependency",
      "provenance": "inferred",
      "specificity_score": 0.7,
      "source_quote": null,
      "inference_basis": "The 3PL confirmation is stated to arrive as a daily CSV, which cannot supply real-time return-received data needed to satisfy a 60-second refund promise.",
      "resolution_hint": null,
      "conflicts_with_id": "e3"
    },
    {
      "id": "e12",
      "content": "Whether the 60-second refund promise applies to all refunds or only a subset (e.g. those not requiring return verification) is unresolved",
      "category": "objective",
      "provenance": "unknown",
      "specificity_score": 0.3,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Does the 60-second SLA apply to every refund, including those requiring warehouse return confirmation, or only to a subset where no physical return is involved?",
      "conflicts_with_id": null
    },
    {
      "id": "e13",
      "content": "How the business intends to reconcile the stated no-human-involvement automation goal with the mandatory finance approval control is unresolved",
      "category": "objective",
      "provenance": "unknown",
      "specificity_score": 0.3,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Is the finance approval intended to be a real human sign-off, or could it be an automated policy check that stands in for the human review demanded by auditors — and would auditors accept that?",
      "conflicts_with_id": null
    },
    {
      "id": "e14",
      "content": "Whether high-value refunds (up to £2,000) require different handling or thresholds than average (£45) refunds is unresolved",
      "category": "constraint",
      "provenance": "unknown",
      "specificity_score": 0.3,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Should refunds above a certain value be routed differently (e.g. always held for review) than routine low-value refunds?",
      "conflicts_with_id": null
    }
  ],
  "sufficiency": "thin"
}
```

### Architecture analysis

```json
{
  "summary": "The design covers the current manual refund process (Shopify order check, 3PL return confirmation, Stripe refund, customer email) as a structured pipeline with a mandatory finance approval gate. It cannot simultaneously satisfy the stated 60-second refund promise and the stated fully-automated, no-human-involvement goal, because a hard auditor control requires human finance sign-off and finance only reviews in a once-daily 4pm batch. The architecture below implements the batch-gated version of the process, since that is the requirement carrying an explicit auditor justification; the 60-second and no-human-involvement objectives are not achievable within this structure as stated and are surfaced rather than silently dropped.",
  "data_flow_description": "A customer refund request enters through the Zendesk support inbox and is captured as a structured record (order id, customer, requested amount). That record is checked against Shopify to confirm the order exists and the requested amount is valid. Separately, return status for the order is checked against the daily CSV file received from the 3PL warehouse; if the order has not yet appeared in that file, the return is treated as unconfirmed. Verified, return-checked requests accumulate in a queue awaiting finance's daily 4pm batch review. At that review, a finance team member approves or rejects each queued refund. Only approved refunds are sent to Stripe for execution. Once Stripe confirms the refund, an email notification is sent to the customer. No refund reaches Stripe without passing through the finance approval gate, and no return is treated as confirmed until it appears in a 3PL CSV file.",
  "components": [
    {
      "name": "Refund Request Intake",
      "responsibility": "Capture customer refund requests arriving in the Zendesk support inbox and convert them into a structured request record.",
      "inputs": "Customer refund request email in Zendesk support inbox",
      "outputs": "Structured refund request record (order id, customer, requested amount)",
      "failure_handling": "If a request cannot be parsed into a structured record, it remains unprocessed in the support inbox with no automated fallback described in the input.",
      "external_system": "Zendesk",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        7,
        9
      ]
    },
    {
      "name": "Order Verification",
      "responsibility": "Confirm the order referenced in a refund request exists in Shopify and check the requested refund amount against it.",
      "inputs": "Order id and requested amount from the intake record",
      "outputs": "Order validity result (exists/eligible amount) from Shopify",
      "failure_handling": "If the Shopify lookup fails or the order is not found, the refund request is halted and flagged rather than proceeding to return verification.",
      "external_system": "Shopify",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        5,
        9
      ]
    },
    {
      "name": "Return Confirmation Check",
      "responsibility": "Determine whether the warehouse has confirmed receipt of the returned item for a given order, using the daily 3PL CSV feed.",
      "inputs": "Daily CSV file from the 3PL warehouse; order id",
      "outputs": "Return-received status for the order (confirmed / not yet confirmed)",
      "failure_handling": "If the day's CSV is not received, or the order is absent from it, the return status stays unconfirmed and the refund is held over to the next day's file rather than proceeding.",
      "external_system": "3PL warehouse system",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        8,
        9,
        10
      ]
    },
    {
      "name": "Finance Approval Queue",
      "responsibility": "Hold verified refund requests until finance's fixed daily batch review and record each approval or rejection decision.",
      "inputs": "Verified refund requests with order and return-confirmation status",
      "outputs": "Approved or rejected refund decisions, produced once daily at the 4pm review",
      "failure_handling": "If the 4pm batch review does not occur (e.g. finance unavailable), queued refunds remain unapproved and no funds move until the next scheduled review.",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        1,
        3
      ]
    },
    {
      "name": "Refund Execution",
      "responsibility": "Issue the actual refund payment through Stripe for requests that have received finance approval.",
      "inputs": "Approved refund decision (amount, customer, order id)",
      "outputs": "Executed Stripe refund transaction and confirmation",
      "failure_handling": "If the Stripe call fails, the refund remains marked approved-but-not-executed and requires a retry or manual finance follow-up, since no other execution path is described.",
      "external_system": "Stripe",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        6,
        9
      ]
    },
    {
      "name": "Customer Notification",
      "responsibility": "Notify the customer by email once their refund has been executed.",
      "inputs": "Refund execution confirmation",
      "outputs": "Confirmation email to the customer",
      "failure_handling": "If the email fails to send, the refund itself has still been processed but the customer is not informed, requiring manual follow-up since no alternate notification channel is described.",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        9
      ]
    }
  ],
  "unknown_disposition": [
    {
      "context_index": 11,
      "disposition": "excluded",
      "statement": "The design applies the same order-verification, return-confirmation and finance-approval path to every refund; it does not carve out a faster path for refunds that might not require return verification, because the input does not say whether such a subset exists or what would define it. Including a subset would require clarifying which refunds do not need return confirmation."
    },
    {
      "context_index": 12,
      "disposition": "assumed",
      "statement": "The design assumes the finance approval step is a genuine human sign-off (as the auditor control language implies), not an automated policy check standing in for it, and therefore treats no-human-involvement automation as achievable only up to that gate, not through it. If auditors would accept an automated policy check instead, the Finance Approval Queue component could be replaced."
    },
    {
      "context_index": 13,
      "disposition": "excluded",
      "statement": "The design does not add a separate high-value review path or threshold for refunds approaching £2,000; all refunds pass through the same single approval queue. Adding differentiated handling would require the business to specify a value threshold and what different treatment above it should look like."
    }
  ],
  "trade_offs": [],
  "rejected_approaches": []
}
```

### Complexity assessment

```json
{
  "factors": [
    {
      "factor": "workflow",
      "score": 3,
      "justification": "The pipeline has a linear sequence (intake → Shopify check → 3PL return check → finance batch queue → Stripe execution → email) but includes conditional halts (order not found, return unconfirmed) and a wait state for the daily batch review, giving moderate branching without deep nesting or loops."
    },
    {
      "factor": "integration",
      "score": 3,
      "justification": "Four systems are involved (Zendesk, Shopify, 3PL CSV feed, Stripe) with conventional interfaces for Shopify and Stripe, but the 3PL only offers a daily CSV rather than an API, and the finance queue is a manual human step, adding heterogeneity beyond a simple two-system design."
    },
    {
      "factor": "data_logic",
      "score": 2,
      "justification": "Transformations are modest: parsing a Zendesk request into a structured record, matching order id/amount against Shopify, and matching order id against a CSV return status. There is no reconciliation across many sources or dense rule sets, just a few validity checks."
    },
    {
      "factor": "failure_risk",
      "score": 4,
      "justification": "Several failure modes are named explicitly - unparsed intake requests, Shopify lookup failure, missing/late 3PL CSV, missed 4pm batch review, and failed Stripe calls left 'approved-but-not-executed' - each requiring deliberate handling; money movement and an auditor control raise the consequence of mishandling, though volumes (200/week, avg £45) limit severity somewhat."
    },
    {
      "factor": "operational",
      "score": 3,
      "justification": "The design depends on a fixed daily 4pm finance review and a daily 3PL CSV arriving on schedule, both of which require routine human attention (finance staff, and follow-up if the CSV or Stripe call fails), rather than running fully unattended, but no continuous monitoring or specialist technical skill is implied."
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
      "purpose": "Capture customer refund requests arriving in the support inbox and convert them into structured request records for processing.",
      "direction": "inbound",
      "capabilities_required": [
        "Read/receive support inbox messages (e.g. via webhook on new ticket or polling)",
        "Extract or expose ticket fields needed to identify order id, customer, and requested amount"
      ],
      "constraints": [
        {
          "constraint": "stated",
          "provenance": "stated",
          "context_index": 7
        }
      ],
      "uncertainties": [
        "Whether Zendesk exposes a webhook for new tickets on the plan in use, or whether polling is required",
        "Whether refund requests arrive as structured ticket fields or free-text email requiring parsing"
      ]
    },
    {
      "system": "Shopify",
      "component": "Order Verification",
      "purpose": "Confirm the order referenced in a refund request exists and check the requested refund amount against Shopify order records.",
      "direction": "inbound",
      "capabilities_required": [
        "Read order records by order id",
        "Read order line-item/amount data to validate requested refund amount"
      ],
      "constraints": [
        {
          "constraint": "Shopify's public Admin API enforces per-store REST/GraphQL rate limits (leaky-bucket call allowances)",
          "provenance": "general_knowledge",
          "context_index": null
        },
        {
          "constraint": "Shopify API access requires an authenticated app (API key/OAuth) scoped to order read permissions",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether the current Shopify plan and app scopes permit the order read access this integration needs",
        "Whether order lookup by the identifier available in the refund request (order id vs order number) is reliably supported"
      ]
    },
    {
      "system": "3PL warehouse system",
      "component": "Return Confirmation Check",
      "purpose": "Determine whether a returned item has been received by the warehouse, using the daily CSV feed, to gate refund eligibility.",
      "direction": "inbound",
      "capabilities_required": [
        "Receive/ingest a daily CSV file listing confirmed returns",
        "Match CSV records to order ids"
      ],
      "constraints": [
        {
          "constraint": "Warehouse confirmations arrive as a daily CSV from the 3PL",
          "provenance": "stated",
          "context_index": 8
        },
        {
          "constraint": "Warehouse confirmation is only available once daily via CSV, which limits how quickly a return can be verified as received",
          "provenance": "stated",
          "context_index": 10
        }
      ],
      "uncertainties": [
        "Whether the CSV is delivered via a fixed file location, email attachment, SFTP, or another mechanism not described in the input",
        "Whether the CSV format, delivery time, and field structure are stable and documented by the 3PL",
        "Whether any alternative real-time confirmation API exists on the 3PL side that could reduce the once-daily delay"
      ]
    },
    {
      "system": "Stripe",
      "component": "Refund Execution",
      "purpose": "Issue the actual refund payment for refund requests that have received finance approval.",
      "direction": "outbound",
      "capabilities_required": [
        "Create a refund against a prior charge/payment intent",
        "Idempotent refund creation to avoid duplicate refunds on retry",
        "Read refund/transaction confirmation status"
      ],
      "constraints": [
        {
          "constraint": "Stripe's API supports idempotency keys to make refund creation safe to retry",
          "provenance": "general_knowledge",
          "context_index": null
        },
        {
          "constraint": "Stripe enforces standard API rate limits per account (requests per second)",
          "provenance": "general_knowledge",
          "context_index": null
        },
        {
          "constraint": "Stripe requires the original charge or payment intent id to issue a refund",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether the Stripe account in use has any refund-specific limits or holds (e.g. for high-value refunds up to £2,000) that could block or delay execution",
        "Whether Stripe's current API still ties refunds strictly to an original charge id, and whether that id is reliably available from Shopify order data"
      ]
    }
  ],
  "no_integrations_statement": null,
  "knowledge_currency_note": "Platform capabilities, rate limits, authentication requirements and pricing change over time; every general_knowledge constraint and every capability listed here must be verified against Shopify's, Stripe's, Zendesk's and the specific 3PL's current documentation before building."
}
```

### Risk register

```json
{
  "risks": [
    {
      "component": "Finance Approval Queue",
      "description": "The architecture is built on the disposed-of assumption that finance approval means a genuine human sign-off, but the input also states a hard 'no human involvement' constraint; if the business actually intends automated approval to satisfy auditors, the entire batch-gate design is wrong and refunds could be blocked or wrongly delayed indefinitely.",
      "severity": 5,
      "likelihood": 3,
      "mitigation": "Confirm with auditors and the business whether a human sign-off is strictly required or whether an automated policy check would satisfy the control before building the Finance Approval Queue as a human-gated step."
    },
    {
      "component": "Return Confirmation Check",
      "description": "Because the 3PL only supplies return status via a daily CSV, and the stated 60-second refund target conflicts directly with this once-a-day cadence, any refund requiring return verification cannot meet the 60-second SLA; if that SLA is a customer-facing promise, every such refund breaches it.",
      "severity": 5,
      "likelihood": 5,
      "mitigation": "Resolve with the business whether the 60-second SLA applies to returns-required refunds at all (context index 11); if it does, negotiate real-time or more frequent 3PL confirmation feeds, or explicitly scope the SLA to exclude return-dependent refunds."
    },
    {
      "component": "Finance Approval Queue",
      "description": "The fixed once-daily 4pm batch review means any refund request submitted just after the cutoff waits up to nearly 24 hours before approval, directly contradicting the stated 60-second refund constraint and creating a systematic, routine delay for the ~200/week volume.",
      "severity": 4,
      "likelihood": 5,
      "mitigation": "Set clear customer-facing expectations that refunds are batch-processed daily rather than instant, and consider whether Finance Approval Queue could run more than once daily to narrow the gap."
    },
    {
      "component": "Refund Execution",
      "description": "Failures against Stripe leave a refund 'approved-but-not-executed' with no described automated retry path; given occasional high-value refunds up to £2,000, an unnoticed failed execution could leave a customer unpaid for a meaningful sum with only manual finance follow-up as the stated fallback.",
      "severity": 4,
      "likelihood": 2,
      "mitigation": "Add an automated retry with alerting to finance for failed Stripe calls, and flag high-value failures (approaching the £2,000 range) for priority follow-up."
    },
    {
      "component": "Refund Execution",
      "description": "No differentiated handling exists for high-value refunds (up to £2,000) versus the £45 average; a single approval queue treats a routine refund the same as a bulk-order refund, so an erroneous approval of a high-value refund carries outsized financial exposure with no extra check in this design.",
      "severity": 4,
      "likelihood": 2,
      "mitigation": "Introduce a value threshold above which refunds get a secondary review step or additional confirmation before Refund Execution, once the business defines that threshold (context index 13)."
    },
    {
      "component": "Return Confirmation Check",
      "description": "If the daily CSV from the 3PL is missing, delayed, or malformed, no automated fallback is described beyond holding the refund to the next day's file, which given weekly volumes of ~200 could cause a backlog to accumulate silently across the Finance Approval Queue.",
      "severity": 3,
      "likelihood": 3,
      "mitigation": "Add a monitoring check that confirms the day's CSV was received and parsed, with an alert to an operator if it is missing, so held refunds are visible rather than silently stalled."
    },
    {
      "component": "Order Verification",
      "description": "If the Shopify lookup fails or times out, the refund halts and is flagged, but no owner or escalation path is described for these flagged, halted requests, risking requests being lost between systems.",
      "severity": 3,
      "likelihood": 2,
      "mitigation": "Route flagged, halted order-verification failures to a visible queue or ticket assigned to a named operational owner rather than leaving them unassigned."
    },
    {
      "component": "Customer Notification",
      "description": "A failed notification email leaves the refund processed but the customer uninformed, and no alternate channel is described; at ~200 refunds/week even a small email failure rate produces a routine trickle of customers who received money without being told.",
      "severity": 2,
      "likelihood": 3,
      "mitigation": "Add a delivery-failure check on the notification email with a retry, and log failures for periodic manual follow-up."
    },
    {
      "component": "Refund Request Intake",
      "description": "Requests that fail to parse into a structured record from the Zendesk inbox have no automated fallback and simply remain unprocessed, risking refund requests being missed entirely at the ~200/week volume.",
      "severity": 3,
      "likelihood": 2,
      "mitigation": "Add a parsing-failure alert that surfaces unparsed Zendesk messages to a human reviewer rather than leaving them silently unprocessed."
    }
  ],
  "no_risks_statement": null
}
```

### Implementation roadmap

```json
{
  "phases": [
    {
      "ordinal": 1,
      "name": "Refund Intake and Order Verification",
      "objective": "Build the Zendesk-based intake that converts a customer refund request into a structured record, and the Shopify check that validates the order and requested amount against that record. This is the entry point every later component consumes.",
      "components": [
        "Refund Request Intake",
        "Order Verification"
      ],
      "depends_on": [],
      "outcome": "A customer refund request raised in Zendesk becomes a structured record and is checked against Shopify for order existence and amount validity; invalid or unmatched orders are flagged and halted rather than proceeding.",
      "estimate": null
    },
    {
      "ordinal": 2,
      "name": "Return Confirmation via 3PL CSV",
      "objective": "Build the Return Confirmation Check that consumes the daily 3PL CSV to determine whether a given order's return has been received, and holds unconfirmed orders over to the next day's file. This is where the once-daily 3PL feed's mismatch with any faster refund expectation becomes structurally visible in the build, since a request cannot be marked return-confirmed until it appears in a CSV.",
      "components": [
        "Return Confirmation Check"
      ],
      "depends_on": [
        1
      ],
      "outcome": "A verified refund request from phase 1 can now be checked against the day's 3PL CSV; requests are marked confirmed or held pending the next file, with no return treated as received until it appears in the feed.",
      "estimate": null
    },
    {
      "ordinal": 3,
      "name": "Finance Approval Gate",
      "objective": "Build the Finance Approval Queue that accumulates order-verified, return-checked requests and holds them for the fixed 4pm daily batch review, implementing the auditor-mandated human sign-off. This phase fixes the assumed disposition of the no-human-involvement-vs-auditor-control conflict: approval is built as a genuine human decision point, not an automated stand-in.",
      "components": [
        "Finance Approval Queue"
      ],
      "depends_on": [
        1,
        2
      ],
      "outcome": "Requests that have passed Shopify and 3PL checks sit in a queue; a finance team member can review and approve or reject each one at the daily 4pm batch, with rejections and non-occurring reviews leaving refunds unapproved rather than defaulting to release.",
      "estimate": null
    },
    {
      "ordinal": 4,
      "name": "Refund Execution via Stripe",
      "objective": "Build the Refund Execution component that takes finance-approved decisions and issues the Stripe refund, including the approved-but-not-executed fallback state for Stripe call failures.",
      "components": [
        "Refund Execution"
      ],
      "depends_on": [
        3
      ],
      "outcome": "An approved refund decision from the finance queue results in an actual Stripe refund transaction; failed Stripe calls leave the refund marked approved-but-not-executed for retry or manual finance follow-up, with no other execution path invented.",
      "estimate": null
    },
    {
      "ordinal": 5,
      "name": "Customer Notification",
      "objective": "Build the Customer Notification component that emails the customer once Stripe confirms the refund, completing the pipeline end to end.",
      "components": [
        "Customer Notification"
      ],
      "depends_on": [
        4
      ],
      "outcome": "A customer whose refund has been executed in Stripe receives a confirmation email; if the email fails, the refund itself has still gone through and the gap is surfaced for manual follow-up. At this point the full design described in the architecture exists and runs end to end from Zendesk intake through Shopify and 3PL checks, finance batch approval, Stripe execution, and customer email.",
      "estimate": null
    }
  ],
  "sequencing_rationale": "The pipeline is built in the order data must actually flow: intake must exist before anything can check an order, and the Shopify order check is grounded on the same structured record intake produces, so phase 1 combines them as the shared entry point every later component consumes. The 3PL return check is built next because it operates on the same order id but is a separate, independently-failing integration (a once-daily external file with no real-time equivalent), and its held-over-to-next-day fallback has to exist before requests can be said to be 'verified' inputs to the approval queue. The Finance Approval Queue comes only after both verification checks exist, because it is defined as consuming order-verified, return-checked requests, and because this is the phase that fixes the assumed resolution of the human-sign-off-versus-full-automation conflict — that decision has to be settled before refund money can move, which is why it precedes Stripe execution. Refund Execution depends on approval because no refund may reach Stripe without passing the approval gate, per the architecture's data flow. Customer Notification is last because it is triggered only by a completed Stripe execution and consumes nothing else. The riskiest integration — reconciling a once-daily 3PL feed and once-daily finance batch against any faster refund expectation — is proven early, in phases 1 and 2, so that the batch-gated structure the rest of the design depends on is established before approval and execution are built on top of it."
}
```

### Edge cases and practices

```json
{
  "edge_cases": [
    {
      "component": "Refund Request Intake",
      "scenario": "A customer email arrives in the Zendesk inbox that cannot be parsed into order id, customer, and requested amount (e.g. free-text request without order reference)",
      "consequence": "The request sits unprocessed in the support inbox indefinitely, and the customer's refund is never queued for verification or finance review",
      "handling": "Component's failure_handling states it 'remains unprocessed in the support inbox with no automated fallback described in the input' — this is an unresolved gap, not a handled case"
    },
    {
      "component": "Order Verification",
      "scenario": "A refund request references an order id that does not exist in Shopify, or the requested amount exceeds the order's eligible amount",
      "consequence": "An invalid or inflated refund could proceed toward Stripe execution if not caught",
      "handling": "Component halts and flags the request rather than passing it to Return Confirmation Check, per its stated failure_handling"
    },
    {
      "component": "Return Confirmation Check",
      "scenario": "The daily 3PL CSV fails to arrive on a given day, or an order's return is never listed in any subsequent CSV (lost item, warehouse error)",
      "consequence": "The refund is held over indefinitely with no described escalation, so a customer waiting on a return-dependent refund never gets resolution",
      "handling": "Held over to the next day's file per stated failure_handling; no described limit on how many days this can repeat, which is unresolved in this design"
    },
    {
      "component": "Finance Approval Queue",
      "scenario": "The 4pm daily batch review does not occur (finance team member unavailable, holiday, or backlog accumulates across multiple days including the £2,000 bulk-order refunds)",
      "consequence": "No refunds move to Stripe execution until the next scheduled review, and high-value refunds (up to £2,000) sit in queue the same as low-value ones with no differentiated urgency",
      "handling": "Failure_handling states refunds 'remain unapproved and no funds move until the next scheduled review' — the design applies no separate handling for high-value items, consistent with unknown_disposition index 13 being excluded"
    },
    {
      "component": "Refund Execution",
      "scenario": "The Stripe API call fails or times out after finance has approved a refund, for example during the daily batch when 200/week volume clusters many approvals at once around 4pm",
      "consequence": "The refund is approved but money never leaves the account, leaving the customer unrefunded despite approval, with no described retry path",
      "handling": "Component's failure_handling marks it 'approved-but-not-executed' requiring retry or manual finance follow-up, since no automated retry path is described"
    },
    {
      "component": "Customer Notification",
      "scenario": "The confirmation email fails to send after a Stripe refund has successfully executed",
      "consequence": "The customer's money is refunded but they are never told, likely prompting a duplicate support inquiry into the same order via Zendesk",
      "handling": "Failure_handling states the refund is still processed but requires manual follow-up since no alternate notification channel is described"
    },
    {
      "component": "Finance Approval Queue",
      "scenario": "The stated 60-second refund promise (index 2) conflicts directly with the fixed once-daily 4pm batch review (index 3): a customer request arriving just after 4pm must wait roughly 24 hours for approval",
      "consequence": "The design as built cannot meet the stated 60-second SLA for any refund that passes through this gate, undermining the customer-facing commitment",
      "handling": "Architecture summary explicitly surfaces this as unresolved rather than resolving it silently; the design implements the batch-gated version and leaves the SLA conflict unresolved for the business to settle"
    },
    {
      "component": "3PL warehouse system",
      "scenario": "An order's return appears in the CSV on the same day finance is meant to review it, but after the file has already been ingested by Return Confirmation Check for that cycle",
      "consequence": "A legitimately return-confirmed refund is delayed an extra day because the day's CSV pull already completed before the update appeared",
      "handling": "Not addressed in the current failure_handling; the component only distinguishes confirmed/not-yet-confirmed per file, with no described intra-day re-check"
    }
  ],
  "practices": [
    {
      "applies_to": "Refund Execution",
      "practice": "Idempotent refund execution keyed on the order id (or refund request id) before calling Stripe",
      "rationale": "The approved-but-not-executed failure state described for this component means a retry after a failed Stripe call could otherwise trigger a duplicate refund against the same order"
    },
    {
      "applies_to": "Finance Approval Queue",
      "practice": "Maintain an explicit, timestamped audit record of every approval or rejection decision, tied to the order id and refund amount",
      "rationale": "Finance approval is stated as 'a hard auditor control requirement', so the queue's decisions need to be traceable for audit purposes, not just used to gate execution"
    },
    {
      "applies_to": "Return Confirmation Check",
      "practice": "Reconciliation pass comparing outstanding held refunds against each new day's 3PL CSV, with an escalation after a defined number of days with no confirmation",
      "rationale": "The component currently holds unconfirmed refunds over 'to the next day's file' with no stated limit, which could leave a return unconfirmed indefinitely given only daily CSV delivery"
    }
  ]
}
```

### Platform recommendation

```json
{
  "criteria_applied": [
    {
      "criterion": "Volume is low (about 200 refunds a week, average £45, occasionally up to £2,000), which does not require a high-throughput or enterprise-grade execution engine",
      "context_index": 4,
      "component": null
    },
    {
      "criterion": "The process must integrate Shopify (order verification), Stripe (refund execution), Zendesk (request intake) and a daily CSV file from a 3PL, so the platform must support connectors or APIs to all four plus file parsing",
      "context_index": null,
      "component": "Order Verification"
    },
    {
      "criterion": "Finance review happens on a fixed daily batch schedule at 4pm, so the platform needs reliable time-based triggering rather than pure real-time event handling",
      "context_index": 3,
      "component": "Finance Approval Queue"
    },
    {
      "criterion": "A hard auditor control requires a human finance team member to approve every refund before money moves, so the platform must support a genuine human-in-the-loop approval step, not just automated branching",
      "context_index": 1,
      "component": "Finance Approval Queue"
    },
    {
      "criterion": "Refund execution failures must not silently drop refunds; approved-but-unexecuted refunds require retry or manual follow-up, so the platform needs error handling and state-holding capability",
      "context_index": null,
      "component": "Refund Execution"
    },
    {
      "criterion": "Return status must be held as unconfirmed until it appears in a 3PL CSV, requiring the platform to persist state across daily cycles rather than treating each run as stateless",
      "context_index": 8,
      "component": "Return Confirmation Check"
    }
  ],
  "recommended_platform": "Make (Integromat)",
  "also_required": [],
  "rationale": "The architecture's demands are: moderate low-volume integration across four systems (Shopify, Stripe, Zendesk, a CSV-delivered 3PL feed), a fixed daily batch trigger, a mandatory human approval step, and simple retry/hold-over state between runs. A general-purpose no-code/low-code iPaaS with native connectors to Shopify, Stripe and Zendesk, CSV/file-handling modules, scheduled triggers, and a built-in data store for holding queued and unconfirmed items fits this pattern without requiring custom backend development. The context states no budget figure and does not describe any in-house development capability, so this recommendation rests on process shape, not on cost or team fit, which remain unresolved.",
  "alternatives_rejected": [
    {
      "platform": "Zapier",
      "rejection_reason": "Handles the four-system connectors and scheduling adequately, but its native support for persistent multi-day state (holding a refund as 'unconfirmed' until it appears in a later day's CSV) and complex conditional holdover logic is weaker than platforms with a dedicated data-store construct, making the Return Confirmation Check and Finance Approval Queue harder to implement cleanly."
    },
    {
      "platform": "n8n",
      "rejection_reason": "Capable of the same integrations and more flexible logic, including self-hosting, but self-hosting and workflow authoring in n8n typically assumes some in-house technical capability to build, host and maintain it, and the context states nothing about who would operate or maintain such a platform, so this cannot be assumed."
    },
    {
      "platform": "An enterprise iPaaS (e.g. Workato-class platform)",
      "rejection_reason": "Would cover all the integration and approval requirements, but its typical scale and governance features are built for volumes and organisational complexity well beyond the roughly 200 refunds a week stated here, and no budget is stated that would justify that tier."
    }
  ],
  "fit": [
    {
      "component": "Refund Request Intake",
      "how": "Native Zendesk trigger/connector captures new support tickets matching refund requests and extracts order id, customer and amount into a structured record."
    },
    {
      "component": "Order Verification",
      "how": "Native Shopify connector looks up the order by id and checks the requested amount against order data before proceeding."
    },
    {
      "component": "Return Confirmation Check",
      "how": "A scheduled or file-watch module ingests the daily 3PL CSV, and the platform's data store persists 'unconfirmed' status for orders not yet present, checking again on each new day's file."
    },
    {
      "component": "Finance Approval Queue",
      "how": "Queued refund records are held in the platform's data store; a scheduled trigger fires at 4pm to present pending items to a finance team member via an approval interface (e.g. an embedded form or connected app), and their decision is recorded before anything proceeds."
    },
    {
      "component": "Refund Execution",
      "how": "Approved records trigger the native Stripe connector to issue the refund; on API failure the platform's built-in retry/error paths keep the record in an approved-but-unexecuted state pending manual follow-up."
    },
    {
      "component": "Customer Notification",
      "how": "On Stripe confirmation, an email module sends the customer notification; a failed send is logged in the data store for manual follow-up since no alternate channel is described."
    }
  ],
  "knowledge_currency_note": "Platform capabilities, connector coverage, data-store limits and pricing for Make, Zapier, n8n and enterprise iPaaS platforms change over time; the specific fit claims made here (e.g. native data-store persistence, approval-step support, CSV handling) should be verified against each platform's current documentation before committing, since this analysis does not have confirmed up-to-date specifications for any of them."
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

