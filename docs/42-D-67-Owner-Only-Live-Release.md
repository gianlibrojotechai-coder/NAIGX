# D-67 — The owner-only live release: a smaller finish line, stated as a deviation

**Date:** 2026-09-09
**Status:** Accepted — on the owner's direction of 2026-09-09: "NAIGX is exclusively for my personal use. Use this as the current direction."
**Sprint:** 5 (continuation)
**Resolves:** what "done" means for an instance one person uses for real work, without waiving what v1.0 still owes
**Affects:** `API-004` registration, `FR-004` anonymous analysis (both **restricted by configuration**, neither removed), `NFR-083`/`R-13` cost control (new spend caps), `D-47` (submission limit finally enforced), `D-61` pattern (provider key from a mounted file), `src/config/env.ts`, `src/auth/principal.ts`, `src/http/authenticate.ts`, `src/routes/analyses.ts`, `src/routes/auth.ts`, `src/app.ts`, `src/index.ts`, `src/orchestrator/spend-guard.ts`, `src/db/spend-reader.ts`, `docker-compose.live.yml`, `deploy/README.md`
**Builds on** D-37/D-39 (bounded scope), D-58 (measurement), D-61 (host-held secrets), D-62 (mode-aware readiness), D-65, D-66. **Supersedes nothing. Waives nothing.**

---

## 1. Two finish lines

The roadmap audit of 2026-09-09 (STATUS §*Open*, the handoff §3, and the
per-path inventory in §5 below) showed more unfinished v1.0 work than earlier
summaries conveyed. The owner's direction separates two finish lines and says
which comes first:

| | Finish line 1 — **owner-only live release** | Finish line 2 — **v1.0 as specified** |
|---|---|---|
| Who uses it | One person, one account, real inputs | The PRD's users (`PRD §14.1`, anonymous first analysis, public registration) |
| What it must do | Reason live on the owner's inputs, safely bounded in cost, with today's output set | Every P0 requirement, all four artifact sets, `M-05`–`M-21` |
| What closes it | §3's controls in production, one real end-to-end verification per path | The roadmap's Sprint 6 exit criteria, including the human reviews |
| Status | **Built and tested offline; the production switch awaits the owner's approval (§6)** | Open — §5 lists every item, deferred or unfinished, with its record |

**Nothing in finish line 1 is allowed to make finish line 2 look closer than
it is.** The restrictions below are configuration a public release would turn
off, and each is recorded here as an explicit deviation from the requirement
it narrows.

## 2. Access: one account, no anonymous paid calls

| Control | Mechanism | Requirement narrowed |
|---|---|---|
| **Access allowlist** — `NAIGX_ACCESS_ALLOWLIST` | Registration (`POST /users`) and sign-in (`POST /auth/sessions`) refuse any unlisted address with 403 *before any lookup*, so the refusal reveals list membership and nothing about which accounts exist. At the single point every route's principal comes from (`resolvePrincipal`), a session whose account is not listed resolves to **no principal** — so sessions issued before the list was set, including the verification accounts this project's own scripts created in production, are dead on arrival. Fail closed: a session row with no email is refused, not passed | `API-004` open registration — **deviation, configuration-scoped.** Unset restores the specified behaviour; the code path is unchanged |
| **Anonymous analysis** — `NAIGX_ANONYMOUS_ANALYSIS=disabled` | `POST /analyses` from a non-user principal → 401 with the corrective action, before a row is written, a limit consumed or the spend guard asked. Claim-on-signup, anonymous read/export and the expiry sweep are untouched; they key off stored rows and no such rows are created | `FR-004` anonymous first analysis — **deviation, configuration-scoped.** ⚠️ On a **live** instance the value must be set explicitly; startup refuses otherwise, so a paid anonymous call can never happen by omission |

## 3. Spend: bounded in dollars, not only in requests

Before D-67 a live instance had a per-call deadline, bounded retries and a
*declared* per-account submission limit that **no route consulted** (found in
the code map: `RATE_LIMITS.analysisCreateUser` had no call site). Nothing
bounded dollars per day.

