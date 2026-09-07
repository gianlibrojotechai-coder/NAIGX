# D-54 — The edge: same-origin serving, and the settings that have no safe default

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** how `M-19` Phase 2 terminates TLS, and what `request.ip` means once a proxy exists
**Affects:** `NFR-020`, `NFR-025`, `SA §9.1`, `SA §10`, `DB §4.1`, `DB §13`, `API §3.3`, `M-19`
**Builds on** [D-50](25-D-50-Deployment-Topology.md). Supersedes nothing.

---

## 1. The question

[D-50](25-D-50-Deployment-Topology.md) fixed the topology at one instance behind
a TLS-terminating reverse proxy on the same host. That leaves four things
undecided, and three of them are only visible once the proxy exists:

1. What terminates TLS, and how certificates are obtained.
2. Where the client is served from, which decides whether CORS is still in the
   deployed path at all.
3. What `request.ip` resolves to once every request arrives from the proxy.
4. Whether the operator surface is reachable from the internet.

## 2. The decision

1. **Caddy at the edge**, with automatic Let's Encrypt issuance and renewal.
   TLS 1.2 minimum and HSTS satisfy `NFR-020` and `SA §10`.
2. **The client is served by the edge, same-origin with the API.** It is built
   with `VITE_API_BASE_URL=""` and baked into the edge image.
3. **`TRUST_PROXY` is required configuration with no inferred default**, and is
   `true` only in the compose file that creates the proxy.
4. **`NAIGX_IP_HASH_SECRET` is mandatory under `NODE_ENV=production`.** The
   application refuses to start without it.
5. **`/internal/*` is blocked at the edge**, independently of D-48's token.
6. **`HOST` becomes configuration but keeps its `0.0.0.0` default.** What keeps
   the application off the internet is publishing no port for it.

## 3. Why same-origin

`API §3.3` requires analysis creation and retrieval to work with no account, so
the client is unauthenticated for much of its life and CORS was carrying real
weight in development. Serving both halves from one origin does not weaken
that — it **removes the cross-origin case from the deployed path entirely**.
There is no second origin left to allow, so `CORS_ORIGIN` in production allows
nothing new; it is set only so a request that somehow arrives cross-origin is
still refused correctly.

It also costs nothing: the client already read `VITE_API_BASE_URL`, and the
empty string is a valid same-origin base. **No source change was required.**

The alternative — client on a separate origin or CDN, per `SA §9.1`'s CDN box —
buys asset distribution this project's traffic does not need, and pays for it
with a permanent cross-origin credential path.

## 4. Why `TRUST_PROXY` is configuration rather than a default

⚠️ **Both possible defaults are wrong, in opposite directions**, and this is the
substance of the decision rather than a detail of it.

`request.ip` feeds two things: the per-IP authentication rate limit
(`authAttemptIp`, `routes/auth.ts`) and the session/audit IP hash (`DB §4.1`).

| Setting | Situation | What breaks |
|---|---|---|
| `false` | Behind the proxy | Every client resolves to Caddy. The per-IP limit becomes **one global bucket** any single client can exhaust for everyone; every session row records the proxy's address, so `NFR-025` abuse detection sees one actor |
| `true` | Directly exposed | `X-Forwarded-For` is **client-supplied**. An attacker rotates it per request and the per-IP limit stops existing |

Neither failure announces itself. Both leave a healthy-looking service, passing
tests, and a rate limiter that is silently the wrong shape. So there is no value
that is safe in ignorance, and inferring one would be guessing at the topology.
It is `false` in code because that is safe for a directly exposed process, and
`true` in `docker-compose.prod.yml` because that file is the one that puts a
proxy in front.

**The parse is strict** — `true`/`false`/`1`/`0` only. The usual "any non-empty
string is true" reading turns the typo `TRUST_PROXY=flase` into `true`, silently
and in the direction that removes the limit.

## 5. Why the IP hash salt became mandatory

`DB §4.1` states raw IP is never persisted and `DB §13` classifies `ip_hash` as
**Pseudonymous**. The application had a development default salt — a constant
published in this repository — and the composition root never overrode it.

⚠️ **An IP hash salted with a public constant is not pseudonymous.** IPv4 is
2³² values; the entire space enumerates against a known salt in seconds, and
`ip_hash` reverses to the address it was meant to stand in for. Shipping the
production compose without fixing this would have made the `DB §13`
classification false at the moment of first deploy.

It is enforced at `NODE_ENV=production` only, because that is the sole
environment where the default would become the deployed value. Development and
the test suite need no configuration.

## 6. Why `/internal/*` is blocked at the edge

[D-48](23-D-48-Operator-Authentication.md) §5 already gates the operator surface
on a token, and that remains the security boundary — this is defence in depth,
not a replacement. `/internal/*` has no reason to be reachable from the
internet at all, and Phase 4's metrics scrape reaches it over the compose
network instead. It answers **404 rather than 403**: a refusal confirms the
path exists.

## 7. What this does not settle

- **`NFR-051` remains explicitly unmet** ([D-50](25-D-50-Deployment-Topology.md) §2).
  One instance behind a proxy is not availability.
- **No certificate has been issued by this configuration.** Everything beneath
  the TLS layer was verified over plain HTTP against the built images; the ACME
  exchange needs a public domain that does not exist yet. See
  [`deploy/README.md`](../deploy/README.md).
- **No Content-Security-Policy.** The client renders Mermaid diagrams, which
  inject styles at runtime; a plausible policy breaks that *silently* — the
  diagram does not appear and nothing logs why. A CSP belongs in Phase 4, landed
  against a rendered diagram rather than a guess.
- **`M-19` is not passed.** Its criterion is a production deploy with
  monitoring, alerting and verified rollback. Phase 2 is infrastructure.
