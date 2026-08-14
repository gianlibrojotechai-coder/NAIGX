/**
 * Recorded stage responses for the developer harness.
 *
 * WHY THIS EXISTS. The harness must run the real pipeline through the real
 * provider abstraction, and no real provider adapter exists yet — that is
 * Sprint 1's remaining provider work, not this task's. The two adapters
 * available are the stub (a synthetic digest, which no stage can parse) and the
 * replay adapter, which serves recorded responses. So the harness configures
 * the replay adapter, which is exactly what it was built for (`docs/12` D-11).
 *
 * ISOLATED ON PURPOSE. Nothing here is imported by the NIE, the provider layer,
 * or persistence. It is harness configuration: a recorded conversation, not a
 * second reasoning path. When a real adapter lands, `--provider` selects it and
 * this file stops being used without anything else changing.
 *
 * HONEST LIMIT, stated in the harness output too: a recording answers the same
 * way regardless of the input text. It demonstrates the pipeline mechanics,
 * provenance chain and persistence end to end. It does not demonstrate
 * reasoning quality, which cannot be judged until a real provider runs.
 *
 * ONE COUPLING TO THE INPUT, by design. Stage 3 verifies that a `stated`
 * element quotes the input verbatim, so this recording only replays cleanly
 * against text containing its quotes. That is the check working: a recording
 * replayed against unrelated input would otherwise manufacture provenance for
 * words that were never submitted.
 */

import type { ProviderAdapter } from "../provider/capability.js";
import {
  createReplayProvider,
  replayKeyFor,
} from "../provider/adapters/replay.js";
import { composePrompt } from "../nie/prompt.js";
import { stageProviderInputs } from "../nie/pipeline.js";
import type { ClassificationType } from "../nie/contracts.js";
import type { FragmentResolver } from "../nie/ports.js";

/** One recorded stage response, keyed by the stage that produced it. */
export interface StageRecording {
  readonly stageKey: string;
  /** The classification in force when the stage ran, if any. */
  readonly classifiedAs?: ClassificationType;
  readonly output: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
}

export type RecordingSet = readonly StageRecording[];

export interface RecordedProviderOptions {
  /**
   * Whether the responses being replayed were captured under low-variance
   * sampling.
   *
   * `AI §10.6` prohibits "capability assumptions without declaration", and the
   * replay adapter turns this into an `AI §10.2` degradation when a caller asks
   * for low variance and the recording cannot supply it. Declaring it for the
   * caller would be an assumption; the caller knows how its recording was made
   * and this one does not.
   *
   * Defaults to `true` for the harness's own hand-authored recording, which is
   * deterministic by construction: it is a fixed string, not a sample.
   */
  readonly lowVarianceSampling?: boolean;
}

/**
 * A complete recorded run of the business-requirement path.
 *
 * Kept deliberately small and readable: a developer inspecting the harness
 * should be able to see what the model was recorded as saying.
 */
