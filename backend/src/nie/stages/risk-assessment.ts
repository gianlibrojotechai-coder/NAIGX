/**
 * Stage 9 — Risk Assessment, the requirement path's second generator
 * ([D-79](../../../../docs/54-D-79-Requirement-Risk-Register.md)).
 *
 * `FR-032`: "a risk register with severity, likelihood, affected component,
 * and mitigation"; every risk names the component or integration it affects;
 * the scales are `docs/09` §2 (`risk-v1`); every risk carries a concrete
 * mitigation; generic risks are a defect.
 *
 * The workflow path *renders* this artifact from Stage 6W's findings
 * (`derived-artifacts.ts`), because a review already is a risk analysis. The
 * requirement path has no findings — it has a design — so the register is
 * generated, against the same published schema, and this parser checks what
 * the schema cannot: that every `component` is one the architecture has, or an
 * external system one of its components names. A risk against a component
 * the design does not have is the generic risk `FR-032` calls a defect.
 */

import {
  StageError,
  type ArchitectureResult,
  type RiskRegister,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireNumber,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 9;
const STAGE_KEY = "risk_assessment";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

export class RiskGroundingError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "RiskGroundingError";
  }
}

const scale = (
  record: Record<string, unknown>,
  key: string,
  where: string,
): number => {
  const value = requireNumber(CTX, record, key);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return fail(
      `${where}: ${key} must be an integer from 1 to 5 (docs/09 §2, risk-v1)`,
    );
  }
  return value;
};

/**
 * Whether a risk's `component` names one of the design's components or
 * external systems. Exact first; otherwise a tolerant match that strips a
 * parenthetical and case, so "Broker" is accepted for "Broker (via email)"
 * and "Sheets" for "Google Workspace (Sheets)" — the model shortening a name
 * it was told to copy is a naming near-miss, not a risk against something the
 * design does not have. Anything that matches nothing is still refused.
 */
export const namesDesignPart = (
  component: string,
  architecture: ArchitectureResult,
): boolean => {
  const norm = (s: string): string =>
    s.replace(/(.*?)/g, " ").replace(/s+/g, " ").trim().toLowerCase();
  const candidates: string[] = [];
  for (const c of architecture.components) {
    candidates.push(c.name);
    if (c.externalSystem !== undefined) candidates.push(c.externalSystem);
  }
  if (candidates.includes(component)) return true;
  const wanted = norm(component);
  if (wanted.length < 3) return false;
  return candidates.some((name) => {
    const have = norm(name);
    if (have === wanted) return true;
    const inner = name.match(/(([^)]+))/)?.[1];
    return (
      (inner !== undefined && norm(inner) === wanted) ||
      (wanted.length >= 4 && have.includes(wanted)) ||
      (have.length >= 4 && wanted.includes(have))
    );
  });
};

export function parseRiskRegister(
  responseText: string,
  architecture: ArchitectureResult,
): RiskRegister {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);
  const risks = requireArray(CTX, record, "risks").map((value, index) => {
    const where = `risks[${String(index)}]`;
    const entry = asRecord(CTX, value, where);
    const component = requireString(CTX, entry, "component");
    if (!namesDesignPart(component, architecture)) {
      throw new RiskGroundingError(
        `${where}: "${component}" is neither a component of the architecture nor an external system one of its components names — a risk against something the design does not have is not specific to the design (FR-032)`,
      );
    }
    return {
      component,
      description: requireString(CTX, entry, "description"),
      severity: scale(entry, "severity", where),
      likelihood: scale(entry, "likelihood", where),
      mitigation: requireString(CTX, entry, "mitigation"),
    };
  });

  const statement = record["no_risks_statement"];
  if (risks.length === 0) {
    if (typeof statement !== "string" || statement.trim() === "") {
      fail(
        "risks is empty and no_risks_statement is absent — a design with no risk must say why (FR-032)",
      );
    }
  } else if (statement !== null && statement !== undefined) {
    fail("no_risks_statement must be null when risks are listed");
  }

  return {
    risks: [...risks].sort(
      (a, b) => b.severity * b.likelihood - a.severity * a.likelihood,
    ),
    ...(risks.length === 0
      ? { noRisksStatement: (statement as string).trim() }
      : {}),
  };
}
