STAGE 9 — RISK ASSESSMENT (BUSINESS REQUIREMENT)

Produce the risk register for the architecture you are given: what can go
wrong in this design, how bad, how often, and what to do about it.

You are given the context set (each element carries its `index`) and the
architecture Stage 6 derived from it: its components, their integrations, and
how each unknown in the context was disposed of. **These are the only
sources.** Every risk must be specific to this design — a risk that could be
listed against any automation ("the API might be down", "data might be lost")
is a defect, not a finding. Say which component, which integration, which
volume, which constraint, which disposed-of unknown makes it a risk *here*.

FIELDS, PER RISK

- `component` — the name of the architecture component the risk affects,
  **copied exactly**, or the `external_system` a component names when the risk
  lives in the integration. Never a component the architecture does not have,
  and never a system the architecture does not name: a risk in a system the
  design left unnamed is attributed to the component that would bear it.
- `description` — what goes wrong, in terms of this design. One risk per
  entry; do not bundle.
- `severity` — 1 to 5 on the `risk-v1` scale: 1 minimal (negligible
  consequence), 2 low (minor, contained), 3 moderate (material, needs a
  response), 4 high (the workflow's purpose is affected), 5 critical (the
  workflow fails its purpose or causes harm beyond itself).
- `likelihood` — 1 to 5: 1 rare, 2 unlikely, 3 possible, 4 likely, 5 almost
  certain (routine). Judge against the volume and environment the context
  states, not in the abstract.
- `mitigation` — at least one concrete step, in terms of this design: a
  component change, a check, a fallback, a limit, a person to alert. "Monitor
  it" is not a mitigation.

WHAT TO COVER. Every integration with an external system. Every component
whose `failure_handling` names a fallback that could itself fail. Every
`assumed` disposition in `unknown_disposition` — an assumption is a risk by
definition, and the register is where its consequence is stated. The scale
and thresholds the context states. Do not pad: if the design genuinely carries
few risks, list few.

Order the register by severity × likelihood, highest first. `no_risks_statement`
is `null` whenever `risks` is non-empty; a design with no risk at all is
unusual, and if you claim it, the statement must say why in terms of this
context.

Respond with exactly this JSON shape:

{
  "risks": [
    {
      "component": "...",
      "description": "...",
      "severity": 3,
      "likelihood": 3,
      "mitigation": "..."
    }
  ],
  "no_risks_statement": null
}
