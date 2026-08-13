/**
 * Real provider adapter — Anthropic Messages API (`AI §10.5`).
 *
 * The third adapter, and the first that reaches a network. It implements the
 * same `ProviderAdapter` port as the stub and replay adapters, so nothing above
 * it changes: retry, normalization, cost accounting, invocation recording and
 * trace emission are all provider-neutral and untouched.
 *
 * THIS FILE IS THE ONLY PLACE THAT MAY NAME A PROVIDER (`AI-001`, AD-03,
 * boundary check 1), and the only place that may hold outbound HTTP capability
 * (`TC-008`, AD-09, boundary check 3). Two things must not leave it:
 *
 *   1. **Provider identity** (`AI-006`, `FR-093`). Every failure is re-phrased
 *      into a neutral message before it becomes a `ProviderError`. The SDK's
 *      own error — which names the vendor, the model and sometimes the account
 *      — is attached as `cause`, which `capability.ts` documents as being for
 *      logs and traces only.
 *
 *   2. **The credential.** It is never logged, never interpolated into a
 *      message, and never returned. It arrives as a constructor argument from
 *      the composition root; this module does not read `process.env`.
 *
 * The client is injectable so the conformance suite can exercise translation
 * and classification offline, with no key and no network (`AI-005` requires a
 * *continuously* passing test). The live path is covered separately and only
 * when a credential is explicitly configured.
 */

import Anthropic from "@anthropic-ai/sdk";

import {
  ProviderError,
  type CapabilityRequest,
  type CapabilityResponse,
  type ProviderAdapter,
  type ProviderCapabilities,
} from "../capability.js";

/** Minimal shape this adapter needs from the SDK — the injectable seam. */
export interface AnthropicMessagesClient {
  create(params: {
    model: string;
    max_tokens: number;
    temperature?: number;
    system?: string;
    messages: readonly { role: "user"; content: string }[];
  }): Promise<{
    content: readonly { type: string; text?: string }[];
    usage: { input_tokens: number; output_tokens: number };
  }>;
}

export interface AnthropicAdapterOptions {
  /** Never logged, never echoed. Supplied by the composition root. */
  readonly apiKey?: string;
  readonly model: string;
  readonly maxTokens?: number;
  /** Injected in tests; defaults to the official SDK. */
  readonly client?: AnthropicMessagesClient;
}

/** Generous enough for a full architecture; bounded so a runaway cannot bill. */
const DEFAULT_MAX_TOKENS = 8_000;

/**
 * Declared honestly, per `AI §10.6` — "capability assumptions without
 * declaration" are prohibited and a false declaration is worse than none.
 *
 * `structuredOutput` is **false**: this adapter sends a plain message and asks
 * for JSON in the prompt. It cannot *guarantee* conformance to a supplied
 * contract, which is what the capability claims. Tool-use or structured-output
 * modes would change that, and would be a separate, declared change.
 */
const CAPABILITIES: ProviderCapabilities = {
  structuredOutput: false,
  extendedContext: true,
  lowVarianceSampling: true,
  costLatencyTier: "standard",
};

/** Status codes that will not resolve by trying again (`AI §10.4`). */
const PERSISTENT_STATUSES = new Set([400, 401, 403, 404, 413, 422]);

const statusOf = (error: unknown): number | undefined => {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
};

/**
 * Maps a provider failure onto the closed `AI §10.4` taxonomy.
 *
 * Exported for the conformance suite: classification is the part of an adapter
 * most worth testing and least safe to assume, and it needs no network.
 *
 * The returned message is deliberately generic. `FR-093` forbids provider
 * detail reaching a user, and the abstraction layer above cannot scrub what it
 * cannot recognise — so scrubbing happens here, at the boundary that knows.
 */
export function classifyAnthropicError(error: unknown): ProviderError {
  const status = statusOf(error);

  if (status === 429) {
    return new ProviderError("transient", "Provider rate limit reached", {
      cause: error,
    });
  }
  if (status !== undefined && status >= 500) {
    return new ProviderError(
      "transient",
      "Provider reported a temporary internal error",
      { cause: error },
    );
  }
  if (status !== undefined && PERSISTENT_STATUSES.has(status)) {
    return new ProviderError(
      "persistent",
      "Provider rejected the request and will reject a retry",
      { cause: error },
    );
  }

  // Connection and timeout failures carry no status. They are transient by
  // definition: the request never reached a verdict.
  if (
    error instanceof Anthropic.APIConnectionError ||
    error instanceof Anthropic.APIConnectionTimeoutError
  ) {
    return new ProviderError("transient", "Provider was unreachable", {
      cause: error,
    });
  }

  if (error instanceof ProviderError) {
    return error;
  }

  // Unclassified, so not retryable — the same conservative rule the
  // abstraction layer applies (`docs/12` D-10 item 4).
  return new ProviderError(
    "persistent",
    "Provider raised an unclassified failure",
    { cause: error },
  );
}

/** Concatenates the text blocks of a response, rejecting anything unusable. */
function textOf(content: readonly { type: string; text?: string }[]): string {
  const text = content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("");

  if (text.trim() === "") {
    // `AI §10.4`: a normalization failure is treated as a transient error and
    // granted exactly one retry by the layer above.
    throw new ProviderError(
      "malformed_response",
      "Provider returned no usable text content",
    );
  }
  return text;
}

export function createAnthropicProvider(
  options: AnthropicAdapterOptions,
): ProviderAdapter {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  const client: AnthropicMessagesClient =
    options.client ??
    (new Anthropic({ apiKey: options.apiKey })
      .messages as AnthropicMessagesClient);

  return {
    capabilities: CAPABILITIES,

    async invoke(request: CapabilityRequest): Promise<CapabilityResponse> {
      const startedAt = Date.now();

      try {
        const response = await client.create({
          model: options.model,
          max_tokens: maxTokens,
          // `AIP-7`: reasoning is reproducible where the provider allows it.
          // The capability is declared, so honouring it needs no degradation.
          ...(request.preferLowVariance ? { temperature: 0 } : {}),
          // The composed fragment set (`docs/12` D-12) becomes the system
          // prompt. It is framing, not content, and must stay separate from
          // the user's text — provenance discipline depends on the difference.
          ...(request.instructions !== undefined
            ? { system: request.instructions }
            : {}),
          messages: [{ role: "user", content: request.input }],
        });

        const output = textOf(response.content);

        return {
          output,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            latencyMs: Math.max(0, Date.now() - startedAt),
          },
          // No degradation applies: `preferLowVariance` is honoured, and no
          // output contract is sent because `structuredOutput` is declared
          // false and the layer above never supplies one to this adapter.
          degradations: [],
        };
      } catch (error) {
        throw classifyAnthropicError(error);
      }
    },
  };
}
