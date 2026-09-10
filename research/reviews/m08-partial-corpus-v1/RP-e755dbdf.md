# Review packet RP-e755dbdf

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
I'm meeting three automation suppliers next month and I want to be clear about what
I'm actually asking them for before I do.

The problem is our new-starter setup. When someone joins, HR emails IT, IT creates
the accounts, facilities sorts the desk and pass, and payroll gets told separately.
Things get missed. Last month someone started with no laptop.

I don't want you to design the solution - the suppliers will pitch their own and I'd
rather not anchor them. What I want is the requirement written down properly, so all
three are quoting for the same thing and I can compare like with like.

About 60 new starters a year across two offices.
```

*647 characters.*

---

## 2 · What the system produced

*3 stage(s) recorded: Classification → Intent → Context extraction.*

> **Reading the grounding.** Context elements are an ordered array. Where a
> later stage cites `grounded_in_context_indices`, those are **0-based**
> positions into that array — the first element is index 0. `C-1` is checked
> by following a cited index back to the element it names and to that
> element's own `provenance` and `source_quote`.

### Classification

```json
{
  "determined_type": "business_requirement",
  "confidence": 0.92,
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
    "content": "Get the new-starter onboarding requirement written down properly and consistently, so three suppliers can quote against the same specification and be compared like with like",
    "provenance": "stated"
  },
  "secondary_objectives": [
    {
      "content": "Fix the underlying problem of missed steps in new-starter setup (e.g. HR-IT-facilities-payroll handoffs), such as a starter with no laptop",
      "provenance": "stated"
    }
  ],
  "inferred_scope": "The new-starter onboarding process spanning HR, IT, facilities, and payroll, across two offices, handling about 60 new starters a year",
  "requested_outcome": "understanding_only",
  "decline_quote": "I don't want you to design the solution - the suppliers will pitch their own and I'd rather not anchor them."
}
```

### Context extraction

```json
{
  "elements": [
    {
      "id": "e1",
      "content": "Onboarding process spans HR, IT, facilities, and payroll",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.7,
      "source_quote": "HR emails IT, IT creates the accounts, facilities sorts the desk and pass, and payroll gets told separately.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e2",
      "content": "Steps are currently getting missed in the process",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.5,
      "source_quote": "Things get missed.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e3",
      "content": "A concrete failure occurred: a new starter had no laptop on their start date",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.6,
      "source_quote": "Last month someone started with no laptop.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e4",
      "content": "About 60 new starters per year",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 0.8,
      "source_quote": "About 60 new starters a year across two offices.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e5",
      "content": "Process operates across two office locations",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 0.7,
      "source_quote": "across two offices",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e6",
      "content": "User wants a vendor-neutral requirement specification, not a design, so three suppliers can be compared like-for-like",
      "category": "objective",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "What I want is the requirement written down properly, so all\nthree are quoting for the same thing and I can compare like with like.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e7",
      "content": "User explicitly does not want a proposed solution or architecture, to avoid anchoring supplier pitches",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "I don't want you to design the solution - the suppliers will pitch their own and I'd rather not anchor them.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e8",
      "content": "Meeting with three automation suppliers next month",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.7,
      "source_quote": "I'm meeting three automation suppliers next month",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e9",
      "content": "Which specific systems (HR system, IT provisioning tools, payroll system, facilities booking system) are currently in use",
      "category": "system",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What named HR, IT, payroll, and facilities systems are currently used, and would need to be integrated with or replaced?",
      "conflicts_with_id": null
    },
    {
      "id": "e10",
      "content": "Budget available for a solution",
      "category": "constraint",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What budget range is available for supplier proposals?",
      "conflicts_with_id": null
    },
    {
      "id": "e11",
      "content": "Who would operate/own the automation once built (in-house team capability)",
      "category": "environment",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Does the organisation have in-house developers or IT staff to operate/maintain the resulting automation, or is it expected to be fully managed by the supplier?",
      "conflicts_with_id": null
    },
    {
      "id": "e12",
      "content": "Required timeliness or SLA for each onboarding step (e.g. how many days before start date accounts/laptop/desk must be ready)",
      "category": "constraint",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What deadlines or SLAs must each department meet relative to the starter's first day?",
      "conflicts_with_id": null
    },
    {
      "id": "e13",
      "content": "Compliance or data-protection requirements around sharing new-starter personal data between HR, IT, facilities and payroll",
      "category": "constraint",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Are there data protection or compliance requirements governing how new-starter personal data is shared between departments/systems?",
      "conflicts_with_id": null
    }
  ],
  "sufficiency": "thin"
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

- **Analysis identifier:** RP-e755dbdf
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

*Comparison candidates (same input type):* RP-07a977a3, RP-27f9fb58, RP-2fa7c3e3, RP-448236a4, RP-4bb087ba, RP-5c2b0a40, RP-ac291956, RP-d41a9d08. Name the one you used.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

### Overall

Per §3.5 an analysis passes only when all seven criteria pass. C-3 and C-6 are not assessable here, so this analysis cannot be recorded as a rubric pass.

- **Overall:** ` fail / not assessable `  (a pass is not reachable — see above)
- **Notes:**

> 

