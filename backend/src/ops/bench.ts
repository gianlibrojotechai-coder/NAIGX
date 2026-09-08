/**
 * Latency measurement — `M-20`, against `API §12.1`.
 *
 *   npm run bench            # default volumes
 *   npm run bench -- 500     # seed 500 analyses for the volume sweep
 *
 * ## ⚠️ WHAT THIS CANNOT MEASURE, AND WHY THAT IS M-20's CENTRAL FINDING
 *
 * `M-20`'s criterion is *"`NFR-001`, `NFR-002` met under representative load"*.
 * Those two are **first artifact visible** (≤15s p50 / ≤40s p95) and **full
 * analysis completion** (≤60s p50 / ≤120s p95), and both are dominated by the
 * model provider's reasoning time — not by anything in this codebase.
 *
 * The standing constraint is no provider spend, so every run here is in
 * **replay mode**, where the adapter returns a recorded response immediately.
 * A replay run therefore measures **this system's own overhead** and says
 * nothing whatsoever about `NFR-001`/`NFR-002`. Reporting a replay number
 * against those targets would be the worst kind of green: a measurement of the
 * wrong thing, in the right units, next to the right requirement.
 *
 * So this tool measures what can be measured honestly and free:
 *
 *   · the four `API §12.1` classes that do not involve a provider, and
 *   · **the overhead this system contributes** to the two that do, which
 *     bounds the budget the model has to fit inside.
 *
 * ## ⚠️ AND THESE ARE DEVELOPMENT-MACHINE NUMBERS
 *
 * One process, one local Postgres, no network between client and server
 * (`app.inject` dispatches in-process), no concurrent users, and a database
 * with development-sized tables. **None of it may be quoted as production
 * performance.** What it is good for: finding the shape of a curve — whether
 * something is flat or grows with volume — and catching a regression against
 * a previous run on the same machine.
 *
 * `app.inject` in particular excludes TLS, the proxy hop, and the network,
 * which are exactly the parts a real client experiences. Server-side work is
 * a *lower bound* on user-observed latency, never an estimate of it.
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { buildApp } from "../app.js";
import { loadConfig } from "../config/env.js";
import { loadCipher } from "../crypto/index.js";
import { open, seal } from "../crypto/envelope.js";
import { createFragmentResolver } from "../db/fragment-resolver.js";
import { renderExportHtml } from "../export/html.js";
import { findBrowser, renderPdf } from "../export/pdf.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { FOUNDATION_FRAGMENT_KEYS } from "../nie/prompt.js";
import type { Database } from "../db/client.js";

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** How many analyses the volume sweep seeds at its largest step. */
const MAX_VOLUME = Number(process.argv[2] ?? "300");

/** Repetitions per measurement. Small runs make percentiles meaningless. */
const SAMPLES = 60;

/** Long enough to be realistic, and to make decryption cost something. */
const SEED_TEXT =
  "We need to automate our lead-to-CRM handoff. Inbound enquiries arrive by " +
  "email and web form, are triaged by hand, and are re-typed into the CRM by " +
  "an operations assistant. Volume is roughly two hundred a week and rising. " +
  "The team wants routing, deduplication and enrichment before a record is " +
  "created, with an audit trail for every automated decision. ".repeat(3);

/** `API §12.1`, verbatim. The budget each measurement is judged against. */
const BUDGETS: Record<string, { p95Ms: number; source: string }> = {
  "GET /health (liveness)": { p95Ms: 200, source: "NFR-003" },
  "GET /health (readiness)": { p95Ms: 200, source: "NFR-003" },
  "GET /analyses/:id": { p95Ms: 200, source: "NFR-003" },
  "GET /analyses (listing)": { p95Ms: 1000, source: "NFR-004" },
  "GET /analyses?q= (search)": { p95Ms: 1000, source: "NFR-004" },
  "POST /analyses (to 202)": { p95Ms: 500, source: "API §12.1 acceptance" },
  "Export PDF (renderPdf)": { p95Ms: 10_000, source: "NFR-005" },
};

/** Nearest-rank, matching `db/metrics.ts` so two tools cannot disagree. */
const percentile = (values: readonly number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)] ?? 0;
};

const ms = (value: number): string => `${value.toFixed(1)}ms`;

interface Result {
  readonly label: string;
  readonly samples: number;
  readonly p50: number;
  readonly p95: number;
  readonly note?: string;
}

