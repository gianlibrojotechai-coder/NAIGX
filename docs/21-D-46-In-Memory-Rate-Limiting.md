# D-46 — Rate limiting is in-memory, and does not compose across instances

**Date:** 2026-09-07
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Affects:** `NFR-025`, `NFR-051`, `APIQ-3`, `API-001`, `API-004`, `API-020`, `M-15`, `M-19`
**Extends** [D-44](19-D-44-Refresh-Token-Table.md) and [D-45](20-D-45-Anonymous-Expiry-And-Token-Lifetime.md).

---

## 1. Two requirements that pull apart

| | |
|---|---|
| `NFR-025` | "Rate limiting per account and per IP on analysis submission" |
| `NFR-051` | "Application tier horizontally scalable **without code change**" |

A rate limiter holds counters. Where those counters live decides whether both requirements can hold at once:

- **In process memory**, each instance counts only the requests it saw. Two instances behind a load balancer enforce a limit of *N per instance*, so the effective limit is `N × instances` — and it changes when the fleet is resized, which is the "without code change" scaling `NFR-051` promises.
- **In a shared store**, counters compose and both requirements hold — at the cost of a service this project does not have.

There is no third option that satisfies both without new infrastructure. This record chooses the first and states the cost rather than implying the requirement is met.

## 2. The decision

1. **Rate limiting is enforced in process memory**, per instance.
2. **`NFR-025` is met for a single instance and not for a fleet.** With one instance running — which is every environment that exists today — the limit is exactly the configured limit. With more than one, it is multiplied by the instance count.
3. **No Redis, Memcached, or other external service is added for this requirement.** The owner ruled that out explicitly, and adding a stateful dependency to satisfy a requirement whose deployment does not yet exist would be paying an operational cost for a scale nobody is running at.
4. **The limiter is written behind a narrow interface** — check, record, reset — so replacing the store is one implementation swap rather than a rewrite of every guarded route. This is not a claim that the swap is free; it is a claim that it is contained.
5. **Limits are configuration, not constants.** `APIQ-3` (rate-limit values per endpoint class) stays **open**; this record decides *where counters live*, not what they are.

## 3. What was rejected

**Redis or an equivalent shared counter store.** Rejected by owner decision. It would satisfy both requirements, and it adds a service to deploy, monitor, secure, back up and fail over — for a system with no production deployment (`M-19` untouched) and no measured load (`M-20` untouched).

**Postgres as the counter store.** Rejected. It needs no new service, and it puts a high-frequency write on the primary store's hot path — every guarded request becoming a database round trip, on the same connection pool serving analysis persistence. Rate limiting exists to protect the system under load, and this arrangement is worst exactly when it matters most.

**Declaring `NFR-025` met and not mentioning `NFR-051`.** Rejected, and this is the substantive rejection. The implementation would be identical; the difference is entirely in whether the gap is written down. An unrecorded gap here would surface as a security finding during `M-18`, or as a bypass in production, discovered by whoever hits it rather than by whoever chose it.

## 4. What this costs

**`NFR-025` is not satisfied under horizontal scaling, and `NFR-051` is not satisfied for this component.** Both statements are true simultaneously and neither should be reported as met without this qualification.

**The practical exposure is cost.** `R-13` ties rate limiting to bounding provider spend; a fleet-wide limit that is really per-instance bounds spend at `N ×` the intended ceiling. With provider spend currently unauthorised and one instance running, the exposure today is zero — and it becomes real on the day a second instance starts, which is `M-19`.

## 5. What closing this requires

At **`M-19` (Deployment)**, before more than one application instance runs:

1. Decide whether the deployment is single-instance. If it is, this record needs nothing further and should say so.
2. If it is not, move counters to a shared store behind the existing interface, and verify the limit holds across instances rather than per instance.
3. Record the outcome. `M-18` (Security) should treat this record as a known finding with a stated remediation, not discover it.

## 6. Non-claims

- This does **not** claim `NFR-025` is met in a multi-instance deployment.
- This does **not** claim `NFR-051` is met for the rate-limiting component. Every other part of the application tier remains stateless.
- This does **not** resolve `APIQ-3`. The values per endpoint class are still open.
- This does **not** constitute a security review. `M-18` is a separate milestone and this is one input to it.
