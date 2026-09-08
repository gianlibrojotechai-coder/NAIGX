# D-64 — What a pass reference attests, and which composition a run reproduces

**Date:** 2026-09-09
**Status:** ⚠️ **PROPOSED — NOT ACCEPTED. No implementation has been made.**
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the `regression:run` / activation-gate composition contract
**Affects:** `src/regression/runner.ts`, `src/regression/pass-reference.ts`, `src/regression/activation-gate.ts`, `scripts/regression.mts`
**Amends** `docs/12` D-24 dec. 4 (enforcement, not meaning) and **D-63 §7** (the legacy branch)
**Supersedes** nothing

---

## 0. Why this record exists, and what it is *not* allowed to do

The question put to it:

> *What fragment composition does a regression pass reference attest to, and
> how can `regression:run` reproduce that composition without depending on
> unpublished database state?*

⚠️ **This record must not weaken the activation gate to break the ew-001
circle.** It was written the other way round: the contract was established
first, then measured against the code, and the circle turns out to be a
**symptom** of a defect rather than a thing needing an exemption. §7 states
plainly where a genuine choice remains and what it costs — including a cost
that makes activation *harder*, not easier.

---

## 1. The existing contract, established before proposing anything

Every row is quoted from the governing document, not paraphrased from memory.

| Source | What it fixes |
|---|---|
| **`DB §4.5`** | *"`activated_at` requires a `regression_pass_reference`… a fragment version cannot become active without a recorded passing regression run. The quality gate is enforced by the schema, not by process discipline."* ⚠️ **Silent on which composition that run used.** |
| **D-24 dec. 1** | Recordings stay **keyed to the composed prompt**. Loosening the key to survive fragment edits is forbidden by name |
| **D-24 dec. 2** | An invalidated recording is **`stale`**, not an error |
| **D-24 dec. 3** | Recorded mode proves the pipeline, parser and deterministic expectations hold *given a previously captured response*. It does **not** prove the current prompt produces that response |
| **D-24 dec. 4** | Activation requires evidence that **exercised the changed fragment**. *"A `regression_pass_reference` naming a replay of the previous fragment's responses is not a pass on the change"* |
| **D-30 dec. 3** | Capture is **targeted** to the cases whose composition includes the changed fragment; coverage is **computed offline and named in the pass reference** |
| **D-63 §2** | Capture resolves **authored**, because a change gate should test the change |
| **D-63 §4** | The reference **records the resolution used**, and *"a reader must be able to tell the two apart without knowing when the run happened"* |
| **D-63 §7** | Corrects §2 for the runner. *"They must use the **same composition** — which for a fresh capture is the authored one, and **for an existing recording is whatever it was captured under**"* |

**The contract's own principle, in one line:** a run replays each recording
against **the composition that recording was captured under**, and the
reference says which composition that was.

---

## 2. What was measured

Four measurements, all executed against the real code and the real dev
database. None is inferred.

### 2.1 The "legacy" class is not homogeneous

For each recording, which resolver reproduces its stored
`fragmentsCompositionHash`:

| Recording | `composition` field | Reproduced by **authored** | Reproduced by **active** |
|---|---|---|---|
| `br-001`…`br-004`, `br-006`…`br-011` (10) | absent | no | **YES** |
| `br-005`, `un-001`, `un-002` (3) | absent | YES | **YES** |
| **`ew-001`** (held) | absent | **YES** | ⚠️ **THROWS** |

### 2.2 Three fragments differ from their active versions

`stage.architecture_analysis` **DRIFTED** · `stage.recommendation_generation`
**DRIFTED** · `stage.workflow_review` **NO ACTIVE VERSION**. The other 12 are
identical.

### 2.3 The gate reads neither the resolution nor the per-case composition

`assertActivationPermitted`'s `StoredReference` declares `suite`, `reference`,
`runId` and `cases[{caseId, recordingHash, assertionsEvaluated}]` — and nothing
else. `fragmentResolution` and the per-case `fragmentsCompositionHash` are
written into the document and **never read back**.