const results: Result[] = [];

async function measure(
  label: string,
  samples: number,
  run: () => Promise<unknown>,
  expectStatus?: number,
): Promise<Result> {
  // A few untimed passes first. The first call through any path pays for
  // connection setup, query planning and JIT warmup, and including it makes a
  // p95 that describes the first request rather than the typical one.
  //
  // ⚠️ AND THE WARMUP IS WHERE THE STATUS CODE IS CHECKED. A request that is
  // REJECTED still produces a timing, and a fast, confident, entirely plausible
  // one — the first version of this file measured a 401 from `GET /analyses`
  // and printed sub-millisecond numbers for a decrypt path it never reached.
  // Nothing about the output distinguished that from a real measurement. So
  // every HTTP measurement declares the status it must get, and the run dies
  // here rather than publishing a number for the wrong code path.
  for (let i = 0; i < 3; i += 1) {
    const outcome = await run();
    if (expectStatus === undefined) continue;
    const actual = (outcome as { statusCode?: number }).statusCode;
    if (actual !== expectStatus) {
      throw new Error(
        `${label}: expected HTTP ${String(expectStatus)}, got ${String(actual)}. ` +
          `This measurement would have timed the wrong code path — see the ` +
          `warmup comment in bench.ts.`,
      );
    }
  }

  const timings: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const started = performance.now();
    await run();
    timings.push(performance.now() - started);
  }

  const result: Result = {
    label,
    samples,
    p50: percentile(timings, 50),
    p95: percentile(timings, 95),
  };
  results.push(result);

  const budget = BUDGETS[label];
  const verdict =
    budget === undefined
      ? ""
      : result.p95 <= budget.p95Ms
        ? `  ✅ within ${String(budget.p95Ms)}ms (${budget.source})`
        : `  ❌ OVER ${String(budget.p95Ms)}ms (${budget.source})`;

  console.log(
    `  ${label.padEnd(30)} p50 ${ms(result.p50).padStart(9)}  p95 ${ms(result.p95).padStart(9)}  n=${String(samples)}${verdict}`,
  );
  return result;
}

/**
 * Registers a real account through the API and returns its bearer token.
 *
 * ⚠️ THE LISTING AND SEARCH MEASUREMENTS ARE WORTHLESS WITHOUT THIS, and that
 * is not obvious from their output. `GET /analyses` requires a user
 * (`requireUser`), so an unauthenticated request 401s **before reaching the
 * query** — the run completes, prints a plausible sub-millisecond p95, and
 * measures the authorization rejection instead of the decrypt-and-filter path
 * it claims to. The first version of this file did exactly that.
 */
async function registerUser(
  app: Awaited<ReturnType<typeof buildApp>>,
): Promise<{ userId: string; auth: Record<string, string> }> {
  const res = await app.inject({
    method: "POST",
    url: "/users",
    payload: {
      email: `bench-${randomUUID()}@example.invalid`,
      password: "a-sufficiently-long-benchmark-passphrase",
    },
  });
  const body = JSON.parse(res.body).data as {
    user: { user_id: string };
    access_token: string;
  };
  return {
    userId: body.user.user_id,
    auth: { authorization: `Bearer ${body.access_token}` },
  };
}

/** Seeds `count` analyses for `userId`, sealed exactly as the app writes them. */
async function seed(
  userId: string,
  count: number,
  cipher: { seal: (value: string) => string },
): Promise<string> {
  let firstId = "";
  for (let i = 0; i < count; i += 1) {
    // Unique per row so search cannot be satisfied by a single cached decrypt,
    // and so one row is findable by a term no other row contains.
    const text = `${SEED_TEXT} marker-${String(i)} ${i === 0 ? "UNIQUEHAYSTACKNEEDLE" : ""}`;
    const created = await prisma.analysis.create({
      data: {
        userId,
        status: "completed",
        completedAt: new Date(),
        derivedTitle: `Bench analysis ${String(i)}`,
        input: {
          create: {
            rawContent: cipher.seal(text),
            contentHash: randomUUID(),
            characterCount: text.length,
            sourceType: "paste",
          },
        },
      },
      select: { analysisId: true },
    });
    if (i === 0) firstId = created.analysisId;
  }

  return firstId;
}

