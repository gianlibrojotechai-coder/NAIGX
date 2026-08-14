/**
 * ⚠️ THE DRY-RUN ADAPTER. IT IS NOT A PROVIDER AND ITS OUTPUT IS NOT EVIDENCE.
 *
 * It exists so the capture path — pipeline wiring, response collection, hashing,
 * validation, writing, manifest update, refusal rules — can be exercised end to
 * end without a credential, a network call, or a cent of provider spend. That is
 * the whole of its purpose.
 *
 * WHAT IT PRODUCES is the minimum each stage will parse, derived mechanically
 * from the corpus case: the classification the corpus expects, a quote taken
 * verbatim from the input so `docs/12` D-19 provenance verification passes, and
 * one grounded component. There is no reasoning in it whatsoever.
 *
 * WHY THIS CANNOT BECOME FAKE EVIDENCE. Three independent guards:
 *
 *   1. the capture command refuses to point a dry run at the real recording
 *      store — it writes to a scratch directory and says where;
 *   2. every recording it produces carries `provider.adapter = "dry-run"`, so a
 *      stray file is identifiable on sight and in review;
 *   3. the manifest gate means any recording reaching the suite arrived through
 *      a reviewed diff (`docs/12` D-24).
 *
 * A recording captured from this adapter would tell you only that the plumbing
 * runs. It would tell you nothing about reasoning, which is the thing the corpus
 * exists to measure.
 */

import type {
  CapabilityRequest,
  CapabilityResponse,
  ProviderAdapter,
} from "../provider/capability.js";
import type { CorpusCase } from "./corpus.js";

export const DRY_RUN_ADAPTER_ID = "dry-run";

/** A quote that certainly occurs in the input, for the D-19 span check. */
const quoteFrom = (inputText: string): string => {
  const firstLine = inputText.split("\n").find((l) => l.trim().length > 12);
  const line = (firstLine ?? inputText).trim();
  return line.slice(0, Math.min(48, line.length));
};

/**
 * An adapter that answers each stage for one corpus case.
 *
 * Per case rather than global: Stage 3 must quote *this* input, and a shared
 * responder would have to guess which case it was serving.
 */
export function createDryRunAdapter(corpusCase: CorpusCase): ProviderAdapter {
  const quote = quoteFrom(corpusCase.inputText);
  const type = corpusCase.expectedClassification;

  const outputs: Readonly<Record<string, string>> = {
    input_classification: JSON.stringify({
      determined_type: type,
      // Matches the corpus bound so the dry run follows the same path the real
      // capture would: `below_threshold` cases exercise `FR-015`.
      confidence:
        corpusCase.expectedClassificationConfidence.bound === "below_threshold"
          ? 0.45
          : 0.9,
      candidate_types: [type],
    }),
    intent_detection: JSON.stringify({
      primary_objective: {
        content: "Dry-run placeholder objective",
        provenance: "inferred",
      },
      secondary_objectives: [],
      inferred_scope: "Dry-run placeholder scope",
    }),
    context_extraction: JSON.stringify({
      elements: [
        {
          id: "e1",
          content: "Dry-run placeholder context element",
          category: "environment",
          provenance: "stated",
          source_quote: quote,
          specificity_score: 0.5,
        },
      ],
      sufficiency:
        corpusCase.specialClass === "insufficient"
          ? "insufficient"
          : "sufficient",
    }),
    architecture_analysis: JSON.stringify({
      summary: "Dry-run placeholder architecture",
      data_flow_description: "Dry-run placeholder data flow",
      components: [
        {
          name: "Dry Run Component",
          responsibility: "Exercise the capture path and nothing else",
          inputs: "Dry-run input",
          outputs: "Dry-run output",
          failure_handling: "Not applicable; this component is not a design",
          grounded_in_context_indices: [0],
        },
      ],
    }),
  };

  return {
    capabilities: {
      structuredOutput: false,
      extendedContext: false,
      // A canned string is deterministic, and saying so is honest (`AI §10.6`).
      lowVarianceSampling: true,
      costLatencyTier: "dry-run",
    },

    invoke(request: CapabilityRequest): Promise<CapabilityResponse> {
      const output = outputs[request.task];
      if (output === undefined) {
        return Promise.reject(
          new Error(
            `the dry-run adapter has no answer for stage ${request.task}`,
          ),
        );
      }
      return Promise.resolve({
        output,
        // Zero tokens: nothing was spent, and a plausible-looking count would
        // put a fictional number into a cost path someone might later read.
        usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0 },
        degradations: [],
      });
    },
  };
}
