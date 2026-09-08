# NAIGX — Session Handoff

**Written:** 2026-09-08
**Purpose:** hand a new chat session everything it needs to continue building NAIGX without re-deriving context or re-litigating settled decisions.

> **Read this first, then `docs/STATUS.md`.** STATUS.md is the authoritative current-state record. This file covers the most recent working sessions, and the exact next step.
>
> ⚠️ **Start at §7a.** M-20 is **done as far as it can go** — measured, written up, committed, and **not passed**, for a reason that is the finding rather than a shortfall. The working tree is clean.
>
> ⚠️ **AND THE HARDER THING: Sprint 5 has no remaining code increment.** Every outstanding item needs a host, a human, or an authorisation. §7a §"What is actually left" lists them. **Do not manufacture a code task to have something to do** — the honest next move is to tell the owner what only they can unblock.

---

## 1. What NAIGX is

Gian's **personal AI/automation intelligence system**. It analyses job descriptions, assesses client opportunities, identifies automation/AI implementation requirements, and evaluates his fit and gaps.

**It is explicitly NOT primarily a portfolio project.** Do not frame work as portfolio-building.

**Stack:** TypeScript · Node 24 · Fastify 5 · Prisma 7 · two PostgreSQL databases (primary + trace) · `node:test` · oxlint · prettier · React/Vite frontend · Docker.

---

## 2. How the owner wants you to work

These are standing instructions given explicitly. **They override default thoroughness instincts.**

- **"I'm vibe coding and learning the engineering concepts while building."** Keep explanations focused on: what we're building, why it exists, what's changing, what he needs to understand.
- **"Build first. Learn along the way. Polish and optimize after the project is built."**
- **"Don't optimize the workflow around exhaustive review cycles or theoretical future blockers."**
- Do **not** repeatedly stop to investigate hypothetical future blockers. Surface a real blocker once, in one or two sentences, then keep building.
- The goal is **BUILD COMPLETION**, not proving completion.
- **Verify before claiming.** This owner consistently asks for the *actual* check to be run — a live server, a container, an official pricing page — rather than a reasoned assertion. Several real defects were caught only because of it (§5).
- **Show the cheap option before spending.** Standing: before any paid infrastructure, present the current verified cost *and* the free alternative.

**Escalate only for genuine forks** — decisions where proceeding under any assumption would be wrong.

---

## 3. Where the project is

**Sprint 5 of seven (Sprint 0 → Sprint 6).** Sprint 4 is closed. Sprint 5 is most of the way through its deliverable list.

| Milestone | State |
|---|---|
| **M-13** Export | **Complete.** Markdown + PDF, one shared serialiser. PDF via headless Chromium (D-43) |
| **M-14** Degradation | **Complete** |
| **M-15** Auth + history | **Complete**, all 7 phases, verified against a live server |
| **M-16** Instrumentation | **Complete.** 7 automatable metrics report real values; M-6/M-8/M-9 stay manual |
| **M-17** Accessibility | **Implemented, NOT verified.** 4 violations fixed, axe running. The manual WCAG walk is unwalked |
| **M-18** Security | **Reviewed, NOT passed.** `NFR-027` found and fixed; `DB §13.1` app-level encryption unresolved |
| **M-19** Deployment | **All 4 phases built, milestone NOT passed.** Nothing is deployed. See §7 |
| **M-20** Performance | **Measured and written up, milestone NOT passed.** `NFR-003`/`004`/`005` pass; `NFR-001`/`NFR-002` are **UNMEASURED** and that is M-20's own criterion. D-58 defines the bar. See §7a |

### Sprint 5 deliverables still outstanding

⚠️ **All five remaining items need a human, a host, or an authorisation. NONE is code.**

- **A production host and domain** — M-19 cannot close without one, and neither can TLS, the rollback drill, or a restore drill against real data. **M-20's free path to `NFR-001`/`NFR-002` also runs through it.** Owner's to provision.
- **An AWS account** for KMS — 4 skipped tests are the only thing that can verify `DB §13.1` row 3. Owner's, taken, not yet done.
- **~$8 of provider spend, or an explicit decline** — the other way `M-20` closes (D-58 §4). A decision, not a task.
- **M-17 manual WCAG walk** — needs a person with a screen reader. Unowned.
- **M-08 rubric review** — needs a human reviewer. Unowned, carried from Sprint 2.

✅ Data policy page (`NFR-031`) and alerting (`NFR-082`, `NFR-085`) are done — Phase 4.

---

## 4. Decision records — the numbering

`docs/12` holds D-1 … D-37. Everything after is a standalone file:

