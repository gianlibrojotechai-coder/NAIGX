# Deployment — NAIGX

`M-19`. Topology per [D-50](../docs/25-D-50-Deployment-Topology.md): **one instance, no staging**,
self-hosted PostgreSQL per [D-51](../docs/26-D-51-Self-Hosted-PostgreSQL.md).

| File | What it is |
|---|---|
| `../docker-compose.prod.yml` | The production stack — Postgres, backend, edge |
| `Caddyfile` | TLS termination, security headers, API routing, SPA fallback |
| `Dockerfile.edge` | Caddy image with the built client baked in |
| `.env.example` | Every variable the stack requires; copy to `.env` |
| `seccomp/chromium.json` | The profile Chromium's sandbox needs — see [its README](seccomp/README.md) |

---

## What Phase 4 delivers

| Requirement | Status |
|---|---|
| `NFR-082` — error rate, latency percentiles, completion rate monitored with thresholds | **Implemented and verified** end to end (scrape → rule → annotation → delivery) |
| `NFR-085` — alert on completion rate below the `NFR-010` 95% threshold | **Implemented and verified.** Observed firing with a rendered message on live data |
| `D-51` §4 — scheduled dumps of both databases, 7-day rotation | **Implemented** |
| `D-51` §4 — restore drill, recorded with a date | **Performed and recorded** — [RESTORE-DRILL-LOG](../docs/deployment/RESTORE-DRILL-LOG.md). ⚠️ Development database, not production |
| `D-50` §4 — verified production rollback drill | **NOT DONE.** Rehearsed only — [ROLLBACK-DRILL-LOG](../docs/deployment/ROLLBACK-DRILL-LOG.md) |
| `NFR-031` — data policy accessible before first submission | **Implemented and verified** by an automated check |
| `D-51` §4 — backups stored off the deployment host | **Configuration, unverifiable here.** A property of where `NAIGX_BACKUP_DIR` points |

### ⚠️ What is NOT verified

**The rollback drill has not happened.** [D-50](../docs/25-D-50-Deployment-Topology.md) §4
requires it on the production deployment, which does not exist.

The rehearsal found a real incompatibility, and it has since been **fixed**
([D-57](../docs/32-D-57-Rollback-Across-A-Data-Format-Change.md)): rolling back
past the Phase 3 encryption boundary used to start cleanly and serve base64
envelopes without erroring. The sealed columns are now renamed so an old build
gets `42703 undefined_column`, and a `data_format` version refuses startup when
the data is newer than the build.

> ⚠️ **The deployable floor is the first build that reads the `*_sealed`
> columns.** Rolling back past it fails visibly rather than silently — check
> the floor before attempting any rollback (D-57 §4).

**The restore drill ran against the development database.** The mechanism is
proven; the obligation is not discharged until a drill runs against a real
backup of deployed data.

### Monitoring, verified

Run 2026-09-07 against the built image and the real configs:

- `promtool check config` and `check rules` — valid, 8 rules.
- `amtool check-config` — valid.
- Prometheus scraped `/internal/metrics` with the operator bearer token:
  target `health: up`.
- Every series an alert references resolved against live data. A unit test now
  enforces that permanently — an alert on a misspelled series never fires and
  Prometheus never says so.
- `CompletionRateBelowTarget` entered `pending` with its message rendered:
  *"Analysis completion rate 50% is below the NFR-010 target of 95%"*.
- A test alert was **delivered to a webhook receiver** through Alertmanager.

```bash
# Send a test alert on a real deployment. Do this on first deploy: Alertmanager
# starts happily with an unreachable receiver and only logs the failure.
docker compose -f docker-compose.prod.yml --env-file deploy/.env \n  exec alertmanager wget -qO- --post-data '[{"labels":{"alertname":"DeployTest","severity":"critical"}}]' \n  --header 'Content-Type: application/json' http://localhost:9093/api/v2/alerts
```

---

## What Phase 3 delivers

