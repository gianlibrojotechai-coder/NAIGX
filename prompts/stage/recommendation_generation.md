STAGE 7 — RECOMMENDATION GENERATION (JOB DESCRIPTION)

Decide whether the operator should apply to this posting now, or build
something first. You are given the classification, the intent record, the
context set, and the operator's capability profile.

The decision is the output. Everything else exists to justify it.

Extract `required_capabilities` — what the employer actually needs someone to
be able to do:

- `necessity` — `must_have` when the posting treats it as a requirement,
  `nice_to_have` when it is preferred, bonus, or listed as advantageous.
- `provenance` — `stated` when the posting says it, `inferred` when the posting
  implies it. Label honestly; an inferred requirement is still useful, and a
  reader must be able to tell which is which.
- `kind` — **what closing this requirement would actually take.** Judge the
  requirement itself, not how the posting phrased it.
  - `technical` — a capability an artifact could demonstrate. A named platform,
    tool, integration, or engineering skill. *"Build workflows in Zapier",
    "configure HubSpot automations", "deploy landing pages in Webflow".*
  - `domain_experience` — exposure to an industry or sector. Only working in
    that sector closes it. *"Experience in aerospace", "worked in B2B sales".*
  - `track_record` — a fact about history: years held, people trained, roles
    occupied, volume shipped. Proved by narrative and references, not by
    building one more thing. *"3+ years", "experience onboarding non-technical
    staff", "track record as a solo operator".*
  - `disposition` — a behavioural or character attribute. *"Resourceful",
    "works independently with minimal oversight", "switches tasks quickly",
    "stays current on emerging tools", "strong researcher".*

  Phrasing is not the test. "Track record of independent delivery" and
  "operates independently" are the same requirement; classify both on what
  would close them, not on which words the posting used.
- `grounded_in_context_indices` — **copy the `index` value printed on each
  context element** that supports this requirement. Do not count positions. At
  least one. A requirement the context set does not support is invented, and an
  invented requirement produces work the posting never asked for.

Then compare against the capability profile.

- `matched` — a requirement the operator can already evidence. Cite the
  `capability_id` from the profile and, in `evidence_ref`, **one of that
  capability's own evidence locators, copied character for character**.
  `evidence_ref` must appear verbatim in the `evidence` array of the capability
  named by `capability_id` in this same object. Never construct, complete,
  normalise, shorten or extend a locator; never add or change an anchor or
  fragment; never cite a locator belonging to a different capability. If no
  declared locator supports the requirement, it is a **gap** — report it there
  rather than citing something close.
- A capability whose `depth` is `familiar` is **not evidence**. It means no
  artifact proves it. Never cite one in a match; if a requirement is only
  covered by familiarity, it is a gap.
- `strength` — `strong` when the evidence plainly demonstrates the requirement,
  `partial` when it demonstrates a related but narrower or adjacent capability.
- `gaps` — a requirement with no matchable evidence. Give a `priority` and say
  in `why_it_matters` what its absence costs for **this** posting.

**Every requirement must appear exactly once — in `matched` or in `gaps`.**
Never both, and never neither. A requirement you drop is one the reader cannot
tell you considered, which is worse than one honestly reported as unmet. A
requirement of any `kind` can be a gap: not being able to evidence something is
independent of what closing it would take.

Then decide:

- `apply_now` — the must-haves are already evidenced well enough that building
  something first would not materially improve the application. **This is a
  correct and valuable answer.** Do not manufacture a gap to justify a build.
  The operator's time is the scarce resource, and a needless project costs more
  than a slightly imperfect application.
- `build_first` — a gap is significant enough that closing it would materially
  improve the chances. Name the gaps that drove the decision in
  `decisive_gaps`; they must be gaps you reported, and **every one of them must
  be a requirement whose `kind` is `technical`.** A build closes nothing
  behavioural: recommending a project to fix "resourcefulness" or "five years
  in aerospace" gives the operator work they can never finish.

`build_first` exists only when `decisive_gaps` names at least one technical
gap you reported. A `build_first` with an empty `decisive_gaps` is rejected:
nothing would state what the build has to close, or when the operator is done.
So decide the two together — if you conclude `build_first`, the gaps that
made it so go in `decisive_gaps`; if you cannot name one, the verdict is
`apply_now` and the rationale says which gaps remain and why building would
not close them.

If every gap you found is `domain_experience`, `track_record` or `disposition`,
there is no buildable gap and the verdict is `apply_now` — building would not
change the outcome. When you do that, **say so in the rationale**: name the
significant gaps that remain and why building would not close them. The
operator should never read `apply_now` and conclude the posting was a clean
fit when it was not.

`rationale` states the reasoning in a few sentences, in terms of the specific
requirements and evidence — not generalities about the role.

Where the posting is vague, say so through provenance and gap priority rather
than inventing specificity.

Do not design the build here. What to build, how to test it, and what evidence
to produce are later work. This stage decides only whether to build at all, and
names what a build would have to close.

Respond with exactly this JSON shape:

{
  "required_capabilities": [
    {
      "id": "req-1",
      "name": "...",
      "necessity": "must_have | nice_to_have",
      "provenance": "stated | inferred",
      "kind": "technical | domain_experience | track_record | disposition",
      "grounded_in_context_indices": [0]
    }
  ],
  "matched": [
    {
      "requirement_id": "req-1",
      "capability_id": "cap-001",
      "strength": "strong | partial",
      "evidence_ref": "<copy one locator verbatim from that capability's evidence[]>"
    }
  ],
  "gaps": [
    {
      "requirement_id": "req-2",
      "priority": "high | medium | low",
      "why_it_matters": "..."
    }
  ],
  "verdict": {
    "decision": "apply_now | build_first",
    "rationale": "...",
    "criteria_applied": "...",
    "decisive_gaps": ["req-2"],
    "alternatives": [
      {
        "alternative": "<the option you did not take>",
        "rejection_reason": "<why this evidence made it the weaker choice>"
      }
    ]
  }
}

Every requirement id must appear exactly once across `matched` and `gaps`, and
every id in `decisive_gaps` must belong to a requirement whose `kind` is
`technical`.

STATE WHAT YOU WEIGHED, AND WHAT YOU REJECTED.

`criteria_applied` names the standard the decision was made against — which
requirements counted, how a gap was judged decisive, and what would have changed
the answer. A rationale says what you concluded; criteria say what you measured
it by, so a reader can disagree with the standard rather than only the verdict.

`alternatives` must name **at least one** option you considered and did not
take, each with the reason the evidence made it weaker. The other verdict is
always available: if you concluded `build_first`, applying now is the rejected
alternative, and the reason is whatever makes the gap decisive. A decision with
nothing rejected cannot answer "why this, not the other?".

Do not manufacture an alternative you did not consider. Where the only real
alternative is the opposite verdict, name that one plainly.
