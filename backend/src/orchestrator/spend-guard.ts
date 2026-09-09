/**
 * Spend guard — the pre-admission cap on metered reasoning
 * ([D-67](../../../docs/42-D-67-Owner-Only-Live-Release.md) §3, `NFR-083`, `R-13`).
 *
 * A live instance bills a provider per call, and nothing before this module
 * bounded how much it could bill in a day or a month: the D-47 per-account
 * rate limit caps *submissions*, not dollars, and a single job-description
 * analysis has cost anywhere between $0.06 and $0.27 depending on the model
 * and the run. This guard is asked ONCE, before an analysis row exists, and it
 * answers from the trace store's own per-call cost record (`provider_invocation
 * .estimated_cost`) — the same figure `NFR-083` audits spend by — rather than
 * from a counter that could drift from it.
 *
 * THREE RULES:
 *
 *   1. **A reserve is charged before the run, not after.** An analysis that
 *      starts under the cap can still finish over it, so admission requires
 *      `spent + reserve ≤ cap`, where the reserve is the worst per-analysis
 *      cost the evidence has recorded (`NAIGX_SPEND_RESERVE_USD_PER_ANALYSIS`,
 *      default $0.30 — the latency log's worst run). The cap is therefore a
 *      ceiling the instance stays *under*, not a line it crosses once.
 *   2. **Unknown spend is a refusal.** If the trace store cannot be read the
 *      guard cannot know what has been spent, and a paid call whose budget
 *      cannot be verified does not start. Fail closed.
 *   3. **Decimal, never float.** Costs are decimal strings throughout the
 *      codebase (`docs/12` D-4, D-10); this module compares them as scaled
 *      integers so a cap of `5.00` is exactly five dollars.
 *
 * Windows are UTC calendar windows — a "day" starts at 00:00 UTC — so the
 * figure the guard enforces is the figure a `date_trunc('day', recorded_at)`
 * query reproduces. Pure apart from the injected reader and clock.
 */

/** A decimal USD amount as a string, e.g. `"5.00"` or `"0.30"`. */
export type UsdString = string;

const USD_PATTERN = /^\d{1,12}(\.\d{1,8})?$/;
const SCALE = 8;

/**
 * Parses a decimal USD string into an integer number of 10⁻⁸ dollars.
 * Refuses anything that is not a plain non-negative decimal.
 */
export function usdToUnits(value: UsdString): bigint {
  const trimmed = value.trim();
  if (!USD_PATTERN.test(trimmed)) {
    throw new Error(
      `Not a decimal USD amount: ${JSON.stringify(value)} (expected digits with up to 8 decimal places)`,
    );
  }
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt((whole ?? "0") + fraction.padEnd(SCALE, "0"));
}

/** Formats scaled units back to a decimal string with 4 places. */
export function unitsToUsd(units: bigint): UsdString {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / 10n ** BigInt(SCALE);
  const fraction = (abs % 10n ** BigInt(SCALE))
    .toString()
    .padStart(SCALE, "0")
    .slice(0, 4);
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

export const utcDayStart = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export const utcMonthStart = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export type SpendWindowName = "day" | "month";

/** Reads what has been recorded as spent since an instant. */
export interface SpendReader {
  /** Sum of `estimated_cost` for invocations recorded at or after `since`. */
  spentSince(since: Date): Promise<UsdString>;
}

export interface SpendCaps {
  readonly perDayUsd?: UsdString;
  readonly perMonthUsd?: UsdString;
}

export interface SpendGuardOptions {
  readonly caps: SpendCaps;
  /** Charged against the cap before a run is admitted. */
  readonly reserveUsd: UsdString;
  readonly reader: SpendReader;
  readonly now?: () => Date;
}

export type SpendDecision =
  | {
      readonly admitted: true;
      /** Headroom in the tightest window after the reserve, for logging. */
      readonly remainingUsd: UsdString;
    }
  | {
      readonly admitted: false;
      readonly reason: "cap_reached" | "spend_unknown";
      readonly window: SpendWindowName;
      readonly capUsd: UsdString;
      /** What the trace store had recorded; absent when it could not be read. */
      readonly spentUsd?: UsdString;
      readonly reserveUsd: UsdString;
      /** When the refusing window rolls over, so a client can wait. */
      readonly resetsAt: Date;
    };

export interface SpendGuard {
  admit(): Promise<SpendDecision>;
  /** The caps in force, for the startup log. */
  readonly caps: SpendCaps;
}

const nextDay = (start: Date): Date =>
  new Date(start.getTime() + 24 * 60 * 60 * 1000);
const nextMonth = (start: Date): Date =>
  new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

export function createSpendGuard(options: SpendGuardOptions): SpendGuard {
  const now = options.now ?? (() => new Date());
  const reserve = usdToUnits(options.reserveUsd);

  const windows: readonly {
    readonly name: SpendWindowName;
    readonly cap: bigint;
    readonly capUsd: UsdString;
    readonly start: (at: Date) => Date;
    readonly resets: (start: Date) => Date;
  }[] = [
    ...(options.caps.perDayUsd !== undefined
      ? [
          {
            name: "day" as const,
            cap: usdToUnits(options.caps.perDayUsd),
            capUsd: options.caps.perDayUsd,
            start: utcDayStart,
            resets: nextDay,
          },
        ]
      : []),
    ...(options.caps.perMonthUsd !== undefined
      ? [
          {
            name: "month" as const,
            cap: usdToUnits(options.caps.perMonthUsd),
            capUsd: options.caps.perMonthUsd,
            start: utcMonthStart,
            resets: nextMonth,
          },
        ]
      : []),
  ];

  if (windows.length === 0) {
    throw new Error(
      "A spend guard needs at least one cap (per day or per month); a guard with no cap would admit everything while appearing to exist.",
    );
  }

  return {
    caps: options.caps,
    async admit() {
      const at = now();
      let remaining: bigint | undefined;

      for (const window of windows) {
        const start = window.start(at);
        let spent: bigint;
        try {
          spent = usdToUnits(await options.reader.spentSince(start));
        } catch {
          // Rule 2. The reader's failure detail is the caller's to log; this
          // decision carries only what a client may see.
          return {
            admitted: false,
            reason: "spend_unknown",
            window: window.name,
            capUsd: window.capUsd,
            reserveUsd: options.reserveUsd,
            resetsAt: window.resets(start),
          };
        }
        if (spent + reserve > window.cap) {
          return {
            admitted: false,
            reason: "cap_reached",
            window: window.name,
            capUsd: window.capUsd,
            spentUsd: unitsToUsd(spent),
            reserveUsd: options.reserveUsd,
            resetsAt: window.resets(start),
          };
        }
        const headroom = window.cap - spent - reserve;
        remaining =
          remaining === undefined || headroom < remaining
            ? headroom
            : remaining;
      }

      return { admitted: true, remainingUsd: unitsToUsd(remaining ?? 0n) };
    },
  };
}
