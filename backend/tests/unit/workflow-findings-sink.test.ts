/**
 * Unit — Stage 6W findings reach `RISK_ITEM` (`FR-032`, `docs/15` D-40).
 *
 * `RiskItem.component_id` is NOT NULL with a foreign key: `DB §4.3` decided
 * that "a risk that cannot name what it affects cannot be stored". On the
 * existing-workflow path the thing a finding affects is a *step of the
 * submitted workflow*, and D-40 records why that is storable without a
 * migration — the steps persist through the architecture entities, because
 * those entities model the same structure. Only the provenance differs.
 *
 * So the property under test is the ordering contract: the sink must have
 * written the components before it can write a finding against one, and a
 * finding naming a step nobody persisted must be refused rather than written
 * against a wrong row or a null.
 *
 * The Prisma client is a recording double, so this runs with no database.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createStageResultSink } from "../../src/db/analysis-result-sink.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type {
  ArchitectureResult,
  ContextResult,
  WorkflowFinding,
} from "../../src/nie/contracts.js";

const ANALYSIS_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

/**
 * Stage 3's output, persisted first because `persistArchitecture` grounds each
 * component in a context element it must already be able to name. On this path
 * the "components" are the reviewed workflow's steps, and the grounding rule
 * is the same one — a step the submission does not describe is invented.
 */
const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "A Zapier zap watches a Google Form",
      category: "system",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 33,
      specificityScore: 0.9,
    },
    {
      content: "Submissions are appended to a Google Sheet",
      category: "system",
      provenance: "stated",
      sourceSpanStart: 34,
      sourceSpanEnd: 75,
      specificityScore: 0.9,
    },
  ],
};

const architecture: ArchitectureResult = {
  unknownDispositions: [],
  summary: "A two-hop Zapier workflow",
  dataFlowDescription: "Form → Zapier → Sheet",
  components: [
    {
      name: "Form Watcher",
      responsibility: "Detect new submissions",
      inputs: "Submission events",
      outputs: "Submission payload",
      failureHandling: "Not stated by the submitted workflow",
      ordinal: 0,
      groundedInContextIndices: [0],
    },
    {
      name: "Sheet Appender",
      responsibility: "Append the submission as a row",
      inputs: "Submission payload",
      outputs: "A sheet row",
      failureHandling: "Zapier retries three times",
      ordinal: 1,
      groundedInContextIndices: [1],
    },
  ],
};

const finding = (
  overrides: Partial<WorkflowFinding> = {},
): WorkflowFinding => ({
  componentIndex: 1,
  description: "A paused zap drops submissions with no record",
  severity: 4,
  likelihood: 2,
  remediation: "Reconcile response count against row count daily",
  ...overrides,
});

interface Call {
  readonly model: string;
  readonly args: Record<string, unknown>;
}

const recordingPrisma = () => {
  const calls: Call[] = [];
  let componentSeq = 0;

  let elementSeq = 0;

  const client = () => ({
    contextElement: {
      create: () => {
        elementSeq += 1;
        return Promise.resolve({
          contextElementId: `element-${String(elementSeq)}`,
        });
      },
      update: () => Promise.resolve({}),
    },
    analysis: {
      update: () => Promise.resolve({}),
    },
    architectureModel: {
      create: () => Promise.resolve({ architectureId: "arch-1" }),
    },
    architectureComponent: {
      create: (args: Record<string, unknown>) => {
        componentSeq += 1;
        calls.push({ model: "architectureComponent", args });
        return Promise.resolve({
          componentId: `component-${String(componentSeq)}`,
        });
      },
    },
    contextReference: {
      createMany: (args: Record<string, unknown>) => {
        calls.push({ model: "contextReference", args });
        return Promise.resolve({});
      },
    },
    riskItem: {
      create: (args: Record<string, unknown>) => {
        calls.push({ model: "riskItem", args });
        return Promise.resolve({});
      },
    },
  });

  const prisma = {
    ...client(),
    $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn(client()),
  };

  return { prisma: prisma as unknown as PrismaClient, calls };
};

const dataOf = (call: Call): Record<string, unknown> =>
  call.args["data"] as Record<string, unknown>;

