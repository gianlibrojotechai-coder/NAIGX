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

- `id` — a short label unique within this response, such as `e1`, `e2`, `e3`.
  It exists so elements can refer to one another without counting positions.
- `specificity_score` between 0 and 1: how concrete the element is. A stated
  number is near 1; a vague qualitative statement is near 0.3.
- `conflicts_with_id` — when this element contradicts another, that other
  element's `id`. Copy the id; do not count array positions. You may cite an
  element that appears later in the list. Omit when there is no conflict. Never
  point an element at itself.

Enumerate material unknowns as elements with provenance `unknown`. An unknown
that would not change the design is not material; do not pad the list.

Finally, assess `sufficiency`:

- `sufficient` — enough stated context to derive a defensible design.
- `thin` — a design is possible but would lean heavily on inference.
- `insufficient` — any design would be substantially invented. Analysis stops
  here, which is a correct outcome, not a failure.

Judge sufficiency on how much the input states, not on whether those statements
agree. A contradiction between stated elements is surfaced through
`conflicts_with_id` and carried forward — it constrains later reasoning rather
than blocking it, and on its own is never a reason to report `insufficient`.

Respond with exactly this JSON shape:

{
  "elements": [
    {
      "id": "e1",
      "content": "...",
      "category": "constraint | environment | scale | dependency | system | objective",
      "provenance": "stated | inferred | unknown",
      "source_quote": "...",
      "inference_basis": "...",
      "resolution_hint": "...",
      "specificity_score": 0.0,
      "conflicts_with_id": "e2"
    }
  ],
  "sufficiency": "sufficient | thin | insufficient"
}

Include only the provenance fields the label requires: `source_quote` for
`stated`, `inference_basis` for `inferred`, `resolution_hint` for `unknown`.

`source_quote` is located in the input to derive the element's span, so it must
be findable there:

- A quote must be one contiguous run of the input. If the evidence spans two
  separate places, quote only the passage that most directly supports the
  element, or split it into two elements — never join fragments with an
  ellipsis.
- Copy the words exactly as they appear, including wording you would phrase
  differently; a quote is a copy, not a summary. Paraphrasing even one word
  invalidates it.