| Control | Mechanism |
|---|---|
| **Spend caps** — `NAIGX_SPEND_CAP_USD_PER_DAY`, `..._PER_MONTH`, both **required** when live | `createSpendGuard` is asked once per submission, before the analysis row exists. It sums `provider_invocation.estimated_cost` (the `NFR-083` figure every M-20 sample was reconciled against) over the UTC day and UTC month, adds a **reserve** charged up front (`NAIGX_SPEND_RESERVE_USD_PER_ANALYSIS`, default `0.30` — the worst per-analysis cost in the latency log), and refuses with 429 when `spent + reserve > cap`. Decimal arithmetic on scaled integers, never floats. The refusal names the window and when it resets, never what was spent |
| **Fail closed** | If the trace store cannot be read, the guard cannot know what was spent and **refuses** (`spend_unknown`). A paid call whose budget is unverifiable does not start |
| **Submission limit** (D-47) | `analysisCreateUser` (10 per account-hour) and `analysisCreateAnonymous` (3 per IP-hour) are now enforced in `POST /analyses` |
| **Known understatement** | A call cancelled before usage arrives is recorded at $0 (STATUS open issue, 2026-09-09), so the ledger can understate by at most one call per cancellation; the reserve absorbs it. Provider-side usage still cannot be read from a regular key |
| **Stated at startup** | The `Analysis execution mode` log line carries the caps, the reserve, the anonymous policy and the allowlist size beside the mode, so what bounds an instance is read from its own boot line |

## 4. The key: a mounted file, never an environment variable

`ANTHROPIC_API_KEY_FILE` is read once by `loadConfig`; setting it together
with `ANTHROPIC_API_KEY` is refused, an empty or unreadable file is refused
naming the path and never the contents. `docker-compose.live.yml` bind-mounts
`NAIGX_PROVIDER_KEY_FILE` (a host path outside the repository) read-only into
the backend service only — the D-61 root-key pattern. The key never enters
`deploy/.env`, a compose file, `docker inspect` output, `/proc/<pid>/environ`
or an image layer. The overlay is the **only** place a metered mode is
switched on, and only by naming it on the command line: `docker-compose.prod.yml`
alone deploys replay, as before.

## 5. What the owner can do with each input type today — and what is missing

From the audit of `PRD §8`, `AI §9.1`, `contracts.ts`, `stages.ts` and the
decision records (2026-09-09). **Deferred** = a decision record or owner
instruction names it; **unfinished** = required, no record.

| Path (priority) | What you get today | What the spec also requires | Deferred by | Unfinished, no record |
|---|---|---|---|---|
| **Business requirement** (`FR-020`, P0) | Intent brief; context set with stated/inferred/unknowns; **architecture** (Stage 6) with components, data flow, trade-offs and ≥1 rejected approach, shown in the reasoning hierarchy and the export | Business analysis, platform comparison, risk assessment, complexity score, Mermaid diagram (all P0); roadmap, edge cases, integration, executive summary (P1) | `platform_recommendation` — owner standing constraint + D-39; complexity — D-33/D-35/D-36; P1 set — `MVP §5.3`; D-40 | **Business analysis artifact** (never declared); risk assessment and diagram exist as renderers on other paths but are not planned here |
| **Job description** (`FR-022`, P0) | Intent brief; required-skill extraction and gap verdict (Stage 7, `apply_now` / `build_first` with rationale, criteria and a rejected alternative); **portfolio suggestions** when the verdict is `build_first` | Skill gap analysis and interview guidance artifacts (P0) | D-29 (additive generators; Stage 9 per-generator prompt resolution is the recorded prerequisite) | — |
| **Existing workflow** (`FR-021`, P0) | Intent brief; workflow review (structure, findings with severity and remediation, or an explicit soundness statement); **workflow recommendation** and **risk assessment** artifacts | Platform comparison, complexity score (P0); edge cases (P1) | D-40; D-33/D-35/D-36; `MVP §5.3` | — |
| **Technical assessment** (`FR-023`, P1) | Intent brief; architecture with trade-offs and a rejected alternative; **assessment feedback** and **Mermaid diagram** artifacts | Nothing further at P1 | — | — |

