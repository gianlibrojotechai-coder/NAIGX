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
  type AcceptedTradeOff,
  type ArchitectureComponentDraft,
  type ArchitectureResult,
  type ContextResult,
  type RejectedApproach,
  type UnknownDisposition,
  UNKNOWN_DISPOSITIONS,
} from "../contracts.js";
import {
  asRecord,
  optionalString,
  parseStructured,
  requireArray,
  requireMember,
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
  /**
   * Whether the `FR-023` trade-off obligations apply.
   *
   * `AI §7.1` maps RM-5 Trade-off Evaluation to both the requirement and
   * assessment paths, but only `FR-023` makes it an acceptance criterion: "at
   * least one rejected alternative approach is named with the reason for
   * rejection", and "trade-offs accepted by the proposed approach are stated".
   * `FR-020` asks for neither, so requiring them everywhere would fail the
   * requirement path against a rule nothing states about it.
   */
  requireTradeOffs = false,
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
        // The valid range is named because this error is the one the pipeline
        // regenerates on (`AI §3.2`): a message the next attempt can act on is
        // worth more than one that only states the verdict.
        throw new ArchitectureTraceabilityError(
          `Component "${component.name}" references context element ${String(index)}, ` +
            `but the context set has ${String(elementCount)} element(s) with indices 0-${String(elementCount - 1)}. ` +
            `Cite the "index" value shown on each context element.`,
        );
      }
    }
  }

  // D-78 (`docs/13` D-38): every unknown element is disposed of exactly once.
  // A traceability error, so the one informed regeneration names the indices.
  const unknownDispositions = parseUnknownDispositions(record, context);

  // `FR-023` — a design nobody can question is a design nobody can defend.
  // Parsed on every path, because a requirement analysis may volunteer them,
  // and *required* only where the specification requires them.
  const tradeOffs = parseTradeOffs(record);
  const rejectedApproaches = parseRejectedApproaches(record);

  if (requireTradeOffs) {
    if (rejectedApproaches.length === 0) {
      return fail(
        "the assessment path must name at least one rejected alternative approach with its reason (FR-023) — a solution presented without alternatives cannot be defended under questioning",
      );
    }
    if (tradeOffs.length === 0) {
      return fail(
        "the assessment path must state the trade-offs the proposed approach accepts (FR-023) — an approach that costs nothing is either trivial or misdescribed",
      );
    }
  }

  return {
    summary,
    dataFlowDescription,
    components,
    unknownDispositions,
    ...(tradeOffs.length > 0 ? { tradeOffs } : {}),
    ...(rejectedApproaches.length > 0 ? { rejectedApproaches } : {}),
  };
}

/**
 * D-78 — the disposition of every unknown context element.
 *
 * An absent key reads as an empty list, so a context set with no unknown
 * element needs no entry; a context set with one needs exactly one entry per
 * unknown, and the check below is what `docs/13` D-38 measured the absence
 * of: a design citing an unknown with no field saying what it did about it.
 */
function parseUnknownDispositions(
  record: Record<string, unknown>,
  context: ContextResult,
): readonly UnknownDisposition[] {
  const raw = record["unknown_disposition"] ?? [];
  if (!Array.isArray(raw)) {
    return fail("unknown_disposition must be an array when present");
  }
  const unknownIndices = new Set(
    context.elements.flatMap((element, index) =>
      element.provenance === "unknown" ? [index] : [],
    ),
  );
  const seen = new Set<number>();
  const entries = raw.map((value, index): UnknownDisposition => {
    const label = `unknown_disposition[${String(index)}]`;
    const entry = asRecord(CTX, value, label);
    const contextIndex = entry["context_index"];
    if (
      typeof contextIndex !== "number" ||
      !Number.isInteger(contextIndex) ||
      contextIndex < 0 ||
      contextIndex >= context.elements.length
    ) {
      throw new ArchitectureTraceabilityError(
        `${label}: context_index must be the "index" of a context element (0-${String(context.elements.length - 1)})`,
      );
    }
    if (!unknownIndices.has(contextIndex)) {
      throw new ArchitectureTraceabilityError(
        `${label}: context element ${String(contextIndex)} is not an unknown — list only elements whose provenance is "unknown"`,
      );
    }
    if (seen.has(contextIndex)) {
      throw new ArchitectureTraceabilityError(
        `${label}: context element ${String(contextIndex)} is disposed of twice`,
      );
    }
    seen.add(contextIndex);
    return {
      contextIndex,
      disposition: requireMember(
        CTX,
        entry,
        "disposition",
        UNKNOWN_DISPOSITIONS,
      ),
      statement: requireString(CTX, entry, "statement"),
    };
  });
  const undisposed = [...unknownIndices].filter((i) => !seen.has(i));
  if (undisposed.length > 0) {
    throw new ArchitectureTraceabilityError(
      `unknown_disposition leaves unknown context element(s) ${undisposed.map(String).join(", ")} undisposed — every unknown must be assumed, excluded or deferred, with a statement (D-38)`,
    );
  }
  return entries;
}

/**
 * `FR-023` trade-offs, parsed leniently and required selectively.
 *
 * An absent key yields an empty list rather than an error, and
 * `parseArchitecture` decides whether that is acceptable for the path in hand.
 * The requirement path is never asked for these, so absence there is correct.
 */
function parseTradeOffs(
  record: Record<string, unknown>,
): readonly AcceptedTradeOff[] {
  const raw = record["trade_offs"];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    return fail("trade_offs must be an array when present");
  }

  return raw.map((value, index) => {
    const label = `trade_offs[${String(index)}]`;
    const entry = asRecord(CTX, value, label);
    return {
      choice: requireString(CTX, entry, "choice"),
      accepted: requireString(CTX, entry, "accepted"),
    };
  });
}

/** `FR-023` / `AI-031` — what was considered and not taken, with the reason. */
function parseRejectedApproaches(
  record: Record<string, unknown>,
): readonly RejectedApproach[] {
  const raw = record["rejected_approaches"];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    return fail("rejected_approaches must be an array when present");
  }

  return raw.map((value, index) => {
    const label = `rejected_approaches[${String(index)}]`;
    const entry = asRecord(CTX, value, label);
    return {
      approach: requireString(CTX, entry, "approach"),
      rejectionReason: requireString(CTX, entry, "rejection_reason"),
    };
  });
}

export const ARCHITECTURE_STAGE = {
  stageNumber: STAGE_NUMBER,
  stageKey: STAGE_KEY,
} as const;
