# D-51 — Self-hosted PostgreSQL, and what that obliges: `DBQ-7` resolved at 7 days

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** `DBQ-7` (backup retention window versus the deletion promise)
**Deviates from:** `SA §9.3` (managed data services), `TC-009` (managed preferred)
**Affects:** `DB §8.3`, `DB §12.4`, `FR-073`, `NFR-031`, `M-19`
**Depends on** [D-50](25-D-50-Deployment-Topology.md).

---

## 1. The decision

1. **Both PostgreSQL databases run on the deployment host**, in containers, as
   they already do in development — the primary store and the separate trace
   store `DB §1.4` requires.
2. **This is a recorded deviation from `SA §9.3` and `TC-009`**, not a
   reinterpretation of them. Both prefer managed data services with automated
   backup, for reasons that remain valid.
3. **`DBQ-7` is resolved at 7 days.** Backups containing business content are
   retained for a **maximum of 7 days**, and that window is **disclosed** in
   the data policy.
4. **A backup is not evidence of recoverability. A restore is.** The `M-19`
   criterion is met by a completed restore drill, not by the existence of dump
   files.

## 2. The deviation, stated rather than softened

`SA §9.3` asks for "managed PostgreSQL with automated backup" and gives the
reason directly: "operational burden must be sustainable by one person". A
self-hosted database moves four things onto the operator that a managed service
would have absorbed — backup scheduling, backup verification, version upgrades,
and failure recovery.

**What is bought:** roughly $15–50/month at current managed-Postgres rates,
against a ~$9/month host. At a project with no revenue and no users, that
ratio is the whole argument.

**What is paid, precisely:**

| Risk | Why it is accepted here | What would reverse it |
|---|---|---|
| Backups are the operator's problem | A cron'd `pg_dump` is a solved, boring mechanism | A missed-backup incident |
| No point-in-time recovery | v1.0 has no RPO requirement in any document | Any stated RPO, or beta users |
| Restore is untested until tested | §4 makes the drill a release gate, not an intention | — |
| Host loss loses both stores | Both databases share a host; off-host backup copies are therefore **mandatory**, not optional | — |

⚠️ **The failure mode this record exists to prevent** is the one where backups
run nightly for months, and the first restore is attempted during the incident
that needs it. That is why §4 is a gate.

## 3. `DBQ-7` — the tension, and the honest answer

`DBQ-7` asks how the backup retention window squares with the deletion promise.
The tension is real: `FR-073` and `DB §12.4` promise deletion, and a backup
taken before a deletion still contains the deleted content.

**7 days, chosen to match what the schema already promises.** `DB §8.3` sets
stage-trace retention at 7 days — the shortest content-bearing window in the
system. A backup window longer than that would silently outlive the retention
policy it is backing up, so the backup window is set to the same 7 days rather
than to a number chosen for operational comfort.

**What is disclosed, and what is not claimed:**

- ✅ Deletion removes content from the live stores immediately, and the
  cross-store trace purge follows within the stated window (`DB §5.4`).
- ✅ Backup copies containing that content are retained **at most 7 days** and
  are then destroyed by rotation.
- ❌ **Immediate physical eradication from all media is not claimed.** It would
  be false. `DBQ-7`'s own note is the governing sentence here: *"silence is a
  broken promise"* — so the bounded window is published rather than omitted.

## 4. What `M-19` must actually do

| Obligation | Evidence required |
|---|---|
| Scheduled dumps of **both** databases | The schedule exists and has run |
| Backups stored **off the deployment host** | Host loss must not take the backups with it |
| 7-day rotation, enforced automatically | Old dumps are deleted without operator action |
| **A restore drill** | A dump restored into a scratch database, row counts and a spot-checked analysis verified. **Recorded with a date.** |
| Backups excluded from logs and metrics | They contain Confidential business content (`DB §13.2`) |
| The window published | Data policy page (`NFR-031`), stating 7 days explicitly |

⚠️ Backups contain `raw_content`, so once
[D-53](28-D-53-Encryption-Layers.md) lands they contain **ciphertext** for the
application-level fields. A restore therefore depends on the KMS key still
existing — losing the key destroys the backups as surely as deleting them.
That dependency is named in D-53 §6 and must appear in the runbook.

## 5. What was rejected

**Managed PostgreSQL.** Rejected on cost alone, and it is the option `SA §9.3`
prefers. It would be the right call the moment there is revenue, beta users, or
a stated RPO — and this record should be revisited at the first of those.

**A longer backup window for operational comfort** (14 or 30 days). Rejected.
It would exceed the 7-day trace retention the schema already commits to, making
the published policy the weaker of two contradictory promises.

**Not taking backups, on the grounds that data is reproducible.** Rejected. It
is not: analyses cost provider spend to produce, and `M-08` evidence rows are
cited project evidence ([D-45](20-D-45-Anonymous-Expiry-And-Token-Lifetime.md)).

**Saying nothing about backups in the data policy.** Rejected by `DBQ-7`'s own
terms.
