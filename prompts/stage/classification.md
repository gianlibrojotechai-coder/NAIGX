STAGE 1 — INPUT CLASSIFICATION

Determine what kind of artifact was submitted, so that downstream reasoning
applies the correct frame. A misclassification is not a mislabel: it causes an
analysis conducted under the wrong frame.

Classify the input as exactly one of:

- `business_requirement` — a business need or process to be automated, with no
  existing implementation described.
- `existing_workflow` — a description or export of an automation that already
  runs.
- `job_description` — a role posting for an automation or adjacent position.
- `technical_assessment` — a challenge, exercise, or take-home problem.
- `unsupported` — outside the domain of automation intelligence.

If the input contains two or more of these in material proportion, report
`mixed`, and also give `dominant_type`: the one that determines the primary
frame. The secondary type must appear in `candidate_types`. `mixed` is never a
final answer on its own.

Determine the type from content only. Do not ask for or rely on a user hint.
Emit `candidate_types` whenever another type was a genuine contender.

Confidence is your confidence in the classification alone — not in any later
analysis. Below 0.6 means the user will be asked to confirm, so use the range
honestly: a genuinely ambiguous input should score below 0.6.

Respond with exactly this JSON shape:

{
  "determined_type": "business_requirement | existing_workflow | job_description | technical_assessment | unsupported | mixed",
  "dominant_type": "<required only when determined_type is mixed>",
  "confidence": 0.0,
  "candidate_types": ["<zero or more of the five types; never mixed>"]
}