async function cleanup(userId: string): Promise<void> {
  await prisma.user.delete({ where: { userId } }).catch(() => undefined);
}

async function main(): Promise<void> {
  const { cipher } = await loadCipher(config, prisma);

  console.log("NAIGX latency measurement — M-20");
  console.log(
    `  node ${process.version} · ${process.platform}/${process.arch}`,
  );
  console.log(
    "  ⚠️  Development machine, one process, no network, no concurrency.",
  );
  console.log(
    "      NOT production performance. See the header of this file.\n",
  );

  // --- 1. the envelope, in isolation ---------------------------------------
  //
  // Measured first and separately because every other number below contains
  // it. D-53 §4 accepted an O(n) search on the argument that "AES-GCM
  // decryption is microseconds per row" — this is that claim, checked.
  console.log("1. Encryption overhead per value (D-53 §4's assumption)");
  {
    // ⚠️ AGGREGATED AND REPORTED IN MICROSECONDS, NOT TIMED PER CALL.
    // One seal takes less than `performance.now()` can resolve here, so timing
    // each call individually printed a confident `0.0ms` — a number that looks
    // like a measurement and is really the clock's resolution. Timing the whole
    // loop and dividing gives a figure that means something, and µs is the unit
    // D-53 §4's claim was actually stated in.
    const key = Buffer.alloc(32, 7);
    const sealed = seal(SEED_TEXT, key, 1);
    const rounds = 20_000;

    let started = performance.now();
    for (let i = 0; i < rounds; i += 1) seal(SEED_TEXT, key, 1);
    const sealUs = ((performance.now() - started) * 1000) / rounds;

    started = performance.now();
    for (let i = 0; i < rounds; i += 1) open(sealed, key);
    const openUs = ((performance.now() - started) * 1000) / rounds;

    console.log(
      `  seal (${String(SEED_TEXT.length)} chars)   mean ${sealUs.toFixed(2)}µs  (n=${String(rounds)})`,
    );
    console.log(
      `  open (${String(SEED_TEXT.length)} chars)   mean ${openUs.toFixed(2)}µs  (n=${String(rounds)})`,
    );
    console.log(
      `  → D-53 §4 assumed "microseconds per row" when it accepted an O(n) search. ${openUs < 1000 ? "Holds." : "⚠️ DOES NOT HOLD."}\n`,
    );
  }

  // --- 2. the API classes that involve no provider -------------------------
  const volumes = [10, 50, MAX_VOLUME].filter(
    (v, i, a) => a.indexOf(v) === i && v <= MAX_VOLUME,
  );

  for (const volume of volumes) {
    console.log(`2. API latency at ${String(volume)} analyses for one user`);

    const app = await buildApp({
      // ⚠️ `silent`, or Fastify's request log drowns the measurements — and
      // writing thousands of log lines to a terminal is itself work being
      // timed. The deployed instance logs at `info`; this measures the server,
      // not the console.
      config: { ...config, logLevel: "silent" },
      database: {
        prisma,
        disconnect: () => Promise.resolve(),
      } as unknown as Database,
      cipher,

      // ⚠️ THESE TWO PROBES ARE THE READINESS MEASUREMENT. Without them
      // `buildApp` leaves both undefined, `probe()` returns `unavailable`
      // without doing any work, and `/health` answers **503 in well under a
      // millisecond** — a number that looks like an excellent result for
      // `NFR-003` and is really the cost of declining to check anything. An
      // earlier run of this benchmark published exactly that figure. It is the
      // same defect as timing a 401, wearing a different status code.
      //
      // `checkTemplates` is production's probe verbatim (`index.ts`): a
      // fragment resolve, which is real database work and the part of
      // readiness that actually costs something.
      checkTemplates: async () => {
        await createFragmentResolver(prisma).resolve([
          ...FOUNDATION_FRAGMENT_KEYS,
        ]);
      },

      // `checkProvider` is stubbed, and that is faithful rather than
      // convenient: production's probe is a *configuration* check with no I/O
      // — it asserts a key and model are present and constructs an adapter,
      // deliberately never calling the provider, because a readiness endpoint
      // is polled continuously. Its cost is not measurably different from
      // resolving. Stubbing it here lets readiness return 200 on a machine
      // with no provider credentials, which the no-spend constraint requires.
      checkProvider: () => Promise.resolve(),
    });

    const { userId, auth } = await registerUser(app);
    const analysisId = await seed(userId, volume, cipher);

    try {
      // Liveness and readiness are different endpoints wearing one URL, and
      // `API-060` makes them deliberately unalike: liveness answers "is this
      // process running" and must never touch an external service, readiness
      // answers "can this instance serve" and consults every dependency.
      // Measuring only one of them would describe the orchestrator's cheaper
      // poll and leave the expensive one unknown.
      await measure(
        "GET /health (liveness)",
        SAMPLES,
        () => app.inject({ method: "GET", url: "/health?check=liveness" }),
        200,
      );

      await measure(
        "GET /health (readiness)",
        SAMPLES,
        () => app.inject({ method: "GET", url: "/health" }),
        200,
      );

      // ⚠️ AUTHENTICATED, and the bearer token is what makes this a
      // measurement of the read path rather than of the ownership guard. The
      // route resolves the principal, loads the analysis and opens its sealed
      // `raw_content`; without the token it would 403 before the decrypt.
      await measure(
        "GET /analyses/:id",
        SAMPLES,
        () =>
          app.inject({
            method: "GET",
            url: `/analyses/${analysisId}`,
            headers: auth,
          }),
        200,
      );

      // The keyset query, untouched by encryption — no search term means the
      // original indexed path (D-53 §4).
      await measure(
        "GET /analyses (listing)",
        SAMPLES,
        () => app.inject({ method: "GET", url: "/analyses", headers: auth }),
        200,
      );

      // ⚠️ THE ONE THAT SHOULD GROW WITH VOLUME. D-53 §4 traded an indexed SQL
      // predicate for decrypt-and-filter over the user's analyses, on the
      // argument that AES-GCM is microseconds a row. This is where that curve
      // becomes visible — compare across the volume steps, not against the
      // budget alone.
      await measure(
        "GET /analyses?q= (search)",
        SAMPLES,
        () =>
          app.inject({
            method: "GET",
            url: "/analyses?q=UNIQUEHAYSTACKNEEDLE",
            headers: auth,
          }),
        200,
      );

      await measure(
        "POST /analyses (to 202)",
        30,
        () =>
          app.inject({
            method: "POST",
            url: "/analyses",
            payload: { content: SEED_TEXT },
            headers: auth,
          }),
        202,
      );
    } finally {
      await app.close();
      await cleanup(userId);
    }
    console.log("");
  }

  // --- 3. export (`NFR-005`, ≤10s p95) -------------------------------------
  //
  // Measured at the renderer rather than through the route, deliberately: the
  // route adds ownership checks and a database read, and `NFR-005`'s budget is
  // dominated by the browser launch. `D-43` chose a browser per call as the
  // simple, leak-free arrangement over the fast one, and this is the number
  // that says what that choice costs.
  console.log("3. Export generation (NFR-005)");
  {
    const browser = await findBrowser();
    if (browser === undefined || browser === null) {
      console.log(
        "  ⚠️  NOT MEASURED — no Chromium-family browser found on this machine.",
      );
      console.log(
        "      Reported as unmeasured rather than skipped silently; NFR-005 is",
      );
      console.log("      unverified without it.\n");
    } else {
      const html = renderExportHtml(
        `# Benchmark export\n\n${SEED_TEXT}\n\n## A section\n\n- one\n- two\n`,
        "Benchmark export",
      );
      // Far fewer samples than the API measurements: each one launches and
      // tears down a browser, and 60 of those would take minutes to tell us
      // what 10 already do.
      await measure("Export PDF (renderPdf)", 10, () =>
        renderPdf(html, { executablePath: browser }),
      );
      console.log("");
    }
  }

  console.log("4. What was NOT measured, and why");
  console.log(
    "  NFR-001 (first artifact ≤15s p50 / ≤40s p95) and NFR-002 (full analysis",
  );
  console.log(
    "  ≤60s p50 / ≤120s p95) are dominated by MODEL PROVIDER latency. Every run",
  );
  console.log(
    "  here is replay mode — the adapter answers instantly from a fixture — so",
  );
  console.log(
    "  a number from this tool measures this system's overhead and NOTHING about",
  );
  console.log(
    "  those two targets. ⚠️ They are M-20's own criterion, and they remain",
  );
  console.log("  UNMEASURED under the no-provider-spend constraint.\n");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
  await pool.end();
}
