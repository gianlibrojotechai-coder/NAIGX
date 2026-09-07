# D-45 — `DBQ-6` and `APIQ-4` resolved: 24-hour token, 7-day expiry

**Date:** 2026-09-07
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** `DBQ-6` (anonymous analysis expiry period), `APIQ-4` (anonymous token lifetime and single-analysis enforcement)
**Affects:** `FR-004`, `API §3.4`, `DB §5.5`, `DB §10.3`, `NFR-031`, `M-15`
**Extends** [D-44](19-D-44-Refresh-Token-Table.md). Supersedes nothing.

---

## 1. Two questions, deliberately not collapsed into one

`APIQ-4` says the token lifetime "must **align with** the `DBQ-6` expiry period". *Align*, not *equal* — and they govern different things:

| | Governs | Failure if wrong |
|---|---|---|
| **Token lifetime** | Who can **reach** an analysis. An authorization property. | Too long: a leaked token grants access indefinitely. Too short: `FR-004` claimability breaks. |
| **Expiry period** | How long the **row** survives unclaimed. A retention property. | Too long: indefinite retention of unowned content, which `DBQ-6` forbids by name. Too short: a user loses work they could still have claimed. |

Setting them to one number would mean either retaining content for as long as it is reachable — which is backwards, since reachability should end first — or expiring rows while a valid token still points at them. **The token expires first; the row expires second.** Between the two, the analysis exists and nobody can reach it, which is the correct state for content awaiting deletion.

## 2. The values, and where each comes from

Neither is a number chosen for being reasonable. Each is derived from something the documents already fix.

### 2.1 Anonymous token lifetime — **24 hours, fixed, non-sliding**

| Source | Constraint |
|---|---|
| `FR-004` | An anonymous analysis is claimable "if the user authenticates **within the same session**" |
| `API §3.4` | Lifetime: "**Short, fixed.**" |
| `API §3.4` | Scope: "Exactly one analysis. Grants read and event-stream access to that analysis only." |

`FR-004` sets the *functional* bound: the token has to survive as long as the sitting in which the analysis was produced, because that is the window in which the requirement promises a claim is possible. It does not have to survive longer, because after that sitting `FR-004` promises nothing.

**24 hours is one working sitting including interruption** — submitted before lunch and claimed after, or submitted at the end of a day and claimed the next morning. Shorter would break claims `FR-004` promises; longer would extend an unauthenticated credential past any session it was issued for.

**Fixed and non-sliding**, because `API §3.4` says "fixed". Use does not extend it. A sliding window would let a token held open by polling live indefinitely, which is the indefinite unowned access `DB §5.5` exists to prevent.

### 2.2 Unowned-analysis expiry — **7 days**

Taken from `DB §8.3`'s published StageTrace retention rather than chosen fresh:

> | StageTrace | **High** — full user business content | Short, fixed (`NFR-034`) | **7 days** |

Three reasons this is the right number rather than a convenient one:

1. **After 7 days the analysis is already undiagnosable.** Its stage traces are purged on that schedule, so the `FR-100` claim — "fully diagnosed from its trace without re-running" — no longer holds for it. Retaining the analysis past its own traces keeps content whose value has already lapsed.
2. **It is already unreachable, six days earlier.** The token died at 24 hours. From hour 24 to day 7 the row is content nobody holds a credential for; the seventh day is when it stops existing.
3. **`NFR-031` publishes one window, not two.** The data policy must be "accessible before first submission" and `DBQ-2` requires retention periods to appear in it. A second, differently-derived content-retention number would mean explaining to a user why their unowned analysis and its traces vanish on different days. Reusing 7 days means the policy states a single content-retention window and it is already the published one.

**This does not introduce a new retention period.** It applies an existing one to a second entity, for a stated reason.

## 3. The migration-era evidence exemption

**The 22 analyses currently in the primary store are exempt from this sweep.** This is a one-off exemption tied to the migration, not a general exception to retention.

