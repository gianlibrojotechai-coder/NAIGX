/**
 * Encryption operations — provisioning, status, and the backfill.
 *
 *   npm run encrypt:init      -- create key version 1 (dev)
 *
 * In a deployment it runs from the COMPILED output, because the runtime image
 * prunes dev dependencies and ships no `scripts/` directory — `tsx` does not
 * exist there. That is why this file lives under `src/` rather than beside the
 * other CLI scripts:
 *
 *   docker compose ... run --rm encrypt init
 *   npm run encrypt:status    -- how much is still plaintext
 *   npm run encrypt:backfill  -- seal existing rows, resumably
 *
 * ⚠️ WHY THE BACKFILL IS NOT A SQL MIGRATION. Sealing a row needs the data key,
 * which needs a call to the key service, which SQL cannot make. So the schema
 * migration adds the tables and this command seals the content — and between
 * the two, the tables legitimately hold a mixture. `status` is what tells you
 * the window has closed; nothing else will, because a partly-backfilled table
 * serves reads perfectly well (`FieldCipher.open` passes plaintext through) and
 * looks exactly like a finished one.
 *
 * Ordering, on a real deployment:
 *
 *   1. prisma migrate deploy   -- the tables
 *   2. encrypt:init            -- the key (production only; dev self-provisions)
 *   3. encrypt:backfill        -- the content
 *   4. encrypt:status          -- confirm zero plaintext remain
 *
 * The backfill is **idempotent and resumable**. It seals only values that are
 * not already sealed, so interrupting it and running it again costs nothing and
 * cannot double-seal a row.
 */

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { loadConfig } from "../config/env.js";
import { isSealed } from "../crypto/envelope.js";
import { loadCipher, resolveKeyProvider } from "../crypto/index.js";
import { provisionFirstKey } from "../crypto/data-key.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaClient as TracePrismaClient } from "../generated/prisma-trace/client.js";

const config = loadConfig();

const primaryPool = new pg.Pool({ connectionString: config.databaseUrl });
const tracePool = new pg.Pool({ connectionString: config.traceDatabaseUrl });
const primary = new PrismaClient({ adapter: new PrismaPg(primaryPool) });
const trace = new TracePrismaClient({ adapter: new PrismaPg(tracePool) });

/** How many rows are read and written per pass. Bounded so memory is too. */
const BATCH = 200;

const close = async (): Promise<void> => {
  await primary.$disconnect();
  await trace.$disconnect();
  await primaryPool.end();
  await tracePool.end();
};

async function init(): Promise<void> {
  const existing = await primary.encryptionKey.findMany({
    orderBy: { version: "desc" },
  });
  if (existing.length > 0) {
    console.log(
      `A key already exists (version ${String(existing[0]?.version)}, ` +
        `provider ${String(existing[0]?.provider)}). Nothing to do.`,
    );
    console.log(
      "⚠️  Creating a second key here would NOT be a rotation — it would be a " +
        "new ring with no relationship to the rows sealed under the first.",
    );
    return;
  }

  const provider = resolveKeyProvider(config);
  const { version } = await provisionFirstKey(primary, provider);
  console.log(
    `✅ Provisioned key version ${String(version)} via ${provider.name}.`,
  );
  console.log(
    "⚠️  Losing the root key file destroys the encrypted fields and every " +
      "backup of them (D-61 §4). Keep a copy somewhere off this host, and " +
      "NOT alongside the database dumps — one archive holding both the " +
      "ciphertext and its key protects neither.",
  );
}

