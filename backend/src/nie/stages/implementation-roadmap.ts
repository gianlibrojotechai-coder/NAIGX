/**
 * Stage 9 — Implementation Roadmap, the requirement path's fourth generator
 * ([D-82](../../../../docs/57-D-82-Implementation-Roadmap.md)).
 *
 * `FR-036`: "sequenced implementation phases with dependencies and per-phase
 * outcomes" — phases ordered with explicit dependencies; each phase states
 * what exists at its completion; phases reference components defined in the
 * architecture; no calendar estimates unless the input supplied a basis.
 *
 * The generator sequences; this parser checks what the schema cannot:
 *
 *   · phases are numbered 1..n in the order given, and a dependency names an
 *     EARLIER phase — a roadmap with a cycle, or a phase that depends on one
 *     not yet built, is not a sequence;
 *   · every component a phase builds is one the architecture has (the same
 *     tolerant match the risk register uses for a naming near-miss), and
 *     every component of the architecture is built by some phase — a roadmap
 *     that never builds part of the design leaves the design unbuilt at the
 *     end of its last phase;
 *   · an estimate, when given, cites the context element it rests on, so a
 *     calendar figure the input did not supply a basis for is refused rather
 *     than presented.
 */

import {
  StageError,
  type ArchitectureResult,
  type ContextResult,
  type ImplementationRoadmap,
  type RoadmapPhase,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireNumber,
  requireString,
} from "../parse.js";
import { namesDesignPart } from "./risk-assessment.js";

const STAGE_NUMBER = 9;
const STAGE_KEY = "implementation_roadmap";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

export class RoadmapGroundingError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "RoadmapGroundingError";
  }
}

/** Whether a phase's component name refers to this one architecture component. */
const namesComponent = (
  name: string,
  component: ArchitectureResult["components"][number],
): boolean =>
  namesDesignPart(name, {
    summary: "",
    dataFlowDescription: "",
    unknownDispositions: [],
    components: [component],
  });

/**
 * The components of the architecture no phase builds. Shared with Stage 10's
 * consistency check so the parser and the validator cannot disagree.
 */
export const unbuiltComponents = (
  phaseComponents: readonly string[],
  architecture: ArchitectureResult,
): readonly string[] =>
  architecture.components
    .filter((c) => !phaseComponents.some((name) => namesComponent(name, c)))
    .map((c) => c.name);

export function parseImplementationRoadmap(
  responseText: string,
  architecture: ArchitectureResult,
  context: ContextResult,
): ImplementationRoadmap {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);
  const raw = requireArray(CTX, record, "phases");
  if (raw.length === 0) {
    fail("phases is empty — a roadmap has at least one phase (FR-036)");
  }

  const phases: RoadmapPhase[] = raw.map((value, index) => {
    const where = `phases[${String(index)}]`;
    const entry = asRecord(CTX, value, where);

    const ordinal = requireNumber(CTX, entry, "ordinal");
    if (ordinal !== index + 1) {
      fail(
        `${where}: ordinal ${String(ordinal)} — phases are numbered 1 to n in the order they are given (FR-036)`,
      );
    }

    const components = requireArray(CTX, entry, "components").map((c, i) => {
      if (typeof c !== "string" || c.trim() === "") {
        return fail(
          `${where}.components[${String(i)}]: must be the name of an architecture component`,
        );
      }
      return c;
    });
    if (components.length === 0) {
      fail(
        `${where}: names no component — a phase that builds nothing of the design is not a phase of its implementation (FR-036)`,
      );
    }
    for (const c of components) {
      if (!namesDesignPart(c, architecture)) {
        throw new RoadmapGroundingError(
          `${where}: "${c}" is not a component of the architecture — a phase that builds something the design does not have is not a phase of this design (FR-036)`,
        );
      }
    }

    const seen = new Set<number>();
    const dependsOn = requireArray(CTX, entry, "depends_on").map((d, i) => {
      if (typeof d !== "number" || !Number.isInteger(d)) {
        return fail(
          `${where}.depends_on[${String(i)}]: must be the ordinal of an earlier phase`,
        );
      }
      if (d < 1 || d >= ordinal) {
        return fail(
          `${where}: depends_on ${String(d)} — a phase may depend only on an earlier phase, so the sequence stays a sequence (FR-036)`,
        );
      }
      if (seen.has(d)) {
        return fail(`${where}: depends_on lists phase ${String(d)} twice`);
      }
      seen.add(d);
      return d;
    });

    const estimateRaw = entry["estimate"];
    let estimate: RoadmapPhase["estimate"];
    if (estimateRaw !== null && estimateRaw !== undefined) {
      const e = asRecord(CTX, estimateRaw, `${where}.estimate`);
      const basis = requireNumber(CTX, e, "basis_context_index");
      if (
        !Number.isInteger(basis) ||
        basis < 0 ||
        basis >= context.elements.length
      ) {
        fail(
          `${where}.estimate: basis_context_index ${String(basis)} resolves to no context element — a calendar estimate is given only when the input supplied a basis for it (FR-036)`,
        );
      }
      estimate = {
        duration: requireString(CTX, e, "duration"),
        basisContextIndex: basis,
      };
    }

    return {
      ordinal,
      name: requireString(CTX, entry, "name"),
      objective: requireString(CTX, entry, "objective"),
      components,
      dependsOn,
      outcome: requireString(CTX, entry, "outcome"),
      ...(estimate !== undefined ? { estimate } : {}),
    };
  });

  const unbuilt = unbuiltComponents(
    phases.flatMap((p) => p.components),
    architecture,
  );
  if (unbuilt.length > 0) {
    throw new RoadmapGroundingError(
      `the roadmap never builds ${unbuilt.map((n) => `"${n}"`).join(", ")} — every component of the design exists at the end of some phase, or the design is not what the roadmap delivers (FR-036)`,
    );
  }

  return {
    phases,
    sequencingRationale: requireString(CTX, record, "sequencing_rationale"),
  };
}
