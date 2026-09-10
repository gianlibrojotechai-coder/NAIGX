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

*10 stage(s) recorded: Classification → Intent → Context extraction → Architecture analysis → Complexity assessment → Implementation roadmap → Integration requirements → Edge cases and practices → Risk register → Platform recommendation.*

> **Reading the grounding.** Context elements are an ordered array. Where a
> later stage cites `grounded_in_context_indices`, those are **0-based**
> positions into that array — the first element is index 0. `C-1` is checked
> by following a cited index back to the element it names and to that
> element's own `provenance` and `source_quote`.

### Classification

```json
{
  "determined_type": "business_requirement",
  "confidence": 0.93,
  "candidate_types": [
    "existing_workflow"
  ],
  "dominant_type": null
}
```

### Intent

```json
{
  "primary_objective": {
    "content": "Automate reconciliation of donations across four channels with matching done automatically where possible and an exception worklist, and make Gift Aid eligibility determined continuously rather than in a quarterly manual process, to reduce manual effort and increase claimed Gift Aid",
    "provenance": "stated"
  },
  "secondary_objectives": [
    {
      "content": "Reduce the 8% (340 of ~4,100) unmatched standing order transactions that currently require phoning donors",
      "provenance": "stated"
    },
    {
      "content": "Reduce the eleven days of staff time spent building the quarterly Gift Aid claim spreadsheet",
      "provenance": "stated"
    },
    {
      "content": "Stop under-claiming Gift Aid caused by dropping doubtful cases instead of chasing missing declarations",
      "provenance": "stated"
    },
    {
      "content": "Keep tooling cost within roughly £6,000 a year",
      "provenance": "stated"
    },
    {
      "content": "Remain compliant with UK GDPR and the Fundraising Regulator's code when handling donor data",
      "provenance": "stated"
    }
  ],
  "inferred_scope": "The individual giving income stream (~£2.1m of £6m total) across four donation channels (JustGiving, Stripe via website, Lloyds standing orders, cheques/cash at events), reconciliation against Salesforce NPSP donor records, and Gift Aid eligibility determination and claim preparation up to HMRC Charities Online submission; excludes other income streams and does not extend to HR or staffing processes",
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
      "content": "Registered charity, ~40 staff, income around £6m/year",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 0.8,
      "source_quote": "about 40 staff, income around £6m a year",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e2",
      "content": "Individual giving is ~£2.1m of total income",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "Roughly £2.1m\nof that is individual giving",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e3",
      "content": "Four donation channels: JustGiving, Stripe (website), Lloyds standing orders, cheques/cash at events",
      "category": "system",
      "provenance": "stated",
      "specificity_score": 0.95,
      "source_quote": "Donations come in through four channels: JustGiving, our own website (Stripe),\nstanding orders straight into our bank (Lloyds), and cheques or cash at events.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e4",
      "content": "CRM is Salesforce NPSP",
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
      "content": "Reconciliation is currently fully manual, combining JustGiving report, Stripe payouts, bank statement and Salesforce matching",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.8,
      "source_quote": "Someone downloads the JustGiving report and the Stripe payouts,\nexports the bank statement, and matches everything against donor records in\nSalesforce.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e6",
      "content": "Standing order bank references are often unreliable (surname only, outdated)",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.8,
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
      "source_quote": "about\n8% can't be matched without someone phoning the donor",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e8",
      "content": "340 unmatched transactions out of ~4,100 last month",
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
      "content": "Gift Aid rate is 25p per pound for eligible UK taxpayer donations with declarations",
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
      "content": "Declarations held in Salesforce, migrated from a previous system in 2019, some known missing or unsigned",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.8,
      "source_quote": "We hold declarations in Salesforce but they were migrated from\na previous system in 2019 and we know some are missing or unsigned.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e11",
      "content": "Gift Aid claim built quarterly via spreadsheet, checked manually, submitted through HMRC Charities Online",
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
      "content": "Belief that Gift Aid is under-claimed because doubtful cases are dropped rather than chased",
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
      "content": "Desire for automatic matching with an exception worklist rather than full manual reconciliation",
      "category": "objective",
      "provenance": "stated",
      "specificity_score": 0.8,
      "source_quote": "The\nreconciliation matched automatically where it can be, with a\nworklist for the exceptions rather than a full manual pass.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e15",
      "content": "Desire for continuous Gift Aid eligibility determination instead of quarterly scramble",
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
      "content": "Tooling budget cap of about £6,000/year",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 1,
      "source_quote": "we'd struggle to justify more than\nabout £6,000 a year in tooling to our trustees",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e17",
      "content": "HMRC Charities Online has no known API for claim submission, so final submission may remain manual",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "HMRC's Charities Online has no API\nfor claim submission that we're aware of, so the final submission may have to stay\nmanual.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e18",
      "content": "Subject to UK GDPR and the Fundraising Regulator's code for donor data",
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
      "content": "No mention of in-house developer or technical staff capability for building/maintaining automation",
      "category": "environment",
      "provenance": "unknown",
      "specificity_score": 0.5,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Does the charity have any in-house technical/developer capacity, or would this need to be a no-code/low-code solution operated by non-technical staff?",
      "conflicts_with_id": null
    },
    {
      "id": "e20",
      "content": "No detail on volume/frequency of JustGiving, Stripe, and cheque/cash transactions individually (only aggregate ~4,100/month across all channels implied)",
      "category": "scale",
      "provenance": "unknown",
      "specificity_score": 0.4,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What is the per-channel transaction volume and frequency, especially for cheques/cash at events which likely require manual entry regardless of automation?",
      "conflicts_with_id": null
    },
    {
      "id": "e21",
      "content": "No detail on existing integration capability of Salesforce NPSP (APIs, existing middleware, custom fields for declarations)",
      "category": "dependency",
      "provenance": "unknown",
      "specificity_score": 0.5,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What integration options exist for Salesforce NPSP (native APIs, existing connectors) that any automation would need to use to read/write donor and declaration records?",
      "conflicts_with_id": null
    },
    {
      "id": "e22",
      "content": "No detail on how declaration validity is currently verified (rules for matching name/address) which affects what 'valid declaration' automation logic would need",
      "category": "dependency",
      "provenance": "unknown",
      "specificity_score": 0.4,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What are the exact rules HMRC/the charity use to determine a declaration is valid (e.g., address match tolerance, taxpayer status confirmation) that an automated eligibility engine would need to encode?",
      "conflicts_with_id": null
    },
    {
      "id": "e23",
      "content": "Cheques/cash at events likely cannot be reconciled via automated bank/API matching and require manual entry",
      "category": "dependency",
      "provenance": "inferred",
      "specificity_score": 0.5,
      "source_quote": null,
      "inference_basis": "Cheques and cash have no electronic transaction trail comparable to JustGiving, Stripe, or bank feeds, so matching them automatically is not supported by the input's description of channels.",
      "resolution_hint": null,
      "conflicts_with_id": null
    }
  ],
  "sufficiency": "thin"
}
```

