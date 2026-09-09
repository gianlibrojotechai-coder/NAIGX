STAGE 9 — PLATFORM RECOMMENDATION (BUSINESS REQUIREMENT)

Recommend the execution platform for the architecture you are given — or
recommend no platform — stating the criteria you applied and the alternatives
you rejected, with reasons.

You are given the context set (each element carries its `index`) and the
architecture Stage 6 derived from it: its components, their
integrations, and how each unknown in the context was disposed of. **These are
the only sources.** Recommend for this architecture and this context; do not
recommend for automation in general.

THE CRITERIA COME FIRST, AND THEY COME FROM THE CONTEXT. Before naming a
platform, list `criteria_applied` — the things that decided it, each traced to
the context element (`context_index`) or component (`component`) it rests on:
who will operate the result, what must remain the system of record, the
volume, the budget, the integrations the components need, the failure
handling they require. A criterion the context does not support is one you
invented; leave it out.

THEN THE RECOMMENDATION. `recommended_platform` is the platform's name, or
`null` when the honest answer is **no platform** — the process is better left
as it is, or a build is not justified by what the context says. `null` is a
correct and valuable outcome, and `rationale` must then say why. When you name
a platform, `rationale` says, in terms of the criteria, why it and not the
others. Multi-platform is permitted: name the primary in
`recommended_platform` and the others in `also_required`, each with its role.
When `recommended_platform` is `null`, `also_required` is `[]` — there is
nothing for another platform to accompany; systems the process keeps using
as it is belong in `rationale`, not there.

THEN WHAT YOU REJECTED. `alternatives_rejected` names **at least one** platform
you considered and did not choose, with `rejection_reason` stated against the
criteria — not "worse", but what it is worse at, for this context. A
recommendation without a rejected alternative cannot be questioned and is not
one.

WHAT YOU MUST NOT DO. Favour no platform by default; the recommendation must
follow from the criteria, and the same criteria on a different context must be
able to reach a different answer. Use no promotional or partnership language —
no "leading", "best-in-class", "trusted by", no pricing tiers quoted as fact.
Do not assert a platform capability you are not sure of: where a capability is
uncertain, say so in `knowledge_currency_note`, which is required and must
state that platform capabilities and pricing change and the reader should
verify against the platform's current documentation before committing.

`fit` — for each component of the architecture, one line on how the
recommended platform (or the recommended non-automation) covers it: the
component's `component` name copied exactly, and `how`. Every component,
none invented.

Respond with exactly this JSON shape:

{
  "criteria_applied": [
    { "criterion": "...", "context_index": 3, "component": null },
    { "criterion": "...", "context_index": null, "component": "..." }
  ],
  "recommended_platform": "... | null",
  "also_required": [ { "platform": "...", "role": "..." } ],
  "rationale": "...",
  "alternatives_rejected": [
    { "platform": "...", "rejection_reason": "..." }
  ],
  "fit": [ { "component": "...", "how": "..." } ],
  "knowledge_currency_note": "..."
}
