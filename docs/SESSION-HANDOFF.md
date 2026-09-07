# NAIGX — Session Handoff

**Written:** 2026-09-08
**Purpose:** hand a new chat session everything it needs to continue building NAIGX without re-deriving context or re-litigating settled decisions.

> **Read this first, then `docs/STATUS.md`.** STATUS.md is the authoritative current-state record. This file covers the most recent working sessions, and the exact next step.

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
| **M-20** Performance | Unstarted |

### Sprint 5 deliverables still outstanding

**All three remaining items need a human or a host. None is code.**

- **A production host and domain** — M-19 cannot close without one, and neither can TLS, the rollback drill, or a restore drill against real data. Owner's to provision.
- **An AWS account** for KMS — 4 skipped tests are the only thing that can verify `DB §13.1` row 3. Owner's, taken, not yet done.
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

**Numbering convention: the next standalone record is `docs/33` D-58.**

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

## 7. WHERE M-19 STANDS — all four phases built, milestone NOT passed

**Four phases, owner-approved, all four committed.** ⚠️ Built is not deployed: see the gap table below Phase 4 before reporting anything about M-19.

**The next step is a decision, not a task.** M-19 cannot close without a host and a domain — that is the owner's to provision, along with the AWS account Phase 3 needs. Until then the remaining M-19 work is unearnable, and **M-20 performance is the next milestone that can actually progress**.

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

---

## 9. Verification — run all of these

```bash
# backend (from backend/)
npm test              # 897 tests, 891 pass, 0 fail, 6 skipped
npm run typecheck
npm run lint
npm run format:check
npm run fragments:check   # 15 fragments match the manifest
npm run schemas:check     # 5 artifact schemas published and matching

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

**Branch `main`, clean, all work committed.** Recent:

| Commit | What |
|---|---|
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
