# D-70 — The implementation plan: node-by-node, on the platform the project names

**Date:** 2026-09-10
**Status:** Accepted — on the owner's request: "include the nodes in n8n, what to use, how to set up, if I need to build the workflow."
**Sprint:** 5 (continuation), finish line 1 (D-67)
**Resolves:** what a build-first result owes a person who is going to build the project on an automation platform: which node, for which step, configured how, with which credential
**Affects:** `prompts/stage/portfolio_suggestions.md` (**a fragment change** — the D-63/D-64 route applies), `backend/schemas/portfolio_suggestions.schema.json` (published schema **v2**, `ARTIFACT_SCHEMA_VERSION` bumped), `backend/src/nie/output-schemas.ts`, `contracts.ts`, `stages/portfolio-suggestions.ts`, the summary card, the full renderer, the export
**Builds on** D-29 (the generator), D-63/D-64 (how a fragment change is gated), D-65 (structured outputs), D-68 (the decision-first view). **Changes no requirement, no other stage, no other fragment.**

---

## 1. What was missing

The build card told the owner *what* to build and *with which apps* — the
project's `workflow` steps and `platforms` — and stopped there. A person
opening n8n still had to work out which node does each step and how to
configure it. That knowledge is exactly what the model has and the contract
never asked for.

## 2. The decision

**The Stage 9 generator adds an `implementation` block to a project
whenever any platform it names is an automation platform (n8n, Make,
Zapier), and writes `null` when none is:**

```
implementation: {
  platform: "n8n",
  steps: [ { step: 1, node: "Webhook", purpose, setup: [..], credential: "HubSpot OAuth2 API" | null }, … ],
  notes: [ "error workflow …", "test with pinned data …", "no dedicated node for X — HTTP Request used" ]
}
```

- `step` is a 1-based index into the project's own `workflow`, so every node
  is placed against a step the reader already has. The parser refuses an
  index that is not a positive integer.
- `node` is the platform's own node name as the platform spells it. The
  fragment says **never invent a node**: when unsure, name `HTTP Request` or
  `Code` and say so in `notes`. That is the honesty rule applied to tooling.
- `setup` is what a person configures — operation, fields, expressions,
  method — and `credential` is the credential the node needs by the
  platform's name, or null.
- `null` for a project that names no automation platform. In the
  constrained-decoding contract the field is **required but nullable** — the
  first capture showed that an optional field is the easiest thing for a
  model to skip, so the model must now decide explicitly. The published
  schema accepts the block, `null`, or absence; the parser treats `null` and
  absence alike.

**Presentation.** The build card on the decision-first view shows *Build it
in n8n — node by node* in place of the plain step list when the block is
present (the plain list stays for projects without one); the full portfolio
renderer and the Markdown/PDF export carry the same block.

## 3. Why this goes through the fragment gate

The prompt fragment changed, and the published artifact schema — which is
injected as the Output Contract fragment (`AI §6.1`) — changed with it. So
Stage 9's composition hash changed, and D-64 §4.2 says exactly what follows:
the existing jd-002 recording no longer reproduces the composition, the
replay tests mark it excluded, and no existing pass reference can activate
the new fragment. The route is the one every fragment change takes:

1. Edit the fragment; review; `fragments:write` records the new hash
   (manifest still `fragments-v1`; the content hash is the identity).
2. `regression:capture --case=jd-002 --out=research/regression-pending
   --budget=3.00` — a **paid** capture against the candidate composition,
   held outside the canonical store (the held-recording discipline).
3. Admit the held recording — a decision, recorded here — replacing the
   prior jd-002 recording, which moves to `research/regression-superseded/`
   with its reason.
4. `regression:run --fragment=stage.portfolio_suggestions` — a **targeted**
   run naming the fragment's coverage (D-64 §4.4), issuing a new pass
   reference.
5. `fragments:publish --reference=<new>` locally and, from the new image,
   in production; `schemas publish` publishes v2 of every artifact schema
   (a changed schema is a new version, never an overwrite).

