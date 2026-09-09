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
([D-65](../40-D-65-Structured-Outputs-And-Sonnet-5.md)). Its own D-58
sample is §8, kept separate.

---

## 8. `NFR-001` / `NFR-002` on Claude Sonnet 5 — 2026-09-09 — the full 30-run sample, and NOT MET

Same methodology as §7, same 10-case rotation, same two clocks, **one
analysis at a time**, the **180 s default deadline** (no override), the
deployed build `a12ce54` run locally in live mode with D-65's structured
outputs and `effort: medium`, on the owner-confirmed new account. Nothing
was excluded: every run is in the record and every run counts.

### 8.1 The sample

| | |
|---|---|
| Runs | **30 of 30 completed** — 0 timed out, 0 failed |
| Degraded | 1 (run 15, `jd-008`: the portfolio artifact failed the published schema twice on an empty `platforms` list; the analysis completed with the artifact labelled failed) |
| Calls / cost | **131 calls, $3.1895** — the harness and the trace store agree to the cent; 0 zero-cost calls, 0 cancelled calls |
| Tokens | 588,008 in / 201,349 out |
| Evidence | `evidence/m20-sonnet5-runs-2026-09-09.jsonl` and `.log` |

### 8.2 Results against the requirement

| Requirement | Budget | Measured (server, `M-16` formula) | Measured (client) | n | Met? |
|---|---|---|---|---|---|
| `NFR-002` full completion | ≤60 s p50 / ≤120 s p95 | **p50 77.2 s / p95 128.0 s**, max 139.8 s | p50 77.2 s / p95 128.1 s | 30 | ❌ p50 over by 29%; 18 of 30 runs over 60 s, 4 over 120 s |
| `NFR-001` first artifact (M-16: first artifact row, any status) | ≤15 s p50 / ≤40 s p95 | **p50 91.4 s / p95 126.6 s** | p50 77.2 s / p95 126.8 s | 21 | ❌ p50 over by 6× |
| `NFR-001`, generated artifacts only | same | p50 77.2 s / p95 126.6 s | — | 20 | ❌ |

By path (all completed): `technical_assessment` p50 41.9 s (max 77.2),
`business_requirement` 54.9 s (max 139.8, **no artifact by design**),
`existing_workflow` 65.3 s (max 126.7), `job_description` 110.4 s (max
126.6, artifact at Stage 9). Cost per analysis $0.06–$0.17; mean $0.106.

### 8.3 Read against the Sonnet 4.5 sample — separately

| | Sonnet 4.5 (§7, n=8 completed of 11) | Sonnet 5 (n=30 of 30) |
|---|---|---|
| `NFR-002` p50 / p95 | 74.3 s / 161.6 s | 77.2 s / 128.0 s |
| `NFR-001` p50 / p95 | 85.3 s / 161.6 s (n=4) | 91.4 s / 126.6 s (n=21) |
| Timed out / failed | 1 / 2 (of 11) | 0 / 0 (of 30) |
| Shape failures at a parser | 1 | **0** |
| Cost per completed analysis | $0.07–$0.19 | $0.06–$0.17 |

The two samples are different sizes, different models and different
adapters (structured outputs only on Sonnet 5); they are placed side by
side to show both miss the same requirement in the same way, **not** to
rank the models. §7.4's finding stands on both: no artifact exists before
Stage 6/7 completes, so `NFR-001` cannot be met by a faster model. Sonnet
5's variance is narrower (Stage 3 21–95 s across the whole sample) and
nothing hit the deadline, but the p50s sit in the same place.

**`M-20` stays NOT PASSED on both models**, with its requirements as
written. §9 is where the time goes, and what could move it.

---

## 9. Where the time goes — from the traces, no new spend

Every provider call in both samples carries its latency and its token
counts (`provider_invocation`), and every analysis its stage timings
(`stage_trace`). Aggregated 2026-09-09.

### 9.1 The system's own overhead is nil

| Sample | Wall clock p50 | Summed provider-call latency p50 | Everything else, p50 / max |
|---|---|---|---|
| Sonnet 5 (n=30) | 84.3 s | 84.1 s | **0.16 s / 0.36 s** |
| Sonnet 4.5 (n=11) | 74.2 s | 74.1 s | 0.18 s / 0.43 s |

Persistence, composition, validation, sealing, event delivery: 0.2% of
the wall clock. §4's floor is confirmed on live data. **Nothing this
codebase does between calls is worth optimising for `NFR-001`/`NFR-002`.**

### 9.2 Per stage, Sonnet 5 (`effort: medium`, structured outputs)

