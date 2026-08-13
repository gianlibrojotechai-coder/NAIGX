/**
 * Stage 2 — Intent Detection (`FR-012`, `AI §3.2`).
 *
 * "Classification identifies the artifact; intent identifies the question."
 * The same workflow export submitted for review needs different treatment than
 * the same export submitted as a template to adapt.
 *
 * Every objective carries `stated` or `inferred` (`FR-012`). That labelling is
 * assigned here, at production — not attached later. `DD-05` makes provenance
 * non-retrofittable, and an objective whose origin is decided after the fact is
 * an assertion about the past rather than a record of it.
 */

import {
  INTENT_PROVENANCE,
  StageError,
  type IntentObjective,
  type IntentResult,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireMember,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 2;
const STAGE_KEY = "intent_detection";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const parseObjective = (value: unknown, label: string): IntentObjective => {
  const record = asRecord(CTX, value, label);
  return {
    content: requireString(CTX, record, "content"),
    provenance: requireMember(CTX, record, "provenance", INTENT_PROVENANCE),
  };
};

export function parseIntent(responseText: string): IntentResult {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);

  const primaryObjective = parseObjective(
    record["primary_objective"],
    "primary_objective",
  );

  const secondaryObjectives = requireArray(
    CTX,
    record,
    "secondary_objectives",
  ).map((entry, index) =>
    parseObjective(entry, `secondary_objectives[${String(index)}]`),
  );

  const inferredScope = requireString(CTX, record, "inferred_scope");

  // `AI §3.2`: Stage 2 is halting — "downstream reasoning without intent would
  // produce output unanchored to any purpose". An empty primary objective is
  // absence of intent, not a permissive default.
  if (primaryObjective.content.trim() === "") {
    throw new StageError(
      STAGE_NUMBER,
      STAGE_KEY,
      "primary_objective must state an objective",
    );
  }

  return { primaryObjective, secondaryObjectives, inferredScope };
}

export const INTENT_STAGE = {
  stageNumber: STAGE_NUMBER,
  stageKey: STAGE_KEY,
} as const;
