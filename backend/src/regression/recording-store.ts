/**
 * The recorded-response store for regression runs (`AI §12.3` recorded mode).
 *
 * `AI §12.3` fixes the execution policy: **recorded** on every code change,
 * mandatory before merge; **live** on a schedule, to catch the drift a recorded
 * run cannot see. This module owns the recorded half — where a captured
 * provider response for a corpus case lives, and what it must carry to be
 * replayable.
 *
 * NO CAPTURE HAPPENS HERE. Reading and writing recordings is filesystem work;
 * *producing* one requires a real provider call, which is a spend decision and
 * is deliberately not in this module. `writeCaseRecording` exists so a capture
 * command has somewhere to put its output, and so the format is fixed and
 * reviewable before anything is paid for.
 *
 * IT REUSES THE HARNESS RECORDING SHAPE. `StageRecording` and the replay keying
 * in `harness/recordings.ts` already solve this exact problem (`docs/12` D-11,
 * D-17). A second recording format would be a parallel mechanism that drifts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RecordingSet, StageRecording } from "../harness/recordings.js";
import { hashContent } from "../fragments/source.js";
import { composePrompt } from "../nie/prompt.js";
import type { FragmentResolver } from "../nie/ports.js";

/**
 * `research/regression-recordings/<corpus_version>/<case_id>.json`.
 *
 * A sibling of the corpus rather than a directory inside it: `docs/11` §6
 * freezes the corpus, and a recording is not a corpus case — it is evidence of
 * what a provider said when shown one. Keeping them apart means capturing a
 * recording can never look like editing an oracle.
 */
export const RECORDING_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../research/regression-recordings",
);

/**
 * One captured run of one corpus case.
 *
 * The provenance fields are not decoration. A recording replays a *past*
 * provider answer, so a reader has to be able to tell what it was an answer
 * *to*: which corpus text, which fragment composition, which model. Without
 * that, a stale recording is indistinguishable from a current one — which is
 * how a suite starts asserting against an answer to a question nobody is
 * asking any more (`docs/12` D-17).
 */
export interface CaseRecording {
  readonly caseId: string;
  readonly corpusVersion: string;
  /**
   * `sha256` of the corpus case's input text at capture time.
   *
   * Stage 3 verifies that a `stated` element quotes the input verbatim
   * (`docs/12` D-19), so a recording is only valid against the exact text it
   * was captured against. This makes a mismatch loud instead of letting the
   * replay manufacture provenance for words nobody submitted.
   */
  readonly inputTextHash: string;
  /** `prompts/fragments.manifest.json` version in force at capture. */
  readonly fragmentsManifestVersion: string;
  /**
   * `sha256` over the composed instructions this run was captured against
   * (`docs/12` D-24 consequence 1).
   *
   * A recording is an answer to a *specific* composed prompt. Change a fragment
   * and the question changes, so the answer no longer applies — D-17 keyed the
   * replay fixtures this way on purpose. Carrying the hash lets the runner say
   * **stale** before the run, instead of discovering it three stages later as a
   * missing-fixture provider failure and blaming the system for it.
   */
  readonly fragmentsCompositionHash: string;
  readonly capturedAt: string;
  readonly provider: {
    /** Adapter identifier — never a raw vendor response (`AI-006`). */
    readonly adapter: string;
    readonly modelKey: string;
  };
  /**
   * Whether the capture ran under low-variance sampling. Declared honestly per
   * `AI §10.6`: a recording made at default sampling cannot claim determinism
   * merely because replaying it is repeatable.
   */
  readonly lowVarianceSampling: boolean;
  readonly stages: RecordingSet;
}

export const inputTextHash = (inputText: string): string =>
  hashContent(inputText);

/**
 * The composition hash for a recording's stages, under a given resolver.
 *
 * Computed from the same `composePrompt` the pipeline uses, so it moves exactly
 * when the composed instructions move — a fragment edit, an activation, a
 * rollback. Deliberately not the manifest *version*: a version can be bumped
 * without content changing, and content can change under an unchanged version.
 */
