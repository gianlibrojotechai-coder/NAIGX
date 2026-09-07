/**
 * Stage 6W — Workflow Review, existing-workflow path (`FR-021`).
 *
 * The second generator of Stage 6. Where `architecture-analysis` *designs* a
 * structure for a requirement, this one *describes* the structure it was given
 * and then evaluates it. `docs/15` D-40 records why they are different jobs:
 * `AI §7.1` withholds RM-4 Architecture Design from this path, and `AI §4.2`
 * calls it a "review path: current-structure identification precedes
 * evaluation". A workflow submitted for review is the subject of the analysis,
 * not the input to a redesign.
 *
 * THREE REFUSALS, each from an `FR-021` acceptance criterion:
 *
 *   1. **Structure before findings.** A review that evaluates a structure it
 *      never stated is a review the reader cannot check. The parser requires a
 *      non-empty `structure`, and every finding cites a step within it.
 *
 *   2. **No generic findings.** `FR-021`: issues must be "specific to the
 *      submitted workflow, not generic best-practice statements". A finding
 *      that cannot name the step it concerns is exactly that generic statement,
 *      so `component_index` is mandatory and must resolve — the same
 *      discipline `FR-030` applies to architecture components and `FR-032`
 *      enforces with a NOT NULL column.
 *
 *   3. **Silence is not approval.** `FR-021`: "A sound workflow yields an
 *      explicit statement that no material issues were found, not manufactured
 *      criticism." So an empty findings list is legal *and* must carry a
 *      `soundness_statement`. A model that finds nothing has to say so.
 *
 * NO PROVIDER, NO DATABASE. Parsing and verification only.
 */

import {
  StageError,
  type ArchitectureComponentDraft,
  type ContextResult,
  type WorkflowFinding,
  type WorkflowReviewResult,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 6;
const STAGE_KEY = "workflow_review";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

/**
 * A grounding failure in the review — a step citing no context, or a finding
 * citing no step.
 *
 * Distinct from `StageError` for the reason `ArchitectureTraceabilityError` is:
 * it is the one failure worth a single regeneration, because a model that
 * mis-cited once may cite correctly when shown the constraint.
 */
export class WorkflowReviewGroundingError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "WorkflowReviewGroundingError";
  }
}

/** 1–5, the `docs/09` §2 scales. Rejected rather than clamped. */
const requireScore = (
  record: Record<string, unknown>,
  field: string,
  label: string,
): number => {
  const value = record[field];
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 5
  ) {
    return fail(
      `${label}.${field} must be an integer 1-5 (docs/09 §2); received ${JSON.stringify(value)}`,
    );
  }
  return value;
};

function parseStep(
  value: unknown,
  index: number,
  elementCount: number,
): ArchitectureComponentDraft {
  const label = `structure[${String(index)}]`;
  const record = asRecord(CTX, value, label);

  const name = requireString(CTX, record, "name");
  const responsibility = requireString(CTX, record, "responsibility");
  const inputs = requireString(CTX, record, "inputs");
  const outputs = requireString(CTX, record, "outputs");
  const failureHandling = requireString(CTX, record, "failure_handling");

  // The same `FR-030` grounding rule the design path uses. A step the
  // submission does not describe is a step the reviewer invented, and an
  // invented step can carry an invented finding.
  const rawGrounding = requireArray(CTX, record, "grounded_in_context_indices");
  const grounded: number[] = [];
  for (const entry of rawGrounding) {
    if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0) {
      return fail(
        `${label}: grounded_in_context_indices must contain non-negative integers`,
      );
    }
    if (entry >= elementCount) {
      throw new WorkflowReviewGroundingError(
        `${label} cites context element ${String(entry)}, but the context set has ` +
          `${String(elementCount)} element(s) with indices 0-${String(elementCount - 1)}. ` +
          `Cite the "index" value shown on each context element.`,
      );
    }
    if (!grounded.includes(entry)) grounded.push(entry);
  }
  if (grounded.length === 0) {
    throw new WorkflowReviewGroundingError(
      `${label} ("${name}") is grounded in no context element — a step the submission does not describe is invented`,
    );
  }

  const externalSystem = record["external_system"];
  const integrationDirection = record["integration_direction"];

  return {
    name,
    responsibility,
    inputs,
    outputs,
    failureHandling,
    ordinal: index,
    groundedInContextIndices: grounded,
    ...(typeof externalSystem === "string" && externalSystem !== ""
      ? { externalSystem }
      : {}),
    ...(typeof integrationDirection === "string" && integrationDirection !== ""
      ? { integrationDirection }
      : {}),
  };
}

