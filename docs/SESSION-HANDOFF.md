# NAIGX — Session Handoff

**Written:** 2026-09-08 · **Last updated:** 2026-09-09 (M-20 measured LIVE and NOT MET; provider credits exhausted mid-sample; `NFR-021` confirmed absent on the VPS)
**Purpose:** hand a new chat session everything it needs to continue building NAIGX without re-deriving context or re-litigating settled decisions.

> **Read this first, then `docs/STATUS.md`.** STATUS.md is the authoritative current-state record. This file covers the most recent working sessions, and the exact next step.
>
> ⚠️ **Start at §7a — the front line has MOVED.** Every "the activation gate refuses" statement in earlier editions is superseded.
>
> ✅ **THE FRAGMENT ACTIVATION BLOCKAGE IS CLEARED.** All **15** authored fragments are **PERMITTED** by the real activation gate against a real reference — `corpus-regression:corpus-v2+fragments-v1:d4abcd42626452df`, from a 15-case run that passed 15/15. Zero `composition_mismatch`, zero `fragment_not_covered`. Verified per fragment *and* as the publisher actually asks it: all 15 keys in one call.
>
> ⚠️ **THE GATE WAS NEVER WEAKENED TO GET THERE.** D-64 §4.3 was **added** during this campaign and made activation *harder*, not easier. No exemption, no `--force`, no manufactured reference. The gate is stricter today than when the blockage began.
>
> ✅ **NAIGX IS READY — 2026-09-09, owner-authorised.** `https://naigx.tech/health?check=readiness` answers **200** with all three dependencies available. The host runs `1da10e3` = `origin/main`. The **15 fragments are ACTIVE in production**, every row carrying `corpus-regression:corpus-v2+fragments-v1:d4abcd42626452df`, published through the unchanged gate from the new image. The **5 artifact schemas are published**. The replay corpus serves **15 recordings, 54 fixtures, 0 excluded**. Four recorded inputs — `br-001`, `jd-002`, `ew-001`, `ta-005` — each completed through the public API, one per path, with every planned artifact `generated`. §7a.
>
> ⚠️ **A second provisioning defect was found DURING the deploy and fixed the same day** (§5): the artifact schemas had never been published and the image never carried them, so the first `jd-002` submission failed at Stage 9 *after* readiness said 200. `business_requirement` had hidden it. `br-001` alone would have passed the deploy check.
>
> ⚠️ **READY IS NOT GENERAL.** A replay instance serves exactly the 15 corpus inputs it holds recordings for, byte for byte, and fails anything else at Stage 1 without reaching a provider (D-62 §5).
>
> ✅ **THE M-19 DRILLS WERE PERFORMED ON PRODUCTION, 2026-09-09, owner-authorised** — [ROLLBACK-DRILL-LOG](deployment/ROLLBACK-DRILL-LOG.md), [RESTORE-DRILL-LOG](deployment/RESTORE-DRILL-LOG.md). Rollback `1da10e3` → `56d7269` → forward, **~1.7 s / ~2.0 s** outage windows, all four criteria met. Restore drill on production data **passed twice** — from local staging and from the **off-site copies pulled back from Google Drive**, decrypted, SHA-256-matched. Provider spend $0.00; n8n and Traefik untouched.
>
> ✅ **M-19 IS CLOSED — 2026-09-09.** Its criterion is *"production deploy with monitoring, alerting, and verified rollback"*. Deploy ✅, monitoring ✅ (Prometheus on the host scrapes the backend, `health: up`), **alerting ✅ (one owner-authorised test alert, read back from the ntfy receiver 30 s after posting)**, rollback ✅. `STATUS.md` → Completed records the evidence. **M-20, M-08, M-17, M-18 are exactly as open as before.** The `API-060`-does-not-probe-schemas issue stays **open** by the owner's instruction; the off-site sync script is now in the repository under `deploy/offsite/` (host unchanged).
>
> ⚠️ **Read §7a's three thin points before claiming anything about quality.** `stage.portfolio_suggestions` rests on **one** recording produced by a **non-deterministic** verdict; four of the five input types are evidenced by one or two cases; and `br-006`/`br-008` were **withdrawn**, not fixed.
>
> **Spend to date: $1.7121**, all authorised case by case.
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
| **M-19** Deployment | ✅ **CLOSED 2026-09-09.** Deploy ✅ (ready, four paths serving recorded inputs) · monitoring ✅ (Prometheus scraping, `health: up`) · alerting ✅ (owner-authorised test alert delivered to the ntfy receiver in 30 s, read back from the topic) · verified rollback ✅ (production drill, ~1.7 s / ~2.0 s) · restore drill ✅ on production data and from off-site. `STATUS.md` → Completed. ⚠️ Replay mode; migration-crossing rollback not exercised; device receipt of the alert is the owner's to confirm |
| **M-20** Performance | **NOT PASSED — now on evidence.** ✅ `NFR-001`/`NFR-002` **measured live 2026-09-09** (owner-authorised, $1.1319): full completion **p50 74.3 s / p95 161.6 s** (n=8, budget 60/120); first artifact **p50 85.3 s / p95 161.6 s** (n=4, budget 15/40). Both over budget at p50; `NFR-001` is structurally out of reach for this pipeline shape. ⚠️ Sample cut short at 11 attempts by **provider credit exhaustion** — the owner's account, not the cap. `docs/performance/M-20-LATENCY-LOG.md` §7. **What closes it is a requirements decision**, see §7b |

### Sprint 5 deliverables still outstanding

