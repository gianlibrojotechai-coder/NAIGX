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
 *
 * ## Model generations, and what each accepts ([D-65](../../../../docs/40-D-65-Structured-Outputs-And-Sonnet-5.md))
 *
 * The 2026-09-08 pilot of `claude-sonnet-5` failed 3 of 3 analyses on schema
 * conformance and could not send `temperature: 0`. Both are properties of the
 * model generation, verified against the migration guide on 2026-09-09:
 *
 *   · **Sampling parameters.** On the 5-generation models (`claude-sonnet-5`,
 *     `claude-opus-5`, `claude-fable-*`, `claude-mythos-*`) any non-default
 *     `temperature`, `top_p` or `top_k` returns **400**. `preferLowVariance`
 *     therefore cannot be honoured there, and `AI §10.2` says what to do:
 *     record the degradation rather than pretend. `lowVarianceSampling` is
 *     declared per model, not per adapter.
 *   · **Adaptive thinking** is on by default on those models and cannot be
 *     given a token budget; depth is steered with `output_config.effort`.
 *     Thinking tokens count toward `max_tokens` and are billed as output, so
 *     the default budget is larger for them. `thinking` blocks precede `text`
 *     blocks; content is selected by type, never by position.
 *   · **Structured outputs.** `output_config.format` with a JSON schema makes
 *     the provider constrain decoding to the schema. The adapter applies it
 *     per task from a registry the composition root supplies, so the
 *     `CapabilityRequest` — and with it every replay key — is unchanged. The
 *     stage parsers still validate every field: the schema removes the *shape*
 *     failures the pilot recorded and nothing else, and it weakens no gate.
 *   · **Refusals** arrive as HTTP 200 with `stop_reason: "refusal"`. That is a
 *     persistent failure — retrying reproduces it — and is classified as one.
 */

import Anthropic from "@anthropic-ai/sdk";

import {
  ProviderError,
  type CapabilityRequest,
  type CapabilityResponse,
  type InvokeOptions,
  type ProviderAdapter,
  type ProviderCapabilities,
} from "../capability.js";

/** A JSON Schema object as `output_config.format` accepts it. */
export type OutputSchema = Readonly<Record<string, unknown>>;

/** `output_config.effort` — the documented levels; `high` equals omitting it. */
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

/** Minimal shape this adapter needs from the SDK — the injectable seam. */
export interface AnthropicMessagesClient {
  create(
    params: AnthropicMessageParams,
    options?: { signal?: AbortSignal },
  ): Promise<AnthropicMessageResponse>;
}

/** Exported so a test can assert exactly what was sent. */
export interface AnthropicMessageParams {
  model: string;
  max_tokens: number;
  temperature?: number;
  system?: string;
  messages: readonly { role: "user"; content: string }[];
  output_config?: {
    effort?: EffortLevel;
    format?: { type: "json_schema"; schema: OutputSchema };
  };
}

export interface AnthropicMessageResponse {
  content: readonly { type: string; text?: string }[];
  usage: { input_tokens: number; output_tokens: number };
  stop_reason?: string | null;
}

export interface AnthropicAdapterOptions {
  /** Never logged, never echoed. Supplied by the composition root. */
  readonly apiKey?: string;
  readonly model: string;
  readonly maxTokens?: number;
  /** Injected in tests; defaults to the official SDK. */
  readonly client?: AnthropicMessagesClient;
  /**
   * JSON schemas by `CapabilityRequest.task`, sent as `output_config.format`.
   * Supplying this is what makes the adapter declare `structuredOutput`; a
   * task with no entry is reported as a degradation rather than guessed at.
   */
  readonly outputSchemas?: Readonly<Record<string, OutputSchema>>;
  /** `output_config.effort`. Omitted means the provider's default (`high`). */
  readonly effort?: EffortLevel;
  /**
   * Per-task override of `effort`, keyed like `outputSchemas`. The smallest
   * in-contract latency lever the 2026-09-09 traces point at: extraction
   * stages need less thinking than reasoning stages, and thinking tokens are
   * output tokens. Neither the request shape nor any contract changes.
   */
  readonly effortByTask?: Readonly<Record<string, EffortLevel>>;
}

/**
 * Generous enough for a full architecture; bounded so a runaway cannot bill.
 * Doubled for thinking models, where reasoning tokens share the budget.
 */
const DEFAULT_MAX_TOKENS = 8_000;
const DEFAULT_MAX_TOKENS_THINKING = 16_000;

/**
 * The 5-generation models: adaptive thinking on by default, sampling
 * parameters rejected (migration guide, verified 2026-09-09). Everything
 * else — `claude-sonnet-4-5`, `claude-haiku-4-5`, the 4.x Opus line — keeps
 * accepting `temperature`.
 */