| Record | Subject |
|---|---|
| `docs/13`–`docs/17` | D-38 … D-42 — architecture unknowns, D-37 amendment, workflow mapping, anonymous export, export response contract |
| `docs/18` **D-43** | PDF via `playwright-core` + system browser |
| `docs/19`–`docs/21` | D-44 refresh-token table · D-45 anonymous expiry + the 22 exempt legacy rows · D-46 in-memory rate limiting |
| `docs/22`–`docs/24` | D-47 provisional rate limits · D-48 operator auth · D-49 accessibility verification |
| `docs/25` **D-50** | Single instance, no staging |
| `docs/26` **D-51** | Self-hosted PostgreSQL; `DBQ-7` resolved at **7 days** |
| `docs/27` **D-52** | Managed KMS (AWS), envelope encryption |
| `docs/28` **D-53** | Both encryption layers, told apart; closes `DBQ-8` |
| `docs/29` **D-54** | The edge — same-origin serving, proxy trust, IP-hash salt |
| `docs/30` **D-55** | Envelope format, the purge outbox, and the mixed backfill window |
| `docs/31` **D-56** | Monitoring, alerting, and what a drill must produce to count |
| `docs/32` **D-57** | Rollback across a data-format change — the sealed rename and the startup guard |
| `docs/33` **D-58** | What "representative load" means, and what `M-20` can therefore claim |
| `docs/34` **D-59** | AWS credential injection on a non-EC2 host — the Hostinger VPS, two scoped IAM principals, the mounted credentials file |

**Numbering convention: the next standalone record is `docs/35` D-60.** Nothing is currently owed.

---

## 5. Lessons that cost real time — do not re-learn these

These are the defects that *passed every test* before being caught. They are the reason §2 says verify.

