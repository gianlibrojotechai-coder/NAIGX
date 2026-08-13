/**
 * Response and error normalization (`SA §3.5`, `AI §10.1`).
 *
 * `SA §3.5`: "Uniform error taxonomy; provider errors never surface upward in
 * provider-specific form." Everything leaving this module is a `ProviderError`
 * carrying one of the four `AI §10.4` classes. There is no second vocabulary:
 * `ProviderFailureClass` is the only failure taxonomy in the system, and the
 * trace store's `provider_error_class` enum mirrors it exactly.
 *
 * The checks here are structural, not semantic. Judging whether a response is
 * *good* belongs to Stage 10 validation (`AI §3.2`); judging whether it is a
 * well-formed `CapabilityResponse` belongs here, and is the "normalization
 * failure" `AI §10.4` maps to a malformed response.
 */

import {
  ProviderError,
  type CapabilityResponse,
  type ProviderUsage,
} from "./capability.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTokenCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isUsage = (value: unknown): value is ProviderUsage =>
  isRecord(value) &&
  isTokenCount(value["inputTokens"]) &&
  isTokenCount(value["outputTokens"]) &&
  isTokenCount(value["latencyMs"]);

/**
 * Structurally validates what an adapter returned.
 *
 * @throws ProviderError `malformed_response` — which `AI §10.4` then treats as
 * transient and grants exactly one retry. A second malformation fails the
 * stage, because a provider returning garbage twice is not having a bad
 * moment.
 */
export function normalizeResponse(value: unknown): CapabilityResponse {
  if (!isRecord(value)) {
    throw new ProviderError(
      "malformed_response",
      "Adapter returned a non-object response",
    );
  }

  if (typeof value["output"] !== "string") {
    throw new ProviderError(
      "malformed_response",
      "Adapter response is missing a string `output`",
    );
  }

  if (!isUsage(value["usage"])) {
    throw new ProviderError(
      "malformed_response",
      "Adapter response is missing well-formed usage accounting (non-negative integer inputTokens, outputTokens and latencyMs)",
    );
  }

  const degradations = value["degradations"];
  if (
    !Array.isArray(degradations) ||
    !degradations.every((entry) => typeof entry === "string")
  ) {
    throw new ProviderError(
      "malformed_response",
      "Adapter response is missing a string[] `degradations`",
    );
  }

  return {
    output: value["output"],
    usage: value["usage"],
    degradations: [...degradations],
  };
}

/**
 * Coerces anything thrown by an adapter into the uniform taxonomy.
 *
 * An adapter that throws a classified `ProviderError` is honoured as-is —
 * classification is the adapter's job, because deciding that a 429 is a rate
 * limit requires knowing the provider, and that knowledge may not leave
 * `adapters/` (`AI-001`).
 *
 * ⚠️ An *unclassified* throwable is mapped to `persistent`. No document says
 * what an unclassified adapter failure is (`docs/12` D-10). `persistent` is the
 * conservative choice: `AI §10.4` authorizes retry only for transient and
 * malformed-response, so treating an unknown fault as retryable would invent
 * permission to spend provider budget on a bug. Failing the stage surfaces it.
 */
export function normalizeError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  return new ProviderError(
    "persistent",
    "Adapter raised an unclassified failure",
    { cause: error },
  );
}
