/**
 * Stage 9 — Integration Requirements, the requirement path's sixth generator
 * ([D-84](../../../../docs/59-D-84-Integration-Requirements.md)).
 *
 * `FR-035`: "the required integrations and the API capabilities each
 * demands" — each integration names the system, purpose and direction;
 * known constraints (rate limits, auth model, pagination) are stated where
 * applicable, labelled by provenance; uncertainty about a platform's current
 * capability is disclosed rather than asserted.
 *
 * The parser checks what the schema cannot:
 *
 *   · every integration names an external system a component of the
 *     architecture integrates, and the component that integrates it
 *     (tolerant match, as the register uses); an integration with a system
 *     the design does not name is not a requirement of this design;
 *   · every external system the architecture names is covered — a design's
 *     integration requirements that omit one of its integrations are
 *     incomplete;
 *   · the direction agrees with the component's stated direction when the
 *     component states one;
 *   · a constraint labelled `stated` cites the context element it came from;
 *     one labelled `general_knowledge` is what the knowledge-currency note
 *     covers (`O-4`) — that note is always required, as it is for the
 *     platform recommendation;
 *   · a design with no external system says so, and only then.
 */

import {
  StageError,
  INTEGRATION_DIRECTIONS,
  CONSTRAINT_PROVENANCES,
  type ArchitectureResult,
  type ContextResult,
  type IntegrationRequirements,
  type IntegrationRequirement,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireMember,
  requireNumber,
  requireString,
} from "../parse.js";
import { namesDesignPart } from "./risk-assessment.js";

const STAGE_NUMBER = 9;
const STAGE_KEY = "integration_requirements";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

export class IntegrationGroundingError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "IntegrationGroundingError";
  }
}

type Component = ArchitectureResult["components"][number];

const only = (component: Component): ArchitectureResult => ({
  summary: "",
  dataFlowDescription: "",
  unknownDispositions: [],
  components: [component],
});

/** The architecture components that name an external system. */
export const integratingComponents = (
  architecture: ArchitectureResult,
): readonly Component[] =>
  architecture.components.filter((c) => c.externalSystem !== undefined);

/**
 * The component whose external system `system` names, integrated by
 * `component` — or null when the pair matches nothing the design has.
 */
export const integrationOf = (
  system: string,
  component: string,
  architecture: ArchitectureResult,
): Component | null => {
  // The component is matched against component NAMES only and the system
  // against external systems only. Matching the component against the whole
  // part (name or system) let "Xero Sync" resolve to "Duplicate Check",
  // whose external system is "Xero" — found by the first campaign (D-84 §4).
  const bare = (c: Component): Component => {
    const { externalSystem: _e, integrationDirection: _d, ...rest } = c;
    return rest;
  };
  const asSystem = (c: Component): Component => ({
    ...bare(c),
    name: c.externalSystem ?? "",
  });
  const candidates = integratingComponents(architecture).filter(
    (c) =>
      namesDesignPart(component, only(bare(c))) &&
      (c.externalSystem === system ||
        namesDesignPart(system, only(asSystem(c)))),
  );
  return (
    candidates.find((c) => c.name === component) ??
    candidates.find((c) => c.externalSystem === system) ??
    candidates[0] ??
    null
  );
};

/**
 * The external systems the architecture names that no listed integration
 * covers. Shared with Stage 10 so the parser and the validator agree.
 */
export const uncoveredSystems = (
  integrations: readonly { system: string; component: string }[],
  architecture: ArchitectureResult,
): readonly string[] =>
  integratingComponents(architecture)
    .filter(
      (c) =>
        !integrations.some(
          (i) => integrationOf(i.system, i.component, architecture) === c,
        ),
    )
    .map((c) => `${c.externalSystem ?? ""} (via ${c.name})`);