### Architecture analysis

```json
{
  "summary": "The design automates reconciliation of individual-giving donations across JustGiving, Stripe, Lloyds standing orders and event cash/cheques against Salesforce NPSP, replacing manual matching with automatic matching plus an exception worklist, and replaces the quarterly Gift Aid spreadsheet process with continuous eligibility determination feeding a claim file for manual submission to HMRC Charities Online.",
  "data_flow_description": "Transaction data enters from JustGiving's export, Stripe's payout data and Lloyds bank statement lines via an ingestion layer, while cheque/cash entries are captured through a manual entry interface for events staff. All normalised transactions pass to a matching engine that attempts to pair each against Salesforce NPSP donor records; matches are written back to Salesforce, and non-matches are routed to an exception worklist for staff (and where needed donor phone) follow-up, with resolved exceptions fed back to the matching engine to update matching rules or donor records. In parallel, a Gift Aid eligibility engine continuously reads donation and declaration records from Salesforce to flag eligible donations and surface missing or unsigned declarations for chasing. Eligible, matched donations accumulate in a claim builder that compiles the periodic HMRC claim file, which staff review and submit manually through Charities Online since no submission API exists.",
  "components": [
    {
      "name": "Electronic Channel Ingestion",
      "responsibility": "Retrieve and normalise transaction data from JustGiving, Stripe and the Lloyds bank feed into a common transaction format",
      "inputs": "JustGiving export/report, Stripe payout data, Lloyds bank statement lines",
      "outputs": "Normalised transaction records ready for matching",
      "failure_handling": "If a channel feed is unavailable or malformed, ingestion for that channel is skipped and flagged for staff attention rather than blocking the other channels",
      "external_system": "JustGiving, Stripe, Lloyds Bank",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        2,
        4
      ]
    },
    {
      "name": "Manual Cash/Cheque Entry Interface",
      "responsibility": "Allow event staff to record cheque and cash donations that have no electronic transaction trail",
      "inputs": "Staff-entered donor and amount details from events",
      "outputs": "Transaction records in the common format for matching",
      "failure_handling": "If entry is incomplete, the record is held in a draft state pending staff completion rather than passed to matching",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        2,
        22
      ]
    },
    {
      "name": "Transaction Matching Engine",
      "responsibility": "Match normalised transactions from all channels against existing Salesforce NPSP donor and gift records",
      "inputs": "Normalised transaction records, Salesforce donor/gift records",
      "outputs": "Matched transactions written to Salesforce; unmatched transactions passed to the exception worklist",
      "failure_handling": "A transaction that cannot be matched with sufficient confidence is not forced into a match; it is routed to the exception worklist rather than silently misassigned",
      "external_system": "Salesforce NPSP",
      "integration_direction": "bidirectional",
      "grounded_in_context_indices": [
        4,
        5,
        13
      ]
    },
    {
      "name": "Exception Worklist",
      "responsibility": "Present unmatched or low-confidence transactions to staff for manual resolution, including cases needing donor phone contact",
      "inputs": "Unmatched transactions from the matching engine",
      "outputs": "Resolved matches or updated donor reference data fed back to the matching engine and Salesforce",
      "failure_handling": "Unresolved items remain visible on the worklist rather than being dropped, so aging exceptions stay tracked instead of disappearing",
      "external_system": "Salesforce NPSP",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        5,
        6,
        7,
        13
      ]
    },
    {
      "name": "Gift Aid Eligibility Engine",
      "responsibility": "Continuously determine Gift Aid eligibility for matched donations based on donor declarations held in Salesforce",
      "inputs": "Matched donation records, donor declaration status from Salesforce",
      "outputs": "Eligibility flags per donation; a list of donations blocked by missing or unsigned declarations",
      "failure_handling": "A donation with an ambiguous or unverifiable declaration is flagged for review rather than being marked eligible or silently excluded",
      "external_system": "Salesforce NPSP",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        8,
        9,
        12,
        14
      ]
    },
    {
      "name": "Declaration Chase Notifier",
      "responsibility": "Surface donations blocked by missing or unsigned declarations so staff can pursue them instead of dropping the case",
      "inputs": "Blocked-declaration list from the eligibility engine",
      "outputs": "Chase task list for staff follow-up with donors",
      "failure_handling": "If a chase task is not actioned within a review cycle it stays open on the list rather than being cleared automatically",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        9,
        12
      ]
    },
    {
      "name": "Gift Aid Claim Builder",
      "responsibility": "Compile eligible, matched donations into a claim file formatted for HMRC Charities Online submission",
      "inputs": "Eligibility-flagged donations from the eligibility engine",
      "outputs": "A periodic claim file for staff review and manual submission",
      "failure_handling": "If the compiled claim contains records failing basic completeness checks, those records are excluded from the file and listed separately rather than submitted incorrectly",
      "external_system": "HMRC Charities Online",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        10,
        11,
        16
      ]
    }
  ],
  "unknown_disposition": [
    {
      "context_index": 18,
      "disposition": "excluded",
      "statement": "The design does not assume any in-house development or ongoing technical maintenance capability; whether operation requires a no-code/low-code platform run by non-technical staff is left open until the charity's technical capacity is known."
    },
    {
      "context_index": 19,
      "disposition": "deferred",
      "statement": "Per-channel transaction volumes are not broken out, so the design accommodates either a small or large per-channel load without sizing the ingestion or worklist components to a specific per-channel figure; this would need per-channel counts to refine."
    },
    {
      "context_index": 20,
      "disposition": "excluded",
      "statement": "No detail on Salesforce NPSP's available APIs or existing middleware is given, so the specific integration mechanism between the matching/eligibility engines and Salesforce is left unspecified until that is known."
    },
    {
      "context_index": 21,
      "disposition": "excluded",
      "statement": "The exact rules for declaration validity (address matching, taxpayer status confirmation) are not stated, so the Gift Aid Eligibility Engine's matching logic is left as a placeholder eligibility check rather than a fully encoded rule set until those rules are supplied."
    }
  ],
  "trade_offs": [],
  "rejected_approaches": [],
  "automation_verdict": {
    "warranted": true,
    "statement": "Automation is warranted because the context states concrete recurring costs of the manual process (340 of ~4,100 unmatched transactions requiring phone calls monthly, and eleven staff-days per quarterly Gift Aid claim) and a stated belief that Gift Aid is under-claimed, all of which automatic matching, an exception worklist and continuous eligibility determination directly address."
  }
}
```

