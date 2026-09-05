STAGE 9 — PORTFOLIO SUGGESTIONS (JOB DESCRIPTION)

Turn the decisive technical gaps into the smallest practical set of portfolio
projects that would close them.

You are given `eligible_gaps` — already filtered. Every gap listed is one the
analysis reported, judged technical, and named as decisive. **These are the
only gaps you may build against.** Do not add gaps, do not invent requirements,
and do not build toward anything behavioural, sector-specific, or about the
operator's history: those cannot be closed by building and were excluded before
you were called. Copy `requirement_id` exactly; do not renumber.

You are also given `matched_capabilities` — what the operator can already
evidence. Use it to shape projects that extend proven ground rather than start
from nothing, but never claim a capability that is not listed there.

CONSOLIDATE. One project per gap is the naive answer and the wrong one. A
single well-chosen system can demonstrate several gaps at once, and a hiring
manager reads one strong project more carefully than five thin ones. Group gaps
that a real workflow would naturally exercise together.

- Every eligible gap must be addressed by at least one project.
- No project may address only gaps another project already covers.
- A project addressing a single gap must say, in `why_not_consolidated`, why it
  cannot fold into another.
- Do not pad the set. Fewer, stronger projects is the goal.

MAKE THEM REAL SYSTEMS. Each project must solve a plausible business problem
end to end — a trigger, processing, decisions, integrations, an outcome someone
would care about. A feature demo that exercises a tool without doing anything
useful is worth nothing in a portfolio. Prefer the workflow a small business
would actually pay for.

RANK THEM. `rank` is a total order starting at 1, no ties. Rank on: how many
important gaps the project closes, how strong the resulting evidence is, how
realistically the operator can finish it, and how far it carries beyond this
posting. The project ranked 1 is the one to build first.

FIELDS

- `complexity` — `simple`, `intermediate` or `advanced`, from the operator's
  side: how much unfamiliar ground the build crosses.
- `estimated_effort` — `hours`, `days` or `weeks`. Coarse on purpose. Do not
  invent precision you do not have.
- `secondary_capabilities` — what else the project demonstrates beyond the gaps
  it closes. Free text, not capability ids.
- `evidence_to_produce` — **what should exist when the build is done.** At
  least one item. This is the point of the project: evidence is what turns a
  build into something citable later. Prefer artifacts a stranger could open —
  a repository, a workflow export, a recorded walkthrough, documentation.
- `reusability` — how far this project carries to other postings. Its
  `provenance` is always `inferred`, and this is not a formality: this analysis
  has seen **one** job description and models no wider market. State in `basis`
  what the inference actually rests on — the requirements in this posting, the
  platforms named in it, the capability the project would demonstrate — and
  keep `claim` proportionate to that basis. Do not present a guess about market
  demand as an established fact.
- `consolidation_rationale` — why this number of projects, and what you merged.

Respond with exactly this JSON shape:

{
  "projects": [
    {
      "rank": 1,
      "name": "...",
      "complexity": "simple | intermediate | advanced",
      "primary_gaps": ["req-5", "req-6"],
      "secondary_capabilities": ["..."],
      "why_this_project": "...",
      "business_problem": "...",
      "what_to_build": "...",
      "workflow": ["Trigger: ...", "...", "Outcome: ..."],
      "platforms": ["..."],
      "technical_concepts": ["..."],
      "evidence_to_produce": [
        {
          "type": "workflow | repo | diagram | loom | doc | deployment | screenshot | test_evidence | sample_io",
          "what_it_shows": "..."
        }
      ],
      "why_not_consolidated": "only when primary_gaps has exactly one entry",
      "reusability": {
        "provenance": "inferred",
        "basis": "...",
        "claim": "..."
      },
      "estimated_effort": "hours | days | weeks",
      "portfolio_value": "..."
    }
  ],
  "consolidation_rationale": "..."
}

Every id in `primary_gaps` must be one of the `requirement_id` values given to
you, and every one of those ids must appear in at least one project.
