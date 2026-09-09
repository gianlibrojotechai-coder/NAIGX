/**
 * Stage 9 — Edge Cases and Practices, the requirement path's fifth generator
 * ([D-83](../../../../docs/58-D-83-Edge-Cases-And-Practices.md)).
 *
 * `FR-037`: "edge cases and applicable practices specific to the generated
 * design" — each edge case describes a concrete scenario and its consequence;
 * practices reference the specific component or decision they apply to;
 * generic advice not tied to the submitted design is a defect.
 *
 * The parser checks what the schema cannot: every edge case names the
 * component (or external system) of the design it arises in, and every
 * practice names the component it applies to — with the risk register's
 * tolerant match, so a naming near-miss is accepted and an invented part is
 * not. A scenario against nothing the design has is the generic advice
 * `FR-037` calls a defect.
 */

import {
  StageError,
  type ArchitectureResult,
  type EdgeCaseAnalysis,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireString,
} from "../parse.js";
import { namesDesignPart } from "./risk-assessment.js";

const STAGE_NUMBER = 9;
const STAGE_KEY = "edge_case_analysis";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

export class EdgeCaseGroundingError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "EdgeCaseGroundingError";
  }
}

export function parseEdgeCaseAnalysis(
  responseText: string,
  architecture: ArchitectureResult,
): EdgeCaseAnalysis {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);

  const edgeCases = requireArray(CTX, record, "edge_cases").map(
    (value, index) => {
      const where = `edge_cases[${String(index)}]`;
      const entry = asRecord(CTX, value, where);
      const component = requireString(CTX, entry, "component");
      if (!namesDesignPart(component, architecture)) {
        throw new EdgeCaseGroundingError(
          `${where}: "${component}" is neither a component of the architecture nor an external system one of its components names — an edge case in something the design does not have is not specific to the design (FR-037)`,
        );
      }
      return {
        component,
        scenario: requireString(CTX, entry, "scenario"),
        consequence: requireString(CTX, entry, "consequence"),
        handling: requireString(CTX, entry, "handling"),
      };
    },
  );
  if (edgeCases.length === 0) {
    fail(
      "edge_cases is empty — every design has at least one boundary condition worth stating (FR-037)",
    );
  }

  const practices = requireArray(CTX, record, "practices").map(
    (value, index) => {
      const where = `practices[${String(index)}]`;
      const entry = asRecord(CTX, value, where);
      const appliesTo = requireString(CTX, entry, "applies_to");
      if (!namesDesignPart(appliesTo, architecture)) {
        throw new EdgeCaseGroundingError(
          `${where}: applies to "${appliesTo}", which the architecture neither has nor integrates — a practice not tied to a part of the submitted design is generic advice (FR-037)`,
        );
      }
      return {
        appliesTo,
        practice: requireString(CTX, entry, "practice"),
        rationale: requireString(CTX, entry, "rationale"),
      };
    },
  );

  return { edgeCases, practices };
}
