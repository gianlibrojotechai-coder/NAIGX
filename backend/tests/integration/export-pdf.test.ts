/**
 * Integration — PDF export through a real headless browser (`SA AQ-3`, `M-13`).
 *
 * ⚠️ THESE TESTS NEED A CHROMIUM-FAMILY BROWSER ON THE MACHINE and skip
 * without one, the way this project's live-provider tests skip without
 * credentials. A skip here is an environment statement, not a pass: it means
 * PDF export was **not** exercised on this run.
 *
 * WHAT IS ACTUALLY BEING TESTED. Not that a PDF is produced — that is easy and
 * says little. The claims worth protecting are:
 *
 *   · **Mermaid genuinely renders.** The whole reason for a browser is that
 *     Mermaid needs a DOM. A PDF containing the diagram *source* instead of
 *     the diagram would be the failure this approach exists to avoid, and it
 *     would look like a pass to any test that only checked byte count.
 *   · **The PDF says exactly what the Markdown says.** One serialiser, one
 *     content model. The text extracted from the rendered page must carry the
 *     same provenance, confidence and artifact-state statements.
 *   · **A missing browser refuses honestly** rather than degrading to Markdown
 *     under a PDF content type.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import { chromium } from "playwright-core";

import { buildApp } from "../../src/app.js";
import { renderExportHtml } from "../../src/export/html.js";
import { findBrowser, renderPdf } from "../../src/export/pdf.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Database } from "../../src/db/client.js";
import {
  anonymousCredential,
  anonymousLookup,
  noSessions,
} from "../helpers/anonymous-principal.js";

const executablePath = await findBrowser();
const noBrowser = executablePath === null;
const skip = noBrowser
  ? "no Chromium-family browser on this machine (set NAIGX_BROWSER_PATH)"
  : false;

const config: AppConfig = {
  databaseUrl: "postgresql://unused",
  traceDatabaseUrl: "postgresql://unused-trace",
  provider: {},
  port: 0,
  corsOrigin: "http://localhost:5173",
  logLevel: "silent",
};

const ANALYSIS_ID = "7c3a1f22-9d40-4b7e-8a11-6f2e5c9db401";

const DIAGRAM = [
  "flowchart TD",
  '  n0["Form Watcher"]',
  '  n1["Payload Normaliser"]',
  '  n2["Sheet Writer"]',
  "  n0 --> n1",
  "  n1 --> n2",
  '  ext2[("Google Sheets")]',
  "  n2 --> ext2",
].join("\n");

/** A `technical_assessment` analysis — the only path that carries a diagram. */
const storedAnalysis = () => ({
  analysisId: ANALYSIS_ID,
  userId: null,
  status: "completed",
  createdAt: new Date("2026-09-07T11:58:00.000Z"),
  completedAt: new Date("2026-09-07T11:59:41.000Z"),
  derivedTitle: "Intake automation — technical assessment",
  sufficiencyLevel: "sufficient",
  overallConfidenceBand: null,
  degradationFlag: false,
  timeoutFlag: false,
  input: { characterCount: 3180, sourceType: "paste" },
  classification: {
    determinedType: "technical_assessment",
    confidence: 0.88,
    candidateTypes: null,
    wasLowConfidence: false,
    userOverrideType: null,
    overriddenAt: null,
  },
  intentRecord: {
    primaryObjective: "Assess the proposed intake automation design",
    inferredScope: "One submitted design",
    objectiveProvenance: { primary: "stated", secondary: [] },
  },
  contextElements: [],
  recommendations: [
    {
      conclusion: "build_first",
      rationale: "No durable hand-off between intake and the sheet write.",
      criteriaApplied: null,
      confidenceBand: null,
      confidenceFactors: null,
      alternatives: [],
    },
  ],
  requiredCapabilities: [],
  artifactPlanEntries: [
    {
      artifactType: "mermaid_diagram",
      planned: true,
      outcome: "generated",
      inclusionReason: "Planned for this path.",
      omissionReason: null,
      artifact: {
        validationStatus: "valid",
        content: { diagram: DIAGRAM, node_count: 3 },
      },
    },
    {
      artifactType: "assessment_feedback",
      planned: true,
      outcome: "failed",
      inclusionReason: "Planned for this path.",
      omissionReason: null,
      artifact: { validationStatus: "invalid", content: null },
    },
  ],
});

const database = (analysis: unknown): Database =>
  ({
    prisma: {
      healthCheck: { findFirst: () => Promise.resolve(null) },
      session: noSessions,
      analysis: {
        findUnique: () => Promise.resolve(analysis),
        ...anonymousLookup(credential, { analysisId: ANALYSIS_ID }),
      },
    },
    disconnect: () => Promise.resolve(),
  }) as unknown as Database;

/** Ownership is enforced from `M-15`; these reads present the credential. */
const credential = anonymousCredential();

const post = async (format: string, analysis: unknown = storedAnalysis()) => {
  const app = await buildApp({ config, database: database(analysis) });
  const res = await app.inject({
    method: "POST",
    url: `/analyses/${ANALYSIS_ID}/exports`,
    payload: { format },
    headers: credential.header,
  });
  await app.close();
  return res;
};

