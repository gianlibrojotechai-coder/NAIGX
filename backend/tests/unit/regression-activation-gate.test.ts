/**
 * Unit — the fragment activation gate (`NFR-043`, `DB §4.5`, `docs/12` D-24, D-30).
 *
 * `DB §4.5` says a fragment version "cannot become active without a recorded
 * passing regression run", and until now any non-empty string satisfied that.
 * These assert the six ways the gate refuses and the one way it permits.
 *
 * ⚠️ THE SIXTH REFUSAL IS `composition_mismatch`, ADDED BY
 * [D-64](../../../docs/39-D-64-Pass-Reference-Composition-Contract.md) §4.3.
 * Coverage establishes which cases *reach* a fragment; it never established
 * which content they reached it *with*. So a run that replayed every case
 * against the ACTIVE composition satisfied every other check while evidencing
 * content the activation would replace — exactly what `docs/12` D-24 dec. 4
 * forbids. That was measured on the real committed reference, not imagined.
 *
 * The permitting case is a run document whose per-case composition hashes are
 * computed by `fragmentsCompositionHash` over the **real** recordings, with the
 * same resolver the gate checks against — so it models a run that genuinely
 * exercised the candidate composition rather than a fixture agreeing with
 * itself.
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
import {
  createRecordingStore,
  fragmentsCompositionHash,
} from "../../src/regression/recording-store.js";
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

// --- D-64 §4.3 — the composition the run exercised ------------------------

/**
 * A clean run document whose per-case composition hashes are the ones
 * `resolver` actually produces — i.e. a run that genuinely exercised the
 * composition about to be activated.
 *
 * ⚠️ This is not a fixture agreeing with itself. The hashes are computed by
 * `fragmentsCompositionHash` over the **real** recordings' stage sets, which is
 * the same function the runner uses to record them and the gate uses to check
 * them. What is synthesised is the *run*, not the composition.
 */
const exercisingRun = async (
  runId: string,
  caseIds: readonly string[],
): Promise<{ reference: string; doc: unknown }> => {
  const reference = `corpus-regression:corpus-v2+fragments-v1:${runId}`;
  const docCases = [];
  for (const caseId of caseIds) {
    const corpusCase = cases.find((c) => c.caseId === caseId);
    assert.ok(corpusCase, `${caseId} is not in the corpus`);
    const verified = store.read(corpusCase.corpusVersion, caseId);
    assert.ok(verified, `${caseId} has no recording`);
    docCases.push({
      caseId,
      recordingHash: "a".repeat(64),
      fragmentsCompositionHash: await fragmentsCompositionHash(
        verified.recording.stages,
        resolver,
      ),
      assertionsEvaluated: ["classification"],
    });
  }
  return {
    reference,
    doc: { suite: "corpus-regression", reference, runId, cases: docCases },
  };
};

/**
 * Every case a foundation fragment composes into — all **fourteen** recorded.
 *
 * ⚠️ `ew-001` was admitted 2026-09-09, which is why this is 14. A foundation
 * fragment composes into every recording, so admitting one widens what any
 * reference must cover to stay sufficient — that is the gate working, and it
 * is exactly why admission is a decision rather than a filing step.
 */
const ALL_RECORDED = [
  "br-001",
  "br-002",
  "br-003",
  "br-004",
  "br-005",
  "br-006",
  "br-007",
  "br-008",
  "br-009",
  "br-010",
  "br-011",
  "ew-001",
  "un-001",
  "un-002",
];

test("a clean run that exercised the composition being activated permits it", async () => {
  const runId = "3333333333333333";
  const { reference, doc } = await exercisingRun(runId, ALL_RECORDED);

  await withRun(doc, runId, async (runsRoot) => {
    await assert.doesNotReject(
      gate(
        reference,
        [
          "foundation.system_frame",
          "foundation.provenance_rules",
          "stage.classification",
        ],
        runsRoot,
      ),
      "a run whose exercised composition matches the candidate must be accepted",
    );
  });
});

test("every named fragment must be covered, not merely one of them", async () => {
  const runId = "4444444444444444";
  const { reference, doc } = await exercisingRun(runId, ALL_RECORDED);

  await withRun(doc, runId, async (runsRoot) => {
    const error = await refusal(
      gate(
        reference,
        ["foundation.system_frame", "stage.portfolio_suggestions"],
        runsRoot,
      ),
    );
    assert.equal(error.reason, "fragment_not_covered");
    assert.equal(error.fragmentKey, "stage.portfolio_suggestions");
  });
});

test("a run that exercised a DIFFERENT composition is refused (D-24 dec. 4)", async () => {
  // Same cases, same coverage, same clean run — and one case replayed a
  // composition that is not the one being activated. ⚠️ THIS IS THE WHOLE
  // POINT OF D-64 §4.3: coverage establishes which cases reach the fragment,
  // never which content they reached it with.
  const runId = "5555555555555555";
  const { doc } = await exercisingRun(runId, ALL_RECORDED);
  const tampered = doc as {
    cases: { caseId: string; fragmentsCompositionHash: string }[];
  };
  const first = tampered.cases[0];
  assert.ok(first, "the run must have a case to tamper with");
  first.fragmentsCompositionHash = "f".repeat(64);
  const reference = `corpus-regression:corpus-v2+fragments-v1:${runId}`;

  await withRun(tampered, runId, async (runsRoot) => {
    const error = await refusal(
      gate(reference, ["foundation.system_frame"], runsRoot),
    );
    assert.equal(error.reason, "composition_mismatch");
    assert.equal(error.fragmentKey, "foundation.system_frame");
    assert.match(error.message, /br-001/);
    assert.match(error.message, /D-24 decision 4/);
  });
});

// --- the measured drift, as an explicit deviation ------------------------

test("the committed reference is REFUSED for the drifted fragments (D-64 §5)", async () => {
  // ⚠️ THE DEVIATION, ASSERTED RATHER THAN DESCRIBED. `4ea7eef7345389e9`
  // replayed every case against the ACTIVE composition. Three authored
  // fragments have since drifted from their active versions, so that run is
  // not evidence for the authored content — and every recorded case composes
  // at least one drifted fragment, which is why NO fragment activates on it.
  //
  // This test exists so the drift cannot be silently grandfathered: if someone
  // makes the gate permit this again, this goes red.
  // ⚠️ `type.business_requirement`, not a foundation fragment. Admitting
  // `ew-001` (2026-09-09) made every foundation fragment compose into 14 cases
  // while the committed run covers 13, so foundation now refuses on
  // `fragment_not_covered` — a true refusal, but one that short-circuits
  // BEFORE the composition check and would leave the drift untested. The
  // eleven `br-*` cases this fragment covers all ran, so coverage is satisfied
  // and the composition comparison is what refuses.
  const error = await refusal(
    gate(committed.reference, ["type.business_requirement"]),
  );

  assert.equal(
    error.reason,
    "composition_mismatch",
    "the committed run exercised active composition; the candidate is authored",
  );
  assert.match(error.message, /Re-capture the covered cases/);

  // And foundation is still refused, for the other correct reason.
  assert.equal(
    (await refusal(gate(committed.reference, ["foundation.system_frame"])))
      .reason,
    "fragment_not_covered",
    "the committed 13-case run no longer covers the 14 cases foundation composes into",
  );
});
