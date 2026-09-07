# D-43 — `SA AQ-3` resolved: a headless system browser renders the PDF

**Date:** 2026-09-07
**Status:** Accepted
**Sprint:** 4 (Handoff surface)
**Resolves:** `SA AQ-3` — "PDF rendering approach", due Sprint 4
**Affects:** `API-040`, `FR-050`, `AC-008`, `M-13`, deployment
**Extends** [D-42](17-D-42-Export-Response-Contract.md). Supersedes nothing.

---

## 1. The question, and why it was not free to answer

`SA AQ-3` asked how the PDF export renders. `FR-050` requires that **"diagrams render in the export"**, and the `technical_assessment` path produces a Mermaid diagram, so the answer had to be a renderer that can draw one.

**Mermaid cannot parse without a DOM.** This was established by attempt, not by reading: parsing a generated diagram in a plain Node process fails with `DOMPurify.addHook is not a function`. Mermaid reaches for browser globals during parsing, before any drawing is attempted, so there is no "parse headlessly, draw later" arrangement available.

That single fact decides the question. Every PDF library that composes a document without a browser — pdfkit, pdfmake, and the rest — can typeset the text of an export perfectly well and **cannot render its diagrams**. The choice was never "browser versus library on the merits"; it was "browser, or an export that silently drops the artifact `FR-050` names".

## 2. What was measured before deciding

A probe was run before any implementation, against the real Mermaid bundle and a real browser, deliberately built to fail rather than to flatter:

- the diagram had to appear as a genuine `<svg>` with the expected node count and labels — **Mermaid renders its own errors as diagrams**, so an SVG alone proves nothing;
- every network request the page made was aborted, so a hidden CDN dependency could not pass unnoticed;
- the PDF had to carry a real header and enough bytes to contain a drawn diagram.

**Result: pass.** Four nodes rendered with correct labels, no syntax error, a 39 KB PDF. Cold browser launch 508 ms, Mermaid render 85 ms, PDF generation 176 ms, **1.8 s wall for the whole probe**. Re-run end to end through the real export modules on a representative `technical_assessment` analysis: 111 KB PDF, ~2.4 s.

⚠️ **These are single observations on one machine, not measurements.** They are recorded because a decision to take on a browser dependency should say what it observed. They are **not** evidence about `NFR-005`, which remains unmeasured — see §6.

## 3. The decision

1. **PDF is rendered by a headless Chromium-family browser**, driven by `playwright-core`.
2. **`playwright-core`, not `playwright`.** The full package downloads its own browser set (~300 MB) at install time. `playwright-core` is 14 MB and downloads nothing; it drives a browser **already on the machine**.
3. **The browser is an environment dependency, not a package dependency.** It is discovered at `NAIGX_BROWSER_PATH`, or from a per-platform candidate list. Nothing is vendored and nothing is downloaded by `npm install`.
4. **Where no browser exists, PDF is unavailable and says so** — `503` naming `NAIGX_BROWSER_PATH` and pointing at Markdown, which `docs/08` sanctions as the fallback. It is **never** downgraded silently: Markdown served under a PDF content type is a corrupt file with no explanation.
5. **PDF is a rendering of the Markdown, not a second document.** The pipeline is `AnalysisView` → Markdown → HTML → PDF, and the Markdown serialiser stays the single source of substance. `export/html.ts` decides how the document looks; it cannot add, drop or alter a statement, because it never sees the analysis.
6. **A browser is launched per request and closed in a `finally`.** Leak-free rather than fast. A pooled browser is the obvious optimisation and is not justified by anything measured.
7. **The rendered page makes no network requests at all.** Every request is aborted; Mermaid is injected from disk. An export of data already held must not depend on an external service being reachable.

## 4. What was rejected

**A document library (pdfkit, pdfmake, jsPDF).** Rejected — it cannot render Mermaid, per §1. It would produce a PDF missing the artifact `FR-050` requires it to contain, and the omission would be invisible in the file.

**Pre-rendering diagrams to SVG server-side, then composing with a library.** Rejected as the same problem wearing a hat: producing the SVG is the step that needs the DOM. Something would still have to run a browser; this arrangement adds a second document composer on top of it.

**`@mermaid-js/mermaid-cli`.** Rejected. It is a wrapper that launches Puppeteer's own downloaded Chromium — the 300 MB cost avoided in §3.2, plus a subprocess boundary and a temp-file dance, to reach the same browser this decision reaches directly.

**The full `playwright` package.** Rejected on size. It downloads Chromium, Firefox and WebKit by default, and this project needs one browser it can already find.

**A paid or hosted PDF service.** Rejected, and out of scope by owner instruction. It would send the user's analysis — which contains their own submitted document — to a third party, for a rendering the machine can do locally.

**Markdown only, PDF abandoned.** Rejected *because the experiment passed*. The roadmap sanctions Markdown as the fallback and it remains the fallback; it was not needed as the outcome.

## 5. What this costs

**Install footprint: +155 MB in `backend/node_modules`**, of which:

| Package | Size | Why it is there |
|---|---|---|
| `mermaid` | 83 MB | The 3.5 MB browser bundle is the only file used at runtime; the rest is its dependency tree (cytoscape 6 MB, katex 4.6 MB, d3, and typings). Resolved through Node rather than vendored, so it updates like any dependency |
| `playwright-core` | 14 MB | The browser driver. Downloads no browser |
| `marked` | 0.5 MB | Markdown → HTML. MIT, zero dependencies |
| transitive | ~57 MB | Mermaid's tree |

**A Chromium-family browser must be installed wherever PDF export is wanted.** On a Debian/Ubuntu VPS that is `apt-get install -y chromium` — roughly 120–150 MB on disk plus its shared libraries. **This is the real cost of the decision**, and it is an operational cost rather than a code one.

**Memory and time per export.** A browser process is launched per request. Observed ~2.4 s wall and a Chromium process for its duration. Under any concurrency this is the first thing that would need attention, and nothing about concurrency has been measured.

## 6. Non-claims

- **`NFR-005` (export p95 ≤ 10 s) is not measured and is not claimed.** The timings in §2 are single observations taken while deciding, on a developer machine, with no load. They are not a p95, not a benchmark, and must not be quoted as one.
- **This is verified on Windows against Chrome, and on no other platform.** The Linux candidate paths and the `--no-sandbox` argument are written for a container deployment that **does not exist yet** — `docs/STATUS.md` records that nothing is deployed anywhere. **A Linux VPS render is unverified**, and the classic failure there is a missing shared library rather than a missing browser. That verification belongs with the deployment work (M-19), not here.
- **No stored `technical_assessment` analysis has ever been exported.** The diagram path is verified against a constructed analysis in the shape the backend produces, because no recording of that path exists — fragments are inactive under D-39 and no capture has been authorised. This is [D-42](17-D-42-Export-Response-Contract.md)'s limitation 2, unchanged.
- **This does not authorise provider spend, a capture, or any M-15 work.** Nothing here touches reasoning.
- **`AC-008` ("presentation-ready in both formats") is now testable and is not claimed as passed.** A human has not judged a PDF against it.
