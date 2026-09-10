/**
 * Stage 9 — `portfolio_suggestions` generator, job-description path
 * (`FR-022`, `AI` App. A).
 *
 * Turns the decisive technical gaps Stage 7 found into the smallest practical
 * set of buildable projects. Model-assisted, because grouping gaps into a
 * coherent system, framing a business problem and sequencing work are
 * judgement — and schema-constrained, because judgement unchecked is how a
 * recommendation engine starts inventing work.
 *
 * THE SAME THREE REFUSALS AS STAGE 7, ONE LEVEL UP.
 *
 *   1. **Grounding.** Every project cites gap ids that were *reported*, are
 *      *technical*, and were *decisive*. A project justified by an invented
 *      gap is work the posting never asked for — the failure `docs/12` D-27
 *      named and D-28 narrowed.
 *   2. **Exhaustiveness.** Every eligible gap must be claimed by some project.
 *      D-28 fixed requirements vanishing between `matched` and `gaps`; the
 *      same bug one level up would silently drop a gap the operator was told
 *      was decisive.
 *   3. **Closed vocabularies.** Complexity, effort and evidence type come from
 *      fixed sets, so the output is comparable across runs.
 *
 * AND TWO THAT ARE NEW, BOTH ABOUT CONSOLIDATION. A model asked for projects
 * will happily return one per gap; that is the naive generator this stage
 * exists to not be. So a project whose gap set is a *subset* of another's is
 * rejected outright — it closes strictly less and adds nothing — and a project
 * claiming a single gap must say why it cannot fold into another. Neither rule
 * caps the project count, which would be arbitrary: they make redundancy
 * impossible and fragmentation expensive, and let the reasoning decide the
 * number.
 *
 * EVIDENCE IS PART OF THE SPECIFICATION, not an afterthought. At least one
 * evidence item per project, from a vocabulary compatible with
 * `capability-profile.ts`. The loop this closes is build → ship → document →
 * record → `profile.yaml`, and a project that leaves nothing citable leaves
 * the inventory exactly where it was.
 *
 * No provider, no database, no filesystem: parsing and verification only.
 */

import {
  StageError,
  BUILD_EFFORT,
  PORTFOLIO_COMPLEXITY,
  PORTFOLIO_EVIDENCE_TYPES,
  type GapItem,
  type PortfolioEvidence,
  type PortfolioProject,
  type PortfolioSuggestions,
  type ReusabilityClaim,
  type PortfolioImplementation,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireMember,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 9;
const STAGE_KEY = "portfolio_suggestions";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

/**
 * A project that cannot be traced to the gaps it claims to close, or a set
 * that leaves an eligible gap unclaimed.
 *
 * Distinct from `StageError` for the reason `RecommendationGroundingError` is:
 * it is the class of failure worth one regeneration, because a model that
 * mis-cited once may cite correctly when shown the constraint again.
 */
export class PortfolioGroundingError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "PortfolioGroundingError";
  }
}

const requireStringList = (
  record: Record<string, unknown>,
  key: string,
  where: string,
): readonly string[] => {
  const raw = requireArray(CTX, record, key);
  const out = raw.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      return fail(
        `${where}: ${key}[${String(index)}] must be a non-empty string`,
      );
    }
    return entry.trim();
  });
  if (out.length === 0) fail(`${where}: ${key} must not be empty`);
  return out;
};

function parseEvidence(
  value: unknown,
  index: number,
  where: string,
): PortfolioEvidence {
  const label = `${where}.evidence_to_produce[${String(index)}]`;
  const record = asRecord(CTX, value, label);
  return {
    type: requireMember(CTX, record, "type", PORTFOLIO_EVIDENCE_TYPES),
    whatItShows: requireString(CTX, record, "what_it_shows"),
  };
}

function parseReusability(value: unknown, where: string): ReusabilityClaim {
  const label = `${where}.reusability`;
  const record = asRecord(CTX, value, label);
  // Fixed, not read: the system holds one posting and models no market, so a
  // reusability claim can only ever be an inference (`docs/12` D-29). Reading
  // it from the response would let the model promote its own guess to fact.
  requireMember(CTX, record, "provenance", ["inferred"] as const);
  return {
    provenance: "inferred",
    basis: requireString(CTX, record, "basis"),
    claim: requireString(CTX, record, "claim"),
  };
}