**Why they cannot be treated as ordinary unowned rows.** They predate anonymous-token *issuance*. `API-020` has always stored `anonymousTokenHash: hashContent(randomUUID())` — a hash of a UUID that was generated, hashed, and discarded without ever being sent to anyone. **No token for these rows has ever existed**, so they are not unclaimed analyses awaiting a claim; they are analyses that were never claimable. Under §2 they would be immediately expired on the day the mechanism lands, having never had the 24-hour window the policy grants.

**Why they are kept rather than swept.** They are the project's cited evidence, referenced by name in `docs/STATUS.md`:

- The single genuine live-provider run, which cost **$0.2732** — the only real-provider evidence this project has, and unreproducible without authorising new spend.
- Analysis `d797492d`, cited as **M-06's demonstrated `FR-100` claim**: "fully diagnosed from its trace without re-running".
- The rows behind the recorded database state: 261 context elements, 21 required capabilities, the published artifact.

Deleting them to tidy the introduction of a mechanism would destroy the evidence several milestone claims rest on, and would do it for rows that were never the problem `DBQ-6` describes. `DBQ-6`'s concern is "no **indefinite retention** of unowned content" going forward; it is not an instruction to purge the record on the day the rule arrives.

**Scope of the exemption, stated so it cannot spread:**

1. It covers **only** analyses created before the expiry migration. The sweep applies to every row created from that migration forward.
2. It is **not** a general retention exception, and grants no standing category of exempt content. There is no "evidence" flag on the table and none is added.
3. It ends when the exempt rows are no longer needed as evidence — an owner decision, not an automatic one.
4. Their **stage traces are not exempt** and were purged on the `DB §8.3` schedule long ago. The exemption preserves analyses, not traces, and `NFR-034` is untouched.

## 4. Single-analysis enforcement (`APIQ-4`'s second half)

`API §3.4` scopes an anonymous token to "exactly one analysis", and `API §7.8` permits an anonymous caller to create one analysis and not a second.

**The token is the enforcement.** It is issued once, at creation, for the analysis it was created with, and grants read and event-stream access to that analysis only. Enforcement is therefore a property of what the token *is* — a credential naming one analysis — rather than a counter somebody has to remember to check.

⚠️ **An analysis id never establishes ownership.** The anonymous principal is resolved by **verifying the presented token**: the raw token is hashed and matched against `anonymous_token_hash`, and the analysis it belongs to is the *result* of that verification, never an input to it. A caller who knows or guesses an analysis id, and presents no token, is anonymous with no principal and is refused. Tokens are generated with a cryptographically secure random source and are unguessable; ids are not credentials and are not treated as any.

## 5. What this costs

**A user who waits more than 24 hours loses the ability to claim**, and after 7 days loses the analysis. `FR-004` promises a claim "within the same session" and no more, so this is the requirement's own bound rather than a reduction of it — but it is a real limit and belongs in the `NFR-031` policy text in those words.

**`NFR-031` is not discharged by this record.** Setting the values makes the policy writable; publishing it is a separate deliverable, exactly as `DB §8.3` says of the trace periods.

## 6. Non-claims

- This does **not** publish the data policy, and `NFR-031` remains unmet until it is.
- This does **not** create a general retention exemption, an evidence category, or any flag on the table. §3 covers a fixed set of pre-existing rows.
- This does **not** decide access-token or refresh-token lifetimes, which are the *authenticated* classes — see [D-44](19-D-44-Refresh-Token-Table.md).
- This does **not** resolve `DBQ-9` (partition granularity), which is a separate Sprint 5 question and stays open.
- The 24-hour and 7-day values are **policy values subject to revision**, in the same sense `DB §8.3` records of its own: they are set so `DBQ-6`, `APIQ-4` and `NFR-031` become satisfiable, on no usage data, and are expected to be revisited.
