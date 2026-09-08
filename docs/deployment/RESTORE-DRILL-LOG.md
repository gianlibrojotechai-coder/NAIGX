# Restore drill log

**[D-51](../26-D-51-Self-Hosted-PostgreSQL.md) §4 requires this file.** Self-hosting
PostgreSQL is a deviation from `TC-009`'s preference for managed services, and
the drill is the evidence that pays for it. The obligation is specific: *"A dump
restored into a scratch database, row counts and a spot-checked analysis
verified. **Recorded with a date.**"*

⚠️ **"Backup completed" is not "restore verified", and only the second one is
evidence.** `pg_dump` exiting zero proves a file was written. It does not prove
the file reads back, that both databases were captured, that the schema matches
the code that will run against it, or that the rows inside are the ones anybody
needed. Each of those has failed silently in real systems while the dump job
stayed green. Nothing in this file may be filled in from a successful backup —
only from a run of `deploy/restore-drill.sh`.

Run it with:

```bash
# against the deployment
docker compose -f docker-compose.prod.yml --env-file deploy/.env \
  exec postgres bash /usr/local/bin/naigx-restore-drill
```

---

## Drills

| Date (UTC) | Dumps | Result | Notes |
|---|---|---|---|
| 2026-09-07 | `naigx-20260907T182040Z.dump`, `naigx_trace-20260907T182040Z.dump` | **PASS** | ⚠️ **Development database, not production** — no production deployment exists. Both databases restored into scratch; all 8 table row counts matched (analysis 22, analysis_input 3, classification 12, artifact 1, user 1, encryption_key 1, stage_trace 368, provider_invocation 80); analysis `106eb2af…` spot-checked — `raw_content` restored as an intact `naigx.v1.` envelope (678 bytes) with `character_count` (470) still describing the plaintext. |

### What that first row does and does not establish

**Does:** the backup script captures both databases; a custom-format dump
restores cleanly with `--exit-on-error`; row counts survive the round trip
exactly; a sealed `raw_content` envelope survives dump and restore without
truncation or re-encoding; and the drill script itself reports accurately —
verified by differential, below.

**Does not:** anything about production. There is no production host, so this
ran against the development database. ⚠️ **D-51 §4's obligation is not
discharged until a drill runs against a real backup of real deployed data**,
and the off-host storage requirement is a property of where `NAIGX_BACKUP_DIR`
points, which no drill can check.

### The drill script was itself verified by differential

A drill that always passes is worse than none. Three runs, 2026-09-07:

| Input | Expected | Actual |
|---|---|---|
| Both dumps, intact | pass | ✅ pass, exit 0 |
| Primary dump only (trace missing) | fail — `DB §1.4` makes the trace store a separate database, so a primary-only set is missing every stage trace | ❌ fail, exit 1, names the missing dump |
| Primary dump truncated to 52 KB | fail | ❌ fail, exit 1, 8 findings — restore errors plus every missing table |

⚠️ Two real defects in the script were found this way, both the same shape:
under `set -euo pipefail`, a failing command substitution killed the script
**before it could print the diagnostic it existed to print**. The primary-only
case originally exited 2 with no output at all, on precisely the failure it was
written to report. Both are fixed and commented in place.

---

## The dependency this log cannot check

⚠️ **These dumps contain ciphertext, so they depend on the root key file.**
`raw_content`, `structured_input` and `structured_output` are sealed
([D-53](../28-D-53-Encryption-Layers.md), [D-55](../30-D-55-Envelope-Format-And-Purge-Outbox.md),
[D-61](../36-D-61-Host-Held-Key-File.md)). Restoring a dump into a database
whose key file is gone yields rows nobody can read: **losing the key destroys
these backups as surely as deleting them.**

The drill verifies the envelope survived intact. It cannot verify the key still
exists. A production runbook must check both.

⚠️ **AND THE DUMPS ARE NOT THEMSELVES ENCRYPTED.** `pg_dump` output holds
plaintext for everything *except* those three sealed fields — user emails,
derived business content, audit events. The off-site sync encrypts each dump
before upload under a **separate** passphrase (`/etc/naigx/keys/backup.key`),
so restoring from off-site storage needs **two** keys, not one, and they must
be kept apart from each other and from the dumps.
