/**
 * Stage 7 — Recommendation Generation, job-description path (`FR-022`).
 *
 * `FR-022` requires the job-description path to produce "required-skill
 * extraction, skill gap analysis, portfolio recommendations, and interview
 * guidance". This stage implements the first three of those *as a decision*:
 * what the posting requires, what the operator already evidences, what is
 * missing, and whether to apply now or build first.
 *
 * TWO GROUNDING RULES, both refusals rather than preferences:
 *
 *   1. **Every requirement traces to a Stage 3 context element.** A requirement
 *      the posting does not support is invented, and an invented requirement
 *      manufactures a gap — which manufactures a project. This is the same
 *      discipline `FR-030` applies to architecture components, applied to the
 *      other end of the pipeline.
 *
 *   2. **Every match cites a capability that exists and may be cited.** The
 *      capability id must resolve in the profile, and the capability must be
 *      matchable — `familiar` depth is rejected here, not silently downgraded.
 *      A match on familiarity is how a gap analysis talks itself into "apply
 *      now" for a posting the operator cannot evidence.
 *
 * WHY `apply_now` IS A FIRST-CLASS OUTCOME. The product exists to maximise
 * employability, not to generate projects, so the stage must be able to
 * conclude that enough evidence already exists. A verdict of `build_first` must
 * name the gaps that drove it — a decision that cannot say what would change it
 * is not a decision.
 *
 * NO BUILD SPECIFICATION HERE. What to build, how to test it and what evidence
 * to produce are later phases. This stage decides *whether*, and names the gaps
 * that a build would have to close.
 */

import {
  StageError,
  isBuildableKind,
  type ContextResult,
  type GapItem,
  type MatchedCapability,
  type RecommendationResult,
  type RequiredCapability,
  RECOMMENDATION_DECISIONS,
  REQUIREMENT_KINDS,
  REQUIREMENT_NECESSITY,
  MATCH_STRENGTHS,
  GAP_PRIORITIES,
} from "../contracts.js";
import { isMatchable, type CapabilityProfile } from "../capability-profile.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireMember,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 7;
const STAGE_KEY = "recommendation_generation";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

/**
 * A Stage 7 grounding failure — a requirement citing no real context element,
 * or a match citing no usable capability.
 *
 * Distinct from `StageError` for the same reason `ArchitectureTraceabilityError`
 * is: it is the one failure worth a single regeneration, because a model that
 * mis-cited once may cite correctly when shown the constraint again. Whether
 * the pipeline grants that regeneration is the pipeline's decision (`AI §3.2`
 * grants it to Stage 6; nothing grants it here yet), so this type exists to
 * make the choice available rather than to assume it.
 */
export class RecommendationGroundingError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "RecommendationGroundingError";
  }
}

function parseRequirement(
  value: unknown,
  index: number,
  elementCount: number,
): RequiredCapability {
  const label = `required_capabilities[${String(index)}]`;
  const record = asRecord(CTX, value, label);

  const id = requireString(CTX, record, "id");
  const name = requireString(CTX, record, "name");
  const necessity = requireMember(
    CTX,
    record,
    "necessity",
    REQUIREMENT_NECESSITY,
  );
  // `FR-022`: requirements are "labelled `stated` or `inferred`". A posting
  // that implies a requirement without stating it is still useful — but the
  // reader must be able to tell which is which.
  const provenance = requireMember(CTX, record, "provenance", [
    "stated",
    "inferred",
  ] as const);
  // `D-28`: what closing this would take. Only `technical` is buildable, and
  // that is what keeps a behavioural requirement from becoming a project.
  const kind = requireMember(CTX, record, "kind", REQUIREMENT_KINDS);

  const rawGrounding = requireArray(CTX, record, "grounded_in_context_indices");
  const grounded: number[] = [];
  for (const entry of rawGrounding) {
    if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0) {
      return fail(
        `${label}: grounded_in_context_indices must contain non-negative integers`,
      );
    }
    if (entry >= elementCount) {
      throw new RecommendationGroundingError(
        `${label} cites context element ${String(entry)}, but the context set has ` +
          `${String(elementCount)} element(s) with indices 0-${String(elementCount - 1)}. ` +
          `Cite the "index" value shown on each context element.`,
      );
    }
    if (!grounded.includes(entry)) {
      grounded.push(entry);
    }
  }
  if (grounded.length === 0) {
    throw new RecommendationGroundingError(
      `${label} ("${name}") is grounded in no context element — a requirement the posting does not support is invented`,
    );
  }

  return {
    id,
    name,
    necessity,
    provenance,
    kind,
    groundedInContextIndices: grounded,
  };
}

