/**
 * Unit — capture/replay parity for the Stage 7 capability profile (`FR-022`).
 *
 * ⚠️ THE DEFECT THIS LOCKS OUT, WHICH HAD TWO HALVES AND ONE SYMPTOM.
 *
 * `capture.ts` passes the operator inventory into the pipeline, so a
 * `job_description` case runs Stage 7 and records four stages. Replay did not:
 *
 *   1. `runRegression` never passed a profile to `createPipeline`, so Stage 7
 *      halted and the case failed `run_completeness` with "No capability
 *      profile supplied" — against a recording captured WITH one.
 *   2. Fixing only that exposed the second half: `createRecordedProvider` never
 *      passed the profile to `stageProviderInputs` either, and that function
 *      describes a Stage 7 call only when a profile is present. So no fixture
 *      was filed for Stage 7 and replay failed with "No recorded response for
 *      request key …".
 *
 * Both messages point at the recording. Neither is about the recording. This is
 * the third instance of the same family — the `workflow_review` defect
 * (`stageProviderInputs`) and the `--case=` asymmetry were the first two: a
 * detail known at capture and not carried to replay.
 *
 * These assert the parity directly, so a future caller that forgets the profile
 * fails here rather than after a paid capture.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { loadCapabilityProfile } from "../../src/nie/capability-profile.js";
import { loadCorpus } from "../../src/regression/corpus.js";
import { stageProviderInputs } from "../../src/nie/pipeline.js";
import { RECORDING_ROOT } from "../../src/regression/recording-store.js";
import type { RecordingSet } from "../../src/harness/recordings.js";

const profile = loadCapabilityProfile();

/**
 * ⚠️ THE REAL CORPUS TEXT, NOT A PLACEHOLDER. Stage 3 verifies that every
 * `stated` element quotes the input verbatim, so `stageProviderInputs` cannot parse a
 * recorded context set against unrelated text — it returns early and describes
 * a run that stops at Stage 3. Passing a stand-in here made all three tests
 * fail for a reason that had nothing to do with the profile.
 */
const jd008Text =
  loadCorpus().find((c) => c.caseId === "jd-008")?.inputText ?? "";

/** The held jd-008 recording — the first job-description capture that exists. */
const HELD = path.resolve(
  RECORDING_ROOT,
  "..",
  "regression-pending",
  "corpus-v1",
  "jd-008.json",
);

const heldRecording = (): {
  inputTextHash: string;
  stages: RecordingSet;
} | null =>
  fs.existsSync(HELD)
    ? (JSON.parse(fs.readFileSync(HELD, "utf8")) as {
        inputTextHash: string;
        stages: RecordingSet;
      })
    : null;

const outputsFrom = (stages: RecordingSet) => {
  const out = (k: string): string | undefined =>
    stages.find((s) => s.stageKey === k)?.output;
  return {
    ...(out("input_classification") !== undefined
      ? { classification: out("input_classification") as string }
      : {}),
    ...(out("intent_detection") !== undefined
      ? { intent: out("intent_detection") as string }
      : {}),
    ...(out("context_extraction") !== undefined
      ? { context: out("context_extraction") as string }
      : {}),
  };
};

test("a job_description handoff keys a Stage 7 fixture ONLY when a profile is given", () => {
  const recording = heldRecording();
  if (recording === null) return; // held evidence is not in every checkout

  const outputs = outputsFrom(recording.stages);

  const without = stageProviderInputs(jd008Text, outputs);
  const with_ = stageProviderInputs(jd008Text, {
    ...outputs,
    capabilityProfile: profile,
  });

  assert.equal(
    without.has("recommendation_generation"),
    false,
    "without a profile the pipeline makes no Stage 7 call, so none may be keyed",
  );
  assert.equal(
    with_.has("recommendation_generation"),
    true,
    "⚠️ THE BUG: with a profile Stage 7 IS called, so a fixture must be keyed " +
      "for it — otherwise replay reports the evidence missing",
  );
});

test("the profile reaches the Stage 7 handoff, not just the call decision", () => {
  const recording = heldRecording();
  if (recording === null) return;

  const handoff = stageProviderInputs(jd008Text, {
    ...outputsFrom(recording.stages),
    capabilityProfile: profile,
  }).get("recommendation_generation");

  assert.ok(handoff, "Stage 7 must be keyed");
  // The fixture key is a hash of this string, so the profile being *in* it is
  // what makes the recorded and replayed keys agree.
  assert.match(
    handoff,
    /capability_profile/,
    "the profile must travel in the handoff the key is computed from",
  );
  const firstLocator = profile.capabilities[0]?.evidence[0]?.locator;
  assert.ok(firstLocator);
  assert.ok(
    handoff.includes(firstLocator),
    "the declared locators must reach the model verbatim — the locator rule " +
      "depends on them being visible to copy",
  );
});

test("every recorded job_description stage gets a provider input", () => {
  // The end-to-end shape of the failure: a recording with four stages whose
  // fixture set covered three. `createRecordedProvider` SKIPS a recorded stage
  // with no provider input, so the shortfall is silent until Stage 7 runs.
  const recording = heldRecording();
  if (recording === null) return;

  const inputs = stageProviderInputs(jd008Text, {
    ...outputsFrom(recording.stages),
    capabilityProfile: profile,
  });

  const unkeyed = recording.stages
    .map((s) => s.stageKey)
    .filter((k) => !inputs.has(k));

  assert.deepEqual(
    unkeyed,
    [],
    `every recorded stage must be keyed; unkeyed: ${unkeyed.join(", ")}`,
  );
});
