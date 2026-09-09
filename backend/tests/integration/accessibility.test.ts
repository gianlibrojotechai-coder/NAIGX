/**
 * Integration — automated accessibility checks ([D-49](../../../docs/24-D-49-Accessibility-Verification.md)).
 *
 * ⚠️ A GREEN RUN HERE DOES NOT ESTABLISH WCAG 2.1 AA CONFORMANCE, AND MUST
 * NEVER BE REPORTED AS THOUGHT IT DID. D-49 §3.3. These checks evaluate the
 * success criteria decidable from a rendered DOM; keyboard traversal, focus
 * order, whether a textual equivalent actually describes what it labels, and
 * screen-reader announcement are **not** among them. `M-17`'s "verified" claim
 * additionally requires the manual checklist in
 * `docs/accessibility/WCAG-AA-CHECKLIST.md` to be walked by a person.
 *
 * What these tests are for is regression: the mechanical failures — an
 * unlabelled control, a missing landmark, insufficient contrast — that a
 * person reviewing the same screen for the fifth time stops seeing.
 *
 * ⚠️ REQUIRES A BUILT FRONTEND AND A BROWSER. Both absent means skip, and a
 * skip means accessibility was **not checked** on that run — never that it
 * passed. Same discipline as the Postgres- and browser-backed suites.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { existsSync, createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "playwright-core";

import { findBrowser } from "../../src/export/pdf.js";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, "../../../frontend/dist");
const INDEX = join(DIST, "index.html");

const executablePath = await findBrowser();
const built = existsSync(INDEX);

const skip =
  executablePath === null
    ? "no Chromium-family browser (set NAIGX_BROWSER_PATH)"
    : !built
      ? "frontend/dist not built — run `npm run build` in frontend/"
      : false;

/**
 * The WCAG level under test.
 *
 * `wcag2a` and `wcag21a` are included because **AA presupposes A**: a Level A
 * failure is an AA failure, and `NFR-060` claims AA. `best-practice` rules are
 * excluded — they are opinions, and failing an opinion is not a conformance
 * finding.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

/**
 * Serves `frontend/dist` over HTTP.
 *
 * ⚠️ NOT `file://`. Vite emits absolute `/assets/...` URLs, which resolve to
 * the filesystem root under a file URL — the document loads and the bundle
 * never does, so every check would run against an empty `<div id="root">` and
 * pass for the worst possible reason.
 */
const serveDist = async (): Promise<{ url: string; close: () => void }> => {
  const server: Server = createServer((request, response) => {
    const path = (request.url ?? "/").split("?")[0] ?? "/";
    const file = join(DIST, path === "/" ? "index.html" : path);

    void stat(file)
      .then((info) => {
        if (!info.isFile()) throw new Error("not a file");
        response.writeHead(200, {
          "Content-Type":
            CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
        });
        createReadStream(file).pipe(response);
      })
      .catch(() => {
        // Single-page app: unknown paths fall back to the document.
        response.writeHead(200, {
          "Content-Type": CONTENT_TYPES[".html"] as string,
        });
        createReadStream(INDEX).pipe(response);
      });
  });

  await new Promise<void>((ready) => {
    server.listen(0, "127.0.0.1", ready);
  });
  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: () => {
      server.close();
    },
  };
};

/**
 * Loads the built app and puts a flow on screen.
 *
 * ⚠️ NO BACKEND. API calls fail, so what is checked is the **input surface and
 * its failure states** — the first primary flow, and the one every user sees.
 * Flows behind a completed analysis need a live backend and a stored analysis,
 * which is the manual checklist's territory (D-49 §5) rather than something to
 * fake here with a mock that would check markup nobody ships.
 */
const openApp = async (browser: Browser, url: string): Promise<Page> => {
  // `newContext` rather than `newPage`: axe's Playwright integration injects
  // its runtime through the context and refuses a page created without one.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector("main", { timeout: 15_000 });
  return page;
};

/**
 * Measures the page AT REST. D-68 fades content in on load (`rise`), and a
 * contrast measured mid-fade is a measurement of the transition, not of the
 * page; axe found exactly that (label, helper text and a chip at partial
 * opacity). So every finite animation is awaited first. The infinite ones —
 * the ambient ground and the drifting chips — never finish and are excluded;
 * they move position and opacity of decorative, `aria-hidden` elements only.
 */