function parseProject(
  value: unknown,
  index: number,
  eligibleIds: ReadonlySet<string>,
): PortfolioProject {
  const where = `projects[${String(index)}]`;
  const record = asRecord(CTX, value, where);

  const rawRank = record["rank"];
  if (
    typeof rawRank !== "number" ||
    !Number.isInteger(rawRank) ||
    rawRank < 1
  ) {
    return fail(`${where}: rank must be a positive integer`);
  }
  const rank: number = rawRank;

  const primaryGaps = requireStringList(record, "primary_gaps", where);
  for (const gapId of primaryGaps) {
    if (!eligibleIds.has(gapId)) {
      throw new PortfolioGroundingError(
        `${where} claims gap ${JSON.stringify(gapId)}, which is not one of the ` +
          `decisive technical gaps this analysis found. A project justified by a gap ` +
          `nobody reported is work the posting never asked for. Eligible: ` +
          `${[...eligibleIds].join(", ")}`,
      );
    }
  }
  const unique = new Set(primaryGaps);
  if (unique.size !== primaryGaps.length) {
    fail(`${where}: primary_gaps contains a duplicate id`);
  }

  const evidenceRaw = requireArray(CTX, record, "evidence_to_produce");
  if (evidenceRaw.length === 0) {
    fail(
      `${where}: at least one evidence item is required — a project that leaves ` +
        `nothing a reader could open closes no gap, because nothing can be cited ` +
        `in the capability profile afterwards`,
    );
  }

  const whyNotConsolidated = record["why_not_consolidated"];
  if (primaryGaps.length === 1) {
    if (
      typeof whyNotConsolidated !== "string" ||
      whyNotConsolidated.trim() === ""
    ) {
      fail(
        `${where}: a project addressing a single gap must supply ` +
          `why_not_consolidated — one project per gap is the naive answer, and the ` +
          `reason it cannot fold into another has to be stated`,
      );
    }
  }

  const workflow = requireStringList(record, "workflow", where);

  return {
    rank,
    name: requireString(CTX, record, "name"),
    complexity: requireMember(CTX, record, "complexity", PORTFOLIO_COMPLEXITY),
    primaryGaps,
    secondaryCapabilities: requireStringList(
      record,
      "secondary_capabilities",
      where,
    ),
    whyThisProject: requireString(CTX, record, "why_this_project"),
    businessProblem: requireString(CTX, record, "business_problem"),
    whatToBuild: requireString(CTX, record, "what_to_build"),
    workflow,
    platforms: requireStringList(record, "platforms", where),
    technicalConcepts: requireStringList(record, "technical_concepts", where),
    evidenceToProduce: evidenceRaw.map((entry, i) =>
      parseEvidence(entry, i, where),
    ),
    ...(typeof whyNotConsolidated === "string" &&
    whyNotConsolidated.trim() !== ""
      ? { whyNotConsolidated: whyNotConsolidated.trim() }
      : {}),
    reusability: parseReusability(record["reusability"], where),
    estimatedEffort: requireMember(
      CTX,
      record,
      "estimated_effort",
      BUILD_EFFORT,
    ),
    portfolioValue: requireString(CTX, record, "portfolio_value"),
    ...parseImplementation(record["implementation"], where, workflow.length),
  };
}

/**
 * D-70 — optional. Absent or null means the project is not an automation
 * workflow. Present means every step is checked: a real index into the
 * workflow list is required because a node that points at no step is an
 * instruction nobody can place.
 */