### 2.4 Every reference `run` can issue is `selectionScope: "partial"`

`buildPassReference` is called with no `coverage` and no `corpusSize`
(`regression.mts:458`), so the `targeted` branch is unreachable — including for
a `--case=` run, which is exactly the targeting D-30 dec. 3 sanctions.

---

## 3. Two defects, both against the contract in §1

### ⚠️ Defect A — the legacy branch mis-classifies `ew-001`

D-63 §7 branches on `composition === undefined` and justifies sending that
branch to the active resolver as *"the active one, **which is what they were
captured under**"*.

**That justification is true of the 13 and false of `ew-001`** (§2.1).
`ew-001` was captured 2026-09-08T12:29Z — after D-63 §2 moved capture to the
authored resolver, and before §7 began persisting `composition`. It is a third
class the amendment does not name: **authored-captured, composition-unpersisted.**

The implementation uses *absence of a field* as a proxy for *captured under
active resolution*. Those two stopped being the same thing the moment §2
shipped without §7. ⚠️ **This is a defect against §7's own stated principle,
not a gap in it** — §7 says "whatever it was captured under", and the code says
"active".

**This, and only this, is what closes the ew-001 circle.** No exemption is
involved: `ew-001` replays against the composition it was genuinely captured
under, which needs no database at all.

### 🛑 Defect B — the gate never checks that the run exercised the composition being activated

D-24 dec. 4 could not be more explicit: *a reference naming a replay of the
previous fragment's responses is not a pass on the change.* The gate does not
enforce it, because it never reads what composition the run used (§2.3).

**This is live, not theoretical.** Executed against the committed reference:

```
PERMITTED  stage.architecture_analysis   ← authored content has DRIFTED
PERMITTED  foundation.system_frame
```

`35af47fbdabae5eb` is a run in which all 13 cases replayed **active**
composition. It currently unlocks activation of the **authored** — different —
`stage.architecture_analysis`. That is the precise thing D-24 dec. 4 forbids,
and the run record even says `fragmentResolution: "active"`; nothing reads it.

⚠️ **Defect B makes the gate weaker than the documents already require. Fixing
it makes activation harder.** It is included because a record about what a pass
reference attests cannot honestly omit the case where the attestation is
ignored.

---

## 4. The proposal

### 4.1 Composition is identified by hash, not by resolver name

A run records, per case, **the composition hash actually replayed**. The
resolver is the mechanism that produced it; the hash is the fact. This already
exists (`ReferencedCase.fragmentsCompositionHash`) and already participates in
`runIdFor`, so the identity of a run already distinguishes compositions.

⚠️ **The scalar `fragmentResolution` cannot describe a mixed run** and must
stop being the primary carrier. `br-005`, `un-001` and `un-002` reproduce under
*both* resolvers (§2.1) — for them the resolver name is not even well-defined,
while the hash is exact.

### 4.2 Which resolver is authoritative for a run — determined, not chosen

Follows from D-63 §7 with no new decision:

| Recording | Replays against |
|---|---|
| Carries `composition` | **Its own pinned composition.** Unchanged (D-63 §7) |
| No `composition` | The composition that **reproduces its recorded `fragmentsCompositionHash`**, established by verification against the candidate resolvers |
| No candidate reproduces it | **`stale`** — unchanged (D-24 dec. 2) |

⚠️ **This is derivation from evidence, not silent fallback.** The recording's
own recorded hash is the oracle; a candidate is accepted only when it
reproduces it exactly. It is the same comparison the staleness guard already
performs — applied to more than one candidate instead of assuming one. It
satisfies the standing lesson that **a run's provenance must be derived, never
stamped**, and it never resolves against "whatever active fragments happen to
exist": a resolver that does not reproduce the recorded hash is rejected.

**Where both candidates reproduce the hash the compositions are byte-identical**,
so the choice is vacuous by construction — which is why §4.1 names the hash.

### 4.3 The gate must compare compositions (Defect B)

