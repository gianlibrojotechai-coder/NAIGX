/**
 * The stored architecture and context set, read back for an `API-032` retry of
 * the platform recommendation (D-78).
 *
 * The retry regenerates from stored reasoning and re-runs no reasoning stage.
 * The platform generator is keyed on the context set (by index) and the
 * architecture (by component name and grounding index), so both are rebuilt
 * exactly: elements in their persisted `ordinal` order, components in theirs,
 * grounding indices resolved through `CONTEXT_REFERENCE` rows, dispositions
 * from the model's JSON column.
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import {
  UNKNOWN_DISPOSITIONS,
  type ArchitectureResult,
  type ContextResult,
  type UnknownDisposition,
} from "../nie/contracts.js";

export async function readArchitectureForRetry(
  prisma: PrismaClient,
  analysisId: string,
): Promise<{
  architecture: ArchitectureResult;
  context: ContextResult;
} | null> {
  const [elements, model, analysis] = await Promise.all([
    prisma.contextElement.findMany({
      where: { analysisId },
      orderBy: [{ ordinal: "asc" }, { contextElementId: "asc" }],
    }),
    prisma.architectureModel.findUnique({
      where: { analysisId },
      include: { components: { orderBy: { ordinal: "asc" } } },
    }),
    prisma.analysis.findUnique({
      where: { analysisId },
      select: { sufficiencyLevel: true },
    }),
  ]);
  if (model === null || elements.length === 0) return null;

  const position = new Map(elements.map((e, i) => [e.contextElementId, i]));
  const context: ContextResult = {
    sufficiency:
      analysis?.sufficiencyLevel === "thin" ||
      analysis?.sufficiencyLevel === "insufficient"
        ? analysis.sufficiencyLevel
        : "sufficient",
    elements: elements.map((e) => ({
      content: e.content,
      category: e.category as ContextResult["elements"][number]["category"],
      provenance: e.provenance,
      specificityScore: e.specificityScore,
      ...(e.sourceSpanStart !== null
        ? { sourceSpanStart: e.sourceSpanStart }
        : {}),
      ...(e.sourceSpanEnd !== null ? { sourceSpanEnd: e.sourceSpanEnd } : {}),
      ...(e.inferenceBasis !== null
        ? { inferenceBasis: e.inferenceBasis }
        : {}),
      ...(e.resolutionHint !== null
        ? { resolutionHint: e.resolutionHint }
        : {}),
      ...(e.conflictsWithId !== null && position.has(e.conflictsWithId)
        ? { conflictsWithIndex: position.get(e.conflictsWithId) as number }
        : {}),
    })),
  };

  const components = [];
  for (const component of model.components) {
    const references = await prisma.contextReference.findMany({
      where: {
        referencingType: "architecture_component",
        referencingId: component.componentId,
      },
      select: { contextElementId: true },
    });
    components.push({
      name: component.name,
      responsibility: component.responsibility,
      inputs: component.inputs,
      outputs: component.outputs,
      failureHandling: component.failureHandling,
      ...(component.externalSystem !== null
        ? { externalSystem: component.externalSystem }
        : {}),
      ...(component.integrationDirection !== null
        ? { integrationDirection: component.integrationDirection }
        : {}),
      ordinal: component.ordinal,
      groundedInContextIndices: references
        .map((r) => position.get(r.contextElementId))
        .filter((i): i is number => i !== undefined),
    });
  }

  const dispositions: UnknownDisposition[] = [];
  const raw = model.unknownDispositions;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry === null || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const disposition = record["disposition"];
      if (
        typeof record["context_index"] === "number" &&
        typeof disposition === "string" &&
        (UNKNOWN_DISPOSITIONS as readonly string[]).includes(disposition) &&
        typeof record["statement"] === "string"
      ) {
        dispositions.push({
          contextIndex: record["context_index"],
          disposition: disposition as UnknownDisposition["disposition"],
          statement: record["statement"],
        });
      }
    }
  }

  return {
    context,
    architecture: {
      summary: model.summary,
      dataFlowDescription: model.dataFlowDescription,
      components,
      unknownDispositions: dispositions,
    },
  };
}