function parseImplementation(
  raw: unknown,
  where: string,
  /** The project's workflow length: every step index must fall inside it. */
  workflowLength: number,
): { implementation?: PortfolioImplementation } {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    fail(`${where}.implementation must be an object when present`);
  }
  const record = raw as Record<string, unknown>;
  const label = `${where}.implementation`;
  const platform = requireString(CTX, record, "platform");
  const stepsRaw = requireArray(CTX, record, "steps");
  if (stepsRaw.length === 0) fail(`${label}.steps must not be empty`);
  const steps = stepsRaw.map((entry, i) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      fail(`${label}.steps[${String(i)}] must be an object`);
    }
    const step = entry as Record<string, unknown>;
    const rawIndex = step["step"];
    const index =
      typeof rawIndex === "number" &&
      Number.isInteger(rawIndex) &&
      rawIndex >= 1
        ? rawIndex
        : fail(`${label}.steps[${String(i)}].step must be a positive integer`);
    // The contract Stage 10's reference_integrity re-checks (D-70): a step
    // index outside the workflow is an instruction nobody can place. Refused
    // here so the failure is the artifact's — one FR-039 regeneration with
    // this reason — rather than the run's at Stage 10, which a jd-002
    // capture on 2026-09-10 turned into a whole-analysis failure.
    if (index > workflowLength) {
      fail(
        `${label}.steps[${String(i)}].step is ${String(index)}, but the workflow has ${String(workflowLength)} step(s): step indices run from 1 to ${String(workflowLength)}, one per workflow step; what follows the steps belongs in notes`,
      );
    }
    const credential = step["credential"];
    if (credential !== null && typeof credential !== "string") {
      fail(`${label}.steps[${String(i)}].credential must be a string or null`);
    }
    return {
      step: index,
      node: requireString(CTX, step, "node"),
      purpose: requireString(CTX, step, "purpose"),
      setup: requireStringList(step, "setup", `${label}.steps[${String(i)}]`),
      credential:
        typeof credential === "string" && credential.trim() !== ""
          ? credential.trim()
          : null,
    };
  });
  const notesRaw = record["notes"];
  const notes = Array.isArray(notesRaw)
    ? notesRaw.filter(
        (n): n is string => typeof n === "string" && n.trim() !== "",
      )
    : [];
  return { implementation: { platform, steps, notes } };
}

/**
 * Parses and structurally verifies a Stage 9 response against the gaps it is
 * allowed to build for.
 *
 * @throws PortfolioGroundingError when a project cites a gap it may not, or
 * when an eligible gap is left unclaimed.
 * @throws StageError for everything else.
 */
export function parsePortfolioSuggestions(
  responseText: string,
  eligible: readonly GapItem[],
): PortfolioSuggestions {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);
  const eligibleIds = new Set(eligible.map((g) => g.requirementId));

  if (eligibleIds.size === 0) {
    return fail(
      "no decisive technical gap is eligible, so no project can be grounded — " +
        "Stage 8 should not have planned this artifact",
    );
  }

  const projects = requireArray(CTX, record, "projects").map((entry, index) =>
    parseProject(entry, index, eligibleIds),
  );
  if (projects.length === 0) {
    return fail(
      "projects is empty — the verdict was build_first, so at least one project " +
        "must say what to build",
    );
  }

  // Coverage. The D-28 move, one level up: a gap the operator was told was
  // decisive, then dropped without a project, is worse than one never named.
  const claimed = new Set(projects.flatMap((p) => p.primaryGaps));
  const unclaimed = [...eligibleIds].filter((id) => !claimed.has(id));
  if (unclaimed.length > 0) {
    throw new PortfolioGroundingError(
      `every decisive technical gap must be addressed by at least one project; ` +
        `${String(unclaimed.length)} left unclaimed: ${unclaimed.join(", ")}`,
    );
  }

  // Redundancy. A project whose gaps are contained in another's closes
  // strictly less and adds nothing, so it is only ever extra work.
  for (const [i, a] of projects.entries()) {
    for (const [j, b] of projects.entries()) {
      if (i === j) continue;
      const aSet = new Set(a.primaryGaps);
      const bSet = new Set(b.primaryGaps);
      const subset = [...aSet].every((id) => bSet.has(id));
      if (subset && aSet.size <= bSet.size) {
        fail(
          `projects[${String(i)}] ("${a.name}") addresses ${aSet.size === bSet.size ? "the same" : "a subset of the"} ` +
            `gaps as projects[${String(j)}] ("${b.name}") — it would close nothing the ` +
            `other does not, so it is redundant. Consolidate them or give one a gap the other lacks.`,
        );
      }
    }
  }

  // Rank is a total order. "Build this first" has to mean one project.
  const ranks = projects.map((p) => p.rank).sort((x, y) => x - y);
  const expected = projects.map((_, i) => i + 1);
  if (JSON.stringify(ranks) !== JSON.stringify(expected)) {
    fail(
      `rank must be a total order 1..${String(projects.length)} with no gaps or ties; found ` +
        `[${ranks.join(", ")}]`,
    );
  }

  return {
    projects: [...projects].sort((a, b) => a.rank - b.rank),
    consolidationRationale: requireString(
      CTX,
      record,
      "consolidation_rationale",
    ),
  };
}

export const PORTFOLIO_SUGGESTIONS_STAGE = {
  stageNumber: STAGE_NUMBER,
  stageKey: STAGE_KEY,
} as const;