export function parseIntegrationRequirements(
  responseText: string,
  architecture: ArchitectureResult,
  context: ContextResult,
): IntegrationRequirements {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);

  const integrations: IntegrationRequirement[] = requireArray(
    CTX,
    record,
    "integrations",
  ).map((value, index) => {
    const where = `integrations[${String(index)}]`;
    const entry = asRecord(CTX, value, where);
    const system = requireString(CTX, entry, "system");
    const component = requireString(CTX, entry, "component");
    const integrating = integrationOf(system, component, architecture);
    if (integrating === null) {
      throw new IntegrationGroundingError(
        `${where}: "${system}" via "${component}" is not an integration the architecture names — a requirement for a system the design does not integrate is not a requirement of this design (FR-035)`,
      );
    }
    const direction = requireMember(
      CTX,
      entry,
      "direction",
      INTEGRATION_DIRECTIONS,
    );
    // The architecture parser accepts the direction as free text; the
    // agreement check applies only when the component states one of the
    // three the schema names.
    if (
      integrating.integrationDirection !== undefined &&
      (INTEGRATION_DIRECTIONS as readonly string[]).includes(
        integrating.integrationDirection,
      ) &&
      integrating.integrationDirection !== direction
    ) {
      fail(
        `${where}: direction ${direction} contradicts the architecture, which has "${integrating.name}" integrating ${integrating.integrationDirection}`,
      );
    }
    const capabilities = requireArray(CTX, entry, "capabilities_required").map(
      (c, i) => {
        if (typeof c !== "string" || c.trim() === "") {
          return fail(
            `${where}.capabilities_required[${String(i)}]: must name an API capability`,
          );
        }
        return c;
      },
    );
    if (capabilities.length === 0) {
      fail(
        `${where}: names no required capability — an integration demands at least one thing of the system's API (FR-035)`,
      );
    }
    const constraints = requireArray(CTX, entry, "constraints").map((c, i) => {
      const cw = `${where}.constraints[${String(i)}]`;
      const cr = asRecord(CTX, c, cw);
      const provenance = requireMember(
        CTX,
        cr,
        "provenance",
        CONSTRAINT_PROVENANCES,
      );
      const rawIndex = cr["context_index"];
      if (provenance === "stated") {
        if (rawIndex === null || rawIndex === undefined) {
          fail(
            `${cw}: labelled stated but cites no context_index — a constraint the context stated points at the element that stated it; one it did not is general_knowledge (FR-035)`,
          );
        }
        const contextIndex = requireNumber(CTX, cr, "context_index");
        if (
          !Number.isInteger(contextIndex) ||
          contextIndex < 0 ||
          contextIndex >= context.elements.length
        ) {
          fail(
            `${cw}: context_index ${String(contextIndex)} resolves to no context element — a constraint labelled stated cites where it was stated (FR-035)`,
          );
        }
        return {
          constraint: requireString(CTX, cr, "constraint"),
          provenance,
          contextIndex,
        };
      }
      if (rawIndex !== null && rawIndex !== undefined) {
        fail(
          `${cw}: context_index is given for a constraint labelled ${provenance} — only a stated constraint cites the context`,
        );
      }
      return { constraint: requireString(CTX, cr, "constraint"), provenance };
    });
    const uncertainties = requireArray(CTX, entry, "uncertainties").map(
      (u, i) => {
        if (typeof u !== "string" || u.trim() === "") {
          return fail(
            `${where}.uncertainties[${String(i)}]: must state what is uncertain`,
          );
        }
        return u;
      },
    );
    return {
      system,
      component: integrating.name,
      purpose: requireString(CTX, entry, "purpose"),
      direction,
      capabilitiesRequired: capabilities,
      constraints,
      uncertainties,
    };
  });

  const uncovered = uncoveredSystems(integrations, architecture);
  if (uncovered.length > 0) {
    throw new IntegrationGroundingError(
      `the architecture integrates ${uncovered.map((s) => `"${s}"`).join(", ")} and no integration covers it — a design's integration requirements name every system it touches (FR-035)`,
    );
  }

  const statement = record["no_integrations_statement"];
  if (integrations.length === 0) {
    if (typeof statement !== "string" || statement.trim() === "") {
      fail(
        "integrations is empty and no_integrations_statement is absent — a design with no external system must say so (FR-035)",
      );
    }
  } else if (statement !== null && statement !== undefined) {
    fail("no_integrations_statement must be null when integrations are listed");
  }

  return {
    integrations,
    ...(integrations.length === 0
      ? { noIntegrationsStatement: (statement as string).trim() }
      : {}),
    knowledgeCurrencyNote: requireString(
      CTX,
      record,
      "knowledge_currency_note",
    ),
  };
}
