# M-20 latency measurement log

**[D-58](../33-D-58-Representative-Load.md) defines the bar this file is judged
against.** Read it first — it is what makes the numbers below mean anything,
and it is also what stops them from being read as an `M-20` pass.

⚠️ **THE HEADLINE IS NOT IN THE TABLE.** `M-20`'s criterion is *"`NFR-001`,
`NFR-002` met under representative load"*, and **neither of those two was
measured, because neither can be under the standing no-provider-spend
constraint.** What follows measures the five things that *can* be measured
honestly and free. Three requirements pass. The two the milestone names are
**UNMEASURED** — see §4.

Reproduce with:

```bash
cd backend
npm run bench            # volumes 10 / 50 / 300
npm run bench -- 1000    # volumes 10 / 50 / 1000 — the search curve needs this
```

⚠️ `npm run bench` is **not** part of the test gate. It seeds and deletes real
rows in the development database and takes a couple of minutes.

---

## 1. The apparatus, and what it excludes

| | |
|---|---|
| **Date (UTC)** | 2026-09-08 |
| **Machine** | Intel Core Ultra 9 275HX · 24 logical cores · 31.4 GB RAM · Windows 11 (10.0.26200) |
| **Runtime** | Node v24.18.0, win32/x64 |
| **Database** | PostgreSQL 17.10 in Docker, on the same host |
| **Transport** | `app.inject` — in-process dispatch |
| **Execution mode** | Replay. No provider call is made anywhere in this run |
| **Concurrency** | None. One request at a time |

**What `app.inject` excludes: TLS, the Caddy proxy hop, and the network** —
which are exactly the parts a real client experiences. Every server-side figure
here is a **lower bound** on user-observed latency, never an estimate of it.

⚠️ **These are development-machine numbers and may not be quoted as production
performance.** What they are good for is the *shape of a curve* — whether
something is flat or grows with volume — and catching a regression against a
previous run on the same machine.

---

## 2. Results

Volumes are analyses of history belonging to the measured user. `n=60` per
measurement (`n=30` for `POST`, `n=10` for export), after 3 untimed warmup
passes. Percentiles are nearest-rank, computed by the same function as
`db/metrics.ts` so two tools cannot disagree.

### API latency, by history size

p50 / p95 in milliseconds. The 10, 50 and 1000 columns are one sweep; the 300
column is a second sweep on the same machine minutes later.

| Measurement | 10 | 50 | 300 | 1000 | Budget | Verdict |
|---|---|---|---|---|---|---|
| `GET /health` (liveness) | 0.1 / 0.2 | 0.1 / 0.1 | 0.0 / 0.1 | 0.0 / 0.0 | 200ms p95 (`NFR-003`) | ✅ |
| `GET /health` (readiness) | 2.2 / 2.9 | 1.8 / 3.0 | 1.4 / 3.2 | 1.8 / 2.5 | 200ms p95 (`NFR-003`) | ✅ |
| `GET /analyses/:id` | 3.4 / 4.5 | 3.7 / 5.7 | 2.9 / 5.2 | 3.0 / 6.7 | 200ms p95 (`NFR-003`) | ✅ |
| `GET /analyses` (listing) | 2.1 / 3.3 | 2.0 / 3.2 | 1.6 / 2.9 | 1.7 / 2.1 | 1s p95 (`NFR-004`) | ✅ |
| **`GET /analyses?q=` (search)** | 2.5 / 3.5 | 5.2 / 8.0 | 13.5 / 16.1 | **75.1 / 80.9** | 1s p95 (`NFR-004`) | ✅ |
| `POST /analyses` → 202 | 4.5 / 6.0 | 5.8 / 10.0 | 4.0 / 5.1 | 3.9 / 4.3 | 500ms p95 (`API §12.1`) | ✅ |
| `renderPdf` (export) | — | — | — | 1358.7 / 1540.5 | 10s p95 (`NFR-005`) | ✅ |

### Envelope cost per value (n=20,000, 470-char plaintext)

| Operation | Mean |
|---|---|
| `seal` | 24–28µs |
| `open` | 21–24µs |

⚠️ **Timed in aggregate and reported in microseconds, deliberately.** One
`seal` takes less than `performance.now()` can resolve on this machine, so
timing each call individually printed a confident `0.0ms` — a figure that looks
like a result and is really the clock's resolution.

---

## 3. The three findings worth keeping

### 3.1 D-53 §4's central assumption holds

[D-53](../28-D-53-Encryption-Layers.md) §4 accepted an `O(n)` decrypt-and-filter
search — giving up an indexed SQL predicate — on the stated argument that
*"AES-GCM decryption is microseconds per row"*. **Measured: 21–24µs to open a
value.** The assumption holds, and it is now a measurement rather than a
plausible claim.

### 3.2 Listing is flat; search is not — exactly the shape D-53 §4 predicted

