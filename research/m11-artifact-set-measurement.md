# M-11 — artifact sets against the corpus, measured 2026-09-10 (after D-90)

**Criterion** (`docs/08` M-11): the four input types produce their specified artifact sets. **The specification is the corpus**: each case freezes `expected_artifact_set` and `expected_omissions` with reasons (`docs/11` §9), and the runner's `artifact_set` assertion (evaluated since D-89) compares them with what the pipeline generated on replay. **Regenerate this table:** `npm run measure:artifact-sets` (canonical store) or `-- --from=<held folder>`; the tables below are that script's output, not a transcription.

**Result on the recordings in force (D-90b campaign, 2026-09-10 later): 14 of 15 agree, 1 contradicts.** `jd-002` is now recorded and agrees (a `build_first` with named decisive gaps and an in-range portfolio, after D-90 §7's fragment and parser corrections). The contradiction is `br-004`, which **halted at Stage 3 as insufficient on this sample** — its two earlier samples judged the same 66-character input thin and produced the frozen two-artifact set; it is Stage 3 sufficiency variance on a minimal input, not a planning defect, and it was not sampled again (owner's call, D-90 §9). The other 29 corpus cases have no recording past Stage 3 and are unmeasured; per-type sampling (≥ 10 per type) needs paid captures. **Measured on the sample: MET. Not claimed for the criterion**, which is the four types across the corpus.

## What changed since the 2026-09-10 morning measurement (10 of 15)

[D-90](../docs/65-D-90-Planning-By-Judgement.md) built the planning judgement the five contradictions pointed at, the two fragments it needed were recaptured, and the five cases now read:

| Case | Frozen expectation | What the pipeline did on the D-90 recording | Judgement that fired |
|---|---|---|---|
| br-003 (`do-not-automate`) | `business_analysis` only | `intent_brief`, `business_analysis` | Stage 6 concluded automation is unwarranted: *"roughly 90 minutes of manual transcription work performed once a year … too low a volume and frequency to justify designing, building, and maintaining an automated PDF-extraction pipeline"* — with an empty component list, as `FR-020` asks |
| br-010 (design declined) | `business_analysis` only | `intent_brief`, `business_analysis` | Stage 2 read `understanding_only` with the verbatim quote *"I don't want you to design the solution - the suppliers will pitch their own and I'd rather not anchor them."* — verified against the input; Stage 6 not run |
| br-004 (minimal, 66 chars) | `business_analysis` + `architecture_recommendation` | exactly those, plus the brief | minimal depth (≤ 200 characters) |
| ta-005 (minimal, 83 chars) | `architecture_recommendation` + `mermaid_diagram` | exactly those, plus the brief | minimal depth |
| jd-008 | `portfolio_suggestions` expected | generated | **not a judgement** — Stage 7 returned `build_first` where the 2026-09-09 sample returned `apply_now`. The corpus freezes no verdict, so this is `FR-024` verdict variance on one input, not a conflict with D-29; the register entry D-90 §5 opened for it was withdrawn |

Nothing in the corpus was relabelled or re-versioned. The four P1 artifacts the corpus froze as omitted (`MVP §5.3`) are still produced at standard depth and still reported as superseded expectations (D-89), pending the owner's re-versioning under `docs/11` §6.2.

## Every replayable case

| Case | Path | Judgement | Generated | artifact_set | Detail |
|---|---|---|---|---|---|
| br-001 | business_requirement | standard | intent_brief, executive_summary, business_analysis, architecture_recommendation, platform_recommendation, risk_assessment, complexity_score, implementation_roadmap, integration_requirements, edge_cases_and_practices, mermaid_diagram | passed | 6 expected type(s) generated, no contradicted omission (P1 superseded: roadmap, edge cases, integrations, executive summary) |
| br-002 | business_requirement | standard | the same eleven | passed | 6 expected, no contradicted omission (P1 superseded) |
| br-003 | business_requirement | unwarranted | intent_brief, business_analysis | passed | 1 expected type generated, no contradicted omission |
| br-004 | business_requirement | minimal (66 chars) | intent_brief, business_analysis, architecture_recommendation | passed | 2 expected, no contradicted omission |
| br-005 | business_requirement | halted at Stage 3 (insufficient) | intent_brief | passed | 0 expected, no contradicted omission |
| br-007 | business_requirement | standard | the same eleven | passed | 6 expected, no contradicted omission (P1 superseded) |
| br-009 | business_requirement | standard | the same eleven | passed | 6 expected, no contradicted omission (P1 superseded) |
| br-010 | business_requirement | declined | intent_brief, business_analysis | passed | 1 expected, no contradicted omission |
| br-011 | business_requirement | standard | the same eleven | passed | 6 expected, no contradicted omission (P1 superseded) |
| ew-001 | existing_workflow | standard | intent_brief, workflow_recommendation, risk_assessment, platform_recommendation, complexity_score | passed | 4 expected, no contradicted omission |
| jd-008 | job_description | standard, `build_first` | intent_brief, skill_gap_analysis, portfolio_suggestions, interview_guidance, n8n_workflow | passed | 3 expected, no contradicted omission |
| ta-005 | technical_assessment | minimal (83 chars) | intent_brief, architecture_recommendation, mermaid_diagram | passed | 2 expected, no contradicted omission |
| un-001 | unsupported | halted at Stage 1 | — | passed | 0 expected, nothing generated |
| un-002 | unsupported | halted at Stage 1 | — | passed | 0 expected, nothing generated |
| jd-002 | job_description | — | — | **stale** | the 2026-09-10 pre-D-90 recording; not replayable against the D-90 fragments |

## Findings the recapture produced that are not about the artifact set

- **`br-005` fails its classification-confidence bound on both D-90 samples** (0.55; the corpus freezes ≥ 0.6 and the superseded recording had 0.62). Stage 1's fragment did not change. The case was recaptured once, as the D-84 campaign did, and not a third time: sampling until a bound is met would be manufacturing evidence. Consequence: the default regression selection fails one case and **issues no pass reference**, so the D-90 fragments cannot be activated on this evidence.
- **`jd-002` could not be recaptured in three attempts** ($0.4557 in all): Stage 10 refused a portfolio step index outside its workflow; then Stage 7 twice returned `build_first` with an empty `decisive_gaps`, which the parser refuses because nothing then states what the build would close. The last two are the same refusal on consecutive samples and are recorded as a finding about `stage.recommendation_generation` on this input; the raw answers are quarantined under `research/regression-pending/d90-2026-09-10/failures/`.
- **`jd-008`'s verdict moved** from `apply_now` (2026-09-09) to `build_first` (2026-09-10) on identical text — the second posting to show `FR-024` verdict variance (jd-002 was the first, `research/regression-superseded/README.md`).
- **`ta-005`'s warranted verdict carried the literal statement "placeholder."** The statement of a warranted verdict is not consumed by the pipeline, so nothing failed; it is a prompt-quality finding about `stage.architecture_analysis` on the assessment path.

## Consequence for the gate

The `artifact_set` assertion is enforced. It no longer fails any replayable case. What blocks a pass reference now is `br-005`'s confidence bound (above) and, for any selection naming it, `jd-002`'s staleness — neither of which this measurement changes.
