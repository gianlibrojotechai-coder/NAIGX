# D-63 — Regression evidence composes against authored fragments, not active ones

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the bootstrap circularity that blocks a never-active fragment from ever acquiring evidence
**Affects:** `src/regression/capture.ts`, `src/regression/runner.ts`, `src/regression/pass-reference.ts`, `scripts/regression.mts`
**Does NOT amend** [D-24](12-Sprint-1-Decision-Record.md) decision 4, [D-14](12-Sprint-1-Decision-Record.md), or [D-30](12-Sprint-1-Decision-Record.md) decision 3. The activation gate and the publisher are untouched.

---

## 1. The circularity

`stage.workflow_review` has never been active in any database. Capturing
`ew-001` — the case that would exercise it — fails:

```
No active published version for fragment(s): stage.workflow_review
```

Because:

| Step | Requires |
|---|---|
| **Capture** a case | composing its prompts, which resolved fragments from the **active** versions |
| **Run** the suite | the same composition, to key replay fixtures identically |
| **Activate** a fragment | a passing run covering it (`DB §4.5`, D-24 decision 4) |

**A fragment that has never been active cannot be exercised, and a fragment
that has not been exercised cannot become active.** For every fragment already
active this is invisible; for a genuinely new one it is a closed loop.

⚠️ It is not hypothetical. The 14 currently active fragments escaped it only
because they were activated under the Sprint 1 publisher, which minted its own
`fragment-manifest-gate:` reference — the stand-in D-14 abolished and the gate
now refuses by name. **There is no legitimate path by which a fifteenth
fragment could join them.**

## 2. The decision

**Regression capture and the regression runner resolve fragment *content* from
the authored versions on disk when composing the prompt under test.**

That is the whole change. It applies to the two paths that produce and replay
evidence, and to nothing else.

**Why it is the right resolution rather than a convenience:** a change gate
should test *the change*. Composing against already-active fragments tests the
content already in force, which is precisely what a candidate fragment is not.
The publisher already reasons this way — `assertActivationPermitted` receives
an `authoredResolver`, because at publish time the database still holds the
previous version and asking it would compute coverage for the wrong content.
Capture and run were the two paths that had not caught up.

## 3. What is explicitly unchanged

| | |
|---|---|
| **Production / runtime resolution** | Unchanged. `createFragmentResolver` reads **active published versions** and nothing else. An unpublished fragment is unusable at runtime, exactly as before |
| **The activation gate** | Unchanged. Same refusals — `missing_reference`, `placeholder_reference`, `unresolvable_reference`, `fragment_not_covered` — with the same coverage requirement |
| **Publisher semantics** | Unchanged. Still publishes the whole manifest and still refuses if any fragment lacks covering evidence |
| **Genuine corpus evidence** | Still mandatory for production activation. This record removes a circular *precondition*, not the requirement |
| **Existing active versions and activation records** | Untouched. No row is rewritten, relabelled or re-attested |
| **Existing recorded evidence** | Remains valid under its original provenance. ⚠️ Historical runs are **not** silently relabelled — they predate this record and say what they always said |

⚠️ **This is not a first-publish exemption, a `--force` path, a placeholder
reference, or a gate bypass.** None of those is introduced, and the gate's code
is not modified.

⚠️ **Authored fragments do not become production-valid by being testable.** A
fragment composed during capture is a *candidate*. It reaches production only
by the unchanged route: a clean covering run, a genuine reference, and the
publisher's gate.

## 4. ⚠️ The attestation must say which composition was exercised

A run against authored fragments proves something **narrower** than a run
against published ones, and the artefact must not blur the two. `docs/12` D-24
decision 3 already requires a reference to state what it does and does not
attest; this extends that wording rather than inventing a mechanism.

The reference records the resolution used, and the attestation names it:

- **`authored`** — *"the prompt under test was composed from the authored
  fragment versions on disk, which may differ from the versions currently
  active in any database."*
- **`active`** — the prior meaning, preserved for evidence produced before this
  record.

**A reader must be able to tell the two apart without knowing when the run
happened.** That is the whole obligation this section exists to create.

## 5. What was rejected

**Changing capture alone.** Rejected — it moves the wall rather than removing
it. The runner composes to key its replay fixtures, so a capture the runner
cannot replay produces a recording no gate will ever accept, having spent real
money to make it.

**A first-publish exemption in the gate.** Rejected. It would create a second
activation path whose weaker rule is invisible at the call site, and the gate
is the one component this project has most consistently refused to soften.

**Reusing the `fragment-manifest-gate:` stand-in.** Rejected; D-14 abolished it
and the gate refuses it by name.

**Relabelling historical runs as `authored`.** Rejected. They were produced
against active fragments and saying otherwise would falsify provenance to make
a schema tidy.

## 6. Consequences

| Consequence | Handling |
|---|---|
| A never-active fragment can now acquire evidence | The circularity is removed at its cause |
| Evidence is a slightly weaker claim | Stated in the artefact (§4), not left implicit |
| Capture and run must compose identically | They already share `createRecordedProvider`; both now receive the same authored resolver |
| ⚠️ Authored content can drift from active content | Which is the point — that gap is what a change gate exists to test. The manifest check still refuses fragments that do not match their manifest |
| Revisit trigger | Any future need to produce evidence against *active* fragments specifically — e.g. reproducing a production incident |
