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
  ClassificationType,
  ContextResult,
  GapItem,
  IntentResult,
  MatchedCapability,
  RecommendationResult,
  WorkflowFinding,
} from "../nie/contracts.js";
import type { PersistedArtifact, StageResultSink } from "../nie/ports.js";
import { renderConfidence } from "../nie/confidence-wire.js";
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
   * Architecture component ids in order, per analysis.
   *
   * `RiskItem.component_id` is NOT NULL with a foreign key (`FR-032`,
   * `DB §4.3` — "a risk that cannot name what it affects cannot be stored"),
   * and a Stage 6W finding names its step by *index*. Holding the ids from our
   * own component write is what lets a finding resolve one without re-querying
   * by name, exactly as `contextElementIds` does for grounding.
   */
  const componentIds = new Map<string, readonly string[]>();

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
      overriddenBy?: ClassificationType,
    ): Promise<void> {
      await prisma.classification.create({
        data: {
          analysisId,
          determinedType: classification.determinedType,
          confidence: classification.confidence,
          candidateTypes: [...classification.candidateTypes],
          wasLowConfidence: classification.wasLowConfidence,
          // `FR-014` — "override events are recorded for M-6". Written on the
          // *new* analysis, because `API §7.5` creates one rather than
          // mutating the original: `DB DP-3` makes analyses immutable, and an
          // update would destroy both what the system originally concluded and
          // the accuracy signal that comparison provides.
          //
          // Absent, not null, when nothing was overridden — the same rule the
          // halt columns follow.
          ...(overriddenBy !== undefined
            ? { userOverrideType: overriddenBy, overriddenAt: new Date() }
            : {}),
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
          // D-90: what the submitter asked to receive, with the verified quote.
          requestedOutcome: intent.requestedOutcome,
          ...(intent.declineQuote !== undefined
            ? { declineQuote: intent.declineQuote }
            : {}),
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
        for (const [index, element] of context.elements.entries()) {
          const row = await tx.contextElement.create({
            data: {
              analysisId,
              // D-78: the index Stage 6 grounds in and Stage 9 cites,
              // persisted so a later read rebuilds the same set.
              ordinal: index,
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

    /** D-86 — Stage 11, on every analysis that reaches it. */
    async persistConfidence(analysisId, confidence) {
      await prisma.analysis.update({
        where: { analysisId },
        data: {
          overallConfidenceBand: confidence.band,
          overallConfidenceFactors: renderConfidence(confidence) as object,
        },
      });
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
     * Fabricating either is the failure that nullability exists to prevent.
     *
     * `criteria_applied` IS written, and is non-nullable again. It was
     * relaxed alongside the confidence columns when this sink was first built,
     * which was wrong: D-33 covers confidence, and `AIP-4`/`DD-04` cover
     * criteria. Stage 7 now produces them (`AI §3.2`), so the `DB §4.4`
     * invariant is restored rather than worked around. `limits` stays nullable
     * — no authoritative document defines what Stage 7 would put there.
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
            // `AIP-4` / `DD-04` — non-null by schema constraint, so an
            // unexplained recommendation is unrepresentable rather than merely
            // discouraged (`DB §4.4`: "the database is the enforcement point").
            criteriaApplied: recommendation.verdict.criteriaApplied,
            // `AC-013` is about a do-not-automate conclusion on the
            // requirement path. An apply-vs-build verdict is neither.
            isNegativeConclusion: false,
          },
          select: { recommendationId: true },
        });

        // `FR-034` — "at least one rejected alternative is named with its
        // reason". Stored as rows rather than prose so the requirement is
        // countable, which is why `RecommendationAlternative` exists at all.
        for (const [
          ordinal,
          alternative,
        ] of recommendation.verdict.alternatives.entries()) {
          await tx.recommendationAlternative.create({
            data: {
              recommendationId: created.recommendationId,
              alternative: alternative.alternative,
              rejectionReason: alternative.rejectionReason,
              ordinal,
            },
          });
        }

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
      // Merged, not replaced: since D-66 the plan is written in two parts —
      // the intent brief at Stage 2, the path's set at Stage 8 — and the
      // first part's ids must survive the second.
      const merged = new Map(planEntryIds.get(analysisId) ?? []);
      for (const [type, id] of ids) merged.set(type, id);
      planEntryIds.set(analysisId, merged);
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

      const created: string[] = [];
      await prisma.$transaction(async (tx) => {
        const model = await tx.architectureModel.create({
          data: {
            analysisId,
            summary: architecture.summary,
            dataFlowDescription: architecture.dataFlowDescription,
            // D-78: one entry per unknown context element, by index.
            unknownDispositions: architecture.unknownDispositions.map((d) => ({
              context_index: d.contextIndex,
              disposition: d.disposition,
              statement: d.statement,
            })),
            // D-90: the conclusion stated instead of a design (`FR-020`).
            ...(architecture.automationUnwarranted !== undefined
              ? {
                  automationUnwarrantedStatement:
                    architecture.automationUnwarranted.statement,
                }
              : {}),
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
          created.push(row.componentId);

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

      componentIds.set(analysisId, created);
    },

    /**
     * Stage 6W findings, as `RISK_ITEM` rows (`FR-032`, `docs/15` D-40).
     *
     * Each finding names a step of the reviewed workflow, and those steps were
     * persisted as `ArchitectureComponent` rows by `persistArchitecture`
     * immediately before this — which is what makes the NOT NULL
     * `component_id` satisfiable on a path that designs no architecture.
     *
     * `docs/09` §2 severity and likelihood are stored as given; the derived
     * score and band are computed at presentation and never stored.
     */
    async persistWorkflowFindings(
      analysisId: string,
      findings: readonly WorkflowFinding[],
    ): Promise<void> {
      if (findings.length === 0) return;

      const ids = componentIds.get(analysisId);
      if (ids === undefined) {
        throw new Error(
          `Cannot persist findings for analysis ${analysisId}: no components were persisted first`,
        );
      }

      await prisma.$transaction(async (tx) => {
        for (const finding of findings) {
          const componentId = ids[finding.componentIndex];
          if (componentId === undefined) {
            throw new Error(
              `Finding names step ${String(finding.componentIndex)}, which was not persisted`,
            );
          }
          await tx.riskItem.create({
            data: {
              analysisId,
              componentId,
              description: finding.description,
              severity: finding.severity,
              likelihood: finding.likelihood,
              mitigation: finding.remediation,
            },
          });
        }
      });
    },
  };
}
