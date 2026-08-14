/**
 * Stage 3 — Context Extraction (`FR-013`, `AI §3.2`, `§5`).
 *
 * `AI §3.2`: **"This is the most consequential stage in the pipeline. Everything
 * downstream is derived from it, and provenance cannot be reconstructed after
 * the fact."** `DD-05` says the same about retrofitting. So provenance is not
 * merely recorded here — it is *rule-checked* here, and an element that cannot
 * justify its own provenance is rejected rather than stored with a label it has
 * not earned (`AIP-3`).
 *
 * The three conditional requirements are exactly the `DB §4.2` CHECK
 * constraints, enforced before persistence rather than discovered at it:
 *
 *   stated   → requires a source span into the input
 *   inferred → requires an inference basis
 *   unknown  → requires what would resolve it
 *
 * `stated` is checked further: the span must actually resolve within the input
 * text. `AI §3.2` calls for "traceable to a span, verified structurally", and a
 * span that points outside the input traces to nothing.
 *
 * TWO REFERENCES, NEITHER OF THEM COUNTED. `docs/12` D-19 established the rule
 * after the model miscounted a character offset: where the application can
 * derive a position deterministically, it must, and the model supplies
 * something it can copy instead. Both references in this stage now follow it —
 * a `stated` element quotes the input and the span is located, and a conflict
 * cites another element's `id` and the index is looked up. The stored shape is
 * unchanged either way: spans and `conflicts_with_index` are what persistence
 * and `CONTEXT_REFERENCE` still see.
 */

import {
  CONTEXT_CATEGORIES,
  CONTEXT_PROVENANCE,
  SUFFICIENCY_LEVELS,
  StageError,
  type ContextElement,
  type ContextResult,
} from "../contracts.js";
import {
  asRecord,
  optionalString,
  parseStructured,
  requireArray,
  requireMember,
  requireNumber,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 3;
const STAGE_KEY = "context_extraction";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

/**
 * Locates a quoted excerpt in the input and returns its span.
 *
 * WHY THE MODEL NO LONGER SUPPLIES OFFSETS. The first real-provider run failed
 * here: the model returned `[1599, 1706)` against a 1637-character input, and
 * the same +69 drift was present at *both* ends of the span — it had identified
 * the right sentence and miscounted its way to it. Character counting is not
 * something a language model does reliably, and the previous check could only
 * catch the drift that happened to overshoot the end. Drift that stayed in
 * range passed silently, which is exactly the unverifiable label `AIP-3`
 * forbids.
 *
 * Quoting is something a model does reliably, and a quote is self-verifying:
 * either it occurs in the input or the element is rejected. The span is then
 * arithmetic, not judgement.
 *
 * Matching is exact first. When that fails, runs of whitespace are collapsed on
 * both sides and the search is repeated, mapping the result back to real
 * offsets — a quote spanning a line break is still the input's own words, and
 * rejecting it over a newline rendered as a space would discard a correct
 * element for a cosmetic difference. A quote whose words are absent, or present
 * in another order, still fails.
 *
 * @returns the half-open span `[start, end)`, or `null` when the quote does not
 * occur. The **first** occurrence wins, so the result is deterministic.
 */
export function resolveQuoteSpan(
  inputText: string,
  quote: string,
): { readonly start: number; readonly end: number } | null {
  const trimmed = quote.trim();
  if (trimmed === "") {
    return null;
  }

  const exact = inputText.indexOf(trimmed);
  if (exact >= 0) {
    return { start: exact, end: exact + trimmed.length };
  }

  // Whitespace-insensitive fallback. `offsets[i]` is the index in `inputText`
  // of the character that produced `normalized[i]`, so a match maps back to a
  // real span rather than an approximate one.
  let normalized = "";
  const offsets: number[] = [];
  let inWhitespace = false;
  for (let i = 0; i < inputText.length; i += 1) {
    const char = inputText[i] as string;
    if (/\s/.test(char)) {
      if (!inWhitespace && normalized !== "") {
        normalized += " ";
        offsets.push(i);
      }
      inWhitespace = true;
      continue;
    }
    inWhitespace = false;
    normalized += char;
    offsets.push(i);
  }

  const normalizedQuote = trimmed.replace(/\s+/g, " ");
  const found = normalized.indexOf(normalizedQuote);
  if (found < 0) {
    return null;
  }

  const start = offsets[found];
  const lastIndex = offsets[found + normalizedQuote.length - 1];
  if (start === undefined || lastIndex === undefined) {
    return null;
  }
  return { start, end: lastIndex + 1 };
}

/**
 * One element as the model emitted it: the durable fields, plus the identifier
 * it was given and the identifier it cites. The citation is resolved to a
 * position in a second pass, once every id is known.
 */
interface DraftElement {
  readonly element: ContextElement;
  readonly id: string;
  readonly conflictsWithId?: string;
}

function parseElement(
  value: unknown,
  index: number,
  inputText: string,
): DraftElement {
  const label = `elements[${String(index)}]`;
  const record = asRecord(CTX, value, label);

  const content = requireString(CTX, record, "content");
  const category = requireMember(CTX, record, "category", CONTEXT_CATEGORIES);
  const provenance = requireMember(
    CTX,
    record,
    "provenance",
    CONTEXT_PROVENANCE,
  );
  const specificityScore = requireNumber(CTX, record, "specificity_score", {
    min: 0,
    max: 1,
  });

  const base = { content, category, provenance, specificityScore };
  const id = idOf(record, label);
  const conflictsWithId = conflictIdOf(record, label);
  const draft = (element: ContextElement): DraftElement => ({
    element,
    id,
    ...(conflictsWithId !== undefined ? { conflictsWithId } : {}),
  });

  if (provenance === "stated") {
    const quote = optionalString(record, "source_quote");
    if (quote === undefined) {
      return fail(
        `${label}: stated elements require a source_quote copied from the input`,
      );
    }

    // The structural verification `AI §3.2` requires, strengthened: the span is
    // now derived from text that demonstrably occurs in the input, so it cannot
    // point somewhere the element does not come from.
    const span = resolveQuoteSpan(inputText, quote);
    if (span === null) {
      return fail(
        `${label}: source_quote does not occur in the input — ${JSON.stringify(quote.slice(0, 60))}`,
      );
    }

    return draft({
      ...base,
      sourceSpanStart: span.start,
      sourceSpanEnd: span.end,
    });
  }

  if (provenance === "inferred") {
    const inferenceBasis = optionalString(record, "inference_basis");
    if (inferenceBasis === undefined) {
      return fail(`${label}: inferred elements require an inference_basis`);
    }
    return draft({ ...base, inferenceBasis });
  }

  const resolutionHint = optionalString(record, "resolution_hint");
  if (resolutionHint === undefined) {
    return fail(`${label}: unknown elements require a resolution_hint`);
  }
  return draft({ ...base, resolutionHint });
}

/**
 * The identifier the model gives an element, and the one it cites in a
 * conflict. Opaque to us: uniqueness is the only property required of it.
 */
const idOf = (record: Record<string, unknown>, label: string): string => {
  const value = record["id"];
  if (typeof value !== "string" || value.trim() === "") {
    return fail(`${label}: every element requires a non-empty id`);
  }
  return value.trim();
};

const conflictIdOf = (
  record: Record<string, unknown>,
  label: string,
): string | undefined => {
  const value = record["conflicts_with_id"];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return fail(`${label}: conflicts_with_id must be a non-empty id`);
  }
  return value.trim();
};

