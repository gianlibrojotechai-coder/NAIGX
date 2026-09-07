# D-41 — Anonymous export is permitted; the `M-4` metric waits for a real owner

**Date:** 2026-09-07
**Status:** Accepted
**Sprint:** 4 (Handoff surface)
**Affects:** `API-040`, `FR-050`–`FR-052`, `DB §4.4` EXPORT, `M-4`, `M-13`
**Supersedes nothing.** Extends the Sprint 3 deviation pattern of [D-37](12-Sprint-1-Decision-Record.md), [D-39](14-D-39-D-37-Amendment.md) and [D-40](15-D-40-Existing-Workflow-Module-Mapping.md).

---

## 1. This is a deviation, stated as one

The specification forbids this in **three** places, not one:

1. `API-040` specifies export as **"Auth: Required — not available anonymously"**.
2. `API §7.8` "Anonymous constraints" tabulates **Export** under *"Not permitted"*, alongside listing analyses, submitting feedback and deleting an account. The same table explicitly *permits* anonymous users to "Retry a failed artifact" — so the prohibition on export is a considered distinction, not an oversight in a blanket rule.
3. `DB §4.4` EXPORT carries `user_id` as an FK to User, indexed `(user_id, generated_at)`, and its design note is explicit that the record **"exists solely to instrument `M-4` export rate — the primary behavioral trust signal (`MVP §3.2`)"**.

**This decision does not meet that requirement in Sprint 4.** It permits export without authentication, and it does not record an `EXPORT` row for an anonymous export. Both halves are departures from the specification as written, and neither is a reinterpretation of it. The `API §7.8` line is cited here specifically because it was found *after* the deviation was approved on the strength of `API-040` alone: the case for deviating is unchanged, but the record must not understate how deliberately the specification said no.

## 2. Why the requirement cannot be met as written

Authentication is **M-15, Sprint 5**. Export is **M-13, Sprint 4**. The specification places a Sprint 4 deliverable behind a Sprint 5 dependency.

That is not a documentation slip — `docs/08` §Sprint 5 acknowledges the ordering directly: *"Auth arriving in Sprint 5 means Sprints 1–4 run without user accounts. Accepted deliberately."* What the roadmap did not carry through is that `API-040`'s auth requirement makes M-13 unreachable under that same ordering.

The circle is the one D-39 broke for M-08, in the same shape: a milestone whose stated precondition is scheduled after it.

## 3. What was rejected

**Pulling M-15 authentication forward into Sprint 4.** Rejected. It reorders the roadmap around a single endpoint's auth line, converts a presentation sprint into an identity sprint, and drags in user records, sessions, password handling and the `FR-063` deletion guarantees — none of which Sprint 4 is scoped, designed or gated for. The owner has ruled this out explicitly.

**Deferring export to Sprint 5.** Rejected. It would leave Sprint 4 holding only M-14 and would abandon the sprint's stated goal — *"the moment where the hypothesis is actually tested — the user showing output to someone else."* Export is the whole point of the sprint.

**Inventing an owner.** Rejected, and this is the important one. `API-020` already stores `anonymousTokenHash: hashContent(randomUUID())` to satisfy `analysis_exactly_one_owner_check`, and the consequence is recorded as an open defect: the token is never issued, so `FR-004` claimability is unmet. Minting a synthetic `user_id` for an export would repeat that mistake in a table whose entire purpose is measurement, and would corrupt `M-4` with rows attributable to nobody. **A metric with invented subjects is worse than a metric with missing rows**, because the second is visibly incomplete and the first is silently wrong.

## 4. The decision

1. **Export generation is available without authentication.** `API-040` accepts an anonymous request against a terminal analysis and returns the document.
2. **No ownership is invented.** No synthetic `user_id`, no placeholder User row, no reuse of the anonymous token hash as though it were an identity.
3. **The `EXPORT` row — and therefore the `M-4` signal — is written only when a real authenticated owner exists.** Until M-15 lands, that condition is never true, so no `EXPORT` rows accrue. This is intended: the table stays empty and honest rather than populated and meaningless.
4. **Ownership checks are written now and enforced when there is something to enforce.** The code path that decides "is this caller the owner" exists from the start, so M-15 supplies an identity rather than a new branch.
5. **`API-041` download is a direct on-demand response.** No stored files, no signed-URL infrastructure. This resolves `APIQ-2` — *"direct response versus signed time-bounded URL", due Sprint 4, "must remain owner-scoped and non-enumerable"* — in favour of the direct response, because `DB §4.4` already requires that **generated files are not stored** and regeneration from immutable artifacts is deterministic. A signed URL would add issuance, expiry and revocation machinery to serve a document we can produce on the spot.

## 5. What this costs

**`M-4` export rate is unmeasurable until M-15.** `MVP §3.2` calls it the primary behavioural trust signal, and this decision means it records nothing during Sprint 4. Anonymous export volume in this period is **not recoverable retrospectively** — the rows are not being written, so they cannot be backfilled.

That cost is accepted because the alternative is not "measure it properly", it is "measure it wrongly". `M-16` instrumentation is Sprint 5 work in any case, arriving alongside the identity that makes the metric meaningful.

## 6. What closing this requires

When M-15 lands:

1. `API-040` enforces `Auth: Required` as specified, for authenticated users.
2. Every export by an authenticated owner writes its `EXPORT` row.
3. `M-4` begins reporting, with its start date recorded as the M-15 date rather than the M-13 date — a chart that implies the metric existed earlier would be the same lie this record exists to avoid.

Whether anonymous export survives M-15 at all is **not decided here**. This record authorises it for Sprint 4 and leaves the permanent policy to the identity work. `API §7.8` currently says it should not survive; that table is the thing to revisit, and revisiting it is an owner decision rather than an implementation detail.

## 7. Non-claims

- This does **not** claim `API-040` is implemented to specification.
- This does **not** claim `M-4` is instrumented.
- This does **not** authorise any other endpoint to relax its auth requirement.
- This does **not** pull M-15 forward, in whole or in part.