### Complexity assessment

```json
{
  "factors": [
    {
      "factor": "workflow",
      "score": 4,
      "justification": "The design has multiple parallel paths (electronic ingestion vs manual cash/cheque entry), a matching engine with exception routing and feedback loops back into matching, plus a separate continuous eligibility pipeline feeding a periodic claim builder — several interacting branches and a feedback loop rather than a simple linear or single-branch flow."
    },
    {
      "factor": "integration",
      "score": 4,
      "justification": "The architecture must connect to four heterogeneous donation channels (JustGiving, Stripe, Lloyds bank feed, manual cash/cheque), Salesforce NPSP bidirectionally, and HMRC Charities Online which has no submission API, forcing a manual step; this is many systems of varying interface quality, close to but not quite the most severe anchor since Salesforce and Stripe are conventional APIs."
    },
    {
      "factor": "data_logic",
      "score": 4,
      "justification": "Matching logic must reconcile unreliable standing order references (surname-only, outdated) and cross-channel transaction formats, while the Gift Aid engine applies declaration-validity and eligibility rules against incomplete/migrated 2019 declaration data; this is dense rule application and reconciliation across sources, though the exact eligibility rules remain unspecified (context 21), limiting confidence in full extent."
    },
    {
      "factor": "failure_risk",
      "score": 4,
      "justification": "About 8% of transactions (340 of ~4,100 last month) fail to match and require donor phone follow-up, incorrect Gift Aid claims carry regulatory consequence (HMRC submission, GDPR/Fundraising Regulator obligations per context 17), and the design explicitly guards against forced mismatches and incorrect claim inclusion — several consequential failure modes needing deliberate handling, though not extreme ordering/idempotency demands are stated."
    },
    {
      "factor": "operational",
      "score": 4,
      "justification": "The exception worklist and declaration chase list require ongoing staff triage (unresolved items persist and must be actively worked), and the claim builder still needs manual review and manual HMRC submission each cycle; this implies frequent recurring attention rather than unattended operation, though not necessarily specialist technical maintenance given the unknown in-house capability (context 18)."
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
      "name": "Transaction Capture Foundation",
      "objective": "Build the data-capture layer for all four donation channels: automated ingestion for JustGiving, Stripe and Lloyds, and a manual entry path for cheque/cash donations that have no electronic trail (context 22), producing a common normalised transaction format that later components will consume.",
      "components": [
        "Electronic Channel Ingestion",
        "Manual Cash/Cheque Entry Interface"
      ],
      "depends_on": [],
      "outcome": "Transactions from all four channels—including events cash/cheques—can be captured and normalised into a common record format, ready to be matched, though nothing is yet matched against Salesforce.",
      "estimate": null
    },
    {
      "ordinal": 2,
      "name": "Reconciliation via Matching and Exceptions",
      "objective": "Build the Transaction Matching Engine to pair normalised transactions against Salesforce NPSP donor/gift records, and the Exception Worklist to hold unmatched or low-confidence items (including the unreliable standing-order references and the ~8% needing donor phone contact) for staff resolution, replacing the fully manual reconciliation process.",
      "components": [
        "Transaction Matching Engine",
        "Exception Worklist"
      ],
      "depends_on": [
        1
      ],
      "outcome": "Donations from all channels are automatically matched against Salesforce where possible; unmatched or ambiguous transactions appear on a worklist for staff follow-up instead of requiring full manual reconciliation of every transaction.",
      "estimate": null
    },
    {
      "ordinal": 3,
      "name": "Continuous Gift Aid Eligibility",
      "objective": "Build the Gift Aid Eligibility Engine to continuously assess matched donations against Salesforce declaration records, and the Declaration Chase Notifier to surface donations blocked by missing or unsigned declarations so they can be pursued rather than dropped, replacing the quarterly scramble and addressing the belief that Gift Aid is under-claimed.",
      "components": [
        "Gift Aid Eligibility Engine",
        "Declaration Chase Notifier"
      ],
      "depends_on": [
        2
      ],
      "outcome": "Matched donations are continuously assessed for Gift Aid eligibility as they arrive, and donations blocked by missing or unsigned declarations are visible to staff for chasing, instead of being assessed only at quarterly claim time.",
      "estimate": null
    },
    {
      "ordinal": 4,
      "name": "Claim Compilation",
      "objective": "Build the Gift Aid Claim Builder to compile eligibility-flagged, matched donations into a periodic claim file for staff review and manual submission through HMRC Charities Online, since no submission API exists (context 16).",
      "components": [
        "Gift Aid Claim Builder"
      ],
      "depends_on": [
        3
      ],
      "outcome": "The whole design exists end to end: donations are captured across all channels, automatically matched with exceptions worked by staff, continuously assessed for Gift Aid eligibility with chasing of missing declarations, and compiled into a claim file that staff review and submit manually to HMRC.",
      "estimate": null
    }
  ],
  "sequencing_rationale": "Each later phase consumes the output of the one before it, so the order follows the data flow rather than a generic build sequence. The Matching Engine and Exception Worklist (phase 2) cannot operate until normalised transactions exist from all four channels, including the manual cheque/cash path that has no electronic trail (context 22) — so capture (phase 1) comes first, and its fallback for incomplete cheque/cash entries is built in that same phase rather than deferred. The Gift Aid Eligibility Engine (phase 3) operates on matched donations, so it depends on matching being in place; building it before matching existed would leave it with nothing reliable to assess, and the declaration-chasing objective (context 12, 14) only makes sense once eligibility determination is running. The Claim Builder (phase 4) is last because it consumes eligibility flags, and its manual-submission fallback (context 16) is built as part of this phase rather than a separate hardening step, since the absence of an HMRC API is a property of the claim-submission step itself. Matching against Salesforce (phase 2) is treated as the component with the most input-supported risk — unreliable standing-order references (context 5) and an 8% unmatched rate (context 6) are stated directly — so it is proven before the eligibility logic that depends on its output is built."
}
```

