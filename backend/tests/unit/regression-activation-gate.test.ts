/**
 * Unit — the fragment activation gate (`NFR-043`, `DB §4.5`, `docs/12` D-24, D-30).
 *
 * `DB §4.5` says a fragment version "cannot become active without a recorded
 * passing regression run", and until now any non-empty string satisfied that.
 * These assert the five ways the gate refuses and the one way it permits.
 *
 * The permitting case is built from the **real** committed run and the real
 * corpus and recordings, so it is not a fixture agreeing with itself: the run
 * `4ea7eef7345389e9` covers `br-001`–`br-011` and `un-001`–`un-002`, which is
 * exactly the set every foundation fragment composes into.
 *
 * Reads two directories. No database, no provider, no network, no writes.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ActivationRefusedError,
  assertActivationPermitted,
  REGRESSION_RUNS_ROOT,
} from "../../src/regression/activation-gate.js";
import { loadCorpus, loadSuiteVersion } from "../../src/regression/corpus.js";
import { createRecordingStore } from "../../src/regression/recording-store.js";
import type {
  FragmentResolver,
  ResolvedFragment,
} from "../../src/nie/ports.js";

const resolver: FragmentResolver = {
  resolve: (keys: readonly string[]): Promise<readonly ResolvedFragment[]> =>
    Promise.resolve(
      keys.map((fragmentKey): ResolvedFragment => ({
        fragmentKey,
        fragmentVersionId: `${fragmentKey}@pending`,
        version: "pending",
        content: `[${fragmentKey}]`,
      })),
    ),
};

const cases = loadCorpus();
const suiteVersion = loadSuiteVersion();
const store = createRecordingStore();

/** The committed run, and the reference that names it. */
const COMMITTED_RUN_ID = "4ea7eef7345389e9";
const committed = JSON.parse(
  fs.readFileSync(
    path.join(REGRESSION_RUNS_ROOT, `${COMMITTED_RUN_ID}.json`),
    "utf8",
  ),
) as { reference: string };

const gate = (
  reference: string | undefined,
  fragmentKeys: readonly string[],
  runsRoot?: string,
) =>
  assertActivationPermitted({
    reference,
    fragmentKeys,
    cases,
    suiteVersion,
    store,
    resolver,
    ...(runsRoot !== undefined ? { runsRoot } : {}),
  });

const refusal = async (
  promise: Promise<unknown>,
): Promise<ActivationRefusedError> => {
  try {
    await promise;
  } catch (error) {
    assert.ok(
      error instanceof ActivationRefusedError,
      `expected a refusal, got ${String(error)}`,
    );
    return error;
  }
  return assert.fail("expected the gate to refuse, but it permitted");
};

