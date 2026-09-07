# WCAG 2.1 AA — manual verification checklist

**Purpose:** the half of `M-17` that automation cannot establish.
**Governed by:** [D-49](../24-D-49-Accessibility-Verification.md)
**Covers:** `NFR-060` – `NFR-065`, `AC-023`

---

## Read this first

`backend/tests/integration/accessibility.test.ts` runs axe over the primary
flows on every test run. **A green result from it does not establish AA
conformance** and never marks `M-17` passed — D-49 §3.3. It checks the success
criteria decidable from a rendered DOM. Everything below is what it structurally
cannot check, and `M-17`'s "verified" claim requires this walk to be completed
by a person and its outcome recorded, pass or fail.

**Record the result at the bottom of this file.** An unrecorded walk is an
unwalked one.

### What you need

- A keyboard. Do not touch the mouse for §1.
- A screen reader. NVDA (Windows, free), VoiceOver (macOS, built in), or Orca
  (Linux). Any one of them; the point is to hear the interface, not to test
  three.
- The app running: `npm run dev` in `backend/` and in `frontend/`.
- **A completed analysis.** Several sections below only exist once one has run,
  and this is the reason the automated checks cover the input surface only.

---

## 1. Keyboard — `NFR-061`

*"All functionality operable by keyboard alone."* Unplug the mouse if it helps.

| # | Check | Criterion | Result |
|---|---|---|---|
| 1.1 | Tab from page load: the **skip link** is first, and activating it moves focus into `<main>` — not merely scrolls | 2.4.1 A | ☐ |
| 1.2 | Every control on the input surface is reachable: textarea, submit, sign-in | 2.1.1 A | ☐ |
| 1.3 | **Submit an analysis using only the keyboard**, start to finish | 2.1.1 A | ☐ |
| 1.4 | Expand and collapse each result section with Enter/Space | 2.1.1 A | ☐ |
| 1.5 | Reach and operate **Copy as Markdown** and both export buttons | 2.1.1 A | ☐ |
| 1.6 | Open the classification correction control, choose a type, submit | 2.1.1 A | ☐ |
| 1.7 | Sign in, open history, search, filter, delete one entry, delete all — keyboard only | 2.1.1 A | ☐ |
| 1.8 | **Focus is never trapped.** From any control, Tab and Shift+Tab both escape | 2.1.2 A | ☐ |
| 1.9 | The **Mermaid diagram** area does not swallow focus, and its "Read this diagram as text" disclosure opens by keyboard | 2.1.1 A | ☐ |
| 1.10 | Nothing is reachable by mouse that is unreachable by keyboard | 2.1.1 A | ☐ |

## 2. Focus — `NFR-061`, `NFR-065`

| # | Check | Criterion | Result |
|---|---|---|---|
| 2.1 | The focus indicator is **visible on every control**, against its actual background — including the dark buttons and the rose delete controls | 2.4.7 AA | ☐ |
| 2.2 | Tab order follows the **visual and logical** order of each screen | 2.4.3 A | ☐ |
| 2.3 | Opening the sign-in panel moves focus into it, or the next Tab reaches it without traversing the whole page | 2.4.3 A | ☐ |
| 2.4 | After deleting a history entry, focus lands somewhere sensible rather than on `<body>` | 2.4.3 A | ☐ |
| 2.5 | The skip link is **visible when focused** and hidden otherwise | 2.4.7 AA | ☐ |

## 3. Screen reader — `NFR-064`, `NFR-065`

The section automation cannot approximate. Listen; do not read the DOM.

| # | Check | Criterion | Result |
|---|---|---|---|
| 3.1 | Landmarks are announced and navigable — banner, main | 1.3.1 A | ☐ |
| 3.2 | Heading order is sensible when navigating by heading; no level is skipped | 1.3.1 A | ☐ |
| 3.3 | Each result section's expanded/collapsed state is **announced**, and changes when toggled | 4.1.2 A | ☐ |
| 3.4 | **The diagram announces a description that is actually useful** — not "image", not "graphic", and not a list of node ids. Does it convey what the diagram shows? | 1.1.1 A | ☐ |
| 3.5 | The "Read this diagram as text" description **matches the picture**. Compare them | 1.1.1 A | ☐ |
| 3.6 | Provenance badges announce their word, not only their glyph — "stated", not "tick" | 1.3.1 A | ☐ |
| 3.7 | The confidence-unavailable statement is announced in full, not truncated to "Confidence" | 1.3.1 A | ☐ |
| 3.8 | Validation errors on the input form are announced when they appear | 3.3.1 A | ☐ |
| 3.9 | The `role="status"` notices (claim confirmation, deletion receipt) are announced without stealing focus | 4.1.3 AA | ☐ |
| 3.10 | History search and filter announce their labels | 3.3.2 A | ☐ |
| 3.11 | An empty history and a filtered-empty history are **distinguishable by ear** | 1.3.1 A | ☐ |

