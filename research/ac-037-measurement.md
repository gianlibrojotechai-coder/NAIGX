# AC-037 — depth proportional to complexity, measured 2026-09-10 (after D-90)

`PRD §15.3` `AC-037`: *"Output depth is proportional to input complexity across the regression suite"* (`PV §3.2`). `docs/08` Appendix C item 9 (D-34) says how it is tested: **artifact-set size against complexity score** (`DB §4.4`). This is that measurement, taken offline from the recordings in force by replaying each through the pipeline and reading the plan and the Stage 9 complexity score — `npm run measure:artifact-sets`, no provider, no spend. It supersedes the 2026-09-10 morning table, which found every scored requirement case planning the same eleven artifacts.

| Case | Path | Characters | Depth | Complexity score | Planned (incl. brief) | Generated |
|---|---|---|---|---|---|---|
| br-001 | business_requirement | 1637 | standard | 69 | 11 | 11 |
| br-002 | business_requirement | 1177 | standard | 68 | 11 | 11 |
| br-003 | business_requirement | 967 | standard (unwarranted) | — | 2 | 2 |
| br-004 | business_requirement | 66 | minimal | — | 3 | 3 |
| br-005 | business_requirement | 355 | — (halted at Stage 3) | — | 1 | 1 |
| br-007 | business_requirement | 1410 | standard | 60 | 11 | 11 |
| br-009 | business_requirement | 2152 | standard | 80 | 11 | 11 |
| br-010 | business_requirement | 647 | standard (declined) | — | 2 | 2 |
| br-011 | business_requirement | 2045 | standard | 84 | 11 | 11 |
| ew-001 | existing_workflow | 1455 | standard | 67 | 5 | 5 |
| jd-008 | job_description | 1889 | standard | — | 5 | 5 |
| ta-005 | technical_assessment | 83 | minimal | — | 3 | 3 |
| un-001 / un-002 | unsupported | 658 / 804 | — (halted at Stage 1) | — | 0 | 0 |
| jd-002 | job_description | — | stale recording, not replayed | — | — | — |

**Result: NOT SHOWN MET by the prescribed measure.** The set size now varies — 11, 5, 3, 2, 1 — where before D-90 it was fixed per path, and on the requirement path the two-, three- and eleven-artifact plans do follow the inputs the corpus authored as minimal, declined or unwarranted. But the measure the roadmap prescribes is set size *against the complexity score*, and that comparison cannot be made on exactly the cases where the set shrank: the complexity score is a Stage 9 generator's product, and minimal depth and the two no-design judgements omit that generator. Every case that carries a score (60–84) plans eleven; every case that plans fewer carries no score. So the table shows proportionality to **input length and to two stated judgements**, not to the complexity score, and `AC-037` is recorded as not shown met on its own terms.

**Why the depth rule is a length rule, stated plainly.** D-90's Stage 5 selects minimal depth at or under 200 characters. That is explicit and inspectable (`FR-017`), it matches the corpus's four minimal cases (66–83 characters) against its shortest non-minimal ones (355, 478), and it is **not a complexity measure**: a short input can describe complex work, and the rule would still plan the minimal set for it. A rule keyed on the complexity score itself would need the score before the plan, which the pipeline's order (score at Stage 9, plan at Stage 8) does not provide; producing a pre-assessment at Stage 5 is the `AI §5` output D-35 deferred, and it is still deferred. That is the design gap between what D-90 built and what `AC-037` asks for, and it is recorded here rather than closed.