Listing costs the same at 1,000 analyses as at 10, because no search term runs
the original indexed keyset query. A search term takes the other path, and it
grows: **2.5ms → 75.1ms p50 across a 100× volume increase.**

That is the trade D-53 made, visible. At 1,000 analyses, search costs ~75µs per
row all-in, of which ~22µs is decryption and the rest is query and
serialisation.

### 3.3 D-53 §4 asked for the revisit trigger to be quantified — now it can be

Extrapolating linearly from the 300 and 1,000 points (a marginal ~88µs per row),
one user's search consumes the whole 1s `NFR-004` budget somewhere around
**10,000–12,000 analyses on this machine**.

⚠️ **State that as an extrapolation from four points on a dev laptop, never as
a production limit.** Two caveats travel with it and must not be dropped:

- The marginal per-row cost is **not constant** across the measured points
  (~68µs, then ~33µs, then ~88µs). The curve is noisier than four points can
  resolve, and the last segment is the steepest — so linear extrapolation is
  the **optimistic** reading.
- D-58 sets v1.0 representative history at **1,000 analyses**, where search is
  at **8% of its budget**. The trigger is a long way off, and it is a real one.

---

## 4. ⚠️ What was NOT measured — and why `M-20` is not passed

**`NFR-001` (first artifact ≤15s p50 / ≤40s p95) and `NFR-002` (full analysis
≤60s p50 / ≤120s p95) are UNMEASURED.**

Both are dominated by model provider reasoning time, not by anything in this
codebase. Every run above is replay mode, where the adapter returns a recorded
response immediately — so a number from this benchmark measures **this system's
overhead** and says nothing whatsoever about either target.

**Publishing a replay number beside `NFR-001` would be a measurement of the
wrong thing, in the right units, next to the right requirement.** It is the
most plausible-looking way to get this wrong, which is why it is called out
here rather than quietly avoided.

**`M-20` names those two requirements and no others. It is therefore OPEN.**
See [D-58](../33-D-58-Representative-Load.md) §4 for the two ways it can close:
authorised provider spend (~$8 for a 30-run sample), or production traffic read
through `M-16`'s instrumentation — which costs nothing and is better evidence,
and needs the deployment `M-19` is already blocked on.

**What the replay numbers do establish** is a floor: this system's own overhead
is single-digit milliseconds against budgets of 15 and 60 *seconds*. Effectively
the entire `NFR-001`/`NFR-002` budget is available to the model. Any future
failure of those two will be a provider or prompt problem, not an architecture
problem. That is worth knowing. It is not a pass.

---

## 5. ⚠️ Two measurement defects found here — both printed plausible numbers first

Both are the same shape, and it is the shape to distrust: **a request that is
rejected still produces a timing, and a fast one.**

| Defect | What it printed | What it was measuring |
|---|---|---|
| Listing and search measured **unauthenticated** | Confident sub-millisecond p95s | `GET /analyses` requires a user, so the request `401`d **before reaching the query**. It measured the authorization rejection, not the decrypt path it claimed to |
| `GET /health` measured with **no readiness probes wired** | `0.4–0.7ms`, comfortably inside `NFR-003` | `buildApp` leaves `checkProvider`/`checkTemplates` undefined unless passed, `probe()` returns `unavailable` without doing any work, and the endpoint answered **503**. It measured the cost of declining to check anything |

The second was found only because the first was fixed by a **status-code
assertion** — `measure()` now takes the HTTP status a measurement must receive
and throws during warmup if it gets another. The health defect surfaced within
seconds of that guard existing, having survived a full run and a write-up
before it.

The guard is verified by differential: setting an expectation to a status the
route cannot return aborts the run with
`GET /health: expected HTTP 999, got 503` before any number is printed.

⚠️ **If you add a measurement for any route, declare its expected status.** The
output of this benchmark is not self-validating and never looks wrong.

Readiness is now measured with production's real `checkTemplates` probe (a
fragment resolve — actual database work). `checkProvider` is stubbed, which is
faithful rather than convenient: production's probe is a *configuration* check
with no I/O, because a readiness endpoint is polled continuously and billing a
token per poll would be a defect.

---

## 6. One corroboration, one thing this log cannot settle

**Corroborates [D-43](../18-D-43-PDF-Rendering-Approach.md).** D-43 chose a
browser launch per export — the simple, leak-free arrangement over the fast one
— and recorded ~2.4s observed. Measured here at **1.36s p50 / 1.54s p95**, n=10,
comfortably inside `NFR-005`'s 10s. The per-call browser launch remains the
right trade at v1.0; it costs about 1.4 seconds of a 10-second budget.

⚠️ **Measured against this machine's Chromium, not the container's.** The
deployed path renders inside the backend image under the seccomp profile with
`chromiumSandbox: true`, which this measurement does not exercise. `NFR-005` has
headroom of roughly 6.5×, so the conclusion is unlikely to invert — but the
in-container figure is unmeasured, and this is the number to re-take on the
first real deploy.
