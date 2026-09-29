# D-95 — One informed regeneration for a Stage 7 partition refusal

**Date:** 2026-09-29
**Status:** Accepted — on the owner's "yes" to the recommendation in [D-92 §6](67-D-92-Opus-5-5.md), option 2
**Sprint:** 5 (continuation), finish line 1 (D-67)
**Resolves:** whether a Stage 7 answer that breaks the *partition* rule — a requirement in both `matched` and `gaps`, or in neither — fails the run outright or is told what was wrong and asked once more
**Affects:** `src/nie/stages/recommendation-generation.ts` (`RecommendationPartitionError`, `partitionCorrectionFor`), `src/nie/pipeline.ts` (Stage 7 `regenerateOnce`), `docs/05` AI §5 Stage 7 row, `docs/04` SA §11.3 row, [D-91 §3](66-D-91-Sample-Variance-Policy.md) (reversed for these two rules only). **No prompt, fragment, schema or requirement change; no spend.**
**Builds on** D-91 (the informed-regeneration shape, and the exceptions list it is joining), D-90 §1 (Stage 2's decline-quote regeneration), `AI §3.2` (Stage 6's traceability regeneration), D-28 (the partition rule).

---

## 1. What happened

On 2026-09-29 the owner ran the same job description twice on Opus 5. The
02:44 UTC run completed. The 02:57 run reached Stage 7, the model listed
`req-19` under both `matched` and `gaps`, the parser refused it, and the
analysis was marked failed after $0.6172 of provider calls — nothing shown.
`retry_count` 0, by [D-91 §3](66-D-91-Sample-Variance-Policy.md): "a refusal
is a finding about the prompt, not a retry".

D-91's reasoning was sound for what it was written against: a missing
rationale, missing context references, a `build_first` with no decisive gap.
Those are the model declining to do the reasoning, and the fix belongs in the
fragment. The partition rules are different in kind: the fragment already
states them in bold ("every requirement must appear exactly once … never
both, and never neither"), the same input satisfied them fifteen minutes
earlier, and the failure is mechanical — a list membership slip. Regenerating
with the slip named is the same bet Stage 6 makes on a mis-citation and
Stage 2 makes on a misquoted decline, and each refusal costs a whole run.

## 2. The change

`RecommendationPartitionError` is thrown for the two partition rules (the
"neither" case previously used `RecommendationGroundingError`; grounding —
a requirement citing no real context element, a match citing no usable
capability — keeps that class and is still **not** regenerated).
`partitionCorrectionFor` builds the addendum: the parser's message, the rule
restated, "re-issue the complete response with that fixed and nothing else
changed". Stage 7's `regenerateOnce` returns `{ addendum }` for a
`RecommendationPartitionError` and `false` for everything else — the existing
mechanism, so the budget is one attempt, the addendum goes on the request
*input* and never the fragment-composed instructions, `FRAGMENT_USAGE` is
untouched, `retryCount` is recorded, and the `FR-094` deadline still refuses
the second call after cancellation.

## 3. The exceptions list, now three

`SA §11.3`: stages 5–10 do not auto-retry, with **three** narrow exceptions,
each exactly one *informed* regeneration with the parser's reason appended:

| Stage | Trigger | Record |
|---|---|---|
| 6 | traceability failure | `AI §3.2` |
| 2 | declined-design quote not verbatim in the input | D-90 §1, D-91 |
| **7** | **`matched` and `gaps` do not partition the requirements** | **D-95** |

`AI §5`'s Stage 7 row is amended to say so. D-91 §3 stands for every other
Stage 7 refusal.

## 4. Verification

| Check | Result |
|---|---|
| A both-lists answer earns one regeneration; the corrected second answer completes Stage 7 with `retryCount` 1 and the run reaches Stage 12 | ✅ `tests/integration/nie-jd-path.test.ts` (D-95, 3 tests) |
| A second partition refusal fails the stage — `retryCount` 1, never two | ✅ same |
| A grounding refusal is still not regenerated (`retryCount` 0) | ✅ same |
| Both partition rules throw `RecommendationPartitionError` | ✅ `tests/unit/nie-recommendation.test.ts` |
| Full backend gate: typecheck clean, 1,065 tests passing, 95 skipped (the Postgres- and browser-backed suites, absent locally as always) | ✅ 2026-09-29 |
| Deployed; the next live partition refusal shows `retry_count` 1 on its Stage 7 trace | ✅ **Deployed 2026-09-29 ~09:35 UTC** on the owner's pasted commands: host at `96c057f`, backend image `1cf8e11ad6d4` (outgoing `b5f6820c3684` tagged `naigx-backend:rollback-f39c99e`), no migrations, no running analysis at the switch; healthy; readiness 200 inside and out; boot line `mode: live, caps 6.00/50.00, reserve 1.00, allowlist 1`; `claude-opus-5-5`; the compiled pipeline carries `RecommendationPartitionError`. The live proof — a Stage 7 trace with `retry_count` 1 — waits for the next partition refusal |

## 5. Deploy

Backend image rebuild and recreate under the live overlay; no migration, no
fragment or schema publish. Rollback is the outgoing image's tag.
