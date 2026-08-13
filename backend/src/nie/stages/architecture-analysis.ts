/**
 * Stage 6 — Architecture Analysis (`FR-030`, `AI §3.2`).
 *
 * Derives the design — components, boundaries, data flow, integration points,
 * failure handling — from the structured outputs of Stages 1-3. It never
 * re-reads raw input to answer a question the context set already answered:
 * the context set *is* the grounding layer, and a component justified by the
 * input rather than by an extracted element would be untraceable.
 *
 * THE CONSTRAINT THAT DEFINES THIS STAGE. `FR-030`: "components addressing no
 * stated or inferred requirement are a defect". `AI §3.2`: "Every component
 * justified by a context element; no component addressing nothing" and
 * "traceability structurally verified". So grounding is checked here,
 * deterministically, against the actual Stage 3 element set — not asserted by
 * the model and believed.
 *
 * `AI §3.2` grants exactly one regeneration when that verification fails, then
 * fails the stage "rather than emitting an unjustifiable design". The pipeline
 * owns that retry; this module owns the verdict.
 */

import {
  ArchitectureTraceabilityError,
  StageError,
  type ArchitectureComponentDraft,
  type ArchitectureResult,
  type ContextResult,
} from "../contracts.js";
import {
  asRecord,
  optionalString,
  parseStructured,
  requireArray,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 6;
const STAGE_KEY = "architecture_analysis";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

function parseComponent(
  value: unknown,
  index: number,
): ArchitectureComponentDraft {
  const label = `components[${String(index)}]`;
  const record = asRecord(CTX, value, label);

  const name = requireString(CTX, record, "name");
  const responsibility = requireString(CTX, record, "responsibility");
  const inputs = requireString(CTX, record, "inputs");
  const outputs = requireString(CTX, record, "outputs");
  // `FR-030`: "Failure handling is specified per component, not as a general
  // statement." A non-empty per-component field is the structural form of that.
  const failureHandling = requireString(CTX, record, "failure_handling");

  const externalSystem = optionalString(record, "external_system");
  const integrationDirection = optionalString(record, "integration_direction");

  // `FR-030`: "Integration points name the systems involved and the direction
  // of data flow." One without the other is an integration point that cannot
  // be read.
  if (externalSystem !== undefined && integrationDirection === undefined) {
    return fail(
      `${label}: a component naming external_system "${externalSystem}" must state integration_direction`,
    );
  }
  if (integrationDirection !== undefined && externalSystem === undefined) {
    return fail(
      `${label}: integration_direction is meaningless without external_system`,
    );
  }

  const rawGrounding = requireArray(CTX, record, "grounded_in_context_indices");
  const grounded: number[] = [];
  for (const entry of rawGrounding) {
    if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0) {
      return fail(
        `${label}: grounded_in_context_indices must contain non-negative integers`,
      );
    }
    if (!grounded.includes(entry)) {
      grounded.push(entry);
    }
  }

  return {
    name,
    responsibility,
    inputs,
    outputs,
    failureHandling,
    ...(externalSystem !== undefined ? { externalSystem } : {}),
    ...(integrationDirection !== undefined ? { integrationDirection } : {}),
    ordinal: index,
    groundedInContextIndices: grounded,
  };
}

/**
 * Parses and structurally verifies a Stage 6 response against the context set
 * it claims to derive from.
 *
 * @throws ArchitectureTraceabilityError when grounding is missing or dangling —
 * the one failure `AI §3.2` allows a regeneration for.
 * @throws StageError for anything else; a malformed design is not regenerated.
 */
export function parseArchitecture(
  responseText: string,
  context: ContextResult,
): ArchitectureResult {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);

  const summary = requireString(CTX, record, "summary");
  const dataFlowDescription = requireString(
    CTX,
    record,
    "data_flow_description",
  );

  const components = requireArray(CTX, record, "components").map(
    parseComponent,
  );

  if (components.length === 0) {
    fail("An architecture must contain at least one component");
  }

  // `DB §4.3`: unique on (architecture_id, name). Name uniqueness is what lets
  // diagrams, roadmaps and risks reference components by name and stay
  // consistent (`AI §9.4`) — a duplicate would make those references ambiguous.
  const seen = new Set<string>();
  for (const component of components) {
    const key = component.name.trim().toLowerCase();
    if (seen.has(key)) {
      fail(`Duplicate component name "${component.name}"`);
    }
    seen.add(key);
  }

  // The traceability verification. Checked after parsing so that a design which
  // is otherwise well-formed but ungrounded reports the grounding problem,
  // which is the one worth regenerating for.
  const elementCount = context.elements.length;
  for (const component of components) {
    if (component.groundedInContextIndices.length === 0) {
      throw new ArchitectureTraceabilityError(
        `Component "${component.name}" is grounded in no context element (FR-030)`,
      );
    }
    for (const index of component.groundedInContextIndices) {
      if (index >= elementCount) {
        throw new ArchitectureTraceabilityError(
          `Component "${component.name}" references context element ${String(index)}, but only ${String(elementCount)} were extracted`,
        );
      }
    }
  }

  return { summary, dataFlowDescription, components };
}

export const ARCHITECTURE_STAGE = {
  stageNumber: STAGE_NUMBER,
  stageKey: STAGE_KEY,
} as const;
