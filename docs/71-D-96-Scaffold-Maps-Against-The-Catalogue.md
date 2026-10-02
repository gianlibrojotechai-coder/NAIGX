# D-96 — The n8n scaffold maps step names against every node n8n ships

**Date:** 2026-10-02
**Status:** Accepted — on the owner's "go" to the first of two defects found in their analysis `704fc3b1` (a Shopify / CRM / attribution posting)
**Sprint:** 5 (continuation), finish line 1 (D-67)
**Resolves:** a step named exactly as n8n names its node — "Shopify Trigger", "Twilio" — rendering as a "(replace me)" placeholder
**Affects:** `frontend/scripts/app-catalogue.mjs` (emits a second, backend catalogue), `backend/src/nie/n8n-node-catalogue.ts` (generated, new), `backend/src/nie/stages/n8n-workflow.ts` (`resolveType` falls back to it), `tests/unit/nie-n8n-workflow.test.ts`. **No prompt, fragment, schema, API or requirement change; no spend.**
**Builds on** D-71 (the scaffold and its hand-typed node table), D-94 (the catalogue generated from `n8n-nodes-base`).

---

## 1. What the owner's analysis showed

The `n8n_workflow` artifact of `704fc3b1` reported "10 of 12 mapped" and
listed two placeholders to replace by hand: **Shopify Trigger** and
**Twilio**. n8n ships both. D-71's table held about thirty names typed by
hand; anything outside it became `noOp` with "(replace me)" — honest, and
wrong about what n8n has. D-94 had since produced the complete list for the
frontend's picker, so the frontend knew 410 nodes while the renderer that
builds the file knew thirty.

## 2. The change

The generator now writes two files from the same read of the package: the
frontend catalogue unchanged, and `backend/src/nie/n8n-node-catalogue.ts` —
one row per node: display name, type, **oldest shipped version**, trigger or
not. `resolveType` consults D-71's table first, exactly as before, and only
then the catalogue:

| Rule | Example | Result |
|---|---|---|
| exact name | `Shopify Trigger` | `shopifyTrigger`, a trigger |
| bracketed or colon-qualified | `Twilio (SMS)` | `twilio` |
| leading word, names of six characters or more | `Google Ads report` | `googleAds` |
| leading word, shorter names | `Line items split` | placeholder — not the Line messaging node |
| not in n8n | `Klaviyo` | placeholder, as before |

Longest name first, so "Shopify Trigger" is found before "Shopify". The
oldest version is used for the same reason the table's versions are old:
every current n8n still imports it, and parameters are not set. The swap in
the presentation (D-94) keeps using the newest version, because there the
owner has chosen the app and is on a current n8n.

**Nothing the table already mapped changes** — same types, same versions —
so every stored and recorded scaffold whose steps were all in the table
renders byte-identically. A scaffold that had placeholders for nodes n8n
ships now maps them; stored `n8n_workflow` artifacts are not rewritten (they
are the record of what was rendered then), and a new analysis gets the new
mapping.

## 3. Verification

| Check | Result |
|---|---|
| Shopify Trigger, Twilio map from the catalogue; `steps_unmapped` empty; the document validates against the published `n8n_workflow` schema | ✅ `tests/unit/nie-n8n-workflow.test.ts` (D-96, 4 tests) |
| The table still wins and keeps its versions (HubSpot 1, Google Sheets 3) | ✅ same |
| Qualified names map; a short leading word and an unknown app stay placeholders | ✅ same |
| A catalogue trigger is never fed by the previous step | ✅ same |
| Full backend gate: typecheck clean, 1,069 passing, 95 skipped | ✅ 2026-10-02 |
| Deployed | ✅ **2026-10-02 ~12:05 UTC**: host at `7e11c23`, backend image `2a992098b427` (outgoing `1cf8e11ad6d4` tagged `naigx-backend:rollback-96c057f`), no migrations, no running analysis at the switch; healthy; readiness 200 inside and out; still `claude-opus-5-5`; the compiled renderer carries the catalogue fallback. A new job-description analysis will show the mapping; stored scaffolds are unchanged |

## 4. The second defect — scoped, not done

The same analysis says twice that "the candidate's own background is not
supplied" (in the Stage 2 scope and in the unknowns table) while its verdict
cites the capability profile throughout. Stages 2 and 3 see only the posting;
the profile reaches the pipeline at Stage 7. The fix is one sentence in
`prompts/type/job_description.md` telling the early stages that the
candidate's evidence is supplied separately, so its absence from the posting
is neither scope nor an unknown. That is a fragment change: the manifest
gate, a recapture of the two canonical job-description recordings (`jd-002`,
`jd-008`) through every stage the modifier composes into, and a pass
reference before activation — a paid capture the owner has not yet
authorised, estimated at $2–3.
