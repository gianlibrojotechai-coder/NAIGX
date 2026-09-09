# Rollback drill log

**[D-50](../25-D-50-Deployment-Topology.md) §4 requires this.** There is no
staging environment, and the argument for skipping one rests on a rollback drill
run against the production deployment itself — *"stronger evidence than one
performed elsewhere, because it exercises the actual host, the actual data
volume, and the actual migration state."* `TM-17` and `SA §9.3` require rollback
verified, not assumed.

✅ **THE PRODUCTION DRILL WAS PERFORMED ON 2026-09-09** — see *Production
drill* below. All four of "what verified requires" were met, with the
observed numbers. The rehearsal section that follows is kept because the
finding it records (D-57) is what made the production drill safe to attempt.

⚠️ **This discharges the rollback criterion only.** `M-19` still has the
off-host backup verification and the other items in `SESSION-HANDOFF.md` §7;
the milestone is not claimed here.

---

## Rehearsal — 2026-09-07 (UTC), development database

### What was actually run

The Phase 2 backend image — the release a rollback from Phase 3 would land on —
started against the Phase 3 schema and read its data.

| Check | Result |
|---|---|
| Phase 3 migration is additive (`encryption_key`, `trace_purge_outbox`; no column altered, no row rewritten) | ✅ from the migration itself |
| Phase 2 code **starts** against the Phase 3 schema | ✅ |
| Phase 2 code **reads** rows written by Phase 3 | ✅ 22 analyses counted, no error |
| Phase 2 code returns correct **content** | ❌ **see below** |

### ⚠️ The finding: rollback across the encryption boundary is NOT safe

The old code read `raw_content` and got:

```
"naigx.v1.1.ZsDNud9imNioT7wY.ow78xee1ZYWjL7mnql8uyw.QHzx…"
```

**It did not error.** Phase 2 has no cipher — it reads the column and returns
it. So a rollback from Phase 3 to Phase 2 leaves a service that starts cleanly,
passes its health check, serves history listings, and hands every user a base64
envelope where their submitted document should be. Search matches nothing.
Exports contain envelopes. Nothing in any log says why.

This is the failure `SA §9.3`'s "migrations backward-compatible within one
version" is aimed at, and it is **not** a migration problem — the schema
rolls back fine. It is a *data-format* problem, and the schema check that
usually stands in for rollback safety does not see it.

**The rule this establishes:**

> ⚠️ Once `encrypt:backfill` has run, the deployable floor is the first release
> that can open an envelope. Rolling back past it is a data-visibility
> incident, not a rollback. If Phase 3 must be reverted, revert the *code* only
> to a build that still contains `src/crypto/`, or restore a pre-backfill dump —
> and a pre-backfill dump is only useful inside the 7-day retention window.

### ✅ RESOLVED 2026-09-07 — the silent misread is now impossible

Recorded as **[D-57](../32-D-57-Rollback-Across-A-Data-Format-Change.md)**. Two
mechanisms, because neither covers both directions:

1. **The sealed columns were renamed** (`raw_content_sealed`,
   `structured_input_sealed`, `structured_output_sealed`). Builds that already
   exist cannot be changed, so the data is made unreachable under the name they
   ask for. Re-verified against the Phase 2 image:

   ```
   ✅ REFUSED: The column `analysis_input.raw_content` does not exist in the current database.
   ✅ REFUSED: The column `stage_trace.structured_input` does not exist in the current database.
   ```

2. **A `data_format` version, checked at startup.** Protects the *next*
   rollback rather than that one — a build refuses to start against data newer
   than it understands, before serving a request. Verified by setting the
   stored version to 3 and observing `DataFormatTooNewError`.

The failure mode is now: **fails loudly, immediately, with an actionable
message** — instead of starting cleanly and serving envelopes.

⚠️ **This removes the blocker on attempting a rollback drill. It does not
perform one**, and it does not make rolling back past the encryption boundary
possible — it makes it fail instead of lie.

### What the rehearsal does not establish

- Nothing about the actual host, its volumes, or its migration state — D-50 §4
  names all three as the reason a production drill is the evidence.