**Missing stages, and what their absence costs** (`AI §3.2`):

| Stage | Absent means | Affects | Record |
|---|---|---|---|
| 4 Knowledge assembly | No platform knowledge, currency labels or neutrality constraints feed Stage 6; the specified compensator (reduced confidence) cannot fire because Stage 11 is also absent | **Usefulness** of architecture and platform reasoning; recommendations rest on the model's own knowledge with no currency label | D-15 (defer, "no amendment needed if 4–5 land before release") |
| 10 Response validation | Only the schema class runs (inline at Stage 9). Rationale completeness, reference integrity, provenance integrity, **unsupported-claim detection** and **cross-artifact consistency** do not. D-38 measured the exposure: Stage 6 cited 20 of 71 unknowns (28%) with no disposition | **Correctness** guarantees are weaker than specified; nothing catches a diagram that disagrees with its architecture | **None — unfinished** |
| 11 Confidence evaluation | No confidence bands anywhere; `FR-045`/`FR-018` unmet; the UI says "unavailable" honestly | Usefulness: the reader must judge confidence unaided | D-32/D-33 (weights uncalibratable without captures) |
| 12 Response assembly | No single step guarantees disclosure completeness; each of seven return branches assembles its own result. Omission reasons and failure labels are carried (`FR-091`), so the content exists; the guarantee does not | Correctness of *disclosure*, not of reasoning | **None — unfinished** |

**For finish line 1 this means:** the four paths are usable for real work
today with the outputs in the first column, and the owner reads them knowing
the second and fourth columns are absent. No prohibited feature is built
here — `platform_recommendation` stays out per the standing instruction, no
target is relaxed, and the Stage 3 retry proposal (log §11.6) is **not**
implemented, as directed.

## 6. The production switch — APPROVED and APPLIED 2026-09-09 (see §9 for what was verified)

> Approved by the owner 2026-09-09 with the values below (allowlist = the owner's address; caps 3.00 / 30.00; Sonnet 5 at medium effort; anonymous disabled; the new account's key via the mounted file).

Production stays in **replay mode with no provider credentials** until the
owner approves this exact configuration. The runbook section *The owner-only
live switch* in `deploy/README.md` carries the commands; the values are:

| Setting | Value | Note |
|---|---|---|
| Overlay | `docker-compose.live.yml` named on the command line | Only the backend is recreated |
| `NAIGX_EXECUTION_MODE` | `live` | Set by the overlay, nowhere else |
| `NAIGX_PROVIDER_KEY_FILE` | `/etc/naigx/provider.key` (host path, `chmod 600`, root) | The **new** account's key; the retired account is never used. Created by the owner or under the owner's direction; contents never printed |
| `PROVIDER_MODEL` / rates / effort | `claude-sonnet-5`, `2.00` / `10.00` per MTok, `medium` | D-65; rates re-verified 2026-09-09 |
| `NAIGX_ACCESS_ALLOWLIST` | the owner's account email | **The owner supplies the address.** Registration is then possible for that address only |
| `NAIGX_ANONYMOUS_ANALYSIS` | `disabled` | |
| `NAIGX_SPEND_CAP_USD_PER_DAY` | **`3.00`** (proposed) | ~10–40 analyses/day at $0.06–0.27; the D-47 limit already caps 10/hour |
| `NAIGX_SPEND_CAP_USD_PER_MONTH` | **`30.00`** (proposed) | Bounds a month at 30% of the account balance; the owner may set any decimal |
| `NAIGX_SPEND_RESERVE_USD_PER_ANALYSIS` | `0.30` (default) | Worst recorded per-analysis cost |
| Rollback | `naigx-backend:rollback-<sha>` tag + the same `up -d backend` without the overlay | Switching back is a configuration change, not a rebuild |

