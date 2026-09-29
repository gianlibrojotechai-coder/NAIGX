# D-93 — The one-page presentation for a job-description result

**Date:** 2026-09-29
**Status:** Accepted — on the owner's direction: "these are all text … make it more presentable, more visuals … what I just want to see as the results is the description of the job, the workflow that I will need to create, the apps that I will need to use, build or apply. I don't need the req-4/6, confidence … visual diagram. Like NAIGX will give a single web page presentation."
**Sprint:** 5 (continuation), finish line 1 (D-67)
**Resolves:** how a job-description result is *led* — for the owner's own reading and for showing a client on a screen share
**Affects:** `frontend/src/components/JobPresentation.tsx` (new), `frontend/src/presentation.ts` (new), `frontend/src/App.tsx` (a Presentation / Full analysis toggle). **No backend, API, artifact, prompt or schema change; no new generation.**
**Builds on** D-68 (decision-first presentation and the theme tokens), D-70 (the node-by-node implementation plan), D-71 (the n8n scaffold), D-75 (skill gap analysis), D-66 (the intent brief).

---

## 1. What it shows, and only that

A job-description analysis now opens as one page with five panels, each read
from data the analysis already holds:

| Panel | Source | What is deliberately left out |
|---|---|---|
| The job and the call | posting's first line as the title; intent brief objective and scope; the Stage 7 verdict with its first sentence; a coverage ring from `skill_gap_analysis.summary` | rationale beyond one sentence, criteria, alternatives, the confidence table |
| Three numbers | requirements / already have / to close | requirement ids, provenance, necessity |
| The workflow to build | rank-1 portfolio project: problem, what to build, effort; a **flow diagram** (Mermaid, rendered from the D-70 implementation steps, else the n8n nodes, else the workflow outline); the steps as a numbered grid; the n8n download | `why_not_consolidated`, reusability provenance, evidence to produce |
| Apps you will use | the implementation platform, the project's platforms, and the n8n node types mapped to app names; generic building blocks (Code, IF, Set…) excluded | — |
| Build or apply | gap names as chips — red decisive, amber buildable, grey other — beside the evidenced requirement names | ids, evidence refs, why-it-matters text |

Rank-2 and rank-3 projects appear as small cards. The foot of the page
carries the export button and **Open the full analysis**, which shows the
existing D-68 view unchanged. A segmented control at the top switches
between the two; the choice resets on every new analysis.

Other paths are untouched: `hasPresentation` is true only for
`job_description` with a verdict, so a business requirement or workflow
review still opens in the full view.

## 2. What it does not change

- **Nothing is removed.** Requirement ids, provenance, confidence factors,
  criteria and rejected alternatives are all in the full view, one click away.
  `FR-040`–`FR-045` continue to be met by that view; this one is an additional
  reading of the same stored analysis.
- **No new claim.** The diagram draws the steps NAIGX already listed; the app
  tiles name what the steps already named. An absent artifact makes its panel
  say so in one line (`FR-093`), never hide.
- **Export is unchanged.** The Markdown and PDF exports remain the D-68
  decision-first document.

## 3. Verification

| Check | Result |
|---|---|
| `oxlint` clean, `tsc -b && vite build` green | ✅ 2026-09-29 |
| Presentation is the default for the owner's 03:57 UTC job-description analysis in production; the toggle reaches the full view and back; the diagram renders; n8n download works | ✅ **Deployed 2026-09-29 ~06:20 UTC**: host at `fe529f6`, edge image `ba5d65af0d27` (outgoing `5afc66381876` tagged `naigx-edge:rollback-9ffb13c`), backend untouched (`b5f6820c3684`, still `claude-opus-5-5`), no migrations; `https://naigx.tech/` 200 serving a bundle that carries the presentation, the picker and `n8n-nodes-base@2.15.1`; readiness 200. The owner's walk of the live page is the remaining check |
| A non-job-description analysis still opens in the full view | ⏳ owner's walk (no non-JD analysis was run today) |
| axe on the presentation | ⚠️ not automated — the D-49 harness covers the input surface only; the owner's walk on the live page stands in |