### Integration requirements

```json
{
  "integrations": [
    {
      "system": "JustGiving, Stripe, Lloyds Bank",
      "component": "Electronic Channel Ingestion",
      "purpose": "Retrieve transaction data from each electronic donation channel for normalisation and matching against Salesforce records",
      "direction": "inbound",
      "capabilities_required": [
        "Read/export donation transaction reports (JustGiving)",
        "Read payout and transaction data (Stripe)",
        "Read bank statement lines or transaction feed (Lloyds)",
        "Stable transaction identifiers across polls/exports to avoid duplicate ingestion"
      ],
      "constraints": [
        {
          "constraint": "Standing order bank references are often unreliable (surname only, outdated), limiting what can be matched from Lloyds data alone",
          "provenance": "stated",
          "context_index": 5
        },
        {
          "constraint": "JustGiving's public API/reporting is typically rate-limited and requires an authenticated charity account",
          "provenance": "general_knowledge",
          "context_index": null
        },
        {
          "constraint": "Stripe's API enforces rate limits and requires API-key based authentication; payout data is exposed via the Payouts/Balance Transactions endpoints",
          "provenance": "general_knowledge",
          "context_index": null
        },
        {
          "constraint": "Lloyds does not offer a general-purpose donor transaction API to third-party automations; bank data typically requires Open Banking access or manual statement export",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether JustGiving currently offers an API/export suitable for automated ingestion versus manual report download",
        "Whether the charity has Open Banking or another electronic feed for Lloyds, or relies on manual statement download",
        "Whether Stripe payout data includes sufficient donor-identifying metadata to support matching"
      ]
    },
    {
      "system": "Salesforce NPSP",
      "component": "Transaction Matching Engine",
      "purpose": "Match normalised transactions to donor and gift records in Salesforce and write back match results",
      "direction": "bidirectional",
      "capabilities_required": [
        "Read donor and gift records",
        "Write/update gift records to record matches",
        "Query/search capability to support fuzzy or reference-based matching",
        "Idempotent create/update to avoid duplicate gift records"
      ],
      "constraints": [
        {
          "constraint": "Standing order references are often surname-only or outdated, constraining what data is available for automated matching against Salesforce records",
          "provenance": "stated",
          "context_index": 5
        },
        {
          "constraint": "Salesforce API access (REST/Bulk) typically requires OAuth-based authentication and is subject to per-org daily API call limits based on licence/edition",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "What specific Salesforce APIs, connected apps, or existing middleware are already provisioned for this org (not stated in the input)",
        "Whether the NPSP edition/licence in use has sufficient API call allowance for near-real-time or frequent matching runs",
        "Whether custom fields exist to store match confidence or exception status"
      ]
    },
    {
      "system": "Salesforce NPSP",
      "component": "Exception Worklist",
      "purpose": "Feed resolved matches and updated donor reference data back into Salesforce records",
      "direction": "outbound",
      "capabilities_required": [
        "Write/update donor and gift records with resolved match data",
        "Ability to update donor reference fields (e.g., correcting standing order references)"
      ],
      "constraints": [
        {
          "constraint": "About 8% of transactions (340 of ~4,100 last month) require manual phone follow-up before they can be matched, which bounds the volume the worklist and any Salesforce writes must handle",
          "provenance": "stated",
          "context_index": 7
        },
        {
          "constraint": "Salesforce API access is subject to per-org daily API call limits based on licence/edition",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether the existing Salesforce configuration exposes fields needed to record exception resolution outcomes"
      ]
    },
    {
      "system": "Salesforce NPSP",
      "component": "Gift Aid Eligibility Engine",
      "purpose": "Read donation and declaration records to continuously determine Gift Aid eligibility and identify missing/unsigned declarations",
      "direction": "inbound",
      "capabilities_required": [
        "Read donation/gift records",
        "Read donor declaration records and their status/signed state",
        "Query capability to identify missing or unsigned declarations at scale"
      ],
      "constraints": [
        {
          "constraint": "Declarations were migrated from a previous system in 2019 and some are known missing or unsigned, which the read logic must be able to detect",
          "provenance": "stated",
          "context_index": 9
        },
        {
          "constraint": "Salesforce API access is subject to per-org daily API call limits based on licence/edition",
          "provenance": "general_knowledge",
          "context_index": null
        }
      ],
      "uncertainties": [
        "Whether declaration records are stored in a structured, queryable field/object suitable for automated eligibility checks, or in unstructured/legacy form from the 2019 migration",
        "The exact rules for what makes a declaration valid, which are not specified in the input"
      ]
    },
    {
      "system": "HMRC Charities Online",
      "component": "Gift Aid Claim Builder",
      "purpose": "Compile eligible, matched donations into a claim file for manual submission to HMRC",
      "direction": "outbound",
      "capabilities_required": [
        "Produce a claim file in the format required for Charities Online manual upload/submission",
        "No programmatic submission capability required, since none exists"
      ],
      "constraints": [
        {
          "constraint": "HMRC Charities Online has no known API for claim submission, so final submission may remain manual",
          "provenance": "stated",
          "context_index": 16
        },
        {
          "constraint": "Gift Aid claims must reflect the 25p per pound rate for eligible UK taxpayer donations with valid declarations",
          "provenance": "stated",
          "context_index": 8
        }
      ],
      "uncertainties": [
        "Whether HMRC has since introduced any programmatic submission channel not reflected in the input",
        "The exact file format/schema Charities Online currently requires for claim uploads"
      ]
    }
  ],
  "no_integrations_statement": null,
  "knowledge_currency_note": "Platform capabilities, rate limits, API availability and pricing for JustGiving, Stripe, Lloyds, Salesforce NPSP and HMRC Charities Online all change over time; every general_knowledge constraint and every capability listed here must be verified against each system's current documentation and the charity's actual account/licence tier before building."
}
```

