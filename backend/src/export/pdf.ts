/**
 * HTML → PDF through a headless browser (`M-13`, `SA AQ-3`).
 *
 * WHY A BROWSER, AND WHY NOT A DOCUMENT LIBRARY. `FR-050` requires diagrams to
 * render in the export. **Mermaid needs a DOM even to parse** — proven, and
 * recorded in `docs/STATUS.md`: an attempt to parse a diagram headlessly fails
 * with `DOMPurify.addHook is not a function`. That rules out pdfkit, pdfmake
 * and every other library that draws a PDF without one. A real browser is not
 * the convenient option; it is the only one that renders the diagram.
 *
 * THE SMALLEST VERSION OF THAT. `playwright-core` (14 MB) rather than
 * `playwright` (which downloads its own ~300 MB browser set), driving a
 * Chromium-family browser **already present on the machine**. Nothing is
 * downloaded at install time and no browser is vendored.
 *
 * ⚠️ THE BROWSER IS AN ENVIRONMENT DEPENDENCY, NOT A PACKAGE DEPENDENCY. If no
 * Chromium-family browser is installed, PDF export is unavailable and says so,
 * naming `NAIGX_BROWSER_PATH` and pointing at Markdown — which `docs/08`
 * sanctions as the fallback. It **never** degrades silently: a caller who
 * asked for PDF and received something else has a corrupt file and no
 * explanation.
 *
 * IT ADDS NO SUBSTANCE. The input is the HTML rendering of the Markdown the
 * serialiser produced. This module chooses paper size and margins. It cannot
 * add, drop or alter a statement, because it never sees the analysis.
 *
 * NO NETWORK. The page is set from a string, Mermaid is injected from disk,
 * and every request the page attempts is aborted. An export that quietly
 * depended on a CDN would fail in exactly the environment it matters in.
 */

import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium, type Browser } from "playwright-core";

import { AppError } from "../http/errors.js";

/**
 * Where the Mermaid browser bundle lives, resolved through Node rather than
 * hardcoded: a path string would break the first time the dependency moved.
 */
const mermaidBundlePath = (): string => {
  const require = createRequire(import.meta.url);
  return require.resolve("mermaid/dist/mermaid.min.js");
};

/**
 * Chromium-family browsers, in the order a machine is likely to have one.
 *
 * `NAIGX_BROWSER_PATH` overrides the list entirely — a deployment that
 * installs its own Chromium says so explicitly rather than hoping this list
 * guesses right.
 */
const BROWSER_CANDIDATES: Readonly<Record<string, readonly string[]>> = {
  linux: [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  win32: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ],
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * The browser this machine will use, or `null` when it has none.
 *
 * `null` rather than a throw: "is PDF available here" is a question the export
 * endpoint needs to answer before it commits to a format, and an exception is
 * the wrong shape for a capability check.
 */
export async function findBrowser(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): Promise<string | null> {
  const configured = env["NAIGX_BROWSER_PATH"];
  if (configured !== undefined && configured.trim() !== "") {
    // An explicitly configured path that does not exist is a misconfiguration
    // worth surfacing, not something to silently fall back from — falling back
    // would hide the typo and use a browser the operator did not choose.
    return (await exists(configured)) ? configured : null;
  }

  for (const candidate of BROWSER_CANDIDATES[platform] ?? []) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

/** Refusal when the environment cannot render a PDF. Markdown still can. */
export const pdfUnavailableError = (): AppError =>
  new AppError(
    "service_unavailable",
    "PDF export needs a Chromium-family browser on the server, and none was found.",
    {
      field: "format",
      action:
        "Request `markdown`, which carries the same content — or install Chromium and set `NAIGX_BROWSER_PATH` to its executable.",
    },
  );

export interface PdfOptions {
  /** Overrides discovery. Supplied by the route, which already resolved it. */
  readonly executablePath: string;
  /**
   * Hard bound on the whole render.
   *
   * A browser that hangs must not hold the request open indefinitely. Ten
   * seconds is many times the observed cost of a cold launch plus render, so
   * hitting it means something is wrong rather than something is slow.
   *
   * ⚠️ This is a *safety* bound, not evidence about `NFR-005`. Nothing in this
   * project measures export latency, and this constant measures nothing.
   */
  readonly timeoutMs?: number;
}

/**
 * Renders an HTML document to PDF bytes.
 *
 * A browser is launched per call and closed in a `finally`. That is the
 * simple, leak-free arrangement rather than the fast one: a pooled browser
 * would save the launch each time and is the obvious optimisation if export
 * volume ever justifies it. It is not justified by anything measured today.
 */
export async function renderPdf(
  html: string,
  options: PdfOptions,
): Promise<Buffer> {
  const timeout = options.timeoutMs ?? 10_000;
  const mermaidSource = await readFile(mermaidBundlePath(), "utf8");

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      executablePath: options.executablePath,
      headless: true,
      timeout,
      // `--no-sandbox` is required to run as root inside a container, which is
      // the usual deployment shape. The page is a document this server just
      // rendered from its own database — it loads no third-party code and, per
      // the route below, makes no requests at all.
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);

    // Everything needed is already in hand. Aborting the rest means a CDN
    // dependency cannot creep in unnoticed and a slow network cannot stall an
    // export of data we already hold.
    await page.route("**/*", (route) => route.abort());

    await page.setContent(html, { waitUntil: "domcontentloaded", timeout });
    await page.addScriptTag({ content: mermaidSource });

    // `FR-050` — the diagram renders in the PDF. A parse failure leaves the
    // source visible instead, matching the frontend's failure branch: a
    // diagram that cannot be drawn becomes a diagram you can still read.
    await page.evaluate(async () => {
      const runtime = (globalThis as unknown as { mermaid?: unknown }).mermaid;
      if (runtime === undefined) return;
      const mermaid = runtime as {
        initialize: (config: unknown) => void;
        run: (options: { querySelector: string }) => Promise<void>;
      };
      mermaid.initialize({
        startOnLoad: false,
        // The diagram source is rendered from stored architecture components,
        // but those component names are the user's own text. `strict` keeps
        // any markup in a label inert.
        securityLevel: "strict",
        theme: "neutral",
        flowchart: { useMaxWidth: true },
      });
      try {
        await mermaid.run({ querySelector: "pre.mermaid" });
      } catch {
        for (const node of document.querySelectorAll("pre.mermaid")) {
          node.className = "mermaid-failed";
        }
      }
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "18mm",
        bottom: "18mm",
        left: "16mm",
        right: "16mm",
      },
      // Page numbers only. `FR-051` forbids marketing content, and a header
      // naming the tool on every page is the most tempting place to add some.
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        '<div style="width:100%;font-size:8pt;color:#7a8794;text-align:center;padding:0 16mm;">' +
        '<span class="pageNumber"></span> of <span class="totalPages"></span>' +
        "</div>",
    });
  } finally {
    await browser?.close();
  }
}