- **`chromiumSandbox` defaults to `false` in Playwright.** Removing `--no-sandbox` from `args` is a **no-op** — Playwright injects the flag itself. The container built, ran non-root, rendered a valid PDF, and the sandbox was still off. `chromiumSandbox: true` is the fix. Caught only by a differential (render with vs without the seccomp profile).
- **`marked` has two HTML paths.** Overriding `renderer.html` closes *block* HTML and leaves *inline* `<img onerror>` live, because inline HTML comes from a separate **tokenizer**. A renderer-only fix looks complete.
- **axe on `file://` silently tests nothing.** Vite's absolute `/assets/` paths resolve to filesystem root, so the bundle never loads and axe reports 0 violations on an empty page. Serve over HTTP and assert `results.passes.length > 0`.
- **`NFR-021` ≠ application-level encryption.** `NFR-021` is *"encrypted at rest"* → `DB §13.1` maps it to **full-volume**. The application-level row carries **no NFR number**. The M-18 review conflated them; D-53 §1 splits them.
- **Reading a row without selecting a field makes it `undefined`, not `null`.** An ownership guard using `=== null` failed open/closed wrongly. Fix the *fixtures*, never loosen the guard — "not selected" must never read as "unowned".
- **Bash heredocs mangle backticks and regex backslashes.** Use the Write/Edit tools for anything containing them; several patches were silently corrupted this way.
- **The production image could not start the app, and every test was green.** Prisma 7 emits `.ts` import specifiers and this project compiles with `verbatimModuleSyntax`, so `dist/generated/prisma/client.js` imported `./enums.ts` and `node dist/index.js` died with `ERR_MODULE_NOT_FOUND` before one line of application code. Invisible because `dev`, `test` and every CLI script run through **tsx**, which resolves `.ts` happily — only `npm start` and the container's `CMD` take that path. **Phase 1 verified PDF rendering and the migration paths inside this very image and still never ran its entrypoint.** Fixed with `importFileExtension = "js"` on both generators. If you change anything in the build, run the compiled output, not the source.
- **Caddy sorts directives by its own order, not file order.** `handle` outranks a bare `respond`, so `respond @internal 404` written outside a `handle` block never ran — the catch-all `handle` matched first, was terminal, and served `index.html` with a **200** from `/internal/metrics`. It reads correctly top-to-bottom. Put every mutually-exclusive case in a `handle` block.
- **Grepping a Vite bundle for the fallback string reports failure on a correct build.** `import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:3000"` compiles to a member read on an inlined object, so the default **stays in the output as text** even when the override worked. What discriminates is whether the inlined object *defines the key*.
- **A schema-compatibility check cannot see a DATA-FORMAT change, and `SA §9.3` only asks for the former** (D-57). The pre-encryption build started against the current schema, passed its health check, and served every user a base64 envelope where their document should be — **without erroring**, because the Phase 3 migration was perfectly additive and the schema rolled back fine. ⚠️ **Fixed in Phase 4a:** the sealed columns were renamed so old builds get `42703 undefined_column` instead of ciphertext, and a `data_format` version now refuses startup when the data is newer than the build. The general lesson stands — **when the meaning of stored bytes changes, rename the column**; a purely additive migration is exactly what makes the misread silent.
- **`set -euo pipefail` kills a script inside a command substitution BEFORE it can print its own diagnostic.** Two defects in `restore-drill.sh` had this shape — the primary-only-backup case exited 2 with no output at all, on exactly the failure it was written to report clearly. Add `|| true` to any substitution whose failure you intend to *handle*.
- **A benchmark against an endpoint you are not authorised for measures the 401.** `GET /analyses` requires a user, so an unauthenticated request is rejected **before reaching the query** — the first version of `bench.ts` printed confident sub-millisecond numbers for history search that measured the authorization rejection, not the decrypt path. It looked entirely plausible. ⚠️ **Check the status code a measured request actually returns before believing its timing.**
- **⚠️ `claude-sonnet-5` WAS TRIED AND REJECTED — do not retry it without reading the finding first.** 3 live runs, $0.2122, **0 of 3 completed, 3 of 3 failed schema validation**, each at a different point. The decisive result: **the same input run twice failed at the same stage with two different errors.** Sonnet 5 removed sampling parameters, so `temperature: 0` cannot be sent and `AI §10.2`'s low-variance degradation applies to every call — `FR-024` reproducibility loss, measured rather than predicted. **Cost was not the problem** (output tokens were flat or lower than Sonnet 4.5; ~$0.23 projected per complete analysis). ⚠️ **The comparison is uncontrolled** — Sonnet 4.5 was never given the same inputs, so "Sonnet 5 is worse at schema conformance" is *not* claimed. Full record: `STATUS.md` → *Sonnet 5 Pilot — Attempted and Rejected*. The indicated lever is `output_config.format` (structured outputs), **not adopted**.
- **A health endpoint with no probes wired answers 503 faster than a healthy one answers 200.** `buildApp` leaves `checkProvider`/`checkTemplates` undefined unless they are passed, and `probe()` then returns `unavailable` **without doing any work** — so `GET /health` returned **503 in 0.4ms** and the benchmark published it as a comfortable `NFR-003` pass. It was the cost of declining to check anything. Same shape as the 401 above, wearing a different status code, and **an earlier version of this handoff quoted the number.** ⚠️ The general lesson: **a rejected or short-circuited request still produces a timing, and a fast, plausible one.** `bench.ts`'s `measure()` now takes the HTTP status a measurement must receive and throws during warmup otherwise — verified by differential. The health defect surfaced within seconds of that guard existing.
- **Timing a sub-microsecond operation per call measures the clock, not the code.** Timing each `seal()` individually printed `0.0ms` — which reads like a result and is really `performance.now()`'s resolution. Aggregate over many iterations and divide; report µs.
- **An alert on a misspelled series never fires, and Prometheus never says so.** It evaluates to an empty vector, indistinguishable from "the condition is not met". `naigx_full_analysis_p95` vs `naigx_full_analysis_latency_p95` cost exactly that; `tests/unit/alert-rules.test.ts` now checks the rules against the renderer's real output.
- **`request.ip` is meaningless until proxy trust is decided, and both defaults are wrong** (D-54 §4). Off behind a proxy → one global rate-limit bucket for everyone. On without one → `X-Forwarded-For` is client-supplied and the per-IP limit stops existing. Neither announces itself.
- **Encryption code that is subtly wrong still round-trips.** A reused IV round-trips. A truncated tag round-trips. Unauthenticated version metadata round-trips. So a seal/open test proves almost nothing on its own — `tests/unit/envelope.test.ts` is mostly assertions about what a round trip does *not* show, and the same logic applies to any crypto added later.
- **A test that builds the app without a cipher proves nothing about encryption.** `buildApp` defaults to a pass-through cipher so unrelated unit tests need no key. That default silently made the `FR-062` search test pass over plaintext columns production does not have. Suites that touch the three encrypted fields must pass `createTestCipher()` — and the seed data must be sealed too, or the test still runs on plaintext.
- **A half-finished encryption backfill is invisible.** Reads accept plaintext (they must, or the service breaks mid-migration), so an unsealed table behaves exactly like a sealed one. `npm run encrypt:status` is the *only* signal, and `DB §13.1` row 3 is not met until it reports zero.
- **A one-shot compose service that runs `npx tsx` cannot work.** The runtime image prunes dev dependencies and ships no `scripts/` directory. Operational entry points belong in `src/` so they compile into `dist/` — caught before shipping only because the image was actually run.

---

## 6. Architectural decisions — do not re-litigate

- **The NIE never imports persistence or transport** (`AD-02`/`AP-3`, boundary check 2). Stage modules are reachable only through `pipeline.ts` (check 6).
- **Anonymous authorization requires the token, never the id.** `analysisId` alone must never establish ownership. `mayAccessAnalysis` in `src/auth/principal.ts` is the single predicate.
- **Access tokens and refresh tokens are distinct credential classes.** A refresh token must not authenticate a resource route just because it resolves. `resolvePrincipal` never reads `refresh_token`.
- **Operator auth is separable by construction** (D-48). `resolveOperator` reads only the configured secret; there is no role check to get wrong. `/internal/*` accepts nothing else.
- **Mermaid requires a DOM even to parse** (`DOMPurify.addHook is not a function`). This kills every document-library PDF approach.
- **Risk score and band are derived at presentation** from `docs/09` §2, never stored.
- **Rate limiter and trace-purge queue each sit behind one interface** with a single swap point — deliberate, so D-46 and the durable-queue work are implementation swaps.
- **One instance is the sanctioned topology** (D-50). `SA §9.4` already assumed in-process jobs and SSE affinity. This makes D-46's in-memory limiter *correct*, and leaves `NFR-051` explicitly unmet.

