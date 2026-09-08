# D-60 — NAIGX behind the host's existing Traefik, not its own Caddy edge

**Date:** 2026-09-08
**Status:** ⚠️ **PROPOSED — not accepted, not deployed.** Awaiting owner approval.
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the port-80/443 conflict blocking `M-19` Stage 1b
**Affects:** `NFR-020`, `SA §9.1`, `M-19`, `docker-compose.prod.yml`, `deploy/Caddyfile`
**Amends** [D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md). Does **not** supersede it — D-54's routing, header and proxy-trust decisions stand; only TLS termination and port binding move.

---

## 1. The question

`M-19` Stage 1b found ports **80 and 443 already bound** on the sanctioned host:

```
n8n-traefik-1   traefik   Up 5 weeks   0.0.0.0:80->80, 0.0.0.0:443->443
n8n-n8n-1       n8n       Up 5 weeks   127.0.0.1:5678->5678
```

An **n8n installation has been running for five weeks** and is still needed. [D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md) gives NAIGX its own Caddy binding those same ports. Both cannot hold them.

The owner rejected retiring n8n and rejected a second VPS. This record covers the remaining option: **route NAIGX through the Traefik that is already there.**

## 2. What the existing Traefik actually does

Read from the running container, not assumed:

| Property | Value |
|---|---|
| Provider | Docker, **`exposedbydefault=false`** — containers opt in by label |
| Entrypoints | `web` :80 (redirects to `websecure`), `websecure` :443 |
| Certificates | ACME resolver `mytlschallenge`, **TLS-ALPN-01** challenge |
| ACME contact | `user@srv1410655.hstgr.cloud` |
| Network | `n8n_default` |
| Cert storage | volume `traefik_data` → `/letsencrypt/acme.json` |
| Docker socket | mounted **read-only** |

n8n routes by `Host(\`n8n.srv1410655.hstgr.cloud\`)` with a per-router headers middleware (HSTS, nosniff, XSS filter).

**The opt-in default is what makes this safe.** NAIGX containers are invisible to Traefik until they carry `traefik.enable=true`, so nothing about n8n changes by NAIGX existing.

## 3. The decision

**Keep Caddy. Move it behind Traefik.** Traefik terminates TLS and routes by hostname; Caddy keeps every application-level responsibility D-54 gave it.

```
Internet → Traefik (:80/:443, TLS)  ──Host(n8n.…)──→  n8n
                                    ──Host(naigx.…)─→  Caddy (:80, internal) → backend:3000
```

**Why keep Caddy rather than point Traefik straight at the backend:** the Caddy layer is not just TLS. It serves the built SPA, does `try_files` fallback, routes `@api`, and — critically — returns **404 for `/internal/*`** so the operator surface is unreachable from outside. `deploy/Dockerfile.edge` bakes the client into that image. Removing Caddy would mean rebuilding all of that inside Traefik labels, discarding verified behaviour (including the `handle`-block ordering fix that a bare `respond` got wrong) for no gain.

## 4. Exactly what changes

**`docker-compose.prod.yml`, `edge` service only:**

1. **Delete the `ports:` block** — `80:80`, `443:443`, `443:443/udp`. This alone resolves the conflict.
2. **Join `n8n_default`** as an external network, alongside `naigx`.
3. **Add Traefik labels** — `traefik.enable=true`, a `Host()` router rule for the NAIGX domain, `entrypoints=web,websecure`, `tls.certresolver=mytlschallenge`, `loadbalancer.server.port=80`, and **`traefik.docker.network=n8n_default`** (required whenever a container sits on more than one network, or Traefik may route to the wrong address).

**`deploy/Caddyfile`:**

4. **Site address `{$NAIGX_DOMAIN}` → `:80`.** This is the substantive change: a bare port stops Caddy attempting ACME entirely. The global `email` block goes with it.
5. **Everything else stays** — headers, `/internal/*` 404, `@api` routing, SPA fallback.

**Nothing else.** No application code, no backend configuration, no change to n8n or Traefik.

## 5. What this costs, stated rather than glossed

| Consequence | Assessment |
|---|---|
| ⚠️ **`NFR-020` is now satisfied by software NAIGX does not own** | TLS 1.2+ was D-54's claim about *Caddy's* defaults. Traefik's defaults must be **verified separately** on first deploy; D-54's assertion no longer covers it |
| ⚠️ **ACME contact is `user@srv1410655.hstgr.cloud`** | A Hostinger default, almost certainly not a monitored inbox. The Caddyfile warns in its own comments that an ACME account with no reachable contact gets **no warning when renewal starts failing, and the first symptom is an expired certificate.** NAIGX inherits that. **Fixing it is a change to the n8n stack and is out of scope here** — but it should be raised |
| ⚠️ **Shared fate** | A Traefik restart, misconfiguration or cert-store problem now takes NAIGX down with n8n. Two services, one edge, one `acme.json` |
| **HTTP/3 is lost** | Caddy published `443/udp`; Traefik here is not configured for HTTP/3. No requirement asks for it |
| **Challenge type changes** | Caddy HTTP-01 → Traefik **TLS-ALPN-01**. Both need :443 reachable; neither needs a change to DNS beyond an A record |
| **Proxy trust is unchanged in kind** | Two hops instead of one. Traefik appends `X-Forwarded-For`, Caddy appends again, `TRUST_PROXY=true` makes Fastify read the leftmost entry — the real client. ⚠️ [D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md) §4's warning that a client-supplied `X-Forwarded-For` is not stripped **still applies and is neither improved nor worsened** by this record |

## 6. What was rejected

**A second VPS.** Cleanest isolation; rejected on cost by the owner, consistent with `TC-009`.

**Retiring n8n.** Rejected — it is in use.

**Traefik routing directly to `backend:3000`, dropping Caddy.** Rejected. It discards the SPA serving, the `/internal/*` block and the routing fixes Phase 2 verified, and rebuilds them in a less testable form.

**Editing the n8n stack to accommodate NAIGX.** Rejected and explicitly out of bounds: n8n is not to be stopped or modified.

## 7. Consequences

| Consequence | Handling |
|---|---|
| D-54 is amended, not superseded | Its routing, header and proxy-trust content stands; §"TLS termination" now describes Traefik |
| `NFR-020` unverified until first deploy | Unchanged from D-54 — no certificate has ever been issued for NAIGX either way |
| The deploy sequence changes | `docker compose up -d --build` no longer binds host ports; reachability depends on Traefik picking up the labels |
| Revisit trigger | NAIGX outgrowing shared hosting, n8n being retired, or any availability requirement that shared fate would violate |
| ⚠️ **A NAIGX domain still does not exist** | Blocked independently of this record. `M-19` Stage 1b cannot complete without one |
