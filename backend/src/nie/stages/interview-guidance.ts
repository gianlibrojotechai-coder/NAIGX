/**
 * Stage 9 — Interview Guidance, the job-description path's second generator
 * ([D-76](../../../../docs/51-D-76-Interview-Guidance.md)).
 *
 * `AI §9.1`: "Architectural competencies the posting implies — derived from
 * the posting, not generic." The generator is given the Stage 7
 * recommendation (requirements, matches, gaps, verdict) and nothing else, and
 * this parser is what makes "derived from the posting" checkable rather than
 * hoped for:
 *
 *   · every competency names the requirement ids it is derived from, and
 *     every id must be one Stage 7 extracted — a competency with no
 *     requirement behind it is the generic canon the rule forbids;
 *   · every capability it tells the operator to cite must be one Stage 7
 *     matched — citing an unmatched capability would be an unsupported
 *     claim reaching a reader as advice;
 *   · `standing` must agree with the citations: evidenced means there is
 *     something to cite, gap means there is not and says how to handle it;
 *   · `rank` is a total order from 1, as the portfolio's is.
 *
 * Independent by construction (`AID-08`): it reads reasoning state and no
 * other generator's output. The published schema (`FR-039`) runs before this
 * parser on the wire document; this checks what a schema cannot.
 */

import {
  StageError,
  type InterviewCompetency,
  type InterviewGuidance,
  type RecommendationForArtifacts,
} from "../contracts.js";
import {
  asRecord,
  parseStructured,
  requireArray,
  requireMember,
  requireNumber,
  requireString,
} from "../parse.js";

const STAGE_NUMBER = 9;
const STAGE_KEY = "interview_guidance";
const CTX = { stageNumber: STAGE_NUMBER, stageKey: STAGE_KEY };

const fail = (message: string): never => {
  throw new StageError(STAGE_NUMBER, STAGE_KEY, message);
};

export class InterviewGroundingError extends StageError {
  constructor(message: string) {
    super(STAGE_NUMBER, STAGE_KEY, message);
    this.name = "InterviewGroundingError";
  }
}

const COMPETENCY_STANDING = ["evidenced", "gap"] as const;

const stringList = (
  record: Record<string, unknown>,
  key: string,
  where: string,
  minimum: number,
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
  if (out.length < minimum) {
    fail(`${where}: ${key} needs at least ${String(minimum)} entr(y/ies)`);
  }
  if (new Set(out).size !== out.length) fail(`${where}: ${key} repeats an id`);
  return out;
};

function parseCompetency(
  value: unknown,
  index: number,
  requirementIds: ReadonlySet<string>,
  matchedCapabilityIds: ReadonlySet<string>,
): InterviewCompetency {
  const where = `competencies[${String(index)}]`;
  const record = asRecord(CTX, value, where);

  const rank = requireNumber(CTX, record, "rank");
  if (!Number.isInteger(rank) || rank < 1) {
    fail(`${where}: rank must be a positive integer`);
  }

  const derivedFrom = stringList(record, "derived_from", where, 1);
  for (const id of derivedFrom) {
    if (!requirementIds.has(id)) {
      throw new InterviewGroundingError(
        `${where}: derived_from names ${JSON.stringify(id)}, which is not a requirement Stage 7 extracted — a competency with no requirement behind it is not derived from the posting`,
      );
    }
  }

  const evidence = stringList(record, "evidence_to_cite", where, 0);
  for (const id of evidence) {
    if (!matchedCapabilityIds.has(id)) {
      throw new InterviewGroundingError(
        `${where}: evidence_to_cite names ${JSON.stringify(id)}, which Stage 7 did not match — advice to cite it would be an unsupported claim`,
      );
    }
  }

  const standing = requireMember(CTX, record, "standing", COMPETENCY_STANDING);
  if (standing === "evidenced" && evidence.length === 0) {
    fail(`${where}: standing is evidenced but evidence_to_cite is empty`);
  }
  if (standing === "gap" && evidence.length > 0) {
    fail(`${where}: standing is gap but evidence_to_cite is not empty`);
  }

  const handling = record["how_to_handle_the_gap"];
  if (standing === "gap") {
    if (typeof handling !== "string" || handling.trim() === "") {
      fail(`${where}: a gap must say how to handle it`);
    }
  } else if (handling !== null && handling !== undefined) {
    fail(`${where}: how_to_handle_the_gap must be null when evidenced`);
  }

  return {
    rank,
    name: requireString(CTX, record, "name"),
    derivedFrom,
    whyThePostingImpliesIt: requireString(
      CTX,
      record,
      "why_the_posting_implies_it",
    ),
    beReadyToExplain: stringList(record, "be_ready_to_explain", where, 1),
    likelyQuestion: requireString(CTX, record, "likely_question"),
    evidenceToCite: evidence,
    standing,
    ...(standing === "gap"
      ? { howToHandleTheGap: (handling as string).trim() }
      : {}),
  };
}

export function parseInterviewGuidance(
  responseText: string,
  recommendation: RecommendationForArtifacts,
): InterviewGuidance {
  const record = parseStructured(STAGE_NUMBER, STAGE_KEY, responseText);
  const requirementIds = new Set(
    recommendation.requiredCapabilities.map((r) => r.id),
  );
  const matchedCapabilityIds = new Set(
    recommendation.matched.map((m) => m.capabilityId),
  );

  const competencies = requireArray(CTX, record, "competencies").map(
    (entry, index) =>
      parseCompetency(entry, index, requirementIds, matchedCapabilityIds),
  );
  if (competencies.length === 0) {
    fail(
      "competencies is empty — a posting with requirements implies at least one competency",
    );
  }

  // `rank` is a total order from 1: the reader is told what to prepare first.
  const ranks = competencies.map((c) => c.rank).sort((a, b) => a - b);
  ranks.forEach((rank, index) => {
    if (rank !== index + 1) {
      fail(
        `rank must be a total order starting at 1 with no ties; got ${JSON.stringify(competencies.map((c) => c.rank))}`,
      );
    }
  });

  return {
    competencies: [...competencies].sort((a, b) => a.rank - b.rank),
    framing: requireString(CTX, record, "framing"),
  };
}
