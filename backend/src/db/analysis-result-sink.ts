/**
 * Progressive persistence of a run into the primary-domain models
 * (`DB §4.2`, `§4.3`, `§6.2`).
 *
 * THE TRANSACTION BOUNDARY IS ONE STAGE, and it is derived rather than chosen:
 *
 *   · `DB §6.2` — "Records are written as stages complete, **not batched at
 *     the end**", so the boundary cannot be the run.
 *   · Within a stage the writes must still be atomic. Stage 3 writes N context
 *     elements and then links their conflicts; Stage 6 writes a model, its
 *     components and their references. A half-written stage would be worse
 *     than an absent one — `AIP-3` and `FR-030` both depend on an element or a
 *     component arriving complete with its grounding.
 *   · So: one transaction per stage. Each commits independently, and a later
 *     stage's failure cannot roll back an earlier stage's commit.
 *
 * That is what `FR-091` asks for — "partial pipeline failure must yield partial
 * results" — and what the first real run cost by not having: a Stage 6 failure
 * discarded correct, paid Stage 1-3 output.
 *
 * FOREIGN KEYS ARE SATISFIED BY THE ORDER THE PIPELINE ALREADY RUNS IN.
 * `CONTEXT_REFERENCE` points at `CONTEXT_ELEMENT`, and Stage 3 commits before
 * Stage 6 begins — so Stage 6's references resolve against rows that are
 * already durable, rather than against rows in an open transaction.
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  ArchitectureResult,
  ArtifactPlanEntry,
  ClassificationResult,
  ContextResult,
  GapItem,
  IntentResult,
  MatchedCapability,
  RecommendationResult,
} from "../nie/contracts.js";
import type { PersistedArtifact, StageResultSink } from "../nie/ports.js";
import { requirePublishedSchemaId } from "./artifact-schema-publisher.js";

/**
 * ⚠️ `CONTEXT_REFERENCE.relevance` has no vocabulary in any authoritative
 * document — one of the undefined vocabularies recorded in `docs/12` D-10.
 */
const GROUNDING_RELEVANCE = "grounds";

