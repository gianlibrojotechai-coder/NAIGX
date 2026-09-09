/**
 * Unit — the recorded corpus a replay deployment serves from (D-62).
 *
 * ⚠️ WHAT THIS PROVES, AND WITH WHAT. These run against the REAL canonical
 * store, the REAL frozen corpus and the REAL authored fragments — the
 * composition the pass reference `d4abcd42626452df` was verified against and
 * the one the publisher will activate. No stand-ins: a stand-in corpus would
 * prove the loader works on a corpus nobody deploys.
 *
 * The load-bearing test is the third one. It builds ONE replay adapter from
 * the merged fixtures of every served recording and runs the production
 * pipeline through it for a case — which is exactly what a deployed instance
 * does with a submission. The regression runner builds one adapter per case;
 * merging them is the new thing here, and the thing that could silently break.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { test } from "node:test";

import { readAuthoredFragments } from "../../src/fragments/source.js";
import { loadCapabilityProfile } from "../../src/nie/capability-profile.js";
import { createPipeline } from "../../src/nie/pipeline.js";
import { createReplayProvider } from "../../src/provider/adapters/replay.js";
import { createProviderInvoker } from "../../src/provider/invoke.js";
import { createAuthoredResolver } from "../../src/regression/authored-resolver.js";
import { loadCorpus } from "../../src/regression/corpus.js";
import { createRecordingStore } from "../../src/regression/recording-store.js";
import {
  assertReplayServable,
  loadReplayCorpus,
  type ReplayCorpus,
} from "../../src/regression/replay-corpus.js";

const PROMPTS_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.slice(1)),
  "../../../prompts",
);

const corpus = loadCorpus();
const store = createRecordingStore();
const profile = loadCapabilityProfile();
const authored = readAuthoredFragments(PROMPTS_ROOT);

/** The composition a deployment holds after publishing what is authored. */
const published = createAuthoredResolver(authored);

const load = (): Promise<ReplayCorpus> =>
  loadReplayCorpus({
    cases: corpus,
    store,
    resolver: published,
    capabilityProfile: profile,
  });

/** Every recording the canonical store holds, from its own manifest. */
const canonical = (): readonly string[] =>
  Object.keys(store.readManifest("corpus-v1")?.recordings ?? {}).sort();

test("1. every canonical recording is accounted for — served or excluded with a reason, never dropped", async () => {
  const loaded = await load();
  const seen = [
    ...loaded.served,
    ...loaded.excluded.map((e) => e.caseId),
  ].sort();

  assert.deepEqual(seen, canonical());
  for (const e of loaded.excluded) {
    assert.ok(e.reason.length > 0, `${e.caseId} excluded without a reason`);
  }
  // The rest of the corpus simply has no recording. That is not an exclusion.
  assert.equal(loaded.unrecorded, corpus.length - canonical().length);
});

test("2. against the published composition, every PINNED recording is served and files its fixtures", async () => {
  const loaded = await load();

  // The recordings captured with a persisted composition were captured
  // against these exact authored fragments, so the deployment reproduces
  // their hash by construction. If one is excluded here, the fragments on
  // disk have moved since capture and the pass reference is stale too.
  const pinned = canonical().filter(
    (id) => store.read("corpus-v1", id)?.recording.composition !== undefined,
  );
  assert.ok(
    pinned.length >= 11,
    "the campaign admitted at least 11 pinned recordings",
  );
  for (const id of pinned) {
    assert.ok(
      loaded.served.includes(id),
      `${id} should be served: ${JSON.stringify(loaded.excluded)}`,
    );
  }

  // One fixture per recorded stage, merged across cases with no collisions.
  const expectedFixtures = loaded.served.reduce(
    (n, id) => n + (store.read("corpus-v1", id)?.recording.stages.length ?? 0),
    0,
  );
  assert.equal(Object.keys(loaded.fixtures).length, expectedFixtures);

  // ⚠️ Honest per `AI §10.6`: every campaign recording declares default
  // sampling, so the merged adapter must not claim low variance.
  assert.equal(loaded.lowVarianceSampling, false);
});