| Requirement | Status |
|---|---|
| `DB §13.1` row 3 — application-level encryption on `raw_content`, `structured_input`, `structured_output` | **Implemented.** AES-256-GCM envelope, data key wrapped by a host-held root key ([D-55](../docs/30-D-55-Envelope-Format-And-Purge-Outbox.md), [D-61](../docs/36-D-61-Host-Held-Key-File.md)) |
| `DB §13.1` — managed key service, never in application configuration | ⚠️ **EXPLICIT v1.0 DEVIATION.** [D-61](../docs/36-D-61-Host-Held-Key-File.md) replaced AWS KMS with a host-held key file. Recorded as a deviation, **not** claimed as satisfied |
| `FR-062` search over sealed content | **Implemented and verified** by differential — decrypt-and-filter (D-53 §4) |
| `DB §5.4` step 2 — durable purge instruction | **Implemented.** Outbox in the primary store, written in the deletion transaction |
| `NFR-021` — full-volume encryption | **Not done.** Needs a host. Free when one exists, and unaffected by D-61 |

### The encryption key on the host — [D-61](../docs/36-D-61-Host-Held-Key-File.md)

⚠️ **NAIGX does not use AWS KMS.** D-61 replaced the managed key service with a
root key held on this host. The envelope architecture is unchanged — the
database still stores only a *wrapped* data key, and `envelope.ts` never learns
where the root key came from.

#### 1. Create the key file

Outside the repository and outside the Docker build context, so it can never be
committed or captured into an image layer. Owned by **uid 1000** — the account
the container runs as (`Dockerfile`, `USER node`) — and readable by nobody else:

```bash
sudo install -d -m 0755 -o root -g root /etc/naigx/keys
sudo sh -c "openssl rand -base64 32 > /etc/naigx/keys/root.key"
sudo chown 1000:1000 /etc/naigx/keys/root.key
sudo chmod 0400 /etc/naigx/keys/root.key

stat -c "%U:%G %a %n" /etc/naigx/keys/root.key   # expect: 1000:1000 400
```

⚠️ **Root-owned `0600` will NOT work.** The container runs non-root, so a
root-only file is unreadable and the provider would fail closed permanently.
What matters is that group and other have no access at all — and that is
enforced in code, not left to deployment discipline.

#### 2. Point the configuration at it

```bash
NAIGX_KEY_FILE="/etc/naigx/keys/root.key"
```

Compose mounts it **read-only** into `backend` and `encrypt` only — never
`postgres`, `edge`, `prometheus`, `alertmanager` or `backup`. It is mounted
rather than passed as an environment variable because env vars are visible in
`docker inspect` and in `/proc/<pid>/environ`, and this is key material rather
than a path.

#### 3. The provider fails closed, every time

Checked on **every load** rather than once at startup — a file can be replaced
or `chmod`'d after boot, and a check that ran only at boot would not notice:

| Condition | Result |
|---|---|
| File missing | refuse to start |
| Any group or other permission bit set | refuse to start |
| Not 32 bytes after base64/hex decode | refuse to start |
| Wrapped key from a different root key | rejected, not retried |
| Tampered wrapped key | rejected — GCM tag failure |

⚠️ The permission check is **POSIX-only**. Windows reports `0444` for a file
just created `chmod 0400`, because its mode bits are a shim over an ACL model
they cannot express — enforcing them there would refuse every key file on a
developer machine while proving nothing. Production is Linux in a container, so
the check always runs where the property is claimed.

#### 4. ⚠️ Back it up separately, and what losing it means

**Losing this file destroys `raw_content`, `structured_input` and
`structured_output` — in the database and in every backup of it.** The dumps
contain ciphertext; without the root key they are unreadable forever.

⚠️ **Do not store the key alongside the dumps.** A single archive holding both
the ciphertext and its key protects neither.

#### 5. ⚠️ What this does NOT buy

A host-held key is **not** a managed key service, and `DB §13.1`'s "managed key
service" row is an **explicit v1.0 deviation** — recorded in
[D-61](../docs/36-D-61-Host-Held-Key-File.md) §4, never claimed as satisfied.

Two things are genuinely lost:

- **No central revocation.** A managed service could be disabled from anywhere
  on suspicion of compromise. Here the only remedy is replacing the root key and
  re-encrypting, which needs access to this host.
- **No decrypt audit.** Nothing records that an unwrap happened.

And a **full host compromise reaches the key**. ⚠️ So did host-resident cloud
credentials under the arrangement this replaced — D-61 §3 sets that comparison
out honestly rather than claiming equivalence.

