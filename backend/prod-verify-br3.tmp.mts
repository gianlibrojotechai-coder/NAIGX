/**
 * Production verification of D-72/D-73/D-74: one billed business-requirement
 * analysis under a temporary allowlisted account, observed from a real browser
 * against https://naigx.tech. Prints a JSON report; never prints the password.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { findBrowser } from "./src/export/pdf.js";

const BASE = "https://naigx.tech";
const OUT = process.argv[2] ?? ".";
const EMAIL = process.argv[3] ?? "";
if (EMAIL === "") throw new Error("email argument required");
const PASSWORD = randomBytes(18).toString("base64url");

const yaml = readFileSync("../research/golden-corpus/business-requirement/br-001.yaml", "utf8");
const lines = yaml.split(/\r?\n/);
const from = lines.findIndex((l) => l.startsWith("content: |")) + 1;
const block: string[] = [];
for (const l of lines.slice(from)) {
  if (l === "" || l.startsWith("  ")) block.push(l.replace(/^  /, ""));
  else break;
}
const content = block.join("\n").trim();

const executablePath = await findBrowser();
if (executablePath === null) throw new Error("no browser");
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

const streamRequests: { authorization: boolean; lastEventId: string | null; at: number }[] = [];
const streamResponses: { status: number; contentType: string; at: number }[] = [];
const t0 = Date.now();
page.on("request", (r) => {
  if (r.url().includes("/events")) {
    const h = r.headers();
    streamRequests.push({
      authorization: typeof h["authorization"] === "string" && h["authorization"].startsWith("Bearer "),
      lastEventId: h["last-event-id"] ?? null,
      at: Date.now() - t0,
    });
  }
});
page.on("response", (r) => {
  if (r.url().includes("/events")) {
    streamResponses.push({ status: r.status(), contentType: String(r.headers()["content-type"] ?? ""), at: Date.now() - t0 });
  }
});
await page.addInitScript(() => {
  const w = window as unknown as { __sse: { at: number; chunk: string }[]; fetch: typeof fetch };
  w.__sse = [];
  const orig = w.fetch.bind(window);
  const start = Date.now();
  w.fetch = async (input, init) => {
    const res = await orig(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/events") || res.body === null) return res;
    const [mine, theirs] = res.body.tee();
    void (async () => {
      const reader = mine.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        w.__sse.push({ at: Date.now() - start, chunk: decoder.decode(value, { stream: true }) });
      }
    })().catch(() => undefined);
    return new Response(theirs, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
});

await page.goto(BASE);
await page.waitForSelector("main", { timeout: 20_000 });

await page.getByRole("button", { name: /^Sign in$/ }).first().click();
await page.waitForTimeout(500);
const toggle = page.getByRole("button", { name: /Create the owner account/i });
if (await toggle.count()) await toggle.first().click();
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password").fill(PASSWORD);
await page.getByRole("button", { name: /^Create account$/ }).click();
await page.getByText(EMAIL).first().waitFor({ timeout: 20_000 });
console.log("registered", EMAIL);

await page.locator("textarea").first().fill(content);
const submitted = Date.now();
await page.locator("textarea").first().locator("xpath=ancestor::form").locator("button[type=submit]").click();

// Mid-run: the rail as lit by whatever the stream has delivered so far.
const snapshots: { at: number; rail: string; frames: number }[] = [];
for (const wait of [20_000, 60_000, 120_000, 200_000]) {
  await page.waitForTimeout(wait - (Date.now() - submitted) > 0 ? wait - (Date.now() - submitted) : 0);
  if ((await page.getByText(/Complexity score/i).count()) > 0) break;
  const main = await page.locator("main").innerText().catch(() => "");
  const frames = await page.evaluate(() => (window as unknown as { __sse: unknown[] }).__sse.length);
  snapshots.push({ at: Date.now() - submitted, rail: main.slice(0, 500).replace(/\n+/g, " | "), frames });
  await page.screenshot({ path: join(OUT, `prod-br3-processing-${String(wait / 1000)}s.png`), fullPage: true });
}

let reached = true;
try {
  await page.waitForFunction(() => document.body.innerText.includes("Complexity score"), undefined, { timeout: 480_000 });
} catch {
  reached = false;
}
const completedAt = Date.now() - submitted;
await page.waitForTimeout(1_500);
await page.screenshot({ path: join(OUT, "prod-br3-analysis.png"), fullPage: true });

const received = await page.evaluate(() => {
  const chunks = (window as unknown as { __sse: { at: number; chunk: string }[] }).__sse;
  const raw = chunks.map((c) => c.chunk).join("");
  return {
    chunks: chunks.length,
    firstChunkAt: chunks[0]?.at ?? null,
    lastChunkAt: chunks[chunks.length - 1]?.at ?? null,
    events: (raw.match(/^event: (\w+)$/gm) ?? []).map((l) => l.slice(7)),
    ids: (raw.match(/^id: (\d+)$/gm) ?? []).map((l) => l.slice(4)),
  };
});

const mainText = await page.locator("main").innerText();
const report = {
  email: EMAIL,
  reached,
  completedAtMs: completedAt,
  streamRequests,
  streamResponses,
  received,
  snapshots,
  summaryLine: (mainText.match(/Produced \d+ artifacts?:[^\n]*/) ?? [null])[0],
  artifactHeadings: (await page.locator("h3, h2").allInnerTexts()).filter((x) => /recommendation|diagram|brief|analysis/i.test(x)).map((x) => x.split("\n")[1] ?? x),
  analysisId: (mainText.match(/Analysis ([0-9a-f-]{36})/) ?? [null, null])[1],
};
console.log(JSON.stringify(report, null, 2));
writeFileSync(join(OUT, "prod-br3-report.json"), JSON.stringify(report, null, 2));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5_000))]);
process.exit(0);
