/**
 * Stage 1 — Input Classification (`FR-011`, `FR-015`, `AI §3.2`, `§4`).
 *
 * Determines what kind of artifact was submitted so downstream reasoning
 * applies the correct frame. `AI §4.2`: "A misclassification is not a mislabel —
 * it is an analysis conducted under the wrong frame."
 *
 * THE `mixed` RULE (`docs/12` D-6). `AI §4.1` lets the model report `mixed`, and
 * this stage accepts it — as an *intermediate* value only. `AI §4.3` resolves it:
 * "Dominant type determines the primary frame; the secondary is disclosed.
 * v1.0 does not run parallel paths." So a `mixed` detection must arrive with a
 * dominant type, which becomes `determinedType`; the secondary is disclosed
 * through `candidateTypes`. `mixed` never leaves this function.
 */

import {
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  CLASSIFICATION_TYPES,
  MIXED_DETECTION,
  StageError,
  type ClassificationResult,
  type ClassificationType,
} from "../contracts.js";
import {
  parseStructured,
  requireArray,
  requireMember,
  requireNumber,
} from "../parse.js";

const STAGE_NUMBER = 1;
const STAGE_KEY = "input_classification";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

/** What the model may report: the five terminal types plus `mixed` (`AI §4.1`). */
const DETECTABLE = [...CLASSIFICATION_TYPES, MIXED_DETECTION] as const;

export function parseClassification(
  responseText: string,
): ClassificationResult {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);

  const detected = requireMember(CTX, record, "determined_type", DETECTABLE);
  const confidence = requireNumber(CTX, record, "confidence", {
    min: 0,
    max: 1,
  });

  const rawCandidates = requireArray(CTX, record, "candidate_types");
  const candidates: ClassificationType[] = [];
  for (const entry of rawCandidates) {
    if (
      typeof entry !== "string" ||
      !(CLASSIFICATION_TYPES as readonly string[]).includes(entry)
    ) {
      // A candidate outside the five is unusable: `FR-014` lets the user
      // reclassify "to any supported type", and `mixed` is not one.
      throw new StageError(
        STAGE_NUMBER,
        STAGE_KEY,
        `candidate_types must contain only terminal classifications (received ${JSON.stringify(entry)})`,
      );
    }
    if (!candidates.includes(entry as ClassificationType)) {
      candidates.push(entry as ClassificationType);
    }
  }

  let determinedType: ClassificationType;
  const mixedDetected = detected === MIXED_DETECTION;

  if (mixedDetected) {
    // `AI §4.3` — the dominant type is required, because `mixed` has no
    // downstream path of its own to fall back on.
    const dominant = requireMember(
      CTX,
      record,
      "dominant_type",
      CLASSIFICATION_TYPES,
    );
    determinedType = dominant;
    if (!candidates.includes(dominant)) {
      candidates.unshift(dominant);
    }
    if (candidates.length < 2) {
      throw new StageError(
        STAGE_NUMBER,
        STAGE_KEY,
        "A mixed detection must disclose a secondary type in candidate_types (AI §4.3)",
      );
    }
  } else {
    determinedType = detected;
  }

  return {
    determinedType,
    confidence,
    candidateTypes: candidates,
    // `FR-011`: "Confidence below 0.6 triggers FR-015." Strictly below —
    // exactly 0.6 is at the threshold and is not low-confidence.
    wasLowConfidence: confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD,
    mixedDetected,
  };
}

/**
 * Whether reasoning proceeds past Stage 1.
 *
 * `FR-011`: "`unsupported` triggers FR-092 and does not proceed to reasoning."
 * Low confidence does **not** stop the pipeline — `FR-015` allows the user to
 * "allow the best guess to proceed", and the flag is carried forward instead.
 */
export const proceedsToReasoning = (result: ClassificationResult): boolean =>
  result.determinedType !== "unsupported";

export const CLASSIFICATION_STAGE = {
  stageNumber: STAGE_NUMBER,
  stageKey: STAGE_KEY,
} as const;
