STAGE 9 — INTEGRATION REQUIREMENTS (BUSINESS REQUIREMENT)

State the integration requirements of the architecture you are given: every
external system it touches, what the integration is for, which way data
flows, what the system's API must offer, and what constrains it.

You are given the context set (each element carries its `index`) and the
architecture Stage 6 derived from it: its components, their integrations
(`external_system` and `integration_direction`), and how each unknown was
disposed of. **These are the only sources for what the design integrates.**
List exactly the external systems the architecture names — one entry per
component-and-system pair — and nothing the architecture does not name. A
design with no `external_system` at all has no integrations, and you say so
in `no_integrations_statement`.

FIELDS, PER INTEGRATION

- `system` — the `external_system` **copied exactly** from the component.
- `component` — the component's `name`, **copied exactly**.
- `purpose` — what the integration is for, in terms of this design.
- `direction` — `inbound`, `outbound` or `bidirectional`, agreeing with the
  component's `integration_direction`.
- `capabilities_required` — what the system's API must offer for this
  integration to work: the operation (read invoices, create a bill, post a
  message), the trigger (webhook on new item, polling a list), the data
  (attachments, custom fields), the guarantee (idempotent create, stable
  ids). At least one.
- `constraints` — what the EXTERNAL SYSTEM imposes on the integration: rate
  limits, the auth model, pagination behaviour, payload and file-format
  limits, plan or licence limits, sandbox availability. A constraint is a
  property of the system, not of this design: how the design retries,
  queues or escalates belongs to the architecture's `failure_handling`
  and is **not** a constraint. **Label each by provenance:**
  - `stated` — a context element says it; `context_index` is REQUIRED and
    is the `index` of that element. A `stated` constraint with no
    `context_index` is refused.
  - `general_knowledge` — what you know of the platform in general, with
    `context_index` `null`. If you cannot point at the context element,
    it is general knowledge. This is exactly the knowledge that goes stale,
    and the note below covers it.
  Only list a constraint you can state concretely. "There may be rate limits"
  is not a constraint; "the public API allows 60 calls per minute per
  connection" is.
- `uncertainties` — what you do not know about the system's current
  capability and the builder must verify before relying on it: whether an
  endpoint still exists, whether webhooks are offered on the plan in use,
  whether a field is writable. **Disclose uncertainty here; never assert a
  capability you are not sure of as required and available.** May be empty
  only when nothing about the integration is uncertain.

`knowledge_currency_note` — always present: a sentence telling the reader
that platform capabilities, limits and pricing change and that every
`general_knowledge` constraint and every capability must be verified against
the system's current documentation before building.

Respond with exactly this JSON shape:

{
  "integrations": [
    {
      "system": "...",
      "component": "...",
      "purpose": "...",
      "direction": "outbound",
      "capabilities_required": ["..."],
      "constraints": [
        { "constraint": "...", "provenance": "stated", "context_index": 0 },
        { "constraint": "...", "provenance": "general_knowledge", "context_index": null }
      ],
      "uncertainties": ["..."]
    }
  ],
  "no_integrations_statement": null,
  "knowledge_currency_note": "..."
}
