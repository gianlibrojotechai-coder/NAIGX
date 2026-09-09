# D-66 — The Intent Brief: an artifact that exists before reasoning does

**Date:** 2026-09-09
**Status:** Accepted — on the owner's instruction of 2026-09-09 ("let's do that"), after the M-20 decomposition presented it as the smallest change that meets `NFR-001` as written
**Sprint:** 5
**Resolves:** how `NFR-001` ("first artifact visible after submission ≤ 15 s p50 / ≤ 40 s p95") can be met at all by this pipeline's shape (latency log §9.3)
**Affects:** `AI §9.1` (artifact catalogue), `DB §4.4` (when the plan is written), `FR-040`/`FR-041` (hierarchy and progressive rendering), `NFR-001`, `M-20`, `src/nie/contracts.ts`, `src/nie/stages.ts`, `src/nie/stages/derived-artifacts.ts`, `src/nie/pipeline.ts`, `src/db/analysis-result-sink.ts`, `schemas/intent_brief.schema.json`, the export and the presenter registry
**Builds on** D-29, D-40, D-58, D-65. Supersedes nothing. **Changes no latency requirement.**

---

## 1. The question

Two live samples on two models (latency log §7, §8) put `NFR-001` at
85–91 s p50 against a 15 s budget, and §9.3 showed why no tuning can move
it: **no artifact exists before Stage 6 or 7 completes.** The earliest a
current artifact can appear is after Stages 1+2+3+6, ~51 s p50 at best.
The requirement asks for something a reader can see early. Nothing in the
catalogue is early.

The owner asked that the requirements be preserved and that redefining
them not be assumed to be the only way. So the question is: **what can the
pipeline honestly produce early, without inventing anything?**

## 2. The decision

**A new artifact type, `intent_brief`, rendered deterministically from the
Stage 2 intent record the moment Stage 2 completes, on every reasoning
path.** It states what the input asks for — primary objective, secondary
objectives, inferred scope — each with the provenance Stage 2 assigned, and
carries a fixed field `standing: "understanding_only"` so the document
itself says it is understanding, not conclusion.

It is an artifact in every respect the architecture defines:

| Property | How the brief satisfies it |
|---|---|
| Declared (`ARTIFACT_TYPES`, boundary check 5) | `intent_brief`, declared as produced by Stage 2 in `stages.ts` |
| Schema-validated (`FR-039`, AD-08) | `schemas/intent_brief.schema.json`, published to `ARTIFACT_SCHEMA`; a rendering bug is a schema failure |
| Planned with a reason (`DB §4.4`, `FR-091`) | One plan entry, planned, at Stage 2 |
| Stored valid or failed (`DB §4.4`) | Through the same sink and the same `emitDerivedArtifacts` path as D-40's rendered artifacts |
| Announced (`API §7.4`) | `plan` then `artifact` events, before Stage 3 begins |
| Presented (`FR-040`) | First in the artifact block, in the UI and the export, under a heading that says what it is |
| Rendered, not generated (D-40) | No provider call; a projection of stored reasoning that cannot disagree with it; not retryable (`API-032`) |

**Timing, from the recorded samples:** Stage 2 completes at **7.6 s p50 /
11.4 s p95** cumulative on Sonnet 5 (§9.2: 2.2 + 5.4 s; 3.4 + 8.0 s) and
**11.6 s / 14.3 s** on Sonnet 4.5. Rendering, validation and persistence
add milliseconds (§9.1). The brief is therefore inside `NFR-001`'s budget
on both models *as far as the samples allow one to say*; §5 records what
still has to be measured.

## 3. What this is not

- **Not a redefinition of `NFR-001`.** The requirement's text is unchanged.
  What changed is that the catalogue now contains an artifact the pipeline
  can produce early. Whether "first artifact visible" was *meant* to name a
  reasoning product is a fair question; this record answers it by making
  the brief say, in its own content, that it is not one.
- **Not a fix for `NFR-002`.** Full completion is the same serial chain it
  was. §9.4's remaining levers for it are all decisions not made here.
- **Not new reasoning.** `SA §3.4`, `AD-02`: the renderer is a pure
  function of the intent record. It adds no claim, no synthesis, no
  summary beyond the fields Stage 2 already produced.