/** Writes a reference document into a scratch runs directory. */
const withRun = async (
  doc: unknown,
  runId: string,
  body: (runsRoot: string) => Promise<void>,
): Promise<void> => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "naigx-runs-"));
  fs.writeFileSync(
    path.join(root, `${runId}.json`),
    JSON.stringify(doc),
    "utf8",
  );
  try {
    await body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

// --- refusals ------------------------------------------------------------

test("no reference is refused", async () => {
  const error = await refusal(gate(undefined, ["foundation.system_frame"]));
  assert.equal(error.reason, "missing_reference");

  assert.equal(
    (await refusal(gate("   ", ["foundation.system_frame"]))).reason,
    "missing_reference",
    "whitespace is not a reference",
  );
});

test("the Sprint 1 manifest-gate placeholder is refused", async () => {
  // `docs/12` D-14 recorded it as honest for Sprint 1 and always meant to be
  // replaced. There is no fallback to it and no bypass.
  const error = await refusal(
    gate("fragment-manifest-gate:fragments-v1", ["foundation.system_frame"]),
  );

  assert.equal(error.reason, "placeholder_reference");
  assert.match(error.message, /not evidence that any fragment was exercised/);
});

test("a reference naming no recorded run is refused", async () => {
  assert.equal(
    (
      await refusal(
        gate("corpus-regression:corpus-v2+fragments-v1:0000000000000000", [
          "foundation.system_frame",
        ]),
      )
    ).reason,
    "unresolvable_reference",
  );

  assert.equal(
    (await refusal(gate("not-a-reference", ["foundation.system_frame"])))
      .reason,
    "unresolvable_reference",
    "a string that is not the reference format at all",
  );
});

test("a run document that disagrees with its own reference is refused", async () => {
  const runId = "abcdef0123456789";
  const reference = `corpus-regression:corpus-v2+fragments-v1:${runId}`;

  await withRun(
    {
      suite: "corpus-regression",
      reference: "corpus-regression:x+y:deadbeefdeadbeef",
      runId,
      cases: [],
    },
    runId,
    async (runsRoot) => {
      assert.equal(
        (await refusal(gate(reference, ["foundation.system_frame"], runsRoot)))
          .reason,
        "unresolvable_reference",
      );
    },
  );
});

test("a run with no evidence is refused as not clean", async () => {
  const runId = "1111111111111111";
  const reference = `corpus-regression:corpus-v2+fragments-v1:${runId}`;

  // No cases at all.
  await withRun(
    { suite: "corpus-regression", reference, runId, cases: [] },
    runId,
    async (runsRoot) => {
      assert.equal(
        (await refusal(gate(reference, ["foundation.system_frame"], runsRoot)))
          .reason,
        "run_not_clean",
      );
    },
  );

  // A case carrying no recording hash — the shape a missing, stale or
  // unmanifested recording leaves behind (`docs/12` D-24).
  await withRun(
    {
      suite: "corpus-regression",
      reference,
      runId,
      cases: [
        {
          caseId: "br-001",
          recordingHash: "",
          assertionsEvaluated: ["classification"],
        },
      ],
    },
    runId,
    async (runsRoot) => {
      const error = await refusal(
        gate(reference, ["foundation.system_frame"], runsRoot),
      );
      assert.equal(error.reason, "run_not_clean");
      assert.match(error.message, /br-001/);
    },
  );
});

test("a clean run that did not exercise the fragment is refused", async () => {
  const runId = "2222222222222222";
  const reference = `corpus-regression:corpus-v2+fragments-v1:${runId}`;

  // Clean, but it ran one case. `foundation.system_frame` composes into all 13
  // recorded cases, so twelve of them did not run.
  await withRun(
    {
      suite: "corpus-regression",
      reference,
      runId,
      cases: [
        {
          caseId: "br-001",
          recordingHash: "a".repeat(64),
          assertionsEvaluated: ["classification"],
        },
      ],
    },
    runId,
    async (runsRoot) => {
      const error = await refusal(
        gate(reference, ["foundation.system_frame"], runsRoot),
      );
      assert.equal(error.reason, "fragment_not_covered");
      assert.equal(error.fragmentKey, "foundation.system_frame");
      assert.match(error.message, /did not run/);
    },
  );
});

test("a fragment no recorded case composes cannot be activated", async () => {
  // `stage.portfolio_suggestions` is only reached on the job-description path,
  // and no `jd-*` case has a recording. There is no run that could cover it.
  const error = await refusal(
    gate(committed.reference, ["stage.portfolio_suggestions"]),
  );

  assert.equal(error.reason, "fragment_not_covered");
  assert.match(error.message, /No recorded case composes/);
});

// --- the one way through -------------------------------------------------

test("a clean run covering the fragment permits activation", async () => {
  // The real committed run over the real recordings.
  await assert.doesNotReject(
    gate(committed.reference, [
      "foundation.system_frame",
      "foundation.provenance_rules",
      "stage.classification",
    ]),
  );
});

test("every named fragment must be covered, not merely one of them", async () => {
  const error = await refusal(
    gate(committed.reference, [
      "foundation.system_frame",
      "stage.portfolio_suggestions",
    ]),
  );

  assert.equal(error.reason, "fragment_not_covered");
  assert.equal(error.fragmentKey, "stage.portfolio_suggestions");
});