async function status(): Promise<void> {
  const [inputTotal, traceTotal] = await Promise.all([
    primary.analysisInput.count(),
    trace.stageTrace.count(),
  ]);

  // Counted by reading, because "is it sealed" is a property of the value and
  // not something the database can answer with a predicate.
  let plaintextInputs = 0;
  for (let skip = 0; skip < inputTotal; skip += BATCH) {
    const rows = await primary.analysisInput.findMany({
      select: { rawContent: true },
      orderBy: { analysisId: "asc" },
      skip,
      take: BATCH,
    });
    plaintextInputs += rows.filter((row) => !isSealed(row.rawContent)).length;
  }

  let plaintextTraces = 0;
  for (let skip = 0; skip < traceTotal; skip += BATCH) {
    const rows = await trace.stageTrace.findMany({
      select: { structuredInput: true, structuredOutput: true },
      orderBy: { stageTraceId: "asc" },
      skip,
      take: BATCH,
    });
    plaintextTraces += rows.filter(
      (row) =>
        !(
          typeof row.structuredInput === "string" &&
          isSealed(row.structuredInput)
        ) ||
        (row.structuredOutput !== null &&
          !(
            typeof row.structuredOutput === "string" &&
            isSealed(row.structuredOutput)
          )),
    ).length;
  }

  console.log(
    `analysis_input.raw_content : ${String(inputTotal - plaintextInputs)}/${String(inputTotal)} sealed`,
  );
  console.log(
    `stage_trace.structured_*   : ${String(traceTotal - plaintextTraces)}/${String(traceTotal)} sealed`,
  );

  const outstanding = plaintextInputs + plaintextTraces;
  if (outstanding === 0) {
    console.log(
      "\n✅ No plaintext rows remain. DB §13.1 row 3 is satisfied for stored content.",
    );
  } else {
    console.log(
      `\n⚠️  ${String(outstanding)} row(s) still plaintext. Run \`npm run encrypt:backfill\`.`,
    );
    console.log(
      "   Until then the reads pass plaintext through, so the service works " +
        "and the gap is invisible in behaviour — this count is the only signal.",
    );
    process.exitCode = 1;
  }
}

async function backfill(): Promise<void> {
  const { cipher } = await loadCipher(config, primary);

  // --- analysis_input.raw_content ------------------------------------------
  let scannedInputs = 0;
  for (;;) {
    const rows = await primary.analysisInput.findMany({
      select: { analysisId: true, rawContent: true },
      orderBy: { analysisId: "asc" },
      take: BATCH,
      skip: scannedInputs,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      if (isSealed(row.rawContent)) continue;
      await primary.analysisInput.update({
        where: { analysisId: row.analysisId },
        // ⚠️ `content_hash` and `character_count` are NOT recomputed. They
        // describe the plaintext, and rewriting them from the envelope would
        // break duplicate detection and `FR-002`'s bounds.
        data: { rawContent: cipher.seal(row.rawContent) },
      });
    }
    scannedInputs += rows.length;
  }

  // --- stage_trace.structured_input / structured_output ---------------------
  let seenTraces = 0;
  for (;;) {
    const rows = await trace.stageTrace.findMany({
      select: {
        stageTraceId: true,
        structuredInput: true,
        structuredOutput: true,
      },
      orderBy: { stageTraceId: "asc" },
      take: BATCH,
      skip: seenTraces,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const input = row.structuredInput;
      const output = row.structuredOutput;

      const inputNeedsSealing = !(typeof input === "string" && isSealed(input));
      const outputNeedsSealing =
        output !== null && !(typeof output === "string" && isSealed(output));

      if (!inputNeedsSealing && !outputNeedsSealing) continue;

      await trace.stageTrace.update({
        where: { stageTraceId: row.stageTraceId },
        data: {
          ...(inputNeedsSealing
            ? { structuredInput: cipher.seal(JSON.stringify(input)) }
            : {}),
          // A SQL NULL stays a SQL NULL — "the stage produced no output" is
          // absence, not content, and sealing it would make a failed stage
          // indistinguishable from one that returned null.
          ...(outputNeedsSealing
            ? { structuredOutput: cipher.seal(JSON.stringify(output)) }
            : {}),
        },
      });
    }
    seenTraces += rows.length;
  }

  console.log(
    `✅ Backfill complete. Scanned ${String(scannedInputs)} input row(s) and ` +
      `${String(seenTraces)} stage trace(s).`,
  );
  console.log("Run `npm run encrypt:status` to confirm nothing remains.");
}

const command = process.argv[2];

try {
  switch (command) {
    case "init":
      await init();
      break;
    case "status":
      await status();
      break;
    case "backfill":
      await backfill();
      break;
    default:
      console.error("Usage: encrypt.mts <init|status|backfill>");
      process.exitCode = 1;
  }
} finally {
  await close();
}