export async function fragmentsCompositionHash(
  stages: RecordingSet,
  resolver: FragmentResolver,
): Promise<string> {
  const parts: string[] = [];
  for (const stage of stages) {
    const prompt = await composePrompt(
      {
        stageKey: stage.stageKey,
        ...(stage.classifiedAs !== undefined
          ? { classifiedAs: stage.classifiedAs }
          : {}),
      },
      resolver,
    );
    parts.push(
      `${stage.stageKey}|${stage.classifiedAs ?? ""}|${prompt.instructions}`,
    );
  }
  return hashContent(parts.join("\n---\n"));
}

/** Raised when stored evidence is not the evidence the manifest recorded. */
export class RecordingIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordingIntegrityError";
  }
}

/**
 * The evidence gate — the same shape `prompts/fragments.manifest.json` gives
 * fragments (`docs/12` D-14, D-24).
 *
 * Recorded mode replays provider answers, and nothing in a JSON file
 * distinguishes a captured answer from an invented one. A content hash does not
 * make fabrication impossible; it makes it **visible in a reviewed diff**, which
 * is the same guarantee the fragment gate provides and the strongest one
 * available without a signing authority. Stated plainly rather than implied.
 */
export interface RecordingManifest {
  readonly corpusVersion: string;
  /** `case_id` → sha256 of the recording file's normalised content. */
  readonly recordings: Readonly<Record<string, string>>;
}

export const MANIFEST_FILENAME = "recordings.manifest.json";

/** Hashes the file bytes, newline-normalised as `fragments/source.ts` does. */
export const recordingFileHash = (raw: string): string =>
  hashContent(raw.replace(/\r\n/g, "\n").trimEnd());

export interface RecordingDrift {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}

export const isCleanRecordingSet = (drift: RecordingDrift): boolean =>
  drift.added.length === 0 &&
  drift.removed.length === 0 &&
  drift.changed.length === 0;

const recordingPath = (
  root: string,
  corpusVersion: string,
  caseId: string,
): string => path.join(root, corpusVersion, `${caseId}.json`);

/** A recording plus the hash the manifest gate verified it against. */
export interface VerifiedRecording {
  readonly recording: CaseRecording;
  readonly contentHash: string;
}

export interface RecordingStore {
  /**
   * The recording for a case, or `undefined` when none has been captured.
   *
   * @throws {RecordingIntegrityError} when the file is present but its content
   * does not match the manifest, or is absent from it entirely. Ungated
   * evidence is refused rather than used: an unrecorded recording is exactly
   * the hand-edit the manifest exists to surface.
   */
  read(corpusVersion: string, caseId: string): VerifiedRecording | undefined;
  /** Case ids holding a recording, for reporting what capture would cost. */
  list(corpusVersion: string): readonly string[];
  /** Current on-disk hashes, for building or checking the manifest. */
  hashes(corpusVersion: string): Readonly<Record<string, string>>;
  readManifest(corpusVersion: string): RecordingManifest | undefined;
  writeManifest(manifest: RecordingManifest): void;
  write(recording: CaseRecording): void;
}

export const buildRecordingManifest = (
  corpusVersion: string,
  hashes: Readonly<Record<string, string>>,
): RecordingManifest => ({
  corpusVersion,
  recordings: Object.fromEntries(
    Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)),
  ),
});

export function detectRecordingDrift(
  hashes: Readonly<Record<string, string>>,
  manifest: RecordingManifest | undefined,
): RecordingDrift {
  const recorded = new Map(Object.entries(manifest?.recordings ?? {}));
  const present = new Map(Object.entries(hashes));
  return {
    added: [...present.keys()].filter((k) => !recorded.has(k)).sort(),
    removed: [...recorded.keys()].filter((k) => !present.has(k)).sort(),
    changed: [...present.entries()]
      .filter(([k, h]) => recorded.has(k) && recorded.get(k) !== h)
      .map(([k]) => k)
      .sort(),
  };
}

const isStageRecording = (value: unknown): value is StageRecording => {
  if (value === null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["stageKey"] === "string" &&
    typeof row["output"] === "string" &&
    typeof row["inputTokens"] === "number" &&
    typeof row["outputTokens"] === "number" &&
    typeof row["latencyMs"] === "number"
  );
};

