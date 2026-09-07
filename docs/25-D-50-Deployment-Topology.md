# D-50 — A single application instance, and no staging environment

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the topology question `M-19` cannot start without
**Affects:** `SA §9.1`, `SA §9.2`, `SA §9.4`, `NFR-025`, `NFR-051`, `TC-009`, `TM-17`, `M-19`
**Changes the standing of** [D-46](21-D-46-In-Memory-Rate-Limiting.md). Supersedes nothing.

---

## 1. The question

`SA §9.1` draws the production topology as a load balancer over `N` stateless
application instances. `M-19` has to deploy *something*, and the number of
instances is the decision every other `M-19` decision depends on: it determines
whether a shared rate-limit store is needed, whether session affinity must be
configured, and what the deployment costs.

## 2. The decision

1. **Exactly one application instance**, behind a TLS-terminating reverse proxy
   on the same host.
2. **No staging environment.** Rollback is verified against the production
   deployment itself, before the deployment criterion is claimed.
3. **`NFR-051` is explicitly not met**, and a working single-instance
   deployment is **not** evidence toward it.

## 3. Why one instance is the consistent choice, not merely the cheap one

`SA §9.4` already committed to three things that only cohere at one instance:

| `SA §9.4` says | What it implies |
|---|---|
| Analysis jobs execute **in-process on the receiving instance** | Work is not distributable |
| SSE requires **session affinity** for the event stream | The second instance needs sticky routing to be correct |
| **No cross-instance work distribution** — "not required at v1.0 volume" | The architecture says so itself |

A second instance would therefore add a load balancer, sticky sessions, and a
shared rate-limit store to gain throughput that `SA §9.4` states is not needed.
`TC-009` — "operational burden must be sustainable by one person" — settles it.

**The consequence worth naming:** at one instance,
[D-46](21-D-46-In-Memory-Rate-Limiting.md)'s in-memory rate limiter is
**correct**, not degraded. D-46 §3 said `NFR-025` "holds for a single instance
and not for a fleet"; this record deploys the topology in which it holds. The
limiter needs no change and no Redis, and the accumulated `M-19` prerequisite
list drops from five items to four.

⚠️ **This does not repair `NFR-051`, and must never be reported as repairing
it.** "Application tier horizontally scalable without code change" is false
today: the rate limiter would have to be swapped and session affinity
configured. What this record does is stop *pretending* the gap is a live
production defect. It is a property the system does not have, recorded as one.

## 4. Why no staging

`SA §9.2` specifies three environments and staging is the one that costs a
second machine. Skipping it is a real reduction in safety, and it is taken with
the reasons visible:

- **`TM-17` requires rollback verified**, not rollback verified *in staging*.
  A rollback drill on the production deployment before announcing it is
  stronger evidence than one performed elsewhere, because it exercises the
  actual host, the actual data volume, and the actual migration state.
- **`SA §9.2` forbids production data in staging** ("no production data,
  ever"), so a staging environment could never have rehearsed the case that
  matters — rollback with real rows present.
- **There is no beta traffic yet.** Private beta is a Sprint 5 exit gate that
  has not been reached, so the production deployment has no users to disturb
  while it is being proven.

⚠️ **This stops being defensible the moment there are beta users.** Once
`Roadmap §14`'s private beta begins, a change is being tested on other people's
data, and the argument above inverts. Staging is deferred, not rejected
forever, and the trigger for revisiting it is the first invited user.

## 5. What was rejected

**Two instances behind a load balancer.** Rejected. It buys throughput
`SA §9.4` says is unnecessary and costs a shared rate-limit store, sticky
sessions, and a second machine — while `TC-009` names single-operator burden as
a binding constraint.

**A staging VPS.** Rejected on cost against benefit at this stage; see §4,
including the condition that reverses it.

**Claiming `NFR-051` on the grounds that the code is stateless.** Rejected, and
it is the tempting one. `AP-3` statelessness is *necessary* for horizontal
scaling and is not *sufficient*: the rate limiter holds process state, and SSE
needs affinity. The requirement says "without code change", and both would need
one.

## 6. Consequences

| Consequence | Handling |
|---|---|
| One instance is a single point of failure | Accepted at v1.0. No availability NFR is claimed by this record |
| A deploy is a brief outage | Accepted; no zero-downtime requirement exists at v1.0 |
| `NFR-051` unmet | Recorded here and in `STATUS.md` non-claims; not a deployment blocker |
| Rollback rehearsed on production | Must happen **before** the `M-19` criterion is claimed, not after |
| Revisit trigger | First private-beta user (staging), or any availability requirement (second instance) |
