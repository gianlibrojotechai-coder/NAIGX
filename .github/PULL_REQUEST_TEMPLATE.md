<!--
`Roadmap §7.3`: "Template carries the Definition of Done as a checklist —
self-review from a checklist catches what memory does not."

The checklist below is `Roadmap §2.1` reproduced, not summarised. If a criterion
does not apply, say why rather than deleting the line — a silently removed
criterion is indistinguishable from one that was overlooked.
-->

## What and why

<!-- What changed, and which requirement ID it implements. -->

**Requirement ID(s):**

## How it was verified

<!-- `Roadmap §2.1` #1: "acceptance criteria verified, not assumed."
     State what you actually ran or observed, not what should work. -->

---

## Definition of Done — task level (`Roadmap §2.1`)

- [ ] 1. Implements its requirement ID; acceptance criteria **verified, not assumed**
- [ ] 2. Unit tests written and passing for the logic introduced
- [ ] 3. Integration test where it crosses a boundary
- [ ] 4. All CI quality gates pass (`Roadmap §8.3`)
- [ ] 5. No architectural boundary violated (`SA` App. A)
- [ ] 6. Errors handled per `API §9`; every error states an action
- [ ] 7. Instrumented — logging and metrics where `§13` requires
- [ ] 8. Self-reviewed against the Definition of Done **as a checklist, not from memory**
- [ ] 9. Deviation from any design document **recorded, not silently absorbed**

## Quality gates (`Roadmap §8.3`)

None of these are bypassable.

- [ ] Lint, format, type check
- [ ] Unit and integration tests
- [ ] **Boundary checks — no bypass mechanism exists, not even temporarily**
- [ ] Contract tests

## Reasoning changes only (`Roadmap §2.4`)

<!-- Delete this section if the change touches no fragment, stage, generator,
     provider, or model version. Otherwise every box applies. -->

- [ ] Regression suite passes against the golden corpus (`NFR-043`)
- [ ] Output diffs against the prior fragment version **reviewed by a human**
- [ ] Fragment version incremented; composition recorded (`AI-013`)
- [ ] `regression_pass_reference` recorded before activation (`DB §4.5`)
- [ ] Sampled output assessed against the quality rubric
- [ ] Rollback verified (`AI-014`)
- [ ] Output diff included in this PR body (`Roadmap §7.3`, `AI §12.4`)

---

## Deviations from design documents

<!-- `Roadmap §2.1` #9 and §7.3: "Design deviations documented in the PR —
     prevents silent architectural drift." Write "None" if there are none. -->

## Commit type (`Roadmap §7.2`)

<!-- Conventional Commits. The three custom types exist because these changes
     carry risk a standard type would obscure. -->

- [ ] `feat` / `fix` / `refactor` / `test` / `docs` / `chore` — standard
- [ ] `prompt` — fragment version change · **triggers mandatory regression review**
- [ ] `schema` — artifact schema or database schema change
- [ ] `arch` — touches an architectural boundary · **warrants extra scrutiny**

## Before merging

- [ ] A **delay** was left between opening and merging (`Roadmap §7.3` — "reviewing your own code immediately after writing it is not review")
