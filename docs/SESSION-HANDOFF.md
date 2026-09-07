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
| **M-19** Deployment | **Phases 1–2 of 4 done.** See §7 |
| **M-20** Performance | Unstarted |

### Sprint 5 deliverables still outstanding

- **Data policy page** (`NFR-031`) — must be reachable *before first submission*. Phase 4.
- **Alerting** (`NFR-082`, `NFR-085`) — Phase 4.
- **M-17 manual WCAG walk** — needs a person with a screen reader. Unowned.
- **M-08 rubric review** — needs a human reviewer. Unowned, carried from Sprint 2.

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

**Numbering convention: the next standalone record is `docs/30` D-55.**

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
- **`request.ip` is meaningless until proxy trust is decided, and both defaults are wrong** (D-54 §4). Off behind a proxy → one global rate-limit bucket for everyone. On without one → `X-Forwarded-For` is client-supplied and the per-IP limit stops existing. Neither announces itself.

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

## 7. THE NEXT STEP — M-19 Phase 3

**Four phases, owner-approved. Phases 1 and 2 are committed.**

The owner has taken the **KMS prerequisite** for Phase 3 (an AWS account and
credentials). Build the envelope-encryption implementation behind the provider
interface with an offline test double, and mark real KMS integration
**unverified until credentials exist and an actual integration test passes**.
Before provisioning a real key, **verify the provider's current official
pricing** — D-52's ~$1/month is a decision-record estimate from its date, not a
standing guarantee.

### ✅ Phase 1 — containerisation, non-root, Linux Chromium *(done)*

`backend/Dockerfile` (non-root uid 1000, distribution Chromium), `backend/.dockerignore`, `deploy/seccomp/chromium.json` + README, `chromiumSandbox: true`, and a source-level regression guard that was **verified to fail** when flipped.

Verified in-container: PDF renders non-root with the sandbox on (36,676 bytes, `%PDF-`), and **fails without the profile** — that differential is the proof. Both Prisma migration paths load post-prune. Image is **2.04 GB**, almost all Chromium.

### ✅ Phase 2 — TLS, same-origin edge, configurable host/port *(done)*

Recorded as **[D-54](29-D-54-Edge-Topology-And-Proxy-Trust.md)**. Deploy guide: **[`deploy/README.md`](../deploy/README.md)**.

`deploy/Caddyfile`, `deploy/Dockerfile.edge` (Caddy + the built client), `docker-compose.prod.yml`, `deploy/.env.example`, root `.dockerignore`. `HOST`/`TRUST_PROXY`/`NAIGX_IP_HASH_SECRET` are configuration; the seccomp profile is wired via `security_opt`.

**Verified** against the built images with a stub backend over HTTP: API paths proxy, SPA fallback serves, `/internal/metrics` 404s **and never reaches the backend**, HSTS + `nosniff` + `DENY` + referrer-policy present, and SSE streams incrementally (lines at **467/846/1249 ms**, matching the origin — no proxy buffering). `trustProxy` proved by differential.

⚠️ **TLS itself is UNVERIFIED.** No certificate has ever been issued by this config — ACME needs a public domain and DNS that do not exist yet. Everything *beneath* TLS is verified; the TLS layer is not. Do not report `NFR-020` as verified until the first real deploy.

**Three defects this phase caught — all had passed a plausible check first.** See §5.

### ▶ Phase 3 — encryption + durable purge queue *(next)*

- Envelope encryption (D-52/D-53) on `raw_content`, `structured_input`, `structured_output`. Migration touches **both stores**.
- ⚠️ **Encrypting `raw_content` breaks `FR-062` search.** `routes/history.ts:171` substring-matches that column in SQL and a database cannot match ciphertext — it would fail **silently**, returning empty results. D-53 §4 resolves it by decrypting and filtering in the application; semantics unchanged, search becomes `O(user's analyses)`.
- Durable purge queue behind the existing `TracePurgeQueue` interface (a Postgres table). No API change.
- **⚠️ THE KMS PREREQUISITE IS THE OWNER'S, AND THEY HAVE TAKEN IT** (2026-09-08). Build the provider interface and an offline test double so the logic and migration are testable now; flag live-KMS integration **unverified until credentials exist and a real integration test passes**. Do not substitute a local key to make it green — D-52 §4 forbids exactly that.
- **Check the price before provisioning.** D-52's ~$1/month is that record's estimate on its date, not a standing guarantee. Verify the provider's current official pricing and the expected usage against it first.

### Phase 4 — monitoring, alerting, rollback drill, data policy

- `/internal/metrics` **already emits Prometheus text format** (M-16), so scraping is nearly free.
- Alerting per `NFR-082`, `NFR-085`.
- **Restore drill** (D-51 §4) — a dump restored and verified, recorded with a date. A backup is not evidence; the restore is.
- **Rollback drill on production** (D-50 §4) before the criterion is claimed.
- **Data policy page** (`NFR-031`) stating the real retention windows including the **7-day backup window**.

**M-19's criterion is "production deploy with monitoring, alerting, and verified rollback" — not just the five infrastructure prerequisites.**

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
| **Do not close `NFR-021`/`DB §13.1` with a key in `.env` or OpenBao.** | **D-52** §4, owner explicit |
| **Do not implement `API-071`/`072`/`073`.** Operator auth existing is not a licence. | **D-48** §5 |
| **M-17 is not passed on a green axe run**; the manual walk is required. | **D-49** §3.3 |
| **M-18 is not passed**, and must not be described as an independent review. | Owner, explicit |

---

## 9. Verification — run all of these

```bash
# backend (from backend/)
npm test              # 853 tests, 851 pass, 0 fail, 2 skipped
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

**The 2 skips are the live-provider tests** (`LIVE_PROVIDER_TESTS=1` + a key), and they must stay skipped under the no-spend constraint.

**Docker must be running** or the Postgres-backed and browser-backed suites skip. A skip means *not checked*, never *passed* — if the skip count rises above 2, start Docker before reading the result.

**Container checks (Phases 1–2):**

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