`assertActivationPermitted` additionally requires, for each fragment being
activated, that the cases it relies on **replayed the composition being
activated**. Mechanically: the authored composition it computes for coverage
must match the per-case composition hash the reference recorded.

⚠️ **This is enforcement of D-24 dec. 4, not a new rule** — but see §7, because
its consequence is real and must be accepted deliberately.

### 4.4 `selectionScope` for targeted runs

A `--case=` run is a **targeted** run in D-30 dec. 3's sense only when the
selection basis is a fragment and the coverage is named. Two sub-cases:

- **Fragment-targeted** — cases chosen *because* they compose fragment F.
  `selectionScope: "targeted"`, `coverage` names F. This is the D-30 dec. 3
  artefact and `run` cannot currently produce it (§2.4).
- **Case-named** — an operator naming ids directly, as `--case=` does today.
  ⚠️ **Must remain `partial`.** It is not evidence *about a fragment*; calling
  it `targeted` would let an arbitrary subset present itself as a proved
  coverage basis.

**The gate is unaffected either way** — it recomputes coverage itself and never
trusts `selectionScope`. That independence is correct and stays.

### 4.5 Run records are write-once

A run record is content-addressed by `runId`, which is deterministic by design.
A re-run reproducing an existing `runId` **must not rewrite the document**; it
reports *reproduced* and leaves the original bytes alone. Only `completedAt`
differs, and rewriting it makes two documents claim to be the same run — the
*"the document and the reference disagree"* condition the gate itself checks
for.

⚠️ **In boundary because it is the same artefact this record defines.** It is
also not hypothetical: a verification run overwrote `35af47fbdabae5eb.json`
this session and was caught only by `git status`.

---

## 5. What is explicitly unchanged

| | |
|---|---|
| **Production runtime resolution** | Unchanged. `createFragmentResolver` reads active published versions only. An unpublished fragment stays unusable at runtime |
| **Capture** | Unchanged. Resolves authored (D-63 §2) |
| **Pinned recordings** | Unchanged. Replay against their own composition (D-63 §7) |
| **The gate's coverage computation** | Unchanged. Authored resolution, same four refusal reasons. §4.3 **adds** a requirement; it removes none |
| **Publisher semantics** | Unchanged. Still publishes the whole manifest, still refuses if any fragment lacks covering evidence |
| **The 13 committed recordings** | **Not modified, not re-labelled, not back-filled.** They keep their original provenance |
| **`ew-001`** | Still held, still unadmitted. This record does not admit it |
| **The 4 uncovered fragments** | Unchanged. `type.job_description`, `stage.recommendation_generation`, `stage.portfolio_suggestions`, `type.assessment` still need captures |

⚠️ **No first-publish exemption, `--force` path, placeholder reference or gate
bypass is introduced.**

---

## 6. The eight questions, answered

