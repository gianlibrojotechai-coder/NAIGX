# Review packet RP-2fa7c3e3

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
Gift Aid claiming and donation reconciliation

We're a registered charity, about 40 staff, income around £6m a year. Roughly £2.1m
of that is individual giving and that's where the problem is.

Donations come in through four channels: JustGiving, our own website (Stripe),
standing orders straight into our bank (Lloyds), and cheques or cash at events. Our
CRM is Salesforce NPSP.

Two jobs run in parallel and both are manual.

Reconciliation. Someone downloads the JustGiving report and the Stripe payouts,
exports the bank statement, and matches everything against donor records in
Salesforce. Standing orders are the painful ones - the bank reference is often just
a surname, sometimes an old reference from before someone changed banks, and about
8% can't be matched without someone phoning the donor. Last month there were 340
unmatched transactions out of about 4,100.

Gift Aid. HMRC lets us claim 25p per pound on donations from UK taxpayers who've
given a declaration. We hold declarations in Salesforce but they were migrated from
a previous system in 2019 and we know some are missing or unsigned. Someone builds
the claim spreadsheet quarterly, checks each donation has a valid declaration and
the donor address matches what's on the declaration, and submits through HMRC's
Charities Online. The last claim took eleven days of one person's time and we think
we're under-claiming because anything doubtful gets dropped rather than chased.

What we want. The reconciliation matched automatically where it can be, with a
worklist for the exceptions rather than a full manual pass. And Gift Aid eligibility
determined continuously rather than in a quarterly scramble, so we can see what's
claimable and what's blocked by a missing declaration while there's still time to
ask the donor.

Constraints. We're a charity so cost matters - we'd struggle to justify more than
about £6,000 a year in tooling to our trustees. HMRC's Charities Online has no API
for claim submission that we're aware of, so the final submission may have to stay
manual. Donor data is obviously sensitive and we're subject to UK GDPR and the
Fundraising Regulator's code.
```

*2152 characters.*

---

## 2 · What the system produced

*10 stage(s) recorded: Classification → Intent → Context extraction → Architecture analysis → Complexity assessment → Implementation roadmap → Edge cases and practices → Risk register → Platform recommendation → Integration requirements.*

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
    "business_requirement",
    "existing_workflow"
  ],
  "dominant_type": null
}
```

### Intent

```json
{
  "primary_objective": {
    "content": "Automate donation reconciliation across four channels (JustGiving, Stripe, Lloyds bank, cash/cheques) so matching happens automatically where possible, with a worklist for exceptions instead of a full manual pass, and determine Gift Aid eligibility continuously rather than in a quarterly scramble so claimable/blocked donations are visible while there's still time to chase missing declarations",
    "provenance": "stated"
  },
  "secondary_objectives": [
    {
      "content": "Reduce the ~8% of standing order transactions that currently require phoning the donor to match",
      "provenance": "stated"
    },
    {
      "content": "Reduce under-claiming of Gift Aid caused by doubtful cases being dropped rather than chased",
      "provenance": "stated"
    },
    {
      "content": "Cut the eleven days of manual staff time currently spent building the quarterly Gift Aid claim spreadsheet",
      "provenance": "stated"
    },
    {
      "content": "Keep total tooling cost within roughly £6,000 a year",
      "provenance": "stated"
    },
    {
      "content": "Maintain compliance with UK GDPR and the Fundraising Regulator's code given sensitive donor data",
      "provenance": "stated"
    },
    {
      "content": "Retain a manual step for final HMRC Charities Online claim submission since no API is known to exist",
      "provenance": "stated"
    }
  ],
  "inferred_scope": "The individual giving income stream (~£2.1m of £6m total) at a ~40-staff UK charity, covering donation reconciliation across JustGiving, Stripe, Lloyds bank standing orders, and cash/cheque events, plus Gift Aid eligibility determination and claim preparation, all centred on the existing Salesforce NPSP CRM; final HMRC submission process is explicitly out of automation scope pending API availability."
}
```

### Context extraction