- Nothing about the edge: Caddy, TLS, and certificate persistence across a
  redeploy are untested, because no certificate has ever been issued.
- Nothing about downtime, since a single-instance rollback has an outage window
  that only a real deploy can measure.

---

## The production drill, when a host exists

Run **before** announcing the deployment, per D-50 §4. Record the result here
with a date, the same way the restore drill is recorded.

```bash
C=(docker compose -f docker-compose.prod.yml --env-file deploy/.env)

# 0. ⚠️ CHECK THE DEPLOYABLE FLOOR FIRST (D-57 §4). The target release must
#    read the CURRENT data format. Rolling back below the floor now fails
#    loudly rather than serving envelopes — but it still fails, so confirm the
#    target is at or above it before starting:
#      docker run --rm <target-image> node -e "import('/app/dist/db/data-format.js').then(m=>console.log(m.SUPPORTED_DATA_FORMAT))"
#    Compare against: SELECT version FROM data_format;
#
#    Note the release currently deployed, and take a dump first. A rollback
#    drill without a fresh backup is a bet, not a drill.
docker image inspect naigx-backend:latest --format '{{index .RepoDigests 0}}'
"${C[@]}" exec postgres bash /usr/local/bin/naigx-backup once

# 1. Tag the current release so it can be returned to.
docker tag naigx-backend:latest naigx-backend:rollback-target
docker tag naigx-edge:latest    naigx-edge:rollback-target

# 2. Deploy the new release.
"${C[@]}" run --rm migrate
"${C[@]}" up -d --build

# 3. Verify it is serving (see deploy/README.md "Verify the deploy").

# 4. ROLL BACK — the part being drilled.
docker tag naigx-backend:rollback-target naigx-backend:latest
docker tag naigx-edge:rollback-target    naigx-edge:latest
"${C[@]}" up -d --no-build

# 5. Verify the PREVIOUS release is serving correctly, and specifically that
#    analysis content is readable — not merely that /health returns 200.
curl -s "https://$NAIGX_DOMAIN/health"
#    ⚠️ Then open an existing analysis in the UI and read it. The failure this
#    drill exists to catch does not show up in a health check.

# 6. Record the outcome and the observed downtime below.
```

### What "verified" requires

All four, or the criterion is not met:

1. The previous release started against the current schema.
2. **Existing analysis content rendered correctly** — the check above, not
   `/health`.
3. The observed downtime was recorded.
4. Forward deployment worked again afterwards, so the rollback did not leave
   the deployment stuck.

| Date | From → to | Downtime | Content readable | Result |
|---|---|---|---|---|
| 2026-09-09 | `1da10e3` (`14c8321f5b9b`) → `56d7269` (`83d3d5288359`), then forward again | **~1.7 s** back, **~2.0 s** forward (public readiness, 250 ms polling: one `502` window each) | ✅ existing analysis + Markdown export identical before/during/after; a fresh submission completed on the rolled-back build | **PASS** — all four criteria |

## Production drill — 2026-09-09 (UTC), the live VPS

Owner-authorised. Performed against the deployment at `https://naigx.tech`,
the actual data volume (6 analyses at the moment of rollback, 1 encryption
key, data format 2), and the actual migration state. **n8n and Traefik were not touched**; the edge image
was unchanged between the two releases and was not swapped.

### Which two releases, and why

| | Build | What it lacks relative to the other |
|---|---|---|
| **Current** ("new release") | `1da10e3` — image `14c8321f5b9b` | — |
| **Rollback target** ("previous release") | `56d7269` — image `83d3d5288359` | no `/app/schemas`, no `dist/ops/schemas.js` — the release actually deployed immediately before |

⚠️ **The rollback target had to be rebuilt from source.** `/etc/cron.d/docker-image-prune`
removes dangling images, and every `up -d --build` re-tags `latest`, so no
previous image survived on the host. It was rebuilt in a detached
`git worktree` at `56d7269` and tagged `naigx-backend:rollback-target`; that
tag is **kept** on the host as a known-good rollback point. **Keep previous
images tagged at deploy time** so a real rollback does not need a build.

