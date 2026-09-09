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
| Live Sonnet 5 analyses across the four paths, including `jd-002` through Stage 9 | ⏳ pending the owner's confirmation of the funded account (§8) |

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
