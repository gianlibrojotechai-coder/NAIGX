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

# 5. The rest.
"${C[@]}" up -d --build
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
