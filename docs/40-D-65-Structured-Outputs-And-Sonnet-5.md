# D-65 — Structured outputs at the provider boundary, and the move to Claude Sonnet 5

**Date:** 2026-09-09
**Status:** Accepted — on the owner's instruction of 2026-09-09 to switch live analysis to Sonnet 5 and fix the integration end to end. Verification section records what was actually run.
**Sprint:** 5
**Resolves:** the 2026-09-08 Sonnet 5 pilot's open finding (`STATUS.md` → *Sonnet 5 Pilot*), which named `output_config.format` as the indicated lever and required its own record
**Affects:** `AI §10.2`, `AI §10.5`, `AI §10.6`, `AI-005`, `AIP-7`, `FR-024`, `FR-039`, `src/provider/adapters/anthropic.ts`, `src/nie/output-schemas.ts`, `src/config/env.ts`, the composition roots (`index.ts`, `harness/run.ts`, `scripts/regression.mts`)
**Builds on** D-10, D-11, D-17, D-29, D-63, D-64. Supersedes nothing.

---

## 1. The question

The pilot rejected `claude-sonnet-5` on **schema conformance**: 3 of 3 analyses
failed a parser on the *shape* of the JSON — `category: "unknown"`, a
`decisive_gaps` that was not an array, a `specificity_score` that was not a
number — and the same input failed differently on repeat because Sonnet 5
rejects `temperature`, so `AIP-7`'s low-variance sampling could not be asked
for. The adapter declared `structuredOutput: false` and relied on prompt
instruction plus validation, which `AI §10.2` documents as the degraded mode.

The 2026-09-09 live measurement then recorded the same failure class on
Sonnet 4.5 (`category: "unknown"`, run 3 of 11). So the question is not
"which model conforms better" — the pilot itself said that comparison was
uncontrolled — but **whether shape conformance should rest on the prompt at
all**, when the provider offers constrained decoding against a schema.

## 2. The decision

**Three things, one boundary.**

1. **Structured outputs, per stage, applied inside the adapter.** The
   composition root hands the Anthropic adapter a registry of JSON schemas
   keyed by `CapabilityRequest.task` (`src/nie/output-schemas.ts`). For a task
   it names, the adapter sends `output_config.format = { type: "json_schema",
   schema }` and the provider constrains decoding to it. The
   `CapabilityRequest` itself is **unchanged** — task, input, instructions,
   preference — so `replayKeyFor` produces the same key it always did and
   every recording in the canonical store remains replayable (D-17, D-63).
   `structuredOutput` is declared `true` only when a registry is supplied
   (`AI §10.6`); a task the registry does not name is recorded as a
   `structured_output_unavailable` degradation, never guessed at.

2. **Sampling parameters are a property of the model generation.** The
   migration guide (verified 2026-09-09) states that on Sonnet 5, Opus 5 and
   the Fable/Mythos line any non-default `temperature`, `top_p` or `top_k`
   returns 400. The adapter keeps a one-line table of that generation, declares
   `lowVarianceSampling` from it, sends `temperature: 0` only where it is
   accepted, and otherwise records `low_variance_unavailable` — exactly the
   `AI §10.2` behaviour the pilot observed working. `FR-024` reproducibility
   is therefore **reduced on Sonnet 5 by construction**, and the trace says so
   on every call (`fallback_used`).

3. **Adaptive thinking is steered, not fought.** Sonnet 5 thinks by default;
   depth is `output_config.effort`, configured as `PROVIDER_EFFORT` and
   validated at startup. `max_tokens` doubles on thinking models because
   reasoning shares the budget. `thinking` blocks are skipped by *type*;
   `stop_reason: "refusal"` is a persistent failure; `stop_reason:
   "max_tokens"` is a malformed response granted the one retry `AI §10.4`
   already defines.

## 3. What the schemas are, and are not

Each schema states the **shape** the stage parser accepts, in the dialect
constrained decoding supports (`additionalProperties: false` on every object,
every property required, optional fields nullable, no numeric or string
constraints). The vocabulary is **imported from `contracts.ts`**, never
copied. The parsers in `stages/` run unchanged on every response, and
everything a schema cannot say — a `source_quote` present in the input, a
context index in range, `matched`/`gaps` covering every requirement, a total
order on `rank` — is still theirs. The published artifact schemas stay the
`FR-039` authority; the `portfolio_suggestions` entry is a *derived* shape,
because the published one uses `if`/`then`, `minimum`, `pattern`,
`minLength`, `uniqueItems` and `maxItems`, none of which constrained decoding
accepts.

⚠️ **This weakens no gate.** The activation gate, the manifest gate, the
parsers and the artifact validators are untouched. What changes is *where
shape failures happen*: nowhere, instead of at the parser.