function parseMatch(
  value: unknown,
  index: number,
  requirementIds: ReadonlySet<string>,
  profile: CapabilityProfile,
): MatchedCapability {
  const label = `matched[${String(index)}]`;
  const record = asRecord(CTX, value, label);

  const requirementId = requireString(CTX, record, "requirement_id");
  if (!requirementIds.has(requirementId)) {
    throw new RecommendationGroundingError(
      `${label} matches requirement ${JSON.stringify(requirementId)}, which was not among the required capabilities`,
    );
  }

  const capabilityId = requireString(CTX, record, "capability_id");
  const capability = profile.capabilities.find((c) => c.id === capabilityId);
  if (capability === undefined) {
    throw new RecommendationGroundingError(
      `${label} cites capability ${JSON.stringify(capabilityId)}, which is not in the capability profile`,
    );
  }
  if (!isMatchable(capability)) {
    // The load-bearing refusal. `familiar` means no artifact proves it, so a
    // match on it would put unevidenced ability behind a verdict.
    throw new RecommendationGroundingError(
      `${label} cites capability ${JSON.stringify(capabilityId)}, whose depth is "${capability.depth}" — ` +
        `familiarity is not demonstrated ability and cannot support a match`,
    );
  }

  const strength = requireMember(CTX, record, "strength", MATCH_STRENGTHS);
  // The specific artifact a reader could open. A match that cannot point at
  // one is an assertion, which is what the profile exists to prevent.
  const evidenceRef = requireString(CTX, record, "evidence_ref");
  if (!capability.evidence.some((e) => e.locator === evidenceRef)) {
    throw new RecommendationGroundingError(
      `${label} cites evidence ${JSON.stringify(evidenceRef)}, which is not a locator on capability ${JSON.stringify(capabilityId)}`,
    );
  }

  return { requirementId, capabilityId, strength, evidenceRef };
}

function parseGap(
  value: unknown,
  index: number,
  requirementIds: ReadonlySet<string>,
): GapItem {
  const label = `gaps[${String(index)}]`;
  const record = asRecord(CTX, value, label);

  const requirementId = requireString(CTX, record, "requirement_id");
  if (!requirementIds.has(requirementId)) {
    throw new RecommendationGroundingError(
      `${label} names requirement ${JSON.stringify(requirementId)}, which was not among the required capabilities`,
    );
  }

  return {
    requirementId,
    priority: requireMember(CTX, record, "priority", GAP_PRIORITIES),
    whyItMatters: requireString(CTX, record, "why_it_matters"),
  };
}

/**
 * Parses and structurally verifies a Stage 7 response against the context set
 * it claims to derive from and the profile it claims to match.
 *
 * @throws RecommendationGroundingError when a requirement, match or gap cites
 * something that does not resolve — the failures worth regenerating for.
 * @throws StageError for anything else.
 */
