STAGE 9 — PLATFORM COMPARISON (EXISTING WORKFLOW)

Recommend the execution platform for the workflow you are given — keep the
one it runs on, move it, or stop automating it — stating the criteria you
applied and the alternatives you rejected, with reasons.

You are given the context set (each element carries its `index`) and the
architecture Stage 6 identified: the workflow **as it exists**, step by step,
with each step's integrations. This is an observed structure, not a design;
it disposes of no unknowns. **These are the only sources.** Recommend for
this workflow and this context; do not recommend for automation in general,
and do not assume the workflow should move merely because it could.

THE CRITERIA COME FIRST, AND THEY COME FROM THE CONTEXT. Before naming a
platform, list `criteria_applied` — the things that decided it, each traced
to the context element (`context_index`) or step (`component`) it rests on:
what the workflow runs on today and who operates it, the volumes and failure
rates the context states, the systems the steps integrate and how, what must
remain the system of record, the budget. A criterion the context does not
support is one you invented; leave it out. **The absence of something is not a
criterion** — "no budget is stated", "no volume is given" cite nothing and are
refused; if a gap matters, say so in `rationale`.

THEN THE RECOMMENDATION. `recommended_platform` is the platform's name — the
current one when staying is the right answer, another when moving is — or
`null` when the honest answer is **no platform**: the process is better
returned to a manual or simpler form than kept as an automation. `null` is a
correct and valuable outcome, and `rationale` must then say why. When you
name a platform, `rationale` says, in terms of the criteria, why it and not
the others; when it is the current platform, say what the workflow gains from
staying and what would be lost by moving. Multi-platform is permitted: name
the primary in `recommended_platform` and the others in `also_required`,
each with its role. When `recommended_platform` is `null`, `also_required`
is `[]`.

`alternatives_rejected` — at least one, each with the reason it lost against
the criteria. If you recommend staying, the alternatives are the platforms a
move was considered to; if you recommend moving, the current platform is one
of them and its rejection reason is what the workflow suffers on it.

`fit` — one line per step of the workflow, **by the step's exact name**, saying
how the recommended platform covers it (or, for `null`, what happens to it).
Every step, once, and no step the workflow does not have.

`knowledge_currency_note` — always present: platform capabilities, limits and
pricing change; the reader is told to verify against current documentation
before committing.

Respond with exactly this JSON shape:

{
  "criteria_applied": [
    { "criterion": "...", "context_index": 0, "component": null }
  ],
  "recommended_platform": "...",
  "also_required": [],
  "rationale": "...",
  "alternatives_rejected": [
    { "platform": "...", "rejection_reason": "..." }
  ],
  "fit": [
    { "component": "...", "how": "..." }
  ],
  "knowledge_currency_note": "..."
}
