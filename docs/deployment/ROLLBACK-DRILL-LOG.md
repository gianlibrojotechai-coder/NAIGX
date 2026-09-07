# Rollback drill log

**[D-50](../25-D-50-Deployment-Topology.md) §4 requires this.** There is no
staging environment, and the argument for skipping one rests on a rollback drill
run against the production deployment itself — *"stronger evidence than one
performed elsewhere, because it exercises the actual host, the actual data
volume, and the actual migration state."* `TM-17` and `SA §9.3` require rollback
verified, not assumed.

⚠️ **THE PRODUCTION DRILL HAS NOT HAPPENED AND CANNOT YET.** No production
deployment exists. What follows is a *rehearsal against the development
database*, which establishes some things and explicitly does not establish
others. `M-19`'s rollback criterion is **not met**.

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
| — | — | — | — | **Not yet performed. No production deployment exists.** |