**What it still buys is the property `DB §13.1` actually names:** a stolen
database dump, a stolen backup or a disk snapshot yields ciphertext and nothing
else, because the key is in none of them.
### Running the encryption operations

```bash
C=(docker compose -f docker-compose.prod.yml --env-file deploy/.env)

"${C[@]}" run --rm encrypt status     # how much is still plaintext
"${C[@]}" run --rm encrypt backfill   # seal it; idempotent, resumable
```

⚠️ **The backfill cannot be a SQL migration** — sealing needs the data key, and
SQL cannot call the key service. So between `migrate` and `encrypt backfill` the
tables hold a mixture, reads accept both, and **nothing misbehaves or complains**.
`encrypt status` exiting zero is the only signal the window has closed.

---

## What Phase 2 delivers

| Requirement | Status |
|---|---|
| `NFR-020` — TLS 1.2+ on all transport | **Implemented.** Caddy's default minimum is TLS 1.2; certificates are automatic |
| `NFR-020` / `SA §10` — HSTS | **Implemented and verified.** `max-age=63072000; includeSubDomains; preload` |
| Configurable host/port | **Implemented and tested.** `HOST`, `PORT` |
| `SA §9.1` — TLS-terminating proxy in front of the app tier | **Implemented and verified** locally over HTTP |
| Seccomp profile applied in the deployment | **Implemented.** `security_opt` on the backend service |

### ⚠️ What is NOT verified

**A real certificate has never been issued by this configuration.** Everything
below the TLS layer — routing, SPA fallback, the `/internal` block, SSE
streaming, security headers — was verified end to end against the built images
over plain HTTP with a stub backend. The ACME exchange itself cannot be
exercised without a public domain whose DNS points at a reachable host, and
neither exists yet.

Treat "TLS works" as **unverified until the first real `up` on the real domain**.
The first deploy is where that is proved; §"First deploy" says what to check.

---

## First deploy

