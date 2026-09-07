# D-56 — Monitoring, alerting, and what a drill has to produce to count

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** how `M-19` Phase 4 satisfies `NFR-082`, `NFR-085`, `NFR-031`, and the two drills D-50/D-51 demand
**Affects:** `NFR-010`, `NFR-031`, `NFR-082`, `NFR-085`, `DB §8.3`, `DB §12.4`, `DBQ-2`, `DBQ-7`, `TM-17`, `M-18`, `M-19`
**Builds on** [D-50](25-D-50-Deployment-Topology.md), [D-51](26-D-51-Self-Hosted-PostgreSQL.md), [D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md).

---

## 1. The questions

Phase 4 is the half of `M-19` that is about *evidence* rather than
infrastructure. Four things had no settled answer:

1. What monitors what, and how does a firing rule reach a person.
2. Which alert thresholds are requirements and which are judgement.
3. What a backup drill must produce before "verified" may be said.
4. What the data policy has to disclose to be true.

## 2. The decisions

1. **Prometheus scrapes the application's own `/internal/metrics`;
   Alertmanager delivers to one webhook.** No exporter, no dashboard tier.
2. **Four operational metrics are added**, kept separate from the ten `PRD §3.2`
   product metrics.
3. **Only the completion-rate threshold is treated as a requirement.** The rest
   are recorded as provisional.
4. **A restore drill must restore into a scratch database and compare row
   counts and a spot-checked analysis** — and the drill script is itself
   verified by differential.
5. **The data policy states the backup window.** Without it the deletion
   promise is false.

## 3. Why nothing was added between the app and Prometheus

`/internal/metrics` has emitted Prometheus text format since `M-16` (`API-070`),
so the endpoint was already the right shape. An exporter or a push gateway
would have added a component that can disagree with the source.

⚠️ **The scrape goes over the compose network, not through the edge.**
[D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md) §6 has Caddy answer 404 to
`/internal/*` from the internet. Prometheus reaches `backend:3000` directly, so
that block costs monitoring nothing — and neither Prometheus nor Alertmanager
publishes a port, because the operator token and the alert webhook are both
credentials.

⚠️ **A wrong operator token makes every scrape 401 and the target read as
"down"** — indistinguishable from the process being dead. The `BackendDown`
alert says so in its own description, because that is where somebody will read
it at 3am.

## 4. Four operational metrics, kept apart from the product ten

The `PRD §3.2` metrics measure whether the product works. These measure whether
the *deployment* is keeping promises already made. Merging them would let an
operational alert read as a product regression.

| Metric | Why it exists |
|---|---|
| `purge_outbox_pending` | Instructions accepted and not yet done |
| `purge_outbox_overdue` | ⚠️ Past the window `API-011` quoted — a **broken promise**, not a backlog |
| `purge_outbox_failed` | Exhausted retries. The row is retained precisely so this can be non-zero |
| `encryption_plaintext_reads` | ⚠️ The **only** signal the encryption backfill is unfinished |

Each is a state the system reaches **without erroring and without any
user-visible symptom**. [D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md) §7
spells out the last one: a partly-sealed table serves reads perfectly well, so
`DB §13.1` row 3 can be unmet while everything looks healthy.

## 5. ⚠️ One threshold is a requirement; the rest are judgement

`NFR-010`'s 95% completion rate is written into the PRD and is not a
judgement call. `NFR-085` names it directly.

Everything else is provisional and labelled as such in `alerts.yml`. The
latency bounds come from `NFR-001`/`NFR-002`, which **`M-20` is the milestone
that measures under load** — so alerting on them now says "slower than the
target", not "violating a verified budget".

⚠️ **The metrics are cumulative gauges over all time, not rates over a window.**
`naigx_analysis_completion_rate` is completed ÷ started since the database was
created, which means a bad hour barely moves it once there is history, and it
swings wildly when there is almost none. Hence the `> 20` sample guards. This is
honest early warning, not an SLO; rate-windowed alerting needs the metrics
rewritten as counters, and that is named as the follow-up rather than pretended
away.

## 6. What a drill has to produce

### The restore drill

⚠️ **"Backup completed" is not "restore verified", and only the second is
evidence.** `pg_dump` exiting zero proves a file was written — not that it reads
back, that both databases were captured, or that the rows inside are the ones
anybody needed. D-51 §4 asks for a dump restored into a scratch database with
row counts and a spot-checked analysis, recorded with a date, and that is what
`deploy/restore-drill.sh` produces.

**The drill script is itself verified by differential** — a drill that always
passes is worse than none. Three inputs: intact (passed), primary-only (failed,
naming the missing trace dump), truncated (failed with 8 findings). ⚠️ Two real
defects surfaced that way, both the same shape: under `set -euo pipefail` a
failing command substitution killed the script **before it could print the
diagnostic it existed to print** — the primary-only case originally exited 2
with no output at all.

### The rollback drill

D-50 §4 requires it on the production deployment, and there is none, so it is
**not done**. The rehearsal found something that matters more than the
rehearsal:

> ⚠️ **Rolling back past the Phase 3 encryption boundary is a data-visibility
> incident, not a rollback.** The pre-encryption build starts against the
> current schema, passes its health check, and serves every user a base64
> envelope where their document should be — without erroring. The schema rolls
> back cleanly; the *data format* does not.

`SA §9.3`'s "migrations backward-compatible within one version" does not cover
this, because it is not a migration problem. The deployable floor after
`encrypt:backfill` is the first release that can open an envelope.

## 7. What the data policy must say

`NFR-031` requires it **accessible before first submission** — so the link sits
beside the form, not in a footer on a results page, and an automated check
asserts that.

⚠️ **It must state the 7-day backup window** (`DBQ-7`, `DB §12.4`). Deletion is
immediate in the live database and a copy persists in backups for up to 7 more
days; saying "deleted permanently" without that is a claim the system does not
honour. The same check asserts the page states 7 days, 30 days, 24 hours, the
word "backups", and that content is never used for training.

## 8. What this does not settle

- **`M-19` is not passed.** Its criterion is a *production deploy* with
  monitoring, alerting and verified rollback. Nothing is deployed; the rollback
  drill is unearned and the restore drill ran against a development database.
- **Off-host backup storage is unverifiable here.** It is a property of where
  `NAIGX_BACKUP_DIR` points, which no script can check.
- **Alert delivery is verified as a mechanism, not as a configuration.** A test
  alert reached a webhook receiver; whether the production webhook reaches a
  person is a first-deploy check, and Alertmanager starts happily with an
  unreachable receiver.
- **`M-18` remains reviewed, not passed**, and Phase 4 does not touch it.