✅ **DISCHARGED since the last edition:** the production host and domain (Hostinger VPS + `naigx.tech`), TLS (`NFR-020` — a real Let's Encrypt certificate, issued 2026-09-08, valid to 2026-12-07), and the AWS account, which **no longer exists as a dependency at all** — D-61 replaced managed KMS with a host-held key file, and `tests/integration/kms-live.test.ts` was deleted rather than left skipping.

✅ **ALSO DISCHARGED 2026-09-09 (evening):** the whole **fragment-coverage blockage**. All 15 fragments are gate-PERMITTED against reference `d4abcd42626452df`. See §7a.

⚠️ **What remains:**

- ~~**▶ Redeploy the backend.**~~ ✅ **DONE 2026-09-09.** `main` was pushed (it was 9 commits ahead of `origin`, which the previous edition did not know) and the host rebuilt to `34ce193`. The D-62 marker went `0` → `1` and the `provider` message changed to the replay branch's. ⚠️ `/health` is still **503**, correctly — see §7a.
- ~~**▶ PUBLISH the fragments to production**~~ ✅ **DONE 2026-09-09, owner-authorised** with reference `corpus-regression:corpus-v2+fragments-v1:d4abcd42626452df`. Run from the **new** image (built without recreating the running backend, so the D-64 §4.3 gate was the one that decided): *Published 15 new version(s); 0 unchanged.* All 15 rows carry the reference.
- ~~**▶ Redeploy again.**~~ ✅ **DONE 2026-09-09.** Host `34ce193` → `1da10e3` = `origin/main`, twice in one session (the second to ship the schema fix below). Marker `Replay corpus loaded` = 1; readiness 200.
- ✅ **ALSO DONE, unplanned: the artifact schemas.** Zero `artifact_schema` rows in production and no `schemas/` in the image — §5, third instance of the `tsx`-script defect. `src/ops/schemas.ts` + Dockerfile + `schemas` compose service; *Published 5; 0 unchanged*; `check` clean. ⚠️ This was a third production write, made under the redeploy authorisation because the deployment could not serve three of four paths without it; recorded here so it is visible rather than folded in.
- ~~**`REPLAY_FIXTURES` is a hardcoded empty object**~~ ✅ **DONE 2026-09-09 (night).** `backend/src/regression/replay-corpus.ts` loads every canonical recording whose captured composition the **published** fragments reproduce, merges their fixtures into one replay adapter, and readiness reads the same object. `research/` is now mounted read-only into the `backend` compose service. Verified against the real store with the authored composition: **15 served, 0 excluded, 54 fixtures** (⚠️ an earlier edition said 55 — arithmetic error; 54 is the sum of recorded stages), and jd-002 runs through the production pipeline to a produced Stage 9 artifact. Verified as the **compiled** entrypoint against the local dev database: readiness 200, 3 legacy recordings served and 12 excluded with the exact reason (the dev DB holds the old active composition). ⚠️ It loads **once, at startup** — publish first, then rebuild/restart.
- ~~**A production rollback drill**~~ ✅ **DONE 2026-09-09.** [ROLLBACK-DRILL-LOG](deployment/ROLLBACK-DRILL-LOG.md). ⚠️ The previous image had to be **rebuilt from source** — a cron prunes dangling images and nothing tags the outgoing release. `naigx-backend:rollback-target` (`56d7269`) is now kept on the host; tag every outgoing release at deploy time.
- ~~**A restore drill against production data**~~ ✅ **DONE 2026-09-09, twice** — [RESTORE-DRILL-LOG](deployment/RESTORE-DRILL-LOG.md). ⚠️ The runbook's `exec postgres bash /usr/local/bin/naigx-restore-drill` **never existed in any container**; the drill is piped into `naigx-backup`. Corrected in both the log and `deploy/README.md`.
- ~~**Off-host backup storage**~~ ✅ **VERIFIED 2026-09-09 — and the previous edition was STALE.** The remote is not empty and the upload leg does run: a host-only `naigx-offsite-sync` (script + systemd hourly timer, `RandomizedDelaySec=300`) encrypts each dump with `backup.key` (`openssl aes-256-cbc -pbkdf2 -iter 200000`), uploads to `gdrive:naigx-backups`, verifies by read-back, prunes both sides at 7 days, and alerts via an `ntfy` URL file on every failure path; the journal shows every hourly run since 2026-09-08 succeeding. The 2026-09-09 dumps were pulled **back** from the remote, decrypted, SHA-256-matched to staging and restore-drilled. ⚠️ **The concrete remaining step is not an upload step.** It is that the script and its two units are **not in this repository** (`STATUS.md` → Open); nothing was changed on the host beyond one manual `systemctl start` of the existing unit.
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

| `docs/39` **D-64** | **What a pass reference attests, and which composition a run reproduces.** Accepted (Option C). Adds the `composition_mismatch` refusal — it made activation **harder** — and fixes the legacy-composition defect that stranded `ew-001`. ⚠️ §10 is a dated, OPEN deviation |

**Numbering convention: the next standalone record is `docs/40` D-65.** Nothing is currently owed.

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
- **⚠️ THIRD TIME, 2026-09-09 (deploy): the artifact schemas were never published to production, and the image never carried them.** `requirePublishedSchemaId` correctly refuses to publish on demand, `schemas:publish` was a `tsx` dev script the image cannot run, and `backend/Dockerfile` never copied `schemas/`. So on the deployed instance the first `job_description` submission replayed six stages correctly and failed Stage 9 with *"No registered schema for artifact type"* / *"Artifact schema … is not published"*. `business_requirement` hid it by producing no artifacts — `br-001` completed end to end on the same instance minutes earlier. **Readiness said 200 throughout**, because `API-060` probes templates, not schemas. Fixed: `src/ops/schemas.ts` (compiled publisher), the Dockerfile ships `schemas/`, a `schemas` compose service, and the first-deploy runbook gained the step it was missing. ⚠️ **A green health check plus one completed path is not a completed deployment.** Run one recorded input per *artifact-bearing* path before calling it served.
- **⚠️ A DEPLOYED CONTAINER IS NOT THE REPOSITORY, AND ITS ERROR MESSAGES WILL LIE TO YOU ABOUT WHICH CODE IT IS.** `naigx-backend` logged `"mode":"replay"` and then rejected readiness with `"No provider is configured"` — the **live** branch's message, which current `main` cannot produce in replay mode. The instinct is to go debug `resolveExecutionMode`. The actual cause is that the image predates D-62 by several commits. **Confirm the running build before diagnosing its behaviour:** `docker exec naigx-backend grep -c "<a string only the new code has>" /app/dist/index.js`. A container that has been up for hours is evidence about *whenever it was built*, not about `HEAD`.
- **⚠️ A capture CLI and a run CLI that resolve case ids differently will strand paid evidence.** `regression:capture` accepted `--case=<id>` against the whole corpus; `regression:run` selected `FIRST_VERTICAL` unconditionally and had no `--case=` at all. So `ew-001` could be captured — and **was, for $0.1072 of real provider spend** — and then could never be evaluated, because an `existing_workflow` case with no special class is excluded from that vertical *by construction*. Nothing errored. The asymmetry is closed (`289e1e1`) and `tests/unit/corpus-selection.test.ts` guards it. **When two commands name the same thing, check that they mean the same thing.**
- **A run's provenance label must be DERIVED, never stamped.** A re-run was recorded as `fragmentResolution: "authored"` while it had actually replayed 13 legacy recordings through the *active* resolver. The record was restored and the label is now computed from what each recording carried. **A field describing how a run resolved is evidence about the run — it cannot be an argument.**
- **Moving a file into the recording store to silence a drift error destroys the gate.** An unmanifested recording makes `regression:recordings:check` fail with `unmanifested: <case>`. That check is correct: it is the difference between *captured* and *admitted*. Held evidence lives in `research/regression-pending/`, outside the store, which is why `createRecordingStore` cannot see it. **Never `regression:recordings:write` to make a red check green.**
- **Importing a constant from a CLI script executes that script.** `regression.mts` imported `PROMPTS_ROOT` from `fragments.mts`, which runs its own `process.argv` dispatch at module scope — so `regression:capture` was broken on `main` in a way that looked like an unrelated failure. Fixed in `27f1a1e` by resolving the path locally. **A module with top-level side effects is not importable, whatever it exports.**
- **A resolver that throws synchronously breaks a port typed as returning a promise.** `FragmentResolver.resolve` returns `Promise<...>`; an `authored-resolver` that threw before returning escaped every `.catch` in the pipeline. Make it `async`.
- **`assert.throws` returns `void` in Node's types** — it cannot hand you the error to inspect. Capture with `try`/`catch` when you need to assert on fields.
- **Two POSIX permission tests skip on Windows and are the ones that matter in production.** `key-file-provider.test.ts`'s *"FAILS CLOSED when the key file is group-readable / world-readable"* guard D-61's whole security argument, and `process.platform !== "win32"` skips both on the dev machine. They are 2 of the suite's 4 skips. ⚠️ **Run them on the VPS**, or the key file's permission enforcement is asserted by nothing.

- **⚠️ CAPTURE AND REPLAY DIVERGING IS THIS PROJECT'S MOST EXPENSIVE BUG SHAPE — it has now happened THREE times.** `stageProviderInputs` mis-routing `workflow_review`; the `--case=` asymmetry; and the Stage 7 capability profile, which `capture.ts` passed to the pipeline and `runner.ts` did not. **Every instance surfaced as a message blaming the evidence** — *"No recorded response for request key …"*, *"No capability profile supplied"* — against recordings that were perfectly fine. Fixing the profile in `runRegression` alone exposed a second half in `createRecordedProvider`, because the fixture builder keys Stage 7 **only when a profile is present**. ⚠️ **When a replay failure points at a recording, first ask what capture had that replay does not.**
- **⚠️ FOURTH INSTANCE, 2026-09-09 (night): Stage 9 was never keyed.** `stageProviderInputs` described a run up to Stage 7 and stopped, so `createRecordedProvider` filed no `portfolio_suggestions` fixture. jd-002 — the one recording that reaches Stage 9, and the sole evidence `stage.portfolio_suggestions` rests on — replayed its first four stages and then landed the artifact `failed` with *"No recorded response for request key …"*, against a recording that held the answer. **The 15-case regression run passed anyway**, because `artifact_set` is a deferred assertion and `run_completeness` only checks the terminal stage was reached. It was found only because the deployment loader's test counted fixtures against recorded stages: 53 ≠ 54. Fixed by threading Stage 7's output through `stageProviderInputs` (parsed with the pipeline's own parser, planned with its own Stage 8) and asserting the artifact outcome in `tests/unit/replay-corpus.test.ts`. ⚠️ **"Reached the terminal stage" and "served every recorded answer" are different claims.** A count of fixtures against recorded stages is the cheap check that tells them apart.
- **A capture that succeeds can still prove nothing.** `jd-008` passed every assertion and produced **0 matched entries**, so the locator rule it was captured to test was never exercised — a *vacuous* pass. ⚠️ **Check that the run actually exercised the thing under test**, not merely that it went green.
- **A failed capture is billed, and a batch overruns silently.** A nine-case batch exceeded its authorisation by 6.5%: `br-006` failed after 3 paid calls and `br-008` took a 5-call path where 4 were budgeted. Cost was measured *after* the batch, which is a receipt rather than a ceiling. `--budget=` now refuses to **start** a case once the ceiling is reached, and every outcome carries `costUsd` **including failures**.
- **Re-capturing a case that already has a recording had only two outcomes, and both were wrong:** skipped, or `--force`, which **destroys the recording being tested**. `--out=` writes a paid capture outside the store so admission stays a separate decision.
- **A keyword scan does not predict model behaviour.** `jd-008` was chosen because it mentioned n8n/Zapier/Make; its actual requirements were healthcare-domain and years-of-experience, which correctly became gaps rather than matches. ⚠️ **Select cases on observed requirement/match/verdict behaviour, never on vocabulary.**
- **A prompt can be right and still not be followed.** The locator instruction already said *"Copy the locator exactly"*. What was missing was an **escape hatch** — nothing told the model what to do when it believed a requirement matched but no locator fitted, so it invented one. Pointing at `gaps` was the load-bearing half of the fix.
- **⚠️ My own failure-mode characterisation was wrong once, and it mattered.** I reported `jd-002` as *inventing* an anchor; auditing the citations showed it **borrowed** a real locator declared on another capability, and that **1 of 4–5 citations** was wrong, not most. **Audit the actual values against the source of truth before naming a failure mode.**

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

## 7a. ▶ THE NEXT STEP — the evidence gate is GREEN; publication is the owner's call

⚠️ **This section was rewritten 2026-09-09 (evening). Every "the gate refuses"
statement in earlier editions is superseded.** The whole fragment-activation
blockage — the thing that had blocked Sprint 5 for days — is **cleared**.

### The state, measured not asserted

```
canonical corpus            15 recordings, manifest clean, byte-verified
pass reference              corpus-regression:corpus-v2+fragments-v1:d4abcd42626452df
  from a 15-case run        15 passed · 0 failed · 0 blocked · 0 stale · 0 errored
activation gate             PERMITTED = 15   composition_mismatch = 0
                            fragment_not_covered = 0
  asked per fragment AND as the publisher asks it (all 15 keys, one call)
```

**Every one of the 15 authored fragments is now activatable.** `npm run
fragments:publish -- --reference=corpus-regression:corpus-v2+fragments-v1:d4abcd42626452df`
would pass the gate.

⚠️ **THE GATE WAS NEVER WEAKENED TO GET HERE.** D-64 §4.3 was *added* during
this campaign and made activation **harder**, not easier. No exemption, no
`--force` path, no manufactured reference. The gate is stricter today than when
the blockage started.

### What the corpus holds

| | Cases |
|---|---|
| `business_requirement` | br-001…br-004, br-005, br-007, br-009…br-011 — **9** |
| `unsupported` | un-001, un-002 — **2** |
| `existing_workflow` | ew-001 — **1** |
| `technical_assessment` | ta-005 — **1** |
| `job_description` | jd-002, jd-008 — **2** |

All 15 carry a **pinned, authored composition**. Before this campaign every
recording was legacy with no persisted composition; D-63 §7's mechanism now has
subjects.

### ⚠️ The three thin points — read before claiming anything about quality

1. **`stage.portfolio_suggestions` rests on ONE recording produced by a
   NON-DETERMINISTIC verdict.** jd-002 gave `build_first`, then `apply_now`,
   then `build_first` on identical input, with nine technical requirements
   extracted every time. Only the build path reaches Stage 9. The gate is
   satisfied and the evidence is real, but this is the thinnest point in the
   corpus. The superseded `apply_now` run is kept at
   `research/regression-superseded/` precisely so this stays visible.
2. **Four of the five input types are evidenced by one or two cases.**
   `docs/10` §4 wants ≥20 per type before a rate is claimed. Breadth is not
   depth, and `review-packet.test.ts` asserts the per-type counts so a future
   reader cannot mistake one for the other.
3. **br-006 and br-008 were WITHDRAWN, not fixed** — see below.

### The withdrawal, and why it is not a bypass

`br-006` and `br-008` are at `research/regression-withdrawn/`, bytes preserved
and committed. Both carried the **active** composition (`4f65ab62887890`),
stale against the candidate, and neither could be re-captured:

- **br-006** has failed at stage 3 on `source_quote does not occur in the input`
  **three times**; its old recording came from a fourth attempt.
- **br-008** re-captured as `job_description` — the ambiguity `docs/12` D-25
  already records for this exact case.

⚠️ A withdrawn case leaves the **recorded** set, so coverage reports it
`unrecorded` — *undetermined*, never *covered*. Nothing is grandfathered.
**The cost is real and was accepted deliberately:** `type.business_requirement`
now composes into 9 cases rather than 11.

### What this cost

**$1.7121 of provider spend**, all authorised case by case. 22 paid captures
attempted; 13 produced usable recordings. The rest are preserved as failure
evidence under `research/regression-pending/failures/` and
`research/regression-failures/`.

### ✅ PRODUCTION READINESS — REACHED 2026-09-09, and what was observed

Every step below was run on the VPS with the owner's explicit authorisation
for the fragment publish and the redeploy, and each result is what the host
printed, not what was expected:

| Step | Observed |
|---|---|
| Host checkout | `34ce193` → `56d7269` → `1da10e3` by `git merge --ff-only origin/main`; 0 migration files changed |
| New image built **before** publishing | `docker compose build backend`; the running container stayed the old one until step 5 |
| `fragments status` (new image) | *0 active fragment version(s)* |
| `fragments publish --reference=…d4abcd42626452df` | *✅ Published 15 new version(s); 0 unchanged.* — 15 active rows, every one carrying the reference |
| `schemas check` (new image) | *5 … not published* — **the defect §5 records**; `schemas publish` → *Published 5; 0 unchanged*; `check` → *5 published and matching* |
| `up -d --build` | backend + edge recreated; postgres, prometheus, alertmanager, backup untouched; **n8n untouched** |
| Build marker | `grep -c "Replay corpus loaded" /app/dist/index.js` → **1**; `ls /app/schemas` → 5 files |
| `Replay corpus loaded` | `served` = all 15, `fixtures: 54`, `excluded: []`, `unrecorded: 29`, `lowVarianceSampling: false` |
| Readiness | **200**, `database`/`provider`/`templates` all `available` — in-container and via `https://naigx.tech` (TLS verify 0); `/internal/metrics` from outside → 404 |
| Recorded inputs through the public API | `br-001` **completed** (business_requirement, no artifacts by design); `jd-002` **completed**, `portfolio_suggestions` **generated**; `ew-001` **completed**, `workflow_recommendation` + `risk_assessment` **generated**; `ta-005` **completed**, `assessment_feedback` + `mermaid_diagram` **generated** |

⚠️ **The first `jd-002` submission FAILED** (`96a18461…`) before the schema fix
— Stage 9 *"No registered schema for artifact type"*. That row is in the
production database as a genuine `failed` analysis; it is evidence of the
defect, not noise, and it expires with the other anonymous rows under D-45.
Five anonymous test analyses now exist in production from this verification.

⚠️ **Provider spend: $0.00.** Every run was replay; the corpus loaded and the
provider adapter never left the process.

### What "ready" does not mean

- **Not general.** D-62 §5: the instance answers the 15 recorded inputs and
  nothing else. A ready replay instance is a faithful one, not a capable one.
- **Not a milestone.** M-19 still lacks the production rollback drill, the
  restore drill on production data, and off-host backup upload. M-20's two
  latencies stay unmeasured. M-08, M-17, M-18 stay open. §7.
- **Readiness does not probe artifact schemas.** `API-060` names database,
  provider and templates, and the probe answered 200 while three of four paths
  could not store an artifact. Whether to extend the probe is a design
  decision for the owner; it is **not** changed here.

---

## 7b. M-20 — measured live 2026-09-09, NOT MET, and now a decision

✅ **`NFR-001`/`NFR-002` were measured live on 2026-09-09** under the owner's
US$10 continuation cap, per D-58 §4 option 1 — the deployed build (`1da10e3`),
the production fragment composition (published to the dev DB through the gate
with `d4abcd42626452df`), Sonnet 4.5 at pricing re-verified that day, one
analysis at a time. **Both are NOT MET:**

| | Budget | Measured (M-16 formula) | n |
|---|---|---|---|
| `NFR-002` full completion | 60 s p50 / 120 s p95 | **74.3 s / 161.6 s** | 8 completed |
| `NFR-001` first artifact | 15 s p50 / 40 s p95 | **85.3 s / 161.6 s** | 4 with an artifact |

`docs/performance/M-20-LATENCY-LOG.md` §7 has the apparatus, every run, and
the evidence files under `docs/performance/evidence/`. Two things to carry:

- ⚠️ **`NFR-001` is structurally out of reach for this pipeline's shape.** No
  artifact exists before Stage 6/7 reasoning completes; the JD path's only
  artifact is Stage 9, the last call; `business_requirement` produces none.
  Stages 1–3 alone take ~45 s. It cannot be met by a faster model. **Closing
  M-20 is a requirements/architecture decision — `NFR-001`'s definition and
  `NFR-002`'s target — and it is the owner's.** No D-record was written.
- ⚠️ **The sample is 8, not 30, because the provider account's credit balance
  ran out mid-run** — 11 attempted, 19 rejected at zero cost. Spent
  **$1.1319**; $8.87 of the cap remains and is unusable until the owner adds
  credits (an account purchase; not something this session can do).
  Completing the sample would cost ~$2.5 and sharpen the p95, not change the
  verdict.

Also observed, recorded not fixed: one Stage 3 failure where the model emitted
`category: "unknown"` (outside the enum — a live schema-conformance miss on
Sonnet 4.5), and one run where every stage succeeded but the 180 s executor
deadline fired during a 132 s Stage 9, so the user sees `timed_out` for work
that finished.

**Constraints honoured:** no replay number substituted; no implementation
change; the measurement criteria are D-58's as written.

### ▶ D-65 — Sonnet 5 with structured outputs, 2026-09-09 (owner-directed)

The owner retired the exhausted provider account, installed a new key
(suffix `…aQAA`, organisation `50a4c891-…` per the API's own header), and
directed the switch of live analysis to **`claude-sonnet-5`** with the
integration fixed end to end. [D-65](40-D-65-Structured-Outputs-And-Sonnet-5.md)
records the decision; the code is committed and proved offline:

- `src/provider/adapters/anthropic.ts` — per-generation sampling table (no
  `temperature` to the 5-generation, degradation recorded), `output_config`
  with **effort** and **per-task JSON schema**, thinking blocks skipped by
  type, `refusal` → persistent, `max_tokens` → one retry, 16k budget on
  thinking models.
- `src/nie/output-schemas.ts` — the seven stage schemas in the
  constrained-decoding dialect, vocabulary imported from `contracts.ts`.
  **Request shape unchanged → replay keys unchanged → all 15 recordings and
  `d4abcd42626452df` stand.**
- `PROVIDER_EFFORT` (validated) in `config/env.ts`; `.env.example` at Sonnet
  5 rates $2/$10 (verified on the pricing page); production `deploy/.env`
  still has **no** provider variables.
- Tests: 8 adapter request-shape tests; every schema dialect-checked; **all
  54 canonical recorded outputs validate against their stage schema** with
  `additionalProperties` relaxed — the schemas are not stricter than the
  parsers. Suite 969 / 965 pass / 4 skips.

⚠️ **Live verification is PENDING the owner's account confirmation** (D-65
§8): the key reveals the organisation ID and nothing else — no name, no
workspace, no balance. Spend so far on the new account: **$0.00** (two
unbilled model-list/retrieve calls). Cap remaining: **$8.87**.

### The replay-mode increment (2026-09-08) — still true, now the floor

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
| ~~The instance is NOT READY~~ | ✅ **CLOSED 2026-09-09.** `GET /health` → **200**; 15 fragments active under `d4abcd42626452df`; 5 schemas published; 15 recordings / 54 fixtures served; four recorded inputs completed through the public API, one per path. §7a. ⚠️ Ready in **replay** mode — the 15 corpus inputs, nothing else |
| ~~The deployed build is behind `main`~~ | ✅ **CLOSED 2026-09-09.** Host rebuilt to `34ce193` after pushing `main`. Marker `0` → `1`; `provider` now answers with D-62's replay message. The prerequisite is discharged — it did not, and could not, make the instance ready |
| ~~Rollback drill NOT done~~ | ✅ **CLOSED 2026-09-09.** Performed on production: `1da10e3` → `56d7269` → forward, ~1.7 s / ~2.0 s public 502 windows, previous release started on the current schema, existing content and export identical, fresh submission completed on the rolled-back build, forward deploy verified with `jd-002` generating its artifact. [ROLLBACK-DRILL-LOG](deployment/ROLLBACK-DRILL-LOG.md). ⚠️ Not exercised: a rollback across a migration |
| ~~Restore drill was on dev data~~ | ✅ **CLOSED 2026-09-09.** Production dumps restored into scratch on the production server, all 9 counts matched, envelope intact — from local staging (5 analyses) and again from the off-site copies (9 analyses). [RESTORE-DRILL-LOG](deployment/RESTORE-DRILL-LOG.md) |
| ~~Off-host backup storage~~ | ✅ **CLOSED 2026-09-09.** The previous row was stale: the hourly `naigx-offsite-sync` unit has uploaded every cycle since 2026-09-08. Off-site copies pulled back, decrypted by key path, SHA-256-identical to staging, restore-drilled. ⚠️ Open issue: the script and units are host-only, not in the repo |
| ~~Key-file permissions unverified on a POSIX host~~ | ✅ **CLOSED 2026-09-09.** Both *FAILS CLOSED* tests **ran and passed on the VPS** — 11 tests, **0 skipped**. D-61 §8. ⚠️ Verifies the code path, not the deployed file's mode |
| ~~Alert delivery to a real person~~ | ✅ **CLOSED 2026-09-09, owner-authorised.** One `DeployTest` alert (critical, `test=true`, `endsAt` +3 min) posted to the deployed Alertmanager; the **firing notification was read back from the ntfy topic 30 s later** (`group_wait`), zero notify errors, alert self-expired, Alertmanager back to zero active. Alertmanager *accepting* the alert was not treated as delivery — the topic read-back was. ⚠️ Device-level receipt is the owner's to confirm |

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
| **No provider spend without authorisation.** ⚠️ AMENDED 2026-09-09 (evening): the owner replaced per-case approval with a **US$10 cap for the Sprint 5 continuation**, "only when necessary", free verification preferred where it measures the same thing, no subscriptions or recurring infrastructure. **Spent under it: $1.1319** (the M-20 live sample, 63 invocations). **Remaining: $8.87 — but UNUSABLE**: the provider account's credit balance is exhausted (`400 invalid_request_error: Your credit balance is too low`), which only the owner can change. Earlier campaign spend: $1.7121, case by case. Project cumulative: **$3.83** across all live work recorded in `STATUS.md` and the campaign. | Owner, 2026-09-09 |
| ~~**Prompt fragments stay inactive.**~~ ✅ **SUPERSEDED 2026-09-09** — the owner authorised publication with `d4abcd42626452df`; 15 versions are active in production through the unchanged gate. D-39's *principle* stands: nothing further activates without a covering reference and an authorisation. | **D-39**, owner 2026-09-09 |
| **No M-08 packet review, no rubric verdicts.** AI review excluded "in any capacity, for any criterion". | `docs/10` §4.3 |
| **Do not implement `platform_recommendation`** / expand `business_requirement`. | Owner, explicit |
| **No frontend test infrastructure (no Vitest).** axe runs under `node:test`, which is not an exception to this. | Owner, explicit |
| **No unrelated Sprint 3/4 rework.** | Owner, explicit |
| **Do not close `NFR-021`/`DB §13.1` with a key in `.env` or OpenBao.** Two gates enforce this in code; do not remove either. | **D-52** §4, owner explicit |
| **`DB §13.1` row 3's mechanism is VERIFIED** (D-61 §8, 2026-09-09) — the 2 permission tests ran on the VPS with 0 skips. ⚠️ `M-18` H-2 and `M-18` itself remain open; do not report the milestone on this. | **D-61**, owner explicit |
| **Never print either production key** into chat, a response, a log, or a document. | Owner, explicit, 2026-09-08 |
| **⚠️ Do not weaken, bypass, or work around the fragment activation gate.** No manufactured pass reference, no demo exemption, no relaxing `DB §4.5`/D-24. NAIGX is a real v1.0 instance, not a demo deployment. | Owner, explicit, 2026-09-08 |
| **Do not publish fragments** without an authorised, covering pass reference. ✅ Both existed on 2026-09-09 and the publish ran; the constraint governs every *future* version exactly as before. | Owner, explicit |
| **Do not modify prompts, the corpus, assertions, routing, schemas, the publisher, or the production runtime** when the task is evidence work. | Owner, explicit, repeatedly |
| **Do not touch n8n or Traefik** beyond the approved D-60 NAIGX routing. A five-week-old production n8n runs on that host. | Owner, explicit, **D-60** |
| **Never `git push --force`, squash, or rewrite history.** | Owner, explicit |
| **Stop and report a blocker rather than working around it.** | Owner, explicit, repeatedly |
| ~~Hold `ew-001` uncommitted and unadmitted~~ ✅ **DISCHARGED.** The owner approved admission 2026-09-09; `ew-001` is in the canonical store. The *principle* stands for every future held recording: admission is a decision, never a filing step. | Owner, explicit, 2026-09-08 |
| **Held, withdrawn and superseded evidence is COMMITTED but never in the store.** Paid evidence must survive `git clean`; it must not silently become coverage. | Owner + §10, 2026-09-09 |
| **Do not chase the `apply_now` → `build_first` non-determinism.** Tracked separately as `FR-024` behaviour. | Owner, explicit, 2026-09-09 |
| **The locator prompt fix is validated and CLOSED.** Do not modify `stage.recommendation_generation` further. | Owner, explicit, 2026-09-09 |
| **Do not implement `API-071`/`072`/`073`.** Operator auth existing is not a licence. | **D-48** §5 |
| **M-17 is not passed on a green axe run**; the manual walk is required. | **D-49** §3.3 |
| **M-18 is not passed**, and must not be described as an independent review. | Owner, explicit |
| **`M-20` stays NOT PASSED.** ✅ `NFR-001`/`NFR-002` are now **MEASURED** (2026-09-09, live, D-58 methodology) and **NOT MET**. Do not report them as unmeasured any more, and do not report them as met. | Owner, 2026-09-08; measured 2026-09-09 |
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
npm test              # 959 tests, 955 pass, 0 fail, 4 skipped
npm run typecheck
npm run lint
npm run format:check
npm run fragments:check   # 15 fragments match the manifest
npm run schemas:check     # 5 artifact schemas published and matching

# (An earlier edition warned that format:check flagged
# tests/unit/regression-coverage.test.ts as a CRLF artifact. That file was
# reformatted during the evidence campaign and the check is clean.)

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
npm run fragments:check               # 15 authored fragments match the manifest
npm run regression:recordings:check   # 15 recordings, manifested and unedited
npm run regression:run                # the 13-case FIRST_VERTICAL default (unchanged)
npm run regression:run -- --case=<id> # case-named; selectionScope stays "partial"
npm run regression:run -- --fragment=<key>   # D-64 §4.4 targeted; scope "targeted"
npm run regression:evaluate -- --case=<id> --from=<dir>   # read-only, no reference

# ⚠️ THE FULL 15-CASE RUN is not a single flag — FIRST_VERTICAL is 13 cases and
# does NOT include ta-005, jd-002 or jd-008. Name all fifteen to reproduce the
# reference the gate was verified against:
#   npm run regression:run -- --case=br-001 --case=br-002 --case=br-003 \
#     --case=br-004 --case=br-005 --case=br-007 --case=br-009 --case=br-010 \
#     --case=br-011 --case=un-001 --case=un-002 --case=ew-001 --case=ta-005 \
#     --case=jd-002 --case=jd-008
#   → 15 passed · corpus-regression:corpus-v2+fragments-v1:d4abcd42626452df

# ⚠️ PAID. Only `capture` without --dry-run spends money.
npm run regression:capture:dry -- --case=<id>          # free rehearsal
npm run regression:capture -- --case=<id> \
  --out=research/regression-pending --budget=0.22      # held output + ceiling
# --out= keeps the canonical store untouched; --budget= refuses to START a case
# once the ceiling is reached. ⚠️ With ONE case a budget cannot pre-empt that
# case — batch cases together for real protection.
```

⚠️ **`regression:run` needs the database** — its LEGACY fallback resolver reads active fragment versions from it. A recording that carries its own captured composition never consults it (D-63 §7).

⚠️ **`regression:run` OVERWRITES the committed run record, and `git status` is the only thing that tells you.** The run is deterministic — same 13 cases, same hashes, same `runId` `35af47fbdabae5eb` — but it rewrites `completedAt` and (since the D-63 amendment) adds `fragmentResolution`. So two different documents end up claiming to be the same run, which is the *"the document and the reference disagree"* hazard the gate itself checks for. **After running it as a verification baseline, `git checkout -- research/regression-runs/` unless you deliberately intend a new evidential run.** This happened once before with a *stamped* provenance label (§5) and the record was restored then too.

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

# ⚠️ ALWAYS: is the running build actually current? (1 on `1da10e3`, the build
# deployed 2026-09-09; 0 on anything before the replay corpus)
docker exec naigx-backend grep -c "Replay corpus loaded" /app/dist/index.js
docker exec naigx-backend ls /app/schemas      # 5 files on 1da10e3; absent before
docker exec naigx-postgres psql -U naigx -d naigx -tAc "select count(*) from artifact_schema"   # 5
docker logs naigx-backend 2>&1 | grep -iE "execution mode|encryption active|Replay corpus" | head -3
# ⚠️ The OLD marker ("no recordings are available") moved out of index.js in
# the replay-corpus build; grepping index.js for it prints 0 on a CURRENT
# build and would send you to rebuild something that is already current.
```

✅ **D-61's key file works in production** — the instance logs
`Field encryption active  provider=key-file(/run/secrets/naigx/root.key) keyVersion=1`
at startup. That is the mechanism running for real; the two permission tests
(§5) are the part still unproven.

⚠️ **`n8n-traefik-1` and `n8n-n8n-1` are the owner's live production n8n, five
weeks up.** D-60 routes NAIGX *through* that Traefik. Touch neither.

---

## 10. Git state

✅ **The working tree is CLEAN.** Every artefact of the evidence campaign is
committed, including the held and superseded recordings — paid evidence no
longer sits untracked where a `git clean -xfd` could destroy it.

✅ **`main` is PUSHED and DEPLOYED — `origin/main` = local, and the host's
`/opt/naigx` checkout is fast-forwarded to it** (2026-09-09). The running
image was built from `1da10e3`; any later commit is documentation only unless
this section says otherwise. Re-check before every redeploy anyway:

```
git log --oneline origin/main..HEAD
```

⚠️ **AN UNPUSHED `main` BREAKS THE REDEPLOY SILENTLY.** `deploy/README.md`'s
runbook is built on `git fetch origin && git merge --ff-only origin/main`. If
`origin` is behind, the fetch brings nothing, the merge is a no-op, every step
reports success, `up -d --build` rebuilds the same source, and the marker check
still prints the old value — **indistinguishable from "the rebuild did not
take", which the runbook tells you not to debug as configuration.** This
happened once already. **Check `origin/main..HEAD` before every redeploy.**

### Three holding areas, and they mean three different things

| Directory | Meaning | Counts toward coverage? |
|---|---|---|
| `research/regression-recordings/<v>/` | **The canonical store.** The only thing `createRecordingStore` reads | **Yes** |
| `research/regression-pending/` | Captured, **not admitted**. Held for a decision | No |
| `research/regression-withdrawn/` | **Stale composition**, un-recapturable. Its case left the evidenced set | No — reports `unrecorded` |
| `research/regression-superseded/` | Valid, but **replaced** by a better recording of the same case | No |

⚠️ **Never move a file from any of the last three into the store to silence a
check.** Admission is a decision; the drift error is the difference between
*captured* and *admitted*.

**Branch `main`.** Recent, newest first:

| Commit | What |
|---|---|
| `d9ff63a` | **M-20 measured live, NOT MET** — NFR-001/002 sample, evidence files, credit-exhaustion blocker, NFR-021 absent on the VPS |
| `11ae3c1` | **M-19 closed** — test alert delivered and read back; `deploy/offsite/` preserves the sync script and units with recovery steps; STATUS, handoff, runbook updated |
| `2362461` | Name the drills commit |
| `bb1034a` | **The M-19 drills** — rollback and restore logs filled in from production, runbook path corrected, off-host mechanism recorded, two open issues added to `STATUS.md`. Documentation only; the deployed build is unchanged |
| `64651a0` | Record the deploy in the handoff |
| `1da10e3` | **Ship the artifact schemas in the image; compiled `schemas` publisher** — the defect the deploy surfaced; **this is the deployed build** |
| `56d7269` | Record the pushed state in the handoff |
| `6afe6f4` | **Wire the replay corpus into the runtime; key Stage 9** — `REPLAY_FIXTURES` replaced by `replay-corpus.ts`, `research/` mounted into `backend`, the fourth capture/replay divergence fixed, runbook marker changed |
| `2c3928b` | Bring the handoff current: the evidence campaign, and what is actually left |
| `0ae12cc` | **Admit the build_first jd-002** — all 15 fragments PERMITTED against `d4abcd42626452df` |
| `07e5545` | Hold the build_first jd-002 — Stage 9 completed for the first time |
| `a81b18f` | **Withdraw br-006/br-008, admit 11 held recordings** — 14 of 15 PERMITTED |
| `4c20a0a` | Hold jd-002 — the locator prompt change validated |
| `fce3020` | **Capture/replay parity** — pass the capability profile through replay |
| `cb83c27` | Hold jd-008 — first JD capture to survive Stage 7 |
| `5c802dd` | **The locator prompt fix** — `evidence_ref` must be a verbatim declared locator |
| `af94a2a` | Hold ta-005; jd-002 failed on the same Stage 7 locator rule as jd-001 |
| `38310a4` | **Per-case cost metering and a budget ceiling** |
| `a3924a6` | Hold 8 re-captures and the br-006 failure |
| `53a20bf` | Commit held evidence so paid captures survive `git clean` |
| `134a4e3` | `--out=` — paid capture outside the canonical store |
| `d4e3a88` | **Admit ew-001** and issue two targeted references |
| `5631418` | **D-64 accepted (Option C)** — enforce the pass-reference composition contract |
| `e7e5906` | D-64 (PROPOSED) |
| `ed1e1dd` | Redeploy to `34ce193`; withdraw the ew-001 admission on a closed circle |
| `34ce193` | Verify the key file fails closed on POSIX; correct three handoff claims |
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
| `docs/STATUS.md` | **Authoritative current state.** Wins on *current state* — not on requirements. ⚠️ Not updated for the evidence campaign; this file is ahead of it |
| `docs/39-D-64-…` | **The pass-reference composition contract.** §4.3 is the `composition_mismatch` rule; **§10 is a dated, OPEN deviation** |
| `research/regression-withdrawn/README.md` | Why `br-006`/`br-008` left the evidenced set, and what it cost |
| `research/regression-superseded/README.md` | Why the `apply_now` jd-002 is kept — it is the evidence that `stage.portfolio_suggestions` rests on a non-deterministic verdict |
| `research/regression-runs/d4abcd42626452df.json` | **The reference every fragment is currently PERMITTED against** |
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
| `deploy/offsite/README.md` | **The off-site backup sync, preserved from the host** — install steps, the encryption parameters, the two keys recovery needs, and the recovery procedure (exercised through the drill step on 2026-09-09) |
| `docs/deployment/RESTORE-DRILL-LOG.md` | The restore drill — **passed on PRODUCTION data 2026-09-09**, from staging and from the off-site copies; the working run command; the off-site decrypt parameters |
| `docs/deployment/ROLLBACK-DRILL-LOG.md` | The rollback drill — **performed on production 2026-09-09**, all four criteria, with the outage windows; the 2026-09-07 rehearsal and D-57 kept beneath it |
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
| `backend/src/regression/replay-corpus.ts` | **What a replay deployment serves** (D-62): the canonical store, loaded against the published fragments, one recording at a time, with every exclusion reasoned. `assertReplayServable` is the readiness probe's answer |
| `backend/tests/unit/replay-corpus.test.ts` | Proves it against the REAL store and authored composition — 15 served, one merged adapter runs jd-002 through the production pipeline to a produced Stage 9 artifact; drift and unpublished states exclude with the right reasons |
