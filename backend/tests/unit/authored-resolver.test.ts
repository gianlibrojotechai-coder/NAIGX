/**
 * Authored-fragment resolution for regression evidence
 * ([D-63](../../../docs/38-D-63-Authored-Fragment-Resolution-For-Regression.md)).
 *
 * ⚠️ THE POINT OF THESE TESTS IS THE BOUNDARY, NOT THE HAPPY PATH. Authored
 * resolution exists so a never-active fragment can be exercised; the danger is
 * that it quietly becomes a second way to reach production. So most of what is
 * asserted here is what authored resolution does **not** do.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AUTHORED_VERSION,
  createAuthoredResolver,
} from "../../src/regression/authored-resolver.js";
import { hashContent } from "../../src/fragments/source.js";
import type { AuthoredFragment } from "../../src/fragments/source.js";
import { composePrompt } from "../../src/nie/prompt.js";
import {
  buildPassReference,
  FRAGMENT_RESOLUTIONS,
} from "../../src/regression/pass-reference.js";
import type { RegressionReport } from "../../src/regression/runner.js";

const authored = (fragmentKey: string, content: string): AuthoredFragment => ({
  fragmentKey,
  fragmentClass: fragmentKey.split(".")[0] ?? "foundation",
  content,
  contentHash: hashContent(content),
  sourcePath: `prompts/${fragmentKey.replace(".", "/")}.md`,
});

/** Every fragment `composePrompt` needs for a stage, including a never-active one. */
const fragmentsFor = (stageFragmentKey: string): AuthoredFragment[] => [
  authored("foundation.system_frame", "frame"),
  authored("foundation.neutrality_constraints", "neutrality"),
  authored("foundation.provenance_rules", "provenance"),
  authored("foundation.refusal_and_uncertainty", "refusal"),
  authored(stageFragmentKey, `guidance for ${stageFragmentKey}`),
];

test("a NEVER-ACTIVE fragment composes from its authored version", async () => {
  // `stage.workflow_review` is the fragment that has never been active in any
  // database, and the one whose absence made `ew-001` uncapturable. Nothing
  // here touches a database; that is the entire fix.
  const resolver = createAuthoredResolver(
    fragmentsFor("stage.workflow_review"),
  );

  const prompt = await composePrompt({ stageKey: "workflow_review" }, resolver);

  assert.ok(
    prompt.fragments.some((f) => f.fragmentKey === "stage.workflow_review"),
    "the never-active fragment must appear in the composition",
  );
  assert.match(prompt.instructions, /guidance for stage\.workflow_review/);
});

test("capture and runner compose IDENTICALLY from the same authored fragments", async () => {
  // ⚠️ THIS IS THE ONE THAT MAKES A RECORDING REPLAYABLE. Fixture keys are
  // built from the composed prompt, so if capture and the runner composed
  // differently no recording could ever be replayed — and the money spent
  // capturing it would buy nothing.
  const fragments = fragmentsFor("stage.workflow_review");

  const captureSide = await composePrompt(
    { stageKey: "workflow_review" },
    createAuthoredResolver(fragments),
  );
  const runnerSide = await composePrompt(
    { stageKey: "workflow_review" },
    createAuthoredResolver(fragments),
  );

  assert.equal(captureSide.instructions, runnerSide.instructions);
  assert.deepEqual(
    captureSide.fragments.map((f) => f.fragmentVersionId),
    runnerSide.fragments.map((f) => f.fragmentVersionId),
  );
});

test("the authored version identifier is derived from content, not invented", async () => {
  // Two resolvers over identical content must agree, or the same recording
  // would key differently on a later run.
  const a = createAuthoredResolver(fragmentsFor("stage.workflow_review"));
  const b = createAuthoredResolver(fragmentsFor("stage.workflow_review"));

  const [ra] = await a.resolve(["stage.workflow_review"]);
  const [rb] = await b.resolve(["stage.workflow_review"]);

  assert.equal(ra?.fragmentVersionId, rb?.fragmentVersionId);
  assert.match(ra?.fragmentVersionId ?? "", /^authored:[0-9a-f]{12}$/);

  // ⚠️ NOT a version number. An authored fragment has no version — reporting
  // "1" would make a candidate indistinguishable from a published first
  // version in any trace that records it.
  assert.equal(ra?.version, AUTHORED_VERSION);
  assert.notEqual(ra?.version, "1");
});

test("an unknown fragment key fails loudly rather than composing a shorter prompt", async () => {
  const resolver = createAuthoredResolver([
    authored("foundation.system_frame", "x"),
  ]);

  await assert.rejects(
    () => resolver.resolve(["stage.does_not_exist"]),
    RangeError,
    "a missing fragment must not silently drop out of the composition",
  );
});

/** A minimal clean report — enough for `buildPassReference` to emit. */
const cleanReport = (): RegressionReport =>
  ({
    suiteVersion: "corpus-v2",
    mode: "recorded",
    startedAt: "2026-09-08T00:00:00.000Z",
    cases: [
      {
        caseId: "ew-001",
        outcome: "passed",
        assertionsEvaluated: ["classification"],
        evidence: {
          recordingHash: "a".repeat(64),
          capturedAt: "2026-09-08T00:00:00.000Z",
          fragmentsCompositionHash: "b".repeat(64),
        },
      },
    ],
    totals: {
      selected: 1,
      passed: 1,
      failed: 0,
      blocked: 0,
      stale: 0,
      errored: 0,
    },
  }) as unknown as RegressionReport;

test("authored evidence is DISTINGUISHABLE from active evidence in its attestation", async () => {
  const authoredRef = buildPassReference({
    report: cleanReport(),
    fragmentsManifestVersion: "fragments-v1",
    fragmentResolution: "authored",
  });
  const activeRef = buildPassReference({
    report: cleanReport(),
    fragmentsManifestVersion: "fragments-v1",
    fragmentResolution: "active",
  });

  assert.equal(authoredRef?.fragmentResolution, "authored");
  assert.match(authoredRef?.attests ?? "", /AUTHORED/);
  assert.match(authoredRef?.attests ?? "", /MAY DIFFER/);

  assert.equal(activeRef?.fragmentResolution, "active");
  assert.match(activeRef?.attests ?? "", /ACTIVE/);

  // A reader must be able to tell them apart without knowing when either ran.
  assert.notEqual(authoredRef?.attests, activeRef?.attests);
});

test("existing callers are unchanged: resolution defaults to active", () => {
  // ⚠️ Pre-D-63 evidence was necessarily composed from active fragments. The
  // default preserves that meaning for any caller that does not opt in.
  const reference = buildPassReference({
    report: cleanReport(),
    fragmentsManifestVersion: "fragments-v1",
  });

  assert.equal(reference?.fragmentResolution, "active");
  assert.match(reference?.attests ?? "", /ACTIVE/);
});

test("the recorded-mode caveat survives on both resolutions", () => {
  // D-24 decision 3's wording must not be lost by adding a clause to it.
  for (const resolution of FRAGMENT_RESOLUTIONS) {
    const reference = buildPassReference({
      report: cleanReport(),
      fragmentsManifestVersion: "fragments-v1",
      fragmentResolution: resolution,
    });
    assert.match(
      reference?.attests ?? "",
      /NOT evidence that the current prompt/,
    );
  }
});
