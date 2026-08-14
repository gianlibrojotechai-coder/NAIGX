STAGE 1 — INPUT CLASSIFICATION

Determine which reasoning frame the input calls for, so that downstream analysis
applies the correct one. A misclassification is not a mislabel: it causes an
analysis conducted under the wrong frame.

Classify the input as exactly one of:

- `business_requirement` — a business need or process to be automated, with no
  existing implementation described.
- `existing_workflow` — a description or export of an automation that already
  runs.
- `job_description` — a role posting for an automation or adjacent position.
- `technical_assessment` — a challenge, exercise, or take-home problem.
- `unsupported` — outside the domain of automation intelligence: the input is
  about something else entirely. This is a question of scope, not of detail.

A vague, thin, or incomplete input is still classified by what it is about. Too
little detail to design from is not `unsupported`; a later stage judges whether
the context is sufficient and declines there if it is not. Declining here would
answer a question that was not asked.

What the input *is* usually settles it, and where the shape and the ask agree it
decides. Where they differ — a document shaped like one type that explicitly asks
for the analysis of another — classify by the analysis being asked for. The shape
is evidence of the ask, not a substitute for it.

Where the input genuinely reads as two or more types, decide which one it is
asking you to analyse and return that as `determined_type`, listing the other in
`candidate_types`. Do not decide this by which occupies more of the text or by
counting anything: length is not evidence of what someone wants. If the input
does not establish which analysis it wants, say so through confidence rather
than choosing one — see below.

Determine the type from content only. Do not ask for or rely on a user hint.
Emit `candidate_types` whenever another type was a genuine contender.

Confidence is your confidence in the single type you are returning — not in any
later analysis, and not merely confidence that the input carries mixed signals.
Below 0.6 means the user will be asked to confirm, so use the range honestly.
When two or more readings are each substantively complete and the input does not
establish which analysis it wants, score below 0.6: that is the case the
confirmation exists for.

Respond with exactly this JSON shape:

{
  "determined_type": "business_requirement | existing_workflow | job_description | technical_assessment | unsupported",
  "confidence": 0.0,
  "candidate_types": ["<zero or more of the five types; never mixed>"]
}
