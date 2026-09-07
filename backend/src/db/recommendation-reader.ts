/**
 * Reads a stored `RecommendationResult` back out of the database.
 *
 * WHY THIS EXISTS. `API-032` retries a failed artifact and is explicit that it
 * **"reuses stored reasoning state; does not re-run stages 1–8"**. Stage 9's
 * input is the Stage 7 recommendation, and after a run ends the only copy of
 * that recommendation is the rows Stage 7 wrote. So a retry needs the inverse
 * of `persistRecommendation` — this module.
 *
 * IT RECONSTRUCTS, IT DOES NOT REGENERATE. `FR-060` requires retrieval to
 * reproduce what is stored and never to re-derive it, and the same rule
 * applies with more force here: a retry that rebuilt the recommendation by
 * calling a provider would be re-running Stage 7, which is precisely what
 * `API-032` forbids. Every field below comes from a column.
 *
 * ⚠️ IT RETURNS ITS OWN TYPE, NOT `RecommendationResult`, AND THAT IS
 * DELIBERATE. The full contract carries `groundedInContextIndices` on every
 * required capability — *positions* in the Stage 3 element list. The database
 * stores grounding as `CONTEXT_REFERENCE` rows pointing at context element
 * **ids**, because `CONTEXT_ELEMENT` has no ordinal column (the same gap
 * `analysis-result-sink.ts` works around by holding ids from its own write).
 * Recovering positions from ids after the fact would mean re-deriving an order
 * the store never recorded, and getting it wrong would silently mislabel which
 * requirement rests on which evidence.
 *
 * So this returns exactly what Stage 9 consumes — requirement names, gaps,
 * matches and the verdict — and declines to reconstruct what it cannot. A
 * retry does not re-verify grounding; Stage 7 did that when it ran, and its
 * `CONTEXT_REFERENCE` rows are the record.
 *
 * The capability *profile* is likewise absent: it is authored configuration
 * loaded from disk at composition, not analysis output, and Stage 9 does not
 * read it.
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  GapItem,
  MatchedCapability,
  RequiredCapability,
  RecommendationVerdict,
} from "../nie/contracts.js";

/**
 * A recommendation as far as storage can reproduce it.
 *
 * Structurally the part of `RecommendationResult` that Stage 9 reads, with
 * `groundedInContextIndices` omitted from each requirement for the reason
 * above. Assignable wherever only those fields are needed; deliberately *not*
 * assignable to `RecommendationResult`, so a future caller that needs full
 * grounding gets a type error rather than an empty array.
 */
export interface StoredRecommendation {
  readonly requiredCapabilities: readonly Omit<
    RequiredCapability,
    "groundedInContextIndices"
  >[];
  readonly matched: readonly MatchedCapability[];
  readonly gaps: readonly GapItem[];
  readonly verdict: RecommendationVerdict;
}

/**
 * @returns the stored recommendation, or `null` when the analysis has none —
 * a path that produces no recommendation, or a run that stopped before Stage 7.
 */
export async function readRecommendation(
  prisma: PrismaClient,
  analysisId: string,
): Promise<StoredRecommendation | null> {
  const [row, capabilities] = await Promise.all([
    prisma.recommendation.findFirst({
      where: { analysisId },
      include: { alternatives: { orderBy: { ordinal: "asc" } } },
    }),
    prisma.requiredCapability.findMany({
      where: { analysisId },
      orderBy: { ordinal: "asc" },
      include: { matches: true, gaps: true },
    }),
  ]);

  if (row === null) return null;

  const requiredCapabilities: Omit<
    RequiredCapability,
    "groundedInContextIndices"
  >[] = [];
  const matched: MatchedCapability[] = [];
  const gaps: GapItem[] = [];

  for (const capability of capabilities) {
    requiredCapabilities.push({
      id: capability.externalId,
      name: capability.name,
      necessity: capability.necessity,
      provenance: capability.provenance,
      kind: capability.kind,
    });

    for (const match of capability.matches) {
      matched.push({
        requirementId: capability.externalId,
        capabilityId: match.capabilityId,
        strength: match.strength,
        evidenceRef: match.evidenceRef,
      });
    }

    for (const gap of capability.gaps) {
      gaps.push({
        requirementId: capability.externalId,
        priority: gap.priority,
        whyItMatters: gap.whyItMatters,
      });
    }
  }

  // `DB §4.3`: decisiveness is stored on the gap, not as a second list, "so
  // the two cannot disagree". Reading it back means reassembling the verdict's
  // view from the same single source.
  const decisiveGaps = capabilities
    .filter((capability) => capability.gaps.some((gap) => gap.decisive))
    .map((capability) => capability.externalId);

  // `conclusion` is free text in the database — `docs/12` D-10 records that no
  // authoritative document defines its vocabulary — while the contract narrows
  // it to the two decisions Stage 7 actually produces. Checked rather than
  // cast: a row holding something else is a real possibility, and asserting it
  // into the union would put a value downstream that the type says cannot
  // exist. `FR-060` says retrieval reproduces what is stored; where what is
  // stored is unreadable, saying so beats inventing a decision.
  if (row.conclusion !== "apply_now" && row.conclusion !== "build_first") {
    throw new Error(
      `Analysis ${analysisId} stores an unrecognised recommendation decision "${row.conclusion}"`,
    );
  }

  return {
    requiredCapabilities,
    matched,
    gaps,
    verdict: {
      decision: row.conclusion,
      rationale: row.rationale,
      decisiveGaps,
      criteriaApplied: row.criteriaApplied,
      alternatives: row.alternatives.map((alternative) => ({
        alternative: alternative.alternative,
        rejectionReason: alternative.rejectionReason,
      })),
    },
  };
}
