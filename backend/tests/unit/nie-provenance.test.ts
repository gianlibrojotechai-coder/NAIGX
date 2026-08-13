/**
 * Unit — Stages 2 and 3, provenance discipline (`FR-012`, `FR-013`, `AIP-3`).
 *
 * `AI §3.2` calls Stage 3 "the most consequential stage in the pipeline" and
 * says provenance "cannot be reconstructed after the fact"; `DD-05` says it
 * cannot be retrofitted. These tests assert the consequence: an element that
 * cannot justify its provenance is rejected at extraction, not stored with a
 * label it has not earned.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CONTEXT_CATEGORIES,
  CONTEXT_PROVENANCE,
  StageError,
} from "../../src/nie/contracts.js";
import { parseIntent } from "../../src/nie/stages/intent.js";
import {
  parseContext,
  proceedsToReasoning,
} from "../../src/nie/stages/context-extraction.js";

const INPUT =
  "Invoices arrive by email and are keyed into Xero by hand. Roughly 450 per month.";

const ctx = (elements: unknown[], sufficiency = "sufficient"): string =>
  JSON.stringify({ elements, sufficiency });

const stated = (overrides: Record<string, unknown> = {}) => ({
  content: "Invoices arrive by email",
  category: "environment",
  provenance: "stated",
  source_quote: "Invoices arrive by email",
  specificity_score: 0.9,
  ...overrides,
});

// --- Stage 2: intent provenance -----------------------------------------

test("every intent objective carries stated or inferred (FR-012)", () => {
  const result = parseIntent(
    JSON.stringify({
      primary_objective: {
        content: "Automate invoice capture and approval",
        provenance: "stated",
      },
      secondary_objectives: [
        { content: "Recover early-payment discounts", provenance: "inferred" },
      ],
      inferred_scope: "Accounts payable, UK entity",
    }),
  );

  assert.equal(result.primaryObjective.provenance, "stated");
  assert.equal(result.secondaryObjectives[0]?.provenance, "inferred");
});

test("an unlabelled or wrongly-labelled objective is rejected", () => {
  for (const provenance of [undefined, "unknown", "guessed", ""]) {
    assert.throws(
      () =>
        parseIntent(
          JSON.stringify({
            primary_objective: { content: "Automate", provenance },
            secondary_objectives: [],
            inferred_scope: "AP",
          }),
        ),
      StageError,
      `provenance=${String(provenance)} must be rejected`,
    );
  }
});

test("intent is halting — a missing primary objective fails the stage", () => {
  assert.throws(
    () =>
      parseIntent(
        JSON.stringify({
          secondary_objectives: [],
          inferred_scope: "AP",
        }),
      ),
    StageError,
  );
});

// --- Stage 3: the three conditional provenance rules ---------------------

test("all three provenance values are accepted with their required evidence", () => {
  const result = parseContext(
    ctx([
      stated(),
      {
        content: "Approval currently takes 5-9 days",
        category: "scale",
        provenance: "inferred",
        inference_basis: "Derived from the stated discount-window pressure",
        specificity_score: 0.6,
      },
      {
        content: "Number of approvers per department",
        category: "dependency",
        provenance: "unknown",
        resolution_hint: "Ask how many approvers each department has",
        specificity_score: 0.2,
      },
    ]),
    INPUT,
  );

  assert.equal(result.elements.length, 3);
  assert.deepEqual(
    result.elements.map((e) => e.provenance),
    [...CONTEXT_PROVENANCE],
  );
  assert.equal(result.elements[0]?.sourceSpanStart, 0);
  assert.match(result.elements[1]?.inferenceBasis ?? "", /discount-window/);
  assert.match(result.elements[2]?.resolutionHint ?? "", /approvers/);
});

test("a stated element without a source quote is rejected (AIP-3)", () => {
  assert.throws(
    () =>
      parseContext(
        ctx([
          {
            content: "Invoices arrive by email",
            category: "environment",
            provenance: "stated",
            specificity_score: 0.9,
          },
        ]),
        INPUT,
      ),
    (error: unknown) =>
      error instanceof StageError && /source_quote/.test(error.message),
  );
});

test("a quote that does not occur in the input is rejected", () => {
  // `AI §3.2`: "traceable to a span, verified structurally". A quote the input
  // never contains traces to nothing.
  for (const quote of [
    "Invoices arrive by carrier pigeon",
    "",
    "   ",
    "email by arrive Invoices",
  ]) {
    assert.throws(
      () => parseContext(ctx([stated({ source_quote: quote })]), INPUT),
      StageError,
      `expected "${quote}" to be rejected`,
    );
  }
});

test("the span is derived from the quote, not supplied by the model", () => {
  // The span is arithmetic over verified text. Any offsets the model volunteers
  // are ignored entirely, so a wrong one cannot become a stored span.
  const result = parseContext(
    ctx([
      stated({
        source_quote: "keyed into Xero by hand",
        // Deliberately wrong, and deliberately in range.
        source_span_start: 0,
        source_span_end: 5,
      }),
    ]),
    INPUT,
  );

  const element = result.elements[0];
  assert.ok(element);
  const expected = INPUT.indexOf("keyed into Xero by hand");
  assert.equal(element.sourceSpanStart, expected);
  assert.equal(
    element.sourceSpanEnd,
    expected + "keyed into Xero by hand".length,
  );
  assert.equal(
    INPUT.slice(element.sourceSpanStart, element.sourceSpanEnd),
    "keyed into Xero by hand",
    "the stored span reads back as the quoted text",
  );
});

test("an inferred element without a basis is rejected", () => {
  assert.throws(
    () =>
      parseContext(
        ctx([
          {
            content: "Volumes are growing",
            category: "scale",
            provenance: "inferred",
            specificity_score: 0.4,
          },
        ]),
        INPUT,
      ),
    StageError,
  );
});

test("an unknown element without a resolution hint is rejected", () => {
  // `FR-013`: material unknowns are enumerated *and* surfaced. An unknown that
  // cannot say what would resolve it is not actionable.
  assert.throws(
    () =>
      parseContext(
        ctx([
          {
            content: "Approval SLA",
            category: "constraint",
            provenance: "unknown",
            specificity_score: 0.1,
          },
        ]),
        INPUT,
      ),
    StageError,
  );
});

test("category must come from the AI §5.3 set", () => {
  assert.throws(
    () => parseContext(ctx([stated({ category: "vibes" })]), INPUT),
    StageError,
  );
  for (const category of CONTEXT_CATEGORIES) {
    const result = parseContext(ctx([stated({ category })]), INPUT);
    assert.equal(result.elements[0]?.category, category);
  }
});

// --- conflicts (AI §5.2) -------------------------------------------------

test("a conflict reference must resolve to another element", () => {
  const ok = parseContext(
    ctx([
      stated({ conflicts_with_index: 1 }),
      stated({ specificity_score: 0.5 }),
    ]),
    INPUT,
  );
  assert.equal(ok.elements[0]?.conflictsWithIndex, 1);

  assert.throws(
    () => parseContext(ctx([stated({ conflicts_with_index: 7 })]), INPUT),
    (error: unknown) =>
      error instanceof StageError && /does not resolve/.test(error.message),
  );
  assert.throws(
    () => parseContext(ctx([stated({ conflicts_with_index: 0 })]), INPUT),
    (error: unknown) =>
      error instanceof StageError && /conflict with itself/.test(error.message),
  );
});

// --- sufficiency (AI §5.4) ----------------------------------------------

test("insufficient context stops the analysis proceeding to reasoning", () => {
  const result = parseContext(
    ctx(
      [
        {
          content: "What the process actually does",
          category: "objective",
          provenance: "unknown",
          resolution_hint: "Describe the current steps",
          specificity_score: 0.1,
        },
      ],
      "insufficient",
    ),
    INPUT,
  );
  assert.equal(result.sufficiency, "insufficient");
  assert.equal(
    proceedsToReasoning(result),
    false,
    "AI §5.4 — a designed outcome, not an error",
  );
});

test("sufficient and thin both proceed", () => {
  for (const level of ["sufficient", "thin"] as const) {
    const result = parseContext(ctx([stated()], level), INPUT);
    assert.equal(proceedsToReasoning(result), true);
  }
});

test("a sufficiency value outside the AI §5.4 set is rejected", () => {
  assert.throws(
    () => parseContext(ctx([stated()], "probably_fine"), INPUT),
    StageError,
  );
});

// --- the first real-provider failure (2026-08-13) ------------------------

test("the +69 offset drift that failed the first real run cannot recur", () => {
  // The real model returned `[1599, 1706)` against a 1637-character input, and
  // the same +69 drift was present at *both* ends — it had found the right
  // sentence and miscounted its way to it. Offsets are no longer accepted from
  // the model at all, so the drift has nothing to act on.
  const tail = "keyed into Xero by hand";
  const trueStart = INPUT.indexOf(tail);

  const result = parseContext(
    ctx([
      stated({
        source_quote: tail,
        // The shape of the original failure: plausible, self-consistent, and
        // wrong by a constant.
        source_span_start: trueStart + 69,
        source_span_end: trueStart + tail.length + 69,
      }),
    ]),
    INPUT,
  );

  const element = result.elements[0];
  assert.ok(element);
  assert.equal(
    element.sourceSpanStart,
    trueStart,
    "drift is not carried through",
  );
  assert.equal(element.sourceSpanEnd, trueStart + tail.length);
});

test("an out-of-range offset is no longer even reachable", () => {
  // Previously this was the only drift the validator could catch. Now the
  // offsets are ignored, so an element with a valid quote survives them — and
  // one without a quote fails for the right reason.
  assert.doesNotThrow(() =>
    parseContext(
      ctx([stated({ source_span_start: 99_999, source_span_end: 999_999 })]),
      INPUT,
    ),
  );
  assert.throws(
    () =>
      parseContext(
        ctx([
          {
            content: "x",
            category: "environment",
            provenance: "stated",
            specificity_score: 0.5,
            source_span_start: 1599,
            source_span_end: 1706,
          },
        ]),
        INPUT,
      ),
    (error: unknown) =>
      error instanceof StageError && /source_quote/.test(error.message),
  );
});

test("a quote spanning a line break still resolves to a real span", () => {
  // Models routinely render an embedded newline as a space. The words are the
  // input's own, so rejecting over whitespace would discard a correct element.
  const multiline = "Invoices arrive by email and are keyed into Xero by hand.";
  const across = "by email\nand are keyed";
  const inputWithBreak = multiline.replace(" and are keyed", "\nand are keyed");

  const result = parseContext(
    ctx([stated({ source_quote: across.replace("\n", " ") })]),
    inputWithBreak,
  );

  const element = result.elements[0];
  assert.ok(element);
  assert.equal(
    inputWithBreak.slice(element.sourceSpanStart, element.sourceSpanEnd),
    across,
    "the derived span covers the real text, newline included",
  );
});

// --- the envelope clarification changes nothing in code ------------------

test("quote resolution is unchanged by the input-envelope clarification", () => {
  // Stage 3 now receives `{ input_text, intent }` as its provider message, so
  // the prompt had to say which part "the input" means. That is a wording
  // change only: `parseContext` still resolves against the raw text it is
  // given, and still rejects anything that is not in it.
  const envelope = JSON.stringify({
    input_text: INPUT,
    intent: { primaryObjective: { content: "Automate invoice capture" } },
  });

  // A quote from the user's own words still resolves, against the raw text.
  const good = parseContext(
    ctx([stated({ source_quote: "keyed into Xero by hand" })]),
    INPUT,
  );
  const element = good.elements[0];
  assert.ok(element);
  assert.equal(
    INPUT.slice(element.sourceSpanStart, element.sourceSpanEnd),
    "keyed into Xero by hand",
  );

  // A quote lifted from the envelope — a field name, or a value the system
  // generated rather than the user wrote — does not resolve and is rejected.
  for (const fromEnvelope of [
    "input_text",
    "primaryObjective",
    "Automate invoice capture",
  ]) {
    assert.ok(
      envelope.includes(fromEnvelope),
      `precondition: "${fromEnvelope}" is present in the envelope`,
    );
    assert.throws(
      () => parseContext(ctx([stated({ source_quote: fromEnvelope })]), INPUT),
      StageError,
      `"${fromEnvelope}" comes from the envelope, not the user's text`,
    );
  }
});