**Verification after the switch** (the "real end-to-end production
verification" the owner asked for): startup log shows the controls; readiness
200; the key absent from the container environment; anonymous `POST` → 401
and stranger registration → 403 (free); the owner registers and submits **one
real input per path** — four billed analyses, estimated **$0.40–0.80** total,
each read back through the UI and exported. Then the spend guard is exercised
without spending: temporarily set the day cap below the reserve, confirm the
429, restore it.

## 7. Verification (offline, done)

| Check | Result |
|---|---|
| Config: key file read; both sources refused; empty/unreadable refused without echoing contents; allowlist parsed, lowercased, validated; anonymous policy exact; caps decimal-validated; default reserve | ✅ `tests/unit/config.test.ts` |
| Spend guard: exact decimal arithmetic; UTC windows; reserve charged before admission; at-cap admitted / one unit over refused; monthly independent of daily; unreadable ledger refuses; no-cap guard refuses to construct | ✅ `tests/unit/spend-guard.test.ts` |
| Principal: allowlisted session resolves; other account → none; missing email → none; without an allowlist the session select is byte-identical to before | ✅ `tests/unit/auth-principal.test.ts` |
| `API-020`: anonymous refused 401 with nothing written and the guard not asked; FR-004 default unchanged; D-47 limit refuses the 11th; cap refusal 429 naming window and reset, spent amount not on the wire, no row; unknown-spend refusal | ✅ `tests/contract/analyses-owner-only.test.ts` |
| Registration/sign-in allowlist against real Postgres: stranger 403 before lookup; owner registers (case-insensitive) and reaches `/users/me` | ✅ `tests/integration/auth-endpoints-postgres.test.ts` |
| Live startup refuses without caps or an explicit anonymous policy | ✅ `src/index.ts` `liveProvider`; exercised in the local live-switch rehearsal (§8) |
| Full suite, lint, format, build, boundary checks | ✅ 1004/0 (Postgres suites required), lint, format, build, boundary 8/0 — before the switch; 1005/0 after the correction-flow change |
| **Correction flow** (`FR-014`): `API-021` returns `input.content` to the owning account, opened from the sealed column at the one route that proved ownership; never to an anonymous principal (404); the frontend seeds its correction state from it so an analysis opened from history is correctable | ✅ `tests/contract/analyses-owner-only.test.ts`; frontend build |
| Owner-only UI wording: the sign-up toggle reads *Create the owner account* and states the restriction; refusals display the API's message | ✅ frontend lint + build (no test runner, M-12 limitation 1) |

## 8. Local rehearsal of the switch — done 2026-09-09

The compiled `dist/` of this change, run locally in **live** mode against the
local databases with the new account's key in a `chmod 600` file (deleted
afterwards), exactly as the overlay would run it. Production untouched.

| Step | Observed |
|---|---|
| Live without caps | Refused at startup: *"Live execution requires NAIGX_SPEND_CAP_USD_PER_DAY and …_PER_MONTH"* |
| Live without an explicit anonymous policy | Refused: *"requires NAIGX_ANONYMOUS_ANALYSIS to be set explicitly"* |
| Key in both env and file | Refused: *"both set — set exactly one"*; the key appears in no output |
| Start with allowlist, `disabled`, caps 3.00 / 30.00 | Readiness 200; boot line: `mode:live metered:true spendCaps:{3.00,30.00} reserve:0.30 anonymousAnalysis:disabled accessAllowlist:1 account(s)`; key absent from the log |
| Stranger registers | **403** `forbidden` |
| Owner registers (mixed-case address vs lowercased list) | **201**; `/users/me` **200** |
| Anonymous submits | **401** `unauthenticated`, nothing written |
| Owner submits against a 3.00 cap with **$8.6253** already recorded today in the local ledger (every sample of the day, both accounts — reconciles with the handoff ledger) | **429** naming the day window and `retry_after_seconds`; the amount spent is in the server log only, not on the wire; **0 rows written** |
| Restart with a 9.50 cap; owner submits a real business-requirement input | **completed in 47 s**, 4 calls (Stages 1, 2, 3, 6), intent brief `generated`, architecture produced; **$0.0688 recorded** |