```json
{
  "elements": [
    {
      "id": "e1",
      "content": "Registered charity, about 40 staff, income around £6m a year",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "about 40 staff, income around £6m a year",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e2",
      "content": "Individual giving is roughly £2.1m of total income and is the problem area",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "Roughly £2.1m\nof that is individual giving and that's where the problem is.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e3",
      "content": "Donations come through four channels: JustGiving, Stripe (own website), Lloyds bank standing orders, and cash/cheques at events",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.95,
      "source_quote": "Donations come in through four channels: JustGiving, our own website (Stripe),\nstanding orders straight into our bank (Lloyds), and cheques or cash at events.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e4",
      "content": "CRM in use is Salesforce NPSP",
      "category": "system",
      "provenance": "stated",
      "specificity_score": 1,
      "source_quote": "Our\nCRM is Salesforce NPSP.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e5",
      "content": "Reconciliation is currently manual: someone downloads JustGiving report, Stripe payouts, exports bank statement, and matches against Salesforce donor records",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "Someone downloads the JustGiving report and the Stripe payouts,\nexports the bank statement, and matches everything against donor records in\nSalesforce.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e6",
      "content": "Standing order bank references are often just a surname or outdated, causing matching difficulty",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.85,
      "source_quote": "the bank reference is often just\na surname, sometimes an old reference from before someone changed banks",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e7",
      "content": "About 8% of transactions can't be matched without phoning the donor",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "about\n8% can't be matched without someone phoning the donor.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e8",
      "content": "Last month there were 340 unmatched transactions out of about 4,100",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 1,
      "source_quote": "Last month there were 340\nunmatched transactions out of about 4,100.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e9",
      "content": "HMRC allows claiming 25p per pound for UK taxpayer donations with a valid declaration",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "HMRC lets us claim 25p per pound on donations from UK taxpayers who've\ngiven a declaration.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e10",
      "content": "Declarations held in Salesforce were migrated from a previous system in 2019, and some are known to be missing or unsigned",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.85,
      "source_quote": "We hold declarations in Salesforce but they were migrated from\na previous system in 2019 and we know some are missing or unsigned.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e11",
      "content": "Gift Aid claim spreadsheet is built quarterly, checking each donation for valid declaration and matching donor address",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.85,
      "source_quote": "Someone builds\nthe claim spreadsheet quarterly, checks each donation has a valid declaration and\nthe donor address matches what's on the declaration, and submits through HMRC's\nCharities Online.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e12",
      "content": "Last claim took eleven days of one person's time",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 1,
      "source_quote": "The last claim took eleven days of one person's time",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e13",
      "content": "Belief that charity is under-claiming Gift Aid because doubtful cases are dropped rather than chased",
      "category": "objective",
      "provenance": "stated",
      "specificity_score": 0.6,
      "source_quote": "we think\nwe're under-claiming because anything doubtful gets dropped rather than chased.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e14",
      "content": "Desire for reconciliation to be matched automatically where possible, with a worklist for exceptions rather than full manual pass",
      "category": "objective",
      "provenance": "stated",
      "specificity_score": 0.8,
      "source_quote": "The reconciliation matched automatically where it can be, with a\nworklist for the exceptions rather than a full manual pass.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e15",
      "content": "Desire for Gift Aid eligibility to be determined continuously rather than quarterly, so claimable/blocked status is visible in time to chase donors",
      "category": "objective",
      "provenance": "stated",
      "specificity_score": 0.8,
      "source_quote": "Gift Aid eligibility\ndetermined continuously rather than in a quarterly scramble, so we can see what's\nclaimable and what's blocked by a missing declaration while there's still time to\nask the donor.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e16",
      "content": "Tooling budget constraint of about £6,000 a year, justified to trustees",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.95,
      "source_quote": "we'd struggle to justify more than\nabout £6,000 a year in tooling to our trustees.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e17",
      "content": "HMRC's Charities Online has no known API for claim submission, so final submission may have to remain manual",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "HMRC's Charities Online has no API for claim submission that we're aware of, so the final submission may have to stay\nmanual.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e18",
      "content": "Donor data is sensitive and subject to UK GDPR and the Fundraising Regulator's code",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.85,
      "source_quote": "Donor data is obviously sensitive and we're subject to UK GDPR and the\nFundraising Regulator's code.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e19",
      "content": "No developers or technical staff are mentioned; who would build/operate an automation is not stated",
      "category": "environment",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Does the charity have any in-house technical/development capability, or would this rely entirely on off-the-shelf/no-code tooling and vendor support?",
      "conflicts_with_id": null
    },
    {
      "id": "e20",
      "content": "No detail on what data formats/APIs are available from JustGiving, Stripe, and Lloyds for extracting transaction data programmatically",
      "category": "dependency",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Do JustGiving, Stripe, and Lloyds provide APIs or automated export/feed mechanisms suitable for integration, or are current downloads manual-only?",
      "conflicts_with_id": null
    },
    {
      "id": "e21",
      "content": "No detail on how cash/cheque donations at events are currently recorded before reconciliation",
      "category": "environment",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "How are cash/cheque donations captured and entered into Salesforce today - manually, via a form, or some other process?",
      "conflicts_with_id": null
    },
    {
      "id": "e22",
      "content": "Existing tooling budget of £6,000/year is a hard annual limit that must accommodate any new automation platform",
      "category": "constraint",
      "provenance": "inferred",
      "specificity_score": 0.6,
      "source_quote": null,
      "inference_basis": "The input states a specific budget ceiling for tooling that trustees would accept, implying any solution design must fit within this recurring cost.",
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e23",
      "content": "No information on whether Salesforce NPSP has existing automation capability (e.g., Flow, Apex) already licensed that could be leveraged",
      "category": "system",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What Salesforce edition/licence level is in use, and does it include automation tools like Flow, Apex triggers, or paid AppExchange matching tools?",
      "conflicts_with_id": null
    }
  ],
  "sufficiency": "sufficient"
}
```

### Architecture analysis