**Prerequisites.** A host with Docker, a domain, and a DNS A/AAAA record for it
already pointing at that host. The record must exist *before* the first `up`:
Caddy requests a certificate immediately, and challenges that cannot be reached
count against [Let's Encrypt's rate limits](https://letsencrypt.org/docs/rate-limits/).
Ports 80 and 443 must be open — 80 is not optional, it is where the HTTP-01
challenge is answered.

⚠️ **AND THE ROOT KEY FILE MUST EXIST FIRST** — see *The encryption key on the
host* above. Step 3 below (`encrypt init`) is the first command that needs it,
and the application refuses to start without it. Create it before the first
`up`, not during.

```bash
cp deploy/.env.example deploy/.env
# fill in NAIGX_DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, NAIGX_IP_HASH_SECRET
#   openssl rand -base64 32   # POSTGRES_PASSWORD
#   openssl rand -hex 32      # NAIGX_IP_HASH_SECRET, NAIGX_OPERATOR_TOKEN

C=(docker compose -f docker-compose.prod.yml --env-file deploy/.env)

# 1. Database first, so the init script creates BOTH databases (DB §1.4).
"${C[@]}" up -d postgres

# 2. Migrations, explicitly. Never on boot — SA §9.3 requires them to be
#    reversible independently of code, which they cannot be if starting the
#    app is what applies them.
"${C[@]}" run --rm migrate

# 3. The encryption key (DB §13.1 row 3, D-52). Once, ever.
#    ⚠️ Creating a SECOND key later is not a rotation — it is a new ring with
#    no relationship to rows sealed under the first.
"${C[@]}" run --rm encrypt init

# 4. Seal existing content. Idempotent and resumable; safe to re-run.
#    Skip on a brand-new database — there is nothing to seal.
"${C[@]}" run --rm encrypt backfill
"${C[@]}" run --rm encrypt status   # must report zero plaintext rows

# 5. The rest — app, edge, monitoring, alerting, backups.
"${C[@]}" up -d --build

# 6. ⚠️ PROVE ALERTING REACHES A HUMAN. Alertmanager starts happily with an
#    unreachable receiver and only logs the failure — "the stack is up" is not
#    evidence that a page would arrive.
"${C[@]}" exec alertmanager wget -qO- \n  --header 'Content-Type: application/json' \n  --post-data '[{"labels":{"alertname":"DeployTest","severity":"critical"}}]' \n  http://localhost:9093/api/v2/alerts
#    Confirm it arrived wherever NAIGX_ALERT_WEBHOOK points.

# 7. ⚠️ THE RESTORE DRILL. A completed backup is not a verified backup.
#    Record the result in docs/deployment/RESTORE-DRILL-LOG.md.
"${C[@]}" exec postgres bash /usr/local/bin/naigx-backup once
"${C[@]}" exec postgres bash /usr/local/bin/naigx-restore-drill

# 8. ⚠️ THE ROLLBACK DRILL, before announcing the deployment (D-50 §4).
#    Procedure and the four things "verified" requires:
#    docs/deployment/ROLLBACK-DRILL-LOG.md
```

## Redeploy — rolling a running instance forward

⚠️ **This is NOT the first-deploy list.** The key file already exists, the
databases already exist, and `encrypt init` must **never** run again — a second
key is a new ring with no relationship to rows sealed under the first.

⚠️ **ALWAYS ESTABLISH WHICH BUILD IS RUNNING FIRST.** A deployed container is
not the repository, and its error messages will describe *whenever it was
built*. As of 2026-09-09 the running instance predated `ca2bb8b` and rejected
readiness with the **live** branch's message while logging `"mode":"replay"` —
which sends you debugging `resolveExecutionMode` instead of redeploying.

```bash
ssh -i ~/.ssh/naigx_vps root@76.13.209.213
cd /opt/naigx    # wherever the checkout lives

C=(docker compose -f docker-compose.prod.yml --env-file deploy/.env)

# 0. WHICH BUILD IS RUNNING? 0 = predates D-62 and must be rebuilt.
docker exec naigx-backend grep -c "no recordings are available" /app/dist/index.js

# 1. Fetch. ⚠️ Read what you are about to deploy, including migrations.
git fetch origin && git log --oneline HEAD..origin/main
git diff --name-only HEAD origin/main -- backend/prisma/migrations
git merge --ff-only origin/main

# 2. Migrations, explicitly, and ONLY if step 1 showed some. Never on boot.
#    ⚠️ Nothing between ca2bb8b~1 and 289e1e1 touches migrations — verified.
"${C[@]}" run --rm migrate

# 3. Rebuild and restart. `up -d --build` recreates only what changed.
#    The one-shot services (migrate, encrypt, fragments, naigx) are
#    profile-gated and are NOT started by this — verified with `config`.
"${C[@]}" up -d --build

# 4. Confirm the NEW build is the one running. Must now print 1.
docker exec naigx-backend grep -c "no recordings are available" /app/dist/index.js
docker logs naigx-backend 2>&1 | grep -iE "execution mode|encryption active" | head -2
```

**What a correct redeploy looks like as of `289e1e1`.** `GET /health` still
answers **503** afterwards, and that is the *expected* result, not a failed
deploy. What must change is the reason:

| | Before (pre-`ca2bb8b` build) | After |
|---|---|---|
| `templates` | `unavailable` — zero fragments published | `unavailable`, unchanged. Still correct |
| `provider` | `unavailable` — *"No provider is configured"*, the **live** branch's message in replay mode | *"Replay mode is configured but no recordings are available…"* — D-62's real replay answer |

⚠️ **If `provider` still says "No provider is configured" after step 4, the
rebuild did not take.** Do not go looking for a configuration bug.

Readiness needs both remaining halves — published fragments (which needs a
covering pass reference; the gate is correct and must not be worked around) and
a non-empty `REPLAY_FIXTURES`. **Neither is fixed by redeploying.**

### ✅ The two POSIX key-file tests — RUN AND PASSED on the host, 2026-09-09

They skip on Windows, and until this date had never executed anywhere. They are
the only evidence that the key file **fails closed** when it is group- or
world-readable (D-61). **They have now been run on the VPS: 11 tests, 11 pass,
0 skipped**, both *FAILS CLOSED* cases among them. `DB §13.1` row 3's mechanism
is verified; D-61 §8 records the result and its limits. ⚠️ `M-18` H-2 and `M-18`
itself remain open — this discharged the mechanism, not the finding.

**Re-run them here after any change under `backend/src/crypto/`.** On a Windows
workstation that code is guarded by nothing, and the suite will still say
`pass` while skipping the two tests that matter.

⚠️ **NOT through the runtime image.** It ships `dist/` only — no `tests/`, and
dev dependencies are pruned. Verified: `ls /app/tests` → *No such file or
directory*. Run them from the source checkout instead, in a throwaway container
so the host needs no Node toolchain:

```bash
cd /opt/naigx
docker run --rm -v "$PWD:/w" -w /w/backend node:24 \
  sh -c "npm ci && npx tsx --test tests/unit/key-file-provider.test.ts"
```

**What discharges the requirement:** both permission tests must **run and pass**,
not skip. They are the two named *"FAILS CLOSED when the key file is
group-readable / world-readable"*. If the output still shows 2 skips, the
platform gate did not open and nothing has been proven.

### Verify the deploy — actually run these

```bash
D=your.domain

# TLS: a real certificate, and TLS 1.2 is the floor.
curl -sI "https://$D/" | head -1
openssl s_client -connect "$D:443" -tls1_1 </dev/null 2>&1 | grep -q "alert" \
  && echo "TLS 1.1 correctly refused"

# HSTS (NFR-020).
curl -sI "https://$D/" | grep -i strict-transport-security

# The client is served, and unknown paths fall back to it.
curl -s -o /dev/null -w "%{http_code}\n" "https://$D/"

# The API is reachable on the same origin.
curl -s "https://$D/health"

# The operator surface is NOT reachable from outside (expect 404).
curl -s -o /dev/null -w "%{http_code}\n" "https://$D/internal/metrics"

# `request.ip` is the client, not the proxy. Submit a bad login from two
# different addresses; the per-IP limit must bite one without biting the other.
# If one client's failures lock out the other, TRUST_PROXY is wrong.
```

---

## The two settings that are wrong in both directions

Neither has a safe default, which is why both are configuration and why the
compose file sets them in the same place it creates the proxy.

**`TRUST_PROXY`** decides whether `X-Forwarded-For` is believed, and therefore
what `request.ip` is. It feeds the per-IP authentication rate limit
(`authAttemptIp`) and the session IP hash.

- `false` **behind** a proxy → every client resolves to Caddy. The per-IP limit
  becomes one global bucket any single client can exhaust for everyone, and
  every session row records the proxy's address.
- `true` **without** a proxy → `X-Forwarded-For` is client-supplied. An
  attacker rotates it per request and the per-IP limit stops existing.

**`HOST`** is *not* what keeps the app off the internet — publishing no port
is. Inside a container `0.0.0.0` means every interface *of that container*,
which is exactly what Caddy needs to reach it. `HOST=127.0.0.1` in the
container would harden nothing and make the app unreachable from the proxy.
Loopback is correct only for a bare process sharing a host with its proxy.

---

## Certificates and state

`naigx_caddy_data` holds the issued certificates and the ACME account key.
**It must survive redeploys.** Let's Encrypt rate-limits issuance per domain
per week; a stack that loses this volume re-requests on every deploy and is
eventually refused, with the site down until the window rolls over.

---

## Things that bit during Phase 2

Recorded because each passed a plausible-looking check first.

- **`handle` outranks a bare `respond` in Caddy.** Caddy sorts directives by
  its own order, not by file order. `respond @internal 404` written outside a
  `handle` block never ran — the catch-all `handle` matched first, was
  terminal, and served `index.html` with a **200** from `/internal/metrics`.
  Caught by the routing check; the fix is to make all three cases `handle`
  blocks.
- **Grepping the bundle for `localhost:3000` reports failure on a correct
  build.** Vite compiles `import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:3000"`
  into a member read on an inlined object, so the default string stays in the
  output as text even when the override worked. The check that discriminates
  is whether the inlined object *defines the key*.
- **The production image could not start the application, and nothing noticed.**
  Prisma 7 emits `.ts` import specifiers and this project compiles with
  `verbatimModuleSyntax`, so `dist/generated/prisma/client.js` imported
  `./enums.ts` and `node dist/index.js` died with `ERR_MODULE_NOT_FOUND`.
  It stayed invisible because `dev`, `test` and every CLI script go through
  tsx, which resolves `.ts` happily — only `npm start` and the container's
  `CMD` take that path. Fixed with `importFileExtension = "js"` on both
  generators. **Phase 1 verified PDF rendering and the migration paths in this
  image, but never ran its actual entrypoint.**