That last row is the only spend of the rehearsal: **$0.0688**, within the
stated ≤ $0.30 bound. Cumulative under the owner's continuation cap after it:
$8.6918 recorded / $8.8259 budgeted; the owner has said the remaining figure
is not a hard stop.

## 9. Production switch and verification — 2026-09-09

**Provisioning.** The new account's key was streamed from the local env file
over the SSH channel into `/etc/naigx/keys/provider.key` on the host —
owner `1000:1000` (the container's `node` user), mode `400`, 108 bytes,
newline-free, prefix verified — mirroring the root key (D-61). It was never
printed, never in `deploy/.env` (mode 600, gitignored, 0 key matches), never
in the resolved compose config (0 matches), never in Git.

**Switch.** `docker-compose.live.yml` applied to the backend only
(`up -d backend`), image `de27c39b8888` unchanged. Boot line:
`mode:live metered:true spendCaps:{3.00,30.00} reserve:0.30
anonymousAnalysis:disabled accessAllowlist:1 account(s)`; no replay corpus
loaded; readiness 200 in-container and publicly (TLS verify 0). In the
container the file is `400 node:node`, **readable by the process user, not
writable**; `ANTHROPIC_API_KEY` absent from the environment; 0 key matches
in `docker inspect` and in the logs.

**Refusals (free).** Anonymous `POST /analyses` → 401. Stranger `POST /users`
→ 403. Sign-in of a pre-allowlist verification account → 403.

**Four billed end-to-end checks** through the public API with a temporary
allowlisted verification account, under a **$1.00** budget gated between
runs against the production trace ledger (which read $0.0000 before):

| Path | Outcome | First artifact | Full | Calls | Cost |
|---|---|---|---|---|---|
| business_requirement (br-001) | completed | 12.6 s | 69.8 s | 4 | $0.0956 |
| technical_assessment (ta-005) | completed, assessment_feedback + mermaid_diagram generated | 9.1 s | 47.1 s | 4 | $0.0628 |
| existing_workflow (ew-001) | completed, workflow_recommendation + risk_assessment generated | 8.0 s | 63.0 s | 4 | $0.0956 |
| job_description (jd-002) | completed, portfolio_suggestions generated | 10.1 s | 104.6 s | 5 | $0.1474 |

**Total $0.4013**, harness and production ledger agreeing exactly. Exports on
the assessment: Markdown 200 (10,825 bytes, carries *Intent Brief*), PDF 200
(97,182 bytes, `%PDF-1.4`). The UI serves at `/` (200, app root and bundle).

**Spend cap, without a paid call.** Day cap lowered to 0.10 (below the 0.30
reserve), backend recreated, a second temporary allowlisted account
registered and submitted → **429** naming the day window and the reset;
**0 analysis rows** for that account; one guard refusal in the log. Cap
restored to 3.00.

**Allowlist narrowed to the owner's address alone**, backend recreated:
boot line `accessAllowlist:1 account(s)`; the second verification account's
existing session → **401** on `/users/me`; both verification accounts'
sign-in → **403**; anonymous → 401; the owner's address reaches registration
validation (400 on a deliberately short password, no account created). ⚠️ The
two verification accounts remain as inert rows (`naigx-verify-2026-09-09@`
and `naigx-verify-b@naigx.test`) with 4 + 0 analyses; they cannot sign in or
be reached. Deleting them is the owner's call — an SQL delete would cascade
their analyses; the trace-store cost rows would remain as ledger entries.

**Rollback verified for real.** The overlay-free config resolves with 0 mode
lines and 0 key mounts. `up -d backend` without the overlay: **replay ready
in 2 s**, corpus 15/54 served, 0 provider variables. With the overlay again:
**live ready in 3 s**, controls intact. Public readiness 200 throughout.
Rollback tags on the host: `rollback-edaeb08`, `rollback-7cb3eb6`,
`rollback-a12ce54`, `rollback-1da10e3`, `rollback-target`.

**Spend this step:** $0.4013. Under the owner's continuation ledger:
$9.0931 recorded (the owner has stated the earlier remaining figure is not a
hard stop). The instance's own caps now bound production: 3.00 / day,
30.00 / month, checked before every analysis.
