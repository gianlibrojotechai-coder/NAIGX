# D-53 — Two encryption layers, told apart; and what encrypting `raw_content` costs

**Date:** 2026-09-08
**Status:** **Accepted and still in force.** ⚠️ Amended by [D-61](36-D-61-Host-Held-Key-File.md), 2026-09-08 — *where the root key comes from* changed; nothing in this record did.
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** `DBQ-8` (application-level encryption scope) in full

> **Unchanged by D-61:** the two-layer split, the three sealed fields, the
> decrypt-and-filter search in §4 and its measured revisit trigger, and §6's
> rule that `M-18` H-2 closes only when both layers are deployed and verified.
> ⚠️ Read "managed key service" in this record as "the key provider" —
> [D-61](36-D-61-Host-Held-Key-File.md) replaced AWS KMS with a host-held key
> file and recorded `DB §13.1`'s managed-key-service row as an explicit v1.0
> deviation.
**Corrects:** the `NFR-021` mislabel in [the M-18 review](security/M-18-SECURITY-REVIEW.md) H-2
**Affects:** `NFR-021`, `DB §13.1`, `DB §13.2`, `FR-062`, `M-18`, `M-19`
**Requires** [D-52](27-D-52-Managed-Key-Service.md).

---

## 1. Two requirements that were being treated as one

`DB §13.1` is a four-row table, and two of its rows are different obligations
with different fixes and different costs. `M-18`'s H-2 finding collapsed them,
labelling the application-level gap as `NFR-021`. That was wrong.

| Layer | Requirement | Cites | Fix | Cost |
|---|---|---|---|---|
| **At rest** | Full-volume encryption on both stores | **`NFR-021`** | Encrypted volume on the host | **$0** |
| **Application-level** | `raw_content`, `structured_input`, `structured_output` | **no NFR** | Envelope encryption (D-52) | **$1/mo** |

`PRD` line 859 states `NFR-021` in full as *"Stored analysis content encrypted
at rest"*, and `DB §13.1` maps that phrase to the full-volume row. The
application-level row carries no requirement number at all — it is a database
design obligation, and it is the stronger of the two.

**Both are unimplemented, so `M-18` H-2 stands and the verdict is unchanged.**
What changes is only the label and the cost: one blocker was actually a free
one and a $1/month one.

## 2. The decision

**Implement both layers.**

1. **Full-volume encryption** on the deployment host's data volume, covering
   both PostgreSQL databases and the backup staging directory. Satisfies
   `NFR-021`.
2. **Application-level envelope encryption** on `raw_content`,
   `structured_input` and `structured_output`, using D-52's cached data key
   and AES-256-GCM. Satisfies `DB §13.1` row 3.
3. **`DBQ-8` is closed**, not deferred further: the scope is exactly these
   three fields, which is what `DB §13.2` classifies as Confidential business
   and what row 3 already names.

## 3. ⚠️ Full-volume encryption on rented infrastructure is weak, and is claimed narrowly

`NFR-021` will be **met** by an encrypted volume. It should not be *believed*
to deliver much, and the reason belongs in the record rather than in nobody's
head:

- **The key must be present for unattended reboot.** A VPS that reboots without
  a human typing a passphrase has its unlock material on or near the machine.
- **The host operator can read RAM.** On rented infrastructure the volume key
  is in memory belonging to someone else's hypervisor.
- Its genuine value is narrow and real: **disk decommissioning and physical
  media handling.** That is what it defends, and that is all that is claimed.

**This is the argument for doing the application-level layer properly rather
than treating `NFR-021` as the answer.** `DB §13.1` row 3 states the property
it wants — *"so that a storage-layer compromise does not yield plaintext
business content"* — and on a rented host, only the layer whose key lives
elsewhere (D-52) delivers it.

## 4. ⚠️ Encrypting `raw_content` breaks `FR-062` search, and `DBQ-8` foresaw it

[`history.ts:171`](../backend/src/routes/history.ts#L171) implements search as a
SQL predicate:

```ts
{ input: { rawContent: { contains: search, mode: "insensitive" } } }
```

**A database cannot substring-match ciphertext.** Encrypting the column makes
that predicate match nothing — silently, returning an empty result rather than
an error, which is the worst available failure.

`DBQ-8`'s own resolution criterion anticipated this: encryption scope *"must
not prevent the history-listing and quality queries the schema exists to
serve"*. So the conflict is in scope for this record to solve, not to discover.

**The resolution: decrypt and filter in the application.** For a search
request, the user's analyses are fetched with their encrypted input, decrypted
in process, filtered on the plaintext, and paginated from the filtered set.

| Property | Effect |
|---|---|
| `FR-062` semantics | **Unchanged** — still case-insensitive substring matching, exactly as today |
| Unsearched listing | **Unchanged** — no search term means the existing keyset query runs untouched |
| Scaling | ⚠️ Search becomes `O(user's analyses)` per request instead of an indexed scan |
| Blast radius | Search only. Listing, filtering by classification, and pagination without a term are unaffected |

⚠️ **The scaling limit is real and is recorded, not hidden.** At v1.0 a user
has tens of analyses and AES-GCM decryption is microseconds per row, so the
cost is invisible. It becomes a problem at thousands of analyses per user,
which no document projects for v1.0. **The trigger for revisiting is a user
whose history search is slow** — at which point the options are a blind index
over normalized tokens (leaks token presence, changes substring semantics) or
leaving `raw_content` in plaintext (abandons row 3). Neither is worth taking
before the problem exists.

## 5. What was rejected

**Encrypting only the two trace fields**, leaving `raw_content` plaintext to
keep search working. Rejected. `raw_content` is the user's submitted document —
the single most sensitive field in the system, and the one row 3 names first.
Trading it for a SQL predicate is trading the requirement for the convenience.

**A blind index instead of decrypt-and-filter.** Rejected *now*, not forever.
It scales better, and it changes `FR-062`'s substring behaviour to token
matching and leaks which tokens a document contains. Not worth a behaviour
change and a leak to solve a performance problem that does not exist yet.

**Treating `NFR-021` as satisfying `DB §13.1` entirely.** Rejected — §3.
Meeting the numbered requirement while missing the unnumbered one that states
the actual security property would be the letter without the point.

**Deferring `DBQ-8` again.** Rejected. It has been open since 2026-08-12 with
"before production data" as its deadline, and `M-19` is production data.

## 6. Consequences

| Consequence | Handling |
|---|---|
| Existing rows are plaintext | A migration encrypts them in place; the envelope's version prefix distinguishes encrypted from not |
| Backups become key-dependent | [D-51](26-D-51-Self-Hosted-PostgreSQL.md) §4 — key loss destroys backups. In the runbook |
| Trace store also needs the key | `structured_input`/`structured_output` live there; both stores get the same DEK |
| Search is `O(n)` per user | §4; recorded in `STATUS.md` limitations |
| `M-18` H-2 | Closes when **both** layers are deployed and verified — not when the code merges |
| The M-18 review's H-2 label | Corrected in place, with the correction visible rather than silent |