// --- the endpoint -----------------------------------------------------------

test("API-040 serves a real PDF for format=pdf", { skip }, async () => {
  const res = await post("pdf");

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "application/pdf");
  assert.match(
    res.headers["content-disposition"] as string,
    new RegExp(`filename="naigx-analysis-${ANALYSIS_ID}\\.pdf"`),
  );

  const body = res.rawPayload;
  assert.equal(body.subarray(0, 5).toString("ascii"), "%PDF-");
  // A diagram, tables and several pages of text. A near-empty PDF would still
  // carry the header, so the floor is what makes this assertion mean anything.
  assert.ok(body.length > 20_000, `pdf was ${String(body.length)} bytes`);
});

test("D-42 still holds for PDF — nothing is minted", { skip }, async () => {
  const res = await post("pdf");
  const text = res.rawPayload.toString("latin1");

  assert.equal(text.includes("export_id"), false);
  assert.equal(text.includes("download_url"), false);
  assert.equal(res.statusCode, 200);
});

test("a machine with no browser refuses rather than downgrading", async () => {
  // Exercised directly rather than through the route, because the route
  // resolves a browser that exists on this machine. What matters is that the
  // refusal names Markdown and never returns it under a PDF content type.
  const { pdfUnavailableError } = await import("../../src/export/pdf.js");
  const error = pdfUnavailableError();

  assert.equal(error.code, "service_unavailable");
  assert.match(error.action ?? "", /markdown/);
  assert.match(error.action ?? "", /NAIGX_BROWSER_PATH/);
});

test("an explicitly configured browser path that does not exist is not silently replaced", async () => {
  // Falling back would hide the operator's typo and use a browser they did not
  // choose. `null` here becomes the refusal above.
  const found = await findBrowser(
    { NAIGX_BROWSER_PATH: "/nonexistent/chromium" },
    "linux",
  );
  assert.equal(found, null);
});

// --- the claim the browser exists to support --------------------------------

test(
  "Mermaid actually renders — the diagram is drawn, not printed as source",
  { skip },
  async () => {
    // This is the assertion the whole approach rests on. Mermaid renders its
    // own errors as diagrams, so an SVG alone is not enough: the node count
    // and the labels have to be right.
    const html = renderExportHtml(
      "# Diagram\n\n```mermaid\n" + DIAGRAM + "\n```\n",
      "t",
    );

    const require = createRequire(import.meta.url);
    const mermaidSource = readFileSync(
      require.resolve("mermaid/dist/mermaid.min.js"),
      "utf8",
    );

    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.route("**/*", (route) => route.abort());
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      await page.addScriptTag({ content: mermaidSource });

      const result = await page.evaluate(async () => {
        const mermaid = (
          globalThis as unknown as {
            mermaid: {
              initialize: (c: unknown) => void;
              run: (o: { querySelector: string }) => Promise<void>;
            };
          }
        ).mermaid;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });
        await mermaid.run({ querySelector: "pre.mermaid" });
        const svg = document.querySelector("pre.mermaid svg");
        return svg === null
          ? null
          : {
              nodes: svg.querySelectorAll(".node").length,
              text: svg.textContent ?? "",
              width: svg.getBoundingClientRect().width,
            };
      });

      assert.notEqual(result, null, "no svg was produced");
      const rendered = result as { nodes: number; text: string; width: number };

      // Three components plus the external system.
      assert.equal(rendered.nodes, 4);
      assert.ok(rendered.width > 0, "svg has no width");
      assert.match(rendered.text, /Form Watcher/);
      assert.match(rendered.text, /Google Sheets/);
      // Mermaid's own error diagram says so in its text.
      assert.equal(/Syntax error/i.test(rendered.text), false);
    } finally {
      await browser.close();
    }
  },
);

test(
  "the PDF carries the same substance as the Markdown",
  { skip },
  async () => {
    // One serialiser, one content model. Asserted on the rendered page rather
    // than on PDF bytes, because extracting text from a PDF would test the
    // extractor. What the page shows is what the PDF prints.
    const markdownRes = await post("markdown");
    const markdown = markdownRes.body;

    const html = renderExportHtml(markdown, "t");
    const browser = await chromium.launch({
      executablePath: executablePath as string,
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.route("**/*", (route) => route.abort());
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      const text = await page.evaluate(() => document.body.innerText);

      for (const statement of [
        "Confidence: not available",
        "Assessment Feedback",
        "Failed",
        "Architecture Diagram",
        "generated intelligence, not professional advice",
      ]) {
        assert.ok(
          text.includes(statement),
          `the rendered page dropped: ${statement}`,
        );
        assert.ok(
          markdown.includes(statement),
          `the markdown never said: ${statement}`,
        );
      }
    } finally {
      await browser.close();
    }
  },
);

test(
  "renderPdf produces a PDF from a document with no diagram",
  { skip },
  async () => {
    // The job-description path carries no Mermaid. The render must not depend on
    // finding one.
    const pdf = await renderPdf(
      renderExportHtml("# Title\n\nBody with no diagram.\n", "t"),
      { executablePath: executablePath as string },
    );
    assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(pdf.length > 1_000);
  },
);
