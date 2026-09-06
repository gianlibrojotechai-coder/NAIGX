/**
 * Execution mode — replay or live (`docs/12` D-37 scope, `Roadmap` Sprint 0).
 *
 * NAIGX can reason offline against recorded responses, or against a real
 * provider that bills per call. Which one is in force must be a **stated**
 * property of a run, not an emergent consequence of which environment
 * variables happen to be set.
 *
 * THREE RULES, AND EACH EXISTS BECAUSE ITS OPPOSITE COSTS MONEY QUIETLY:
 *
 *   1. **Replay is the default.** An unset variable, an empty string, a typo —
 *      all resolve to replay. Nothing reaches a provider by omission.
 *   2. **Live is opt-in and exact.** Only the literal `live` selects it.
 *   3. **Neither mode falls back to the other.** Live without credentials is a
 *      refusal, not a silent downgrade to replay — a run that quietly became a
 *      replay would report reasoning that no model performed. And replay never
 *      escalates to live, whatever is configured.
 *
 * Pure: it reads no environment and no clock. The composition root passes the
 * raw value in, so a test can state a mode without a credential existing.
 */

export const EXECUTION_MODES = ["replay", "live"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const DEFAULT_EXECUTION_MODE: ExecutionMode = "replay";

/** Raised when `live` is asked for and cannot be honoured. */
export class ExecutionModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionModeError";
  }
}

export interface ExecutionModeInput {
  /** Raw configured value — `process.env.NAIGX_EXECUTION_MODE` or similar. */
  readonly requested: string | undefined;
  /** Whether a provider credential and model are both present. */
  readonly hasProviderCredentials: boolean;
}

/**
 * Resolves the mode a run will execute under.
 *
 * @throws ExecutionModeError when `live` is requested without credentials.
 * Refusing is the point: the alternative is a run that costs nothing, proves
 * nothing, and is reported as though a model produced it.
 */
export function resolveExecutionMode(input: ExecutionModeInput): ExecutionMode {
  const requested = input.requested?.trim().toLowerCase();

  if (requested === undefined || requested === "") {
    return DEFAULT_EXECUTION_MODE;
  }

  if (requested === "live") {
    if (!input.hasProviderCredentials) {
      throw new ExecutionModeError(
        "Execution mode `live` was requested but no provider credential and model are configured. " +
          "Set both, or unset the mode to run offline against recorded responses. " +
          "NAIGX will not silently downgrade a live run to a replay.",
      );
    }
    return "live";
  }

  if (requested === "replay") {
    return "replay";
  }

  throw new ExecutionModeError(
    `Unknown execution mode "${input.requested ?? ""}". Expected one of: ${EXECUTION_MODES.join(", ")}.`,
  );
}

/** True when a run under this mode can bill a provider. */
export const isMetered = (mode: ExecutionMode): boolean => mode === "live";
