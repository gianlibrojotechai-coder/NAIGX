# D-47 — `APIQ-3` answered provisionally: the classes are specified, the numbers are not

**Date:** 2026-09-07
**Status:** Accepted — **provisional values**
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** `APIQ-3` (rate limit values per endpoint class) — **provisionally**
**Affects:** `NFR-025`, `API §11.2`, `API §12`, `API-001`, `API-004`, `API-020`, `API-040`, `M-15`
**Extends** [D-46](21-D-46-In-Memory-Rate-Limiting.md), which decided *where* counters live.

---

## 1. What the documents do and do not fix

`API §11.2` is unusually specific about **structure** and silent on **magnitude**:

| Scope | Basis | Rationale |
|---|---|---|
| Analysis creation, authenticated | Per account | Cost control (`R-13`) |
| Analysis creation, anonymous | Per IP, stricter | Abuse surface |
| Authentication attempts | Per IP **and** per account | Credential stuffing |
| Export generation | Per account | Rendering cost |
| Read endpoints | Generous per-account | Not a meaningful abuse vector |

It also fixes two behaviours: `429` carries `Retry-After`, and "limits are stated in `/system` so clients can behave well rather than discover limits by hitting them".

**So the classes are not invented here.** Five classes, their bases, and their rationales are all specified, and this record does not add, remove or re-scope one.

**No document states a number.** The one anchor that could have supplied the analysis-creation figure — `TV-4`'s cost ceiling — is defined as *"cost per analysis recorded and within a defined ceiling"*, with `docs/03` §490 saying the ceiling is "defined in Sprint 0". **Sprint 0 did not define it**, and no other document does. `NFR-083` requires cost to be recorded, which it is, but a recorded cost is not a ceiling.

Every value below is therefore **provisional**, in the same explicit sense `DB §8.3` uses of its retention periods: set so the requirement becomes satisfiable, on the thinnest possible evidence, and expected to be revised.

## 2. The values, and what little each rests on

| Class | Limit | Window | What it rests on |
|---|---|---|---|
| Analysis creation, authenticated | **10** | 1 hour | `NFR-002` puts a full analysis at ≤60s p50 / ≤120s p95, so a person cannot consume analyses much faster than they complete. Ten per hour is well above deliberate use and well below automated abuse. The only real cost datum this project holds is **$0.2732** for one live run, so ten per account-hour bounds a single account near $2.73/hour. |
| Analysis creation, anonymous | **3** | 1 hour, per IP | "Stricter" per `API §11.2`. Mostly a **secondary** defence: `API §7.8` already caps an anonymous caller at *one* analysis, enforced by `anonymous_limit_reached` 403 rather than by a rate limit, because the corrective action differs. This bounds repeated fresh-token acquisition from one address. |
| Authentication attempts | **10** per IP, **5** per account | 15 minutes | `API §11.2` names credential stuffing. The per-account limit is the tighter of the two because an attacker spraying one account is the case a per-IP limit alone misses. |
| Export generation | **20** | 1 hour, per account | "Rendering cost", and [D-43](18-D-43-PDF-Rendering-Approach.md) makes that concrete: a PDF launches a Chromium process per request, observed at ~2.4s. Twenty per hour bounds concurrent browser pressure without impeding someone exporting a set of analyses. |
| Read endpoints | **300** | 1 minute, per account | `API §11.2` says "generous" and "not a meaningful abuse vector". High enough that polling (`API-026`, every 2s) and a history browse never approach it. |

**`Retry-After` is computed from the window**, not a constant, so the header tells a client when the limit actually clears rather than a fixed guess.

## 3. What was rejected

**Leaving `APIQ-3` open and shipping no limits.** Rejected. `NFR-025` is a P0 security requirement and `R-13` ties it to bounding provider spend; shipping authentication with no limit on authentication attempts would be the worst version of this, since `API-001` is exactly where credential stuffing arrives.

**Deriving values from general practice and presenting them as derived.** Rejected as the more dangerous option, because it reads like evidence. The numbers above are judgement, and this record says so rather than dressing them in a rationale they do not have.

**Waiting for `TV-4`'s ceiling.** Rejected — it has been undefined since Sprint 0 and nothing schedules it. Blocking M-15 on it would trade a working limit for an absent one.

## 4. What this costs

**These numbers have no usage data behind them, and no load measurement exists** — `M-20` is untouched. They may be too tight for a legitimate consultant workload, which `APIQ-3` explicitly warns against ("must bound cost without impeding legitimate consultant workloads"), or too loose to bound cost meaningfully. Nothing here can tell which.

**`APIQ-3` is not fully closed.** It is answered well enough to build against, and should be revisited with real usage — the same standing `DB §8.3` gives its own periods.

## 5. What closing this requires

1. `TV-4`'s cost ceiling defined, which anchors the analysis-creation limits to something real.
2. Observed usage from more than one user.
3. `M-20` load testing, which is where "generous" for read endpoints stops being a guess.
4. Limits published at `/system` per `API §11.2`. **`API-061` is not implemented**, so that obligation is recorded and **not discharged** by this record.

## 6. Non-claims

- These are **provisional values**, not measured or validated ones.
- This does **not** discharge `API §11.2`'s requirement that limits be published at `/system`; `API-061` remains unimplemented.
- This does **not** change [D-46](21-D-46-In-Memory-Rate-Limiting.md): counters remain in process memory and still do not compose across instances.
- This does **not** implement the per-account **concurrent** analysis limit `API §12` separately names. Concurrency and rate are different controls, and only the second is built here.
- `anonymous_limit_reached` (`API §7.8`) is **not** a rate limit and is not configured here.