**Floor check (D-57 §4):** stored `data_format` = **2**; the target image's
`SUPPORTED_DATA_FORMAT` = **2**. Both releases read the sealed columns. This is
a rollback *within* the floor — the only kind D-57 permits — and the startup
guard logged `stored: 2, supported: 2` on both.

**Fresh dump first:** `naigx-backup once` → `naigx-20260909T080520Z.dump`
(284K) + trace (236K), and the restore drill was run on them **before** the
rollback ([RESTORE-DRILL-LOG](RESTORE-DRILL-LOG.md)).

### What was run, in order

```
docker tag naigx-backend:latest naigx-backend:pre-drill          # 14c8321f5b9b
git worktree add --detach /opt/naigx-rollback 56d7269
docker build -t naigx-backend:rollback-target /opt/naigx-rollback/backend   # 83d3d5288359
# --- ROLL BACK ---
docker tag naigx-backend:rollback-target naigx-backend:latest
docker compose ... up -d --no-build                              # 08:07:29.966 → 08:07:31.020
# --- verify, then FORWARD ---
docker tag naigx-backend:pre-drill naigx-backend:latest
docker compose ... up -d --no-build                              # 08:10:22.176 → 08:10:23.350
```

### The four things "verified" requires — observed

1. **The previous release started against the current schema.** Backend
   recreated on `83d3d5288359`; startup logged `Field encryption active
   provider=key-file … keyVersion=1`, `Data format stored: 2, supported: 2`,
   `Replay corpus loaded … fixtures: 54, excluded: []`; in-container and
   public readiness **200** within 25 s.
2. **Existing analysis content rendered correctly.** An analysis created under
   the current release *before* the drill (`d8839cfc…`, `technical_assessment`,
   18 context elements, 2 generated artifacts) was retrieved on the rolled-back
   build with identical fields, and its Markdown export was **200, 14,790
   characters** — the same length as before and after — with no `naigx.v1.`
   envelope text anywhere in it. ⚠️ The export omits the raw input by design,
   so the cipher was exercised directly: a fresh `br-001` submission on the
   rolled-back build **completed** (`9272b46a…`), which requires opening the
   sealed `raw_content` it had just written through the same key ring the
   current release uses. A `jd-002` submission on the rolled-back build
   completed with `portfolio_suggestions: failed` — **expected**: that release
   lacks the schema files, which is precisely what the forward release fixed.
   The rollback reproduced the known limitation rather than hiding it.
3. **Observed downtime.** Public `GET /health?check=readiness` through
   Traefik → Caddy → backend, polled every 250 ms from outside the host:
   - rollback: `200` until 08:07:30.632, `502` until 08:07:32.294, then `200`
     — **~1.7 s**
   - forward: `200` until 08:10:22.599, `502` until 08:10:24.560, then `200`
     — **~2.0 s**
   A single-instance container swap; the outage is the process restart plus
   startup, during which the edge answers 502 rather than hanging.
4. **Forward deployment worked afterwards.** Backend back on `14c8321f5b9b`;
   `/app/schemas` 5 files, `dist/ops/schemas.js` present, readiness 200; a
   `jd-002` submission completed with `portfolio_suggestions: generated`
   (`7c89b440…`); the pre-drill analysis and its export unchanged.

### Cost of the drill

Four anonymous analyses were created in production (`d8839cfc`, `9272b46a`,
`a8ba9890`, `7c89b440`); they expire under D-45. Provider spend: **$0.00** —
every run was replay. The `pre-drill` tag was removed (it was `latest`); the
worktree was removed; `naigx-backend:rollback-target` remains.

### What this does not establish

- Nothing about a rollback **below** the deployable floor. That is not a
  rollback (D-57 §4) and was not attempted.
- Nothing about a rollback that includes a **migration**. None of the
  releases involved changed the schema, so `SA §9.3`'s reversible-migration
  property was not exercised here.
- Nothing about the edge image, which was identical across both releases.