test("3. ONE adapter built from the merged corpus serves a submission through the production pipeline", async () => {
  const loaded = await load();
  const adapter = createReplayProvider({
    fixtures: loaded.fixtures,
    lowVarianceSampling: loaded.lowVarianceSampling,
  });

  // A job-description case: the longest served path, and the one that needs
  // the capability profile threaded through to key Stage 7 at all.
  const caseId = loaded.served.includes("jd-002") ? "jd-002" : loaded.served[0];
  assert.ok(caseId !== undefined, "nothing served — the test cannot run");
  const corpusCase = corpus.find((c) => c.caseId === caseId);
  assert.ok(corpusCase !== undefined);

  const pipeline = createPipeline({
    invoker: createProviderInvoker({
      adapter,
      rate: {
        inputUsdPerMillionTokens: "0.00",
        outputUsdPerMillionTokens: "0.00",
      },
      recorder: { record: () => Promise.resolve() },
      sleep: () => Promise.resolve(),
      random: () => 0,
    }),
    resolver: published,
    traceSink: { record: () => Promise.resolve() },
    fragmentUsageSink: { record: () => Promise.resolve() },
    modelVersionId: randomUUID(),
    modelKey: "replay",
    capabilityProfile: profile,
  });

  const result = await pipeline.run({
    analysisId: randomUUID(),
    text: corpusCase.inputText,
  });

  // It reasoned from the recording rather than halting for want of a fixture.
  assert.equal(result.classification.determinedType, corpusCase.inputType);
  assert.equal(
    result.haltedAt,
    undefined,
    `halted: ${JSON.stringify(result.haltedAt)}`,
  );

  // ⚠️ AND THE RECORDED STAGE 9 ANSWER WAS SERVED. Before Stage 9 was keyed,
  // this run reached its terminal stage, `run_completeness` passed, and the
  // portfolio artifact quietly landed `failed` with "No recorded response for
  // request key …" — the recording held the answer and the builder never
  // filed it. A halt check alone cannot see that; the artifact outcome can.
  const portfolio = result.artifactPlan?.find(
    (entry) => entry.artifactType === "portfolio_suggestions",
  );
  assert.ok(portfolio !== undefined && portfolio.planned, "jd-002 plans it");
  assert.notEqual(
    portfolio.outcome,
    "failed",
    "the recorded Stage 9 answer must be replayed, not re-derived",
  );
});

test("4. a recording is NOT served when the deployment composes a different prompt than it was captured against", async () => {
  // Move one foundation fragment — every stage composes it, so every
  // recording's captured composition stops reproducing.
  const drifted = createAuthoredResolver(
    authored.map((f) =>
      f.fragmentKey === "foundation.system_frame"
        ? { ...f, content: `${f.content}\n\n(edited after capture)` }
        : f,
    ),
  );
  const loaded = await loadReplayCorpus({
    cases: corpus,
    store,
    resolver: drifted,
    capabilityProfile: profile,
  });

  assert.deepEqual(loaded.served, []);
  assert.deepEqual(loaded.fixtures, {});
  assert.equal(loaded.excluded.length, canonical().length);
  for (const e of loaded.excluded) {
    assert.match(e.reason, /not the one it was captured against/);
  }
  // And readiness says so, with the D-62 phrase the runbook greps for intact.
  assert.throws(
    () => {
      assertReplayServable(loaded);
    },
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes("no recordings are available") &&
      error.message.includes("excluded") &&
      error.message.includes("D-62"),
  );
});

test("5. an instance that can compose nothing serves nothing and says why", async () => {
  // A deployment with no published fragments at all — the state the host is
  // in before the publisher runs.
  const unpublished = {
    resolve: () =>
      Promise.reject(
        new Error(
          "No active published version for fragment(s): foundation.system_frame",
        ),
      ),
  };
  const loaded = await loadReplayCorpus({
    cases: corpus,
    store,
    resolver: unpublished,
  });

  assert.deepEqual(loaded.served, []);
  for (const e of loaded.excluded) {
    assert.match(e.reason, /cannot compose its stages here/);
  }
  assert.throws(() => {
    assertReplayServable(loaded);
  }, /no recordings are available/);
});

test("6. a servable corpus passes readiness", async () => {
  assertReplayServable(await load());
});
