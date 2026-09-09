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
# against the deployment — inside the backup container, which has the pg
# tools, the PG* environment and /backups mounted. ⚠️ The script is NOT
# installed in any container (an earlier edition said `exec postgres bash
# /usr/local/bin/naigx-restore-drill`; that path does not exist — verified
# 2026-09-09). Pipe it in from the checkout:
docker exec -i -e BACKUP_DIR=/backups naigx-backup bash -s < deploy/restore-drill.sh

# against the OFF-HOST copies — pull them back, decrypt by key path, drill in a
# throwaway container on the compose network, then remove the decrypted files:
#   rclone copy gdrive:naigx-backups /tmp/d --include '*<stamp>.dump.enc'
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in X.dump.enc -out X.dump \
#     -pass file:/etc/naigx/keys/backup.key
#   docker run --rm -i --network naigx_naigx -e PGHOST=postgres -e PGUSER=… \
#     -e PGPASSWORD=… -e BACKUP_DIR=/drill -v /tmp/d:/drill:ro postgres:17 \
#     bash -s < deploy/restore-drill.sh
#   rm -rf /tmp/d
```

---

## Drills

| Date (UTC) | Dumps | Result | Notes |
|---|---|---|---|
| 2026-09-09 | **OFF-HOST COPIES** — `naigx-20260909T081138Z.dump.enc` (316,528 B) + trace (437,280 B), pulled back from `gdrive:naigx-backups` | **PASS** | ✅ **PRODUCTION, from the off-site remote.** The dumps were written by `naigx-backup once`, encrypted and uploaded by one manual start of the existing `naigx-offsite-sync.service` (the unit the hourly timer runs), then **downloaded from Google Drive**, decrypted with `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:/etc/naigx/keys/backup.key`, and found **byte-identical to the local staging dumps by SHA-256** (`90096cac…`, `0696f1ee…`). Drilled in a throwaway `postgres:17` container on the compose network: all 9 counts matched (analysis 9, analysis_input 9, classification 9, artifact 9, user 0, encryption_key 1, data_format 1, stage_trace 56, provider_invocation 40); `0d7355e0…` envelope intact. Decrypted copies removed afterwards; 0 scratch databases remain. ⚠️ Restoring from off-site needs **both** keys: `backup.key` to decrypt the file and `root.key` to read the sealed fields. |
| 2026-09-09 | `naigx-20260909T080520Z.dump` (284K), `naigx_trace-20260909T080520Z.dump` (236K) | **PASS** | ✅ **PRODUCTION** — the live VPS, owner-authorised. Run inside the `naigx-backup` container against the production Postgres server, scratch databases `naigx_drill_20260909T080520Z` + `_trace_` created and dropped. All 9 table counts matched (analysis 5, analysis_input 5, classification 5, artifact 5, user 0, encryption_key 1, data_format 1, stage_trace 31, provider_invocation 22); analysis `0d7355e0…` spot-checked — `raw_content_sealed` an intact `naigx.v1.` envelope (162 bytes), `character_count` 83 still describing the plaintext. No scratch database left behind. |
| 2026-09-07 | `naigx-20260907T182040Z.dump`, `naigx_trace-20260907T182040Z.dump` | **PASS** | ⚠️ **Development database, not production** — no production deployment exists. Both databases restored into scratch; all 8 table row counts matched (analysis 22, analysis_input 3, classification 12, artifact 1, user 1, encryption_key 1, stage_trace 368, provider_invocation 80); analysis `106eb2af…` spot-checked — `raw_content` restored as an intact `naigx.v1.` envelope (678 bytes) with `character_count` (470) still describing the plaintext. |

### What the 2026-09-09 rows establish — and the one thing they do not

Both D-51 §4 obligations this file exists for are now met on **real deployed
data**: a dump restored into a scratch database with counts and a spot-check
verified, and the same for a copy that had actually left the host. What they
do not establish is anything about the *next* backup — the drill is dated
evidence, not a property. Re-run after any change to `backup.sh`, the sync
script, the key files, or the Postgres major version.

⚠️ **The off-site mechanism lives only on the host.** `/usr/local/bin/naigx-offsite-sync`
(with a copy at `/root/naigx-offsite-sync.sh`) and the two systemd units are
**not in this repository**. Losing the host loses the script that knows how the
off-site copies were encrypted. The command above records the decrypt
parameters for exactly that reason; bringing the script under `deploy/` is an
open item, not done here.

### What the 2026-09-07 row does and does not establish

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
