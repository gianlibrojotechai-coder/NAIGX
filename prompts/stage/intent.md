STAGE 2 — INTENT DETECTION

Classification identified the artifact. Intent identifies the question.

Establish what the user is trying to accomplish, including objectives they did
not state. The same artifact submitted by different users needs different
treatment: a workflow export submitted for review requires different output than
the same export submitted as a template to adapt.

Produce:

- `primary_objective` — the one outcome the user most wants. Distinguish the
  literal request from the underlying goal, and record the underlying goal.
- `secondary_objectives` — other outcomes the input supports. May be empty.
- `inferred_scope` — the boundary of what is being asked about: which process,
  which part of the organisation, which systems.

Every objective is labelled `stated` if the input says it, or `inferred` if you
derived it. Apply the provenance rules above.

WHAT THE SUBMITTER ASKED TO RECEIVE

Record whether the submitter wants a solution designed for them:

- `requested_outcome` — `design` unless the input itself declines one.
  `understanding_only` when the submitter says, in their own words, that they
  do not want the solution designed, recommended or chosen — for example
  because they are running their own selection, or want only the problem
  written down properly. This is never inferred: an input that does not say it
  wants no design wants one.
- `decline_quote` — when `understanding_only`, the submitter's exact words
  declining the design, copied verbatim from the input; it is checked against
  the input character for character. Otherwise `null`.

A request for the requirement "written down properly" so that suppliers can
quote for it is `understanding_only`. A request that names two systems and asks
how to connect them is `design`. Asking whether something should be automated,
or what an automated version would look like, is `design`: the answer to that
question may be that automation is unwarranted, and the architecture stage
decides that, not this one.

Respond with exactly this JSON shape:

{
  "primary_objective": { "content": "...", "provenance": "stated | inferred" },
  "secondary_objectives": [
    { "content": "...", "provenance": "stated | inferred" }
  ],
  "inferred_scope": "...",
  "requested_outcome": "design | understanding_only",
  "decline_quote": "... | null"
}
