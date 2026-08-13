/**
 * Usage cost accounting (`SA §3.5`, `NFR-083`, `docs/12` D-4).
 *
 * D-4 settles what Sprint 0 deliberately left blank:
 *
 *   · Unit      — USD. No document names a currency; USD is what every model
 *                 provider publishes rates in, so it introduces no
 *                 provider-specific concept.
 *   · Precision — at least 6 decimal places. Per-invocation costs sit well
 *                 below one cent; rounding to cents would record zero.
 *   · Source    — computed from token counts against a configured rate. The
 *                 field is named *estimated*; providers do not return it.
 *   · Exposure  — never client-facing (`API §10.3`). Operational class
 *                 (`DB §13.2`), recorded only in the trace store.
 *
 * Money is never held in a `number` here. Costs are computed in `bigint` at a
 * fixed scale of 8 decimal places, matching `provider_invocation.estimated_cost
 * numeric(18,8)`, and returned as a decimal string. Binary floating point
 * cannot represent 0.000003 exactly, and an accumulating rounding error in a
 * cost ledger is the kind of defect that is discovered a quarter late.
 */

/** Decimal places carried through the calculation and in the stored column. */
export const COST_SCALE = 8;

const SCALE_FACTOR = 10n ** BigInt(COST_SCALE);
const TOKENS_PER_RATE_UNIT = 1_000_000n;

/**
 * Configured rates for one model version.
 *
 * Expressed per million tokens because that is the unit providers publish, and
 * as decimal strings because a rate like `0.000003` is not exactly
 * representable in binary floating point.
 *
 * ⚠️ WHERE THESE ARE CONFIGURED IS UNSPECIFIED (`docs/12` D-10). `DB §4.5`
 * gives `PROVIDER` and `MODEL_VERSION` no rate column, and no document names an
 * environment variable or config file for them. The table is therefore an
 * explicit input rather than something this module reads from anywhere.
 */
export interface TokenRate {
  readonly inputUsdPerMillionTokens: string;
  readonly outputUsdPerMillionTokens: string;
}

/** Rates by `MODEL_VERSION.model_key`. */
export type TokenRateTable = Readonly<Record<string, TokenRate>>;

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/**
 * Parses a non-negative decimal string into a bigint scaled by `COST_SCALE`.
 *
 * @throws RangeError on anything that is not a plain non-negative decimal.
 * A malformed rate must fail loudly: silently coercing it to zero would record
 * a cost of nothing and make the unit economics `TV-4` depends on quietly wrong.
 */
export function parseUsd(value: string): bigint {
  const match = DECIMAL_PATTERN.exec(value.trim());
  if (match === null) {
    throw new RangeError(
      `Rate must be a non-negative decimal string (received "${value}")`,
    );
  }

  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "")
    .slice(0, COST_SCALE)
    .padEnd(COST_SCALE, "0");
  return BigInt(whole) * SCALE_FACTOR + BigInt(fraction);
}

/** Renders a `COST_SCALE`-scaled bigint as a plain decimal string. */
export function formatUsd(scaled: bigint): string {
  const whole = scaled / SCALE_FACTOR;
  const fraction = (scaled % SCALE_FACTOR).toString().padStart(COST_SCALE, "0");
  return `${whole.toString()}.${fraction}`;
}

/** Divides, rounding half-up. Both operands are non-negative. */
const divideRoundHalfUp = (numerator: bigint, denominator: bigint): bigint => {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
};

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Estimated cost in USD for one invocation, as a decimal string with
 * `COST_SCALE` places.
 *
 * Input and output are rounded independently, then summed — the same order a
 * provider's own billing statement uses, so a reconciliation against an invoice
 * does not drift by a rounding step.
 *
 * @throws RangeError if a token count is not a non-negative integer, or if
 * either rate is malformed.
 */
export function computeEstimatedCostUsd(
  usage: TokenUsage,
  rate: TokenRate,
): string {
  for (const [name, count] of [
    ["inputTokens", usage.inputTokens],
    ["outputTokens", usage.outputTokens],
  ] as const) {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(
        `${name} must be a non-negative integer (received ${String(count)})`,
      );
    }
  }

  const inputCost = divideRoundHalfUp(
    BigInt(usage.inputTokens) * parseUsd(rate.inputUsdPerMillionTokens),
    TOKENS_PER_RATE_UNIT,
  );
  const outputCost = divideRoundHalfUp(
    BigInt(usage.outputTokens) * parseUsd(rate.outputUsdPerMillionTokens),
    TOKENS_PER_RATE_UNIT,
  );

  return formatUsd(inputCost + outputCost);
}

/**
 * Looks up a rate, failing loudly when a model has none configured.
 *
 * @throws RangeError naming the model key. An unpriced model is a
 * configuration error, not a zero-cost model.
 */
export function rateFor(table: TokenRateTable, modelKey: string): TokenRate {
  const rate = table[modelKey];
  if (rate === undefined) {
    throw new RangeError(`No configured token rate for model "${modelKey}"`);
  }
  return rate;
}
