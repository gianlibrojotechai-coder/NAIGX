# NAIGX — Session Handoff

**Written:** 2026-09-08 · **Last updated:** 2026-09-09
**Purpose:** hand a new chat session everything it needs to continue building NAIGX without re-deriving context or re-litigating settled decisions.

> **Read this first, then `docs/STATUS.md`.** STATUS.md is the authoritative current-state record. This file covers the most recent working sessions, and the exact next step.
>
> ⚠️ **Start at §7a — it has changed completely.** NAIGX **is deployed.** `https://naigx.tech` serves the client over a real Let's Encrypt certificate, six containers are up on the Hostinger VPS, and the host/domain dependency that blocked all of Sprint 5 is **discharged**.
>
> ⚠️ **The backend is deployed and NOT READY.** `GET /health` answers **503** with `templates: unavailable` and `provider: unavailable`. One is a gate working correctly (no fragments are published). The other is because **the running container is built from an older commit than `main`** — it predates D-62 and answers with the wrong branch's error. §7a has the whole picture, and that discrepancy is the first thing to check before diagnosing anything in production.
>
> ⚠️ **There IS a code increment again**, which reverses the previous edition of this file. But the thing standing between NAIGX and a ready instance is **the fragment activation gate**, and the gate is correct. Do not weaken it, do not bypass it, do not manufacture a pass reference. §7a explains exactly what it wants.

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
| **M-18** Security | **Reviewed, NOT passed.** `NFR-027` found and fixed; `DB §13.1` app-level encryption implemented against a **host-held key file** (D-61 retired AWS KMS). ✅ Its key-file **fail-closed mechanism is now verified on the VPS** (D-61 §8) — H-2 and the milestone still open |
| **M-19** Deployment | **Deployed and running at `https://naigx.tech`; milestone NOT passed.** TLS is now **verified**. The instance is **not ready** — see §7a and the §7 gap table |
| **M-20** Performance | **Measured and written up, milestone NOT passed.** `NFR-003`/`004`/`005` pass; `NFR-001`/`NFR-002` are **UNMEASURED** and that is M-20's own criterion. D-58 defines the bar. See §7b |

### Sprint 5 deliverables still outstanding

