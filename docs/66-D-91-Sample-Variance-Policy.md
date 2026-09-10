# D-91 — Sample variance, the corpus at v3, and the regeneration exceptions reconciled

**Date:** 2026-09-10
**Status:** Accepted — owner-directed, five decisions taken in one message (quoted in §1–§5)
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** the four decisions D-90 §9 put to the owner, and the br-004 blocker (D-90 §8.1)
**Affects:** `regression/sample-variance.ts` (new), `regression/runner.ts`, `regression/pass-reference.ts`, `regression/assertions.ts`, `scripts/regression.mts`; `research/regression-variance.json` (new); the corpus (eleven `br-*` cases, suite version `corpus-v3`); `docs/04` SA §11.3 and `docs/05` AI §5 (Stage 7 row)
**Builds on** D-90.

---

## 1. br-004: the contractually correct behaviour, and the sample-variance policy

**Owner:** *"br-004 should be classified as thin and proceed with a minimal design, as the cited contract states. Retain every sample and expose the sufficiency failure in the evidence. I authorize one diagnostic rerun, but not a change that weakens the activation gate to accept a favorable sample. Separate samples by captured composition; do not pool different prompt versions into a reliability claim. Make the proposed variance policy precise before applying it, and keep deployment blocked if the existing gate still refuses."*

**The contract.** `AI §5.4`: `thin` is "analysis possible but inference-heavy — proceeds"; `insufficient` is "any design would be substantially invented — does not proceed". `stage.context_extraction`: sufficiency is judged "on how much the input states", and brevity "on its own is never a reason to report `insufficient`". br-004 states a source, a destination, a trigger and a cadence. The correct answer is `thin`, and the D-90b sample that answered `insufficient` contradicted the fragment's own rule. Its two earlier samples (2026-09-09; D-90 batch 2) answered `thin`.

**The policy, precisely.** It is implemented in `regression/sample-variance.ts` and applied by the runner on every run:

1. **Retention.** Every capture is retained, passing or failing: an admitted recording in the store; every other sample in `research/regression-superseded/` or the campaign's held folder; every refusal in a `failures/` folder. Nothing is deleted to make a case look consistent.
2. **The register.** `research/regression-variance.json` lists every sample of a case that is not its admitted recording, with the fragment versions it composed (its prompt version), its outcome, what failed, the stated rule the failure contradicted, and the file. The register is committed with the samples it describes.
3. **Scope by prompt version.** The runner assesses a case's samples **under the admitted recording's prompt version only**: a sample counts when every fragment it composed is the same version in the admitted recording's persisted composition. Not the run's composition hash — that covers only the stages that ran, so a sample that halted at Stage 3 could never be compared with one that reached Stage 9, which is exactly the pair this policy exists for. A sample captured under other fragment versions is another prompt's evidence and is never pooled in — not into the gate, and not into any reliability claim; a legacy sample with no persisted composition is never pooled either.
4. **When a further sample may be taken.** Once per case per campaign, and only when the failing sample **contradicts a stated rule of the fragment** (the register names the rule). A failure that is the contract's own verdict — a bound the model missed, a refusal the parser is right to make — earns no re-run; it is reported failing.
5. **The rule that keeps the gate honest.** A case that **failed two of its last three samples** under a prompt version is reported `failed` by the runner, whatever its latest sample says, and no pass reference issues. The runner does not relabel any assertion; it adds a way to fail a case on its history.
6. **Exposure.** Every selected case with a recorded failing sample under its prompt version is named in the pass reference (`sampleVariance`: samples, failures, the rules contradicted, the failing files), so activation evidence carries the variance with it and a reader of the reference sees it without opening the register.

**What this does not do.** It does not let a favourable sample replace a failing one silently (rule 2 and 6), it does not let a rerun be taken to obtain a pass (rule 4), and it does not touch the gate's assertions (rule 5 only adds failures). A rerun diagnoses variability; it does not erase the observed failure.

**Applied to br-004:** one diagnostic rerun is permitted under rule 4 (the rule contradicted is quoted above). If it passes it is admitted, the halting sample moves to the superseded folder and into the register, and the next reference names br-004 with one failure in two samples under that prompt version. If it fails, br-004 has failed two of two under this prompt version, rule 5 keeps it failing, and the fix is a Stage 3 fragment change with its own recapture. Result: §6.

## 2. Stage 2 regeneration — kept, as a recorded exception

**Owner:** *"Keep the single Stage 2 regeneration for an invalid verbatim quote. Record the narrow exception, retain exact-quote validation, and verify cancellation and retry limits."*

`SA §11.3` now lists the two exceptions to "stages 5–10 never auto-retry": Stage 6 on a traceability failure (`AI §3.2`) and Stage 2 on a declined-design quote not verbatim in the input (D-90 §1), each exactly one *informed* regeneration with the parser's reason appended, never a blind retry. Exact-quote validation is unchanged (whitespace-insensitive, case-sensitive containment; `IntentDeclineQuoteError`). Verified: a second unverifiable quote fails the stage with `retryCount` 1 and exactly one extra call; an analysis cancelled between the first answer and the regeneration makes no further call (`FR-094`) — `tests/integration/nie-pipeline.test.ts`.

## 3. Stage 7 regeneration — none; the documents reconciled

**Owner:** *"Use no Stage 7 regeneration, as recommended. Reconcile the conflicting documents and preserve visible failure behavior."*