/** Validates on read: a malformed recording must fail, never half-replay. */
export function parseCaseRecording(
  raw: string,
  sourcePath: string,
): CaseRecording {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(
      `${sourcePath}: not valid JSON — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`${sourcePath}: expected an object`);
  }
  const doc = parsed as Record<string, unknown>;

  const required = [
    "caseId",
    "corpusVersion",
    "inputTextHash",
    "fragmentsManifestVersion",
    "fragmentsCompositionHash",
    "capturedAt",
  ] as const;
  for (const key of required) {
    if (typeof doc[key] !== "string" || doc[key] === "") {
      throw new Error(`${sourcePath}: \`${key}\` must be a non-empty string`);
    }
  }

  const stages = doc["stages"];
  if (!Array.isArray(stages) || !stages.every(isStageRecording)) {
    throw new Error(
      `${sourcePath}: \`stages\` must be a list of recorded stage responses`,
    );
  }
  if (stages.length === 0) {
    throw new Error(
      `${sourcePath}: a recording with no stages replays nothing`,
    );
  }

  const provider = doc["provider"] as Record<string, unknown> | undefined;
  if (
    provider === undefined ||
    typeof provider["adapter"] !== "string" ||
    typeof provider["modelKey"] !== "string"
  ) {
    throw new Error(
      `${sourcePath}: \`provider.adapter\` and \`provider.modelKey\` are required`,
    );
  }

  return {
    caseId: doc["caseId"] as string,
    corpusVersion: doc["corpusVersion"] as string,
    inputTextHash: doc["inputTextHash"] as string,
    fragmentsManifestVersion: doc["fragmentsManifestVersion"] as string,
    fragmentsCompositionHash: doc["fragmentsCompositionHash"] as string,
    capturedAt: doc["capturedAt"] as string,
    provider: {
      adapter: provider["adapter"],
      modelKey: provider["modelKey"],
    },
    lowVarianceSampling: doc["lowVarianceSampling"] === true,
    stages: stages as RecordingSet,
  };
}

export function createRecordingStore(
  root: string = RECORDING_ROOT,
): RecordingStore {
  const manifestPath = (corpusVersion: string): string =>
    path.join(root, corpusVersion, MANIFEST_FILENAME);

  const readManifest = (
    corpusVersion: string,
  ): RecordingManifest | undefined => {
    const file = manifestPath(corpusVersion);
    if (!fs.existsSync(file)) return undefined;
    return JSON.parse(fs.readFileSync(file, "utf8")) as RecordingManifest;
  };

  const listIds = (corpusVersion: string): readonly string[] => {
    const dir = path.join(root, corpusVersion);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json") && f !== MANIFEST_FILENAME)
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
  };

  return {
    read(corpusVersion, caseId) {
      const file = recordingPath(root, corpusVersion, caseId);
      if (!fs.existsSync(file)) return undefined;

      const raw = fs.readFileSync(file, "utf8");
      const relative = path.relative(process.cwd(), file);
      const contentHash = recordingFileHash(raw);

      // The gate, applied on the read path so no caller can skip it.
      const recorded = readManifest(corpusVersion)?.recordings[caseId];
      if (recorded === undefined) {
        throw new RecordingIntegrityError(
          `${relative}: no manifest entry — evidence must be recorded in ${MANIFEST_FILENAME} and reviewed before it can be replayed`,
        );
      }
      if (recorded !== contentHash) {
        throw new RecordingIntegrityError(
          `${relative}: content hash ${contentHash.slice(0, 12)} does not match the manifest's ${recorded.slice(0, 12)} — the recording was edited after it was recorded`,
        );
      }

      return { recording: parseCaseRecording(raw, relative), contentHash };
    },

    list: listIds,

    hashes(corpusVersion) {
      return Object.fromEntries(
        listIds(corpusVersion).map((caseId) => [
          caseId,
          recordingFileHash(
            fs.readFileSync(recordingPath(root, corpusVersion, caseId), "utf8"),
          ),
        ]),
      );
    },

    readManifest,

    writeManifest(manifest) {
      const file = manifestPath(manifest.corpusVersion);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    },

    write(recording) {
      const file = recordingPath(
        root,
        recording.corpusVersion,
        recording.caseId,
      );
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(recording, null, 2)}\n`);
    },
  };
}
