STAGE 9 — INTERVIEW GUIDANCE (JOB DESCRIPTION)

Turn the requirements this posting implies into the architectural
competencies the operator should be ready to speak to — and say, for each,
where the operator stands.

You are given `requirements` (every requirement the analysis extracted, with
its id, necessity, kind and provenance), `matched` (what the operator can
already evidence, with the capability id and the evidence locator), `gaps`
(what the operator cannot yet evidence) and the `verdict`. **These are the only
sources.** Derive every competency from the requirements listed; do not
introduce a competency the posting does not imply, and do not reach for the
generic interview canon ("tell me about a time…"). The `AI §9.1` rule for this
artifact is: derived from the posting, not generic. A competency that could be
listed for any automation role is not derived from this posting.

WHAT A COMPETENCY IS. Not a requirement restated. A requirement says what the
employer needs done; a competency is the architectural judgement an interviewer
will probe to find out whether the operator can do it — how a system should be
shaped, where it fails, what trade-off was accepted and why. Several
requirements usually collapse into one competency, and one requirement can
imply more than one. Group by judgement, not by tool.

FIELDS

- `rank` — a total order starting at 1, no ties. Rank on how likely the
  competency is to be probed for **this** posting and how much rides on it:
  a must-have requirement outranks a nice-to-have; a decisive gap outranks an
  evidenced strength, because it is where the interview can be lost.
- `name` — the competency, in the interviewer's terms.
- `derived_from` — **copy the `id` values of the requirements that imply it.**
  At least one. Every id must be one you were given. A competency with no
  requirement behind it is the generic canon and must not appear.
- `why_the_posting_implies_it` — the specific phrasing, scale, constraint or
  platform in this posting that makes the competency matter. Quote or
  paraphrase the posting; do not generalise.
- `be_ready_to_explain` — two to five things the operator should be able to
  say out loud: a design decision, a failure mode and how it is handled, a
  trade-off and its cost, a number where the posting gives one. Concrete,
  in the second person, each a sentence.
- `likely_question` — one question an interviewer for this role would
  plausibly ask to probe it. Specific to the posting's systems and scale.
- `evidence_to_cite` — the `capability_id` values from `matched` the operator
  can point to when answering. Copy them exactly. **Only ids from `matched`.**
  An empty list is correct when nothing in `matched` supports the competency;
  do not cite a capability to fill the field.
- `standing` — `evidenced` when `evidence_to_cite` is non-empty, `gap` when it
  is empty. State it; do not leave the reader to infer it.
- `how_to_handle_the_gap` — required when `standing` is `gap`: how to answer
  honestly without the evidence — what related experience to draw on, what
  to say about the build in progress if the verdict is `build_first`, what
  not to claim. `null` when `standing` is `evidenced`.

`framing` — two or three sentences on how to present the whole: what this
posting is really testing for, in the posting's own terms, and the one thing
the operator should make sure the interviewer hears.

Where the posting is vague about a competency, say so in
`why_the_posting_implies_it` rather than inventing specificity.

Respond with exactly this JSON shape:

{
  "competencies": [
    {
      "rank": 1,
      "name": "...",
      "derived_from": ["req-1", "req-4"],
      "why_the_posting_implies_it": "...",
      "be_ready_to_explain": ["...", "..."],
      "likely_question": "...",
      "evidence_to_cite": ["cap-001"],
      "standing": "evidenced | gap",
      "how_to_handle_the_gap": "... | null"
    }
  ],
  "framing": "..."
}
