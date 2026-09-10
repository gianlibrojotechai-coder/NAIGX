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
  REQUESTED_OUTCOMES,
  StageError,
  type IntentObjective,
  type IntentResult,
  type RequestedOutcome,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireMember,
  requireString,
} from "../parse.js";

/**
 * D-90 — a declined design whose quote the input does not contain.
 *
 * Its own class because it is the one Stage 2 failure worth a single
 * regeneration (the same shape as Stage 6's traceability error): the model
 * read a decline into the input and then failed to point at it. The next
 * attempt is told to quote verbatim or to answer `design`.
 */
export class IntentDeclineQuoteError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "IntentDeclineQuoteError";
  }
}

/** Whitespace-insensitive containment: line breaks in the input are not a reason to reject a quote. */
const containsVerbatim = (haystack: string, needle: string): boolean => {
  const fold = (s: string) => s.replace(/\s+/g, " ").trim();
  const n = fold(needle);
  return n.length > 0 && fold(haystack).includes(n);
};

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

export function parseIntent(
  responseText: string,
  /**
   * D-90: the input text, so a `decline_quote` can be verified against it.
   * Optional only for callers that parse a pre-D-90 response with no
   * `requested_outcome`; a response that declines a design without the
   * input to check it against is rejected.
   */
  inputText?: string,
): IntentResult {
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

  // D-90 — what the submitter asked to receive. Absent reads as `design`:
  // that is what every pre-D-90 response meant, and the output schema makes
  // the key mandatory on every new response, so absence is only ever history.
  const requestedOutcome: RequestedOutcome =
    record["requested_outcome"] === undefined
      ? "design"
      : requireMember(CTX, record, "requested_outcome", REQUESTED_OUTCOMES);
  const rawQuote = record["decline_quote"];
  const declineQuote =
    typeof rawQuote === "string" && rawQuote.trim() !== ""
      ? rawQuote
      : undefined;

  if (requestedOutcome === "understanding_only") {
    if (declineQuote === undefined) {
      throw new IntentDeclineQuoteError(
        "requested_outcome is understanding_only but decline_quote is empty: quote the input's own words declining a design, verbatim, or answer design",
      );
    }
    if (inputText === undefined || !containsVerbatim(inputText, declineQuote)) {
      throw new IntentDeclineQuoteError(
        `decline_quote is not in the input verbatim: "${declineQuote}". Copy the submitter's exact words, or answer design if the input does not decline one`,
      );
    }
  } else if (declineQuote !== undefined) {
    throw new StageError(
      STAGE_NUMBER,
      STAGE_KEY,
      "decline_quote must be null unless requested_outcome is understanding_only",
    );
  }

  return {
    primaryObjective,
    secondaryObjectives,
    inferredScope,
    requestedOutcome,
    ...(declineQuote !== undefined ? { declineQuote } : {}),
  };
}

export const INTENT_STAGE = {
  stageNumber: STAGE_NUMBER,
  stageKey: STAGE_KEY,
} as const;