**Schema version 2.** `ARTIFACT_SCHEMA_VERSION` moves from `"1"` to `"2"`.
Every stored artifact keeps its reference to the v1 row it was validated
against (`RESTRICT`); new artifacts reference v2. The two tests that pinned
`"1"` were updated to pin `"2"` and to read the constant.

## 4. What is not changed

- No other stage, fragment or schema. The other 14 recordings reproduce
  their compositions unchanged.
- No requirement: `FR-022` asked for portfolio recommendations that are
  "specific and buildable"; this makes them buildable in the literal sense.
- Nothing invented: the block is model output under the same grounding rules
  as the rest of Stage 9, validated by schema, and the fragment forbids
  naming a node the model is not sure exists.
- The thin point stays thin: `stage.portfolio_suggestions` still rests on
  the jd-002 recording alone (handoff §7a), because jd-002 is the one case
  whose verdict reaches Stage 9. A second recorded build-first case is a
  capture-campaign question the owner has deferred.

## 5. Verification

| Check | Result |
|---|---|
| Typecheck, lint, format, build (backend), tsc + lint + build (frontend) | ✅ |
| Parser: a valid `implementation` is read; a bad step index or a non-string credential is refused; absent or null means absent | ✅ `tests/unit/nie-portfolio-suggestions.test.ts` |
| Published schema (v2) validates a project with the block, with null, and without; refuses empty steps and empty setup | ✅ `tests/unit/nie-derived-artifacts.test.ts` |
| Constrained-decoding dialect: the block is **required but nullable**; `why_not_consolidated` stays the only optional field | ✅ `tests/unit/output-schemas.test.ts` (whitelist unchanged) |
| Export renders the node-by-node block and omits it when absent | ✅ `tests/unit/export-intent-brief.test.ts` |
| Fragment manifest recorded; the old jd-002 recording reported excluded (composition mismatch) — the gate working | ✅ observed |
| Paid capture of jd-002 against the candidate composition | ✅ **two captures**, Opus 5 high, held outside the canonical store: the first ($0.5679) was against a version of the fragment that made the block *optional*, and was discarded unread after the inspection below was found to be of an old held file (a path mistake, recorded in §6); the second ($0.4965), against the **required-but-nullable** version, carries a 10-step n8n plan with real node names (Webhook, Code, Salesforce, IF, HTTP Request, Postgres, Schedule Trigger, Slack), credentials as n8n names them, and notes that decline to assume a dedicated node exists. **$1.0644 total**, under the $3.00 ceiling |
| Admission and the targeted regression run | ✅ old recording → `research/regression-superseded/jd-002-pre-D-70-2026-09-10.json` with its reason; new recording admitted; `regression:run --fragment=stage.portfolio_suggestions` → 1 passed → **`corpus-regression:corpus-v2+fragments-v1:6e1e63a24da922a9`** (targeted). All fifteen recordings then replay: 15 passed → `d1b67b9017b86257` |
| Local activation | ✅ schemas v2 published (6), fragment published under the targeted reference (1 new version, 14 unchanged) |
| Full suite | ✅ 1014 tests, 1008 pass, 0 fail (the two version-pinned tests corrected deliberately); lint, format, build, boundary 8/0 |
| Production: schemas v2 published, fragment activated under `6e1e63a24da922a9`, one owner-side check | ⏳ ships with the redesign deploy, on the owner's go |

## 6. Two things that went wrong on the way, recorded

- **The `--out=` path resolves against the repository root, not the working
  directory.** `--out=../research/regression-pending` from `backend/` wrote
  to a sibling folder *outside* the repository. Nothing was lost — the
  captures were found there and the folder removed after admission — but the
  inspection that followed the first capture read a **tracked historical
  held recording** at the expected path instead, concluded "block absent",
  and drove the contract change from optional to required-but-nullable. That
  change stands on its own merits (an optional field is the easiest thing for
  a model to skip; the second capture proves the required form works), but
  whether the optional form had already worked is unknown, because the first
  capture was overwritten by the second before being read. The historical
  held file, deleted in the confusion, was restored from Git.
- The pass reference for the fragment is **targeted** (`selectionScope:
  targeted`, coverage = jd-002) per D-64 §4.4. The thin point stays: one
  recording stands behind `stage.portfolio_suggestions`.