---

## 7a. ▶ THE NEXT STEP — M-20 is done and not passed; Sprint 5 is out of code

**M-20 is complete as an increment and open as a milestone.** Both halves are
true at once, and collapsing them in either direction misrepresents it.

### What was done

- `backend/src/ops/bench.ts` + the `bench` script — measures the `API §12.1`
  classes that involve no provider, at four history volumes.
- **[D-58](33-D-58-Representative-Load.md)** — defines "representative load",
  which `Roadmap` M-20 and `AC-020` both required and **no document defined**.
- **[`docs/performance/M-20-LATENCY-LOG.md`](performance/M-20-LATENCY-LOG.md)**
  — the results, the apparatus, and precisely what they do and do not establish.

### The results, and the one that is not a number

Dev machine (Core Ultra 9 275HX, Node 24, Postgres 17.10 in Docker),
`app.inject` — no TLS, no proxy, no network, no concurrency. p50 / p95 in ms:

| Measurement | 10 | 50 | 300 | 1000 | Budget |
|---|---|---|---|---|---|
| `GET /health` (liveness) | 0.1 / 0.2 | 0.1 / 0.1 | 0.0 / 0.1 | 0.0 / 0.0 | 200ms (`NFR-003`) |
| `GET /health` (readiness) | 2.2 / 2.9 | 1.8 / 3.0 | 1.4 / 3.2 | 1.8 / 2.5 | 200ms (`NFR-003`) |
| `GET /analyses/:id` | 3.4 / 4.5 | 3.7 / 5.7 | 2.9 / 5.2 | 3.0 / 6.7 | 200ms (`NFR-003`) |
| Listing (no search) | 2.1 / 3.3 | 2.0 / 3.2 | 1.6 / 2.9 | 1.7 / 2.1 | 1s (`NFR-004`) |
| **Search** | 2.5 / 3.5 | 5.2 / 8.0 | 13.5 / 16.1 | **75.1 / 80.9** | 1s (`NFR-004`) |
| `POST /analyses` → 202 | 4.5 / 6.0 | 5.8 / 10.0 | 4.0 / 5.1 | 3.9 / 4.3 | 500ms |
| `renderPdf` export | — | — | — | 1358.7 / 1540.5 | 10s (`NFR-005`) |

Envelope: **seal 24–28µs, open 21–24µs** per value (n=20,000). ✅
[D-53](28-D-53-Encryption-Layers.md) §4's *"AES-GCM decryption is microseconds
per row"* — the assumption it accepted an `O(n)` search on — **holds, measured.**

⚠️ **`NFR-001` and `NFR-002` are UNMEASURED, and they are M-20's entire
criterion.** Both are dominated by model provider latency; every run is replay
mode, where the adapter answers instantly from a fixture. A replay number
therefore measures this system's overhead and **nothing** about either target.
**Publishing one beside `NFR-001` would be a measurement of the wrong thing, in
the right units, next to the right requirement.** Do not do it, and do not let
the three passing requirements stand in for the two that are not.

`M-20` closes when **either** provider spend is authorised (~$8 for a 30-run
p50/p95 sample, from the one real cost datum of $0.2732) **or** production
traffic exists and `M-16`'s instrumentation reports the two latencies. The
second is free and better evidence, and it needs the deployment M-19 is already
blocked on. D-58 §4 records both.

### Two findings worth keeping

- **Listing is flat across every volume; search is not** — exactly the shape
  D-53 §4 predicted. At 1,000 analyses search costs ~75µs per row all-in, of
  which ~22µs is decryption.
- **D-53 §4's revisit trigger is now quantified:** one user's search consumes
  the whole 1s `NFR-004` budget somewhere around **10,000–12,000 analyses on
  this machine**. ⚠️ An extrapolation from four points on a dev laptop, never a
  production limit — and the last segment is the steepest, so the linear
  reading is the optimistic one.

### ⚠️ TWO MEASUREMENT DEFECTS WERE CAUGHT HERE — same shape, both plausible

**A rejected request still produces a timing, and a fast one.**

1. **Listing and search were measured unauthenticated.** `GET /analyses`
   requires a user, so the requests `401`d before reaching the query and the
   run printed confident sub-millisecond numbers for the decrypt path. Fixed by
   registering a real account and sending a bearer token.
2. **`GET /health` was measured with no readiness probes wired.** `buildApp`
   leaves `checkProvider`/`checkTemplates` undefined unless passed, `probe()`
   returns `unavailable` without doing any work, and the endpoint answered
   **503 in 0.4ms** — the cost of declining to check anything, published as an
   excellent `NFR-003` result. **The earlier version of this handoff quoted
   that number.**

The second was found within seconds of fixing the first, because the fix was a
**status-code assertion**: `measure()` now takes the HTTP status a measurement
must receive and throws during warmup otherwise. Verified by differential — a
deliberately wrong expectation aborts the run with `expected HTTP 999, got 503`
before any number prints.

