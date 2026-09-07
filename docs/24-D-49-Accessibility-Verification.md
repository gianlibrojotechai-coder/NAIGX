# D-49 — Automated accessibility checks are necessary evidence and not sufficient

**Date:** 2026-09-07
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Affects:** `NFR-060`–`NFR-065`, `AC-023`, `M-17`
**Extends** [D-43](18-D-43-PDF-Rendering-Approach.md), whose Playwright dependency this reuses.

---

## 1. What "verified" has to mean here

`M-17`'s milestone line is **"WCAG 2.1 AA verified on primary flows"**, and `AC-023` repeats it: "WCAG 2.1 AA verified across primary flows; no color-only encoding". The operative word is *verified*, and it is doing the same work it does in `M-08`: the milestone is earned by evidence, not by having written the code.

This project has refused twice already to let an implementation stand in for its evidence — `M-08` is "unstarted, not passed-with-caveats", and `M-11` is recorded as "4 of 4 implemented, 0 of 4 measured". Accessibility invites the same substitution in a more tempting form, because an automated checker produces a green result that *looks* like verification.

## 2. Why a passing axe run does not establish AA conformance

Automated tooling evaluates the WCAG success criteria that can be decided from the rendered DOM. A large part of AA cannot be:

| Criterion | Why a checker cannot decide it |
|---|---|
| **1.1.1 Non-text Content** | A tool sees that an `aria-label` exists. Whether it *describes the diagram* is a judgement — an SVG labelled "diagram" passes every automated check and tells a screen-reader user nothing. |
| **2.1.1 Keyboard / 2.1.2 No Trap** | Requires actually traversing the interface. A checker inspects a static tree; it does not press Tab. |
| **2.4.3 Focus Order** | Whether the order is *meaningful* is about the content's logic, not its markup. |
| **2.4.7 Focus Visible** | Detectable only in part. Whether the indicator is visible against its actual background, at its actual size, is visual. |
| **1.3.1 Info and Relationships** | A checker finds a missing `<label>`. It cannot tell whether a heading level expresses the document's real structure. |
| **3.3.2 Labels or Instructions** | It sees a label. It cannot tell whether the label says something useful. |
| **4.1.2 Name, Role, Value** | Partly checkable. Whether a custom control announces sensibly in a real screen reader is not. |

⚠️ **No proportion is claimed.** Published figures exist for how much of WCAG automation catches, and none of this project's own sources states one. The point does not need a number: **the criteria above are the ones `NFR-061`–`NFR-065` are made of**, and every one of them needs a person.

## 3. The decision

1. **Automated checks are added and are required.** `@axe-core/playwright`, driven through the Playwright already present from [D-43](18-D-43-PDF-Rendering-Approach.md), run against the built frontend over the primary flows. Repeatable, cheap, and they catch the mechanical regressions a person reviewing the same screen for the fifth time will not.
2. **A manual checklist is written and is also required**, covering `NFR-060` through `NFR-065` — keyboard traversal, focus order and visibility, screen-reader announcement, and whether textual equivalents actually describe what they label.
3. **⚠️ A GREEN AXE RUN MUST NEVER MARK `M-17` PASSED.** Automated results are *necessary* evidence. They are not *sufficient*, and no report, status line, or commit message may present them as conformance.
4. **The `M-17` "verified" claim requires the manual portion to be completed** by a person, with its outcome recorded — pass or fail — the way `docs/10` requires of the `M-08` rubric.
5. **Until that happens, `M-17` is implemented and unverified**, and `docs/STATUS.md` says so in those words.

## 4. Why this is not a Vitest expansion

The standing constraint on this project is that no frontend test runner is added. This does not add one:

- It introduces **one dev dependency**, `@axe-core/playwright`, and no runner, no config, no component-test surface.
- It runs under `node:test` and the existing Playwright, which are already how this repository tests things.
- It tests the **built application in a browser**, not components in isolation. Nothing here can be reached for by a future component test.

That is a narrow enough footprint to be worth stating, because "we added an accessibility check" is exactly how a component-test framework arrives six weeks later.

## 5. What this costs

**The checks run against a built frontend and a running backend**, so they are the slowest tests in the suite and they skip where either is unavailable — the same shape as the Postgres-backed and browser-backed suites. A skip means accessibility was **not** checked on that run, never that it passed.

**The manual portion has no owner.** `M-17` needs a person to walk the checklist with a screen reader, and this record does not supply one — the same gap `docs/10` §8 ambiguity A-1 records for the M-08 reviewer.

## 6. Non-claims

- This does **not** establish WCAG 2.1 AA conformance, and no automated result may be reported as though it did.
- This does **not** claim `M-17` passed. It is implemented and unverified until §3.4 is satisfied.
- This does **not** add a frontend test runner, and must not become the precedent for one.
- This does **not** cover surfaces beyond the primary flows, and makes no claim about them.
- This does **not** constitute an accessibility audit by a qualified reviewer.