test("a finding is written against the component its index names", async () => {
  const { prisma, calls } = recordingPrisma();
  const sink = createStageResultSink(prisma);

  await sink.persistContext(ANALYSIS_ID, context);
  await sink.persistArchitecture(ANALYSIS_ID, architecture);
  await sink.persistWorkflowFindings?.(ANALYSIS_ID, [finding()]);

  const risks = calls.filter((c) => c.model === "riskItem");
  assert.equal(risks.length, 1);

  const data = dataOf(risks[0] as Call);
  assert.equal(data["analysisId"], ANALYSIS_ID);
  // Index 1 is the second component written, so the second generated id.
  assert.equal(data["componentId"], "component-2");
  assert.equal(data["severity"], 4);
  assert.equal(data["likelihood"], 2);
  // `FR-032` requires a mitigation; the remediation *is* the mitigation, and
  // renaming it in transit is the only difference between the two vocabularies.
  assert.equal(
    data["mitigation"],
    "Reconcile response count against row count daily",
  );
});

test("several findings against one step all resolve to that step", async () => {
  const { prisma, calls } = recordingPrisma();
  const sink = createStageResultSink(prisma);

  await sink.persistContext(ANALYSIS_ID, context);
  await sink.persistArchitecture(ANALYSIS_ID, architecture);
  await sink.persistWorkflowFindings?.(ANALYSIS_ID, [
    finding({ componentIndex: 0 }),
    finding({ componentIndex: 0, description: "No dead-letter path" }),
    finding({ componentIndex: 1 }),
  ]);

  assert.deepEqual(
    calls
      .filter((c) => c.model === "riskItem")
      .map((c) => dataOf(c)["componentId"]),
    ["component-1", "component-1", "component-2"],
  );
});

test("a finding naming a step nobody persisted is refused, not guessed", async () => {
  const { prisma } = recordingPrisma();
  const sink = createStageResultSink(prisma);

  await sink.persistContext(ANALYSIS_ID, context);
  await sink.persistArchitecture(ANALYSIS_ID, architecture);

  await assert.rejects(
    async () =>
      sink.persistWorkflowFindings?.(ANALYSIS_ID, [
        finding({ componentIndex: 5 }),
      ]),
    /names step 5, which was not persisted/,
  );
});

test("findings written before their components are refused outright", async () => {
  // The pipeline orders these calls, but the sink does not take that on trust:
  // writing a risk against a component id it never saw would violate the
  // foreign key at the database and produce a confusing error far from here.
  const { prisma } = recordingPrisma();
  const sink = createStageResultSink(prisma);

  await assert.rejects(
    async () => sink.persistWorkflowFindings?.(ANALYSIS_ID, [finding()]),
    /no components were persisted first/,
  );
});

test("a review with no findings writes no risk rows", async () => {
  // `FR-021` allows a sound workflow. An empty register is the correct
  // outcome, and the soundness statement travels in the artifact, not here.
  const { prisma, calls } = recordingPrisma();
  const sink = createStageResultSink(prisma);

  await sink.persistContext(ANALYSIS_ID, context);
  await sink.persistArchitecture(ANALYSIS_ID, architecture);
  await sink.persistWorkflowFindings?.(ANALYSIS_ID, []);

  assert.equal(calls.filter((c) => c.model === "riskItem").length, 0);
});

test("component ids are scoped per analysis, so concurrent runs cannot cross", async () => {
  const { prisma, calls } = recordingPrisma();
  const sink = createStageResultSink(prisma);
  const other = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  await sink.persistContext(ANALYSIS_ID, context);
  await sink.persistArchitecture(ANALYSIS_ID, architecture);
  await sink.persistContext(other, context);
  await sink.persistArchitecture(other, {
    ...architecture,
    components: [architecture.components[0] as never],
  });

  // The second analysis has one component, so index 1 does not exist for it
  // even though it exists for the first.
  await assert.rejects(
    async () =>
      sink.persistWorkflowFindings?.(other, [finding({ componentIndex: 1 })]),
    /was not persisted/,
  );

  await sink.persistWorkflowFindings?.(ANALYSIS_ID, [
    finding({ componentIndex: 1 }),
  ]);
  const risks = calls.filter((c) => c.model === "riskItem");
  assert.equal(risks.length, 1);
  assert.equal(dataOf(risks[0] as Call)["componentId"], "component-2");
});