export function createStageResultSink(prisma: PrismaClient): StageResultSink {
  /**
   * Context element ids in extraction order, per analysis.
   *
   * Stage 6 grounds its components by *index* into the Stage 3 set, and
   * `CONTEXT_ELEMENT` has no ordinal column to recover that order from after
   * the fact. Holding the ids from our own Stage 3 write is what lets Stage 6
   * resolve them without a schema change. Scoped by `analysisId` so one sink
   * can serve concurrent runs.
   */
  const contextElementIds = new Map<string, readonly string[]>();

  /**
   * Plan entry ids by artifact type, per analysis.
   *
   * Stage 9 stores an artifact against the plan entry that decided it should
   * exist (`DB §4.4` 1:0..1), and holding the ids from our own Stage 8 write is
   * what lets it resolve one without re-querying by type.
   */
  const planEntryIds = new Map<string, Map<string, string>>();

  return {
    async persistClassification(
      analysisId: string,
      classification: ClassificationResult,
    ): Promise<void> {
      await prisma.classification.create({
        data: {
          analysisId,
          determinedType: classification.determinedType,
          confidence: classification.confidence,
          candidateTypes: [...classification.candidateTypes],
          wasLowConfidence: classification.wasLowConfidence,
        },
      });
    },

    async persistIntent(
      analysisId: string,
      intent: IntentResult,
    ): Promise<void> {
      await prisma.intentRecord.create({
        data: {
          analysisId,
          primaryObjective: intent.primaryObjective.content,
          secondaryObjectives: intent.secondaryObjectives.map((o) => ({
            content: o.content,
            provenance: o.provenance,
          })),
          objectiveProvenance: {
            primary: intent.primaryObjective.provenance,
            secondary: intent.secondaryObjectives.map((o) => o.provenance),
          },
          inferredScope: intent.inferredScope,
        },
      });
    },

    async persistContext(
      analysisId: string,
      context: ContextResult,
    ): Promise<void> {
      const ids = await prisma.$transaction(async (tx) => {
        const created: string[] = [];

        // One at a time, in order: the returned ids are what Stage 6's
        // grounding indices resolve to.
        for (const element of context.elements) {
          const row = await tx.contextElement.create({
            data: {
              analysisId,
              content: element.content,
              category: element.category,
              provenance: element.provenance,
              specificityScore: element.specificityScore,
              ...(element.sourceSpanStart !== undefined
                ? { sourceSpanStart: element.sourceSpanStart }
                : {}),
              ...(element.sourceSpanEnd !== undefined
                ? { sourceSpanEnd: element.sourceSpanEnd }
                : {}),
              ...(element.inferenceBasis !== undefined
                ? { inferenceBasis: element.inferenceBasis }
                : {}),
              ...(element.resolutionHint !== undefined
                ? { resolutionHint: element.resolutionHint }
                : {}),
            },
            select: { contextElementId: true },
          });
          created.push(row.contextElementId);
        }

        // A second pass: an element may conflict with one that did not exist
        // when it was written (`AI §5.2`).
        for (const [index, element] of context.elements.entries()) {
          if (element.conflictsWithIndex === undefined) {
            continue;
          }
          await tx.contextElement.update({
            where: { contextElementId: created[index] as string },
            data: {
              conflictsWithId: created[element.conflictsWithIndex] as string,
            },
          });
        }

        // `DB §4.2`/`schema.prisma`: `ANALYSIS.sufficiency_level` is "Written
        // at Stage 3 (`AI §5.4`)". Stage 3 already reports the value (`docs/12`
        // D-13 — reported, never computed); this is where it lands. In the same
        // transaction as the elements it describes, because a sufficiency level
        // without its context set, or a context set without its level, is the
        // half-written stage the boundary exists to prevent.
        await tx.analysis.update({
          where: { analysisId },
          data: { sufficiencyLevel: context.sufficiency },
        });

        return created;
      });

      contextElementIds.set(analysisId, ids);
    },

    /**
     * Stage 7, job-description path (`FR-022`).
     *
     * Four things land together, because a verdict without the requirements it
     * rests on is an assertion nobody can check: the recommendation, the
     * required capabilities, what matched them, and what did not.
     *
     * NO CONFIDENCE IS WRITTEN. `Recommendation.confidence_band` and
     * `confidence_factors` are nullable precisely so this is possible — Stage
     * 11 is deferred (`docs/12` D-33) and there is no measured band to record.
     * `criteria_applied` and `limits` are likewise absent because
     * `RecommendationResult` contains nothing that means either. Fabricating
     * any of the four is the failure the nullability exists to prevent.
     */
    async persistRecommendation(
      analysisId: string,
      recommendation: RecommendationResult,
    ): Promise<void> {
      const elementIds = contextElementIds.get(analysisId);
      if (elementIds === undefined) {
        throw new Error(
          `Cannot persist a recommendation for analysis ${analysisId}: no context elements were persisted first`,
        );
      }

      const decisive = new Set(recommendation.verdict.decisiveGaps);
      const matchesByRequirement = new Map<string, MatchedCapability[]>();
      for (const match of recommendation.matched) {
        const list = matchesByRequirement.get(match.requirementId) ?? [];
        list.push(match);
        matchesByRequirement.set(match.requirementId, list);
      }
      const gapsByRequirement = new Map<string, GapItem[]>();
      for (const gap of recommendation.gaps) {
        const list = gapsByRequirement.get(gap.requirementId) ?? [];
        list.push(gap);
        gapsByRequirement.set(gap.requirementId, list);
      }

      await prisma.$transaction(async (tx) => {
        const created = await tx.recommendation.create({
          data: {
            analysisId,
            // The column is explicitly free text — "vocabulary undefined by
            // every authoritative document" — so it names the decision this
            // path makes rather than inventing a taxonomy.
            recommendationType: "job_description_fit",
            conclusion: recommendation.verdict.decision,
            rationale: recommendation.verdict.rationale,
            // `AC-013` is about a do-not-automate conclusion on the
            // requirement path. An apply-vs-build verdict is neither.
            isNegativeConclusion: false,
          },
          select: { recommendationId: true },
        });

        for (const [
          ordinal,
          requirement,
        ] of recommendation.requiredCapabilities.entries()) {
          const row = await tx.requiredCapability.create({
            data: {
              analysisId,
              externalId: requirement.id,
              name: requirement.name,
              necessity: requirement.necessity,
              provenance: requirement.provenance,
              kind: requirement.kind,
              ordinal,
            },
            select: { requiredCapabilityId: true },
          });

          for (const match of matchesByRequirement.get(requirement.id) ?? []) {
            await tx.capabilityMatch.create({
              data: {
                requiredCapabilityId: row.requiredCapabilityId,
                capabilityId: match.capabilityId,
                strength: match.strength,
                evidenceRef: match.evidenceRef,
              },
            });
          }

          for (const gap of gapsByRequirement.get(requirement.id) ?? []) {
            await tx.capabilityGap.create({
              data: {
                requiredCapabilityId: row.requiredCapabilityId,
                priority: gap.priority,
                whyItMatters: gap.whyItMatters,
                decisive: decisive.has(gap.requirementId),
              },
            });
          }

          // The traceability join (`FR-030`'s rule, applied to requirements):
          // a requirement the posting does not support is invented, so each
          // one records the context elements it was grounded in. Indices are
          // resolved to persisted ids by the same mapping Stage 6 uses.
          for (const index of requirement.groundedInContextIndices) {
            const contextElementId = elementIds[index];
            if (contextElementId === undefined) {
              throw new Error(
                `Requirement "${requirement.id}" grounds in context element ${String(index)}, which was not persisted`,
              );
            }
            await tx.contextReference.create({
              data: {
                contextElementId,
                referencingType: "recommendation",
                referencingId: created.recommendationId,
                relevance: GROUNDING_RELEVANCE,
              },
            });
          }
        }
      });
    },

    /**
     * Stage 8 (`DB §4.4` ARTIFACT_PLAN_ENTRY).
     *
     * Written whole, including the entries that were planned *out*: `FR-091`
     * and `AIP-8` exist so omission and failure stay distinguishable, and an
     * omitted entry carries the reason that makes it a decision rather than a
     * gap.
     */
    async persistArtifactPlan(
      analysisId: string,
      plan: readonly ArtifactPlanEntry[],
    ): Promise<void> {
      const ids = new Map<string, string>();
      await prisma.$transaction(async (tx) => {
        for (const entry of plan) {
          const row = await tx.artifactPlanEntry.create({
            data: {
              analysisId,
              artifactType: entry.artifactType,
              planned: entry.planned,
              depthLevel: entry.depthLevel,
              ...(entry.inclusionReason !== undefined
                ? { inclusionReason: entry.inclusionReason }
                : {}),
              ...(entry.omissionReason !== undefined
                ? { omissionReason: entry.omissionReason }
                : {}),
              ...(entry.outcome !== undefined
                ? { outcome: entry.outcome }
                : {}),
            },
            select: { planEntryId: true },
          });
          ids.set(entry.artifactType, row.planEntryId);
        }
      });
      planEntryIds.set(analysisId, ids);
    },

    /**
     * Stage 9 (`DB §4.4` ARTIFACT).
     *
     * Stores the wire document whole (`DP-1`: retrieved whole, never queried by
     * internal structure) against the published schema version it was validated
     * under, so the row's `validation_status` is a claim about a definition
     * that still exists.
     *
     * **A failed artifact is stored, not discarded** — that is what lets a
     * reader see a labelled failure rather than an unexplained gap.
     */
    async persistArtifact(
      analysisId: string,
      artifact: PersistedArtifact,
    ): Promise<void> {
      const planEntryId = planEntryIds
        .get(analysisId)
        ?.get(artifact.artifactType);
      if (planEntryId === undefined) {
        throw new Error(
          `Cannot persist artifact "${artifact.artifactType}" for analysis ${analysisId}: no plan entry was persisted for it`,
        );
      }

      const schemaId = await requirePublishedSchemaId(
        prisma,
        artifact.artifactType,
      );

      await prisma.artifact.create({
        data: {
          analysisId,
          planEntryId,
          artifactType: artifact.artifactType,
          schemaId,
          content: artifact.content as object,
          depthLevel: artifact.depthLevel,
          generationAttemptCount: artifact.generationAttemptCount,
          validationStatus: artifact.validationStatus,
        },
      });

      await prisma.artifactPlanEntry.update({
        where: { planEntryId },
        data: {
          outcome:
            artifact.validationStatus === "valid" ? "generated" : "failed",
        },
      });
    },

    async persistArchitecture(
      analysisId: string,
      architecture: ArchitectureResult,
    ): Promise<void> {
      const ids = contextElementIds.get(analysisId);
      if (ids === undefined) {
        // Stage 6 cannot ground itself in a context set that was never stored.
        // `FR-030` traceability would be unrecoverable, so this is a failure
        // rather than an architecture persisted without its references.
        throw new Error(
          `Cannot persist an architecture for analysis ${analysisId}: no context elements were persisted first`,
        );
      }

      await prisma.$transaction(async (tx) => {
        const model = await tx.architectureModel.create({
          data: {
            analysisId,
            summary: architecture.summary,
            dataFlowDescription: architecture.dataFlowDescription,
          },
          select: { architectureId: true },
        });

        for (const component of architecture.components) {
          const row = await tx.architectureComponent.create({
            data: {
              architectureId: model.architectureId,
              name: component.name,
              responsibility: component.responsibility,
              inputs: component.inputs,
              outputs: component.outputs,
              failureHandling: component.failureHandling,
              ordinal: component.ordinal,
              ...(component.externalSystem !== undefined
                ? { externalSystem: component.externalSystem }
                : {}),
              ...(component.integrationDirection !== undefined
                ? { integrationDirection: component.integrationDirection }
                : {}),
            },
            select: { componentId: true },
          });

          // The `FR-030` traceability chain, made queryable. The referenced
          // context elements are already committed by Stage 3.
          await tx.contextReference.createMany({
            data: component.groundedInContextIndices.map((index) => {
              const contextElementId = ids[index];
              if (contextElementId === undefined) {
                throw new Error(
                  `Component "${component.name}" grounds in context element ${String(index)}, which was not persisted`,
                );
              }
              return {
                contextElementId,
                referencingType: "architecture_component" as const,
                referencingId: row.componentId,
                relevance: GROUNDING_RELEVANCE,
              };
            }),
          });
        }
      });
    },
  };
}