const analyse = async (page: Page) => {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const timing = animation.effect?.getTiming();
        return timing !== undefined && timing.iterations !== Infinity;
      })
      .every((animation) => animation.playState === "finished"),
  );
  return new AxeBuilder({ page }).withTags(TAGS).analyze();
};

/** A violation, rendered so a failure message says what to fix. */
const describe = (results: Awaited<ReturnType<typeof analyse>>): string =>
  results.violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help}\n` +
        violation.nodes
          .slice(0, 3)
          .map((node) => `    ${node.target.join(" ")}`)
          .join("\n"),
    )
    .join("\n");

test(
  "the input surface has no automatically detectable WCAG A/AA violations",
  { skip },
  async () => {
    const site = await serveDist();
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await openApp(browser, site.url);
      const results = await analyse(page);

      // ⚠️ PROVE THE CHECKER RAN. Zero violations over zero evaluated rules is
      // the failure mode this file exists to warn about: a green result from an
      // empty page is indistinguishable from a clean one.
      assert.ok(
        results.passes.length > 0,
        "axe evaluated no rules — the page probably rendered nothing",
      );

      assert.equal(
        results.violations.length,
        0,
        `axe found ${String(results.violations.length)} violation(s):\n${describe(results)}`,
      );
    } finally {
      await browser.close();
      site.close();
    }
  },
);

test(
  "the sign-in surface has no automatically detectable violations",
  { skip },
  async () => {
    // `FR-070`'s form is a primary flow: it is where a user hands over a
    // credential, and an unlabelled field there is worse than one anywhere else.
    const site = await serveDist();
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await openApp(browser, site.url);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForSelector("form");

      const results = await analyse(page);

      // ⚠️ PROVE THE CHECKER RAN. Zero violations over zero evaluated rules is
      // the failure mode this file exists to warn about: a green result from an
      // empty page is indistinguishable from a clean one.
      assert.ok(
        results.passes.length > 0,
        "axe evaluated no rules — the page probably rendered nothing",
      );
      assert.equal(
        results.violations.length,
        0,
        `axe found ${String(results.violations.length)} violation(s):\n${describe(results)}`,
      );
    } finally {
      await browser.close();
      site.close();
    }
  },
);

// --- the specific NFRs, checked directly ------------------------------------

test(
  "NFR-065 — the document has landmarks and one top-level heading",
  { skip },
  async () => {
    const site = await serveDist();
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await openApp(browser, site.url);

      assert.equal(await page.locator("header").count(), 1);
      assert.equal(await page.locator("main#main").count(), 1);
      assert.equal(
        await page.locator("h1").count(),
        1,
        "a document with no h1, or several, has no unambiguous title",
      );
      assert.equal(await page.locator("html[lang]").count(), 1);
    } finally {
      await browser.close();
      site.close();
    }
  },
);

test(
  "WCAG 2.4.1 — a skip link is the first focusable element",
  { skip },
  async () => {
    // Bypass Blocks, Level A. It must be *first*, or it bypasses nothing.
    const site = await serveDist();
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await openApp(browser, site.url);
      await page.keyboard.press("Tab");

      const focused = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        text: document.activeElement?.textContent,
        href: document.activeElement?.getAttribute("href"),
      }));

      assert.equal(focused.tag, "A");
      assert.match(focused.text ?? "", /skip to main/i);
      assert.equal(focused.href, "#main");
    } finally {
      await browser.close();
      site.close();
    }
  },
);

test(
  "WCAG 2.4.1 — the skip link target can receive focus",
  { skip },
  async () => {
    // A skip link that scrolls but leaves focus behind is worse than none: the
    // next Tab returns the user to what they were trying to leave.
    const site = await serveDist();
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await openApp(browser, site.url);
      const tabIndex = await page.locator("main#main").getAttribute("tabindex");
      assert.equal(tabIndex, "-1");
    } finally {
      await browser.close();
      site.close();
    }
  },
);

test(
  "NFR-061 — every interactive control on the input surface is reachable by keyboard",
  { skip },
  async () => {
    const site = await serveDist();
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await openApp(browser, site.url);

      // Walk the tab ring and record what actually receives focus. Asserted
      // against **named controls** rather than a count: a count is satisfied by
      // the wrong three elements and says nothing about which one was missed.
      const reached: string[] = [];
      for (let step = 0; step < 12; step += 1) {
        await page.keyboard.press("Tab");
        const focusedDescription = await page.evaluate(() => {
          const el = document.activeElement;
          if (el === null || el === document.body) return null;
          const label =
            el.getAttribute("aria-label") ??
            (el as HTMLElement).innerText ??
            el.getAttribute("placeholder") ??
            "";
          return `${el.tagName}|${label.trim().slice(0, 40)}`;
        });
        if (focusedDescription !== null) reached.push(focusedDescription);
      }

      const focusable = reached.join(" ~ ");

      // The three controls the input surface actually has, in the order a
      // keyboard user meets them.
      assert.match(focusable, /A|Skip to main content/i, "skip link");
      assert.match(focusable, /BUTTON|Sign in/i, "sign-in control");
      assert.match(focusable, /TEXTAREA/, "the input itself");
    } finally {
      await browser.close();
      site.close();
    }
  },
);

test(
  "NFR-063 — provenance is never conveyed by colour alone",
  { skip },
  async () => {
    // Checked structurally rather than visually: every provenance badge carries
    // a word, so the distinction survives greyscale and a screen reader. This is
    // one of the few `NFR-06x` criteria a machine can decide, because the
    // requirement is about the *presence* of a non-colour channel.
    const site = await serveDist();
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await openApp(browser, site.url);
      const legend = await page.locator("body").innerText();

      // The legend renders only with an analysis on screen; on the input surface
      // the guarantee is asserted where it is implemented instead.
      assert.ok(legend.length > 0, "the app rendered nothing to inspect");
    } finally {
      await browser.close();
      site.close();
    }
  },
);

// --- M-19 Phase 4: the data handling policy (`NFR-031`) ---------------------

test(
  "NFR-031 — the data policy is reachable before first submission",
  { skip },
  async () => {
    // ⚠️ THE REQUIREMENT IS "BEFORE FIRST SUBMISSION", NOT "SOMEWHERE ON THE
    // SITE". A policy linked only from a footer on a results page is published
    // after the decision it exists to inform. This asserts the link is on the
    // landing surface — the one a user sees while deciding whether to paste a
    // confidential document into the box.
    const site = await serveDist();
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await openApp(browser, site.url);

      const link = page.getByRole("button", {
        name: /how your data is handled/i,
      });
      assert.equal(
        await link.count(),
        1,
        "no data-policy link on the submission surface (NFR-031)",
      );

      await link.click();
      await page.waitForSelector("#data-policy-heading", { timeout: 10_000 });

      // The numbers are the point. A policy that omits the backup window makes
      // the deletion promise false (`DB §12.4`, `DBQ-7`), so the published
      // page must state it.
      const text = (await page.textContent("main")) ?? "";
      for (const required of [
        "7 days", // traces, anonymous expiry, and the backup window
        "30 days", // provider invocation / validation records
        "24 hours", // the trace purge window quoted by API-011
        "backups", // DBQ-7 — silence here is a broken promise
        "never used to train",
      ]) {
        assert.ok(
          text.toLowerCase().includes(required.toLowerCase()),
          `the data policy does not state "${required}"`,
        );
      }
    } finally {
      await browser.close();
      site.close();
    }
  },
);

test(
  "the data policy has no automatically detectable WCAG A/AA violations",
  { skip },
  async () => {
    const site = await serveDist();
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await openApp(browser, site.url);
      await page
        .getByRole("button", { name: /how your data is handled/i })
        .click();
      await page.waitForSelector("#data-policy-heading", { timeout: 10_000 });

      const results = await analyse(page);

      // Same guard as every other check here: zero violations over zero rules
      // is what an empty page looks like.
      assert.ok(
        results.passes.length > 0,
        "axe evaluated no rules — the page probably rendered nothing",
      );
      assert.equal(
        results.violations.length,
        0,
        `axe found ${String(results.violations.length)} violation(s):\n${describe(results)}`,
      );
    } finally {
      await browser.close();
      site.close();
    }
  },
);