```json
{
  "summary": "The design automates donation reconciliation across four income channels (JustGiving, Stripe, Lloyds bank standing orders, and cash/cheque events) into Salesforce NPSP, routing unmatched transactions to a human worklist instead of a full manual pass, and layers a continuous Gift Aid eligibility engine on top so claimable and blocked donations are visible year-round rather than discovered in a quarterly scramble. Final HMRC Charities Online submission remains a manual step because no API is known to exist. The design is constrained by a roughly £6,000/year tooling budget and UK GDPR / Fundraising Regulator obligations around donor data, and several integration and capability unknowns are left unresolved pending further information.",
  "data_flow_description": "Transaction data enters from four sources: JustGiving reports, Stripe payouts, Lloyds bank statement exports, and cash/cheque records from events. Each source feeds a channel-specific ingestion step that normalises the transaction into a common format. The normalised records pass to a matching engine that attempts to pair each transaction against existing Salesforce NPSP donor records; matches update donor giving history directly, while unmatched transactions (including the standing orders with weak references) are pushed to an exception worklist for staff review and manual resolution, closing the loop by writing resolved matches back to Salesforce. In parallel, every donation reaching Salesforce (matched or manually resolved) is evaluated continuously by a Gift Aid eligibility component that checks for a valid, signed declaration and consistent donor address, tagging each donation claimable, blocked, or needing-declaration-chase. Blocked/doubtful records feed a donor-chase list so missing declarations can be pursued while still actionable. At claim time, a claim-preparation component compiles the tagged claimable donations into the HMRC Charities Online format, which a staff member manually reviews and submits, since no submission API exists.",
  "components": [
    {
      "name": "Channel Ingestion (JustGiving)",
      "responsibility": "Retrieve JustGiving donation report data and normalise it into a common transaction record",
      "inputs": "JustGiving downloadable report data",
      "outputs": "Normalised transaction records",
      "failure_handling": "If retrieval fails or format is unexpected, ingestion halts for that batch and the run is flagged for manual review rather than silently dropping records",
      "external_system": "JustGiving",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        2,
        4
      ]
    },
    {
      "name": "Channel Ingestion (Stripe)",
      "responsibility": "Retrieve Stripe payout data and normalise it into a common transaction record",
      "inputs": "Stripe payout data",
      "outputs": "Normalised transaction records",
      "failure_handling": "If retrieval fails, the affected payout period is flagged for manual re-check rather than assumed complete",
      "external_system": "Stripe",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        2,
        4
      ]
    },
    {
      "name": "Channel Ingestion (Lloyds Bank)",
      "responsibility": "Retrieve Lloyds bank statement export data (including standing orders) and normalise it into a common transaction record",
      "inputs": "Lloyds bank statement export",
      "outputs": "Normalised transaction records, including weak/partial references (e.g. surname-only)",
      "failure_handling": "If the export format changes or import fails, the batch is held and flagged rather than partially processed",
      "external_system": "Lloyds Bank",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        2,
        4,
        5
      ]
    },
    {
      "name": "Cash/Cheque Intake",
      "responsibility": "Capture cash and cheque donation records from events into the common transaction format",
      "inputs": "Event-recorded cash/cheque donation data",
      "outputs": "Normalised transaction records",
      "failure_handling": "Undetermined pending clarification of how these donations are currently captured; design leaves this step generic until that is known",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        2,
        20
      ]
    },
    {
      "name": "Donation Matching Engine",
      "responsibility": "Match normalised transaction records against existing Salesforce NPSP donor records automatically where possible",
      "inputs": "Normalised transaction records from all four channels, existing Salesforce donor records",
      "outputs": "Matched donation updates written to Salesforce; unmatched transactions passed to the exception worklist",
      "failure_handling": "A transaction that cannot be confidently matched is never force-matched; it is routed to the exception worklist rather than guessed",
      "external_system": "Salesforce NPSP",
      "integration_direction": "bidirectional",
      "grounded_in_context_indices": [
        3,
        4,
        5,
        6,
        7,
        13
      ]
    },
    {
      "name": "Exception Worklist",
      "responsibility": "Present unmatched transactions to staff for manual resolution instead of requiring a full manual reconciliation pass",
      "inputs": "Unmatched transactions from the matching engine",
      "outputs": "Staff-resolved matches written back to Salesforce",
      "failure_handling": "If a worklist item is not resolved, it remains open and visible rather than being lost, preserving the current fallback of phoning the donor",
      "external_system": "Salesforce NPSP",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        6,
        7,
        13
      ]
    },
    {
      "name": "Gift Aid Eligibility Engine",
      "responsibility": "Continuously evaluate each donation in Salesforce for Gift Aid eligibility based on declaration validity and donor address match",
      "inputs": "Donation records and donor declaration/address data from Salesforce",
      "outputs": "Claimable/blocked/needs-chase status tags on donation records",
      "failure_handling": "A donation with ambiguous or incomplete declaration data is tagged needs-chase rather than silently excluded, addressing the current under-claiming problem",
      "external_system": "Salesforce NPSP",
      "integration_direction": "bidirectional",
      "grounded_in_context_indices": [
        8,
        9,
        12,
        14
      ]
    },
    {
      "name": "Declaration Chase List",
      "responsibility": "Surface donations tagged needs-chase so staff can pursue missing or unsigned declarations while there is time to act",
      "inputs": "Needs-chase tagged donations from the Gift Aid Eligibility Engine",
      "outputs": "Prioritised chase list for staff outreach",
      "failure_handling": "Items not chased within a claim cycle remain visible on the list rather than dropping out silently",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        9,
        12,
        14
      ]
    },
    {
      "name": "Gift Aid Claim Preparation",
      "responsibility": "Compile all donations tagged claimable into the format required for HMRC Charities Online claim submission",
      "inputs": "Claimable-tagged donation records from Salesforce",
      "outputs": "A compiled claim file/report ready for manual review",
      "failure_handling": "If compilation fails or data looks inconsistent, the prior manual quarterly process remains the fallback until resolved",
      "external_system": "Salesforce NPSP",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        10,
        11,
        14
      ]
    },
    {
      "name": "Manual HMRC Submission",
      "responsibility": "Staff member reviews the compiled claim and submits it manually to HMRC Charities Online since no submission API exists",
      "inputs": "Compiled claim file from Gift Aid Claim Preparation",
      "outputs": "Submitted HMRC Gift Aid claim",
      "failure_handling": "Retained explicitly as a human step; any submission failure is handled by the staff member outside the automated system",
      "external_system": "HMRC Charities Online",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        16
      ]
    }
  ],
  "unknown_disposition": [
    {
      "context_index": 18,
      "disposition": "excluded",
      "statement": "The design does not specify who would build or operate the automation; this is left out of the architecture until the charity's in-house technical capability or reliance on vendor/no-code tooling is known."
    },
    {
      "context_index": 19,
      "disposition": "assumed",
      "statement": "The ingestion components assume JustGiving, Stripe, and Lloyds each provide some retrievable data (report, payout, or export) suitable for automated intake, consistent with current manual downloads; whether this can be automated via API versus remaining a manual download step is left open."
    },
    {
      "context_index": 20,
      "disposition": "excluded",
      "statement": "How cash/cheque donations are currently captured before reconciliation is not stated, so the Cash/Cheque Intake component is left generic and its concrete inputs/failure handling cannot be fully specified until this is known."
    },
    {
      "context_index": 22,
      "disposition": "excluded",
      "statement": "Whether Salesforce NPSP already has licensed automation capability (Flow, Apex, AppExchange matching tools) that could be reused is not addressed by the architecture; this would affect which components could be built natively in Salesforce versus requiring external tooling, and is left for further investigation."
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
      "score": 4,
      "justification": "Four distinct ingestion paths feed a matching engine with exception routing, plus a parallel continuous Gift Aid eligibility pipeline with its own chase-list branch and a separate quarterly-turned-continuous claim preparation and manual submission step. Multiple conditional paths (matched/unmatched, claimable/blocked/needs-chase) and human decision points across two coupled sub-processes push this above a moderate branching design."
    },
    {
      "factor": "integration",
      "score": 4,
      "justification": "The design integrates four heterogeneous external systems (JustGiving, Stripe, Lloyds bank exports, and cash/cheque event records) plus bidirectional Salesforce NPSP read/write, with no confirmed APIs for JustGiving/Stripe/Lloyds (context 19 unknown) and no API at all for HMRC Charities Online submission (context 16), forcing a manual endpoint. This heterogeneity and interface uncertainty sits close to the high end."
    },
    {
      "factor": "data_logic",
      "score": 4,
      "justification": "Normalisation differs per channel (context 2), matching must handle weak/outdated standing order references (context 5) with an 8% historical unmatched rate (context 6), and the Gift Aid engine applies declaration-validity and address-matching rules against data known to have migration gaps (context 9). This is denser than a moderate mapping problem, though not full multi-source reconciliation across many disparate schemas."
    },
    {
      "factor": "failure_risk",
      "score": 4,
      "justification": "Failure modes are numerous and consequential: mismatched donations affect donor records and financial reporting, incorrect Gift Aid tagging risks incorrect HMRC claims (context 8, 12), and unmatched/needs-chase items must never be silently dropped, requiring deliberate non-destructive handling at nearly every component. The manual HMRC submission step also depends on correct upstream compilation, raising the consequence of upstream errors."
    },
    {
      "factor": "operational",
      "score": 3,
      "justification": "Staff must actively work the exception worklist and declaration chase list (contexts 6,7,9,12) and manually review/submit HMRC claims periodically, but the design implies no continuous technical monitoring beyond routine business-as-usual attention, placing it at a periodic-attention midpoint rather than a high-maintenance system."
    }
  ]
}
```