| Stage | n | p50 | p95 | Output tokens p50 | Output tok/s p50 (min–max) | Share of call time |
|---|---|---|---|---|---|---|
| `context_extraction` (3) | 30 | **20.2 s** | **93.9 s** | 2,394 | 119 (24–134) | **38.6%** |
| `recommendation_generation` (7, JD only) | 9 | **44.2 s** | 59.9 s | **4,252** | 93 (87–106) | 16.8% |
| `architecture_analysis` (6) | 15 | 22.8 s | 27.9 s | 1,981 | 90 (84–100) | 13.3% |
| `portfolio_suggestions` (9, JD only) | 11 | 26.5 s | 42.2 s | 2,395 | 88 (59–97) | 13.3% |
| `workflow_review` (6, EW only) | 6 | 31.2 s | 51.9 s | 3,049 | 98 (96–100) | 8.2% |
| `intent_detection` (2) | 30 | 5.4 s | 8.0 s | 396 | 73 | 7.0% |
| `input_classification` (1) | 30 | 2.2 s | 3.4 s | 50 | 23 | 2.8% |

Sonnet 4.5 has the same ordering (Stage 3 32.4%, Stage 9 20.2%) at
lower, steadier throughput (40–75 tok/s, no tail).

### 9.3 Three findings

1. **Latency is output-token volume divided by provider throughput,
   stage by stage, in series.** Input size barely matters (a 10.8k-token
   Stage 7 prompt and a 3k-token Stage 1 prompt differ by a second). Output
   tokens *include thinking*; the API does not split them, so how much of
   Stage 3's 2,394 is reasoning is not knowable from the record.
2. **The p95 tail is provider throughput, not the prompt.** Stage 3 across
   the Sonnet 5 sample: 24 calls at 91–134 tok/s finished in 11–27 s; **6
   calls at 24–39 tok/s took 53–98 s on the same token counts** (e.g. 93 s
   for 3,111 tokens beside 23 s for 2,987). One in five Stage 3 calls ran
   at a quarter speed. No change to this system's requests alters that.
3. **The job-description path is five serial calls** whose p50s sum to
   ~99 s (2.2 + 5.4 + 20.2 + 44.2 + 26.5), so `NFR-002`'s 60 s p50 is out
   of reach for that path at these stage sizes regardless of tail
   behaviour; `business_requirement` (four calls, ~51 s) is the only path
   near it. And **no artifact exists before Stage 6/7 completes**: the
   earliest any current artifact can appear is after Stages 1+2+3+6 ≈ 51 s
   p50, so `NFR-001`'s 15 s p50 is unreachable by the pipeline's shape
   with any model.

### 9.4 What could move it — smallest first

**Within the current contracts** (no requirement, prompt, schema or
activation-gate change; declared configuration only):

| Lever | Targets | Expected | Status |
|---|---|---|---|
| **Per-task `effort`** — `low` for the extraction stages (1–3), `medium` where reasoning happens (6/7/9) | Stage 3's 39% share, Stages 1–2 | Fewer thinking tokens per call, so fewer output tokens at the same throughput; does **not** touch the throughput tail | **Built** (`PROVIDER_EFFORT_BY_TASK`, adapter `effortByTask`); default unchanged; a concrete change, evaluated in §9.5 |
| Prompt caching of the composed system prompt (`cache_control`) | Input tokens, ~3–11k per call | Cost (10× cheaper cached input) far more than latency (input processing is ~1 s); transport-level, request shape unchanged | Not built; a cost lever, listed for completeness |
| `max_tokens` | — | None on latency | — |

**Requiring a decision** (architecture, requirements or policy — each a
D-record, none made here):

| Change | Targets | What it would take |
|---|---|---|
| **An early deterministic artifact** rendered from Stage 2's intent record (~8 s p50, ~11 s p95 cumulative) | `NFR-001` as written | A new `ARTIFACT_TYPE`, schema, presenter and plan entry: `AI §9.1`, `DB §4.4`, `FR-040`. The only route to a ≤15 s p50 "first artifact" that keeps the requirement's meaning |
| **Model routing per stage** — a faster-tier model for Stages 1–3 | Stage 3 p50 and the tail | `AI §10.3` already names `costLatencyTier` routing; `FR-024` reproducibility and `AI-004` attribution per stage; a two-model analysis needs its own record |
| **Hedged retry** — abort a call running far below expected throughput and retry | The p95 tail | A retry-policy change (`AI §10.4`); the aborted call is still billed; would need a throughput floor derived from this data |
| **Shorter Stage 7/9 output** via the fragments | Stage 7's 4,252 tokens | A prompt change: authored, captured, gated, activated — the D-63/D-64 route, with spend |
| Parallelising Stages 2 and 3 | ~5 s p50 | `AI §3.2` hands Stage 3 the intent record; removing that is a contract change for a small gain |

⚠️ Not available: a paid fast lane — Priority Tier is not offered on
Sonnet 5 (migration guide).

### 9.5 The one in-contract change, evaluated — and NOT adopted

