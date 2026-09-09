# Withdrawn recordings — real evidence, deliberately outside the store

⚠️ **Nothing here is deleted, and nothing here is evidence for activation.**

A recording lands in this directory when it was genuinely captured and paid for,
but its **composition is stale relative to the candidate composition** and it
cannot be re-captured. It is kept because destroying paid evidence is worse than
carrying it, and because the reasoning behind a withdrawal has to remain
inspectable.

The recording store reads `research/regression-recordings/<corpusVersion>/` and
only that, so a file here is invisible to `createRecordingStore`, the manifest
gate, coverage computation and the activation gate — exactly like
`research/regression-pending/`, and for a different reason.

## Why withdrawal is not a gate bypass

[D-64](../../docs/39-D-64-Pass-Reference-Composition-Contract.md) §4.3 requires
every case a fragment composes into to have exercised **the composition being
activated**. A stale recording therefore blocks activation — correctly, because
it is evidence about content that would no longer be in force.

Withdrawal does not make a stale recording count. It removes the case from the
**recorded** set entirely, so coverage reports it as `unrecorded` —
**undetermined**, never `covered`. Coverage genuinely narrows, and the narrowing
is visible in every coverage computation rather than hidden.

⚠️ **This weakens no rule.** D-64 §4.3 is untouched, the gate is unmodified, and
no reference gains anything it did not already have. What changes is the size of
the evidenced set, and that change is a decision recorded here.

## Withdrawn 2026-09-09 — owner decision

Both cases were re-captured with the other nine business-requirement cases; both
attempts failed to produce usable evidence, and neither is worth further spend.

| Case | Composition | Why withdrawn |
|---|---|---|
| `br-006` | `4f65ab62887890` (active) | Re-capture **failed** at stage 3 — `elements[10]: source_quote does not occur in the input`. It has now failed at that exact stage **three times** (2026-08-14 twice, 2026-09-09 once); its committed recording came from a fourth attempt. Case-specific flakiness in verbatim quoting |
| `br-008` | `4f65ab62887890` (active) | Re-capture **classified `job_description`** (0.85, candidate `business_requirement`) and ran the whole job-description path, so it failed `classification` and `run_completeness`. This is the ambiguity `docs/12` D-25 records for `br-008`; the committed recording classified correctly, so the model is non-deterministic on this input |

**Effect.** `type.business_requirement` now composes into 9 recorded cases
rather than 11, and the four foundation fragments, `stage.classification`,
`stage.intent`, `stage.context_extraction` and `stage.architecture_analysis`
each lose these two from their covered sets. That is a real reduction in what
the corpus evidences and it is the price of the decision.

**To reverse it:** re-capture the case successfully against the authored
composition and admit the new recording. The file here is the historical record,
not a candidate — it must never be moved back into the store, because its
composition is exactly what disqualified it.