⚠️ **If you add any measurement, declare its expected status.** This
benchmark's output is not self-validating and never looks wrong.

Readiness is now measured with production's real `checkTemplates` probe (a
fragment resolve — actual database work). `checkProvider` is stubbed, which is
faithful rather than convenient: production's probe is a *configuration* check
with no I/O, because a readiness endpoint is polled continuously.

### ▶ SPRINT 5 HAS NO REMAINING CODE INCREMENT

**Recorded as the state of the sprint, on the owner's instruction, 2026-09-08.**
This is the real handoff. ⚠️ **Resist inventing a code task.** Every remaining
item is an external or evidence dependency, and each one discharges exactly one
thing — kept separate deliberately, because collapsing them is how a milestone
gets reported as passed on the strength of a different dependency being met:

| Dependency | Discharges | Owner |
|---|---|---|
| **Host / domain** | **M-19** deployment verification — and with it TLS (`NFR-020`), the rollback drill, a restore drill on real data, off-host backups, alert delivery to a real person | Owner, to provision |
| **AWS KMS credentials + key** | **Real encryption verification** — `DB §13.1` row 3, closing `M-18` H-2. The 4 skipped tests are the only thing that can do it | Owner, taken, not done |
| **Optional provider spend (~$8)** | **M-20 provider metrics** — `NFR-001`/`NFR-002`. ⚠️ **Optional.** Declining is a complete answer and folds into the host | Owner's decision |
| **A human reviewer** | **M-08** rubric review. Carried from Sprint 2 | Unowned |
| **A screen-reader / keyboard reviewer** | **M-17** manual WCAG walk | Unowned |

⚠️ **These do not substitute for one another.** A host does not verify KMS; KMS
does not measure latency; neither discharges a human review.

**The owner is deciding what to provision next.** Do not pre-empt that with
work, and do not re-open it as a question each session.

### Constraints on M-20, from the owner — still current

- Keep M-20 to the **defined** performance requirements and the measurement
  methodology.
- **Do not use development sample sizes to imply production performance.**
- **Do not add infrastructure merely to manufacture production-like results** —
  no load-generator cluster, no synthetic traffic tier. `app.inject` plus a
  local Postgres is the whole apparatus, deliberately.

---

## 7. WHERE M-19 STANDS — all four phases built, milestone NOT passed

**Four phases, owner-approved, all four committed.** ⚠️ Built is not deployed: see the gap table below Phase 4 before reporting anything about M-19.

**The next step is a decision, not a task.** M-19 cannot close without a host and a domain — that is the owner's to provision, along with the AWS account Phase 3 needs. Until then the remaining M-19 work is unearnable. **M-20 is where work is actually happening — see §7a, above this section.**

⚠️ **THE ONE THING CARRIED INTO PHASE 4 FROM PHASE 3:** the KMS prerequisite is
the owner's and they have taken it, but **no credentials exist yet**, so the
encryption layer is implemented and unverified. When the AWS account exists:

```bash
NAIGX_KMS_LIVE_TEST=1 NAIGX_KMS_KEY_ID=alias/naigx NAIGX_KMS_REGION=<region> npm test
```

Four skipped tests must turn green. Until then, do **not** report `DB §13.1`
row 3 as satisfied, and do not close `M-18` H-2. Re-read the official pricing
page before creating the key — the figures in D-52 §3 were re-verified on
2026-09-08 and are an estimate on their date, not a guarantee.

### ✅ Phase 1 — containerisation, non-root, Linux Chromium *(done)*

`backend/Dockerfile` (non-root uid 1000, distribution Chromium), `backend/.dockerignore`, `deploy/seccomp/chromium.json` + README, `chromiumSandbox: true`, and a source-level regression guard that was **verified to fail** when flipped.

Verified in-container: PDF renders non-root with the sandbox on (36,676 bytes, `%PDF-`), and **fails without the profile** — that differential is the proof. Both Prisma migration paths load post-prune. Image is **2.04 GB**, almost all Chromium.

### ✅ Phase 2 — TLS, same-origin edge, configurable host/port *(done)*

Recorded as **[D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md)**. Deploy guide: **[`deploy/README.md`](../deploy/README.md)**.

`deploy/Caddyfile`, `deploy/Dockerfile.edge` (Caddy + the built client), `docker-compose.prod.yml`, `deploy/.env.example`, root `.dockerignore`. `HOST`/`TRUST_PROXY`/`NAIGX_IP_HASH_SECRET` are configuration; the seccomp profile is wired via `security_opt`.

**Verified** against the built images with a stub backend over HTTP: API paths proxy, SPA fallback serves, `/internal/metrics` 404s **and never reaches the backend**, HSTS + `nosniff` + `DENY` + referrer-policy present, and SSE streams incrementally (lines at **467/846/1249 ms**, matching the origin — no proxy buffering). `trustProxy` proved by differential.