- **Not a change to any prompt, gate, parser or recording.** Replay keys
  are untouched; the 15 canonical recordings replay with the brief added
  because it needs no provider output.

## 4. What it amends

- **`AI §9.1`** gains a row: *Intent Brief — what the input asks for, as
  understood — applies to all four reasoning paths — rendered at Stage 2.*
- **`DB §4.4`**'s *"written at Stage 8"* becomes *"written when the
  artifact's source stage completes"*, which for every existing artifact is
  still Stage 8. The sink merges plan entries across the two writes.
- **`API §7.4`**'s event order still holds: `plan` precedes `artifact` for
  the brief, and the path's own `plan` at Stage 8 precedes its artifacts.
- **`FR-040`**: the brief renders first in the artifact block. The
  hierarchy's *understanding* section (Stage 2–3) is unchanged; the brief
  is its artifact-shaped twin, available ~15–25 s before it.

## 5. Consequences and what remains to measure

| Consequence | Handling |
|---|---|
| `M-16`'s `time_to_first_artifact` will now measure the brief | Correct: the metric is defined on the first `ARTIFACT` row. Recorded so nobody reads a fall in that series as a reasoning speed-up |
| A halt at Stage 3 now completes with one artifact | `FR-091`: the run produced it; the plan says so |
| An `unsupported` input has no brief | Stage 1 declines before Stage 2 (`FR-092`); nothing is planned |
| `NFR-001` on the brief is **not yet measured live** | A D-58 sample on the deployed build is the measurement; the expected figure is Stage 2's cumulative time plus milliseconds. Until then `M-20` stays open and `NFR-001` stays *unmet* |
| The frontend has no test runner | Presenter typecheck- and build-verified only, like every presenter (M-12 limitation 1) |
| Revisit | If the owner decides `NFR-001` must name a reasoning product, this record is superseded and the catalogue row stays as a useful artifact in its own right |

## 6. What was rejected

**Redefining `NFR-001` to the `understanding` event.** Rejected as the
first move: it changes the requirement rather than meeting it, and the
owner asked that it not be assumed.

**Rendering the brief from Stage 3 (context) instead.** Rejected for
timing: Stage 3 is the slowest extraction stage with a throughput tail
(§9.3), so a Stage 3 artifact lands at 20–100 s. Stage 2 lands at ~8 s and
is stable.

**Emitting the brief from Stage 1's classification.** Rejected: a
classification is a label, not an artifact anyone can read.

## 7. Verification

| Check | Result |
|---|---|
| Renderer output validates against the published schema; `standing` fixed; provenance carried | ✅ `tests/unit/nie-derived-artifacts.test.ts` — validates, a different `standing` is refused by the schema, empty secondaries validate, planned once and by no path planner |
| Every canonical recording replays with the brief first in the plan and `generated` | ✅ `regression:run` over all 15 recordings: 15 passed, reference `d4abcd42626452df` **reproduced** (the brief is not a stage output, so no recording moved); `replay-corpus.test.ts` runs jd-002 through the production pipeline with the brief first and `generated` |
| Persistence: plan entry at Stage 2 merges with the Stage 8 plan; artifact row references it | ✅ One submission per path through the public API of a local **replay** instance of the built `dist/`: on all four, the brief is the first `generated` artifact; `artifact_plan_entry` holds the Stage 2 row beside the Stage 8 rows (jd-002: 4 rows, ew-001/ta-005: 3, br-001: 1); the `artifact` row references that plan entry and the published `intent_brief` schema, `valid`, created before `completed_at`; `stage_trace` holds exactly one Stage 2 row (the render is attributed to Stage 2's own trace, not a second one). ⚠️ Replay timing is system overhead only and is not reported as a latency figure |
| Export and presenter render it under a heading that states its standing | ✅ `tests/unit/export-intent-brief.test.ts` — heading *Intent Brief*, the standing sentence precedes the objective, provenance on every objective; presenter typecheck- and build-verified (frontend has no test runner, §5) |
| Live, deployed build: first artifact time on the four paths | ⏳ **NOT DONE.** Needs (a) the build deployed with the sixth schema published — a production write, owner-authorised — and (b) a live sample under D-58. A local live check was prepared and **not run** in the implementing session (the tool permission for starting a live-mode process was denied); nothing was spent. Until it runs, `NFR-001` stays unmet and `M-20` open |