const THINKING_GENERATION = /^claude-(sonnet-5|opus-5|fable-|mythos-)/;

/** Exported for its own tests: the one place the generation is decided. */
export const acceptsSamplingParameters = (model: string): boolean =>
  !THINKING_GENERATION.test(model);

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

  // Cancelled by the lifecycle (`FR-094`), not failed by the provider. Never
  // retried: the analysis that asked for this call is already terminal.
  if (error instanceof Anthropic.APIUserAbortError) {
    return new ProviderError(
      "persistent",
      "Provider request was cancelled at the analysis deadline",
      { cause: error },
    );
  }

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

/**
 * Concatenates the text blocks of a response, rejecting anything unusable.
 *
 * Selected by `type`: on thinking models the first block is a `thinking`
 * block with (by default) empty text, and reading by position would return
 * nothing where the answer follows.
 */
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
  const thinkingModel = !acceptsSamplingParameters(options.model);
  const maxTokens =
    options.maxTokens ??
    (thinkingModel ? DEFAULT_MAX_TOKENS_THINKING : DEFAULT_MAX_TOKENS);
  const schemas = options.outputSchemas;

  const client: AnthropicMessagesClient =
    options.client ??
    (new Anthropic({ apiKey: options.apiKey })
      .messages as unknown as AnthropicMessagesClient);

  /**
   * Declared honestly, per `AI §10.6` — "capability assumptions without
   * declaration" are prohibited and a false declaration is worse than none.
   *
   * `structuredOutput` is true only when a schema registry was supplied: then
   * the provider constrains decoding to a contract for every task the
   * registry names. `lowVarianceSampling` is a property of the model
   * generation, not of this adapter.
   */
  const capabilities: ProviderCapabilities = {
    structuredOutput: schemas !== undefined,
    extendedContext: true,
    lowVarianceSampling: !thinkingModel,
    costLatencyTier: "standard",
  };

  return {
    capabilities,

    async invoke(
      request: CapabilityRequest,
      invokeOptions: InvokeOptions = {},
    ): Promise<CapabilityResponse> {
      const startedAt = Date.now();
      const degradations: string[] = [];

      // `AIP-7`: reasoning is reproducible where the provider allows it. Where
      // it does not, `AI §10.2` — degrade to the closest available and record
      // that determinism is reduced. Sending it anyway would be a 400.
      const temperature: { temperature?: number } = {};
      if (request.preferLowVariance) {
        if (thinkingModel) {
          degradations.push(
            "low_variance_unavailable: this model generation rejects sampling parameters, so temperature 0 was not sent",
          );
        } else {
          temperature.temperature = 0;
        }
      }

      const schema = schemas?.[request.task];
      if (schemas !== undefined && schema === undefined) {
        degradations.push(
          `structured_output_unavailable: no output schema is registered for task "${request.task}"`,
        );
      }
      const effort = options.effortByTask?.[request.task] ?? options.effort;
      const outputConfig: NonNullable<AnthropicMessageParams["output_config"]> =
        {
          ...(effort !== undefined ? { effort } : {}),
          ...(schema !== undefined
            ? { format: { type: "json_schema" as const, schema } }
            : {}),
        };

      try {
        const response = await client.create(
          {
            model: options.model,
            max_tokens: maxTokens,
            ...temperature,
            // The composed fragment set (`docs/12` D-12) becomes the system
            // prompt. It is framing, not content, and must stay separate from
            // the user's text — provenance discipline depends on the difference.
            ...(request.instructions !== undefined
              ? { system: request.instructions }
              : {}),
            messages: [{ role: "user", content: request.input }],
            ...(Object.keys(outputConfig).length > 0
              ? { output_config: outputConfig }
              : {}),
          },
          invokeOptions.signal !== undefined
            ? { signal: invokeOptions.signal }
            : undefined,
        );

        // A refusal is a 200 with nothing to parse. Retrying reproduces it.
        if (response.stop_reason === "refusal") {
          throw new ProviderError(
            "persistent",
            "Provider declined to answer this request",
          );
        }

        const output = textOf(response.content);

        // Truncated output cannot be valid JSON for a structured task, and a
        // second attempt with the same budget is the one retry `AI §10.4`
        // grants a malformed response — it may finish under a shorter think.
        if (response.stop_reason === "max_tokens") {
          throw new ProviderError(
            "malformed_response",
            "Provider output was cut off at the token limit",
          );
        }

        return {
          output,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            latencyMs: Math.max(0, Date.now() - startedAt),
          },
          degradations,
        };
      } catch (error) {
        throw classifyAnthropicError(error);
      }
    },
  };
}