⚠️ **TLS itself is UNVERIFIED.** No certificate has ever been issued by this config — ACME needs a public domain and DNS that do not exist yet. Everything *beneath* TLS is verified; the TLS layer is not. Do not report `NFR-020` as verified until the first real deploy.

**Three defects this phase caught — all had passed a plausible check first.** See §5.

### ✅ Phase 3 — encryption + durable purge queue *(done)*

Recorded as **[D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md)**, implementing D-52/D-53.

**Encryption.** `src/crypto/` — AES-256-GCM envelope (`naigx.v1.<version>.<iv>.<tag>.<ct>`), a two-method `KeyProvider`, an AWS KMS adapter, an offline double, and a multi-version key ring. Sealed at three boundaries only: `routes/analyses.ts` writes `raw_content`, `db/stage-trace-sink.ts` writes both `structured_*`, and nothing else touches those columns. Opened in `execute-analysis.ts`, the `FR-062` search, and the `API-014` export. The key ring loads at startup and the process **refuses to start** if KMS is unreachable.

**Search.** Decrypt-and-filter per D-53 §4 — and **proved by differential**: restoring the old SQL `contains` predicate makes the `FR-062` test fail with a silently empty page, which is exactly the failure D-53 predicted.

**Purge queue.** `trace_purge_outbox` in the **primary** store, written in the *same transaction* as the deletion (all three delete routes in `history.ts` now use `$transaction`). `enqueue` became async and takes that transaction — same interface, same single swap point, **no API contract change**.

**Backfill.** `npm run encrypt:{init,status,backfill}` (`src/ops/encrypt.ts`, compiled — the runtime image has no `tsx`). Verified against the real dev database: 3 inputs + 368 stage traces sealed, re-read correctly, idempotent on a second run, `status` reports zero plaintext.

⚠️ **KMS IS UNVERIFIED.** `providers/aws-kms.ts` has never made a real call. Everything else is proved against the offline double — evidence about the *interface*, none about the *service*. `tests/integration/kms-live.test.ts` is the only thing that discharges it, and it **skips**. `DB §13.1` row 3 is *implemented, not verified*; **`M-18` H-2 stays open** (D-53 §6: it closes when both layers are deployed and verified, not when code merges).

**Pricing re-verified** 2026-09-08 against the official page: $1/month per key, 20,000 free requests — unchanged from D-52 §3. One nuance recorded: the free tier excludes asymmetric and `GenerateDataKeyPair` operations, and this design uses neither.

### ✅ Phase 4 — monitoring, alerting, drills, data policy *(built)*

Recorded as **[D-56](31-D-56-Monitoring-Alerting-And-The-Drills.md)**.

`deploy/monitoring/` (Prometheus + Alertmanager + 8 rules), `deploy/backup.sh`, `deploy/restore-drill.sh`, `frontend/src/components/DataPolicy.tsx`, four operational metrics, and compose services for all of it.

**Verified end to end** (2026-09-07): `promtool`/`amtool` accept the configs; Prometheus scraped `/internal/metrics` with the operator bearer token (`health: up`); every series an alert references resolved against live data; `CompletionRateBelowTarget` entered `pending` with its message rendered — *"Analysis completion rate 50% is below the NFR-010 target of 95%"*; and a test alert was **delivered to a webhook receiver** through Alertmanager. `NFR-031` reachability and the policy's numbers are asserted by an automated check, plus axe.

**Restore drill PERFORMED and recorded** — [RESTORE-DRILL-LOG](deployment/RESTORE-DRILL-LOG.md). Both databases restored into scratch, 8 table row counts matched, one analysis spot-checked with its envelope intact. ⚠️ **Development database, not production.**

### ⚠️ M-19 IS NOT PASSED, AND THIS IS THE IMPORTANT PART

Its criterion is **"production deploy with monitoring, alerting, and verified rollback"**. All four phases are *built*; **nothing is deployed anywhere**.

| Gap | Why it is open |
|---|---|
| **No production deployment** | No host, no domain. Everything below follows from this |
| **Rollback drill NOT done** | D-50 §4 requires it *on production*. Only rehearsed. ✅ The blocker it surfaced is **fixed** (D-57) — a rollback past the encryption boundary now fails loudly instead of serving envelopes — but the drill itself is unattempted: [ROLLBACK-DRILL-LOG](deployment/ROLLBACK-DRILL-LOG.md) |
| **Restore drill was on dev data** | Mechanism proven; D-51 §4's obligation needs a real backup of deployed data |
| **Off-host backup storage** | A property of where `NAIGX_BACKUP_DIR` points. No script can check it |
| **TLS unverified** | No certificate has ever been issued (Phase 2) |
| **KMS unverified** | 4 skipped tests; no credentials (Phase 3) |
| **Alert delivery to a real person** | Verified as a mechanism. Alertmanager starts happily with an unreachable receiver — a first-deploy check |

### ✅ Phase 4a — the rollback/encryption incompatibility, fixed *(done)*

