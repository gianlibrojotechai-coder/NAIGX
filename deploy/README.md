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
| `DB §13.1` row 3 — application-level encryption on `raw_content`, `structured_input`, `structured_output` | **Implemented.** AES-256-GCM envelope, KMS-wrapped data key ([D-55](../docs/30-D-55-Envelope-Format-And-Purge-Outbox.md)) |
| `DB §13.1` — managed key service, never in application configuration | **Implemented.** AWS KMS; no local-key fallback exists |
| `FR-062` search over sealed content | **Implemented and verified** by differential — decrypt-and-filter (D-53 §4) |
| `DB §5.4` step 2 — durable purge instruction | **Implemented.** Outbox in the primary store, written in the deletion transaction |
| `NFR-021` — full-volume encryption | **Not done.** Needs a host. Free when one exists |

### ⚠️ What is NOT verified

**KMS has never been called.** `src/crypto/providers/aws-kms.ts` type-checks and
follows the documented API and has never made a real request — no AWS account
exists yet. Everything else in Phase 3 is proved against the **offline test
double**, which is faithful evidence about the *interface* and none at all about
the *service*.

`backend/tests/integration/kms-live.test.ts` is the only thing that discharges
this. It skips unless `NAIGX_KMS_LIVE_TEST=1` with real credentials, and **a
skip is "not checked", never "passed"**. Until it runs green, `DB §13.1` row 3
is *implemented but unverified* and `M-18` H-2 stays open.

### AWS credentials on a non-EC2 host — [D-59](../docs/34-D-59-AWS-Credential-Injection-On-A-Non-EC2-Host.md)

⚠️ **The sanctioned host is a Hostinger VPS, not EC2.** The KMS adapter builds
`new KMSClient({ region })`, which reads AWS's ambient credential chain — an
instance role on EC2, and **nothing at all here**. Without the setup below the
container starts, resolves no credential, and `loadCipher` refuses to boot. The
symptom reads like a KMS outage rather than a missing credential, so check this
first.

#### 1. Two IAM principals, each with the minimum

The adapter makes exactly **two** KMS calls — `GenerateDataKey` and `Decrypt` —
and they happen at different times. `encrypt init` only ever generates; the
running application only ever decrypts, because `loadCipher` passes
`createIfMissing: false` in production and *cannot* mint a key even if asked.

⚠️ **Never use AWS root credentials.** Never `kms:*`. Never `Resource: "*"`.

**Runtime user** — `naigx-backend`, long-lived, used by the `backend` service:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UnwrapTheDataKey",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:<REGION>:<ACCOUNT_ID>:key/<KEY_ID>"
    }
  ]
}
```

**Provisioning user** — `naigx-provision`, **temporary**, used by the `encrypt`
service. `GenerateDataKey` for `init`; `Decrypt` because `backfill` and `status`
unwrap the existing key:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ProvisionAndBackfill",
      "Effect": "Allow",
      "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
      "Resource": "arn:aws:kms:<REGION>:<ACCOUNT_ID>:key/<KEY_ID>"
    }
  ]
}
```

⚠️ **Deactivate `naigx-provision` once the first deploy completes.** A principal
that can mint data keys can start a **second ring**, and a second ring has no
relationship to rows sealed under the first.

#### 2. The CMK key policy must delegate to IAM

KMS requires **both** the IAM policy and the key policy to allow. An IAM policy
that reads correctly still gets `AccessDeniedException` if the CMK's own policy
does not delegate — this is the most common way a correct-looking setup fails.
The key policy needs a statement along these lines:

```json
{
  "Sid": "EnableIAMPolicies",
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::<ACCOUNT_ID>:root" },
  "Action": "kms:*",
  "Resource": "*"
}
```

⚠️ That `Principal` is the **account**, not the root *user*, and it delegates to
IAM rather than granting anything by itself. It is what makes the two scoped
policies above take effect. Enable **automatic key rotation** and **deletion
protection** on the CMK while you are there — losing it destroys every sealed
field and every backup of them ([D-52](../docs/27-D-52-Managed-Key-Service.md) §6).

