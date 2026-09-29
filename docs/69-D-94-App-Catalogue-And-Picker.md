# D-94 — Every app n8n ships, as a catalogue the owner can pick from

**Date:** 2026-09-29
**Status:** Accepted — on the owner's direction: "how can it show all available apps, so that I can choose from" → "go"
**Sprint:** 5 (continuation), finish line 1 (D-67)
**Resolves:** where "all available apps" comes from, and how the owner overrides NAIGX's app for a workflow step without a re-run
**Affects:** `frontend/scripts/app-catalogue.mjs` (new, the generator), `frontend/src/app-catalogue.ts` (generated), `frontend/src/apps.ts` (new), `frontend/src/components/AppPicker.tsx` (new), `frontend/src/components/JobPresentation.tsx` (swap controls, choices applied to the diagram, the toolkit and the n8n download). **No backend, API, artifact, prompt or schema change; no new generation; no spend.**
**Builds on** D-93 (the presentation), D-71 (the n8n scaffold and its node table), D-70 (the implementation plan the scaffold is built from).

---

## 1. The question, and the honest answer to it

The owner asked whether NAIGX picks apps only from a documented list, then
whether it could surface apps they do not know, then whether it could show
*all* available apps to choose from. The state before this record:

- The apps in a result are the **model's choice**, from training knowledge,
  with no catalogue behind it and no view of anything released after the
  model's cutoff (Stage 4 Knowledge Assembly is unbuilt by [D-88](63-D-88-Stage-4-Under-O-4.md)).
- The only fixed list anywhere was D-71's **node table** (~30 n8n node
  types) used to turn implementation steps into an importable file; a step
  naming an app outside it became a placeholder node.

"All available apps" therefore needed a real source. The one chosen is
**n8n's own integration list**: every node the `n8n-nodes-base` package
ships, read from the package itself. It is complete for the platform the
scaffold targets, it is maintained by n8n rather than by this project, and
every entry is one the download can actually wire.

## 2. The catalogue

`scripts/app-catalogue.mjs` downloads a pinned `n8n-nodes-base` tarball from
the npm registry, reads each node's codex file (`*.node.json`: type,
categories, documentation URL) and its compiled source (display name, latest
version, trigger or not), skips hidden (deprecated) nodes, and writes
`src/app-catalogue.ts`. Generated 2026-09-29 from `n8n-nodes-base@2.15.1`:
**410 apps**, ~118 KB of TypeScript, categories in n8n's own words
(Development, Communication, Data & Storage, Marketing, Productivity, Sales,
Finance, Analytics, Core Nodes, …).

Regeneration is one command and produces a reviewable diff. Nothing is typed
by hand; the previous display-name table in the presentation is gone, replaced
by a catalogue lookup with a cleaned-up fallback for anything outside it (a
community node, a type newer than the catalogue).

## 3. The picker and the swap

On the presentation, every step whose n8n node is known carries **Swap**.
It opens a dialog listing the catalogue with a search box, category chips
and a triggers-only filter (on by default for step 1, which is the trigger).
Choosing an app:

| Where | Effect |
|---|---|
| The step card | shows the chosen app with a **your pick** mark; the card border turns amber |
| The flow diagram | the node is drawn in the amber "yours" style |
| Apps you will use | the chosen app appears with **your pick**; NAIGX's original is dropped for that step |
| Download for n8n | the node keeps its name and wiring (`connections` is keyed by name), takes the chosen type at its current version with empty parameters, and its note says who chose it and what it replaced |
| The panel header | "N apps swapped · reset to NAIGX's picks" |

Choices are stored in the browser (`localStorage`, keyed by analysis id)
and nowhere else: they are the owner's edits to a *presentation*, not to the
stored analysis, and the page says so beside the step list. Reloading keeps
them; another device does not see them; the export is unchanged.

## 4. What this does not do, and why

- **It does not re-run reasoning.** A swapped app changes the plan the
  owner downloads; it does not ask the model whether the swap is wise. That
  would be a paid call and a prompt change; the owner may ask for it later.
- **It does not tell the owner what is new.** The catalogue is a list, not a
  recommendation. "Worth knowing" suggestions (the owner's earlier question)
  remain a prompt change behind the regression gate, and live currency
  remains web search or Stage 4 — both recorded as options, neither taken.
- **It is n8n's list.** A step designed for Make or Zapier has no node index
  and no Swap; the picker exists where the download does.

## 5. Verification

| Check | Result |
|---|---|
| Generator runs on Windows (Git Bash tar) and produces 410 apps; `oxlint` clean; `tsc -b && vite build` green | ✅ 2026-09-29 |
| Preview with sample data: picker opens on step 5, search "pipe" lists Pipedrive and Pipedrive Trigger, choosing Pipedrive marks the card, the tile and the download line; no page errors | ✅ 2026-09-29, headless Chromium screenshots; preview republished |
| Live on production for the owner's own analyses; a swapped download imports into n8n with the chosen node | ✅ **Deployed 2026-09-29 ~06:20 UTC**: host at `fe529f6`, edge image `ba5d65af0d27` (outgoing `5afc66381876` tagged `naigx-edge:rollback-9ffb13c`), backend untouched (`b5f6820c3684`, still `claude-opus-5-5`), no migrations; `https://naigx.tech/` 200 serving a bundle that carries the presentation, the picker and `n8n-nodes-base@2.15.1`; readiness 200. The n8n import of a swapped file is the owner's check |