**Proved free before any spend:** `tests/unit/output-schemas.test.ts`
validates all 54 recorded stage outputs in the canonical corpus against their
stage schema with only `additionalProperties` relaxed — the schemas accept
everything the parsers accepted — and checks every schema is in the supported
dialect. `tests/unit/anthropic-sonnet5.test.ts` pins the request the adapter
builds per generation against an injected client.

## 4. Capture, replay, and the evidence already held

- **Replay keys do not move.** Nothing in the request changed. All 15
  recordings and reference `d4abcd42626452df` stand.
- **Capture is built exactly as production is built** — same registry, same
  effort — in `scripts/regression.mts`, so a Sonnet 5 recording is an answer
  to a request production sends. A recording carries `lowVarianceSampling:
  false` and `modelKey: claude-sonnet-5`, honestly.
- **Sonnet 4.5 recordings remain Sonnet 4.5 evidence.** A pass reference from
  them attests the *composition* (D-64), not the model. Activating any future
  fragment on Sonnet 5 needs a Sonnet 5 recording through the same gate.
- **Model-attributed metrics are model-attributed.** The `M-20` live figures
  in `docs/performance/M-20-LATENCY-LOG.md` §7 are Sonnet 4.5 figures and are
  not relabelled.

## 5. What was rejected

**Sending the schema as `outputContract` on the `CapabilityRequest`.** The
port already has the field. Rejected because `replayKeyFor` hashes it: every
fixture key would move, the fixture builder would need every stage's schema,
and the recorded corpus would be un-replayable until re-keyed — the exact
class of capture/replay divergence that has cost this project three times.

**Turning thinking off** (`thinking: {type: "disabled"}`) to recover
`temperature`-like determinism. Rejected: sampling parameters are rejected
regardless, and the pilot showed thinking did not inflate output tokens.
Effort is the documented control and is configurable.