### Implementation roadmap

```json
{
  "phases": [
    {
      "ordinal": 1,
      "name": "Multi-channel ingestion and normalisation",
      "objective": "Build the four channel-specific ingestion paths (JustGiving, Stripe, Lloyds, and cash/cheque events) that normalise raw transaction data into a common record format, since every downstream component depends on this common format existing first. This phase is where the unresolved unknown about JustGiving/Stripe/Lloyds API or export availability (context 19) must be tested in practice, and where the cash/cheque intake step is built generically pending clarification of how those donations are currently captured (context 20).",
      "components": [
        "Channel Ingestion (JustGiving)",
        "Channel Ingestion (Stripe)",
        "Channel Ingestion (Lloyds Bank)",
        "Cash/Cheque Intake"
      ],
      "depends_on": [],
      "outcome": "Transaction data from all four channels can be pulled or imported and converted into a single normalised record format, even if some channels still rely on manual download for now. No matching or reconciliation happens yet; this phase proves whether automated retrieval is feasible per channel before the matching engine is built on top of it.",
      "estimate": null
    },
    {
      "ordinal": 2,
      "name": "Automated reconciliation and exception handling",
      "objective": "Build the Donation Matching Engine to pair normalised transactions against Salesforce NPSP donor records, and the Exception Worklist to route unmatched transactions (including the weak-reference standing orders) to staff instead of a full manual pass, directly addressing the stated 8%/340-of-4,100 unmatched-transaction problem and the desire in context 13 for automatic matching with an exceptions worklist.",
      "components": [
        "Donation Matching Engine",
        "Exception Worklist"
      ],
      "depends_on": [
        1
      ],
      "outcome": "Transactions from all four channels are automatically matched against Salesforce donor records where possible; unmatched transactions appear on a worklist for staff to resolve, and resolved matches write back to Salesforce. The manual reconciliation process described in context 4 is replaced end to end.",
      "estimate": null
    },
    {
      "ordinal": 3,
      "name": "Continuous Gift Aid eligibility",
      "objective": "Build the Gift Aid Eligibility Engine and Declaration Chase List on top of the now-flowing, reconciled Salesforce donation records, replacing the quarterly spreadsheet check (context 10) with continuous claimable/blocked/needs-chase tagging and giving staff time to chase missing declarations (contexts 9, 12, 14) before a claim is due.",
      "components": [
        "Gift Aid Eligibility Engine",
        "Declaration Chase List"
      ],
      "depends_on": [
        2
      ],
      "outcome": "Every donation reaching Salesforce, matched automatically or resolved via the worklist, is continuously tagged claimable, blocked, or needs-chase. Staff can see and act on doubtful declarations year-round instead of discovering them at quarter-end, directly targeting the suspected under-claiming in context 12.",
      "estimate": null
    },
    {
      "ordinal": 4,
      "name": "Claim preparation and manual submission",
      "objective": "Build the Gift Aid Claim Preparation component to compile claimable-tagged donations into HMRC Charities Online claim format, retaining Manual HMRC Submission as a human step since no submission API exists (context 16), completing the design end to end.",
      "components": [
        "Gift Aid Claim Preparation",
        "Manual HMRC Submission"
      ],
      "depends_on": [
        3
      ],
      "outcome": "A claim file is compiled automatically from continuously-tagged claimable donations rather than built manually over eleven days each quarter (context 11); a staff member reviews and submits it to HMRC. At this point the full architecture exists: ingestion, matching, exception handling, continuous eligibility tagging, chase list, and claim preparation, with only final HMRC submission remaining manual by design.",
      "estimate": null
    }
  ],
  "sequencing_rationale": "Ingestion must come first because every other component consumes the normalised transaction records it produces, and because the input leaves open whether JustGiving, Stripe, and Lloyds even support automated retrieval (context 19) — this is the riskiest integration and must be proven before anything is built on top of it; cash/cheque intake is included here as a fourth ingestion path even though its current capture method is unresolved (context 20), since it belongs structurally with the other channels rather than as later hardening. Matching and the exception worklist come second because they need normalised records from all four channels to exist, and because they replace the manual reconciliation process (context 4) that is the most time-consuming current pain point (8% unmatched, 340 of 4,100 last month). Gift Aid eligibility comes third because it evaluates donations that are already in Salesforce as a result of matching or worklist resolution — building it earlier would mean evaluating incomplete or unreconciled donation data. Claim preparation and manual submission come last because they consume the claimable tags the eligibility engine produces, and because the manual submission step is a fixed constraint (context 16) rather than something to build toward; it is included in the phase that produces its input rather than a later 'hardening' phase, since the fallback belongs with the component it fails over from."
}
```

### Edge cases and practices

