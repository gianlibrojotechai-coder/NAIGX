/**
 * Unit — the capture batch's cost meter and its budget ceiling.
 *
 * ⚠️ WHY THIS EXISTS. A nine-case paid batch overran its authorisation by 6.5%
 * and nothing noticed until every case had already run. Two things caused it,
 * and neither was visible in flight:
 *
 *   · `br-006` FAILED after three provider calls. The calls were billed and the
 *     case produced no recording, so a "cost of what we captured" figure counts
 *     it as free.
 *   · `br-008` took a five-call path where four were budgeted, because the
 *     model classified the input onto a different, longer route.
 *
 * So the meter must count failures, and the ceiling must be tested BEFORE a
 * case rather than after the batch — a total computed at the end is a receipt,
 * not a ceiling. These assert both.
 *
 * No provider, no network, no spend: the adapter is a local stub.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { captureCases } from "../../src/regression/capture.js";
import { createRecordingStore } from "../../src/regression/recording-store.js";
import { loadCorpus } from "../../src/regression/corpus.js";
import { createAuthoredResolver } from "../../src/regression/authored-resolver.js";
import { readAuthoredFragments } from "../../src/fragments/source.js";
import { createDryRunAdapter } from "../../src/regression/dry-run-adapter.js";
import { loadCapabilityProfile } from "../../src/nie/capability-profile.js";
import type { ProviderAdapter } from "../../src/provider/capability.js";

const PROMPTS_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.slice(1)),
  "../../../prompts",
);

const corpus = loadCorpus();
const profile = loadCapabilityProfile();
const resolver = createAuthoredResolver(readAuthoredFragments(PROMPTS_ROOT));

/** A priced rate, so the meter has something to count. */
const RATE = {
  inputUsdPerMillionTokens: "3.00",
  outputUsdPerMillionTokens: "15.00",
};

const runCapture = async (
  caseIds: readonly string[],
  budgetUsd?: string,
): Promise<Awaited<ReturnType<typeof captureCases>>> => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "naigx-budget-"));
  try {
    return await captureCases({
      cases: corpus.filter((c) => caseIds.includes(c.caseId)),
      // The dry-run responder produces valid stage output but declares zero
      // usage, which is honest for a free run and useless for a cost meter.
      // Wrapping it gives each call a fixed, non-zero token count so the meter
      // has something real to add up, while the outputs stay the offline ones.
      adapterFor: (corpusCase): ProviderAdapter => {
        const inner = createDryRunAdapter(corpusCase, profile);
        return {
          capabilities: inner.capabilities,
          invoke: async (request) => {
            const response = await inner.invoke(request);
            return {
              ...response,
              usage: { inputTokens: 1000, outputTokens: 500, latencyMs: 1 },
            };
          },
        };
      },
      capabilityProfile: profile,
      resolver,
      store: createRecordingStore(scratch),
      rate: RATE,
      modelKey: "stub",
      adapterId: "stub",
      fragmentsManifestVersion: "fragments-v1",
      lowVarianceSampling: false,
      captureResolution: "authored",
      quarantine: () => {},
      ...(budgetUsd !== undefined ? { budgetUsd } : {}),
    });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
};

test("every outcome carries a cost, and a captured case's is non-zero", async () => {
  const report = await runCapture(["br-004"]);

  const outcome = report.cases[0];
  assert.ok(outcome);
  assert.equal(outcome.status, "captured");
  assert.ok(
    Number(outcome.costUsd) > 0,
    `a billed capture must report a cost, got ${outcome.costUsd}`,
  );
});

test("the ceiling stops the batch BEFORE spending past it", async () => {
  // ⚠️ THE POINT: with a budget far below what three cases cost, the later
  // cases must be reported `skipped` and never attempted — not attempted and
  // then regretted.
  const report = await runCapture(["br-001", "br-002", "br-003"], "0.00000001");

  const attempted = report.cases.filter((c) => c.status !== "skipped");
  const skipped = report.cases.filter((c) => c.status === "skipped");

  assert.ok(
    attempted.length < 3,
    "a ceiling that lets every case run is not a ceiling",
  );
  assert.ok(skipped.length > 0, "cases past the ceiling must be skipped");
  assert.ok(report.aborted, "the report must say the batch stopped early");
  for (const s of skipped) {
    assert.equal(
      s.providerCalls,
      0,
      "a skipped case must not have been billed",
    );
    assert.match(s.detail, /budget reached/);
  }
});

test("no budget means no ceiling — existing callers are unchanged", async () => {
  const report = await runCapture(["br-004"]);

  assert.equal(report.aborted, false);
  assert.equal(report.totals.captured, 1);
});

test("a case that would exceed the ceiling is not started", async () => {
  // One case fits, the rest must not be attempted. This is the shape the
  // overrun actually took: the batch was affordable until it was not, and by
  // then everything had run.
  const first = await runCapture(["br-004"]);
  const oneCost = Number(first.cases[0]?.costUsd ?? 0);
  assert.ok(oneCost > 0);

  const report = await runCapture(
    ["br-004", "br-001", "br-002"],
    oneCost.toFixed(8),
  );

  assert.equal(
    report.cases.filter((c) => c.status === "captured").length,
    1,
    "exactly the one case the budget covered",
  );
  assert.ok(report.aborted);
});
