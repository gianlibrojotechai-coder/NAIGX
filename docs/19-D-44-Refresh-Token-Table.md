# D-44 — `SESSION` cannot express `API-002`; refresh tokens get their own table

**Date:** 2026-09-07
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Affects:** `DB §4.1` SESSION, `API §3.1`, `API-001`, `API-002`, `API-003`, `M-15`
**Supersedes nothing.** First decision of Sprint 5.

---

## 1. The contradiction, stated exactly

Two authoritative documents specify the same mechanism incompatibly.

**`DB §4.1` SESSION** gives the entity a single token:

> **Attributes** | `user_id` (FK), `token_hash`, `issued_at`, `expires_at`, `revoked_at`, `user_agent_class`, `ip_hash`
> **Retention** | Hard-deleted on expiry or revocation; **no historical session retention**

**`API §3.1`** requires two tokens with different lifetimes:

> Refresh | Separate refresh token, longer-lived, **single-use rotation**

and **`API-002`** requires reuse detection across a lineage:

> Refresh tokens are single-use; the old token is invalidated on rotation. **Reuse of a consumed refresh token invalidates the entire session family** and writes a security audit event — reuse indicates theft.

**Three things `API-002` needs that `DB §4.1` cannot hold:**

1. **A second token.** One `token_hash` column cannot store an access token and a refresh token with different lifetimes. Overloading it would mean either one lifetime for both — which is the thing a refresh token exists to avoid — or a second row per session pretending to be a session.
2. **A family.** "Invalidates the entire session family" presumes a lineage linking every token rotated from one original authentication. SESSION has no field naming that lineage, and `session_id` cannot serve: rotation would either mutate the session (losing the chain) or create sessions that are not sessions.
3. **Retention of consumed tokens.** Reuse is detected by recognising a token that has *already been spent*. A token deleted on rotation cannot be recognised on reuse — the request would look like an ordinary invalid token, and `API-002`'s "reuse indicates theft" signal would be silently unreachable. `DB §4.1`'s stated retention (**"hard-deleted on expiry or revocation; no historical session retention"**) forbids keeping exactly the rows detection requires.

Point 3 is the decisive one. The first two are shape problems; the third means that under `DB §4.1` as written, **the security property `API-002` exists to provide cannot be implemented at all**.

## 2. What was rejected

**Weaken `API-002` to fit the schema — single-token sessions, no rotation.** Rejected, and the owner ruled it out explicitly. `API §3.1` chose opaque server-validated tokens specifically so that "immediate revocation" is possible, on the stated grounds that a non-revocable token "is unacceptable when a session grants access to confidential business content". Removing rotation and reuse detection would keep the revocation machinery while discarding the case it was chosen for. A stolen refresh token would then be usable for its full, longer lifetime with nothing able to notice.

**Add `refresh_token_hash`, `family_id` and `rotated_at` columns to SESSION.** Rejected. It solves points 1 and 2 and **not** point 3: a rotated token still has to be retained to be recognised, so either the session row survives its own rotation — contradicting `DB §4.1`'s retention line — or history is kept in a table whose specification says it keeps none. It also makes SESSION mean two things at once: the current authorisation, and an append-only ledger of superseded credentials.

**A `consumed_refresh_tokens` deny-list beside the existing columns.** Rejected as the same table split badly: the lineage and the consumed record belong to one entity, and separating them means a reuse check that joins two tables to answer one question — the shape `DB §5.5` warns about when it says an authorization check requiring several joins "is an authorization check that will eventually be skipped".

## 3. The decision

1. **A separate `REFRESH_TOKEN` table**, N:1 to SESSION. Session lifecycle and refresh-token lifecycle are modelled separately because they *are* separate: a session is the current authorisation, a refresh token is a single-use credential for obtaining the next one.
2. **`SESSION` is not changed.** It keeps `token_hash` as the access token, and keeps `DB §4.1`'s retention exactly as specified. This decision adds an entity; it does not amend one.
3. **`API-002` is implemented as written.** Single-use rotation, family-wide invalidation on reuse, and a security audit event. Nothing in the contract is relaxed.
4. **The table carries lineage.** A `family_id` shared by every token rotated from one authentication, so revocation on reuse is a single predicate over the family rather than a walk up a chain.
5. **Consumed tokens are retained long enough to detect reuse**, then expire. A consumed row is what makes reuse recognisable; its retention is the mechanism, not an oversight. The retention period is the refresh token's own lifetime — after that the token would be rejected as expired anyway, and keeping it longer would retain a credential record with nothing left to prove.
6. **Reuse revokes the family and the session**, and writes an `AUDIT_EVENT`. A caller presenting a spent token is either a client with a bug or an attacker with a stolen credential, and the safe reading of an ambiguous case is the second.

## 4. What this costs

**`DB §4.1` no longer describes the whole of session state.** A reader of the database specification will not find refresh tokens there, and will find them here instead. That is a real documentation seam and the reason this record exists rather than a silent extra table.

**One more table in the identity domain.** `DB §10.4` records that v1 "avoids *precluding* RBAC without *implementing* it", and this addition is consistent with that: ownership stays explicit, and authorization stays centralized at the API layer (`SA §10.2`).

## 5. What closing this requires

`DB §4.1` should gain the `REFRESH_TOKEN` entity, or an explicit cross-reference to this record, so the schema specification and the implemented schema agree. That is a documentation change and is **not** made here — this record does not amend `docs/06`.

## 6. Non-claims

- This does **not** amend `DB §4.1`, and does not change the SESSION entity.
- This does **not** relax any part of `API-002`.
- This does **not** implement rate limiting, operator authentication (`APIQ-6`), or API keys (`API §3.5`, not in v1.0).
- This decides schema shape only. Token lifetimes for the *anonymous* class are [D-45](20-D-45-Anonymous-Expiry-And-Token-Lifetime.md); refresh and access lifetimes are implementation values recorded with the code, not here.
