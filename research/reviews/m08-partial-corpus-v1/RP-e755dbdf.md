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
    "content": "Produce a written requirement specification for new-starter setup automation that enables fair comparison of supplier proposals",
    "provenance": "stated",
    "source_quote": "What I want is the requirement written down properly, so all three are quoting for the same thing and I can compare like with like."
  },
  "secondary_objectives": [
    {
      "content": "Ensure the requirement does not constrain supplier solution design",
      "provenance": "stated",
      "source_quote": "I don't want you to design the solution - the suppliers will pitch their own and I'd rather not anchor them."
    },
    {
      "content": "Prevent missed steps in the new-starter process",
      "provenance": "inferred",
      "inference_basis": "The input describes a current problem where things get missed, exemplified by a starter with no laptop, which the automation requirement must address."
    }
  ],
  "inferred_scope": "New-starter onboarding process spanning HR, IT, facilities, and payroll across two offices"
}
```

### Context extraction

```json
{
  "elements": [
    {
      "id": "e1",
      "content": "New-starter setup process involves HR, IT, facilities, and payroll",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "When someone joins, HR emails IT, IT creates the accounts, facilities sorts the desk and pass, and payroll gets told separately.",
      "specificity_score": 0.7
    },
    {
      "id": "e2",
      "content": "Current process is email-based coordination between departments",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "HR emails IT",
      "specificity_score": 0.6
    },
    {
      "id": "e3",
      "content": "Steps are currently missed in the process",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "Things get missed. Last month someone started with no laptop.",
      "specificity_score": 0.8
    },
    {
      "id": "e4",
      "content": "Approximately 60 new starters per year",
      "category": "scale",
      "provenance": "stated",
      "source_quote": "About 60 new starters a year",
      "specificity_score": 0.9
    },
    {
      "id": "e5",
      "content": "Operations span two office locations",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "across two offices",
      "specificity_score": 0.7
    },
    {
      "id": "e6",
      "content": "Solution must not constrain supplier design approaches",
      "category": "constraint",
      "provenance": "stated",
      "source_quote": "I don't want you to design the solution - the suppliers will pitch their own and I'd rather not anchor them.",
      "specificity_score": 0.9
    },
    {
      "id": "e7",
      "content": "Requirement must enable fair comparison between three supplier proposals",
      "category": "objective",
      "provenance": "stated",
      "source_quote": "so all three are quoting for the same thing and I can compare like with like",
      "specificity_score": 0.8
    },
    {
      "id": "e8",
      "content": "IT account creation is part of the process",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "IT creates the accounts",
      "specificity_score": 0.6
    },
    {
      "id": "e9",
      "content": "Facilities provides desk and access pass",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "facilities sorts the desk and pass",
      "specificity_score": 0.7
    },
    {
      "id": "e10",
      "content": "Payroll notification is separate from other steps",
      "category": "environment",
      "provenance": "stated",
      "source_quote": "payroll gets told separately",
      "specificity_score": 0.6
    },
    {
      "id": "e11",
      "content": "Budget available for automation solution",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "What is the budget range or spending authority for this automation project?",
      "specificity_score": 0
    },
    {
      "id": "e12",
      "content": "Systems currently used by HR, IT, facilities, and payroll",
      "category": "system",
      "provenance": "unknown",
      "resolution_hint": "What are the specific systems each department uses (HRIS, ticketing system, access control, payroll platform)?",
      "specificity_score": 0
    },
    {
      "id": "e13",
      "content": "Timeline for implementation",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "When does the solution need to be operational?",
      "specificity_score": 0
    },
    {
      "id": "e14",
      "content": "Technical capability of team who will operate the solution",
      "category": "environment",
      "provenance": "unknown",
      "resolution_hint": "Who will administer and maintain the automation once implemented, and what is their technical skill level?",
      "specificity_score": 0
    },
    {
      "id": "e15",
      "content": "Compliance or data protection requirements",
      "category": "constraint",
      "provenance": "unknown",
      "resolution_hint": "Are there regulatory, data protection, or audit requirements that constrain how employee data is handled?",
      "specificity_score": 0
    },
    {
      "id": "e16",
      "content": "Definition of what constitutes a complete new-starter setup",
      "category": "objective",
      "provenance": "unknown",
      "resolution_hint": "What is the complete checklist of items and access each new starter must have on day one?",
      "specificity_score": 0
    },
    {
      "id": "e17",
      "content": "Lead time between hire decision and start date",
      "category": "scale",
      "provenance": "unknown",
      "resolution_hint": "How much notice is typically given between when a hire is confirmed and when they start?",
      "specificity_score": 0
    },
    {
      "id": "e18",
      "content": "Variability in new-starter requirements by role or seniority",
      "category": "environment",
      "provenance": "unknown",
      "resolution_hint": "Do different roles or levels require different setup steps, systems access, or equipment?",
      "specificity_score": 0
    }
  ],
  "sufficiency": "thin"
}
```

### Architecture analysis

```json
{
  "summary": "The architecture coordinates new-starter setup across HR, IT, facilities, and payroll departments, replacing email-based coordination with a structured workflow that tracks completion of all required steps. A central orchestration component initiates the process, distributes tasks to each department, monitors progress, and ensures nothing is missed. Each department retains responsibility for its own actions within its existing systems. The design supports approximately 60 new starters per year across two office locations.",
  "data_flow_description": "HR initiates the process by submitting new-starter details to the orchestration component. The orchestrator creates parallel tasks for IT account creation, facilities desk and access pass provisioning, and payroll notification. Each department receives its task, performs the work in its own systems, and reports completion back to the orchestrator. The orchestrator tracks which steps are complete and which are outstanding, preventing the process from being considered finished until all departments have confirmed their work. Status visibility allows any department to see the overall progress without relying on email threads.",
  "components": [
    {
      "name": "Orchestration Engine",
      "responsibility": "Receives new-starter details, creates and distributes tasks to all departments, tracks completion status, and prevents process closure until all steps are confirmed complete",
      "inputs": "New-starter details from HR including name, start date, role, and office location",
      "outputs": "Task assignments to IT, facilities, and payroll; completion status visible to all departments; alerts for overdue or incomplete steps",
      "failure_handling": "If the orchestrator fails, departments revert to email coordination. Task state must be recoverable so in-progress setups are not lost. Alerts notify administrators if the orchestrator stops responding.",
      "grounded_in_context_indices": [
        0,
        1,
        2,
        3,
        4
      ]
    },
    {
      "name": "IT Provisioning Interface",
      "responsibility": "Receives IT account creation tasks, provides a mechanism for IT to confirm completion, and reports status back to the orchestrator",
      "inputs": "New-starter name, role, start date, and office location from orchestrator",
      "outputs": "Completion confirmation to orchestrator once IT account is created",
      "failure_handling": "If this interface fails, IT must be able to see pending tasks through an alternative view or notification. The orchestrator must not mark IT provisioning complete without explicit confirmation.",
      "external_system": "IT account management system",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        0,
        7
      ]
    },
    {
      "name": "Facilities Provisioning Interface",
      "responsibility": "Receives desk and access pass tasks, provides a mechanism for facilities to confirm completion, and reports status back to the orchestrator",
      "inputs": "New-starter name, start date, and office location from orchestrator",
      "outputs": "Completion confirmation to orchestrator once desk is assigned and access pass is ready",
      "failure_handling": "If this interface fails, facilities must be able to see pending tasks through an alternative view or notification. The orchestrator must not mark facilities provisioning complete without explicit confirmation.",
      "external_system": "Facilities management and access control systems",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        0,
        4,
        8
      ]
    },
    {
      "name": "Payroll Notification Interface",
      "responsibility": "Receives payroll notification tasks, provides a mechanism for payroll to confirm receipt and processing, and reports status back to the orchestrator",
      "inputs": "New-starter name, start date, and payroll-relevant details from orchestrator",
      "outputs": "Completion confirmation to orchestrator once payroll has been notified and acknowledged the new starter",
      "failure_handling": "If this interface fails, payroll must be able to see pending notifications through an alternative view or notification. The orchestrator must not mark payroll notification complete without explicit confirmation.",
      "external_system": "Payroll system",
      "integration_direction": "outbound",
      "grounded_in_context_indices": [
        0,
        9
      ]
    },
    {
      "name": "Status Dashboard",
      "responsibility": "Displays current state of all in-progress new-starter setups, showing which steps are complete and which are outstanding, visible to all departments",
      "inputs": "Real-time completion status from orchestrator for all active new-starter processes",
      "outputs": "Visual representation of process state accessible to HR, IT, facilities, and payroll",
      "failure_handling": "If the dashboard fails, departments can still complete their tasks through their respective interfaces. The orchestrator continues tracking state even if visibility is temporarily lost. Departments are notified that status visibility is degraded.",
      "grounded_in_context_indices": [
        1,
        2
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

*Comparison candidates (same input type):* RP-07a977a3, RP-14769a97, RP-172cbc4e, RP-27f9fb58, RP-2fa7c3e3, RP-448236a4, RP-4bb087ba, RP-5c2b0a40, RP-ac291956, RP-d41a9d08. Name the one you used.

**Verdict:** ` pass / fail / not assessable `

**Evidence:**

> 

### Overall

Per §3.5 an analysis passes only when all seven criteria pass. C-3 and C-6 are not assessable here, so this analysis cannot be recorded as a rubric pass.

- **Overall:** ` fail / not assessable `  (a pass is not reachable — see above)
- **Notes:**

> 

