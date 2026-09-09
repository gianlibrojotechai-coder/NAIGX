# M-20 latency measurement log

**[D-58](../33-D-58-Representative-Load.md) defines the bar this file is judged
against.** Read it first — it is what makes the numbers below mean anything,
and it is also what stops them from being read as an `M-20` pass.

⚠️ **THE HEADLINE IS IN §7, NOT IN THE TABLE.** `M-20`'s criterion is
*"`NFR-001`, `NFR-002` met under representative load"*. §§1–6 measure the
five things that can be measured honestly and free; three requirements pass.
**The two the milestone names were measured LIVE on 2026-09-09 under
owner-authorised spend, and both are NOT MET** — full completion p50 74.3 s
against 60 s, first artifact p50 85.3 s against 15 s. §7 has the apparatus,
the numbers, the sample's limits and the one finding that matters: `NFR-001`
is out of reach for this pipeline's shape, not for want of a faster model.

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

## 4. ⚠️ What the replay benchmark cannot measure — SUPERSEDED BY §7 for the verdict

> **2026-09-09:** the two requirements below were measured live — §7. This
> section is kept because its reasoning still governs: a replay number is
> never evidence for either of them, and §7 substituted none.

**`NFR-001` (first artifact ≤15s p50 / ≤40s p95) and `NFR-002` (full analysis
≤60s p50 / ≤120s p95) cannot be measured by the replay benchmark above.**

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

---

## 7. `NFR-001` / `NFR-002` measured LIVE — 2026-09-09 — and NOT MET

[D-58](../33-D-58-Representative-Load.md) §4 option 1, under the owner's
US$10 continuation cap. **No replay number appears in this section. No
implementation was changed to produce it.**

### 7.1 Apparatus

| | |
|---|---|
| Build | The compiled `dist/` at `1da10e3` — the deployed build — run locally: `NAIGX_EXECUTION_MODE=live`, port 3998 |
| Provider | `claude-sonnet-4-5` via the `anthropic` adapter; rates $3 / $15 per MTok, **re-verified against the provider's pricing page before the run** (D-58 §6) |
| Fragments | The development database was brought to the **same 15-fragment composition production runs**, through the unchanged gate with reference `d4abcd42626452df` (3 versions published, 12 unchanged). Proved by starting the build in replay first: all 15 recordings served, 54 fixtures, 0 excluded |
| Load | **One analysis at a time**, sequential — D-58 §2's representative load. Three dev accounts, ten submissions each, to stay inside D-47's 10/account-hour without touching the limiter |
| Inputs | Corpus cases rotating over all four paths: `jd-002`, `br-001`, `ew-001`, `ta-005`, `jd-008`, `br-002`, `br-003` |
| Timing | **Two independent clocks.** *Server*: `M-16`'s own formulas from stored timestamps — first `ARTIFACT` row `created_at` − analysis `created_at`, and `completed_at` − `created_at` (`src/db/metrics.ts`, nearest-rank percentiles). *Client*: HTTP `POST` → first poll showing a generated artifact / a terminal status, polling every 400 ms. They agree within 0.5 s on every run |
| Cost | Summed from `provider_invocation.estimated_cost` per analysis after each run; the harness refuses to start a run once cumulative spend plus one worst-case run ($0.30) would exceed the $8.00 ceiling |
| Evidence | `evidence/m20-live-runs-2026-09-09.jsonl` (one record per run), `.log`, and the harness itself |

### 7.2 The sample, and why it is 8 and not 30

11 live analyses were attempted before **the provider account's credit balance
ran out** (`400 invalid_request_error: "Your credit balance is too low"`).
Run 11 was killed mid-analysis by it at Stage 7; runs 12–30 were rejected at
Stage 1 in ~0.3 s each at zero cost. The account balance is the owner's, not
the cap's — **$1.2370 of the $10 was spent** (⚠️ corrected from the
harness's $1.1319 after reconciling the trace store: run 10's two Stage 9
calls finished after its deadline and were billed; D-65 §7.2 explains why,
and the cancellation fix that follows). The remaining budget is stated in
`SESSION-HANDOFF.md` §8.

| Run | Case | Outcome | First artifact | Full | Calls | Cost |
|---|---|---|---|---|---|---|
| 1 | jd-002 | completed | **161.6 s** (Stage 9 is the only artifact) | **161.6 s** | 5 | $0.1866 |
| 2 | br-001 | completed | — (path produces none) | 74.3 s | 4 | $0.1005 |
| 3 | ew-001 | **failed** — Stage 3, model emitted `category: "unknown"`, outside the contract's enum | — | (45.7 s) | 3 | $0.0641 |
| 4 | ta-005 | completed | 72.7 s | 72.7 s | 4 | $0.0792 |
| 5 | jd-008 | completed | — (`apply_now`: Stage 9 not planned) | 105.1 s | 4 | $0.1467 |
| 6 | br-002 | completed | — | 58.9 s | 4 | $0.0827 |
| 7 | ew-001 | completed | 92.7 s | 92.7 s | 4 | $0.1136 |
| 8 | ta-005 | completed | 85.3 s | 85.3 s | 4 | $0.0856 |
| 9 | br-003 | completed | — | 51.2 s | 4 | $0.0713 |
| 10 | jd-002 | **timed_out** — every stage succeeded (Stage 9 alone 131.9 s, two attempts) but the 180 s `DEFAULT_ANALYSIS_TIMEOUT_MS` fired first; the artifact was written 44 s after | — | (180.0 s) | 6 | $0.2390 |
| 11 | jd-002 | **failed** — credit exhaustion at Stage 7 | — | (55.0 s) | 4 | $0.0675 |
| 12–30 | — | rejected at Stage 1, credit exhaustion | — | — | 1 each | $0.0000 |