export function parseRecommendation(
  responseText: string,
  context: ContextResult,
  profile: CapabilityProfile,
): RecommendationResult {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);
  const elementCount = context.elements.length;

  const requirements = requireArray(CTX, record, "required_capabilities").map(
    (entry, index) => parseRequirement(entry, index, elementCount),
  );

  if (requirements.length === 0) {
    return fail(
      "required_capabilities is empty — a job description with no extractable requirement is a Stage 3 sufficiency judgement, not a recommendation",
    );
  }

  const requirementIds = new Set<string>();
  requirements.forEach((requirement, index) => {
    if (requirementIds.has(requirement.id)) {
      fail(
        `required_capabilities[${String(index)}]: duplicate id ${JSON.stringify(requirement.id)}`,
      );
    }
    requirementIds.add(requirement.id);
  });

  const matched = requireArray(CTX, record, "matched").map((entry, index) =>
    parseMatch(entry, index, requirementIds, profile),
  );

  const gaps = requireArray(CTX, record, "gaps").map((entry, index) =>
    parseGap(entry, index, requirementIds),
  );

  // A requirement cannot be both met and missing. Downstream phases size a
  // build from the gap list, so an overlap would inflate the work.
  const matchedIds = new Set(matched.map((m) => m.requirementId));
  for (const gap of gaps) {
    if (matchedIds.has(gap.requirementId)) {
      fail(
        `requirement ${JSON.stringify(gap.requirementId)} is reported as both matched and a gap`,
      );
    }
  }

  // ...and it cannot be neither. `matched` and `gaps` must *partition* the
  // requirement set (`docs/12` D-28).
  //
  // The rule that was missing. Disjointness was checked; coverage was not, so
  // the assessment was a partial function presented as a total one. The first
  // real run extracted 23 requirements and disposed of 21 — "experience
  // training non-technical team members" and "drone/aerospace experience" were
  // simply dropped. Both were honest gaps. A requirement that vanishes is worse
  // than one reported as unmet, because the reader cannot tell it was
  // considered.
  const gapIdSet = new Set(gaps.map((g) => g.requirementId));
  const undisposed = requirements.filter(
    (r) => !matchedIds.has(r.id) && !gapIdSet.has(r.id),
  );
  if (undisposed.length > 0) {
    throw new RecommendationGroundingError(
      `every required capability must be reported as matched or as a gap; ` +
        `${String(undisposed.length)} received neither: ` +
        undisposed
          .map((r) => `${JSON.stringify(r.id)} ("${r.name}")`)
          .join(", "),
    );
  }

  const verdictRecord = asRecord(CTX, record["verdict"], "verdict");
  const decision = requireMember(
    CTX,
    verdictRecord,
    "decision",
    RECOMMENDATION_DECISIONS,
  );
  const rationale = requireString(CTX, verdictRecord, "rationale");

  const rawDecisive = requireArray(CTX, verdictRecord, "decisive_gaps");
  const decisiveGaps: string[] = [];
  const gapIds = new Set(gaps.map((g) => g.requirementId));
  for (const entry of rawDecisive) {
    if (typeof entry !== "string") {
      return fail("verdict.decisive_gaps must contain requirement ids");
    }
    if (!gapIds.has(entry)) {
      throw new RecommendationGroundingError(
        `verdict.decisive_gaps names ${JSON.stringify(entry)}, which is not one of the reported gaps`,
      );
    }
    // Only a buildable gap may drive the decision (`docs/12` D-28). A decisive
    // gap is what a build would have to close, and a build closes nothing
    // behavioural — "resourcefulness" as the justification for a portfolio
    // project is a recommendation the operator cannot act on and cannot finish.
    const requirement = requirements.find((r) => r.id === entry);
    if (requirement !== undefined && !isBuildableKind(requirement.kind)) {
      throw new RecommendationGroundingError(
        `verdict.decisive_gaps names ${JSON.stringify(entry)} ("${requirement.name}"), whose kind is ` +
          `"${requirement.kind}" — only a "technical" requirement can be closed by building something, ` +
          `so only a technical gap can decide a build_first verdict`,
      );
    }
    if (!decisiveGaps.includes(entry)) {
      decisiveGaps.push(entry);
    }
  }

  // A `build_first` verdict that names no decisive gap cannot be acted on: the
  // operator would not know what the build has to close, and nothing would
  // tell them when they were done.
  if (decision === "build_first" && decisiveGaps.length === 0) {
    return fail(
      "a build_first verdict must name at least one decisive gap — otherwise nothing states what the build would have to close",
    );
  }
  // The mirror: applying now while claiming a gap decided it is incoherent.
  if (decision === "apply_now" && decisiveGaps.length > 0) {
    return fail(
      "an apply_now verdict must not name decisive gaps — a gap that decides the verdict argues for building",
    );
  }

  return {
    requiredCapabilities: requirements,
    matched,
    gaps,
    verdict: { decision, rationale, decisiveGaps },
  };
}

export const RECOMMENDATION_STAGE = {
  stageNumber: STAGE_NUMBER,
  stageKey: STAGE_KEY,
} as const;
