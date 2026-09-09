# D-72 — Stages 10 and 12: response validation beyond schema, and one assembly step

**Date:** 2026-09-10
**Status:** Accepted — on the owner's direction to finish the build; these were the two correctness gaps with no deferral record (STATUS open items; D-67 §5)
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `AI §3.2` Stage 10 ("guarantee that no invalid or unsupported output reaches a user") had only its `schema` class implemented, inline at Stage 9; Stage 12 ("compose the final output set … partial assembly is not permitted") did not exist — each pipeline branch assembled its own result
**Affects:** `backend/src/nie/stages/response-validation.ts` (new), `stages/response-assembly.ts` (new), `pipeline.ts` (a run wrapper; deep validation where the schema class runs; a validation class on the recorder; a failure outcome on deterministic traces), `stages.ts` (10 and 12 `implemented: true`), `ports.ts` (six validation classes), `db/metrics.ts` (the `M-10` schema-validity metric counts the `schema` class only)
**Builds on** D-38 (the measured unknown-citation exposure that motivated a real Stage 10), D-40, D-66, D-70, D-71. **Changes no prompt, schema, recording or requirement.** `M-05` moves from 8 to 10 of 12 stages; Stages 4 (D-15) and 11 (D-33) stay deferred with their records.

---

## 1. Stage 10 — what runs now, and what each finding does

Six classes, as `AI §3.2` lists them, recorded as `VALIDATION_EVENT` rows
under the class name the trace schema already had. The design turns on one
distinction:

| Class | Checks | Kind | On failure |
|---|---|---|---|
| `schema` | the published artifact schema (unchanged) | enforced | the artifact is `failed` |
| `rationale_completeness` | every component has a responsibility and failure handling; every rejected approach a reason; every finding a description and remediation, or a soundness statement when there are none; the verdict a rationale, criteria and ≥1 alternative; every gap why it matters | enforced | the analysis fails closed (a `StageError` at Stage 10) |
| `reference_integrity` | every `groundedInContextIndices` index exists; every finding's step index exists; matches and gaps cite known requirements; decisive gaps are gaps; portfolio gaps are gaps; implementation steps point into the workflow | enforced | as above |
| `provenance_integrity` | stated ⇒ span, inferred ⇒ basis, unknown ⇒ hint; objectives stated or inferred; reusability inferred with a basis | enforced | as above |
| `unsupported_claim_detection` | a project platform whose leading word appears nowhere in the input, the context, the requirement names, the match evidence or the operator's evidenced capabilities | **advisory** | recorded with an `advisory:` detail; nothing fails |
| `internal_consistency` | per artifact, at validation time: diagram node count and names vs the architecture; assessment trade-offs and rejections vs the architecture; risks and findings vs the review; brief objective vs the intent record; n8n nodes vs implementation steps; a project with an implementation has a workflow | enforced | **that artifact** is `failed`, exactly as a schema failure fails it, with a reason naming the class |

**Why the reasoning-level classes fail closed.** Each of them is already
enforced by a parser (traceability, `FR-034` criteria, `AIP-3` provenance),
so a Stage 10 failure there is re-verification catching a defect, not a
judgement about the input. Presenting the result would be presenting a known
inconsistency; the spec says not to.

**Why unsupported-claim is advisory.** It is a heuristic over words. The
capture that motivated D-70 named Marketo as an alternative the posting did
not mention — a legitimate suggestion. A heuristic that failed it would
fail the reader. So it is a finding the reader and the operator can see,
and the `M-10` metric is restricted to the `schema` class so an advisory
miss does not read as a schema failure.

**Where it runs.** The artifact-level class runs where the schema class
runs — before the artifact is persisted — so a failing artifact is failed
there and never presented. The reasoning-level classes run once, after the
last reasoning stage, on a **Stage 10 trace** that records every finding
(class, subject, passed, advisory, detail). The trace is recorded on every
response, a refusal included: a Stage 1 halt now traces 1, 10, 12.

## 2. Stage 12 — assembly as verification

Every result passes through `assembleResponse` before it is returned:
every planned artifact has an outcome (`generated` or `failed`), every
unplanned one a reason, no type is planned twice, a halt states its reason,
and a generated artifact travels with the reasoning it rests on (a
portfolio without its recommendation, a diagram without its architecture,
a brief without its intent would each be a conclusion without `FR-042`'s
reasoning beside it). A violation throws; the Stage 12 trace records the
problems and the analysis fails — "partial assembly is not permitted".

It composes nothing new. Every branch already produced a complete result;
Stage 12 is the one place that fact is verified rather than assumed.

## 3. What is not changed, and what is

- No prompt, schema, recording or requirement. The fifteen recordings replay
  and reproduce the existing pass reference.
- Trace shape: every response now carries Stage 10 and Stage 12 traces. The
  tests that pinned stage lists were updated deliberately (job path, other
  paths, pipeline inventory, harness deterministic set, halt cases).
- `M-05`: 10 of 12 stages implemented. Stage 4 (knowledge assembly) waits on
  a knowledge substrate (D-15); Stage 11 (confidence) waits on calibration
  captures (D-33). Both remain open with their records.
- The D-38 disposition field for cited unknowns is **not** added here — it
  is a Stage 6 output-contract change (a fragment change with captures), and
  is listed with the paid items.

## 4. Verification

| Check | Result |
|---|---|
| Unit: each enforced class fails its defect and passes a consistent run; advisory names the platform and fails nothing; diagram and n8n consistency; assembly accepts a complete result and refuses the four incomplete shapes | ✅ `tests/unit/nie-response-validation.test.ts` (10) |
| Integration: job path, other paths, pipeline, harness, composition, replay corpus, review packet with the new traces | ✅ 53 + 24 |
| Full suite, lint, format, typecheck, build, fragment/schema/recording checks | ✅ 2026-09-10 — 1038 tests, 1034 pass, 0 fail, 4 skipped (with D-73 and D-74 in the same tree) |
| Fifteen recordings replay | ✅ 15 passed, 0 failed — **reproduced** the existing pass reference `corpus-regression:corpus-v2+fragments-v1:d1b67b9017b86257`, run record left unmodified |