⚠️ **Run 1's client-side timings are absent** — the harness crashed on a
mistyped column after that run completed; its server timings and cost were
recovered from the database and it is recorded as such in the evidence file.

### 7.3 Results against the requirement

| Requirement | Budget | Measured (server, `M-16` formula) | Measured (client) | n | Met? |
|---|---|---|---|---|---|
| `NFR-002` full completion | ≤60 s p50 / ≤120 s p95 | **p50 74.3 s / p95 161.6 s** | p50 72.9 s / p95 105.5 s | 8 completed | ❌ **p50 over by 24%** — and the p95 excludes the run that hit the 180 s cap |
| `NFR-001` first artifact | ≤15 s p50 / ≤40 s p95 | **p50 85.3 s / p95 161.6 s** | p50 85.3 s / p95 92.8 s | 4 with an artifact | ❌ **p50 over by 5.7×** |

By path (completed runs): `business_requirement` full p50 58.9 s (max 74.3),
**no artifact at all**; `technical_assessment` 72.7–85.3 s, artifact at
completion; `existing_workflow` 92.7 s, artifact at completion;
`job_description` 105.1–161.6 s, artifact only when the verdict is
`build_first` and only at Stage 9. Cost per completed analysis $0.07–$0.19;
mean per attempt $0.103.

### 7.4 ⚠️ The finding: `NFR-001` is out of reach for this pipeline's shape

"First artifact visible after submission" assumes something appears early.
Nothing does. Every artifact this system produces is derived from reasoning
that has finished: the rendered artifacts (`workflow_recommendation`,
`risk_assessment`, `assessment_feedback`, `mermaid_diagram`) exist only after
Stage 6, and the one generated artifact (`portfolio_suggestions`) is Stage 9,
the last call of the longest path. Stages 1–3 alone took ~45 s on run 10
(2.0 + 10.9 + 32.1 s) before any reasoning stage began. **A 15 s p50 cannot
be met by making the model faster; it can only be met by changing what
counts as an artifact or when one is emitted** — a requirements or
architecture decision (`PRD` `NFR-001`, `AI §3.2`), not a tuning task.
`business_requirement` has no artifact, so `NFR-001` is undefined for a
quarter of the paths.

`NFR-002` is a different kind of miss — 24% at p50 with a small sample, on a
pipeline whose stage latencies are all provider time (this system's own
overhead is single-digit milliseconds, §4). It could move with prompt length,
model choice or a shorter Stage 9, but every one of those is a change to the
reasoning the evidence campaign just validated, and none was made here.

### 7.5 Two things observed on the way, recorded not fixed

- **Run 3:** the model returned `category: "unknown"` in Stage 3 — a value the
  contract's enum does not contain — and the analysis failed closed, correctly.
  A live schema-conformance failure of the kind the Sonnet 5 pilot recorded,
  now seen on Sonnet 4.5. One in eleven; noted for `FR-039`/`AI §10`, no prompt
  touched.
- **Run 10:** all seven stages succeeded and the analysis is still
  `timed_out`, because the 180 s executor deadline fired during a 131.9 s
  Stage 9. `NFR-002`'s p95 (120 s) is *below* the deadline, so a run that hits
  the deadline has already breached the requirement — the deadline is not
  masking anything, but the user sees `timed_out` for work that finished.

### 7.6 What this does and does not establish

- **Does:** `NFR-001` and `NFR-002` are measured, on the deployed build, the
  production composition, the real provider, at D-58's representative load —
  and not met. The direction is not in doubt: every completed run exceeded the
  `NFR-002` p50 budget except three `business_requirement` runs, and every
  artifact-bearing run exceeded `NFR-001`'s p95.
- **Does not:** give a stable p95. Eight completed runs is a floor on the
  sample D-58 planned, not the sample. Completing it costs ~$2.5 more once
  credits exist and would sharpen the p95, not change the verdict.
- **Does not:** measure production. The build and composition are
  production's; the host, the TLS hop and the proxy are not. Every figure is a
  lower bound on what a user of `naigx.tech` would see.

**`M-20` therefore stays NOT PASSED — on evidence.** What closes it is no
longer a measurement: it is a decision about `NFR-001`'s definition and
`NFR-002`'s target, which is the owner's.

⚠️ **The figures above are Sonnet 4.5 figures and stay labelled as such.**
The live model moved to `claude-sonnet-5` later the same day
([D-65](../40-D-65-Structured-Outputs-And-Sonnet-5.md)); its four-path
verification recorded wall-clock times of 85–141 s per completed analysis at
`medium` effort and ~195 s for the job-description path — **an
observation from five runs, not an `M-20` measurement**, and not a pass
either. A Sonnet 5 `M-20` sample would be a fresh D-58 run.