export const DEFAULT_BUSINESS_REQUIREMENT_RECORDING: RecordingSet = [
  {
    stageKey: "input_classification",
    output: JSON.stringify({
      determined_type: "business_requirement",
      confidence: 0.91,
      candidate_types: ["business_requirement"],
    }),
    inputTokens: 420,
    outputTokens: 38,
    latencyMs: 640,
  },
  {
    stageKey: "intent_detection",
    classifiedAs: "business_requirement",
    output: JSON.stringify({
      primary_objective: {
        content:
          "Automate invoice capture and approval routing so finance stops keying invoices by hand",
        provenance: "stated",
      },
      secondary_objectives: [
        {
          content: "Recover early-payment discounts lost to slow approvals",
          provenance: "inferred",
        },
      ],
      inferred_scope: "Accounts payable, from invoice receipt to approval",
    }),
    inputTokens: 460,
    outputTokens: 96,
    latencyMs: 880,
  },
  {
    stageKey: "context_extraction",
    classifiedAs: "business_requirement",
    output: JSON.stringify({
      elements: [
        {
          id: "e1",
          content: "Invoices arrive by email as PDF attachments",
          category: "environment",
          provenance: "stated",
          source_quote: "arrive as PDF attachments",
          specificity_score: 0.9,
        },
        {
          id: "e2",
          content: "Approval currently depends on email replies",
          category: "environment",
          provenance: "inferred",
          inference_basis:
            "The described process routes approvals through inboxes",
          specificity_score: 0.55,
        },
        {
          id: "e3",
          content: "Number of approvers per department",
          category: "dependency",
          provenance: "unknown",
          resolution_hint:
            "Ask how many approvers each department has and who deputises",
          specificity_score: 0.2,
        },
      ],
      sufficiency: "sufficient",
    }),
    inputTokens: 520,
    outputTokens: 210,
    latencyMs: 1240,
  },
  {
    stageKey: "architecture_analysis",
    classifiedAs: "business_requirement",
    output: JSON.stringify({
      summary:
        "Automated invoice capture with rule-based approval routing and an approval status view",
      data_flow_description:
        "Mailbox → capture → extraction → routing → approval → ledger sync",
      components: [
        {
          name: "Invoice Capture",
          responsibility:
            "Poll the shared mailbox and normalise inbound invoice attachments",
          inputs: "Email messages with PDF attachments",
          outputs: "Normalised invoice records with source references",
          failure_handling:
            "Retry transient mailbox errors with backoff; quarantine unparseable attachments for manual review and alert finance",
          external_system: "Shared mailbox",
          integration_direction: "inbound",
          grounded_in_context_indices: [0],
        },
        {
          name: "Approval Router",
          responsibility:
            "Route each captured invoice to the correct approver and track its state",
          inputs: "Normalised invoice records",
          outputs: "Approval decisions with timestamps",
          failure_handling:
            "If no approver can be resolved, hold the invoice in an unrouted queue and escalate rather than defaulting to an approver",
          grounded_in_context_indices: [1, 2],
        },
      ],
    }),
    inputTokens: 780,
    outputTokens: 430,
    latencyMs: 2100,
  },
];

/**
 * Builds a replay adapter primed against the prompts the **real** composer
 * produces from the **published** fragment versions.
 *
 * Keying this way rather than hard-coding digests means a fragment change
 * invalidates nothing silently: the composed prompt changes, the key changes,
 * and the harness reports a missing recording instead of replaying an answer
 * to a question that is no longer being asked.
 */
export async function createRecordedProvider(
  recordings: RecordingSet,
  resolver: FragmentResolver,
  inputText: string,
  options: RecordedProviderOptions = {},
): Promise<ProviderAdapter> {
  const fixtures: Record<
    string,
    {
      output: string;
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
    }
  > = {};

  const outputFor = (stageKey: string): string | undefined =>
    recordings.find((r) => r.stageKey === stageKey)?.output;

  // Keyed on the handoff the pipeline actually sends, not on the raw text
  // (`FR-010`, `AI §3.2`). A fixture keyed the old way would simply never
  // match, which is the failure mode this replaces.
  const providerInputs = stageProviderInputs(inputText, {
    ...(outputFor("input_classification") !== undefined
      ? { classification: outputFor("input_classification") as string }
      : {}),
    ...(outputFor("intent_detection") !== undefined
      ? { intent: outputFor("intent_detection") as string }
      : {}),
    ...(outputFor("context_extraction") !== undefined
      ? { context: outputFor("context_extraction") as string }
      : {}),
  });

  for (const recording of recordings) {
    const providerInput = providerInputs.get(recording.stageKey);
    if (providerInput === undefined) {
      continue;
    }
    const prompt = await composePrompt(
      {
        stageKey: recording.stageKey,
        ...(recording.classifiedAs !== undefined
          ? { classifiedAs: recording.classifiedAs }
          : {}),
      },
      resolver,
    );
    fixtures[
      replayKeyFor({
        task: recording.stageKey,
        input: providerInput,
        instructions: prompt.instructions,
        preferLowVariance: true,
      })
    ] = {
      output: recording.output,
      inputTokens: recording.inputTokens,
      outputTokens: recording.outputTokens,
      latencyMs: recording.latencyMs,
    };
  }

  return createReplayProvider({
    fixtures,
    lowVarianceSampling: options.lowVarianceSampling ?? true,
  });
}
