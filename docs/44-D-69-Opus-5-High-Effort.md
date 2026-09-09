# D-69 — Claude Opus 5 at high effort for the owner-only instance

**Date:** 2026-09-09
**Status:** Accepted — on the owner's direction: "change it to opus 5 high effort instead" (the owner first asked for "Opus 5.1", which does not exist; the choice was made from the current model list)
**Sprint:** 5 (continuation), finish line 1 (D-67)
**Resolves:** which model the owner's live instance reasons with, and what that changes about cost, time and the spend controls
**Affects:** production configuration only — `deploy/.env` on the host (values, never the key), `docker-compose.live.yml` (passes the deadline), D-67's caps and reserve. **No code, prompt, schema, gate or requirement changes.**
**Builds on** D-65 (the adapter treats the 5-generation models alike: adaptive thinking, no sampling parameters, structured outputs), D-67.

---

## 1. The facts the choice rests on

Verified against the models overview and the pricing page on 2026-09-09:

| Model | API id | Input / output per MTok | Thinking | Default effort |
|---|---|---|---|---|
| Claude Sonnet 5 (before) | `claude-sonnet-5` | $2 / $10 | adaptive | high (run at `medium`) |
| **Claude Opus 5 (now)** | `claude-opus-5` | **$5 / $25** | adaptive | high |
| Claude Fable 5.1 | `claude-fable-5-1` | $10 / $50 | adaptive, always on | high |

There is no "Opus 5.1". The adapter's generation table already covers
`claude-opus-5` (D-65: `THINKING_GENERATION` matches `opus-5`), so the
switch is configuration.

## 2. What changes with it

| Setting | Before | Now | Why |
|---|---|---|---|
| `PROVIDER_MODEL` | `claude-sonnet-5` | `claude-opus-5` | the owner's choice |
| Rates | 2.00 / 10.00 | **5.00 / 25.00** | the published figures, re-verified today (D-58 §6) |
| `PROVIDER_EFFORT` | `medium` | **`high`** | the owner's choice; more thinking tokens, slower, costlier |
| `NAIGX_ANALYSIS_TIMEOUT_MS` | 180 000 (default) | **420 000** | Sonnet 5 at high effort ran the JD path at ~195 s (D-65 pilot); Opus is slower again. An execution guard — `NFR-002`'s 60 / 120 s target is unchanged and stays NOT MET |
| `NAIGX_SPEND_RESERVE_USD_PER_ANALYSIS` | 0.30 | **1.00** | the reserve is the worst per-analysis cost the guard charges before admission; at 2.5× the rate plus high effort, a JD analysis is expected at $0.50–0.90 |
| Caps | 3.00 / day, 30.00 / month | **unchanged** | the owner's approved values; with a 1.00 reserve the day admits until $2.00 has been spent, i.e. ~2–3 analyses. The owner was told and may raise it |

Expected per analysis, from the Sonnet 5 token counts scaled by rate and
effort: business requirement ~$0.30–0.45, workflow / assessment ~$0.25–0.40,
job description ~$0.50–0.90. Latency: expect 1.5–2.5× the §11 figures.

## 3. Rollback

Set the six values back in `deploy/.env` and `up -d backend`. No image
changes; the replay rollback (D-67) is unaffected.

## 4. Verification

| Check | Result |
|---|---|
| Container reports `PROVIDER_MODEL=claude-opus-5`, effort `high`, deadline 420 000; boot line shows caps 3.00 / 30.00 and reserve 1.00; readiness 200; key still absent from env | ⏳ |
| One billed job-description run through the public API: completed, cost and time recorded, reconciled against the ledger | ⏳ (estimate ≤ $1.00) |