### Edge cases and practices

```json
{
  "edge_cases": [
    {
      "component": "Electronic Channel Ingestion",
      "scenario": "The Lloyds bank feed carries a standing order line where the reference is only a surname and is outdated (per context index 5), so the ingestion layer cannot normalise it into a reliable donor key",
      "consequence": "The transaction enters matching with insufficient identifying data, increasing the pool of the roughly 8% of transactions that already can't be matched without phoning the donor",
      "handling": "Ingestion passes the record through with whatever reference exists; the Transaction Matching Engine's failure_handling routes it to the exception worklist rather than forcing a match"
    },
    {
      "component": "Manual Cash/Cheque Entry Interface",
      "scenario": "An events staff member enters a cheque donation with only a partial name and no amount confirmation before the event day ends",
      "consequence": "An incomplete record could be passed into matching and either misassigned to the wrong donor or block the Gift Aid eligibility engine from ever evaluating it",
      "handling": "The component's stated failure_handling holds the record in draft state pending completion rather than forwarding it to matching"
    },
    {
      "component": "Exception Worklist",
      "scenario": "340 of ~4,100 monthly transactions (8%) land on the worklist in a single month, per context indices 6 and 7",
      "consequence": "If the worklist has no aging or prioritisation, that volume can silently accumulate month over month, with older unmatched donations never resolved and Gift Aid eligibility for them never determined",
      "handling": "The design keeps unresolved items visible rather than dropping them, but does not specify a volume-based prioritisation; this is a gap since the stated 340/month figure implies a recurring, non-trivial backlog needing active triage, not just visibility"
    },
    {
      "component": "Gift Aid Eligibility Engine",
      "scenario": "A donor's declaration was migrated from the 2019 system and is known to be missing or unsigned (context index 9), yet the donation itself matches successfully in Salesforce",
      "consequence": "If eligibility defaults to 'ineligible' or is simply skipped, the donation is dropped from the claim exactly as described in the stated belief that Gift Aid is under-claimed (context index 12); if it defaults to 'eligible', the charity risks submitting an invalid HMRC claim",
      "handling": "The component's failure_handling flags ambiguous/unverifiable declarations for review rather than resolving the ambiguity automatically, feeding the Declaration Chase Notifier instead of silently deciding either way"
    },
    {
      "component": "Declaration Chase Notifier",
      "scenario": "A donor is chased for a missing declaration but never responds across multiple review cycles",
      "consequence": "The donation remains permanently blocked from Gift Aid, and the chase list grows indefinitely with stale entries, which was the same under-claiming problem the design was meant to fix (context index 12)",
      "handling": "The stated failure_handling keeps the task open rather than auto-clearing it, but the design does not state a resolution path (e.g. a threshold after which the case is marked permanently ineligible and removed from the active list) — this is unsettled by the input"
    },
    {
      "component": "Gift Aid Claim Builder",
      "scenario": "The claim builder compiles a periodic file, but donations continue to be matched and made eligible continuously between build cycles (per the stated desire for continuous eligibility determination, context index 14)",
      "consequence": "Donations that become eligible after a claim file is built but before the next HMRC submission could be missed from that claim cycle or, if included in two consecutive builds by mistake, submitted twice",
      "handling": "The design states a completeness check that excludes failing records from the file, but does not state a mechanism preventing a donation from appearing in more than one claim file; this is unaddressed by the given architecture"
    },
    {
      "component": "Transaction Matching Engine",
      "scenario": "Salesforce NPSP's actual API and write-back capability are unknown (context index 20, disposition excluded), yet the engine is specified as bidirectional with Salesforce",
      "consequence": "If the eventual integration mechanism cannot support the write-back volume or matching queries the engine needs, the whole matching step may not be implementable as designed",
      "handling": "The unknown is explicitly deferred in the architecture rather than assumed away; no handling is designed pending that information, which is the honest position given the input"
    },
    {
      "component": "HMRC Charities Online",
      "scenario": "The claim submission step has no known API (context index 16), so the manual submission step sits outside the automated chain entirely",
      "consequence": "Any error introduced between the claim builder's output and the manual submission (e.g. a stale export, a version mismatch) would not be caught by the automation and could result in an incorrect claim being filed",
      "handling": "The design routes the compiled file to staff for review before manual submission, but does not specify a check that the exact file reviewed is the exact file submitted"
    }
  ],
  "practices": [
    {
      "applies_to": "Transaction Matching Engine",
      "practice": "Match and write-back keyed on a stable transaction identifier per channel (e.g. JustGiving/Stripe transaction ID or bank statement line reference) rather than donor name alone",
      "rationale": "The stated unreliability of standing order references (surname only, outdated, context index 5) means name-based matching alone will misfire; a stable per-channel identifier reduces false matches without requiring new data the input doesn't promise exists"
    },
    {
      "applies_to": "Exception Worklist",
      "practice": "Track age of each unresolved item and surface a count/backlog view rather than a flat list",
      "rationale": "The stated monthly volume of 340 unmatched transactions (context index 7) is large enough that without visible aging, older cases are likely to be pushed down by newer ones and never phoned, reproducing the current manual problem in a new interface"
    },
    {
      "applies_to": "Gift Aid Claim Builder",
      "practice": "Check each donation against a record of donations already included in a prior submitted claim before adding it to a new claim file",
      "rationale": "Continuous eligibility determination (context index 14) replacing the quarterly batch process creates a real risk of the same donation being picked up across two build cycles, which the architecture does not otherwise prevent"
    },
    {
      "applies_to": "Declaration Chase Notifier",
      "practice": "Define an explicit maximum chase duration or attempt count after which a case is marked permanently ineligible and closed rather than left open indefinitely",
      "rationale": "The component's own failure_handling keeps tasks open with no closing condition, and the input's stated concern about under-claiming (context index 12) does not extend to an unbounded manual backlog, which an indefinite open list would create"
    }
  ]
}
```

