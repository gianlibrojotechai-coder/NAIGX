STAGE 9 — COMPLEXITY ASSESSMENT (BUSINESS REQUIREMENT, EXISTING WORKFLOW)

Score the five complexity factors of the `complexity-v1` scale for the
architecture you are given. You score the factors; the weighted score and the
0–100 complexity score are computed from your scores by fixed arithmetic, and
the reader will see your score, the weight and the contribution for every
factor. **Identical designs must receive identical scores** — score against
the anchors below, not against intuition.

You are given the context set (each element carries its `index`) and the
architecture: its components, their integrations, and how each unknown was
disposed of. On the existing-workflow path the architecture is the submitted
workflow as observed, and you score it as it is. **These are the only
sources.**

Score each factor as an integer from 1 to 5. Anchors are given at 1, 3 and 5;
2 and 4 fall between their neighbours.

- `workflow` — Workflow Complexity: the structural intricacy of the process —
  step count, branching, conditionality, loops, parallelism, human decision
  points. 1: linear sequence, no branching, few steps. 3: multiple branches or
  conditional paths, a moderate number of steps. 5: deep branching, loops,
  parallel paths, or many interacting decision points.
- `integration` — Integration Complexity: the systems the workflow must
  connect — how many, how heterogeneous, how well they expose what is needed.
  1: no integration, or one well-documented system. 3: several systems with
  conventional interfaces. 5: many systems, or systems with poor, absent or
  unstable interfaces.
- `data_logic` — Data Transformation / Logic Complexity: mapping, reshaping,
  validation, enrichment, business-rule density. 1: data passes through
  substantially unchanged, trivial rules. 3: recognisable mapping between
  differing representations, a moderate rule set. 5: extensive reshaping,
  reconciliation across sources, or dense interacting rules.
- `failure_risk` — Error / Failure Risk: how exposed the workflow is to
  failure and how demanding correct handling is — failure modes, consequence,
  idempotency and ordering, recoverability. This scores how difficult failure
  handling makes the design; it is not the risk register. 1: few failure
  modes, inconsequential, trivially retried. 3: several failure modes needing
  deliberate handling. 5: many failure modes, severe consequences, or
  demanding correctness properties such as idempotency or ordering.
- `operational` — Operational / Maintenance Complexity: the ongoing cost of
  running it — monitoring, intervention, change frequency, knowledge needed.
  1: runs unattended, changes rarely, no specialist knowledge. 3: periodic
  attention or routine change. 5: frequent intervention, continuous
  monitoring, or specialist knowledge to maintain. Where the input says
  little about operation, score what the design implies and say so.

`justification` — for each factor, one to three sentences naming the
components, integrations, rules, volumes or dispositions in *this* design
that put it at that anchor. A justification that could be written for any
design is a defect.

Respond with exactly this JSON shape — all five factors, each exactly once:

{
  "factors": [
    { "factor": "workflow", "score": 3, "justification": "..." },
    { "factor": "integration", "score": 3, "justification": "..." },
    { "factor": "data_logic", "score": 3, "justification": "..." },
    { "factor": "failure_risk", "score": 3, "justification": "..." },
    { "factor": "operational", "score": 3, "justification": "..." }
  ]
}