Recorded as **[D-57](32-D-57-Rollback-Across-A-Data-Format-Change.md)**. The rehearsal's finding was that a pre-encryption build starts, passes its health check, and hands every user a base64 envelope **without erroring** — and `SA §9.3` could not catch it, because the schema rolled back perfectly and only the *meaning of the bytes* had changed.

Two mechanisms, because neither covers both directions:

1. **The sealed columns were renamed** — `raw_content_sealed`, `structured_input_sealed`, `structured_output_sealed`. Builds that already exist cannot be changed, so the data is unreachable under the name they ask for. **Verified**: the Phase 2 image now gets `The column analysis_input.raw_content does not exist` on both stores. Application code untouched — only Prisma ``.
2. **A `data_format` version checked at startup**, for builds that do not exist yet. **Verified**: stored version 3 against this build produces `DataFormatTooNewError` and a non-zero exit, before a single request.

⚠️ **The deployable floor is now the first build that reads `*_sealed`.** Rolling back past it fails visibly. That is the correct trade — fail instead of lie — and it is a real constraint on release planning.

⚠️ **This unblocks attempting the drill. It does not perform one.**

---

## 8. Standing constraints — every one is current

| Constraint | Source |
|---|---|
| **No provider spend, no live capture.** Replay mode is default and free. | Owner, repeatedly |
| **Prompt fragments stay inactive.** | **D-39** |
| **No M-08 packet review, no rubric verdicts.** AI review excluded "in any capacity, for any criterion". | `docs/10` §4.3 |
| **Do not implement `platform_recommendation`** / expand `business_requirement`. | Owner, explicit |
| **No frontend test infrastructure (no Vitest).** axe runs under `node:test`, which is not an exception to this. | Owner, explicit |
| **No unrelated Sprint 3/4 rework.** | Owner, explicit |
| **Do not close `NFR-021`/`DB §13.1` with a key in `.env` or OpenBao.** Two gates enforce this in code; do not remove either. | **D-52** §4, owner explicit |
| **`DB §13.1` row 3 is implemented, NOT verified.** KMS has never been called. 4 skipped tests are the only thing that can discharge it. | **D-55** §9, owner explicit |
| **Do not implement `API-071`/`072`/`073`.** Operator auth existing is not a licence. | **D-48** §5 |
| **M-17 is not passed on a green axe run**; the manual walk is required. | **D-49** §3.3 |
| **M-18 is not passed**, and must not be described as an independent review. | Owner, explicit |
| **`M-20` stays NOT PASSED. `NFR-001`/`NFR-002` stay explicitly UNMEASURED** unless provider spend is authorised. | Owner, explicit, 2026-09-08 |
| **Never substitute replay latency for a provider-dominated metric.** Replay numbers describe this system's overhead and nothing else. | Owner, explicit, 2026-09-08 |
| **Make no implementation change whose purpose is to manufacture M-20 evidence.** | Owner, explicit, 2026-09-08 |
| **Keep the `bench.ts` status-code assertion.** It is a regression guard, not scaffolding — it is what exposed `/health` answering 503. Do not remove or weaken it. | Owner, explicit, 2026-09-08 |
| **No further decision records** unless a choice changes **architecture, requirements, security, cost, or deployment policy**. D-58 qualified; most things will not. | Owner, explicit, 2026-09-08 |
| **Stop adding scope.** The next move is provisioning, and it is the owner's to choose. | Owner, explicit, 2026-09-08 |

---

## 9. Verification — run all of these

⚠️ **Everything below is green as of 2026-09-08, with the M-20 work committed
and the tree clean.** `npm run bench` is NOT part of this gate — it seeds and
deletes rows and takes a couple of minutes.

```bash
# backend (from backend/)
npm test              # 897 tests, 891 pass, 0 fail, 6 skipped
npm run typecheck
npm run lint
npm run format:check
npm run fragments:check   # 15 fragments match the manifest
npm run schemas:check     # 5 artifact schemas published and matching

# M-20 latency measurement (needs Docker + the dev databases). NOT part of the
# test gate — it seeds and deletes rows, and takes a couple of minutes.
npm run bench             # default volumes 10 / 50 / 300
npm run bench -- 1000     # larger sweep; the search curve only shows at volume
# Results and caveats: docs/performance/M-20-LATENCY-LOG.md. ⚠️ Every HTTP
# measurement declares the status code it must receive; a run that aborts with
# "expected HTTP x, got y" has caught a measurement of the wrong code path.

# frontend (from frontend/)  — NOTE: there is no `typecheck` script here
npm run lint && npm run build

# repo root
node tools/boundary-checks/check.mjs   # 8 enforcing · 0 failing
```

**The 6 skips are 2 live-provider tests** (`LIVE_PROVIDER_TESTS=1` + a key, which must stay skipped under the no-spend constraint) **and 4 live-KMS tests** (`NAIGX_KMS_LIVE_TEST=1` + real credentials). ⚠️ The KMS four are the only evidence that the real key service works, and while they skip, `DB §13.1` row 3 is implemented but UNVERIFIED.

**Docker must be running** or the Postgres-backed and browser-backed suites skip. A skip means *not checked*, never *passed* — if the skip count rises above 2, start Docker before reading the result.

