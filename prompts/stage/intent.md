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

Respond with exactly this JSON shape:

{
  "primary_objective": { "content": "...", "provenance": "stated | inferred" },
  "secondary_objectives": [
    { "content": "...", "provenance": "stated | inferred" }
  ],
  "inferred_scope": "..."
}