### Risk register

```json
{
  "risks": [
    {
      "component": "Transaction Matching Engine",
      "description": "Standing order references from Lloyds are often surname-only or outdated, so even with automated matching a substantial share of standing order transactions (contributing to the stated 8% / 340 of 4,100 monthly transactions) will remain unmatched and require the same donor-phone follow-up the design was meant to reduce.",
      "severity": 3,
      "likelihood": 5,
      "mitigation": "Build reference-normalisation and fuzzy-matching heuristics for standing orders specifically, but keep the exception worklist sized for a persistent ~8% residual rate rather than assuming automation will eliminate it."
    },
    {
      "component": "Salesforce NPSP",
      "description": "The design's Transaction Matching Engine, Exception Worklist and Gift Aid Eligibility Engine all depend on bidirectional Salesforce integration, but the available APIs, custom fields and existing middleware for NPSP were not known and this unknown was excluded from the design rather than resolved; if NPSP's integration surface cannot support real-time read/write at the required frequency, the whole reconciliation and eligibility flow cannot be built as described.",
      "severity": 4,
      "likelihood": 3,
      "mitigation": "Confirm Salesforce NPSP's API/connector capability (REST API limits, custom field access for declarations) before committing to the matching and eligibility engine design; adjust the integration pattern if native APIs are insufficient."
    },
    {
      "component": "Gift Aid Eligibility Engine",
      "description": "The exact rules for declaration validity (e.g. address matching, taxpayer status confirmation) were not stated and this unknown was excluded from the design, so the eligibility engine's logic is a placeholder; if built without the real HMRC/charity rules it could mark donations eligible incorrectly or block eligible ones, directly affecting the accuracy of the HMRC claim.",
      "severity": 4,
      "likelihood": 3,
      "mitigation": "Obtain the charity's and HMRC's exact declaration-validity rules before encoding eligibility logic, and route ambiguous cases to manual review rather than an automatic determination in the interim."
    },
    {
      "component": "Gift Aid Eligibility Engine",
      "description": "Declarations were migrated from a previous system in 2019 and are known to be sometimes missing or unsigned; a continuous eligibility engine running against this data as-is will systematically block or mis-flag donations tied to those defective records, understating claimable Gift Aid in the same way the manual quarterly process does.",
      "severity": 3,
      "likelihood": 4,
      "mitigation": "Run a one-off audit and cleanup pass of migrated declaration records against the eligibility engine's requirements before enabling continuous determination, so historical data defects don't propagate into ongoing claims."
    },
    {
      "component": "Transaction Matching Engine",
      "description": "No in-house developer or technical staff capability was confirmed (this was left unresolved and excluded from the design), yet the matching engine, eligibility engine and worklist together require nontrivial integration and rule maintenance; if the charity has no technical capacity, no platform within the £6,000/year budget may be operable without ongoing external support that budget does not cover.",
      "severity": 4,
      "likelihood": 3,
      "mitigation": "Determine the charity's actual technical operating capacity before platform selection; if none exists, restrict candidate platforms to no-code/low-code tools operable by non-technical fundraising/finance staff, and confirm this fits the £6,000/year cap including any support costs."
    },
    {
      "component": "Exception Worklist",
      "description": "At the stated volume (340 unmatched of ~4,100 transactions last month), if staff capacity to resolve exceptions does not keep pace, the worklist accumulates aging unresolved items rather than the manual reconciliation backlog it was meant to replace, undermining the objective of moving from full manual matching to an exception-only process.",
      "severity": 3,
      "likelihood": 3,
      "mitigation": "Set an aging SLA on the worklist (e.g. items open beyond a defined period trigger escalation) and monitor monthly volume against the ~340/month baseline to flag when staffing needs to increase."
    },
    {
      "component": "Gift Aid Claim Builder",
      "description": "Because HMRC Charities Online has no known submission API, the claim builder still hands off a manual step to staff; if the compiled claim file's completeness checks are inadequate, the same risk of errors that occurred in the eleven-day manual quarterly process (built via spreadsheet) can recur at the final, unautomated submission stage.",
      "severity": 3,
      "likelihood": 3,
      "mitigation": "Require staff sign-off against a defined completeness checklist before submission, and keep the excluded-records list (from failed completeness checks) visible for review rather than silently dropped."
    },
    {
      "component": "Exception Worklist",
      "description": "Resolving unmatched standing-order transactions requires phoning donors, and the design's Gift Aid and reconciliation processes handle donor personal and financial data; contacting donors and storing declaration data must comply with UK GDPR and the Fundraising Regulator's code, and the design does not specify how minimal-necessary data handling or consent basis is enforced in the worklist or chase notifier.",
      "severity": 4,
      "likelihood": 2,
      "mitigation": "Define data-minimisation and retention rules for the Exception Worklist and Declaration Chase Notifier, and document the lawful basis for donor contact in line with the Fundraising Regulator's code before staff begin outreach."
    },
    {
      "component": "Manual Cash/Cheque Entry Interface",
      "description": "Cheque and cash donations at events have no electronic trail and rely entirely on staff data entry with no automated matching path; incomplete or delayed entries held in draft state can stall downstream Gift Aid eligibility determination for those donations indefinitely.",
      "severity": 2,
      "likelihood": 3,
      "mitigation": "Enforce mandatory fields (donor identity, amount, date) at point of entry and set a follow-up reminder for drafts left incomplete beyond a short window."
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
      "criterion": "Tooling budget capped at about £6,000/year, ruling out platforms priced for enterprise-scale iPaaS deployments",
      "context_index": 15,
      "component": null
    },
    {
      "criterion": "No stated in-house developer or technical staff capability, favouring a no-code/low-code platform operable by non-technical fundraising/finance staff",
      "context_index": 18,
      "component": null
    },
    {
      "criterion": "Salesforce NPSP must remain the system of record for donor, gift and declaration data; any platform must read/write to it rather than replace it",
      "context_index": 3,
      "component": "Transaction Matching Engine"
    },
    {
      "criterion": "Must integrate with four distinct channels (JustGiving, Stripe, Lloyds bank feed, and a manual cheque/cash path) with different data shapes",
      "context_index": 2,
      "component": "Electronic Channel Ingestion"
    },
    {
      "criterion": "Moderate but non-trivial monthly volume (~4,100 transactions, ~340 unmatched) requires an exception-handling workflow, not just a simple trigger-action zap",
      "context_index": 7,
      "component": "Exception Worklist"
    },
    {
      "criterion": "HMRC Charities Online has no known submission API, so final claim submission must remain a manual step regardless of platform",
      "context_index": 16,
      "component": "Gift Aid Claim Builder"
    },
    {
      "criterion": "Donor data is subject to UK GDPR and the Fundraising Regulator's code, requiring a platform with adequate data-handling and access controls for personal financial data",
      "context_index": 17,
      "component": null
    },
    {
      "criterion": "The stated objective is automatic matching with an exception worklist and continuous Gift Aid eligibility, not a full bespoke system build",
      "context_index": 13,
      "component": null
    }
  ],
  "recommended_platform": "Make (formerly Integromat)",
  "also_required": [
    {
      "platform": "A lightweight form/data-capture tool (e.g. a simple web form) for the Manual Cash/Cheque Entry Interface",
      "role": "Captures event cash/cheque donations that have no electronic trail, feeding normalised records into Make for onward processing, since Make itself is an integration/orchestration layer rather than an end-user data-entry form"
    }
  ],
  "rationale": "The budget cap of ~£6,000/year and the absence of stated in-house developer capacity together point toward a low-code integration platform with per-operation/per-scenario pricing rather than an enterprise iPaaS. Make's visual scenario builder, native Salesforce and Stripe connectors, and support for scheduled/continuous flows fit the requirement for automatic matching plus an exception worklist and continuous Gift Aid eligibility checking (context 13, 14) without requiring custom software development. It can be operated and maintained by non-technical staff once built, matching the unresolved-but-implied constraint at context 18. Because HMRC Charities Online has no submission API (context 16), no platform changes the need for a manual final submission step; the recommendation only automates ingestion, matching, and claim-file compilation up to that point. The volume (~4,100 transactions/month, 340 unmatched) is well within the throughput such platforms are commonly used for, though this is an inference, not a stated capacity figure for Make specifically.",
  "alternatives_rejected": [
    {
      "platform": "Workato",
      "rejection_reason": "Enterprise-oriented pricing structures typically exceed the stated £6,000/year tooling budget, and its administration model assumes more technical operator capability than the context supports."
    },
    {
      "platform": "Boomi",
      "rejection_reason": "Positioned as an enterprise iPaaS with licensing and implementation overhead inconsistent with a £6,000/year budget and no stated technical staff to configure or maintain it."
    },
    {
      "platform": "Zapier",
      "rejection_reason": "Its native branching and multi-step conditional logic (needed for confidence-based matching and routing to an exception worklist rather than forcing a match) is less developed than Make's scenario router/filter model for this kind of decision-heavy flow; this is a comparative assessment, not a confirmed current limitation, and should be verified against current documentation."
    }
  ],
  "fit": [
    {
      "component": "Electronic Channel Ingestion",
      "how": "Make scenarios would poll or receive webhooks from JustGiving exports, Stripe payouts, and the Lloyds bank feed, normalising each into a common record shape; whether JustGiving and Lloyds have connectors or would need generic HTTP/CSV modules is not confirmed in the input and should be checked against current Make documentation."
    },
    {
      "component": "Manual Cash/Cheque Entry Interface",
      "how": "Handled by the separate lightweight form tool listed under also_required, with Make picking up submitted records via webhook or scheduled poll for onward normalisation."
    },
    {
      "component": "Transaction Matching Engine",
      "how": "A Make scenario using the Salesforce NPSP connector to look up donor/gift records, applying filter/router logic to attempt a match and writing matched results back; low-confidence cases are routed to a separate path rather than forced."
    },
    {
      "component": "Exception Worklist",
      "how": "Unmatched records routed by the matching scenario into a Salesforce list view, task queue, or connected worklist (e.g. a Salesforce object or a lightweight tracking sheet) for staff review and donor follow-up, with resolutions fed back into Make to update Salesforce."
    },
    {
      "component": "Gift Aid Eligibility Engine",
      "how": "A scheduled or triggered Make scenario reading donation and declaration status fields from Salesforce, applying eligibility filters, and flagging donations accordingly; the exact validity rules are unspecified (context 21) so this scenario would need those rules defined before build."
    },
    {
      "component": "Declaration Chase Notifier",
      "how": "A Make scenario generates a task list or notification (e.g. email/Slack/Salesforce task) for donations blocked by missing or unsigned declarations, keeping items open until actioned."
    },
    {
      "component": "Gift Aid Claim Builder",
      "how": "A Make scenario compiles eligible, matched donation records into a claim file (e.g. spreadsheet or CSV export) for staff review; since Charities Online has no submission API, the final upload step remains manual regardless of platform."
    }
  ],
  "knowledge_currency_note": "Platform capabilities, connector availability (particularly for JustGiving and Lloyds bank feeds), and pricing tiers change over time and are not independently verified here; before committing, the reader should confirm current Make (or any alternative) documentation for Salesforce NPSP connector depth, JustGiving/Lloyds integration options, per-operation pricing at the stated volume, and data-handling compliance suitable for UK GDPR and Fundraising Regulator obligations."
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

