/**
 * Stage 9 — Platform Recommendation, the requirement path's generator
 * ([D-78](../../../../docs/53-D-78-Unknown-Disposition-And-Platform-Recommendation.md)).
 *
 * `FR-034`: "recommend an execution platform, stating the criteria applied
 * and the alternatives rejected with reasons"; at least one rejected
 * alternative; "no platform — do not automate" permitted; no platform
 * favoured by default; no promotional language. `AI §9.1` Platform Comparison:
 * "criteria + ≥1 rejected alternative mandatory".
 *
 * What this parser makes checkable rather than hoped for:
 *
 *   · every criterion is traced to a context element that exists or a
 *     component the architecture has — a criterion traced to neither is one
 *     the model invented;
 *   · at least one alternative is rejected, and the recommended platform is
 *     not also among the rejected ones;
 *   · a null recommendation is accepted (it is a permitted outcome) — the
 *     rationale has to carry it, and the schema already requires one;
 *   · every architecture component has exactly one fit line, by name, and
 *     no fit line names a component the architecture does not have;
 *   · the knowledge-currency note is present (`FR-035`: uncertainty about a
 *     platform's current capability is disclosed).
 *
 * Neutrality (`PV §3.3`, `AC-032`) is enforced by absence: the contract has
 * no field a preference, partner tier or ranking weight could occupy. The
 * fragment forbids promotional language; a parser cannot judge prose and does
 * not pretend to.
 */

import {
  StageError,
  type ArchitectureResult,
  type ContextResult,
  type PlatformRecommendation,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 9;
const STAGE_KEY = "platform_recommendation";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

export class PlatformGroundingError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "PlatformGroundingError";
  }
}

const nullableString = (
  record: Record<string, unknown>,
  key: string,
  where: string,
): string | null => {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim() === "") {
    return fail(`${where}: ${key} must be a non-empty string or null`);
  }
  return value.trim();
};

export function parsePlatformRecommendation(
  responseText: string,
  architecture: ArchitectureResult,
  context: ContextResult,
): PlatformRecommendation {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);
  const componentNames = new Set(architecture.components.map((c) => c.name));
  const elementCount = context.elements.length;

  const criteria = requireArray(CTX, record, "criteria_applied").map(
    (value, index) => {
      const where = `criteria_applied[${String(index)}]`;
      const entry = asRecord(CTX, value, where);
      const criterion = requireString(CTX, entry, "criterion");
      const rawIndex = entry["context_index"];
      const contextIndex =
        rawIndex === null || rawIndex === undefined
          ? null
          : typeof rawIndex === "number" && Number.isInteger(rawIndex)
            ? rawIndex
            : fail(`${where}: context_index must be an integer or null`);
      const component = nullableString(entry, "component", where);
      if (contextIndex === null && component === null) {
        throw new PlatformGroundingError(
          `${where}: "${criterion}" is traced to neither a context element nor a component — a criterion the context does not support was invented`,
        );
      }
      if (
        contextIndex !== null &&
        (contextIndex < 0 || contextIndex >= elementCount)
      ) {
        throw new PlatformGroundingError(
          `${where}: context_index ${String(contextIndex)} is out of range; the context set has ${String(elementCount)} element(s) with indices 0-${String(elementCount - 1)}`,
        );
      }
      if (component !== null && !componentNames.has(component)) {
        throw new PlatformGroundingError(
          `${where}: component "${component}" is not one the architecture has`,
        );
      }
      return {
        criterion,
        contextIndex,
        component,
      };
    },
  );
  if (criteria.length === 0) {
    fail(
      "criteria_applied is empty — FR-034 requires the criteria to be stated",
    );
  }

  const recommendedPlatform = nullableString(
    record,
    "recommended_platform",
    "recommended_platform",
  );

  const alsoRequired = requireArray(CTX, record, "also_required").map(
    (value, index) => {
      const where = `also_required[${String(index)}]`;
      const entry = asRecord(CTX, value, where);
      return {
        platform: requireString(CTX, entry, "platform"),
        role: requireString(CTX, entry, "role"),
      };
    },
  );
  if (recommendedPlatform === null && alsoRequired.length > 0) {
    fail(
      "also_required must be empty when no platform is recommended — there is nothing for another platform to accompany",
    );
  }

  const alternatives = requireArray(CTX, record, "alternatives_rejected").map(
    (value, index) => {
      const where = `alternatives_rejected[${String(index)}]`;
      const entry = asRecord(CTX, value, where);
      return {
        platform: requireString(CTX, entry, "platform"),
        rejectionReason: requireString(CTX, entry, "rejection_reason"),
      };
    },
  );
  if (alternatives.length === 0) {
    fail(
      "alternatives_rejected is empty — FR-034 requires at least one rejected alternative with its reason",
    );
  }
  const norm = (s: string): string => s.trim().toLowerCase();
  if (
    recommendedPlatform !== null &&
    alternatives.some((a) => norm(a.platform) === norm(recommendedPlatform))
  ) {
    fail(
      `"${recommendedPlatform}" is both recommended and rejected — a recommendation cannot reject itself`,
    );
  }

  const fit = requireArray(CTX, record, "fit").map((value, index) => {
    const where = `fit[${String(index)}]`;
    const entry = asRecord(CTX, value, where);
    const component = requireString(CTX, entry, "component");
    if (!componentNames.has(component)) {
      throw new PlatformGroundingError(
        `${where}: component "${component}" is not one the architecture has`,
      );
    }
    return { component, how: requireString(CTX, entry, "how") };
  });
  const covered = new Set(fit.map((f) => f.component));
  for (const name of componentNames) {
    if (!covered.has(name)) {
      throw new PlatformGroundingError(
        `fit does not cover component "${name}" — every component must say how the recommendation covers it`,
      );
    }
  }
  if (covered.size !== fit.length) {
    fail("fit names a component more than once");
  }

  return {
    criteriaApplied: criteria,
    recommendedPlatform,
    alsoRequired,
    rationale: requireString(CTX, record, "rationale"),
    alternativesRejected: alternatives,
    fit,
    knowledgeCurrencyNote: requireString(
      CTX,
      record,
      "knowledge_currency_note",
    ),
  };
}
