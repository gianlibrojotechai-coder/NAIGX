/**
 * Unit — which composition a LEGACY recording replays against
 * ([D-64](../../../docs/39-D-64-Pass-Reference-Composition-Contract.md) §4.2).
 *
 * ⚠️ THE DEFECT THIS EXISTS TO PREVENT. The D-63 §7 amendment sent every
 * recording without a persisted `composition` to the **active** resolver, on
 * the stated grounds that active "is what they were captured under". That was
 * true of the thirteen recordings in the store when it was written, and false
 * the moment D-63 §2 moved capture to the authored resolver while §7 did not
 * yet persist compositions. `ew-001` was captured in exactly that window: it
 * reproduces under **authored** and is **unresolvable** under active, because
 * it composes `stage.workflow_review`, which has never been published.
 *
 * So absence of a field is not evidence of provenance. The recording's own
 * `fragmentsCompositionHash` is, and these assert that it is what decides.
 *
 * No database, no provider, no network. The authored resolver reads `prompts/`;
 * the "active" side is modelled by resolvers that publish a chosen subset,
 * which is what an active database *is* from a composition's point of view.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { hashContent } from "../../src/fragments/source.js";
import type { AuthoredFragment } from "../../src/fragments/source.js";
import { readAuthoredFragments } from "../../src/fragments/source.js";
import type { RecordingSet } from "../../src/harness/recordings.js";
import { createAuthoredResolver } from "../../src/regression/authored-resolver.js";
import {
  fragmentsCompositionHash,
  RECORDING_ROOT,
} from "../../src/regression/recording-store.js";
import { resolveLegacyComposition } from "../../src/regression/runner.js";

const PROMPTS_ROOT = path.resolve(RECORDING_ROOT, "..", "..", "prompts");

const authoredFragment = (
  fragmentKey: string,
  content: string,
): AuthoredFragment => ({
  fragmentKey,
  fragmentClass: fragmentKey.split(".")[0] ?? "foundation",
  content,
  contentHash: hashContent(content),
  sourcePath: `prompts/${fragmentKey.replace(".", "/")}.md`,
});

/** A composition of four foundation fragments plus one stage fragment. */
const setFor = (marker: string): AuthoredFragment[] => [
  authoredFragment("foundation.system_frame", `frame ${marker}`),
  authoredFragment("foundation.neutrality_constraints", `neutrality ${marker}`),
  authoredFragment("foundation.provenance_rules", `provenance ${marker}`),
  authoredFragment("foundation.refusal_and_uncertainty", `refusal ${marker}`),
  authoredFragment("stage.classification", `guidance ${marker}`),
];

const STAGES: RecordingSet = [
  {
    stageKey: "input_classification",
    output: "{}",
    inputTokens: 1,
    outputTokens: 1,
    latencyMs: 1,
  },
];

const ACTIVE = createAuthoredResolver(setFor("ACTIVE"));
const AUTHORED = createAuthoredResolver(setFor("AUTHORED"));
/** Publishes nothing — an active database that has never seen the fragment. */
const UNPUBLISHED = createAuthoredResolver([]);

const candidates = [
  { resolution: "active" as const, resolver: ACTIVE },
  { resolution: "authored" as const, resolver: AUTHORED },
];

test("a legacy recording reproducing only under ACTIVE resolves active", async () => {
  const recorded = await fragmentsCompositionHash(STAGES, ACTIVE);

  const { matched } = await resolveLegacyComposition(
    STAGES,
    recorded,
    candidates,
  );

  assert.equal(matched?.resolution, "active");
});

test("a legacy recording reproducing only under AUTHORED resolves authored", async () => {
  // ⚠️ THIS IS THE ew-001 SHAPE, and the case D-63 §7 got wrong. Active is
  // tried first and does not reproduce the hash, so it is rejected rather than
  // used — the old code would have declared this recording stale.
  const recorded = await fragmentsCompositionHash(STAGES, AUTHORED);

  const { matched } = await resolveLegacyComposition(
    STAGES,
    recorded,
    candidates,
  );

  assert.equal(matched?.resolution, "authored");
});

test("a recording reproducing under BOTH keeps its historical `active` label", async () => {
  // Where authored and active agree the composed bytes are identical, so the
  // label is the only thing at stake. D-63 §5 rejected relabelling historical
  // evidence as authored, and candidate order is what honours that.
  const same = createAuthoredResolver(setFor("SAME"));
  const recorded = await fragmentsCompositionHash(STAGES, same);

  const { matched } = await resolveLegacyComposition(STAGES, recorded, [
    { resolution: "active", resolver: same },
    {
      resolution: "authored",
      resolver: createAuthoredResolver(setFor("SAME")),
    },
  ]);

  assert.equal(
    matched?.resolution,
    "active",
    "an identical composition must not be relabelled authored",
  );
});

test("a candidate that THROWS is an answer, not an error", async () => {
  // An active database with no row for a composed fragment must not abort the
  // search — it simply is not what the recording was captured under. Without
  // this, ew-001 dies before authored is ever tried.
  const recorded = await fragmentsCompositionHash(STAGES, AUTHORED);

  const { matched, tried } = await resolveLegacyComposition(STAGES, recorded, [
    { resolution: "active", resolver: UNPUBLISHED },
    { resolution: "authored", resolver: AUTHORED },
  ]);

  assert.equal(matched?.resolution, "authored");
  assert.ok(
    tried.includes("active=unresolvable"),
    `the unresolvable candidate must be reported, got ${tried.join(", ")}`,
  );
});

test("when NO candidate reproduces the hash, the recording is stale", async () => {
  const { matched, tried } = await resolveLegacyComposition(
    STAGES,
    "f".repeat(64),
    candidates,
  );

  assert.equal(matched, undefined, "a near-miss must never be accepted");
  assert.equal(tried.length, 2, "every candidate must be reported as tried");
});

// --- the real held recording ---------------------------------------------

test("ew-001 reproduces the AUTHORED composition it was captured under", async () => {
  // ⚠️ THE REAL FILE, NOT A FIXTURE. `research/regression-pending/ew-001.json`
  // is real, paid provider evidence captured 2026-09-08T12:29Z — after D-63 §2
  // switched capture to authored resolution, before §7 persisted compositions.
  // If this goes red, the held evidence can no longer be replayed at all.
  const file = path.resolve(
    RECORDING_ROOT,
    "..",
    "regression-pending",
    "ew-001.json",
  );
  if (!fs.existsSync(file)) {
    // Held evidence is deliberately untracked (see its README), so a fresh
    // checkout legitimately has no copy. Skipping is honest; asserting a file
    // that is not part of the repository would fail for the wrong reason.
    return;
  }

  const recording = JSON.parse(fs.readFileSync(file, "utf8")) as {
    fragmentsCompositionHash: string;
    composition?: unknown;
    stages: RecordingSet;
  };

  assert.equal(
    recording.composition,
    undefined,
    "ew-001 must still be a LEGACY recording — this test is about that path",
  );

  const authored = createAuthoredResolver(readAuthoredFragments(PROMPTS_ROOT));
  const { matched } = await resolveLegacyComposition(
    recording.stages,
    recording.fragmentsCompositionHash,
    [
      // `stage.workflow_review` has no published version anywhere, so this
      // models the active database exactly: it cannot compose ew-001.
      { resolution: "active", resolver: UNPUBLISHED },
      { resolution: "authored", resolver: authored },
    ],
  );

  assert.equal(
    matched?.resolution,
    "authored",
    "ew-001 must replay against the authored composition it was captured with",
  );
});
