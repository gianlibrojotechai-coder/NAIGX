STAGE 9 — IMPLEMENTATION ROADMAP (BUSINESS REQUIREMENT)

Sequence the implementation of the architecture you are given: the phases in
which it should be built, what each phase depends on, and what exists and
works when each phase is done.

You are given the context set (each element carries its `index`) and the
architecture Stage 6 derived from it: its components, their integrations, and
how each unknown in the context was disposed of. **These are the only
sources.** The roadmap is a sequence for building *this* design — a roadmap
that could be written for any automation ("phase 1: discovery; phase 2:
build; phase 3: rollout") is a defect, not a plan.

PHASES

- Order the phases so that what a phase needs already exists when it starts.
  Build first what other components consume; put a component's fallback path
  in the phase that builds the component, not in a later "hardening" phase;
  end with the phase after which the whole design exists.
- Number the phases `1` to n in the order you give them.
- Keep phases few and distinct. One phase may build several components;
  several phases may extend one component. Do not pad with phases that build
  nothing.

FIELDS, PER PHASE

- `ordinal` — 1 to n, in order.
- `name` — a short name for what the phase delivers.
- `objective` — what the phase sets out to do, in terms of this design: which
  components, which integrations, which disposed-of unknown it resolves.
- `components` — the names of the architecture components this phase builds
  or extends, **copied exactly**. Never a component the architecture does not
  have. **Every component of the architecture must appear in at least one
  phase**: at the end of the last phase, the whole design exists.
- `depends_on` — the ordinals of the earlier phases this one requires; empty
  for a phase that can start first. A phase may depend only on an earlier
  phase.
- `outcome` — what exists, and works, when this phase is done: what runs
  end to end, what a person can do that they could not before. Not "phase 1
  complete" — the state of the system.
- `estimate` — `null` unless the input supplied a basis for a calendar
  figure: a deadline, a stated capacity, a volume with a date. When it did,
  give `duration` and `basis_context_index` — the `index` of the context
  element that supplied the basis. **Never invent a duration.** Most inputs
  supply no basis, and the honest estimate is then no estimate.

`sequencing_rationale` — why the phases are in this order, in terms of the
design's dependencies: which component consumes which, which unknown must be
resolved before which build, which integration is the riskiest and therefore
proven first.

Respond with exactly this JSON shape:

{
  "phases": [
    {
      "ordinal": 1,
      "name": "...",
      "objective": "...",
      "components": ["..."],
      "depends_on": [],
      "outcome": "...",
      "estimate": null
    }
  ],
  "sequencing_rationale": "..."
}