```json
{
  "edge_cases": [
    {
      "component": "Channel Ingestion (Lloyds Bank)",
      "scenario": "A standing order reference is just a surname shared by multiple donors, or is outdated and no longer matches any current donor record",
      "consequence": "The matching engine could either fail to match at all or, worse, match to the wrong donor, corrupting giving history and downstream Gift Aid eligibility for that donor",
      "handling": "The design routes weak/partial references to the exception worklist rather than force-matching (per the Donation Matching Engine's failure_handling), but the ingestion component itself does not distinguish 'ambiguous multiple candidates' from 'no candidate' - this distinction is not specified and should be added so ambiguous matches are flagged differently from no-match"
    },
    {
      "component": "Exception Worklist",
      "scenario": "Roughly 8% of transactions (340 of 4,100 last month) land on the worklist, and a donor who needs phoning never responds or the item is never actioned within the reconciliation cycle",
      "consequence": "The worklist grows unbounded month over month, donation records stay unmatched, and the charity's giving history and Gift Aid claimable base become permanently understated",
      "handling": "The current failure_handling keeps unresolved items open and visible rather than lost, but the design does not specify an ageing or escalation mechanism for items that persist across multiple cycles - this is unaddressed"
    },
    {
      "component": "Gift Aid Eligibility Engine",
      "scenario": "A donation belongs to a donor whose 2019-migrated declaration is known to be missing or unsigned, and the donor is never successfully chased for a new one",
      "consequence": "The donation remains tagged needs-chase indefinitely, which is functionally the same under-claiming problem the design was meant to fix, just relocated from a dropped quarterly line item to a stalled chase-list entry",
      "handling": "The Declaration Chase List keeps such items visible rather than dropping them (per its failure_handling), but no disposition is defined for what happens if a declaration is never obtained - whether the donation is permanently excluded from claims or re-evaluated periodically is unspecified"
    },
    {
      "component": "Cash/Cheque Intake",
      "scenario": "A cash donation collected at an event is entered into Salesforce both by an event staff volunteer at the time of collection and later by the reconciliation process, because how these donations are currently captured is unknown (context index 20, disposition excluded)",
      "consequence": "The same donation could be recorded twice, inflating both giving totals and the Gift Aid claimable base with a duplicate that would later need correcting",
      "handling": "The architecture explicitly leaves this component generic pending clarification of the current capture process; until that unknown is resolved, no de-duplication logic can be specified for cash/cheque donations"
    },
    {
      "component": "Gift Aid Claim Preparation",
      "scenario": "A donation is tagged claimable by the continuous Gift Aid Eligibility Engine, is included in a compiled claim file, but between compilation and the staff member's manual HMRC submission, new information (e.g. an address mismatch discovered) causes the underlying donation to become blocked",
      "consequence": "An ineligible donation could be submitted to HMRC as part of the claim, risking an incorrect Gift Aid claim to the tax authority",
      "handling": "The design does not specify a re-validation step immediately before manual submission; the claim-preparation component's failure_handling only covers compilation failures, not post-compilation status drift, so this gap is unaddressed"
    },
    {
      "component": "JustGiving",
      "scenario": "JustGiving's report data is not available via a stable automatable feed at the time the ingestion step runs, since whether an API or automated export exists is unresolved (context index 19, disposition assumed)",
      "consequence": "The Channel Ingestion (JustGiving) component cannot retrieve data automatically as designed, and the entire assumption underlying automated matching for that channel fails",
      "handling": "The component's failure_handling flags the run for manual review rather than dropping records, but this only mitigates the symptom - the design has not resolved whether ingestion can be automated at all for this source, which is a precondition left open"
    },
    {
      "component": "Donation Matching Engine",
      "scenario": "A single donor gift is reported through more than one channel record - for example a JustGiving-initiated donation that also appears as a Stripe payout line, or a Gift Aid top-up recorded separately from the base donation",
      "consequence": "The donation could be matched and written to Salesforce twice, double-counting income and overstating the Gift Aid claimable base",
      "handling": "No de-duplication across channels is described in the matching engine's responsibility or failure_handling; this cross-channel duplicate scenario is not covered by the current design"
    }
  ],
  "practices": [
    {
      "applies_to": "Donation Matching Engine",
      "practice": "Key all writes to Salesforce donation records on a stable transaction identifier (e.g. channel-specific transaction/payout ID) so a re-run of the matching engine after a failure does not create duplicate donation records",
      "rationale": "The matching engine writes matched updates directly to Salesforce and the ingestion components already anticipate re-checks after failed batches (per their failure_handling), so re-processing the same batch is a realistic occurrence that could otherwise duplicate donor giving history"
    },
    {
      "applies_to": "Gift Aid Eligibility Engine",
      "practice": "Maintain a timestamped audit trail of eligibility status changes (claimable/blocked/needs-chase) and declaration checks per donation",
      "rationale": "Donor data is subject to UK GDPR and the Fundraising Regulator's code (context index 17), and Gift Aid claims are subject to HMRC scrutiny, so an auditable record of why a donation was judged claimable or blocked is needed to justify each claim decision"
    },
    {
      "applies_to": "Exception Worklist",
      "practice": "Track age of each open worklist item and distinguish items open beyond a full reconciliation cycle from newly-raised items",
      "rationale": "The design's stated goal is to replace a full manual pass with an exception worklist, but with 340 of 4,100 transactions unmatched last month, an undifferentiated worklist risks becoming as burdensome as the manual process it replaces unless ageing items are visibly distinguished"
    }
  ]
}
```

### Risk register

