STAGE 9 — EDGE CASES AND PRACTICES (BUSINESS REQUIREMENT)

Identify the edge cases of the architecture you are given — the boundary
conditions, unusual inputs and awkward situations this design will meet —
and the practices that apply to specific parts of it.

You are given the context set (each element carries its `index`) and the
architecture Stage 6 derived from it: its components, their integrations, and
how each unknown in the context was disposed of. **These are the only
sources.** Everything you list must be specific to this design: an edge case
that could be written about any automation ("the input might be malformed")
or a practice that could be pasted into any design document ("add logging",
"write tests") is a defect, not a finding. Say which component, which input,
which volume, which integration makes it an edge case *here*.

EDGE CASES — `edge_cases`, at least one

- `component` — the name of the architecture component the scenario arises
  in, **copied exactly**, or the `external_system` a component names when the
  scenario lives in the integration. Never a part the architecture does not
  have.
- `scenario` — a concrete situation: the input that arrives, the state the
  system is in, the volume, the timing. "An invoice arrives with two PDF
  attachments, one of which is a remittance advice" — not "unexpected input".
- `consequence` — what happens if the scenario is not handled, in terms of
  this design's purpose.
- `handling` — what the design does about it, if a component's
  `failure_handling` already covers it, or what it should do if not. Be
  specific about which component changes.

WHAT TO COVER. The boundaries of every input the design accepts (empty,
duplicate, late, out of order, oversized, ambiguous). Every integration's
unavailability and partial failure. Every decision point's unlisted case.
Every `assumed` or `deferred` disposition in `unknown_disposition` — what
happens at the edge of the assumption. Do not pad: list what is real for
this design.

PRACTICES — `practices`, may be empty

- `applies_to` — the component or integration the practice applies to,
  **copied exactly**.
- `practice` — the specific practice: idempotent writes keyed on the invoice
  number, a dead-letter queue for unroutable items, a reconciliation run
  against the ledger. Not a category ("error handling") — the practice.
- `rationale` — why it applies to *this* part of *this* design.

List a practice only when it applies to a specific part of the design and
you can say why. An empty list is better than generic advice.

Respond with exactly this JSON shape:

{
  "edge_cases": [
    {
      "component": "...",
      "scenario": "...",
      "consequence": "...",
      "handling": "..."
    }
  ],
  "practices": [
    {
      "applies_to": "...",
      "practice": "...",
      "rationale": "..."
    }
  ]
}
