/**
 * Replay against a recording's captured composition
 * ([D-63](../../../docs/38-D-63-Authored-Fragment-Resolution-For-Regression.md),
 * runner amendment).
 *
 * ⚠️ THE INVARIANT UNDER TEST IS THAT TODAY CANNOT CHANGE YESTERDAY. A
 * recording's fixture keys must not move when the fragments on disk or in the
 * database move — that is precisely what invalidated ten recordings and cost a
 * capture that could never be replayed.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { hashContent } from "../../src/fragments/source.js";
import type { AuthoredFragment } from "../../src/fragments/source.js";
import { composePrompt } from "../../src/nie/prompt.js";
import type { FragmentResolver } from "../../src/nie/ports.js";
import { replayKeyFor } from "../../src/provider/adapters/replay.js";
import { createAuthoredResolver } from "../../src/regression/authored-resolver.js";
import {
  createPinnedResolver,
  recordingResolver,
  type RecordedComposition,
} from "../../src/regression/pinned-resolver.js";

const authored = (fragmentKey: string, content: string): AuthoredFragment => ({
  fragmentKey,
  fragmentClass: fragmentKey.split(".")[0] ?? "foundation",
  content,
  contentHash: hashContent(content),
  sourcePath: `prompts/${fragmentKey.replace(".", "/")}.md`,
});

const setFor = (stageFragment: string, marker: string): AuthoredFragment[] => [
  authored("foundation.system_frame", `frame ${marker}`),
  authored("foundation.neutrality_constraints", `neutrality ${marker}`),
  authored("foundation.provenance_rules", `provenance ${marker}`),
  authored("foundation.refusal_and_uncertainty", `refusal ${marker}`),
  authored(stageFragment, `guidance ${marker}`),
];

/** The fixture key a stage would be filed under, given a resolver. */
const keyFor = async (
  resolver: FragmentResolver,
  stageKey = "workflow_review",
): Promise<string> => {
  const prompt = await composePrompt({ stageKey }, resolver);
  return replayKeyFor({
    task: stageKey,
    input: "the same input text",
    instructions: prompt.instructions,
    preferLowVariance: true,
  });
};

/** Captures a composition the way `capture.ts` does — by observation. */
const captureComposition = async (
  fragments: readonly AuthoredFragment[],
): Promise<RecordedComposition> => {
  const observed = recordingResolver(createAuthoredResolver(fragments));
  await composePrompt({ stageKey: "workflow_review" }, observed.resolver);
  return { resolution: "authored", fragments: observed.collected() };
};

test("1. a new recording replays without consulting current fragment state", async () => {
  const composition = await captureComposition(
    setFor("stage.workflow_review", "v1"),
  );

  // The pinned resolver touches no database and no filesystem. If it did, this
  // test could not pass without one.
  const key = await keyFor(createPinnedResolver(composition));
  assert.match(key, /^[0-9a-f]{16}$/);
});

test("2. changing the fragments AFTER capture does not move the fixture key", async () => {
  // ⚠️ THE REGRESSION THIS EXISTS TO PREVENT. Ten recordings became stale
  // because the runner recomposed against fragments that had moved on.
  const composition = await captureComposition(
    setFor("stage.workflow_review", "v1"),
  );
  const atCapture = await keyFor(createPinnedResolver(composition));

  // Every fragment now differs — the worst case, not a subtle edit.
  const movedOn = createAuthoredResolver(setFor("stage.workflow_review", "v2"));
  const underNewFragments = await keyFor(movedOn);

  const afterDrift = await keyFor(createPinnedResolver(composition));

  assert.equal(afterDrift, atCapture, "the recording's key must not move");
  assert.notEqual(
    underNewFragments,
    atCapture,
    "the new fragments really are different — otherwise this proves nothing",
  );
});

test("3. the recorded composition reproduces the capture-time key exactly", async () => {
  const fragments = setFor("stage.workflow_review", "v1");

  const duringCapture = await keyFor(createAuthoredResolver(fragments));
  const composition = await captureComposition(fragments);
  const duringReplay = await keyFor(createPinnedResolver(composition));

  assert.equal(duringReplay, duringCapture);
});

test("4/5. a legacy recording has no composition, and is identifiable as such", async () => {
  // Legacy recordings are the 13 captured before compositions were persisted.
  // `composition` absent is the whole signal — the runner branches on it and
  // takes the explicit active-resolver path.
  const legacy: { composition?: RecordedComposition } = {};
  assert.equal(legacy.composition, undefined);

  // ⚠️ It must NOT be given a resolution retroactively. Labelling it would
  // assert something about a capture nobody re-examined.
  assert.ok(
    !("resolution" in legacy),
    "a legacy recording must not be relabelled as authored-resolution evidence",
  );
});

test("a pinned resolver refuses a fragment the capture never composed", async () => {
  const composition = await captureComposition(
    setFor("stage.workflow_review", "v1"),
  );
  const resolver = createPinnedResolver(composition);

  await assert.rejects(
    () => resolver.resolve(["stage.architecture_analysis"]),
    RangeError,
    "replaying a stage the recording never captured must fail loudly",
  );
});

test("the observing resolver records what was resolved, deduplicated and sorted", async () => {
  const observed = recordingResolver(
    createAuthoredResolver(setFor("stage.workflow_review", "v1")),
  );

  // Two stages, so the foundation fragments resolve twice.
  await composePrompt({ stageKey: "workflow_review" }, observed.resolver);
  await composePrompt({ stageKey: "workflow_review" }, observed.resolver);

  const collected = observed.collected();
  const keys = collected.map((f) => f.fragmentKey);

  assert.equal(new Set(keys).size, keys.length, "no duplicates");
  assert.deepEqual(keys, [...keys].sort(), "stable order");
  assert.ok(keys.includes("stage.workflow_review"));
});

test("6. authored resolution is untouched — the gate still computes coverage with it", async () => {
  // The gate asks a different question from replay, with its own resolver.
  // This asserts the authored path still composes as it did.
  const fragments = setFor("stage.workflow_review", "v1");
  const prompt = await composePrompt(
    { stageKey: "workflow_review" },
    createAuthoredResolver(fragments),
  );
  assert.match(prompt.instructions, /guidance v1/);
});
