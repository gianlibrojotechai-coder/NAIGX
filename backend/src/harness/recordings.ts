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
import type { CapabilityProfile } from "../nie/capability-profile.js";
import {
  createReplayProvider,
  replayKeyFor,
  type ReplayFixture,
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
   * The operator inventory Stage 7 was captured against (`FR-022`).
   *
   * ⚠️ REQUIRED TO KEY A JOB-DESCRIPTION FIXTURE AT ALL. `stageProviderInputs`
   * describes a Stage 7 call only when a profile is present, because the
   * pipeline only makes one then. Omitting it here silently produces a fixture
   * set one stage short, and replay fails with a missing-response message that
   * points at the recording rather than at the omission.
   */
  readonly capabilityProfile?: CapabilityProfile;
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
      // D-78: the sample context's one unknown (index 2) is disposed of.
      unknown_disposition: [
        {
          context_index: 2,
          disposition: "deferred",
          statement:
            "Routing rules are parameterised per department, so the number of approvers can be set once it is known",
        },
      ],
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
  // D-78: the requirement path's Stage 9 generator, grounded in the sample
  // architecture's two components and the context's first element.
  {
    stageKey: "platform_recommendation",
    classifiedAs: "business_requirement",
    output: JSON.stringify({
      criteria_applied: [
        {
          criterion:
            "Invoices already arrive by email, so capture must start from the mailbox",
          context_index: 0,
          component: null,
        },
        {
          criterion:
            "Routing must hold unrouted invoices rather than default an approver",
          context_index: null,
          component: "Approval Router",
        },
      ],
      recommended_platform: "n8n",
      also_required: [],
      rationale:
        "A self-hostable workflow platform with a mailbox trigger and conditional routing covers both components without custom code.",
      alternatives_rejected: [
        {
          platform: "Custom code",
          rejection_reason:
            "Nothing in the context names a developer to own it; the routing rules are the kind a workflow platform expresses directly.",
        },
      ],
      fit: [
        {
          component: "Invoice Capture",
          how: "IMAP trigger with attachment extraction",
        },
        {
          component: "Approval Router",
          how: "Switch node on department and amount, with a hold branch",
        },
      ],
      knowledge_currency_note:
        "Platform capabilities and pricing change; verify the mailbox trigger and node operations against current documentation before committing.",
    }),
    inputTokens: 640,
    outputTokens: 310,
    latencyMs: 1800,
  },
  // D-79: the requirement path's risk register against the sample's components.
  {
    stageKey: "risk_assessment",
    classifiedAs: "business_requirement",
    output: JSON.stringify({
      risks: [
        {
          component: "Invoice Capture",
          description:
            "An attachment that is not a PDF, or a PDF the extractor cannot read, is quarantined and the invoice waits unnoticed",
          severity: 3,
          likelihood: 3,
          mitigation:
            "Alert finance on every quarantine and report the queue length daily",
        },
        {
          component: "Approval Router",
          description:
            "An invoice whose department cannot be resolved sits in the unrouted queue past the discount window",
          severity: 3,
          likelihood: 2,
          mitigation:
            "Escalate unrouted invoices after one working day, ahead of the discount deadline",
        },
      ],
      no_risks_statement: null,
    }),
    inputTokens: 610,
    outputTokens: 240,
    latencyMs: 1500,
  },
  // D-80: the complexity factors for the sample design.
  {
    stageKey: "complexity_assessment",
    classifiedAs: "business_requirement",
    output: JSON.stringify({
      factors: [
        {
          factor: "workflow",
          score: 2,
          justification:
            "Two components in sequence with one routing decision.",
        },
        {
          factor: "integration",
          score: 2,
          justification:
            "One inbound mailbox integration with a conventional interface.",
        },
        {
          factor: "data_logic",
          score: 3,
          justification:
            "Attachments are normalised into invoice records with routing rules by department.",
        },
        {
          factor: "failure_risk",
          score: 3,
          justification:
            "Unparseable attachments and unroutable invoices each need deliberate handling.",
        },
        {
          factor: "operational",
          score: 2,
          justification:
            "Routing rules change when approvers change; otherwise unattended.",
        },
      ],
    }),
    inputTokens: 590,
    outputTokens: 210,
    latencyMs: 1400,
  },
  // D-82: the roadmap for the sample design — capture first, routing second.
  {
    stageKey: "implementation_roadmap",
    classifiedAs: "business_requirement",
    output: JSON.stringify({
      phases: [
        {
          ordinal: 1,
          name: "Capture invoices from the mailbox",
          objective:
            "Build Invoice Capture so every emailed PDF becomes a normalised record, with unparseable attachments quarantined",
          components: ["Invoice Capture"],
          depends_on: [],
          outcome:
            "Finance sees every inbound invoice as a record within minutes of its arrival, and nothing is keyed by hand",
          estimate: null,
        },
        {
          ordinal: 2,
          name: "Route approvals",
          objective:
            "Build the Approval Router over the captured records, with the per-department approver count parameterised",
          components: ["Approval Router"],
          depends_on: [1],
          outcome:
            "Each invoice reaches its approver and its decision is recorded with a timestamp; unrouted invoices are held and escalated",
          estimate: null,
        },
      ],
      sequencing_rationale:
        "The router consumes captured records, so capture is built and proven first; the approver count is the one deferred unknown and is parameterised rather than blocking",
    }),
    inputTokens: 610,
    outputTokens: 260,
    latencyMs: 1500,
  },
  // D-83: the sample design's edge cases and one practice.
  {
    stageKey: "edge_case_analysis",
    classifiedAs: "business_requirement",
    output: JSON.stringify({
      edge_cases: [
        {
          component: "Invoice Capture",
          scenario:
            "An email carries two PDF attachments, one an invoice and one a remittance advice",
          consequence:
            "The remittance advice is captured as a second invoice and routed for approval",
          handling:
            "Capture classifies each attachment and quarantines any it cannot classify as an invoice, alerting finance",
        },
        {
          component: "Approval Router",
          scenario:
            "The approver for a department is on leave and no deputy is configured",
          consequence: "Invoices for that department wait unrouted",
          handling:
            "The router holds them in the unrouted queue and escalates after a stated period rather than defaulting to an approver",
        },
      ],
      practices: [
        {
          applies_to: "Invoice Capture",
          practice:
            "Key each captured record on the message id and attachment hash so a re-polled mailbox cannot capture an invoice twice",
          rationale:
            "The capture polls a shared mailbox and retries transient errors, so the same message can be read more than once",
        },
      ],
    }),
    inputTokens: 600,
    outputTokens: 280,
    latencyMs: 1500,
  },
  // D-84: the sample design's one integration, the shared mailbox.
  {
    stageKey: "integration_requirements",
    classifiedAs: "business_requirement",
    output: JSON.stringify({
      integrations: [
        {
          system: "Shared mailbox",
          component: "Invoice Capture",
          purpose: "Read inbound invoice emails and their PDF attachments",
          direction: "inbound",
          capabilities_required: [
            "List messages in a shared mailbox since a watermark",
            "Download attachments by message id",
          ],
          constraints: [
            {
              constraint:
                "Invoices arrive as PDF attachments, so capture must handle PDF and nothing else is promised",
              provenance: "stated",
              context_index: 0,
            },
          ],
          uncertainties: [
            "Whether the mailbox provider offers push notification on new mail, or capture must poll",
          ],
        },
      ],
      no_integrations_statement: null,
      knowledge_currency_note:
        "Mailbox provider capabilities and limits change; verify the current API before building.",
    }),
    inputTokens: 590,
    outputTokens: 230,
    latencyMs: 1400,
  },
];