Six runs (the rotation's first six: jd-002, br-001, ew-001, ta-005,
jd-008, br-002), `PROVIDER_EFFORT_BY_TASK="input_classification=low,
intent_detection=low,context_extraction=low"`, everything else as §8:
180 s default, one at a time, the deployed build. Evidence:
`evidence/m20-sonnet5-effort-eval-2026-09-09.jsonl` and `.log`.

| Stage at `low` | This evaluation | §8 baseline at `medium` | Verdict |
|---|---|---|---|
| `context_extraction` | 17.4 / 18.4 / 24.8 s on normal-throughput calls (115–130 tok/s), **72.3 / 93.8 s** on two slow ones (25–31 tok/s); 1,799–3,003 output tokens | p50 20.2 s, 2,394 tokens, same bimodal throughput | **No gain.** Output tokens did not fall: the response *is* the JSON context set, not thinking |
| `intent_detection` | p50 5.6 s, 389 tokens | 5.4 s, 396 tokens | identical |
| `input_classification` | p50 2.1 s, 53 tokens | 2.2 s, 50 tokens | identical |

**The lever is exhausted.** Effort steers thinking; on these stages the
output is the contract's payload and thinking is not a material share of
it. The per-task override stays in the code as declared, validated
configuration (default: unset, so behaviour is unchanged) and is **not
recommended**. This closes the in-contract list in §9.4: what remains is
architectural.

**Two runs failed inside the window, neither from effort:**

- `ta-005`: Stage 2 (`low`) received three consecutive *"Provider reported
  a temporary internal error"* responses (22.6 s, 22.7 s, 13.9 s) — server
  errors — and the analysis **failed closed** after the bounded retry
  (`AI §10.4`, three attempts with backoff). Correct behaviour.
- `jd-002`: Stage 7 (`medium`, unchanged) got a server error after 99.5 s
  in flight and another after 23.0 s; the third attempt was in flight
  when the 180 s deadline fired and was **cancelled at 30.7 s** — the D-65
  §7.2 fix working: no fourth call, nothing written after `timed_out`.

A provider incident is part of `NFR-002`'s reality, not an exclusion:
both runs are in the record. Note the interplay it shows — bounded
retries with backoff can spend most of the deadline on a stage that is
failing upstream, which is the right trade (a retry that succeeds saves
the analysis) but means a server incident converts directly into
timeouts.

**Spend for this evaluation:** 27 calls; **$0.4544 recorded**; five
server-error calls carried no usage (recorded $0, and expected to be
unbilled, but that cannot be verified from the key); one cancelled call
**explicitly unknown, carried at $0.0951** — the largest Stage 7 call ever
recorded. Budgeted total for the evaluation: **$0.5495**.

## 10. D-66 — the early artifact, built; not yet measured — 2026-09-09

§9.4's first architectural row was taken, on the owner's instruction:
[D-66](../41-D-66-Intent-Brief-Early-Artifact.md) adds `intent_brief`, a
deterministic artifact rendered from the Stage 2 intent record when Stage 2
completes, on every reasoning path. It changes **no requirement, prompt,
gate, parser or recording**; the 15 canonical recordings replay unchanged and
reproduce `d4abcd42626452df`.

**What it changes for this log.** `M-16`'s `time_to_first_artifact` is
defined on the first `ARTIFACT` row, so from the first live run on a D-66
build the `NFR-001` series measures the brief. That is the intended reading
of the requirement as written, and it is also why a fall in that series must
not be read as a reasoning speed-up: Stages 3–9 are exactly as they were in
§8 and §9, and `NFR-002` is untouched.

**Expected, from the traces already held (not a measurement):** the brief
lands at Stage 2's cumulative completion plus milliseconds — §9.2 gives
**~7.6 s p50 / ~11.4 s p95** on Sonnet 5 and ~11.6 / 14.3 s on Sonnet 4.5.
Both are inside the 15 / 40 s budget *if* the live sample bears them out.

**Not done here, deliberately:**

- No live sample was taken. The deployed build does not yet carry D-66 (a
  deploy needs the owner's authorisation and publishes a sixth artifact
  schema, a production write). A local live check on the built `dist/` was
  prepared and not run — the tool permission for a live-mode process was
  denied — and **nothing was spent**; the remaining task budget is unchanged
  from §9.5.
- No replay timing is reported. The replay verification (D-66 §7) showed the
  brief as the first generated artifact ~0.15 s after submission, which is
  this system's overhead with an adapter that answers instantly — the exact
  number STATUS item 49 forbids publishing beside `NFR-001`, and it is not.

**What closes `NFR-001` on this build:** a D-58 sample (30 runs, one at a
time, 180 s default, nothing excluded) on the deployed D-66 build, reported
here as §11 with Sonnet 5 kept separate from §7's Sonnet 4.5 as before. On
the recorded Stage 2 timings it should pass; the sample is what says so.
`M-20` stays open until then, and `NFR-002` stays NOT MET regardless.
