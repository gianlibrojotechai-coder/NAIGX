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

*10 stage(s) recorded: Classification → Intent → Context extraction → Architecture analysis → Integration requirements → Complexity assessment → Implementation roadmap → Risk register → Edge cases and practices → Platform recommendation.*

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
    "content": "Produce a clear, vendor-neutral written requirement for the new-starter onboarding process so all three suppliers can quote against the same specification and be compared like with like",
    "provenance": "stated"
  },
  "secondary_objectives": [
    {
      "content": "Avoid anchoring the suppliers on a particular solution design",
      "provenance": "stated"
    },
    {
      "content": "Fix the underlying coordination failure between HR, IT, facilities and payroll so steps like laptop provisioning are not missed",
      "provenance": "inferred"
    }
  ],
  "inferred_scope": "The new-starter onboarding process spanning HR, IT, facilities and payroll, across two offices, covering roughly 60 starters a year; scope is limited to defining the requirement for external suppliers, not designing or selecting the automation solution itself"
}
```

### Context extraction

```json
{
  "elements": [
    {
      "id": "e1",
      "content": "Onboarding process spans HR, IT, facilities and payroll",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.6,
      "source_quote": "HR emails IT, IT creates the accounts, facilities sorts the desk and pass, and payroll gets told separately.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e2",
      "content": "Steps get missed today, causing failures like a new starter arriving with no laptop",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.7,
      "source_quote": "Things get missed. Last month someone started with no laptop.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e3",
      "content": "About 60 new starters a year across two offices",
      "category": "scale",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "About 60 new starters a year across two offices.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e4",
      "content": "User does not want a proposed solution design; wants a vendor-neutral requirement so three suppliers can quote against the same spec",
      "category": "constraint",
      "provenance": "stated",
      "specificity_score": 0.9,
      "source_quote": "I don't want you to design the solution - the suppliers will pitch their own and I'd rather not anchor them.",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e5",
      "content": "Meeting three automation suppliers next month to be quoted against this requirement",
      "category": "environment",
      "provenance": "stated",
      "specificity_score": 0.7,
      "source_quote": "I'm meeting three automation suppliers next month",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e6",
      "content": "Objective is comparability across supplier quotes on a like-for-like basis",
      "category": "objective",
      "provenance": "stated",
      "specificity_score": 0.8,
      "source_quote": "so all\nthree are quoting for the same thing and I can compare like with like",
      "inference_basis": null,
      "resolution_hint": null,
      "conflicts_with_id": null
    },
    {
      "id": "e7",
      "content": "No named systems (HRIS, IT provisioning tool, ticketing system, payroll system) are identified",
      "category": "system",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What specific HR, IT, facilities and payroll systems are currently in use, and would any need to be integrated with or replaced?",
      "conflicts_with_id": null
    },
    {
      "id": "e8",
      "content": "No budget or spending limit for the automation is stated",
      "category": "constraint",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "What budget range is available for this automation, so supplier quotes can be assessed for affordability?",
      "conflicts_with_id": null
    },
    {
      "id": "e9",
      "content": "No information on who would operate or maintain the automation once built (in-house team capability)",
      "category": "environment",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Who will operate and maintain the resulting workflow day-to-day - is there in-house technical capability, or will it be fully supplier-managed?",
      "conflicts_with_id": null
    },
    {
      "id": "e10",
      "content": "No stated timing/deadline requirements (e.g. how far in advance a starter's accounts must be ready before their start date)",
      "category": "scale",
      "provenance": "unknown",
      "specificity_score": 0,
      "source_quote": null,
      "inference_basis": null,
      "resolution_hint": "Are there specific lead-time or deadline requirements (e.g. accounts ready X days before start date) that the process must meet?",
      "conflicts_with_id": null
    },
    {
      "id": "e11",
      "content": "The coordination failure across departments needs a defined trigger and handoff sequence to be fixed",
      "category": "objective",
      "provenance": "inferred",
      "specificity_score": 0.4,
      "source_quote": null,
      "inference_basis": "The description of missed steps across HR, IT, facilities and payroll implies the underlying goal is reliable handoff and completion tracking, though this is not explicitly stated as the requirement's aim.",
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
  "summary": "The context describes a cross-departmental new-starter onboarding process (HR, IT, facilities, payroll) that currently fails because steps are missed, with no automation yet built and no named systems, budget, operating model or timing rules specified. The derivable architecture is a coordination/orchestration structure that triggers on a new starter, assigns and tracks the discrete tasks each function must complete, and escalates when a step is missed — this is the shape of the requirement the input supports, not a full solution design, and several structural details remain open pending information the input does not supply.",
  "data_flow_description": "A new-starter event (from whatever HR record-keeping exists) enters the intake/trigger component, which creates a case record. The orchestration component reads that case and issues discrete tasks to the IT, facilities and payroll functions in parallel or sequence. Each function's task component receives its assigned task and, on completion, reports status back to the orchestration component. The completion-tracking component continuously reads task status across all functions and, if a task is not marked complete in the expected window, raises an escalation back to the orchestration component and to the relevant function. No data leaves this internal task-and-status loop to any named external system, because no such systems are identified in the input.",
  "components": [
    {
      "name": "New Starter Intake",
      "responsibility": "Capture that a new starter exists and create a single case record that the rest of the process operates against",
      "inputs": "New starter details (identity, start date, office location) from whatever process currently records hires",
      "outputs": "A case record used to trigger downstream HR, IT, facilities and payroll tasks",
      "failure_handling": "If intake fails to fire or capture a starter, no case record is created and no downstream tasks are ever triggered — this is the same failure mode the input already describes (a starter arriving with nothing arranged)",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        0,
        2,
        4
      ]
    },
    {
      "name": "Task Orchestration",
      "responsibility": "Sequence and assign the discrete onboarding tasks across HR, IT, facilities and payroll for a given case, and hold the authoritative status of each",
      "inputs": "Case record from intake; task completion signals from each function's task component",
      "outputs": "Task assignments to each function; consolidated case status",
      "failure_handling": "If orchestration fails or a task is never issued, the responsible function has no record of what it owes, reproducing the coordination failure described (steps silently missed)",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        0,
        1,
        10
      ]
    },
    {
      "name": "IT Provisioning Task",
      "responsibility": "Track and confirm that IT-owned onboarding steps (e.g. equipment provisioning) are completed for a case",
      "inputs": "Task assignment from orchestration",
      "outputs": "Completion status back to orchestration",
      "failure_handling": "If this task is not completed or not reported, the case remains open in orchestration but nothing forces action — this is the specific failure pattern named in the input (starter with no laptop)",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        0,
        1
      ]
    },
    {
      "name": "Facilities Task",
      "responsibility": "Track and confirm that facilities-owned onboarding steps (e.g. desk, building access) are completed for a case",
      "inputs": "Task assignment from orchestration",
      "outputs": "Completion status back to orchestration",
      "failure_handling": "If this task is not completed or not reported, the case remains open with no forcing function, matching the general 'steps get missed' failure described",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        0
      ]
    },
    {
      "name": "Payroll Setup Task",
      "responsibility": "Track and confirm that payroll-owned onboarding steps are completed for a case",
      "inputs": "Task assignment from orchestration",
      "outputs": "Completion status back to orchestration",
      "failure_handling": "If this task is not completed or not reported, the case remains open with no forcing function, matching the general 'steps get missed' failure described",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        0
      ]
    },
    {
      "name": "Completion Tracking and Escalation",
      "responsibility": "Monitor task status across all functions for every open case and raise an escalation when a task is not completed within the expected window",
      "inputs": "Task status from orchestration across HR, IT, facilities and payroll tasks",
      "outputs": "Escalation notices directed at the case owner and the function responsible for the outstanding task",
      "failure_handling": "If this component fails, missed steps go undetected until the starter's start date, reproducing the exact failure the input describes rather than preventing it",
      "external_system": null,
      "integration_direction": null,
      "grounded_in_context_indices": [
        1,
        10
      ]
    }
  ],
  "unknown_disposition": [
    {
      "context_index": 6,
      "disposition": "excluded",
      "statement": "No specific HR, IT, ticketing or payroll systems are named in the input, so the architecture defines internal task/status components only and does not specify integration with any named system. Including real integrations would require knowing which systems are in use today."
    },
    {
      "context_index": 7,
      "disposition": "excluded",
      "statement": "No budget is stated, so the architecture does not reflect any cost constraint and cannot be checked for affordability. This is left out until a budget figure or range is known."
    },
    {
      "context_index": 8,
      "disposition": "deferred",
      "statement": "Whether the completion-tracking and orchestration components would be run by in-house staff or fully by a supplier is not settled; the structure as described works under either arrangement, and which one applies is left to the reader."
    },
    {
      "context_index": 9,
      "disposition": "assumed",
      "statement": "The design assumes tasks must be completed before the starter's start date (consistent with the described laptop failure) but no specific lead time is stated, so the escalation window in the Completion Tracking component is left undefined rather than given an invented number of days."
    }
  ],
  "trade_offs": [],
  "rejected_approaches": []
}
```

### Integration requirements

```json
{
  "integrations": [],
  "no_integrations_statement": "The architecture defines only internal components (New Starter Intake, Task Orchestration, IT Provisioning Task, Facilities Task, Payroll Setup Task, Completion Tracking and Escalation) and none of them names an external_system. The unknown_disposition explicitly excludes naming any HR, IT, ticketing or payroll system because the input does not identify which systems are currently in use (context index 6). Consequently this architecture has no integration requirements to state; any real integration surface can only be defined once the actual systems in use are known.",
  "knowledge_currency_note": "No external systems are named in this architecture, so no platform-specific constraints are asserted here; once real systems (HRIS, IT provisioning tool, ticketing system, payroll system) are identified, their current API capabilities, rate limits, auth models and pricing must be verified against up-to-date vendor documentation, since such details change over time and any general knowledge about a named platform would need to be checked at build time."
}
```

### Complexity assessment

```json
{
  "factors": [
    {
      "factor": "workflow",
      "score": 3,
      "justification": "The case flows through intake, parallel task assignment to three functions (IT, facilities, payroll), and a monitoring/escalation loop — several branches and a moderate step count, but no deep nesting or multi-level loops are described."
    },
    {
      "factor": "integration",
      "score": 1,
      "justification": "No named external systems (HRIS, ticketing, payroll) are identified in the input; the architecture explicitly defines only internal task/status components with no external interfaces to integrate against."
    },
    {
      "factor": "data_logic",
      "score": 1,
      "justification": "Data is limited to case identity and task completion status passed between orchestration and task components; there is no reshaping, reconciliation across sources, or dense business-rule set described."
    },
    {
      "factor": "failure_risk",
      "score": 3,
      "justification": "Several distinct failure modes are named (intake never fires, orchestration fails to issue a task, a function fails to report completion) each reproducing the described real-world consequence of a starter arriving unprepared, requiring deliberate handling in the Completion Tracking component, though no ordering or idempotency demands are stated."
    },
    {
      "factor": "operational",
      "score": 2,
      "justification": "At roughly 60 starters a year the volume is modest and no timing thresholds are given, but the Completion Tracking and Escalation component implies some periodic monitoring is needed to catch missed steps; who operates it is unresolved (deferred), so this is scored as implied routine attention rather than heavy specialist maintenance."
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
      "name": "Case Intake Foundation",
      "objective": "Build the New Starter Intake component so that a new-starter event reliably produces a single case record for a given hire, resolving the entry point that all downstream task assignment depends on. This does not yet touch which HR system supplies the trigger, since no such system is named.",
      "components": [
        "New Starter Intake"
      ],
      "depends_on": [],
      "outcome": "A new starter can be entered (however that occurs today) and a case record is created; nothing yet acts on that case, but the trigger point that previously produced no record at all now exists.",
      "estimate": null
    },
    {
      "ordinal": 2,
      "name": "Task Orchestration and Function Tasks",
      "objective": "Build the Task Orchestration component and the three function-specific task components (IT, Facilities, Payroll) so that a case record from intake results in discrete, assigned tasks per function, each able to report completion back. This builds the core coordination structure the input's 'steps get missed' failure and the inferred handoff need (index 10) point to.",
      "components": [
        "Task Orchestration",
        "IT Provisioning Task",
        "Facilities Task",
        "Payroll Setup Task"
      ],
      "depends_on": [
        1
      ],
      "outcome": "A case created by intake is broken into IT, facilities and payroll tasks, each function can mark its task complete, and orchestration holds a consolidated status per case — the assignment failure is addressed, though nothing yet detects a task that is never completed.",
      "estimate": null
    },
    {
      "ordinal": 3,
      "name": "Completion Tracking and Escalation",
      "objective": "Build the Completion Tracking and Escalation component so that task status across all functions is monitored per case and an escalation is raised when a task is not completed in the expected window, directly addressing the missed-step failure described in the input (e.g. the no-laptop scenario).",
      "components": [
        "Completion Tracking and Escalation"
      ],
      "depends_on": [
        2
      ],
      "outcome": "The full design exists: a new starter triggers a case, tasks are assigned across HR, IT, facilities and payroll, each is tracked, and an outstanding task now triggers an escalation instead of silently failing through to the starter's start date. The escalation window itself remains undefined pending a stated lead-time requirement (context index 9).",
      "estimate": null
    }
  ],
  "sequencing_rationale": "Intake must exist first because every other component consumes the case record it produces; without it there is nothing for orchestration to act on. Orchestration and the three function task components are built together in phase 2 because they form a single consuming/reporting loop — orchestration issues tasks and the function components report back to it, so building one without the other leaves either an untargeted assignment or an unreachable reporting endpoint. Completion Tracking is built last because its responsibility is to monitor task status that only exists once orchestration and the function tasks are producing it; putting escalation earlier would have nothing to monitor. This order also matches how the input's central failure (missed steps, e.g. the no-laptop case) is progressively closed: phase 1 ensures a case is never simply absent, phase 2 ensures each function has a discrete, trackable obligation, and phase 3 ensures an unmet obligation is surfaced rather than discovered only on the starter's first day. Named external systems, budget and operator model remain unresolved per the unknown disposition and are not sequenced into any phase because the input gives no basis to build against them."
}
```

### Risk register

```json
{
  "risks": [
    {
      "component": "Completion Tracking and Escalation",
      "description": "The escalation window that triggers alerts is undefined because no lead-time requirement was stated (context index 9, assumed disposition). Without a defined window, the component cannot reliably distinguish 'still in progress' from 'missed', so it may either escalate too late (reproducing the laptop-on-day-one failure) or too often (alert fatigue).",
      "severity": 4,
      "likelihood": 4,
      "mitigation": "Require each supplier quote to specify a concrete lead-time/escalation window (e.g. days before start date) as part of the spec, so quotes are comparable and the window is not left to be invented per-implementation."
    },
    {
      "component": "New Starter Intake",
      "description": "No system of record for new starters is named (context index 6, excluded). If intake relies on an ad-hoc or manual signal rather than an integrated HRIS feed, a starter may never generate a case record at all, reproducing exactly the failure already described (arriving with nothing arranged).",
      "severity": 5,
      "likelihood": 3,
      "mitigation": "Specify in the requirement that suppliers must state how the trigger event is sourced and what happens if that source is unavailable or the event is missed, rather than assuming a feed exists."
    },
    {
      "component": "Task Orchestration",
      "description": "Because no HR/IT/facilities/payroll systems are named (context index 6, excluded), the orchestration component has no defined integration surface. Suppliers may each assume different task sources or handoff mechanisms, undermining the stated objective of like-for-like comparability across quotes (index 5).",
      "severity": 4,
      "likelihood": 4,
      "mitigation": "Require the requirement document to list, or explicitly flag as open, which systems each function currently uses, so suppliers quote against the same integration assumptions rather than each inventing their own."
    },
    {
      "component": "IT Provisioning Task",
      "description": "This task component is explicitly tied to the named failure mode (starter with no laptop, index 1). If its completion-reporting step fails silently, orchestration will show no discrepancy and the same failure recurs even after automation.",
      "severity": 4,
      "likelihood": 3,
      "mitigation": "Require the task component to positively confirm completion rather than rely on absence-of-failure, and have Completion Tracking flag any task with no status update within the (yet-to-be-defined) window."
    },
    {
      "component": "Facilities Task",
      "description": "Like the IT task, this component depends on the function actually reporting completion; with no named system for facilities (index 6, excluded), reporting could be manual and inconsistent, allowing missed steps to persist undetected.",
      "severity": 3,
      "likelihood": 3,
      "mitigation": "Require suppliers to specify how facilities completion is captured (manual confirmation vs system integration) so the reporting mechanism is not left undefined."
    },
    {
      "component": "Payroll Setup Task",
      "description": "Payroll errors (e.g. a starter not paid on time) are a downstream consequence if this task's completion is not reliably reported, and no payroll system is named (index 6, excluded) to check against.",
      "severity": 4,
      "likelihood": 2,
      "mitigation": "Require the requirement to state whether payroll setup has a hard deadline tied to pay run cycles, and have suppliers quote against confirming completion before that cycle."
    },
    {
      "component": "Task Orchestration",
      "description": "With ~60 starters/year across two offices (index 2), volume is low but spread across two locations; if orchestration does not account for location-specific task variants (e.g. different facilities per office), tasks could be misassigned or omitted for one site.",
      "severity": 3,
      "likelihood": 2,
      "mitigation": "Require the requirement to confirm whether task definitions differ by office and, if so, that orchestration must support location-specific task sets."
    }
  ],
  "no_risks_statement": null
}
```

### Edge cases and practices

```json
{
  "edge_cases": [
    {
      "component": "New Starter Intake",
      "scenario": "A new starter's details are entered late, close to or after their start date, since no lead-time rule is stated for when a case must be created relative to start date",
      "consequence": "The case record is created too late for IT, facilities and payroll tasks to complete before the start date, reproducing the exact 'no laptop' failure the input describes",
      "handling": "Not currently handled — the architecture assumes tasks finish before start date (context index 9, assumed) but defines no minimum lead time; this would need to be resolved in Task Orchestration or Intake before it can prevent the failure"
    },
    {
      "component": "Task Orchestration",
      "scenario": "Two starters begin on the same date across the two offices, or a starter's office location affects which facilities/IT variant of a task applies",
      "consequence": "Tasks could be assigned without office-specific routing, or volume at ~60/year concentrated around common start dates could overload a function's task queue",
      "handling": "Not addressed in the design; orchestration's task assignment logic would need office-awareness, which is not specified because no named systems or office-specific processes are given"
    },
    {
      "component": "IT Provisioning Task",
      "scenario": "IT marks a task complete but the equipment provisioned is wrong or incomplete (e.g. laptop ordered but not the right accessories), so the status report says 'done' while the outcome is not",
      "consequence": "Completion Tracking sees the task as resolved and takes no escalation action, so the described failure (starter arrives without needed equipment) can recur even with the process 'working'",
      "handling": "Not handled — the design as described tracks binary completion status only; no verification step exists between marking complete and the outcome actually being correct"
    },
    {
      "component": "Completion Tracking and Escalation",
      "scenario": "The escalation window against which lateness is judged is undefined (per unknown_disposition index 9, assumed), so a task sitting open for any length of time has no rule to trigger escalation",
      "consequence": "Escalation may never fire, or may fire arbitrarily inconsistently, leaving missed steps undetected until the start date — the same failure mode this component exists to prevent",
      "handling": "Explicitly left undefined in the architecture; the design states this must be resolved rather than assigning an invented number of days"
    },
    {
      "component": "New Starter Intake",
      "scenario": "A starter's start date changes or the hire is cancelled after a case record has already been created and tasks assigned to IT, facilities and payroll",
      "consequence": "Functions may complete or continue working on tasks for a starter who no longer needs them, wasting effort, or a cancelled case may sit open indefinitely in Completion Tracking generating false escalations",
      "handling": "Not addressed — no component in the architecture handles case update or cancellation after creation"
    },
    {
      "component": "Task Orchestration",
      "scenario": "A function (e.g. facilities) has no task applicable for a particular starter type (e.g. a fully remote hire needing no desk or building access)",
      "consequence": "Completion Tracking would wait indefinitely for a task that was never meant to be completed, eventually raising a false escalation",
      "handling": "Not addressed — orchestration's task assignment logic is not described as handling conditional/optional tasks per starter type"
    }
  ],
  "practices": [
    {
      "applies_to": "Completion Tracking and Escalation",
      "practice": "Define and record an explicit expected-completion window per task type before this component is built, rather than leaving it implicit",
      "rationale": "The component's entire function is to detect lateness, but unknown_disposition index 9 leaves the window undefined; without it the component cannot distinguish 'still in progress' from 'missed'"
    },
    {
      "applies_to": "New Starter Intake",
      "practice": "Establish a single authoritative trigger point (one system or one record) that creates the case, rather than allowing multiple entry paths",
      "rationale": "The input names four separate departments (HR, IT, facilities, payroll) that could each plausibly originate starter information; without one authoritative trigger the coordination failure the design exists to fix could simply move upstream"
    },
    {
      "applies_to": "IT Provisioning Task, Facilities Task, Payroll Setup Task",
      "practice": "Require each task's completion report to confirm which specific sub-step was done, not just a single complete/incomplete flag",
      "rationale": "The named failure (starter with no laptop) shows that binary 'task done' status is insufficient to catch partial completion, which is the exact gap in this design's current status model"
    }
  ]
}
```

### Platform recommendation

```json
{
  "criteria_applied": [
    {
      "criterion": "The user explicitly states they do not want a proposed solution design, but a vendor-neutral requirement so three suppliers can quote against the same spec",
      "context_index": 3,
      "component": null
    },
    {
      "criterion": "No specific HR, IT, ticketing or payroll systems are identified, so no platform's integration capability can be assessed",
      "context_index": 6,
      "component": null
    },
    {
      "criterion": "No budget or spending limit is stated, so affordability of any platform cannot be judged",
      "context_index": 7,
      "component": null
    },
    {
      "criterion": "No information on who would operate or maintain the automation (in-house capability vs supplier-managed) is given, so operability cannot be matched to a platform",
      "context_index": 8,
      "component": null
    },
    {
      "criterion": "Scale is modest (about 60 new starters a year across two offices), which constrains what volume any recommendation would need to support but does not by itself select a platform",
      "context_index": 2,
      "component": null
    },
    {
      "criterion": "No timing or lead-time requirement is stated, so escalation-window capability cannot be matched to a platform feature",
      "context_index": 9,
      "component": null
    }
  ],
  "recommended_platform": null,
  "also_required": [],
  "rationale": "Two independent reasons rule out naming a platform here. First, the context states directly that the user does not want a proposed solution design at all — they want a vendor-neutral requirement precisely so three suppliers can quote against the same spec next month. Naming a platform would substitute this analysis's judgement for the comparative process the user is deliberately running, and would undercut the stated objective of comparability across suppliers on a like-for-like basis. Second, even setting that aside, the context is marked 'thin' and leaves unresolved exactly the facts that would be needed to choose defensibly between platforms: which HR, IT, ticketing and payroll systems exist today (so no platform's integration or connector fit can be checked), what budget is available (so no platform's cost can be assessed as affordable or not), and who would operate the result day to day (so no platform's ease-of-use or admin burden can be matched to real capability). Recommending a named platform against this input would mean inventing the missing facts to justify the choice, which is exactly what this analysis must not do. The honest output is that the architecture — the case, task and escalation structure already derived — stands as the vendor-neutral specification, and the platform choice is properly left to the supplier comparison process the user is already running.",
  "alternatives_rejected": [
    {
      "platform": "A general-purpose iPaaS/integration platform (e.g. class of tools that connect named HR/IT/payroll systems)",
      "rejection_reason": "Its entire value proposition rests on connecting named source systems, and the context states no HR, IT, ticketing or payroll systems are identified; assessing this class's fit would require inventing which systems it must connect to."
    },
    {
      "platform": "A low-code workflow/orchestration platform run by an in-house team",
      "rejection_reason": "Suitability depends on whether in-house technical capability exists to build and maintain the workflow, and the context leaves who would operate the result unresolved; recommending this class would assume an operating model the input does not state."
    },
    {
      "platform": "A fully supplier-managed automation service",
      "rejection_reason": "Affordability and scope depend on budget, which the context states is not given; recommending a managed service commits to a cost structure with no stated ceiling to check it against."
    }
  ],
  "fit": [
    {
      "component": "New Starter Intake",
      "how": "The requirement can specify the trigger and case-creation behaviour functionally (what data must be captured, when the case must open) without binding it to any named platform, preserving the vendor-neutral spec suppliers will quote against."
    },
    {
      "component": "Task Orchestration",
      "how": "The requirement can describe the assignment and status-holding behaviour needed across HR, IT, facilities and payroll as a functional capability, leaving each supplier free to propose how their platform implements it."
    },
    {
      "component": "IT Provisioning Task",
      "how": "The task's inputs, outputs and completion-reporting requirement are stated functionally; which system or tool logs IT completion is left open for the supplier to propose, consistent with no IT system being named."
    },
    {
      "component": "Facilities Task",
      "how": "Same treatment as the IT task: the functional requirement to track and report completion is specified without prescribing the facilities system, since none is named."
    },
    {
      "component": "Payroll Setup Task",
      "how": "Same treatment: the completion-tracking requirement is specified functionally, with the payroll system deliberately left unspecified pending the missing system information."
    },
    {
      "component": "Completion Tracking and Escalation",
      "how": "The requirement can state the need for cross-function status monitoring and escalation on missed deadlines as a capability suppliers must demonstrate, without prescribing the escalation window (undefined per the timing unknown) or the mechanism, so each supplier's proposal remains comparable on the same functional ask."
    }
  ],
  "knowledge_currency_note": "No platform is named here, so no capability claim is made; however, if a platform is later considered against supplier responses, note that platform capabilities, integration coverage and pricing change over time and should be verified against each supplier's current documentation before any commitment is made."
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