function parseFinding(
  value: unknown,
  index: number,
  stepCount: number,
): WorkflowFinding {
  const label = `findings[${String(index)}]`;
  const record = asRecord(CTX, value, label);

  const componentIndex = record["component_index"];
  if (
    typeof componentIndex !== "number" ||
    !Number.isInteger(componentIndex) ||
    componentIndex < 0
  ) {
    return fail(`${label}.component_index must be a non-negative integer`);
  }
  if (componentIndex >= stepCount) {
    throw new WorkflowReviewGroundingError(
      `${label} names step ${String(componentIndex)}, but the review identified ` +
        `${String(stepCount)} step(s) with indices 0-${String(stepCount - 1)}. ` +
        `A finding that cannot name the step it concerns is the generic ` +
        `best-practice statement FR-021 rejects.`,
    );
  }

  return {
    componentIndex,
    description: requireString(CTX, record, "description"),
    severity: requireScore(record, "severity", label),
    likelihood: requireScore(record, "likelihood", label),
    remediation: requireString(CTX, record, "remediation"),
  };
}

/**
 * Parses and structurally verifies a Stage 6W response.
 *
 * @throws WorkflowReviewGroundingError when a step or finding cites nothing
 * that exists — the one failure worth a regeneration.
 * @throws StageError for anything else.
 */
export function parseWorkflowReview(
  responseText: string,
  context: ContextResult,
): WorkflowReviewResult {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);

  const summary = requireString(CTX, record, "summary");
  const dataFlowDescription = requireString(
    CTX,
    record,
    "data_flow_description",
  );

  const elementCount = context.elements.length;
  const structure = requireArray(CTX, record, "structure").map((value, index) =>
    parseStep(value, index, elementCount),
  );

  // `FR-021`'s first acceptance criterion, enforced rather than hoped for.
  if (structure.length === 0) {
    return fail(
      "the review must identify the workflow's current structure before evaluating it (FR-021) — a review with no stated structure cannot be checked",
    );
  }

  // `DB §4.3` is unique on (architecture_id, name), and findings reference
  // steps by position — a duplicate name would make a finding ambiguous to a
  // reader even where the index is not.
  const seen = new Set<string>();
  for (const step of structure) {
    const key = step.name.trim().toLowerCase();
    if (seen.has(key)) fail(`Duplicate step name "${step.name}"`);
    seen.add(key);
  }

  const findings = requireArray(CTX, record, "findings").map((value, index) =>
    parseFinding(value, index, structure.length),
  );

  const optimisations: string[] = [];
  for (const entry of requireArray(CTX, record, "optimisations")) {
    if (typeof entry !== "string" || entry.trim() === "") {
      return fail("optimisations must be non-empty strings");
    }
    optimisations.push(entry);
  }

  // `FR-021`: a sound workflow says so. An empty findings list with no
  // statement is indistinguishable from a model that gave up, and the
  // requirement exists so those two cannot be confused.
  const rawStatement = record["soundness_statement"];
  const soundnessStatement =
    typeof rawStatement === "string" && rawStatement.trim() !== ""
      ? rawStatement
      : undefined;

  if (findings.length === 0 && soundnessStatement === undefined) {
    return fail(
      "a review that reports no findings must state explicitly that no material issues were found (FR-021) — silence is not the same claim as soundness",
    );
  }

  return {
    summary,
    dataFlowDescription,
    structure,
    findings,
    optimisations,
    ...(soundnessStatement !== undefined ? { soundnessStatement } : {}),
  };
}

export const WORKFLOW_REVIEW_STAGE = {
  stageNumber: STAGE_NUMBER,
  stageKey: STAGE_KEY,
} as const;
