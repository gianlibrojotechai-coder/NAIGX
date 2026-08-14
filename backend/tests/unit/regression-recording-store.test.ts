/**
 * Unit — the recorded-response store (`AI §12.3` recorded mode).
 *
 * The store is what recorded mode reads and what a future capture command
 * writes. Its job is to be strict: a malformed or half-written recording must
 * fail on read, because the alternative is replaying part of a run and
 * reporting the result as a measurement.
 *
 * Writes only to a temporary directory. Nothing here touches
 * `research/regression-recordings/`, and nothing here captures anything.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildRecordingManifest,
  createRecordingStore,
  detectRecordingDrift,
  inputTextHash,
  isCleanRecordingSet,
  parseCaseRecording,
  RECORDING_ROOT,
  RecordingIntegrityError,
  type CaseRecording,
} from "../../src/regression/recording-store.js";

const tempRoot = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "naigx-recordings-"));

const recording: CaseRecording = {
  caseId: "br-001",
  corpusVersion: "corpus-v1",
  inputTextHash: inputTextHash("some input text"),
  fragmentsManifestVersion: "fragments-v1",
  fragmentsCompositionHash: "a".repeat(64),
  capturedAt: "2026-08-14T00:00:00Z",
  provider: { adapter: "test", modelKey: "test-model" },
  lowVarianceSampling: true,
  stages: [
    {
      stageKey: "input_classification",
      output: '{"determined_type":"business_requirement"}',
      inputTokens: 400,
      outputTokens: 40,
      latencyMs: 600,
    },
  ],
};

/** Writes a recording and records it in the manifest, as capture would. */
const seeded = (root: string): void => {
  const store = createRecordingStore(root);
  store.write(recording);
  store.writeManifest(
    buildRecordingManifest("corpus-v1", store.hashes("corpus-v1")),
  );
};

test("a manifested recording round-trips through the filesystem", () => {
  const root = tempRoot();
  try {
    const store = createRecordingStore(root);
    assert.equal(store.read("corpus-v1", "br-001"), undefined);
    assert.deepEqual(store.list("corpus-v1"), []);

    seeded(root);

    const verified = store.read("corpus-v1", "br-001");
    assert.deepEqual(verified?.recording, recording);
    assert.ok(verified?.contentHash);
    assert.deepEqual(store.list("corpus-v1"), ["br-001"]);
    // Filed by corpus version: a recording is only valid for the corpus it was
    // captured against.
    assert.equal(store.read("corpus-v2", "br-001"), undefined);
    // The manifest itself is not evidence.
    assert.ok(!store.list("corpus-v1").includes("recordings.manifest"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- the evidence gate (docs/12 D-24) ------------------------------------

test("an unmanifested recording is refused, not replayed", () => {
  const root = tempRoot();
  try {
    const store = createRecordingStore(root);
    store.write(recording); // captured but never recorded in the manifest

    assert.throws(
      () => store.read("corpus-v1", "br-001"),
      RecordingIntegrityError,
      "evidence that never appeared in a reviewed diff must not be usable",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a hand-edited recording is detected by its content hash", () => {
  const root = tempRoot();
  try {
    seeded(root);
    const store = createRecordingStore(root);

    // Someone edits the captured answer to say what the corpus expects.
    const file = path.join(root, "corpus-v1", "br-001.json");
    const tampered = JSON.parse(fs.readFileSync(file, "utf8")) as CaseRecording;
    fs.writeFileSync(
      file,
      `${JSON.stringify(
        {
          ...tampered,
          stages: [
            {
              ...tampered.stages[0],
              output: '{"determined_type":"job_description"}',
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    assert.throws(
      () => store.read("corpus-v1", "br-001"),
      /does not match the manifest/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("drift detection mirrors the fragment gate's three kinds", () => {
  const root = tempRoot();
  try {
    seeded(root);
    const store = createRecordingStore(root);
    const manifest = store.readManifest("corpus-v1");
    assert.ok(manifest);

    assert.ok(
      isCleanRecordingSet(
        detectRecordingDrift(store.hashes("corpus-v1"), manifest),
      ),
    );

    // added / changed / removed, each surfaced by name.
    assert.deepEqual(detectRecordingDrift({ "br-002": "x" }, manifest), {
      added: ["br-002"],
      removed: ["br-001"],
      changed: [],
    });
    assert.deepEqual(detectRecordingDrift({ "br-001": "x" }, manifest), {
      added: [],
      removed: [],
      changed: ["br-001"],
    });
    // No manifest at all means nothing is gated.
    assert.deepEqual(
      detectRecordingDrift(store.hashes("corpus-v1"), undefined).added,
      ["br-001"],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("malformed recordings are rejected on read", () => {
  const cases: readonly [string, string][] = [
    ["not JSON", "{"],
    ["a missing case id", JSON.stringify({ ...recording, caseId: "" })],
    [
      "a missing input text hash",
      JSON.stringify({ ...recording, inputTextHash: undefined }),
    ],
    [
      "no composition hash — the D-24 staleness check would be unrunnable",
      JSON.stringify({ ...recording, fragmentsCompositionHash: undefined }),
    ],
    ["no stages", JSON.stringify({ ...recording, stages: [] })],
    [
      "a stage missing its output",
      JSON.stringify({
        ...recording,
        stages: [{ stageKey: "input_classification" }],
      }),
    ],
    [
      "no provider attribution",
      JSON.stringify({ ...recording, provider: undefined }),
    ],
  ];

  for (const [label, raw] of cases) {
    assert.throws(
      () => parseCaseRecording(raw, "fixture.json"),
      /fixture\.json/,
      `${label} must be rejected`,
    );
  }
});

test("the committed recordings match their manifest", () => {
  // Superseded the pre-capture guard that asserted the store was empty. The
  // evidence now exists, so the honest invariant is no longer "nothing has been
  // captured" but "everything captured is gated" — a recording that entered
  // without appearing in a reviewed manifest diff, or was edited afterwards, is
  // exactly what `docs/12` D-14 and D-24 exist to surface.
  if (!fs.existsSync(RECORDING_ROOT)) return;

  const store = createRecordingStore();
  const drift = detectRecordingDrift(
    store.hashes("corpus-v1"),
    store.readManifest("corpus-v1"),
  );

  assert.ok(
    isCleanRecordingSet(drift),
    `committed recordings drifted from the manifest — unmanifested: ${drift.added.join(", ") || "none"}; edited: ${drift.changed.join(", ") || "none"}; missing: ${drift.removed.join(", ") || "none"}`,
  );
});
