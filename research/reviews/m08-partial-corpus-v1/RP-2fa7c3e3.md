# Review packet RP-2fa7c3e3

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
    "content": "Automate donation reconciliation and Gift Aid eligibility determination to reduce manual effort, improve claim completeness, and enable continuous monitoring rather than quarterly processing",
    "provenance": "inferred",
    "inference_basis": "The input describes two manual processes causing pain (reconciliation taking significant effort with 8% unmatched rate, Gift Aid claims taking eleven days quarterly with suspected under-claiming) and explicitly states desired outcomes: automatic matching with exception worklists and continuous eligibility determination"
  },
  "secondary_objectives": [
    {
      "content": "Reduce the time spent on quarterly Gift Aid claims from eleven days per person",
      "provenance": "stated",
      "source_quote": "The last claim took eleven days of one person's time"
    },
    {
      "content": "Improve Gift Aid claim completeness by identifying missing or invalid declarations while there is time to contact donors",
      "provenance": "stated",
      "source_quote": "we think we're under-claiming because anything doubtful gets dropped rather than chased"
    },
    {
      "content": "Reduce the manual effort required to match standing order donations that lack clear references",
      "provenance": "stated",
      "source_quote": "Standing orders are the painful ones - the bank reference is often just a surname, sometimes an old reference from before someone changed banks, and about 8% can't be matched without someone phoning the donor"
    },
    {
      "content": "Maintain compliance with UK GDPR and Fundraising Regulator requirements while processing donor data",
      "provenance": "stated",
      "source_quote": "Donor data is obviously sensitive and we're subject to UK GDPR and the Fundraising Regulator's code"
    }
  ],
  "inferred_scope": "Donation processing workflow from receipt through four channels (JustGiving, Stripe, bank standing orders, cash/cheques) to Salesforce NPSP reconciliation and quarterly HMRC Gift Aid claim submission, covering approximately 4,100 monthly transactions and £2.1m annual individual giving revenue"
}
```

### Context extraction

```json
{
  "elements": [
    {
      "id": "e1",
      "content": "Annual tooling budget ceiling of approximately £6,000",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "we'd struggle to justify more than about £6,000 a year in tooling to our trustees",
      "specificity_score": 0.85
    },
    {
      "id": "e2",
      "content": "Donor data subject to UK GDPR and Fundraising Regulator's code",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "Donor data is obviously sensitive and we're subject to UK GDPR and the Fundraising Regulator's code",
      "specificity_score": 0.9
    },
    {
      "id": "e3",
      "content": "HMRC Charities Online has no API for claim submission",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "HMRC's Charities Online has no API for claim submission that we're aware of, so the final submission may have to stay manual",
      "specificity_score": 0.7
    },
    {
      "id": "e4",
      "content": "CRM system is Salesforce NPSP",
      "category": "system",
      "provenance": "stated",
      "source_quote": "Our CRM is Salesforce NPSP",
      "specificity_score": 1
    },
    {
      "id": "e5",
      "content": "Donations received through JustGiving platform",
      "category": "system",
      "provenance": "stated",
      "source_quote": "Donations come in through four channels: JustGiving",
      "specificity_score": 1
    },
    {
      "id": "e6",
      "content": "Donations received through Stripe payment processor on charity website",
      "category": "system",
      "provenance": "stated",
      "source_quote": "our own website (Stripe)",
      "specificity_score": 1
    },
    {
      "id": "e7",
      "content": "Standing orders received directly into Lloyds bank account",
      "category": "system",
      "provenance": "stated",
      "source_quote": "standing orders straight into our bank (Lloyds)",
      "specificity_score": 1
    },
    {
      "id": "e8",
      "content": "Cash and cheque donations received at events",
      "category": "system",
      "provenance": "stated",
      "source_quote": "cheques or cash at events",
      "specificity_score": 0.9
    },
    {
      "id": "e9",
      "content": "Approximately 4,100 donation transactions per month",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "Last month there were 340 unmatched transactions out of about 4,100",
      "specificity_score": 0.85
    },
    {
      "id": "e10",
      "content": "340 unmatched transactions in a typical month, representing 8% of volume",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "Last month there were 340 unmatched transactions out of about 4,100",
      "specificity_score": 0.9
    },
    {
      "id": "e11",
      "content": "8% of standing order transactions cannot be matched without phoning the donor",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "about 8% can't be matched without someone phoning the donor",
      "specificity_score": 0.85
    },
    {
      "id": "e12",
      "content": "Annual individual giving income of approximately £2.1 million",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "Roughly £2.1m of that is individual giving",
      "specificity_score": 0.9
    },
    {
      "id": "e13",
      "content": "Quarterly Gift Aid claim preparation requires eleven days of one person's time",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "The last claim took eleven days of one person's time",
      "specificity_score": 0.9
    },
    {
      "id": "e14",
      "content": "Gift Aid declarations migrated from previous system in 2019, with known data quality issues",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "We hold declarations in Salesforce but they were migrated from a previous system in 2019 and we know some are missing or unsigned",
      "specificity_score": 0.8
    },
    {
      "id": "e15",
      "content": "Current reconciliation process involves manual download of JustGiving reports, Stripe payouts, and bank statements, followed by manual matching against Salesforce",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "Someone downloads the JustGiving report and the Stripe payouts, exports the bank statement, and matches everything against donor records in Salesforce",
      "specificity_score": 0.85
    },
    {
      "id": "e16",
      "content": "Standing order matching is complicated by poor reference data: often just surnames, sometimes outdated references from previous banks",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "Standing orders are the painful ones - the bank reference is often just a surname, sometimes an old reference from before someone changed banks",
      "specificity_score": 0.85
    },
    {
      "id": "e17",
      "content": "Current Gift Aid process involves quarterly manual spreadsheet construction, validation of declarations and addresses, with doubtful cases dropped rather than investigated",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "Someone builds the claim spreadsheet quarterly, checks each donation has a valid declaration and the donor address matches what's on the declaration, and submits through HMRC's Charities Online. The last claim took eleven days of one person's time and we think we're under-claiming because anything doubtful gets dropped rather than chased",
      "specificity_score": 0.8
    },
    {
      "id": "e18",
      "content": "Reconciliation must produce automatic matches where possible, with exception worklist for unmatched items",
      "category": "objective",
      "provenance": "stated",
      "source_quote": "The reconciliation matched automatically where it can be, with a worklist for the exceptions rather than a full manual pass",
      "specificity_score": 0.85
    },
    {
      "id": "e19",
      "content": "Gift Aid eligibility must be determined continuously rather than quarterly, enabling proactive identification of missing declarations",
      "category": "objective",
      "provenance": "stated",
      "source_quote": "Gift Aid eligibility determined continuously rather than in a quarterly scramble, so we can see what's claimable and what's blocked by a missing declaration while there's still time to ask the donor",
      "specificity_score": 0.9
    },
    {
      "id": "e20",
      "content": "Solution must integrate with JustGiving API or export format",
      "category": "dependency",
      "provenance": "inferred",
      "inference_basis": "Current process downloads JustGiving reports; automation requires programmatic access to this data",
      "specificity_score": 0.7
    },
    {
      "id": "e21",
      "content": "Solution must integrate with Stripe API or export format",
      "category": "dependency",
      "provenance": "inferred",
      "inference_basis": "Current process downloads Stripe payouts; automation requires programmatic access to this data",
      "specificity_score": 0.7
    },
    {
      "id": "e22",
      "content": "Solution must integrate with Lloyds bank statement data, either via API or structured export",
      "category": "dependency",
      "provenance": "inferred",
      "inference_basis": "Current process exports bank statements; automation requires programmatic access to transaction data",
      "specificity_score": 0.6
    },
    {
      "id": "e23",
      "content": "Solution must read from and write to Salesforce NPSP, accessing donor records and Gift Aid declarations",
      "category": "dependency",
      "provenance": "inferred",
      "inference_basis": "Reconciliation matches against Salesforce donor records and Gift Aid process validates declarations stored there",
      "specificity_score": 0.85
    },
    {
      "id": "e24",
      "content": "Availability and structure of Lloyds bank API or export format for standing order data",
      "category": "dependency",
      "provenance": "unknown",
      "resolution_hint": "Does Lloyds provide an API or structured export format suitable for automated transaction retrieval, and what authentication and access arrangements would be required?",
      "specificity_score": 0
    },
    {
      "id": "e25",
      "content": "Technical capability within the 40-person staff to operate and maintain an automation solution",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "What technical skills exist in-house (e.g., Salesforce admin, developer resources, IT support) and what level of solution complexity can the team sustain?",
      "specificity_score": 0
    },
    {
      "id": "e26",
      "content": "Matching algorithm requirements for standing orders with poor reference data",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "What additional data points are available for fuzzy matching (e.g., transaction amounts, dates, donor history patterns) and what match confidence threshold is acceptable before requiring manual review?",
      "specificity_score": 0
    },
    {
      "id": "e27",
      "content": "Process for handling cash and cheque donations from events in an automated workflow",
      "category": "environment",
      "provenance": "unknown",
      "resolution_hint": "How are event donations currently recorded (manual entry, batch upload, event management system) and at what point do they enter the reconciliation process?",
      "specificity_score": 0
    },
    {
      "id": "e28",
      "content": "Data quality remediation approach for migrated Gift Aid declarations",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "Should the automation solution include declaration validation and donor outreach workflows, or is declaration cleanup a separate prerequisite project?",
      "specificity_score": 0
    },
    {
      "id": "e29",
      "content": "Frequency and timing requirements for reconciliation runs",
      "category": "scale",
      "provenance": "unknown",
      "resolution_hint": "Should reconciliation run daily, weekly, or on-demand, and are there specific timing requirements relative to donation receipt or reporting deadlines?",
      "specificity_score": 0
    },
    {
      "id": "e30",
      "content": "Registered charity with approximately 40 staff and £6 million annual income",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "We're a registered charity, about 40 staff, income around £6m a year",
      "specificity_score": 0.85
    }
  ],
  "sufficiency": "thin"
}
```

### Architecture analysis

```json
{
  "summary": "The architecture comprises four ingestion components that retrieve donation data from external platforms, a reconciliation engine that matches transactions to Salesforce donor records using exact and fuzzy matching, a Gift Aid eligibility monitor that validates declarations continuously, and a manual review interface that surfaces unmatched transactions and declaration issues. Data flows from external sources through ingestion to reconciliation, with matched transactions updating Salesforce and exceptions routed to the review queue. The Gift Aid monitor operates independently on Salesforce data, flagging eligibility issues for staff follow-up. HMRC claim submission remains manual due to the absence of an API.",
  "data_flow_description": "Donation data enters through four ingestion components: JustGiving retrieves platform donations via API or export, Stripe retrieves website payments via API, bank statement ingestion retrieves standing order data from Lloyds (method uncertain), and event donation ingestion handles cash and cheque records (entry method uncertain). All ingested transactions flow to the reconciliation engine, which queries Salesforce NPSP for donor records and attempts matching using transaction references, amounts, dates and donor history. Successfully matched transactions update the corresponding Salesforce opportunity records. Unmatched transactions and low-confidence matches are written to an exception worklist for manual review. In parallel, the Gift Aid eligibility monitor queries Salesforce for donations and their associated Gift Aid declarations, validates declaration completeness and address data, and writes flagged issues to a separate review queue. Staff interact with both queues through a manual review interface. Quarterly HMRC claim data is exported from Salesforce for manual submission via Charities Online.",
  "components": [
    {
      "name": "JustGiving Ingestion",
      "responsibility": "Retrieve donation transactions from JustGiving platform and transform them into a standard internal format for reconciliation",
      "inputs": "JustGiving donation data via API or export file",
      "outputs": "Normalised transaction records containing donor reference, amount, date, and platform metadata",
      "failure_handling": "Log retrieval failures and alert staff. Retry with exponential backoff for transient API errors. For persistent failures, fall back to manual download process to prevent reconciliation gaps.",
      "external_system": "JustGiving",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        4,
        14,
        19
      ]
    },
    {
      "name": "Stripe Ingestion",
      "responsibility": "Retrieve donation transactions from Stripe payment processor and transform them into a standard internal format for reconciliation",
      "inputs": "Stripe payout data via API",
      "outputs": "Normalised transaction records containing donor reference, amount, date, and payment metadata",
      "failure_handling": "Log retrieval failures and alert staff. Retry with exponential backoff for transient API errors. For persistent failures, fall back to manual download process to prevent reconciliation gaps.",
      "external_system": "Stripe",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        5,
        14,
        20
      ]
    },
    {
      "name": "Bank Statement Ingestion",
      "responsibility": "Retrieve standing order transactions from Lloyds bank account and transform them into a standard internal format for reconciliation",
      "inputs": "Lloyds bank statement data via API or structured export",
      "outputs": "Normalised transaction records containing reference text, amount, date, and bank metadata",
      "failure_handling": "Log retrieval failures and alert staff. For API failures, fall back to manual statement download. For parsing failures on poor reference data, pass transaction through with reference marked as low-quality to inform matching confidence.",
      "external_system": "Lloyds Bank",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        6,
        14,
        15,
        21,
        23
      ]
    },
    {
      "name": "Event Donation Ingestion",
      "responsibility": "Retrieve or accept cash and cheque donation records from events and transform them into a standard internal format for reconciliation",
      "inputs": "Event donation data from manual entry, batch upload, or event management system",
      "outputs": "Normalised transaction records containing donor reference, amount, date, and event metadata",
      "failure_handling": "Validate required fields on entry. Reject incomplete records with specific error messages. For batch uploads, provide error report identifying invalid rows while processing valid ones.",
      "external_system": "Event management system or manual entry interface",
      "integration_direction": "inbound",
      "grounded_in_context_indices": [
        7,
        14,
        26
      ]
    },
    {
      "name": "Reconciliation Engine",
      "responsibility": "Match ingested donation transactions to Salesforce donor records using exact and fuzzy matching, update matched opportunities, and route exceptions to manual review",
      "inputs": "Normalised transaction records from all ingestion components; Salesforce donor records and opportunity data",
      "outputs": "Salesforce opportunity updates for matched transactions; exception worklist entries for unmatched or low-confidence matches",
      "failure_handling": "For Salesforce API failures, queue updates for retry and alert staff if queue depth exceeds threshold. For matching logic errors, log the transaction details and route to exception worklist rather than attempting an uncertain update. Preserve all ingested transaction data to enable manual reconciliation if automated matching fails.",
      "external_system": "Salesforce NPSP",
      "integration_direction": "bidirectional",
      "grounded_in_context_indices": [
        3,
        8,
        9,
        10,
        14,
        15,
        17,
        22,
        25
      ]
    },
    {
      "name": "Gift Aid Eligibility Monitor",
      "responsibility": "Continuously validate Gift Aid declarations and donor addresses in Salesforce, flagging missing or invalid data for staff follow-up",
      "inputs": "Salesforce donation records and associated Gift Aid declarations",
      "outputs": "Flagged eligibility issues written to review queue, including missing declarations, incomplete addresses, and data quality problems",
      "failure_handling": "For Salesforce query failures, retry with exponential backoff and alert staff if persistent. For validation logic errors, log the affected record and continue processing remaining records to prevent a single bad record blocking the entire run.",
      "external_system": "Salesforce NPSP",
      "integration_direction": "bidirectional",
      "grounded_in_context_indices": [
        3,
        13,
        16,
        18,
        22,
        27
      ]
    },
    {
      "name": "Manual Review Interface",
      "responsibility": "Present unmatched transactions and Gift Aid eligibility issues to staff for investigation and resolution",
      "inputs": "Exception worklist entries from reconciliation engine; flagged eligibility issues from Gift Aid monitor",
      "outputs": "Staff decisions on transaction matching and declaration follow-up actions",
      "failure_handling": "Persist all worklist state to prevent data loss on interface failure. Provide clear error messages for invalid staff actions. Log all resolution decisions for audit trail.",
      "grounded_in_context_indices": [
        9,
        10,
        16,
        17,
        18
      ]
    },
    {
      "name": "HMRC Claim Export",
      "responsibility": "Extract quarterly Gift Aid claim data from Salesforce in the format required for manual submission to HMRC Charities Online",
      "inputs": "Salesforce donation records with validated Gift Aid declarations for the claim period",
      "outputs": "Formatted claim data file or report for manual HMRC submission",
      "failure_handling": "Validate claim data completeness before export. Reject export if required fields are missing and provide specific error report. Log all exports with timestamp and record count for audit trail.",
      "external_system": "Salesforce NPSP",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        2,
        3,
        12,
        16,
        22
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

*Comparison candidates (same input type):* RP-07a977a3, RP-14769a97, RP-172cbc4e, RP-27f9fb58, RP-448236a4, RP-4bb087ba, RP-5c2b0a40, RP-ac291956, RP-d41a9d08, RP-e755dbdf. Name the one you used.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

### Overall

Per §3.5 an analysis passes only when all seven criteria pass. C-3 and C-6 are
not assessable here, so this analysis cannot be recorded as a rubric pass.

- **Overall:** ` fail / not assessable `  (a pass is not reachable — see above)
- **Notes:**

> 

