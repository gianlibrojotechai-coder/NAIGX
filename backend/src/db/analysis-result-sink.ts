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
  ClassificationResult,
  ContextResult,
  IntentResult,
} from "../nie/contracts.js";
import type { StageResultSink } from "../nie/ports.js";

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