/**
 * The fixtures one recording files, keyed exactly as the replay adapter will
 * look them up.
 *
 * Split out of `createRecordedProvider` so a deployment can merge the fixtures
 * of MANY recordings into one adapter ([D-62](../../docs/37-D-62-Mode-Aware-Readiness.md):
 * a replay instance serves its whole recorded corpus through a single provider,
 * whereas the harness and the regression runner build one adapter per case).
 * The keying is unchanged and lives in exactly one place — a second builder
 * that keyed even slightly differently would replay nothing and blame the
 * recording, which is this project's most expensive bug shape.
 */
export async function buildReplayFixtures(
  recordings: RecordingSet,
  resolver: FragmentResolver,
  inputText: string,
  options: Pick<RecordedProviderOptions, "capabilityProfile"> = {},
): Promise<Readonly<Record<string, ReplayFixture>>> {
  const fixtures: Record<string, ReplayFixture> = {};

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
    // ⚠️ WITHOUT THIS, STAGE 7 IS NEVER KEYED. The recommendation_generation
    // branch of stageProviderInputs is conditional on a profile being present
    // — correctly, since the pipeline makes no Stage 7 call without one. But
    // the fixture builder was never given the profile, so the branch never
    // fired, no fixture was filed for Stage 7, and a job_description recording
    // failed replay with "No recorded response for request key ..." — the same
    // message, and the same root cause, as the workflow_review defect the
    // comment in stageProviderInputs describes. That fix routed through
    // planReasoning and still could not reach this branch, because this branch
    // needs an input the builder did not receive.
    ...(options.capabilityProfile !== undefined
      ? { capabilityProfile: options.capabilityProfile }
      : {}),
    // Stage 9 keys on the parsed Stage 7 result. Same shape as the profile
    // above: an input the pipeline had at capture and the builder did not.
    ...(outputFor("recommendation_generation") !== undefined
      ? { recommendation: outputFor("recommendation_generation") as string }
      : {}),
    // D-78: the requirement path's Stage 9 keys on the parsed architecture.
    ...(outputFor("architecture_analysis") !== undefined
      ? { architecture: outputFor("architecture_analysis") as string }
      : {}),
    // D-80: the workflow path's Stage 9 keys on the parsed review.
    ...(outputFor("workflow_review") !== undefined
      ? { review: outputFor("workflow_review") as string }
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

  return fixtures;
}

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
  const fixtures = await buildReplayFixtures(recordings, resolver, inputText, {
    ...(options.capabilityProfile !== undefined
      ? { capabilityProfile: options.capabilityProfile }
      : {}),
  });

  return createReplayProvider({
    fixtures,
    lowVarianceSampling: options.lowVarianceSampling ?? true,
  });
}