| # | Question | Answer | Determined by |
|---|---|---|---|
| 1 | What does a pass reference mean? | For the named cases: pipeline, parser and deterministic expectations hold against previously captured responses, composed from a **stated, per-case composition**. It is *not* evidence the current prompt produces those responses | **Contract** (D-24 dec. 3, D-63 §4). ⚠️ Its *sufficiency* for activating a **different** composition was undefined — §4.3 |
| 2 | Which resolver is authoritative for a run? | The one that reproduces the recording's captured composition; pinned if present | **Contract** (D-63 §7). Implementation was defective |
| 3 | Legacy recordings? | Explicit legacy path retained, but classified **by evidence** rather than by field absence. The class holds two kinds (§2.1) | **Contract** + measurement |
| 4 | Authored/pinned recordings? | Replay against their pinned composition. Unchanged | **Contract** (D-63 §7) |
| 5 | `selectionScope` for targeted runs? | `targeted` only for fragment-targeted selection with named coverage; operator-named ids stay `partial` | **Contract** (D-30 dec. 3) |
| 6 | Can an ew-001 targeted pass legitimately become an activation reference? | **Yes — but only for fragments whose entire covered set is `{ew-001}`**: `stage.workflow_review` and `type.workflow`. Never for foundation fragments, whose covered set is 14 cases | **Contract** (D-30 dec. 3 + the gate's own recomputation) |
| 7 | Can adding ew-001 produce a valid replacement reference without unpublished DB fragments? | **Yes**, once Defect A is fixed: ew-001 replays authored, the 13 replay active, no case needs `stage.workflow_review` in any database | **Contract** — this is the circle's actual cause |
| 8 | Run-record overwrite / same `runId`? | In boundary. Write-once; a reproduction reports rather than rewrites | §4.5 |

---

## 7. 🛑 The genuine choice, and what it costs

**§4.1, §4.2, §4.4 and §4.5 are determined by the existing contract.** They
correct an implementation that diverged from D-63 §7 and D-30 dec. 3. They need
ratification, not a judgement.

**§4.3 is a genuine architectural choice, and it is the reason this record is
PROPOSED rather than accepted.** D-24 dec. 4 already requires it in words. But
enforcing it has a consequence the owner must accept explicitly:

⚠️ **Two fragments become un-activatable on current evidence.**
`stage.architecture_analysis` and `stage.recommendation_generation` have drifted
(§2.2), and every recording covering them replayed the **active** composition.
Under §4.3 that evidence no longer authorises activating the **authored**
content — correctly, per D-24 dec. 4, but it means **re-capture, which is
provider spend.**

So the options are:

| Option | Effect |
|---|---|
| **A — adopt §4.3** | The gate enforces what D-24 dec. 4 already says. ⚠️ `stage.architecture_analysis` and `stage.recommendation_generation` need re-capture before activation. Publishing stays blocked, on a **larger** set than today |
| **B — defer §4.3, adopt the rest** | Fixes Defect A and unblocks ew-001's replay. ⚠️ Leaves the gate accepting evidence for a composition it did not exercise — a known, recorded hole |
| **C — adopt §4.3 with the drift recorded as a deviation** | Enforce it, and record the two drifted fragments as a named, dated exception with the re-capture owed. Neither silent nor blocking |

⚠️ **Under every option, publishing all 15 fragments remains blocked** by the
four uncovered fragments (§5). **No option makes the instance ready**, and none
should be chosen on that basis.

**Recommendation: C.** It enforces the documented rule, keeps the hole from
being forgotten, and does not pretend the drift is discharged. But this is the
owner's call, and it is why implementation stops here.

---

## 8. What was rejected

**Sending every unpinned recording to the authored resolver.** Rejected — this
is D-63 §2's original error, and it reported 10 of 13 cases stale (§2.1 shows
why: 10 reproduce only under active).

**Keeping `composition === undefined` → active.** Rejected. It is factually
wrong for `ew-001` (§2.1) and will be wrong for every recording captured in the
same window.

**Back-filling `composition` into the 13.** Rejected, for the reason D-63 §7
already gave: their composed text is gone, and any value written now would be a
reconstruction asserted as a record.

**Back-filling a `resolution: "authored"` label into `ew-001`.** Rejected for
the same reason, and because the hash already proves it — a derived fact needs
no stamped one.

**A first-publish exemption, or letting the gate accept an uncovered fragment
once.** Rejected. The circle is a defect in the runner, not a deficiency in the
gate, and an exemption would create a second activation path whose weaker rule
is invisible at the call site.

**Making `--case=` runs `targeted`.** Rejected (§4.4) — an operator-named subset
is not a proved coverage basis.

---

## 9. Consequences if accepted

| Consequence | Handling |
|---|---|
| ew-001 becomes replayable with no database dependency | Defect A fixed; the circle opens at its cause |
| A replacement reference including ew-001 becomes producible | Question 7 |
| The gate gets strictly stricter | §4.3, under the §7 option chosen |
| Two drifted fragments owe a re-capture | Recorded, not silently absorbed |
| Run records stop being rewritten by verification runs | §4.5 |
| ⚠️ Production readiness is **not** advanced | Four fragments remain uncovered; the publisher is all-or-nothing |
| Revisit trigger | A recording captured under a third resolution, or any need to evidence *active* composition specifically — e.g. reproducing a production incident |
