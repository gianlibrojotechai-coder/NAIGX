# D-68 — Decision first, then the reasoning: the presentation the owner asked for

**Date:** 2026-09-09
**Status:** Accepted — on the owner's direction after reading the first real export: "I would just like to see if it's apply or build first. Then if it's build, what build will I create, name of it, what app should I use. Then how do I show a proof about it." And: "the interface needs to change to a more modern/AI … make it more intelligent."
**Sprint:** 5 (continuation), finish line 1 (D-67)
**Resolves:** how a result reads to a person rather than to a reviewer, without weakening what `FR-040`–`FR-045` require to be present
**Affects:** `frontend/src/index.css` (the theme), `frontend/src/components/DecisionSummary.tsx` (new), `AnalysisView.tsx`, `App.tsx`, `JobDescriptionForm.tsx`, `AuthPanel.tsx`, `Processing.tsx`, `ui.tsx`; `backend/src/export/markdown.ts` (summary block), `backend/src/export/html.ts` (font stack)
**Builds on** D-40, D-49 (accessibility verification), D-66, D-67. **Changes no requirement, contract, schema, prompt or gate.**

---

## 1. What the owner saw, and what it meant

The first real analysis was correct in substance and the owner could not
tell what he was looking at. The page and the export led with the paper
trail — understanding, classification, requirements, provenance — and the
decision sat in section 3 with its consequences spread across sections 6
and 9. `FR-040` asks for "conclusion before reasoning"; the page satisfied
the letter (the verdict preceded the requirements) and not the reading.

Three questions, in order, are what a person wants from a job-description
result: **apply or build? what do I build, and with what? how do I prove
it?** Every answer already existed in the stored analysis. Nothing new is
computed here.

## 2. The decision

**A decision-first summary at the top of every result, and the full
reasoning folded beneath it.** For a job-description analysis the summary
is three cards, each a projection of stored fields:

| Card | Source |
|---|---|
| **The decision** — Apply now / Build first, the first sentence of the rationale, the decisive gaps | Stage 7 verdict (`decision`, `rationale`), `decisive_gaps` |
| **What to build** — project name, one-line description, complexity and effort, the apps and tools, the steps in order | the first `portfolio_suggestions` project (`name`, `what_to_build`, `complexity`, `estimated_effort`, `platforms`, `workflow`) |
| **How to prove it** — one instruction per evidence item the analysis named (publish the code, put it live, record a screen walkthrough, write it up, export the workflow, capture the result), each with what it must show | `evidence_to_produce[].type` mapped to a fixed instruction; `what_it_shows` verbatim |

An `apply_now` verdict shows the decision and "apply with what you have"; a
non-job-description analysis shows the title, the type and the artifacts
produced. The **full reasoning** — every existing section, unchanged — sits
under a *Show the full reasoning* control, open by default when there is no
verdict to summarise. The provenance legend and the export controls stay
outside the fold, as `FR-043` requires.

The **export** gets the same summary as an unnumbered block before section
1, so the first page of a PDF is the decision; the numbered sections are
untouched (64 export tests pass unchanged).

## 3. The theme

The frontend had no design tokens: every colour was a stock Tailwind class
repeated per component, the typeface was fetched from a Google CDN at
runtime, and there was no dark mode. D-68 defines the theme **once** in
`index.css` (Tailwind v4 `@theme`) by remapping the palette names the
components already use onto a curated dark palette — so a `bg-white
border-slate-200` card becomes a glass card on a gradient ground without a
component being rewritten — and self-hosts the typeface (Inter Variable via
the package, no CDN, so a future edge Content-Security-Policy cannot take
it away).

Every text/background pairing in the new palette was chosen to clear WCAG
AA contrast (the ratios are listed in `index.css`), provenance still
carries a glyph and a word beside its tint (`NFR-063`), focus rings remain
visible, and the axe run over the input, sign-in and policy surfaces is
**9 of 9 clean** on the new build. The manual walk (`M-17`) is still
unwalked; D-49 §2 stands.

## 4. What is not changed

- No reasoning, prompt, schema, gate, recording or requirement. The 15
  canonical recordings replay unchanged.
- The `FR-040` hierarchy: every section is still present and individually
  collapsible; the fold adds one level above them.
- Confidence: still stated as unavailable (Stage 11 deferred, D-33). The
  summary does not invent one.
- The duplicate of the understanding section in the export (sections 1 and
  5 both carry the objective and scope) is **not** folded here; the summary
  page was the higher-value change. Recorded, not hidden.

## 5. Also fixed on the way

- The PDF rendered its body text in a monospace face: the stylesheet asked
  for Segoe UI / system-ui / Arial and the container's font matching fell
  through to a mono font. The stack now names **Liberation Sans** and
  **Liberation Mono**, the fonts the runtime image guarantees.
- The sign-in panel said an account is "never needed to run an analysis",
  which is false on an owner-only instance (D-67). It now says what this
  instance does.

## 6. Verification

| Check | Result |
|---|---|
| Frontend lint, typecheck, build | ✅ |
| Backend suite (Postgres suites required), lint, format, build, export tests | ✅ 1005/0; 64 export tests unchanged |
| Axe WCAG 2.1 A/AA over input, sign-in and policy surfaces on the new build | ✅ 9/0 |
| Rendered against a local replay stack (jd-002): landing, processing, decision summary with build and proof cards, full reasoning fold, sign-in | ✅ screenshots reviewed; two copy defects found and fixed before publication |
| Production deploy | ⏳ awaiting the owner's look at the screenshots |
