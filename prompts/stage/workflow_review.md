STAGE 6 — WORKFLOW REVIEW

The user has submitted a workflow that already exists. Your job is to describe
it as it is, and then evaluate it. You are not designing a replacement.

You are given the classification, the intent record, and the context set as a
JSON object. Work from those. Do not reach past them to the original text for a
fact the context set does not contain — if something needed is missing, it is
missing, and the review must say so rather than assume it.

STATE THE STRUCTURE BEFORE EVALUATING IT

`structure` describes the workflow the user submitted, step by step, in the
order the work happens. A reader who disagrees with your findings must be able
to see what you thought the workflow was. Each step must:

- Have a single clear `responsibility`. A step that does several unrelated
  things is two steps.
- State its `inputs` and `outputs` concretely — what enters it and what leaves.
- State `failure_handling` for that step specifically: what happens when this
  step fails. If the submitted workflow does not say, write that it does not
  say. Do not invent a recovery the user did not describe.
- Cite `grounded_in_context_indices`: **copy the `index` value printed on each
  context element** you are describing from. Do not count positions in the list
  and do not renumber from one. **At least one.** A step the submission does not
  describe is a step you invented.

Where a step talks to something outside the workflow, give both
`external_system` and `integration_direction` (for example `outbound`,
`inbound`, or `bidirectional`). Give neither for purely internal steps.

FINDINGS MUST NAME A STEP

Each entry in `findings` is a problem with *this* workflow. `component_index`
is the position of the step it concerns in the `structure` array you just
wrote, counting from zero. A finding you cannot attach to a step is a generic
best-practice statement, and generic statements are not wanted here.

- `description` says what is wrong, in terms of this workflow.
- `severity` and `likelihood` are integers from 1 to 5. Severity is how bad the
  consequence is; likelihood is how often it will happen. Do not use the scale
  to express how strongly you feel.
- `remediation` is a concrete change to this workflow. "Add error handling" is
  not a remediation; say what to handle, where, and what should happen instead.

A SOUND WORKFLOW GETS SAID SO

If you find no material issues, return an empty `findings` array and write
`soundness_statement` explaining what you checked and why the workflow holds.
Do not manufacture criticism to fill the list. Silence is not the same claim as
soundness, which is why the statement is required rather than optional.

`optimisations` are improvements that are not problems — the workflow is
correct without them. Each is a single sentence naming a specific change. Leave
the array empty if you have none.

`summary` states what the workflow does in a few sentences.
`data_flow_description` describes how data moves through the steps end to end.

Platform selection, complexity scoring, and diagrams are separate work and are
not part of this response.

Respond with a single JSON object containing exactly these top-level keys and
no others (`soundness_statement` may be omitted when `findings` is non-empty):

{
  "summary": "...",
  "data_flow_description": "...",
  "structure": [
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
  ],
  "findings": [
    {
      "component_index": 0,
      "description": "...",
      "severity": 3,
      "likelihood": 3,
      "remediation": "..."
    }
  ],
  "optimisations": ["..."],
  "soundness_statement": "..."
}
