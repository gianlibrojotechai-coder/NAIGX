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

function parseElement(
  value: unknown,
  index: number,
  inputText: string,
): ContextElement {
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

    return {
      ...base,
      sourceSpanStart: span.start,
      sourceSpanEnd: span.end,
      ...conflictOf(record, label),
    };
  }

  if (provenance === "inferred") {
    const inferenceBasis = optionalString(record, "inference_basis");
    if (inferenceBasis === undefined) {
      return fail(`${label}: inferred elements require an inference_basis`);
    }
    return { ...base, inferenceBasis, ...conflictOf(record, label) };
  }

  const resolutionHint = optionalString(record, "resolution_hint");
  if (resolutionHint === undefined) {
    return fail(`${label}: unknown elements require a resolution_hint`);
  }
  return { ...base, resolutionHint, ...conflictOf(record, label) };
}

const conflictOf = (
  record: Record<string, unknown>,
  label: string,
): { conflictsWithIndex?: number } => {
  const value = record["conflicts_with_index"];
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return fail(
      `${label}: conflicts_with_index must be a non-negative integer`,
    );
  }
  return { conflictsWithIndex: value };
};

export function parseContext(
  responseText: string,
  inputText: string,
): ContextResult {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);

  const elements = requireArray(CTX, record, "elements").map((entry, index) =>
    parseElement(entry, index, inputText),
  );

  // `AI §5.2`: two conflicting stated elements produce a surfaced contradiction,
  // which requires the reference to resolve. A dangling conflict index would
  // lose the contradiction it exists to record.
  elements.forEach((element, index) => {
    if (element.conflictsWithIndex === undefined) {
      return;
    }
    if (element.conflictsWithIndex >= elements.length) {
      fail(
        `elements[${String(index)}]: conflicts_with_index ${String(element.conflictsWithIndex)} does not resolve`,
      );
    }
    if (element.conflictsWithIndex === index) {
      fail(
        `elements[${String(index)}]: an element cannot conflict with itself`,
      );
    }
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