```json
{
  "risks": [
    {
      "component": "Gift Aid Eligibility Engine",
      "description": "Declarations migrated from a 2019 system are known to be missing or unsigned; the eligibility engine relies on this Salesforce data to tag donations claimable/blocked, so donations with silently incomplete migrated declarations may be mis-tagged rather than routed to chase, perpetuating the under-claiming problem the design was meant to fix.",
      "severity": 4,
      "likelihood": 4,
      "mitigation": "Run a one-off data-quality audit of migrated 2019 declarations before go-live, and configure the engine to treat any declaration record lacking a clear signed/valid flag as needs-chase by default rather than assuming validity."
    },
    {
      "component": "Channel Ingestion (JustGiving)",
      "description": "The design assumes JustGiving, Stripe and Lloyds each expose data suitable for automated retrieval, but no API or automated export detail is confirmed for any of them; if one or more only support manual downloads, the corresponding ingestion component cannot function as designed and reconciliation reverts to the current manual process for that channel.",
      "severity": 5,
      "likelihood": 3,
      "mitigation": "Confirm with each provider (or account manager) what automated export/API options exist before building the ingestion components, and design a manual-upload fallback path for any channel that turns out to be download-only."
    },
    {
      "component": "Channel Ingestion (Lloyds Bank)",
      "description": "Standing order bank references are often just a surname or outdated, and this already causes 8% (340 of 4,100 last month) of transactions to be unmatched; the matching engine and exception worklist will inherit this same volume of routine failures every cycle, not as a rare edge case but as a recurring operational load.",
      "severity": 3,
      "likelihood": 5,
      "mitigation": "Build fuzzy-matching rules combining amount, date, and historical donor payment patterns for standing orders, and separately run a donor communication asking standing-order givers to update payment references to include a donor ID."
    },
    {
      "component": "Cash/Cheque Intake",
      "description": "How cash/cheque donations are currently captured before reconciliation is unstated and left generic in the design; without a defined capture process this channel may not feed the matching engine or Gift Aid engine reliably, causing event donations to be reconciled late, incorrectly, or not at all.",
      "severity": 3,
      "likelihood": 4,
      "mitigation": "Define and document a standard event-donation capture process (e.g. a form or till record) that outputs directly into the common transaction format before treating this component as automatable."
    },
    {
      "component": "Donation Matching Engine",
      "description": "Whether Salesforce NPSP already has licensed automation capability (Flow, Apex, or AppExchange matching tools) is unknown; the matching engine may need to be built as a separate external platform integrating with Salesforce, which could exceed the roughly £6,000/year tooling budget once licensing and integration costs are counted.",
      "severity": 3,
      "likelihood": 3,
      "mitigation": "Confirm Salesforce edition and existing automation entitlements before selecting or costing an external matching platform, to avoid committing budget to capability Salesforce may already provide."
    },
    {
      "component": "Exception Worklist",
      "description": "With roughly 340 unmatched transactions in a single month and no stated resolution SLA in the design, the worklist could accumulate faster than staff can clear it, leaving donor records unreconciled for extended periods and undermining the goal of replacing a full manual pass with a manageable exception queue.",
      "severity": 3,
      "likelihood": 3,
      "mitigation": "Set an explicit resolution SLA (e.g. cleared within the reconciliation cycle) and track backlog size against available staff time, escalating to a named person if the queue grows beyond capacity."
    },
    {
      "component": "Gift Aid Claim Preparation",
      "description": "Donor data is sensitive under UK GDPR and the Fundraising Regulator's code, and this component compiles claimable donation and declaration data into a claim file that moves across components and is reviewed by staff; each additional handling point increases the exposure surface for a data protection incident.",
      "severity": 4,
      "likelihood": 2,
      "mitigation": "Restrict access to the compiled claim file to authorised staff only, encrypt it in transit and at rest, and confirm any external platform used for compilation has a data processing agreement consistent with UK GDPR."
    },
    {
      "component": "HMRC Charities Online",
      "description": "Final claim submission is retained as a manual step because no API is known to exist; despite automation upstream, a single staff member manually reviewing and submitting the compiled claim remains a point where transcription error or missed deadline can occur, with no automated check on the actual submission.",
      "severity": 3,
      "likelihood": 2,
      "mitigation": "Introduce a documented pre-submission checklist and a second-person sign-off on the compiled claim before manual submission to HMRC."
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
      "criterion": "Annual tooling budget of about £6,000 must accommodate any new platform",
      "context_index": 15,
      "component": null
    },
    {
      "criterion": "Salesforce NPSP must remain the system of record for donor and donation data",
      "context_index": 3,
      "component": null
    },
    {
      "criterion": "Donor data is sensitive and subject to UK GDPR and the Fundraising Regulator's code, so any platform handling it must support compliant data handling",
      "context_index": 17,
      "component": null
    },
    {
      "criterion": "Who would build and operate the automation (in-house technical capability vs no-code/vendor reliance) is unstated and materially affects which platforms are viable",
      "context_index": 18,
      "component": null
    },
    {
      "criterion": "Whether JustGiving, Stripe, and Lloyds expose APIs or automated export mechanisms is unknown and determines whether channel ingestion can be built on standard integration connectors or requires custom scraping/manual steps",
      "context_index": 19,
      "component": "Channel Ingestion (JustGiving)"
    },
    {
      "criterion": "Volume is moderate (~4,100 transactions/month, 340 unmatched) rather than enterprise-scale, suggesting a lighter-weight platform could suffice if integrations are confirmed feasible",
      "context_index": 7,
      "component": "Donation Matching Engine"
    },
    {
      "criterion": "Whether Salesforce NPSP already includes licensed automation tooling (Flow, Apex, AppExchange matching apps) is unknown, which affects whether native Salesforce automation could cover parts of the architecture without new platform spend",
      "context_index": 22,
      "component": "Gift Aid Eligibility Engine"
    },
    {
      "criterion": "Final HMRC Charities Online submission must remain a manual human step, so no platform needs to solve for that integration",
      "context_index": 16,
      "component": "Manual HMRC Submission"
    },
    {
      "criterion": "The design requires an exception worklist for human review rather than full automation, implying the platform must support human-in-the-loop task queues, not just straight-through processing",
      "context_index": 13,
      "component": "Exception Worklist"
    }
  ],
  "recommended_platform": null,
  "also_required": [],
  "rationale": "The architecture's components (channel ingestion, matching, Salesforce read/write, exception worklists, continuous Gift Aid tagging) could plausibly be built on several kinds of platform - a general-purpose low-code integration/automation tool, or native Salesforce automation (Flow/Apex) if already licensed, or some combination. But the context leaves three things unresolved that directly determine which of these is viable: (1) whether the charity has any in-house technical capability or would need a fully no-code, vendor-supported solution (context 18); (2) whether JustGiving, Stripe, and Lloyds actually expose APIs or automated export/feed mechanisms suitable for integration, as opposed to manual-download-only access (context 19); and (3) whether Salesforce NPSP already carries licensed automation capability (Flow, Apex, AppExchange matching apps) that could be leveraged at no extra tooling cost (context 22). Any platform choice made now would be built on invented assumptions about these points rather than what the context supports. The £6,000/year budget (context 15) and the requirement that Salesforce remain the system of record (context 3) narrow the field but do not by themselves select a single platform, since both a lightweight integration tool and a Salesforce-native build could in principle fit within them depending on how the unknowns resolve. The honest position is that a platform recommendation should follow, not precede, answers to those three questions.",
  "alternatives_rejected": [
    {
      "platform": "Custom-built bespoke integration (in-house or contracted code)",
      "rejection_reason": "No developers or technical staff are mentioned anywhere in the context (context 18), and the £6,000/year tooling budget (context 15) reads as a tooling/subscription figure rather than a development budget, making a custom build hard to justify or sustain without further information confirming technical capacity or a separate development budget."
    },
    {
      "platform": "A high-end enterprise integration/iPaaS platform with premium connector tiers",
      "rejection_reason": "The transaction volume stated (about 4,100 transactions/month, context 7) does not indicate enterprise-scale throughput, and the £6,000/year budget (context 15) is a constraint that enterprise-tier pricing would likely strain, though exact current pricing cannot be confirmed from this context and should be checked directly."
    }
  ],
  "fit": [
    {
      "component": "Channel Ingestion (JustGiving)",
      "how": "Platform fit cannot be assessed until it is known whether JustGiving offers an API/export feed (context 19) versus manual-download-only access, which determines whether this can be a standard connector or needs a different approach."
    },
    {
      "component": "Channel Ingestion (Stripe)",
      "how": "Same dependency as JustGiving ingestion: fit depends on confirmed Stripe API/export access (context 19), which is unknown."
    },
    {
      "component": "Channel Ingestion (Lloyds Bank)",
      "how": "Fit depends on whether Lloyds provides an automatable statement export or open banking feed (context 19); this is unstated, so no platform can be matched to this component yet."
    },
    {
      "component": "Cash/Cheque Intake",
      "how": "How these donations are currently captured is unknown (context 20), so no platform recommendation can be matched to this component until that process is described."
    },
    {
      "component": "Donation Matching Engine",
      "how": "Depends on both confirmed channel data access (context 19) and whether Salesforce NPSP's existing licence includes automation tooling (context 22) that could perform matching natively."
    },
    {
      "component": "Exception Worklist",
      "how": "Requires a platform or Salesforce feature supporting human task queues; whether this is native to the existing Salesforce licence (context 22) or needs an added tool is unresolved."
    },
    {
      "component": "Gift Aid Eligibility Engine",
      "how": "Could plausibly run as Salesforce-native automation if Flow/Apex capability is already licensed (context 22), but this is unconfirmed."
    },
    {
      "component": "Declaration Chase List",
      "how": "Same dependency as the Gift Aid Eligibility Engine on unresolved Salesforce automation capability (context 22)."
    },
    {
      "component": "Gift Aid Claim Preparation",
      "how": "Could be a Salesforce report/export or an integration-platform step; the choice depends on the same unresolved capability and integration questions (contexts 19, 22)."
    },
    {
      "component": "Manual HMRC Submission",
      "how": "This step is explicitly human and platform-independent (context 16); no platform recommendation is needed here regardless of how the other unknowns resolve."
    }
  ],
  "knowledge_currency_note": "No specific platform capabilities, connector availability, or pricing tiers have been asserted here as certain. Platform features, integration availability (including for JustGiving, Stripe, Lloyds, and Salesforce AppExchange tools), and pricing change over time; before committing to any platform, verify current capabilities and costs against that platform's own documentation."
}
```

