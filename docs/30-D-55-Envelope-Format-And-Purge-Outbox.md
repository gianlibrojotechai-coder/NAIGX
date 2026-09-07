# D-55 — The envelope on the wire, and the purge outbox in the primary store

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the implementation questions [D-52](27-D-52-Managed-Key-Service.md) and [D-53](28-D-53-Encryption-Layers.md) leave open, and how `DB §5.4` step 2 becomes durable
**Affects:** `DB §5.4`, `DB §13.1`, `DB §13.2`, `SA §10.4`, `FR-062`, `FR-073`, `API-011`, `API-023`, `M-18` H-2, `M-19`
**Implements** D-52 and D-53. Supersedes nothing.

---

## 1. The questions

D-52 chose envelope encryption and a cached data key; D-53 chose the three
fields and the decrypt-and-filter search. Neither says what the stored value
*looks like*, where the durable purge queue *lives*, or what happens between
the schema migration and the first sealed row. Those are this record.

## 2. The decisions

1. **One text envelope for all three fields**, `naigx.v1.<version>.<iv>.<tag>.<ciphertext>`.
2. **The key version is authenticated**, not merely written alongside.
3. **The purge outbox lives in the primary store**, written in the deletion's
   own transaction.
4. **`TracePurgeQueue.enqueue` becomes asynchronous** and accepts that
   transaction.
5. **The backfill is an application command, not a SQL migration**, and the
   mixed window it creates is *counted* rather than tolerated silently.
6. **Two gates on the no-local-key rule**, not one.

## 3. Why one text envelope

`raw_content` is a `String` column; `structured_input` and `structured_output`
are `Json`. A binary format would have needed a column type migration on the
trace store and a second codec to keep in step with the first. Text stores in
all three unchanged — the `Json` columns hold the envelope as a JSON string.

`base64url` rather than `base64`, so nothing needs escaping in a URL, a log
line, or a JSON document.

## 4. ⚠️ Why the key version is authenticated

The version is bound as AES-GCM **additional authenticated data**, not just
concatenated into the string. Without that it is attacker-editable metadata
sitting outside the integrity guarantee: an attacker who can write to the
column could relabel a row to cite a different key version — a deliberately
weakened one, or one whose material leaked — and the tag would still verify.

This costs nothing and is invisible in a round-trip test, which is precisely
why it is recorded rather than left as a detail. `tests/unit/envelope.test.ts`
asserts that rewriting the version breaks the tag.

## 5. ⚠️ Why the outbox is in the PRIMARY store

This looks backwards: the work is deleting rows from the *trace* store, so the
queue "should" live there. It must not.

`DB §5.4` step 1 commits the analysis deletion in the primary store. An
instruction written anywhere else leaves an instant where **the deletion is
durable and the instruction is not** — a crash there loses the purge silently,
which is exactly the failure the in-memory queue had. In the primary store both
writes share one transaction: either the analysis is gone and its traces are
owed a purge, or neither happened.

`DB §1.4` forbids a foreign key across the store boundary and this respects it:
bare ids, no FK, nothing joining the stores. There is also **no foreign key on
`user_id`**, deliberately — the common case is that the user has just been
deleted, so a cascade would remove the instruction and a restrict would block
the deletion it exists to follow up.

**A row that exhausts its attempts is marked, never deleted.** It records a
purge the user was told would happen and which did not; deleting it would
destroy the only evidence that anything is still owed.

## 6. Why `enqueue` changed shape

It returned `void`, which was honest for an in-memory array and impossible for
a durable queue: "the instruction is accepted" has to mean "the row is
committed", and that cannot be claimed without awaiting a write.

The interface is still **one interface with one swap point** — the property the
roadmap protected — and the in-memory implementation still satisfies it. The
optional `tx` parameter is what lets the caller enlist the write in the
deletion's transaction. **No API contract changed**: `API-011`/`API-023` still
return `202` with a stated window, because that promise was always honoured at
step 1 and never depended on the trace store.

## 7. ⚠️ The mixed window, and why it is counted

Sealing a row needs the data key, which needs a call to the key service, which
SQL cannot make. So the schema migration adds the tables and
`npm run encrypt:backfill` seals the content — and between them the tables hold
**both** sealed and plaintext values.

The read path therefore accepts plaintext. That is the only workable choice —
rejecting it would take the service down mid-migration — and it is also
dangerous, because **a half-finished backfill behaves exactly like a finished
one**. Nothing errors, nothing looks wrong, and the requirement is quietly
unmet.

So plaintext reads are **counted** (`FieldCipher.plaintextReads`) and
`npm run encrypt:status` reports the remaining rows and exits non-zero. That
count is the only signal the window has closed; `DB §13.1` row 3 is not
satisfied until it reads zero.

## 8. Why two gates on the no-local-key rule

`loadConfig` refuses to start a production process without
`NAIGX_KMS_KEY_ID`, **and** the offline provider refuses to construct under
`NODE_ENV=production`. The duplication is deliberate: D-52 §4 is the
load-bearing security decision of this whole layer, and a single gate on a rule
that consequential is one well-meaning edit away from being removed.

## 9. What this does not settle

- **⚠️ KMS IS UNVERIFIED.** `src/crypto/providers/aws-kms.ts` has never made a
  real call — no account exists yet. Everything else is proved against the
  offline double, which is evidence about the *interface* and none at all about
  the *service*. `tests/integration/kms-live.test.ts` is the only thing that
  discharges this, and it skips. **A skip is "not checked", never "passed".**
- **`M-18` H-2 does not close here.** D-53 §6 is explicit that it closes when
  both layers are *deployed and verified*, not when the code merges. Full-volume
  encryption (`NFR-021`) needs a host that does not exist.
- **Rotation is supported but unexercised.** The versioned envelope and the
  multi-version key ring make it a data operation, and no rotation has been
  performed.
- **Search is `O(the user's analyses)`** (D-53 §4). Accepted at v1.0; the
  trigger for revisiting is a user whose search is slow.