`AI §5`'s Stage 7 row said "regenerated once, then fails"; `SA §11.3` said stages 5–10 never retry. The row is amended to match `SA §11.3`: a recommendation missing rationale, context references or (for `build_first`) a decisive gap fails the stage visibly and is not regenerated. The pipeline already behaved this way; the fragment states the rules the parser enforces (D-90 §7), and the jd-002 refusal was fixed there.

## 4. The corpus at v3 — the P1 expectations re-versioned

**Owner:** *"Re-version the P1 expectations now through the documented process: the four implemented artifacts are expected at standard requirement depth and omitted at minimal depth or when no design is produced. Preserve the previous corpus version and remove the temporary exception. Do not change unrelated expectations."*

Done under `docs/11` §6.2, every change in the corpus README's change log with the case, field, old and new value, why the original was wrong, and the version:

- `br-001`, `br-002`, `br-006`, `br-007`, `br-008`, `br-009`, `br-011` (standard depth, a design produced): `implementation_roadmap`, `integration_requirements`, `edge_cases_and_practices`, `executive_summary` move from `expected_omissions` ("P1, excluded from v1.0 scope") to `expected_artifact_set`. The reason was scope, not judgement, and the scope changed when the owner had them built (D-82–D-85).
- `br-003` (unwarranted), `br-010` (declined), `br-004` (minimal), `br-005` (refusal): the four stay omitted; the reason is now the case's own — no design produced, minimal depth, or refusal — instead of P1 scope.
- Nothing else changed. The other paths' "not applicable to this path; also P1" omissions stand on the path reason and were not touched.
- `corpus.manifest.json`: `corpus-v2` → **`corpus-v3`**. The previous version is preserved in git and in every reference that names it; recordings are unaffected (expectations are not part of a composition).
- The D-89 `artifact_set` exception (`P1_BUILT_2026_09_10`, "superseded expectation") is removed: every produced omission now contradicts.

## 5. Complexity before planning — option B approved as the next increment

**Owner:** *"Approve complexity-before-planning option B as the next engineering increment. Use the defined complexity bands, and explain exactly what role the length rule retains so it cannot override genuine complexity. Keep AC-037 open until its prescribed measurement passes."*

Not built in this record; the design it commits to:

- **Bands** are `complexity-v1`'s as the presenter already labels them (`executive-summary.ts`): `low` < 40, `moderate` 40–59, `high` 60–79, `severe` ≥ 80 on the 20–100 score.
- **Order.** On the two architecture paths the complexity generator runs **before** Stage 8 whenever the input is eligible for minimal depth, so the score exists when the plan is made.
- **The length rule's role.** It becomes an **eligibility floor and nothing more**: an input at or under 200 characters is *eligible* for minimal depth; the score decides. `minimal` is planned only when the input is eligible **and** the score is in the `low` band. An eligible input whose score is `moderate` or above is planned at standard depth — that is the case the owner named, short input describing complex work, and length cannot override the score. An input above 200 characters is never minimal; its full set is planned as today.
- **The artifact.** At minimal depth the `complexity_score` artifact stays omitted, as the corpus expects; the score is recorded on the plan (Stage 8's structured input) and in the trace, and the measurement script reads it from the result. The `AC-037` measure — set size against score — then has a score on every architecture case that reaches Stage 8.
- **Cost.** About $0.03 per eligible analysis on the two paths.
- **What it leaves open.** The declined and unwarranted outcomes have nothing to score (`FR-020`); the workflow and posting paths keep the length rule alone until they have a pre-plan score. `AC-037` stays **open** until its prescribed measurement passes.

## 6. Verification

| Check | Result |
|---|---|
| Policy unit: composition scoping, one failure is variance, two of the last three fail, the window ages | ✅ `tests/unit/regression-sample-variance.test.ts` |
| Runner: variance carried into the reference; two failures fail the case and no reference issues; another composition is not pooled | ✅ `tests/integration/regression-runner.test.ts` |
| Stage 2: exactly one regeneration then failure; no call after cancellation | ✅ `tests/integration/nie-pipeline.test.ts` |
| Corpus v3 loads; the suite version is read from the manifest | ✅ `tests/unit/regression-corpus.test.ts` |
| Full suite, lint, typecheck | ✅ 2026-09-10 — 1154 tests, 1150 pass, 0 fail, 4 skipped; lint 0 errors; typecheck clean |
| br-004 diagnostic rerun (rule 4; **$0.0671**, ceiling $0.10) | ✅ answered `thin` (10 elements), every assertion passed; admitted. The halting sample is retained as `research/regression-superseded/br-004-halted-2026-09-10T08-34-16Z.json` and is the register's first entry, with the rule it contradicted. The runner reports `br-004` as **1 of 2 samples failed under this prompt version** and the reference carries it |
| Regression runs | ✅ default selection 11 passed · 0 failed · 2 blocked (`br-006`, `br-008` have no recording — no reference, as always for that selection); **all fifteen recorded cases: 15 passed, reference `corpus-regression:corpus-v3+fragments-v1:ba5c6c0837522bd0`** (scope `partial`, `expectationConflicts: []`, `sampleVariance: br-004 — 2 samples, 1 failed, file named`). M-11 on the store under corpus-v3: 15 of 15 agree (`research/m11-artifact-set-measurement.md`) |
| Activation (local) | ✅ `fragments publish --reference=…ba5c6c0837522bd0`: **5 new versions, 18 unchanged** — `stage.intent`, `stage.architecture_analysis`, `stage.classification`, `stage.recommendation_generation`, `stage.portfolio_suggestions`. The gate accepted a reference that names a variable case; it did not need weakening |
| Deployment | _recorded in D-90 §6 when done_ |