export function parseContext(
  responseText: string,
  inputText: string,
): ContextResult {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);

  const drafts = requireArray(CTX, record, "elements").map((entry, index) =>
    parseElement(entry, index, inputText),
  );

  // Ids are the model's own labels, so they are only useful if they are
  // distinct. A duplicate would make a conflict citation ambiguous, and
  // resolving it to whichever came first would be a guess.
  const positionOfId = new Map<string, number>();
  drafts.forEach((draft, index) => {
    const existing = positionOfId.get(draft.id);
    if (existing !== undefined) {
      fail(
        `elements[${String(index)}]: id ${JSON.stringify(draft.id)} is already used by elements[${String(existing)}]`,
      );
    }
    positionOfId.set(draft.id, index);
  });

  // `AI §5.2`: two conflicting elements produce a surfaced contradiction, which
  // requires the reference to resolve. Resolution happens here, after every id
  // is known, which is what makes a **forward** reference work — the model can
  // cite an element it has not written yet, exactly as it needs to when the
  // contradiction is only apparent once the second element exists.
  //
  // The index is derived, never supplied (`docs/12` D-19): the model copies an
  // id, and the position is arithmetic over ids we hold. The first real br-011
  // capture failed precisely because the old contract asked it to count its own
  // position in a 39-element array it was still writing.
  const elements = drafts.map((draft, index) => {
    if (draft.conflictsWithId === undefined) {
      return draft.element;
    }

    const target = positionOfId.get(draft.conflictsWithId);
    if (target === undefined) {
      return fail(
        `elements[${String(index)}]: conflicts_with_id ${JSON.stringify(draft.conflictsWithId)} does not resolve to any element`,
      );
    }
    // Still rejected, never dropped. A self-conflict is not a contradiction,
    // and silently discarding it would lose whatever the model was trying to
    // record (`AI §5.2`).
    if (target === index) {
      return fail(
        `elements[${String(index)}]: an element cannot conflict with itself`,
      );
    }

    return { ...draft.element, conflictsWithIndex: target };
  });

  // ⚠️ Reported by the model, not computed. `AI §3.2` describes the signal as
  // "too few elements are `stated`" and `§5.4` gives the three levels
  // qualitatively — neither defines a numeric threshold, so computing one here
  // would invent a rule (`docs/12` D-13).
  const sufficiency = requireMember(
    CTX,
    record,
    "sufficiency",
    SUFFICIENCY_LEVELS,
  );

  return { elements, sufficiency };
}

/**
 * `AI §5.4`: "**Analysis does not proceed to reasoning.** The system states what
 * is missing and what would resolve it." A designed outcome, not an error.
 */
export const proceedsToReasoning = (result: ContextResult): boolean =>
  result.sufficiency !== "insufficient";

export const CONTEXT_STAGE = {
  stageNumber: STAGE_NUMBER,
  stageKey: STAGE_KEY,
} as const;