### Integration requirements

```json
{
  "integrations": [
    {
      "system": "JustGiving",
      "component": "Channel Ingestion (JustGiving)",
      "purpose": "Retrieve donation report data from JustGiving so it can be normalised and matched against Salesforce donor records",
      "direction": "inbound",
      "capabilities_required": [
        "Read/export donation transaction reports for a given period",
        "Provide donor-identifying reference data sufficient for matching",
        "Stable transaction identifiers to support idempotent re-processing"
      ],
      "constraints": [
        {
          "constraint": "Currently accessed via a downloaded report rather than any confirmed programmatic feed",
          "provenance": "stated",
          "context_index": 4
        },
        {
          "constraint": "Where an API exists, JustGiving typically requires a registered application and API key/token for authenticated access",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether JustGiving offers an API or automated export/feed suitable for integration, or whether the report download must remain manual (per unresolved context item 19)",
        "Whether any API access is rate-limited or restricted by account/charity tier",
        "Whether historical or only recent transaction data is retrievable"
      ]
    },
    {
      "system": "Stripe",
      "component": "Channel Ingestion (Stripe)",
      "purpose": "Retrieve payout and transaction data from Stripe so it can be normalised and matched against Salesforce donor records",
      "direction": "inbound",
      "capabilities_required": [
        "Read payout and charge/transaction data",
        "List transactions with pagination for a given period",
        "Idempotent retrieval to avoid double-counting on re-run"
      ],
      "constraints": [
        {
          "constraint": "Currently accessed via downloaded payout data rather than any confirmed automated pull",
          "provenance": "stated",
          "context_index": 4
        },
        {
          "constraint": "Stripe's API is authenticated via API keys and enforces rate limits on requests (historically around 100 read operations per second in live mode, subject to change)",
          "provenance": "general_knowledge",
          "context_index": null
        },
        {
          "constraint": "Stripe list endpoints are cursor-paginated",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether payout/charge data includes sufficient donor-identifying information for automated matching",
        "Whether webhooks are enabled/available for this Stripe account to support event-driven ingestion rather than polling"
      ]
    },
    {
      "system": "Lloyds Bank",
      "component": "Channel Ingestion (Lloyds Bank)",
      "purpose": "Retrieve bank statement data, including standing order transactions, for reconciliation against Salesforce donor records",
      "direction": "inbound",
      "capabilities_required": [
        "Read bank statement transaction data for a given period",
        "Surface the transaction reference field as provided by the bank",
        "Handle weak or outdated reference data without failing the batch"
      ],
      "constraints": [
        {
          "constraint": "Standing order bank references are often just a surname or outdated, limiting what the feed can offer for matching",
          "provenance": "stated",
          "context_index": 5
        },
        {
          "constraint": "Currently accessed via an exported bank statement rather than a confirmed automated feed",
          "provenance": "stated",
          "context_index": 4
        },
        {
          "constraint": "Where Open Banking access is used instead of manual export, UK banks operate under PSD2 rules requiring regulated third-party provider status and periodic customer re-authentication (strong customer authentication)",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether Lloyds offers a direct API or Open Banking connection for this account type, or whether statement export must remain manual (per unresolved context item 19)",
        "Whether reference field content can be enriched or supplemented by the bank side at all"
      ]
    },
    {
      "system": "Salesforce NPSP",
      "component": "Donation Matching Engine",
      "purpose": "Read existing donor records to attempt automatic matching of incoming transactions, and write matched donation updates back",
      "direction": "bidirectional",
      "capabilities_required": [
        "Query donor and donation records (e.g. via SOQL)",
        "Create or update donation records with idempotent/upsert behaviour keyed on a stable external identifier",
        "Distinguish confidently matched from unmatched records so unmatched items can be routed to the exception worklist"
      ],
      "constraints": [
        {
          "constraint": "CRM in use is Salesforce NPSP, so all matching logic must operate against NPSP's donor/opportunity data model",
          "provenance": "stated",
          "context_index": 3
        },
        {
          "constraint": "Salesforce API access is governed by per-org API call limits that vary by edition and licence, and by per-transaction governor limits on bulk operations",
          "provenance": "general_knowledge",
          "context_index": null
        },
        {
          "constraint": "Salesforce API access requires OAuth-based authentication",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "What Salesforce edition/licence is in use and whether it includes sufficient API call allowance and automation tooling (Flow/Apex) for this volume, per unresolved context item 22",
        "Whether existing AppExchange matching tools are already licensed and could be reused instead of custom matching logic"
      ]
    },
    {
      "system": "Salesforce NPSP",
      "component": "Exception Worklist",
      "purpose": "Write staff-resolved matches for previously unmatched transactions back into donor records",
      "direction": "outbound",
      "capabilities_required": [
        "Create or update records representing resolved matches",
        "Support a queryable list/view of open exception items for staff to work through"
      ],
      "constraints": [
        {
          "constraint": "Salesforce API access is governed by per-org API call limits that vary by edition and licence",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether the current Salesforce licence supports a custom worklist object/view or would require additional licensing, per unresolved context item 22"
      ]
    },
    {
      "system": "Salesforce NPSP",
      "component": "Gift Aid Eligibility Engine",
      "purpose": "Read donation, declaration and address data to continuously evaluate Gift Aid eligibility, and write claimable/blocked/needs-chase status back to the record",
      "direction": "bidirectional",
      "capabilities_required": [
        "Read declaration status/signed date and donor address fields",
        "Write an eligibility status field on each donation record",
        "Run continuously or near-real-time (e.g. triggered on record change) rather than as a quarterly batch"
      ],
      "constraints": [
        {
          "constraint": "Declarations held in Salesforce were migrated from a previous system in 2019 and some are known to be missing or unsigned, limiting what the data can confirm",
          "provenance": "stated",
          "context_index": 9
        },
        {
          "constraint": "Continuous/real-time automation in Salesforce (Flow, Apex triggers) depends on edition and licence, which is not confirmed",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether the current Salesforce licence includes Flow/Apex or equivalent automation capability to run eligibility checks continuously, per unresolved context item 22",
        "Whether declaration and address fields are structured consistently enough across the 2019-migrated records to be machine-checked reliably"
      ]
    },
    {
      "system": "Salesforce NPSP",
      "component": "Gift Aid Claim Preparation",
      "purpose": "Read claimable-tagged donation records to compile the data required for an HMRC Gift Aid claim",
      "direction": "inbound",
      "capabilities_required": [
        "Query all donation records tagged claimable within a claim period",
        "Bulk export/read capability sufficient to compile a full claim file"
      ],
      "constraints": [
        {
          "constraint": "Salesforce bulk data extraction is subject to Bulk API batch size and job limits",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether the current Salesforce licence/API access supports the bulk extraction volumes needed without hitting daily API limits"
      ]
    },
    {
      "system": "HMRC Charities Online",
      "component": "Manual HMRC Submission",
      "purpose": "Submit the compiled Gift Aid claim to HMRC once staff have reviewed it",
      "direction": "outbound",
      "capabilities_required": [
        "A submission mechanism accepting the compiled claim data in HMRC's required format (manual entry/upload, since no API is known)"
      ],
      "constraints": [
        {
          "constraint": "HMRC's Charities Online has no known API for claim submission, so final submission may have to remain manual",
          "provenance": "stated",
          "context_index": 16
        }
      ],
      "uncertainties": [
        "Whether HMRC has introduced any programmatic submission channel since this was last checked",
        "Exact current file/format requirements for a Charities Online Gift Aid claim submission"
      ]
    }
  ],
  "no_integrations_statement": null,
  "knowledge_currency_note": "Platform capabilities, rate limits, licensing terms and pricing for JustGiving, Stripe, Lloyds Bank/Open Banking, Salesforce, and HMRC Charities Online change over time; every general_knowledge constraint and every capability listed here must be verified against each system's current documentation and the charity's actual account/licence tier before any of this is built."
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

- **Analysis identifier:** RP-2fa7c3e3
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

*Comparison candidates (same input type):* RP-07a977a3, RP-27f9fb58, RP-448236a4, RP-4bb087ba, RP-5c2b0a40, RP-ac291956, RP-d41a9d08, RP-e755dbdf. Name the one you used.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

### Overall

Per §3.5 an analysis passes only when all seven criteria pass. C-3 and C-6 are not assessable here, so this analysis cannot be recorded as a rubric pass.

- **Overall:** ` fail / not assessable `  (a pass is not reachable — see above)
- **Notes:**

> 

