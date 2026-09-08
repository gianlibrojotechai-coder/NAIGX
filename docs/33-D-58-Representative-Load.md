# D-58 — What "representative load" means, and what `M-20` can therefore claim

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the undefined bar in `Roadmap` M-20 and `AC-020`
**Affects:** `M-20`, `AC-020`, `NFR-001`, `NFR-002`, `NFR-003`, `NFR-004`, `NFR-005`, `API §12.1`
**Builds on** [D-47](22-D-47-Provisional-Rate-Limits.md), [D-50](25-D-50-Deployment-Topology.md), [D-53](28-D-53-Encryption-Layers.md) §4. Supersedes nothing.

---

## 1. The question

`Roadmap` M-20 is *"`NFR-001`, `NFR-002` met under representative load"*, and
`AC-020` repeats the phrase. **No document in this project defines it.**

That is not a pedantic gap. A milestone whose bar nobody wrote down can be
neither met nor missed, and the failure mode is specific and tempting: run
whatever measurement is cheap, observe that the numbers are comfortable, and
call the milestone passed against a bar chosen after seeing the result. This
record fixes the bar first.

## 2. The decision

**"Representative load" at v1.0 is defined by what the deployed system will
actually admit, not by an invented traffic model.** Four parts:

| Dimension | v1.0 representative load | Where it comes from |
|---|---|---|
| **Concurrent analyses** | **1** | `SA §9.4` — jobs run in-process on the receiving instance, no cross-instance distribution, "not required at v1.0 volume". [D-50](25-D-50-Deployment-Topology.md) deploys exactly one instance |
| **Sustained analysis rate** | **10 per account per hour** | [D-47](22-D-47-Provisional-Rate-Limits.md) — the rate limiter's own ceiling. The system refuses more, so more is not representative of anything it will serve |
| **Accounts** | **single digits** — the operator, plus invited evaluators when `Roadmap §14`'s private beta begins | `TC-009` single-operator burden; no beta traffic exists yet |
| **History size per account** | **up to 1,000 analyses** | The only dimension that grows without bound and the only one where measurement shows a curve ([D-53](28-D-53-Encryption-Layers.md) §4) |

**Concurrency is deliberately not the load dimension at v1.0.** That is the
part worth stating plainly, because "load" ordinarily means concurrency and
here it does not. At one instance, with in-process execution, and a limiter
that admits ten analyses per account-hour, the shape of realistic use is *one
analysis at a time against a history that grows*. The dimension that can
actually degrade this system is **history size**, and that is where §3 puts the
measurement.

## 3. What "met" requires, per requirement

| Requirement | Bar | How it is discharged |
|---|---|---|
| `NFR-003` interaction ≤200ms p95 | At 1,000 analyses of history | Measurable free, in replay. **Measured** |
| `NFR-004` listing ≤1s p95 | At 1,000 analyses of history, both with and without a search term — they are different code paths since D-53 §4 | Measurable free, in replay. **Measured** |
| `NFR-005` export ≤10s p95 | One export at a time | Measurable free. **Measured** |
| `NFR-001` first artifact ≤15s p50 / ≤40s p95 | One analysis, live provider | ⚠️ **Not measurable under the no-spend constraint.** See §4 |
| `NFR-002` full completion ≤60s p50 / ≤120s p95 | One analysis, live provider | ⚠️ **Not measurable under the no-spend constraint.** See §4 |

## 4. ⚠️ The consequence: `M-20`'s own criterion cannot be met under the standing constraints

`M-20` names `NFR-001` and `NFR-002` specifically, and **both are dominated by
model provider latency**, not by anything this codebase does. The standing
no-provider-spend constraint makes every run replay mode, where the adapter
answers from a fixture immediately.

So a replay number tells you the system's overhead and **nothing at all** about
either target. Publishing one beside `NFR-001` would be a measurement of the
wrong thing, in the right units, next to the right requirement — the most
plausible-looking way to get this wrong, and the reason this section exists
rather than a rounded-up verdict.

**`NFR-001` and `NFR-002` are UNMEASURED.** `M-20` therefore **cannot pass**
until one of two things happens:

1. **Provider spend is authorised** for a measurement run — the only cost datum
   this project holds is **$0.2732** for one live analysis (D-47 §36), so a
   30-run sample to produce a p50 and p95 costs roughly **$8**; or
2. **Production traffic exists**, and `M-16`'s instrumentation reports the two
   latencies from real analyses — which is what those metrics were built for.

Option 2 costs nothing and is strictly better evidence. It requires the
deployment `M-19` is already blocked on.

**What replay measurement does establish** is a floor: the system's own
overhead is single-digit milliseconds against budgets of 15 and 60 *seconds*,
so essentially the entire budget is available to the model. That is a real and
useful result — it says any future `NFR-001` failure will be a provider or
prompt problem, not an architecture problem — and it is **not** a pass.

## 5. What was rejected

**Defining representative load as a concurrency figure** (e.g. "10 concurrent
users"). Rejected. It would invent a traffic model no document supports,
require a load generator to exercise, and measure a topology D-50 explicitly
did not deploy. `SA §9.4` states cross-instance distribution is not required at
v1.0 volume; a concurrency bar would contradict the architecture rather than
describe it.

**Building a load-generation tier to manufacture production-like numbers.**
Rejected, and the owner ruled it out directly. Numbers from synthetic
infrastructure on a dev laptop would not describe production either — they
would just look more like they did.

**Declaring `M-20` passed on `NFR-003`/`004`/`005` alone.** Rejected. Those are
real results and they are recorded as passing, but they are not the two
requirements `M-20` names. Three of five is not the criterion.

**Waiting for the definition until after a production deploy.** Rejected. The
bar has to exist before the measurement, or it is chosen by the result.

## 6. Consequences

| Consequence | Handling |
|---|---|
| `M-20` stays **open** with `NFR-003`/`004`/`005` measured and `NFR-001`/`002` unmeasured | Recorded in `STATUS.md` non-claims and in [`docs/performance/M-20-LATENCY-LOG.md`](performance/M-20-LATENCY-LOG.md) |
| `M-20` is now blocked on the same thing as `M-19` | A production host. Not a code task |
| History size is the growth dimension to watch | D-53 §4's revisit trigger, quantified in the latency log |
| This definition is a **v1.0** definition | Revisit trigger: the first private-beta user, which is also D-50 §4's trigger. More than one real user makes concurrency a live dimension for the first time |
| The `$0.2732` cost datum is from **one** run | It bounds an order of magnitude, not a budget. Re-verify against the provider's pricing page before authorising a measurement run |
