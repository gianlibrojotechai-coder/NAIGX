/**
 * The stage inventory — `AI` Appendix A.
 *
 * **Twelve stages**, per `docs/12` D-7. `MVP §5.1` and `TM-3` say six and are
 * the outlier: `AI §3.3`, `§14`, `AID-02`, Appendix A and `Roadmap M-05` all say
 * twelve, and the Roadmap's "Stage 6: architecture analysis" is meaningless
 * under a six-stage numbering. The conflict is recorded as `AIQ-10` and is
 * **not** resolved by this file — the full twelve are declared here precisely so
 * that implementing three of them cannot quietly redefine the pipeline.
 *
 * `stageKey` is the stage vocabulary the trace store's `stage_key` and
 * `FRAGMENT_USAGE.stage` record. It is derived mechanically from Appendix A's
 * names rather than invented (`docs/12` D-10 deferral #4).
 */

export interface StageDefinition {
  readonly stageNumber: number;
  readonly stageKey: string;
  readonly name: string;
  /** Whether this stage is implemented in the current build. */
  readonly implemented: boolean;
  /**
   * Artifact types this stage produces. Every entry must have a registered
   * schema (`FR-039`, `AD-08`) — boundary check 5 reads this field.
   * Artifact generation is Stage 9, a Sprint 2 deliverable, so every stage in
   * this build declares none.
   */
  readonly producesArtifactTypes: readonly string[];
}

export const STAGES: readonly StageDefinition[] = [
  {
    stageNumber: 1,
    stageKey: "input_classification",
    name: "Input Classification",
    implemented: true,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 2,
    stageKey: "intent_detection",
    name: "Intent Detection",
    implemented: true,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 3,
    stageKey: "context_extraction",
    name: "Context Extraction",
    implemented: true,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 4,
    stageKey: "knowledge_assembly",
    name: "Knowledge Assembly",
    implemented: false,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 5,
    stageKey: "reasoning_planning",
    name: "Reasoning Planning",
    implemented: false,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 6,
    stageKey: "architecture_analysis",
    name: "Architecture Analysis",
    implemented: true,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 7,
    stageKey: "recommendation_generation",
    name: "Recommendation Generation",
    implemented: true,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 8,
    stageKey: "artifact_planning",
    name: "Artifact Planning",
    implemented: true,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 9,
    stageKey: "portfolio_suggestions",
    // Stage 9 is Artifact Generation, and its generators are independent
    // (`AID-08`). Phase 3A ships one, so the stage key is that generator: the
    // prompt fragment is generator-specific, and a shared `artifact_generation`
    // key would give two generators one prompt. Per-generator resolution is the
    // follow-up when a second generator lands (`docs/12` D-29).
    name: "Artifact Generation — Portfolio Suggestions",
    implemented: true,
    producesArtifactTypes: ["portfolio_suggestions"],
  },
  {
    stageNumber: 10,
    stageKey: "response_validation",
    name: "Response Validation",
    implemented: false,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 11,
    stageKey: "confidence_evaluation",
    name: "Confidence Evaluation",
    implemented: false,
    producesArtifactTypes: [],
  },
  {
    stageNumber: 12,
    stageKey: "response_assembly",
    name: "Response Assembly",
    implemented: false,
    producesArtifactTypes: [],
  },
];

export const stageByNumber = (stageNumber: number): StageDefinition => {
  const stage = STAGES.find((s) => s.stageNumber === stageNumber);
  if (stage === undefined) {
    throw new RangeError(`No stage numbered ${String(stageNumber)}`);
  }
  return stage;
};

/** Stages this build executes, in `FR-010` order. */
export const implementedStages = (): readonly StageDefinition[] =>
  STAGES.filter((s) => s.implemented);