## 4. Colour and contrast — `NFR-062`, `NFR-063`

| # | Check | Criterion | Result |
|---|---|---|---|
| 4.1 | View a completed analysis in **greyscale**. Stated, inferred and unknown remain distinguishable | 1.4.1 A | ☐ |
| 4.2 | Risk severity and band remain readable in greyscale — they are text, confirm nothing depends on the badge tint | 1.4.1 A | ☐ |
| 4.3 | Decisive gaps are identifiable without colour | 1.4.1 A | ☐ |
| 4.4 | Body text meets 4.5:1 against its actual background | 1.4.3 AA | ☐ |
| 4.5 | The small badge text (11px) meets 4.5:1 — small text has no large-text exemption | 1.4.3 AA | ☐ |
| 4.6 | Borders and focus rings meet 3:1 where they carry meaning | 1.4.11 AA | ☐ |
| 4.7 | Zoom to **200%**: nothing is lost or clipped, no horizontal scrolling of the page body | 1.4.4 AA | ☐ |
| 4.8 | At a 320px viewport width, content reflows without a second scroll axis | 1.4.10 AA | ☐ |

## 5. Content and structure — `NFR-060`, `NFR-065`

| # | Check | Criterion | Result |
|---|---|---|---|
| 5.1 | Page `<title>` identifies the page | 2.4.2 A | ☐ |
| 5.2 | `lang="en"` is present and correct | 3.1.1 A | ☐ |
| 5.3 | Link text makes sense out of context — no bare "here" or "more" | 2.4.4 A | ☐ |
| 5.4 | Form fields have visible or programmatic labels, and errors say what to do (`FR-005` already requires this) | 3.3.1, 3.3.2 A | ☐ |
| 5.5 | The **export controls** are reachable and labelled in a PDF-unavailable state | 4.1.2 A | ☐ |
| 5.6 | The refusal screen (`API §9.3`) is navigable and its unknowns are announced as a list | 1.3.1 A | ☐ |
| 5.7 | Nothing flashes more than three times per second | 2.3.1 A | ☐ |

---

## Known gaps to check specifically

Written while implementing `M-17`. These are the places most likely to fail,
and a walk that skips them is not worth recording.

1. **The Mermaid diagram** (§3.4, §3.5). `describeDiagram` derives its text from
   the flowchart source by pattern-matching node and edge declarations. If
   Mermaid's output shape changes, or a diagram uses syntax the patterns do not
   cover, the description degrades to "a flow diagram whose structure could not
   be read from its source". **That fallback is honest and it is not an
   equivalent** — if you see it, `NFR-064` is failing.
2. **Streaming progress** (§3.9). `FR-041` renders artifacts as they arrive. Is
   that announced, or does content appear silently? Note that the stream is
   degraded for owned analyses anyway (M-15 limitation 1), so this may only be
   observable anonymously.
3. **Section renumbering.** The artifact block is path-dependent and the closing
   sections renumber after it. Confirm the numbers a screen reader announces
   match what is on screen.
4. **The 200% zoom case** (§4.7) against the *widest* content — the risk
   register table and the provenance table.

---

## Result

| | |
|---|---|
| **Walked by** | *(name)* |
| **Date** | *(date)* |
| **Screen reader used** | *(NVDA / VoiceOver / Orca, and version)* |
| **Browser** | *(name and version)* |
| **Outcome** | ☐ Pass ☐ Fail — *(if fail, list the failing check numbers)* |
| **Notes** | |

⚠️ **`M-17` is not passed until this table is filled in with an outcome.** A
green automated run is not a substitute, and D-49 §3.3 forbids treating it as
one. Record a fail as readily as a pass — an unrecorded failure is the thing
this file exists to prevent.