**Container checks (Phases 1–3):**

⚠️ The differential must call **`renderPdf`, not `findBrowser`**. `findBrowser`
only locates the binary and **succeeds without the profile too** — it cannot
tell you the sandbox is engaged. (An earlier version of this section named
`findBrowser`; that was not the differential it claimed to be.)

```bash
cd backend && docker build -t naigx-backend:m19p2 .

R="import('/app/dist/export/pdf.js').then(m=>m.renderPdf('<h1>x</h1>',\
{executablePath:'/usr/bin/chromium'})).then(b=>console.log('RENDERED',b.length))\
.catch(e=>console.log('FAILED:',e.message))"

# WITH the profile → RENDERED (~11 KB, %PDF-).  WITHOUT it → FAILED.
docker run --rm --security-opt seccomp=<abs>/deploy/seccomp/chromium.json \
  naigx-backend:m19p2 node -e "$R"
docker run --rm naigx-backend:m19p2 node -e "$R"

# Phase 2 — the image must actually START. Refuses without the salt; gets past
# config to a database error with it. Both halves matter.
docker run --rm -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://u:p@h:5432/naigx \
  -e TRACE_DATABASE_URL=postgresql://u:p@h:5432/naigx_trace \
  naigx-backend:m19p2 node dist/index.js     # → NAIGX_IP_HASH_SECRET required

# Edge image: builds only if the client is same-origin and the Caddyfile parses.
docker build -f deploy/Dockerfile.edge -t naigx-edge:m19p2 .
docker compose -f docker-compose.prod.yml --env-file deploy/.env config
```
In Git Bash set `MSYS_NO_PATHCONV=1` or paths get rewritten to `C:/Program Files/Git/...`.

---

## 10. Git state

✅ **The working tree is clean.** The M-20 work is committed.

**Branch `main`.** Recent:

| Commit | What |
|---|---|
| `6af9c11` | **M-20 performance** — `bench.ts` with status assertions, D-58, the latency log |
| `b569b25` | Record the Phase 4a commit in the handoff's git-state table |
| `1c0a86c` | M-19 Phase 4a — sealed column rename + data-format startup guard, D-57 |
| `7c0f7e2` | M-19 Phase 4 — monitoring, alerting, restore drill, data policy, D-56 |
| `a7d06c2` | M-19 Phase 3 — application-level encryption, durable purge outbox, D-55 |
| `d7fd2e0` | M-19 Phase 2 — TLS edge, same-origin client, proxy trust, IP-hash salt, D-54 |
| `54ac225` | M-19 Phase 1 — containerise, non-root, sandbox actually enabled |
| `ef90788` | M-19 decisions D-50 … D-53 + the M-18 mislabel correction |
| `07d5a55` | M-18 security review |
| `4b138ba` | M-17 accessibility |

---

## 11. Document map

| File | What it is |
|---|---|
| `docs/STATUS.md` | **Authoritative current state.** Wins on *current state* — not on requirements |
| `docs/02-PRD` | `FR-*`, `NFR-*`, `TC-*`, `AC-*` |
| `docs/04-SA` | System architecture. **§9 is deployment**, §10 security, `AQ-*` |
| `docs/05-AI` | Stage definitions; **§7.1 is the reasoning-module table** |
| `docs/06-DB` | Schema. **§8.3 retention · §13 security/classification · `DBQ-*`** |
| `docs/07-API` | `API-*` contracts, §7.x semantics, §9.x errors, `APIQ-*` |
| `docs/08` | Engineering roadmap — sprints, milestones, exit criteria |
| `docs/09` | Scoring scales — §2 risk severity/likelihood/bands |
| `docs/10` | Reasoning quality rubric (**§4.3 excludes AI review**) |
| `docs/12` | Decision records D-1 … D-37 |
| `docs/13`–`docs/29` | D-38 … D-54, standalone |
| `deploy/README.md` | **How to deploy, what is verified, and what is not** |
| `docs/accessibility/WCAG-AA-CHECKLIST.md` | The manual M-17 walk. **Result table is empty** |
| `docs/security/M-18-SECURITY-REVIEW.md` | The M-18 review, with its H-2 correction visible |
| `deploy/seccomp/README.md` | Why the seccomp profile exists and what it trades |
| `docs/deployment/RESTORE-DRILL-LOG.md` | The restore drill — **passed on dev data**, production outstanding |
| `docs/deployment/ROLLBACK-DRILL-LOG.md` | The rollback drill — **not attempted**; the incompatibility it found, and the fix |
| `docs/33-D-58-Representative-Load.md` | What "representative load" means, and why `M-20` cannot pass on replay numbers |
| `docs/performance/M-20-LATENCY-LOG.md` | The M-20 measurements — **`NFR-003`/`004`/`005` pass, `NFR-001`/`002` unmeasured** |
| `backend/src/ops/bench.ts` | M-20 latency measurement; its header states what it cannot measure, and every HTTP measurement declares its expected status |
