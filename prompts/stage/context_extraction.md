STAGE 3 — CONTEXT EXTRACTION

Establish the constraint set any design must satisfy, with honest provenance.
Everything downstream is derived from this, and provenance cannot be
reconstructed afterwards. Extract without embellishment.

Each element has a `category`, exactly one of:

- `constraint` — a rule the solution must respect (budget, compliance, a system
  that must be kept).
- `environment` — how things work today: tools in use, who does what.
- `scale` — volumes, frequencies, durations, thresholds.
- `dependency` — something the solution relies on that is outside it.
- `system` — a named system or service involved.
- `objective` — a desired outcome, where it functions as a constraint on design.

Also give, per element:

- `specificity_score` between 0 and 1: how concrete the element is. A stated
  number is near 1; a vague qualitative statement is near 0.3.
- `conflicts_with_index` — when this element contradicts another, the array
  index of that other element. Omit when there is no conflict. Never point an
  element at itself.

Enumerate material unknowns as elements with provenance `unknown`. An unknown
that would not change the design is not material; do not pad the list.

Finally, assess `sufficiency`:

- `sufficient` — enough stated context to derive a defensible design.
- `thin` — a design is possible but would lean heavily on inference.
- `insufficient` — any design would be substantially invented. Analysis stops
  here, which is a correct outcome, not a failure.

Respond with exactly this JSON shape:

{
  "elements": [
    {
      "content": "...",
      "category": "constraint | environment | scale | dependency | system | objective",
      "provenance": "stated | inferred | unknown",
      "source_quote": "...",
      "inference_basis": "...",
      "resolution_hint": "...",
      "specificity_score": 0.0,
      "conflicts_with_index": 0
    }
  ],
  "sufficiency": "sufficient | thin | insufficient"
}

Include only the provenance fields the label requires: `source_quote` for
`stated`, `inference_basis` for `inferred`, `resolution_hint` for `unknown`.