**Relaxing a parser** where the pilot's failures landed. Rejected without
discussion — it would make the contract match the model rather than the
model match the contract (`AI §12.2`'s "a suite that drifts to match output
measures nothing", applied to parsers).

**Keeping Sonnet 4.5.** Not a rejection of the model — it remains a valid
configuration and the adapter still serves it — but the owner directed the
switch, the pilot's blocker is addressed at its cause, and the pricing is
lower ($2/$10 versus $3/$15, with a tokenizer that produces ~30% more tokens).

## 6. Consequences

| Consequence | Handling |
|---|---|
| `AI §10.6` declarations changed | `structuredOutput` true with a registry; `lowVarianceSampling` per model generation |
| `FR-024` on Sonnet 5 | Reduced by construction; recorded per call. A `--repeat` regression run is the measurement, not a claim |
| New configuration | `PROVIDER_EFFORT` (validated); `.env.example` updated; production `deploy/.env` carries **no** provider variables and stays replay |
| Token accounting | Sonnet 5's tokenizer produces ~30% more tokens for the same text; cost per analysis must be re-based from real runs, not scaled from Sonnet 4.5 |
| Latency | Thinking adds time. `NFR-001`/`NFR-002` were already NOT MET on Sonnet 4.5 (§7 of the latency log); Sonnet 5 figures are recorded when measured, never assumed |
| A new failure class handled | `stop_reason: "refusal"` (Sonnet 5 cyber safeguards) → persistent, neutral message |
| Revisit trigger | A provider change, or a model whose structured-output dialect differs |

## 7. Verification

Recorded below as runs happen. Free checks first.

| Check | Result |
|---|---|
| Adapter request shape per generation (8 unit tests, injected client) | ✅ pass |
| Every schema in the constrained-decoding dialect | ✅ pass |
| All 54 canonical recorded outputs satisfy their stage schema (relaxed `additionalProperties`) | ✅ pass |
| Provider conformance suite (`AI-005`), unchanged | ✅ pass |
| Endpoint and model through the application's config loader, unbilled | ✅ `https://api.anthropic.com`, `models.retrieve("claude-sonnet-5")` 200, organisation `50a4c891-…` |
| **Account identity** | ✅ The owner confirmed in the Console that the funded account's Organization ID is `50a4c891-ba45-4afe-bf8b-12027d721087`, matching the header the API returns for key `…aQAA`. Balance stated by the owner: $100 (the account's, not the task's) |
| Minimal request through `loadConfig` → `createAnthropicProvider` with the schema registry | ✅ `input_classification` on a one-sentence input: schema-shaped JSON back, `low_variance_unavailable` recorded, 548 in / 61 out, **$0.0017** |
| Live Sonnet 5 analyses across the four paths, **compiled application**, `effort: medium` | ✅ see below |

### 7.1 The four-path run — 2026-09-09, compiled `dist/`, live, new account only

| Case | Path | Outcome | Artifacts | Wall clock | Calls | Cost |
|---|---|---|---|---|---|---|
| br-001 | business_requirement | **completed** | none by design | 123.4 s | 4 | $0.0875 |
| ew-001 | existing_workflow | **completed** | `workflow_recommendation`, `risk_assessment` generated | 140.9 s | 4 | $0.1056 |
| ta-005 | technical_assessment | **completed** | `assessment_feedback`, `mermaid_diagram` generated | 85.2 s | 4 | $0.0622 |
| jd-002 (first) | job_description | **timed_out** at the 180 s executor deadline — see 7.2 | Stage 9 reached; artifact refused by the published schema; regeneration fired and finished after the cut | 180.0 s (cut) | 6 | $0.1805 |
| jd-002 (rerun, after 7.2) | job_description | **completed** — **Stage 9 generated, `validation_status: valid`, 1 project, single attempt** | `portfolio_suggestions` generated | 112.7 s | 5 | $0.1538 |

**No stage failed on shape anywhere.** Every provider call was a single
attempt; every call carries `fallback_used = true` — the honest
`low_variance_unavailable` record, the same differential the pilot saw.
Context extraction on Sonnet 5 at `medium` effort took 21–95 s per call
(the pilot recorded 21 s); recommendation generation 49–53 s; portfolio
suggestions 21–28 s.

### 7.2 What the first run's timeout actually was — from the stored timestamps

The claim "about 195 s" needed reconciling with a 180 s deadline and a
113 s rerun. The trace store settles it (analysis `05c8b778…`, created
09:41:58.047, deadline 180 s = **default**, no override):

| t (s) | Event |
|---|---|
| 0.0 | created; Stage 1 |
| 2.5 | Stage 2 |
| 8.8 | Stage 3 — **93.2 s** of context extraction at `medium` effort |
| 102.1 | Stage 7 — 49.5 s |
| 151.6 | Stage 9, attempt 1 — 20.7 s |
| 172.3 | attempt 1 refused by the published schema (`why_not_consolidated: ""`); **regeneration starts, 7.7 s before the deadline** |
| **180.0** | deadline: status `timed_out`, `complete` event emitted |
| 194.7 | regeneration finishes (22.4 s), also refused; artifact row written `failed`, 14.7 s after the analysis was reported terminal |

So "195 s" was the pipeline's *total work including the regeneration*.
Without the empty-field refusal the run would have finished at **172 s,
inside the deadline**. The earlier statement that the deadline is
"structurally short" for this path was **overstated**: the driver is
variance — context extraction took 93 s here and **21.5 s** on the rerun
(112.7 s total) — compounded by one regeneration. The Sonnet 4.5 sample
showed the same shape (its run 10: Stage 9 of 131.9 s, finished 44 s after
the deadline).

**Why Stage 9 continued after the timeout — the actual defect.** The
executor's deadline raced the pipeline promise and, on losing, *stopped
waiting*: nothing was cancelled. The code said so explicitly ("the pipeline
promise is not cancellable and is deliberately left to settle"). The
consequences, all observed: the regeneration started 7.7 s before the
deadline ran to completion and was **billed ($0.0269)**; its result was
written to a terminal analysis; on the Sonnet 4.5 run a *valid* artifact
was persisted 44 s after `timed_out`; and had the cutoff landed a stage
earlier, every later stage would still have started a **new** paid call.
`SA §11` says *terminate; preserve completed artifacts*. Cost after the
deadline was therefore real but bounded to calls already in flight —
because the deadline happened to fall inside the last stage both times.

**The fix (this record, 2026-09-09) — cancellation, not a longer deadline:**

- the executor aborts an `AbortSignal` at the deadline, *before* writing
  the terminal status;
- the pipeline starts no stage and no provider call once aborted, and the
  stage in flight records `Cancelled: the analysis reached its deadline…`
  as its failure — `FR-094`'s "incomplete ones labelled";
- the invoker starts no attempt, first or retry, once aborted — for every
  adapter, so the guarantee does not depend on abort support;
- the Anthropic adapter forwards the signal to the SDK, so the request in
  flight is aborted at the HTTP layer, and classifies the abort as
  non-retryable with no provider identity in the message.

Everything committed before the cutoff stays committed (`DB §6.2`); final
status and the terminal event are unchanged and follow `API §7.4`. What
changes is that a terminal analysis can no longer spend or write. Pinned by
`tests/unit/cancellation.test.ts` (invoker, pipeline, adapter) and the
executor test in `tests/integration/analysis-execution.test.ts`.

⚠️ **A provider bills the tokens it generated before an abort.** Cancelling
an in-flight call bounds spend; it does not refund it.

**Verified live, 2026-09-09, on the new account** — the compiled backend
with `NAIGX_ANALYSIS_TIMEOUT_MS=30000` (local, deliberately short), br-001
submitted through the API (analysis `bd55be4a…`):

| t (s) | Observed |
|---|---|
| 0.0 | created; Stage 1, 2.5 s, $0.0066 |
| 2.6 | Stage 2, 7.6 s, $0.0120 |
| 10.2 | Stage 3 call in flight |
| **30.04** | deadline: status `timed_out`, `timeout_flag` and `degradation_flag` true |
| 30.06 | Stage 3 trace closed: **failure, `Provider request was cancelled at the analysis deadline`, `error_class: persistent`**, call latency 19.9 s |
| +60 s | **no Stage 6 call, no further trace, no artifact, no write of any kind** after the terminal status |

Final status and the terminal event follow `API §7.4` unchanged. The
abort reached the SDK: the call ended at the deadline, not at the model's
own pace.

⚠️ **Accounting limit found by this run:** an aborted invocation is
recorded at **$0.00**, because an aborted response carries no `usage`,
while the provider bills the tokens generated before the abort. The trace
store therefore *understates* the cost of every cancelled call; only the
Console can show the true figure. Bounded above by a full call of that
stage — for this run, a complete Stage 3 on br-001 cost $0.039 on Sonnet 5.
Recorded as an open item in `STATUS.md`; not fixable from the response.

**`why_not_consolidated`.** Asked for it on a multi-gap project, the model
wrote `""`, and the published artifact schema correctly refused it. The
dialect permits optional properties, so the field is optional in the
request schema — which is exactly the authoritative contract: the
published schema requires it only for a single-gap project (`if`/`then`)
and rejects it when present-but-empty, and the parser (`docs/12` D-29)
enforces the single-gap rule. `tests/unit/output-schemas.test.ts` §3 proves
all four cases against `validateArtifact`. The rerun validated first time.

**Deadline override, per run.** Sonnet 4.5 sample (11 attempts): 180 s
default. Sonnet 5 four-path run: 180 s default. Sonnet 5 jd-002 rerun:
`NAIGX_ANALYSIS_TIMEOUT_MS=420000`, local only. **The default stays 180 s**
and production sets nothing. Whether it should move is a requirements
question beside `NFR-002`, left open.

### 7.3 Spend, reconciled from the trace store

Every call is a `provider_invocation` row with `estimated_cost` at the
verified $2 / $10 rates. Reconciled after the runs, not summed from the
harness — the first jd-002 run's regeneration finished *after* the analysis
was marked `timed_out`, so the harness's figure for it was low by one call.

| | Calls | Cost |
|---|---|---|
| Minimal request (adapter, not traced; from returned usage) | 1 | $0.0017 |
| Four-path run (jd-002 first attempt 6 calls, the others 4 each) | 18 | $0.4359 |
| jd-002 rerun | 5 | $0.1538 |
| Cancellation verification (br-001 under a 30 s deadline): 2 completed calls recorded + 1 aborted call recorded at $0 | 3 | $0.0186 recorded; **+ up to $0.039 unrecorded** for the aborted call |
| **New account, this record** | **27** | **$0.6100 recorded; ≤ $0.6490 with the aborted call's upper bound** |
| Retired account, earlier this continuation — ⚠️ corrected: the harness read the timed-out run before its two post-deadline Stage 9 calls landed ($0.1051 more than reported) | 65 | $1.2370 |
| **Continuation total** | **92** | **$1.8470 recorded; budgeted at the upper bound $1.8860** of the US$10 cap — **$8.1140 remaining** |

Both timed-out runs are counted **in full**, including every call that
finished after the deadline. With cancellation in place a future timeout
can add at most the one call in flight.

Token totals for the 23 traced Sonnet 5 calls: 109,776 in / 37,011 out.
The new tokenizer's ~30% inflation is visible in the per-call input counts
(3,000+ tokens for a Stage 1 call that was ~2,300 on Sonnet 4.5), and the
lower per-token price roughly cancels it: per completed analysis, Sonnet 5
at `medium` cost $0.06–$0.15 against Sonnet 4.5's $0.07–$0.19 on the same
cases.

## 8. ⚠️ Account identity — what the key can and cannot say

A regular API key reveals, through the API itself, only the
`anthropic-organization-id` response header: **`50a4c891-ba45-4afe-bf8b-12027d721087`**
for the key now in `backend/.env` (suffix `…aQAA`). It does **not** reveal the
organisation's name, the workspace the key belongs to, or the credit balance;
there is no balance endpoint, and workspace listings need an Admin API key.
So a successful request proves the key has credit somewhere — not that it is
the account the owner intends. That confirmation is the owner's, from the
Console: Settings → Organization (the Organization ID) and Plans & Billing
(the balance). It is recorded in §7 when given.
