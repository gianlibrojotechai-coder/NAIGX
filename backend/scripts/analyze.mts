/**
 * The minimal harness CLI — `Roadmap` Sprint 1 Interface deliverable.
 *
 *   npm run analyze -- <file>      analyse a file
 *   cat input.txt | npm run analyze
 *   npm run analyze -- <file> --provider stub
 *   npm run analyze -- <file> --provider anthropic   real model request
 *
 * Deliberately unstyled: it prints the raw structured report as JSON and gets
 * out of the way. All of the work happens in `src/harness/run.ts`, which wires
 * the production pipeline together; this file only reads arguments and writes
 * output.
 */

import fs from "node:fs";

// Composition root: the only place that reads the environment (`src/index.ts`
// does the same).
import "dotenv/config";

import { runHarness } from "../src/harness/run.js";

const args = process.argv.slice(2);
const providerIndex = args.indexOf("--provider");
const provider =
  providerIndex >= 0
    ? (args[providerIndex + 1] as "recorded" | "stub" | "replay" | "anthropic")
    : "recorded";
const path = args.find((a) => !a.startsWith("--") && a !== provider);

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const inputText =
  path !== undefined ? fs.readFileSync(path, "utf8") : await readStdin();

try {
  const report = await runHarness({ inputText, provider });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  // A failed analysis is a legitimate observation, not a broken harness — but
  // the exit code still distinguishes them for scripting.
  // `exitCode` rather than `exit()`: forcing exit while the provider SDK still
  // holds open sockets aborts the process during libuv teardown on Windows.
  // Letting Node drain naturally settles them first.
  process.exitCode = report.outcome === "failed" ? 1 : 0;
} catch (error) {
  process.stderr.write(
    `${JSON.stringify(
      {
        outcome: "harness_error",
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 2;
}