✅ **DISCHARGED since the last edition:** the production host and domain (Hostinger VPS + `naigx.tech`), TLS (`NFR-020` — a real Let's Encrypt certificate, issued 2026-09-08, valid to 2026-12-07), and the AWS account, which **no longer exists as a dependency at all** — D-61 replaced managed KMS with a host-held key file, and `tests/integration/kms-live.test.ts` was deleted rather than left skipping.

⚠️ **What remains — the first three are code, which reverses the previous edition's "no remaining code increment":**

- **▶ Redeploy the backend.** The running container predates `ca2bb8b` — no D-62, no fragment publisher, no D-63. Everything below assumes a current build; **do this first or the other work cannot be observed.**
- **▶ Fragment activation for the production database** — *code and evidence.* The production DB holds **zero** prompt fragments, so readiness fails. Publishing them requires a regression pass reference that covers them, and **6 of 15 fragments are not covered by any committed recording**. This is §7a and it is where the work is.
- **`REPLAY_FIXTURES` is a hardcoded empty object** at `backend/src/index.ts:79`. Readiness in replay mode cannot pass until something real loads into it (D-62). ⚠️ **NOT independent and not startable yet** — it is strictly *downstream* of fragment publication and additionally needs a compose mount. The previous edition's "small, genuine, unstarted" was wrong on the first two words; see §7a.
- **A production rollback drill** — needs a deployed instance, which now exists. Newly *possible*, still undone.
- **A restore drill against production data** — the mechanism is proven on dev data; backups are running on the host.
- **Off-host backup storage** — `rclone` is installed with a `gdrive:` remote configured, but the remote is **empty** and the automated cycle does not upload. Encryption-before-upload exists; the upload leg does not run.
- **~$8 of provider spend, or an explicit decline** — the other way `M-20` closes (D-58 §4). A decision, not a task. Now also reachable free, via production traffic.
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
| `docs/27` **D-52** | Managed KMS (AWS), envelope encryption — ⚠️ **the key-service half is superseded by D-61**; envelope encryption stands |
| `docs/28` **D-53** | Both encryption layers, told apart; closes `DBQ-8` |
| `docs/29` **D-54** | The edge — same-origin serving, proxy trust, IP-hash salt |
| `docs/30` **D-55** | Envelope format, the purge outbox, and the mixed backfill window |
| `docs/31` **D-56** | Monitoring, alerting, and what a drill must produce to count |
| `docs/32` **D-57** | Rollback across a data-format change — the sealed rename and the startup guard |
| `docs/33` **D-58** | What "representative load" means, and what `M-20` can therefore claim |
| `docs/34` **D-59** | AWS credential injection on a non-EC2 host — ⚠️ **RETIRED by D-61.** Kept for the reasoning, not as a live design |
| `docs/35` **D-60** | The shared Traefik edge — NAIGX routes through the host's existing n8n Traefik rather than binding 80/443 |
| `docs/36` **D-61** | **A host-held key file replaces managed KMS for v1.0.** Removed the AWS dependency, the SDK, and the 4 skipped live-KMS tests entirely |
| `docs/37` **D-62** | Mode-aware `API-060` readiness — replay is a valid execution mode, and a replay instance with no recordings is **not** ready |
| `docs/38` **D-63** | Regression evidence composes against **authored** fragments, breaking the publish/evidence circularity — **plus the §7 amendment**, which is the load-bearing half |

**Numbering convention: the next standalone record is `docs/39` D-64.** Nothing is currently owed.

⚠️ **D-63 without its §7 amendment is actively wrong.** The original decision made the runner re-resolve recordings against authored fragments, which invalidated **10 of 13** committed recordings the moment authored content drifted. The amendment separates **replayability** from **evidential currency**: a recording that carries its own captured composition replays against *that* and is never stale for replay; only the activation gate asks the currency question. Read §7 before touching anything in `src/regression/`.

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
- **⚠️ A DEPLOYED CONTAINER IS NOT THE REPOSITORY, AND ITS ERROR MESSAGES WILL LIE TO YOU ABOUT WHICH CODE IT IS.** `naigx-backend` logged `"mode":"replay"` and then rejected readiness with `"No provider is configured"` — the **live** branch's message, which current `main` cannot produce in replay mode. The instinct is to go debug `resolveExecutionMode`. The actual cause is that the image predates D-62 by several commits. **Confirm the running build before diagnosing its behaviour:** `docker exec naigx-backend grep -c "<a string only the new code has>" /app/dist/index.js`. A container that has been up for hours is evidence about *whenever it was built*, not about `HEAD`.
- **⚠️ A capture CLI and a run CLI that resolve case ids differently will strand paid evidence.** `regression:capture` accepted `--case=<id>` against the whole corpus; `regression:run` selected `FIRST_VERTICAL` unconditionally and had no `--case=` at all. So `ew-001` could be captured — and **was, for $0.1072 of real provider spend** — and then could never be evaluated, because an `existing_workflow` case with no special class is excluded from that vertical *by construction*. Nothing errored. The asymmetry is closed (`289e1e1`) and `tests/unit/corpus-selection.test.ts` guards it. **When two commands name the same thing, check that they mean the same thing.**
- **A run's provenance label must be DERIVED, never stamped.** A re-run was recorded as `fragmentResolution: "authored"` while it had actually replayed 13 legacy recordings through the *active* resolver. The record was restored and the label is now computed from what each recording carried. **A field describing how a run resolved is evidence about the run — it cannot be an argument.**
- **Moving a file into the recording store to silence a drift error destroys the gate.** An unmanifested recording makes `regression:recordings:check` fail with `unmanifested: <case>`. That check is correct: it is the difference between *captured* and *admitted*. Held evidence lives in `research/regression-pending/`, outside the store, which is why `createRecordingStore` cannot see it. **Never `regression:recordings:write` to make a red check green.**
- **Importing a constant from a CLI script executes that script.** `regression.mts` imported `PROMPTS_ROOT` from `fragments.mts`, which runs its own `process.argv` dispatch at module scope — so `regression:capture` was broken on `main` in a way that looked like an unrelated failure. Fixed in `27f1a1e` by resolving the path locally. **A module with top-level side effects is not importable, whatever it exports.**
- **A resolver that throws synchronously breaks a port typed as returning a promise.** `FragmentResolver.resolve` returns `Promise<...>`; an `authored-resolver` that threw before returning escaped every `.catch` in the pipeline. Make it `async`.
- **`assert.throws` returns `void` in Node's types** — it cannot hand you the error to inspect. Capture with `try`/`catch` when you need to assert on fields.
- **Two POSIX permission tests skip on Windows and are the ones that matter in production.** `key-file-provider.test.ts`'s *"FAILS CLOSED when the key file is group-readable / world-readable"* guard D-61's whole security argument, and `process.platform !== "win32"` skips both on the dev machine. They are 2 of the suite's 4 skips. ⚠️ **Run them on the VPS**, or the key file's permission enforcement is asserted by nothing.

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
- **There are three fragment resolvers and they answer three different questions.** `db/fragment-resolver.ts` — what production runs (active published versions). `regression/authored-resolver.ts` — what the repository currently says (`prompts/`), which is what *evidence* composes against (D-63). `regression/pinned-resolver.ts` — what a recording was actually captured with, answering from the recording alone with no database and no filesystem. **Reaching for the wrong one is what invalidated 10 recordings.**
- **Replayability and evidential currency are separate questions** (D-63 §7). A recording carrying its captured composition replays against *that* and is never stale for replay. Whether it still evidences a *newer* candidate composition is the activation gate's question, asked with authored resolution. Conflating them looks like a staleness bug and is really a category error.
- **Captured is not admitted.** The recording store reads `research/regression-recordings/<corpusVersion>/` and only that, and a file there without a manifest entry is a `RecordingIntegrityError`, not evidence. Admission changes what every existing pass reference is sufficient to activate — it is a decision, never a filing step.
- **`--case=` resolves against the whole frozen corpus in both CLIs**, and an unknown id is a hard error rather than a silently smaller run. Filtering a typo down to a subset would run a different suite than the operator asked for *and still issue a reference for it*.

---

## 7a. ▶ THE NEXT STEP — NAIGX is deployed, not ready, and the thing in the way is the activation gate

**Verified on the host, 2026-09-09.** Not inferred from a compose file:

```
naigx-postgres      Up 10 hours (healthy)
naigx-backend       Up  7 hours (UNHEALTHY)
naigx-edge          Up  7 hours
naigx-prometheus    Up  7 hours
naigx-alertmanager  Up  7 hours
naigx-backup        Up  7 hours
n8n-traefik-1       Up  5 weeks      ← the shared edge, D-60
n8n-n8n-1           Up  5 weeks      ← untouched, as required

https://naigx.tech        → 200, ssl_verify_result=0
https://naigx.tech/health → 503
issuer = Let's Encrypt CN=YR1,  notBefore Sep 8 2026,  notAfter Dec 7 2026
```

✅ **`NFR-020` TLS is now verified** — a certificate has actually been issued,
which Phase 2 explicitly could not claim. ✅ The pre-existing n8n stack is
still up, which was D-60's whole constraint.

### Why the backend is unhealthy — two gates, both correct

```json
{"status":"error","database":"connected",
 "dependencies":{"database":"available","provider":"unavailable","templates":"unavailable"}}
```

⚠️ **Neither is a defect. Do not "fix" either by relaxing a check.**

1. **`templates: unavailable`** — `checkTemplates` resolves the four foundation
   fragments from the primary store. **The production database contains zero
   rows in `prompt_fragment`** (verified by `psql` on the host). No fragments,
   no composable prompt, no readiness.
2. **`provider: unavailable`** — ⚠️ **and this one is not what the current
   source says it should be.** The container logs `"mode":"replay"` and then
   rejects with **`"No provider is configured"`**, which is the **live** branch's
   message. On current `main`, replay's rejection reads *"Replay mode is
   configured but no recordings are available…"*. **The deployed build predates
   [D-62](37-D-62-Mode-Aware-Readiness.md)** — confirmed directly:
   `docker exec naigx-backend grep -c "no recordings are available" /app/dist/index.js`
   returns **0**, and `/app/dist/index.js` still carries the old
   credential-in-every-mode `checkProvider`.

⚠️ **THE RUNNING CONTAINER IS NOT BUILT FROM CURRENT `main`.** Everything from
`ca2bb8b` onward is committed and **undeployed**: D-62's mode-aware readiness,
the production fragment publisher (`src/ops/fragments.ts`), D-63, the D-63
amendment, and the targeted-run CLI. **Check this before diagnosing any
production behaviour** — the host is running a build older than the repository,
and the two disagree about what readiness even means.

Consequence for the plan: **publishing fragments alone will not make this
instance ready.** The deployed build demands an Anthropic credential in replay
mode, so `provider` stays unavailable until it is rebuilt. A redeploy is a
prerequisite, not a follow-up. And on current `main`, `REPLAY_FIXTURES` is still
`const REPLAY_FIXTURES: Readonly<Record<string, never>> = {}` at
[`backend/src/index.ts:79`](../backend/src/index.ts#L79) — a hardcoded empty
object — so a rebuild alone does not finish the job either. ⚠️ **Both halves are
real and unstarted, but they are NOT parallel:** the fixtures cannot be built
before the fragments are published, because building one composes a prompt
against the published resolver. See *"`REPLAY_FIXTURES` is not an independent
task"* below.

### The activation gate, and the exact shape of the blockage

Publishing fragments requires a regression pass reference that **exercised the
fragments being activated** (`DB §4.5`, D-14, D-24 dec. 4, D-30 dec. 3). Coverage
is computed from the committed recordings. Measured 2026-09-09 across all 15
authored fragments:

| Covered by the 13 committed recordings | Not covered by anything |
|---|---|
| `foundation.system_frame` (13) · `foundation.provenance_rules` (13) · `foundation.neutrality_constraints` (13) · `foundation.refusal_and_uncertainty` (13) · `stage.classification` (13) · `stage.context_extraction` (11) · `stage.intent` (11) · `type.business_requirement` (11) · `stage.architecture_analysis` (10) | ⚠️ `stage.workflow_review` · `type.workflow` · `stage.recommendation_generation` · `stage.portfolio_suggestions` · `type.assessment` · `type.job_description` |

**9 of 15 covered, 6 uncovered.** The 13 committed recordings are all
`FIRST_VERTICAL` (`business_requirement` + the special classes), so every
non-`br`/`un` path is unevidenced.

### ⚠️ ew-001 — held, paid for, and the subject of a completed feasibility check

`research/regression-pending/ew-001.json` is **untracked, real provider evidence**
(`claude-sonnet-4-5`, **$0.1072**, captured 2026-09-08T12:29Z, 4 stages). It sits
outside the canonical store deliberately — see `research/regression-pending/README.md`
and the §5 lesson. **It has never been admitted and its corpus assertions have
never been evaluated.**

A **read-only feasibility inspection completed 2026-09-09** established, by
exercising the real code paths against the real database rather than by reading
them:

- **ew-001 needs 9 fragment keys.** Eight resolve. One does not:
  **`stage.workflow_review`**, which has no row in `prompt_fragment` *at all* —
  not merely no active version. It postdates the dev database's fragment seed.
- **If admitted unchanged, `regression:run -- --case=ew-001` produces `errored`** —
  not `stale`, not `blocked`. The recording carries no `composition` (captured
  hours before the D-63 amendment persisted them), so it takes the LEGACY path,
  and the active resolver throws a plain `Error` *before* any staleness
  comparison happens. A plain `Error` matches none of the three arms in
  [`runner.ts:304-310`](../backend/src/regression/runner.ts#L304-L310).
  The exact throw, captured live: `No active published version for fragment(s): stage.workflow_review`.
- **This already happened once, and is committed.**
  `research/regression-failures/corpus-v1/ew-001-2026-09-08T11-42-27-007Z.json`
  records the 11:42 capture attempt dying on that identical message after
  3 provider calls. The 12:29 capture succeeded only because capture had by then
  been switched to the **authored** resolver (D-63), which reads
  `prompts/stage/workflow_review.md` off disk.
- **The deferred assertions do not block evaluation.** `artifact_set`,
  `confidence_band` and `do_not_automate_conclusion` are `supported: false` and
  report as `deferred` — a reported outcome, not an error. ew-001 would still be
  judged on the six supported assertions, and its live expectations
  (`existing_workflow`, confidence ≥ 0.6) are exactly what the recording answers
  (`existing_workflow` at 0.95).
- **▶ ew-001 CAN be evaluated today with zero spend and zero corpus mutation.**
  `runRegression` already takes `store` and `resolver` as options, and
  `createRecordingStore(root)` takes a root — `capture` already uses both that
  way for dry runs. Swapping in `createAuthoredResolver(readAuthoredFragments(PROMPTS_ROOT))`
  is what makes it resolvable, and **the composition reproduces exactly**:
  `94768ecd876b85e8…` from the authored resolver, `94768ecd876b85e8…` recorded.
  The input hash matches too (`5806cba06c82…`), so nothing blocks earlier.
- ⚠️ **But such a run can never satisfy the gate**, because
  `assertActivationPermitted` recomputes coverage against
  `createRecordingStore()` — the canonical store. **The architecture requires
  admission for *activation*, not for *evaluation*. That separation is
  deliberate and correct. Do not collapse it.**

**Admitting ew-001 would cover 2 of the 6 uncovered fragments** —
`stage.workflow_review` and `type.workflow` — and would invalidate the two
committed references (`4ea7eef7345389e9`, `35af47fbdabae5eb`) as sufficient for
foundation activation, because every foundation fragment would then compose into
14 recorded cases rather than 13.

### ✅ THE EVALUATION HARNESS IS BUILT, AND ew-001 PASSES *(2026-09-09)*

**Owner approved it this session.** `npm run regression:evaluate -- --case=<id>`
(`regression.mts`, command `evaluate`). It runs `runRegression` against a
scratch-rooted store holding a copy of the held recording plus a generated
manifest, with the authored resolver. Zero provider spend, zero canonical-corpus
mutation. It writes **no** run record and builds **no** pass reference —
`buildPassReference` is not imported into that block, so a later edit cannot
reach for it by accident.

**The result, run live:**

```
✅ ew-001   composition 94768ecd876b85e8 · captured 2026-09-08T12:29:22.497Z
     ok classification — existing_workflow
     ok classification_confidence_bound — 0.95 is at or above threshold 0.6
     ok run_completeness — the run reached its terminal stage
     ok reference_integrity — 23 context element(s), 9 component(s), every grounding resolved
     -- artifact_set — Stages 8-9 (artifact planning and generation), Sprint 2
     -- confidence_band — Stage 11 (confidence evaluation), Sprint 2
```

⚠️ **Correction to the previous edition: it is 4 supported assertions, not 6.**
Six are *evaluated*; four are supported and pass, two are deferred.
`do_not_automate_conclusion` is **not among them at all** — `ew-001.yaml` states
no such expectation, so it was never applicable to this case.

**The evidence is sound and the admission decision is now unblocked.** It
remains the owner's, and nothing above widens coverage: `assertActivationPermitted`
still recomputes against the canonical store, which still holds 13 recordings.

### ⚠️ THE FEASIBILITY CHECK WAS WRONG, AND A REAL DEFECT WAS HIDING BEHIND IT

The previous edition asserted *"▶ ew-001 CAN be evaluated today with zero spend"*
on the strength of a read-only inspection of resolution and composition. Both of
those facts were right — and ew-001 still could not be replayed, because the
inspection stopped one step short of running the pipeline. **The first run of the
harness failed:**

```
💥 ew-001 — No recorded response for request key 12602299cef18ed3
```

**Root cause — [`stageProviderInputs`](../backend/src/nie/pipeline.ts#L196), and
it was never about ew-001.** That function tells a recorder which provider input
each stage will receive, and `createRecordedProvider` keys a replay fixture from
it. It re-stated the Stage 6 routing rules inline: `job_description` to Stage 7,
and **everything else** to `architecture_analysis`. But `planReasoning` sends
`existing_workflow` to `workflow_review` and pointedly *not* to architecture
design (`FR-021` via `AI §7.1`, D-40). So the `existing_workflow` path was
mis-described.

Nothing went red. `createRecordedProvider` **skips** a recorded stage it has no
provider input for, so an `existing_workflow` recording quietly built one fewer
fixture, and Stage 6 then failed at replay with a message that reads like
*missing evidence* when the evidence was present and merely unkeyed.

⚠️ **This means NO `existing_workflow` recording could ever have been replayed,**
whatever the corpus said, and the same held for any future path routed through a
new reasoning module. It was not a property of ew-001; ew-001 is just the first
case that ever tried.

**Fixed** by routing through `planReasoning` — the same pure, total function the
pipeline itself branches on at Stage 6 — so a module cannot be routed in the
pipeline and forgotten in the fixture builder. Verified two ways: the missing key
`12602299cef18ed3` is exactly the key the fixed builder now produces for
`workflow_review`, and **all 13 committed recordings still pass with a
byte-identical pass reference (`35af47fbdabae5eb`)**, so the change is
behaviour-preserving for everything already admitted.

⚠️ **Why the existing tests could not catch it** — this is the durable lesson:

- `nie-pipeline.test.ts`'s agreement test is exactly the right test and its
  comment predicted this defect verbatim (*"a broken handoff could hide behind
  green tests"*). It only ever runs the **business-requirement** path.
- `nie-m11-paths.test.ts` *does* exercise `existing_workflow` end to end — but
  its `primedAdapter` computes fixture keys **itself**. ⚠️ **A test that
  reimplements the function under test cannot disagree with it.** It was green
  for the same reason the defect was invisible.

Two tests now assert the real `stageProviderInputs` against the real handoff for
both non-requirement paths, including that the branch *not* taken is absent.
**Confirmed by differential**: removing the fix turns the `existing_workflow`
case red and leaves `technical_assessment` green.

### ⚠️ NO RECORDING IN THE REPOSITORY CARRIES A `composition` — ALL 14 ARE LEGACY

Measured, not read off the docs. The previous edition described the absent
`composition` as specific to ew-001; it is universal:

```
br-001..br-011, un-001, un-002, ew-001  →  composition: no   (14 of 14)
```

So every recording takes the **LEGACY** path at
[`runner.ts:181`](../backend/src/regression/runner.ts#L181) and still resolves
against the database's active fragment versions. **D-63's amendment is currently
protecting nothing** — not because it is wrong, but because its benefit begins
with the next *capture*. Do not rely on "recordings replay against their pinned
composition" until a recording exists that has one. It also means
`regression:run` still needs the database, exactly as §9 says.

### ⚠️ `REPLAY_FIXTURES` IS NOT AN INDEPENDENT TASK — corrected 2026-09-09

The previous edition called it *"small, genuine, unstarted"* and listed it
beside the fragment work as though either could be done first. **It cannot be
started at all until fragments are published**, and it needs a deployment change
the previous edition did not mention. Verified three ways rather than read:

1. **The fixture key requires a composed prompt.**
   `createRecordedProvider` keys every fixture with
   `replayKeyFor({task, input, instructions, …})`, where `instructions` comes
   from `composePrompt(…, resolver)`. Production's resolver is
   `db/fragment-resolver.ts`, which **throws** `No active published version for
   fragment(s): …` when a key has no active row. The production database holds
   **zero** fragments, so no fixture can be built. ⚠️ Reaching for the authored
   resolver here to get around that would make production run prompts that were
   never published — the activation gate's whole purpose, defeated from the
   other side.
2. **The recordings are not in the runtime image, and cannot be.**
   `backend/.dockerignore` lists `research`, and `research/` sits **outside** the
   `./backend` build context regardless — the same reason `ops/fragments.ts`'s
   header gives for `prompts/`.
3. **The `backend` compose service mounts neither.** Only the one-shot
   `fragments` service does (`./prompts:/prompts:ro`, `./research:/research:ro`,
   `docker-compose.prod.yml:160-161`). So the runtime cannot read a recording
   even in principle today.

**What it will actually take**, once fragments are published: mount `research/`
read-only into `backend` exactly as `fragments` already does, build the fixture
set at startup from the committed recordings against the **published** resolver,
and let `checkProvider` read its size. A startup failure to compose must leave
the set empty and the instance *not ready* — never abort the boot, or a replay
instance could not come up to report why it is unready.

⚠️ **All 14 recordings are legacy** (§ below), so this composition consults the
database. A recording carrying its own `composition` (D-63 §7) could be keyed
with the pinned resolver and no database at all — but none exists yet.

### Two tracks, ordered — do not entangle them

| Track | What it needs | Blocked on |
|---|---|---|
| **Production readiness** | **Push `main`** (§10 — it is 8 commits behind `origin`), redeploy, then publish fragments, then mount `research/` and load `REPLAY_FIXTURES` | The fragment publish needs a covering pass reference — so it waits on the evidence track |
| **Regression evidence** | Evaluate ew-001 *(done)*, decide admission, then close the 4 remaining uncovered fragments | Owner approval — and ⚠️ **the last 4 are NOT free**, see below |

The evidence track can proceed on the workstation with nothing deployed. The
readiness track cannot finish without it. ⚠️ **The temptation to publish
fragments with a manufactured or non-covering reference so the health check goes
green is exactly the thing the owner has ruled out** — twice, explicitly. A
green `/health` bought that way is worth less than the 503.

### ⚠️ "ENTIRELY OFFLINE AND FREE" WAS WRONG FOR THE LAST 4 — corrected 2026-09-09

The previous edition's table said the whole evidence track was *"entirely
offline and free — no host, no redeploy, no spend"*. That is true of **ew-001**,
which is already captured and paid for, and **false of the other four.**

Coverage recomputed this session with the gate's own `computeFragmentCoverage`
against the canonical store — not read off the previous edition — and it agrees
exactly: **9 covered, 6 uncovered.**

| Uncovered fragment | Closed by | Cost |
|---|---|---|
| `stage.workflow_review` · `type.workflow` | Admitting **ew-001** | **Free** — already captured, $0.1072 already spent |
| `type.job_description` · `stage.recommendation_generation` · `stage.portfolio_suggestions` | A **jd-001** capture | ⚠️ **Live provider spend** |
| `type.assessment` | A **ta-001** capture | ⚠️ **Live provider spend** |

⚠️ **Both of those captures have already been attempted, and both failed** —
each after **4 real provider calls** that were paid for and produced no
recording. Preserved in `research/regression-failures/corpus-v1/`:

- **`jd-001`** (12:30:46Z) — died at **stage 7, `recommendation_generation`**:
  *"matched[1] cites evidence \"https://github.com/…\", which is not a locator
  on capability \"cap-001\""*.
- **`ta-001`** (12:32:33Z) — died at **stage 6, `architecture_analysis`**:
  *"trade_offs must be an array when present"*.

⚠️ **Neither is the resolver failure ew-001 hit, and neither is fixed by D-63.**
`ew-001`'s 11:42 failure was `No active published version for fragment(s):
stage.workflow_review` — an infrastructure problem, which switching capture to
the authored resolver genuinely solved. **These two are model-output conformance
failures**, at two different stages, on two different schema rules. Retrying
them buys another 4 calls each with **no guarantee of a recording**, and the
Sonnet 5 finding in §5 is the standing reminder that a schema failure can
reproduce at a different point each time.

**So the honest statement of the remaining evidence work is:** ew-001 is free
and decided by the owner; the last four fragments need authorised spend on two
captures that have each failed once already. There is no offline path to them.

### ⚠️ PUBLISHING IS ALL-OR-NOTHING — so ALL SIX must be covered, not just four

The tempting reading of the table above is *"publish the 9 covered fragments now,
the health check's `checkTemplates` only names the 4 foundation ones anyway, and
close the rest later."* **The publisher does not offer that, by construction:**

- [`ops/fragments.ts:116`](../backend/src/ops/fragments.ts#L116) reads **all 15**
  authored fragments.
- `changing` (`:158`) is every fragment whose newest stored version has a
  different `contentHash`. Production holds **zero rows**, so on a first publish
  **all 15 are changing**.
- `assertActivationPermitted` (`:170`) is handed that whole list and loops it,
  throwing `fragment_not_covered` on the first uncovered key. Nothing is written
  before the gate passes, so the refusal is total and leaves the database
  untouched.

⚠️ **Therefore `templates: available` is NOT reachable by covering only the four
foundation fragments**, even though `checkTemplates` resolves only those. The
gate is asked about all fifteen or the publish is refused. Making it publish a
subset is a **change to the publisher**, which the standing constraints forbid
during evidence work — and it would need its own decision record, because
"activate the fragments you happen to have evidence for" is a different policy
from `DB §4.5`, not an implementation detail of it.

**Consequence for the readiness track:** production readiness needs **all six**
uncovered fragments closed — ew-001 admitted *and* both paid captures succeeding.
`✅ 11 of 15` is not a partial win here; it is still a refused publish.

---

## 7b. M-20 — done as an increment, open as a milestone

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

### ⚠️ "SPRINT 5 HAS NO REMAINING CODE INCREMENT" — SUPERSEDED 2026-09-09

**That was recorded as the state of the sprint on 2026-09-08 and it was true
then.** It is no longer. The host was provisioned, the deployment happened, and
the deployment surfaced two genuine code tasks — the empty `REPLAY_FIXTURES` and
the fragment activation path. **§7a is the current statement.** This subsection
is kept because the *reasoning* still governs everything that remains:

| Dependency | Discharges | State |
|---|---|---|
| ~~Host / domain~~ | M-19 deployment, TLS, the drills, off-host backups, alert delivery | ✅ **DISCHARGED** — Hostinger VPS, `naigx.tech`, TLS verified |
| ~~AWS KMS credentials + key~~ | ~~`DB §13.1` row 3~~ | ✅ **RETIRED by D-61** — the dependency no longer exists |
| **Fragment coverage evidence** | Activation for the 6 uncovered fragments, and with it production readiness | ▶ **§7a. Where the work is** |
| **Optional provider spend (~$8)** | **M-20 provider metrics** — `NFR-001`/`NFR-002`. ⚠️ **Optional.** Declining is a complete answer, and production traffic is now the free path | Owner's decision |
| **A human reviewer** | **M-08** rubric review. Carried from Sprint 2 | Unowned |
| **A screen-reader / keyboard reviewer** | **M-17** manual WCAG walk | Unowned |

⚠️ **These still do not substitute for one another.** A deployment does not
evidence a fragment; a fragment does not measure latency; neither discharges a
human review. **That principle is the durable part of this table** — it is how a
milestone gets falsely reported as passed on the strength of a *different*
dependency being met.

### Constraints on M-20, from the owner — still current

- Keep M-20 to the **defined** performance requirements and the measurement
  methodology.
- **Do not use development sample sizes to imply production performance.**
- **Do not add infrastructure merely to manufacture production-like results** —
  no load-generator cluster, no synthetic traffic tier. `app.inject` plus a
  local Postgres is the whole apparatus, deliberately.

---

## 7. WHERE M-19 STANDS — deployed at last, milestone still NOT passed

**Four phases, owner-approved, all four committed — and as of 2026-09-08 they are
actually running on a host.** ⚠️ *Deployed* is still not *passed*: see the gap
table below Phase 4 before reporting anything about M-19.

**What changed since the previous edition:** the host and domain were
provisioned (Hostinger VPS, `naigx.tech`), NAIGX was routed through the host's
existing Traefik rather than binding 80/443 ([D-60](35-D-60-Shared-Traefik-Edge.md)),
AWS KMS was replaced by a host-held key file
([D-61](36-D-61-Host-Held-Key-File.md)), and readiness was made mode-aware
([D-62](37-D-62-Mode-Aware-Readiness.md)). **TLS is verified.** The instance is
up and **not ready** — §7a is the current front line.

⚠️ **THE KMS PREREQUISITE NO LONGER EXISTS — [D-61](36-D-61-Host-Held-Key-File.md), 2026-09-08.**
The owner stopped the work before creating or paying for anything and chose a
**host-held key file** for v1.0 instead. The AWS SDK, the KMS adapter, the
credential-injection design of D-59, and `tests/integration/kms-live.test.ts`
were all **removed** rather than left skipping — which is why the suite's skip
count fell from 6 to 4.

The keys live at `/etc/naigx/keys/` on the VPS, mode `0400`, and the owner holds
both in a password manager. **Never print either key into chat, a log, or a
document** — a paste of the root key into a session once forced a rotation.

✅ **`DB §13.1` row 3's MECHANISM IS NOW VERIFIED — 2026-09-09.** The two tests
that prove the key file **fails closed** on loose permissions had never executed
anywhere, because `{ skip: !posix }` skipped them on the only machine that ever
ran the suite. They were run on the VPS in a throwaway `node:24` container
against the source checkout: **11 tests, 11 pass, 0 skipped**, including
*FAILS CLOSED when the key file is group-readable* and *…world-readable*.
`backend/src/crypto/` and the test are byte-identical between `ca2bb8b` (what
ran) and `3fffe27`, so the result holds for current `main`.
Recorded in [D-61 §8](36-D-61-Host-Held-Key-File.md).

⚠️ **`skipped 0` is the load-bearing number, not `pass 11`.** A run with 2 skips
prints an almost identical summary and proves nothing.

⚠️ **`M-18` H-2 is still open, and `M-18` is still NOT PASSED.** This discharges
the *mechanism* H-2 named — it does not close the finding or the milestone, and
it says nothing about the deployed key file's actual mode.

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

**Encryption.** `src/crypto/` — AES-256-GCM envelope (`naigx.v1.<version>.<iv>.<tag>.<ct>`), a two-method `KeyProvider`, an AWS KMS adapter (⚠️ **since deleted — D-61 replaced it with `providers/key-file.ts`**), an offline double, and a multi-version key ring. Sealed at three boundaries only: `routes/analyses.ts` writes `raw_content`, `db/stage-trace-sink.ts` writes both `structured_*`, and nothing else touches those columns. Opened in `execute-analysis.ts`, the `FR-062` search, and the `API-014` export. The key ring loads at startup and the process **refuses to start** if the key provider is unavailable — originally an unreachable KMS, now an unreadable or loosely-permissioned key file.

**Search.** Decrypt-and-filter per D-53 §4 — and **proved by differential**: restoring the old SQL `contains` predicate makes the `FR-062` test fail with a silently empty page, which is exactly the failure D-53 predicted.

**Purge queue.** `trace_purge_outbox` in the **primary** store, written in the *same transaction* as the deletion (all three delete routes in `history.ts` now use `$transaction`). `enqueue` became async and takes that transaction — same interface, same single swap point, **no API contract change**.

**Backfill.** `npm run encrypt:{init,status,backfill}` (`src/ops/encrypt.ts`, compiled — the runtime image has no `tsx`). Verified against the real dev database: 3 inputs + 368 stage traces sealed, re-read correctly, idempotent on a second run, `status` reports zero plaintext.

⚠️ **SUPERSEDED BY D-61 — the KMS adapter no longer exists.** `providers/aws-kms.ts` was deleted along with the AWS SDK and the 4 live-KMS tests. `providers/key-file.ts` replaced it: the key is read from a `0400` file on the host, and the process still **refuses to start** if it is unreadable, wrong-length, or group/world-readable. `tests/unit/key-file-provider.test.ts` covers it — except the two permission tests, which skip on Windows (§5).

**`DB §13.1` row 3 is still *implemented, not verified*, and `M-18` H-2 stays open** (D-53 §6: it closes when both layers are deployed *and verified*, not when code merges). What discharges it has changed — it is now running those two permission tests on the POSIX host, not calling a cloud service.

### ✅ Phase 4 — monitoring, alerting, drills, data policy *(built)*

Recorded as **[D-56](31-D-56-Monitoring-Alerting-And-The-Drills.md)**.

`deploy/monitoring/` (Prometheus + Alertmanager + 8 rules), `deploy/backup.sh`, `deploy/restore-drill.sh`, `frontend/src/components/DataPolicy.tsx`, four operational metrics, and compose services for all of it.

**Verified end to end** (2026-09-07): `promtool`/`amtool` accept the configs; Prometheus scraped `/internal/metrics` with the operator bearer token (`health: up`); every series an alert references resolved against live data; `CompletionRateBelowTarget` entered `pending` with its message rendered — *"Analysis completion rate 50% is below the NFR-010 target of 95%"*; and a test alert was **delivered to a webhook receiver** through Alertmanager. `NFR-031` reachability and the policy's numbers are asserted by an automated check, plus axe.

**Restore drill PERFORMED and recorded** — [RESTORE-DRILL-LOG](deployment/RESTORE-DRILL-LOG.md). Both databases restored into scratch, 8 table row counts matched, one analysis spot-checked with its envelope intact. ⚠️ **Development database, not production.**

### ⚠️ M-19 IS NOT PASSED, AND THIS IS THE IMPORTANT PART

Its criterion is **"production deploy with monitoring, alerting, and verified rollback"**. The deploy exists; **the instance cannot serve a submission and the rollback has never been drilled on it.**

| Gap | State as of 2026-09-09 |
|---|---|
| ~~No production deployment~~ | ✅ **CLOSED.** 6 containers up on the VPS, ~7 hours at time of writing |
| ~~TLS unverified~~ | ✅ **CLOSED.** Real Let's Encrypt certificate (`CN=YR1`), `notAfter Dec 7 2026`, `ssl_verify_result=0`. `NFR-020` verified |
| ~~KMS unverified~~ | ✅ **RETIRED.** D-61 removed the dependency; `kms-live.test.ts` deleted, not left skipping |
| ⚠️ **The instance is NOT READY** | `GET /health` → **503**. Zero fragments in the production DB; `REPLAY_FIXTURES` empty. **This is §7a and it is the live issue** |
| ⚠️ **The deployed build is behind `main`** | It predates `ca2bb8b` — no D-62, no fragment publisher, no D-63. Verified by grepping `/app/dist/index.js` in the running container. **A redeploy is a prerequisite for readiness, not a follow-up** |
| **Rollback drill NOT done** | D-50 §4 requires it *on production*. Now *possible* for the first time. ✅ The blocker it surfaced is fixed (D-57), but the drill is still unattempted: [ROLLBACK-DRILL-LOG](deployment/ROLLBACK-DRILL-LOG.md) |
| **Restore drill was on dev data** | Mechanism proven. Backups **are running on the host** — `naigx-backup` wrote both dumps at 10:50Z and reported a clean cycle — so a production restore drill is now reachable |
| **Off-host backup storage** | ⚠️ **Half done.** `rclone` is installed with a `gdrive:` remote and the encrypted `.enc` dumps exist on disk, but `rclone ls gdrive:` is **empty** and the automated cycle does not upload. A backup on the same host is not an off-host backup |
| ~~Key-file permissions unverified on a POSIX host~~ | ✅ **CLOSED 2026-09-09.** Both *FAILS CLOSED* tests **ran and passed on the VPS** — 11 tests, **0 skipped**. D-61 §8. ⚠️ Verifies the code path, not the deployed file's mode |
| **Alert delivery to a real person** | Verified as a mechanism. Alertmanager starts happily with an unreachable receiver — still a first-deploy check |

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
| **`DB §13.1` row 3's mechanism is VERIFIED** (D-61 §8, 2026-09-09) — the 2 permission tests ran on the VPS with 0 skips. ⚠️ `M-18` H-2 and `M-18` itself remain open; do not report the milestone on this. | **D-61**, owner explicit |
| **Never print either production key** into chat, a response, a log, or a document. | Owner, explicit, 2026-09-08 |
| **⚠️ Do not weaken, bypass, or work around the fragment activation gate.** No manufactured pass reference, no demo exemption, no relaxing `DB §4.5`/D-24. NAIGX is a real v1.0 instance, not a demo deployment. | Owner, explicit, 2026-09-08 |
| **Do not publish fragments** without an authorised, covering pass reference. | Owner, explicit |
| **Do not modify prompts, the corpus, assertions, routing, schemas, the publisher, or the production runtime** when the task is evidence work. | Owner, explicit, repeatedly |
| **Do not touch n8n or Traefik** beyond the approved D-60 NAIGX routing. A five-week-old production n8n runs on that host. | Owner, explicit, **D-60** |
| **Never `git push --force`, squash, or rewrite history.** | Owner, explicit |
| **Stop and report a blocker rather than working around it.** | Owner, explicit, repeatedly |
| **Hold `ew-001` uncommitted and unadmitted** until the owner decides. It is real paid evidence and admitting it changes what every existing reference is sufficient to activate. | Owner, explicit, 2026-09-08 |
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

⚠️ **Everything below is green as of 2026-09-09.** The only thing in the working
tree is the untracked `research/regression-pending/`, which is deliberate.
`npm run bench` is NOT part of this gate — it seeds and deletes rows and takes a
couple of minutes.

```bash
# backend (from backend/)
npm test              # 926 tests, 922 pass, 0 fail, 4 skipped
npm run typecheck
npm run lint
npm run format:check
npm run fragments:check   # 15 fragments match the manifest
npm run schemas:check     # 5 artifact schemas published and matching

# ⚠️ `format:check` may flag tests/unit/regression-coverage.test.ts on THIS
# Windows checkout. It is a line-ending artifact, not a formatting defect:
# the committed blob is clean LF (`git show HEAD:<file> | tr -cd '\r' | wc -c`
# → 0) and the content is byte-identical to Prettier's output once CRs are
# stripped. ⚠️ Do NOT `prettier --write` it — that commits a line-ending-only
# diff to a file nobody edited. Verified 2026-09-09.

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

**The 4 skips are 2 live-provider tests** (`LIVE_PROVIDER_TESTS=1` + a key, which must stay skipped under the no-spend constraint) **and 2 POSIX key-file permission tests** (`skip: !posix` — they cannot run on Windows). ✅ **The second pair has now been RUN, on the VPS** — 11 tests, 11 pass, **0 skipped** (D-61 §8). They still skip here, and always will; that is the platform gate working, not a gap. ⚠️ **Re-run them on the host after any change under `backend/src/crypto/`** — on this machine such a change is guarded by nothing.

**Regression and fragment evidence (offline, free — no provider, no spend):**

```bash
npm run fragments:check          # 15 authored fragments match the manifest
npm run regression:recordings:check   # every recording is manifested and unedited
npm run regression:run           # replays the 13 committed FIRST_VERTICAL recordings
npm run regression:run -- --case=<id> # targeted; resolves against the WHOLE corpus (289e1e1)
```

⚠️ **`regression:run` needs the database** — its LEGACY fallback resolver reads active fragment versions from it. A recording that carries its own captured composition never consults it (D-63 §7).

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

**Production checks (the VPS — you have direct SSH access):**

```bash
ssh -i ~/.ssh/naigx_vps root@76.13.209.213

docker ps --format '{{.Names}}\t{{.Status}}'
docker exec naigx-backend node -e "fetch('http://127.0.0.1:3000/health').then(async r=>{console.log(r.status, await r.text())})"
docker exec naigx-postgres psql -U naigx -d naigx -tAc "select count(*) from prompt_fragment"
curl -sS -o /dev/null -w '%{http_code} tls=%{ssl_verify_result}\n' https://naigx.tech

# ⚠️ ALWAYS: is the running build actually current? (returns 0 on the build
# deployed as of 2026-09-09, which predates D-62)
docker exec naigx-backend grep -c "no recordings are available" /app/dist/index.js
docker logs naigx-backend 2>&1 | grep -iE "execution mode|encryption active" | head -2
```

✅ **D-61's key file works in production** — the instance logs
`Field encryption active  provider=key-file(/run/secrets/naigx/root.key) keyVersion=1`
at startup. That is the mechanism running for real; the two permission tests
(§5) are the part still unproven.

⚠️ **`n8n-traefik-1` and `n8n-n8n-1` are the owner's live production n8n, five
weeks up.** D-60 routes NAIGX *through* that Traefik. Touch neither.

---

## 10. Git state

⚠️ **The working tree holds exactly one untracked item, deliberately:**
`research/regression-pending/` — `ew-001.json` (real, paid provider evidence) and
its README. **Do not commit it, do not move it into the recording store, do not
delete it.** §7a and `research/regression-pending/README.md` explain why.
Everything else is committed.

⚠️ **`main` IS NOT PUSHED — corrected 2026-09-09.** The previous edition said it
was, and that was true when written. `origin/main` is at **`ca2bb8b`**; local
`main` is at **`3fffe27`**, **8 commits ahead**:

```
git rev-parse origin/main   → ca2bb8b…
git log --oneline origin/main..HEAD   → 8 commits
```

⚠️ **THIS BLOCKS THE REDEPLOY, AND NOT VISIBLY.** `deploy/README.md`'s redeploy
runbook is written around `git fetch origin && git merge --ff-only origin/main`.
Run today, that fetches nothing and the merge is a no-op — the host's checkout is
*already* at `ca2bb8b` — so every step reports success, `up -d --build` rebuilds
the same source, and the D-62 marker check still prints `0`. **It looks exactly
like "the rebuild did not take", which the runbook tells you not to treat as a
configuration bug.** Push first, or the redeploy silently deploys nothing.

**Branch `main`.** Recent, newest first:

| Commit | What |
|---|---|
| `289e1e1` | **Expose targeted case selection on `regression:run`** — the `--case=` asymmetry that stranded `ew-001` |
| `c88e6fe` | **D-63 amendment** — replay against the composition a recording was captured with. ⚠️ Load-bearing; see §4 |
| `29e4c54` | Preserve the `jd-001` and `ta-001` capture failures as evidence |
| `27f1a1e` | Fix the regression CLI — remove the side-effecting `fragments.mts` import |
| `81fa57f` | **D-63** — regression evidence composes against authored fragments |
| `ca2bb8b` | **Production fragment publisher, and D-62 mode-aware readiness** |
| `7795bc8` | Record the regression pass reference for foundation-fragment activation |
| `794252a` | Correct stale CMK wording left behind by D-61 |
| `e085d2d` | **D-61** — replace AWS KMS with a host-held key file |
| `898b406` | **D-60 accepted** — route NAIGX through the host's existing Traefik |
| `cafb3ab` | D-60 (PROPOSED) |
| `ca7091c` | Record the Sonnet 5 pilot: attempted, measured, and rejected |
| `c221da1` | D-59 — AWS credential injection on a non-EC2 host (⚠️ later retired by D-61) |
| `f600849` | Record the M-20 disposition and Sprint 5's remaining dependencies |
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
| `docs/13`–`docs/38` | D-38 … D-63, standalone. ⚠️ D-59 is retired by D-61; D-63 must be read with its §7 amendment |
| `deploy/README.md` | **How to deploy, what is verified, and what is not** |
| `docs/accessibility/WCAG-AA-CHECKLIST.md` | The manual M-17 walk. **Result table is empty** |
| `docs/security/M-18-SECURITY-REVIEW.md` | The M-18 review, with its H-2 correction visible |
| `deploy/seccomp/README.md` | Why the seccomp profile exists and what it trades |
| `docs/deployment/RESTORE-DRILL-LOG.md` | The restore drill — **passed on dev data**, production outstanding |
| `docs/deployment/ROLLBACK-DRILL-LOG.md` | The rollback drill — **not attempted**; the incompatibility it found, and the fix |
| `docs/33-D-58-Representative-Load.md` | What "representative load" means, and why `M-20` cannot pass on replay numbers |
| `docs/35-D-60-Shared-Traefik-Edge.md` | Why NAIGX routes through the host's existing Traefik instead of binding 80/443 |
| `docs/36-D-61-Host-Held-Key-File.md` | **The AWS dependency, removed.** What replaced it and what still has to be verified |
| `docs/37-D-62-Mode-Aware-Readiness.md` | What `API-060` readiness means per execution mode. ⚠️ Not a relaxation — both modes can fail |
| `docs/38-D-63-Authored-Fragment-Resolution-For-Regression.md` | The publish/evidence circularity, and **§7's amendment** separating replayability from evidential currency |
| `research/regression-pending/README.md` | **Why `ew-001` is held outside the recording store**, and why moving it in to silence a check is the wrong fix |
| `research/regression-failures/corpus-v1/ew-001-2026-09-08T11-42-27-007Z.json` | The capture that died on `stage.workflow_review` — the blockage, recorded at the time it happened |
| `backend/tests/unit/corpus-selection.test.ts` | The `--case=` selection rule, and a header explaining what the asymmetry cost |
| `docs/performance/M-20-LATENCY-LOG.md` | The M-20 measurements — **`NFR-003`/`004`/`005` pass, `NFR-001`/`002` unmeasured** |
| `backend/src/ops/bench.ts` | M-20 latency measurement; its header states what it cannot measure, and every HTTP measurement declares its expected status |
