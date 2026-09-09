STAGE 6 — ARCHITECTURE ANALYSIS

Derive the design from the extracted context: components, boundaries, data
flow, integration points, and failure handling.

You are given the classification, the intent record, and the context set as a
JSON object. Work from those. Do not reach past them to the original text for a
fact the context set does not contain — if something needed is missing, it is
missing, and the design must acknowledge that rather than assume it.

Produce the architecture and nothing else. The classification, intent and
context have already been established and must not be repeated or revised.
Platform selection, risk analysis, complexity scoring and diagrams are separate
work and are not part of this response.

Every component must:

- Have a single clear `responsibility`. A component that does several unrelated
  things is two components.
- State its `inputs` and `outputs` concretely — what enters it and what leaves.
- State `failure_handling` for itself specifically: what happens when this
  component fails. A general statement about the system is not failure handling
  for a component.
- Cite `grounded_in_context_indices`: **copy the `index` value printed on each
  context element** you are grounding in. Do not count positions in the list and
  do not renumber from one — every element carries its own `index`, and that is
  the number to use. **At least one.** A component that addresses no extracted
  requirement is a defect, not a design choice. Cite the elements the component
  actually addresses, not every element that seems related.

Where a component talks to something outside the system, give both
`external_system` (what it talks to) and `integration_direction` (which way the
data moves — for example `outbound`, `inbound`, or `bidirectional`). Give
neither for purely internal components.

`summary` states what the design does in a few sentences. `data_flow_description`
describes how data moves through the components end to end.

Design for what the context supports. Where an unknown element makes part of the
design uncertain, prefer the simpler structure and let the unknown stand.

DISPOSE OF EVERY UNKNOWN. The context set marks some elements
`provenance: "unknown"` — things the input does not settle. A design that
cites an unknown as if it were known is a design built on an assumption
nobody stated. So `unknown_disposition` lists **every** unknown element
exactly once, by its `index`, and says what the design did about it:

- `assumed` — the design proceeds on a stated assumption. `statement` says
  what was assumed, so the reader can check it.
- `excluded` — the design leaves that part out until it is known.
  `statement` says what is left out and what it would take to include it.
- `deferred` — the design accommodates either answer, and the decision is
  deferred to the reader. `statement` says where the design would differ.

List only unknown elements here — never a stated or inferred one. An empty
list is correct only when the context set contains no unknown element.

Respond with a single JSON object containing exactly these four top-level
keys — `summary`, `data_flow_description`, `components` and
`unknown_disposition` — and no others, except where the section below adds
two for one specific path:

{
  "summary": "...",
  "data_flow_description": "...",
  "unknown_disposition": [
    { "context_index": 4, "disposition": "assumed | excluded | deferred", "statement": "..." }
  ],
  "components": [
    {
      "name": "...",
      "responsibility": "...",
      "inputs": "...",
      "outputs": "...",
      "failure_handling": "...",
      "external_system": "...",
      "integration_direction": "...",
      "grounded_in_context_indices": [0]
    }
  ]
}

ON THE TECHNICAL-ASSESSMENT PATH ONLY

When the classification is `technical_assessment`, the output is something the
user must be able to defend under questioning, not merely a design. Add two
further top-level keys:

- `trade_offs` — what this approach gives up in exchange for what it gains.
  Each entry states the `choice` made and what is `accepted` as its cost. A
  cost stated as a benefit is not a trade-off.
- `rejected_approaches` — **at least one** named alternative that was
  considered and not taken. Each entry gives the `approach` and the
  `rejection_reason`. "It was worse" is not a reason; say what it was worse at,
  in terms of this context.

Both keys are omitted entirely on every other path.

{
  "trade_offs": [{ "choice": "...", "accepted": "..." }],
  "rejected_approaches": [{ "approach": "...", "rejection_reason": "..." }]
}