#### 3. The credentials file on the host

⚠️ **Create it OUTSIDE the repository and outside the Docker build context.**
Anything inside either can be committed by accident or captured into an image
layer. `/etc/naigx/aws/` is outside both.

```bash
sudo install -d -m 0700 -o root -g root /etc/naigx/aws
sudo install -m 0600 -o root -g root /dev/null /etc/naigx/aws/credentials
sudo nano /etc/naigx/aws/credentials
```

```ini
[default]
aws_access_key_id = <runtime user's key id>
aws_secret_access_key = <runtime user's secret>
```

Then point `deploy/.env` at it:

```bash
NAIGX_AWS_CREDENTIALS_FILE="/etc/naigx/aws/credentials"
```

**Swap in the provisioning user's credentials for step 3 of the first deploy
(`encrypt init`/`backfill`), then put the runtime user's back before `up -d`.**
One file, edited twice — the alternative is a second mount that outlives its
purpose.

#### 4. How Compose consumes it

Mounted **read-only**, into **`backend` and `encrypt` only**:

```yaml
volumes:
  - ${NAIGX_AWS_CREDENTIALS_FILE}:/run/secrets/aws/credentials:ro
environment:
  AWS_SHARED_CREDENTIALS_FILE: /run/secrets/aws/credentials
```

**No credentials reach `postgres`, `edge`, `prometheus`, `alertmanager` or
`backup`** — `edge` terminates TLS and faces the internet, and has no reason to
hold a key-service credential.

Mounted rather than passed through `env_file:` deliberately: environment
variables are visible in `docker inspect` and in the container's
`/proc/<pid>/environ`. A read-only mount costs one line and keeps the secret out
of both.

#### 5. Rotating the access key

Overlapping validity, so there is no downtime window:

```bash
# 1. Create a second access key for naigx-backend in IAM.
# 2. Write it to the file.
sudo nano /etc/naigx/aws/credentials
# 3. Restart only the application.
docker compose -f docker-compose.prod.yml --env-file deploy/.env restart backend
# 4. Verify a read actually decrypts — open an analysis and check its content.
# 5. ONLY THEN delete the first key in IAM.
```

⚠️ **Three different things get called "rotation" and conflating them destroys
data:**

| Rotating | How | Risk |
|---|---|---|
| **AWS access key** | The procedure above | None |
| **The CMK** | AWS **automatic** key rotation. Old material is retained, so old ciphertext still unwraps | None when automatic |
| **The data-key ring** | **Not rotation, and not supported.** `encrypt init` refuses when a key exists | ⚠️ A second ring orphans every row sealed under the first |

⚠️ **Creating a new CMK is not a rotation. Re-running `encrypt init` is not a
rotation.** Both read like the safe, tidy thing to do, and both make existing
data permanently unreadable.

#### 6. What this does NOT buy

⚠️ A long-lived credential on the host means **root on the VPS can call
`Decrypt`**. `DB §13.1`'s stated property still holds — a stolen dump, backup or
disk snapshot yields nothing, because unwrapping needs a live KMS call — but
against **full host compromise** this is weaker than an EC2 instance role in
degree: an exfiltrated access key is reusable off-host indefinitely, where
instance-role credentials expire. Accepted and recorded in
[D-59](../docs/34-D-59-AWS-Credential-Injection-On-A-Non-EC2-Host.md) §4.
**Never describe this as equivalent to an instance role.** The upgrade path is
IAM Roles Anywhere, with its trigger named in D-59 §6.

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

⚠️ **AND THE AWS CREDENTIALS FILE MUST EXIST FIRST** — see *AWS credentials on a
non-EC2 host* above. This host is not EC2, so nothing resolves a credential on
its own: step 3 below (`encrypt init`) is the first command that calls KMS, and
it fails without it. Put the **provisioning** user's credentials in the file for
steps 3–4, then swap in the **runtime** user's before step 5.

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
