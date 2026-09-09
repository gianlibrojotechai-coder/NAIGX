/**
 * n8n Workflow — the portfolio project's implementation plan, as a file n8n
 * imports ([D-71](../../../../docs/46-D-71-N8n-Workflow-Scaffold.md)).
 *
 * The owner asked to have the workflow "built in n8n directly, with notes on
 * why it was built that way, so I can build it myself with a guide". This
 * renderer turns the Stage 9 `implementation` block into n8n's own workflow
 * document: one node per step, placed left to right and wired in order, and
 * beside every node a sticky note carrying what the model said about it —
 * the purpose, the setup, the credential — plus a header note with why the
 * project exists and a closing note with the wiring advice.
 *
 * ⚠️ IT IS A SCAFFOLD, AND SAYS SO IN ITS FIRST NOTE. Node *types* and the
 * *wiring* are real and import cleanly. Node *parameters* are left at their
 * defaults, because a field value the model did not state would be invented
 * — the setup lines are prose for a person, and the note beside each node
 * carries them. A node whose n8n type this renderer does not know becomes a
 * placeholder (`No Operation`) named after it, and its note says to replace
 * it: the model's word for the node is kept, never silently mapped to
 * something else.
 *
 * Deterministic (`docs/15` D-40): the same implementation block renders the
 * same file. No provider call, no retry.
 */

import type {
  ArtifactPlanEntry,
  PortfolioProject,
  PortfolioSuggestions,
} from "../contracts.js";

/**
 * The n8n node types this renderer maps by name. Keys are matched against
 * the lower-cased model-given node name — exact, or as a leading word — so
 * "Salesforce" and "Salesforce (search)" both map. Versions are deliberately
 * old ones every current n8n still imports; a newer version would only
 * matter for parameters, which are not set.
 */
const NODE_TYPES: readonly {
  readonly match: string;
  readonly type: string;
  readonly typeVersion: number;
  readonly trigger?: boolean;
}[] = [
  {
    match: "webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 1,
    trigger: true,
  },
  {
    match: "schedule trigger",
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1,
    trigger: true,
  },
  {
    match: "cron",
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1,
    trigger: true,
  },
  {
    match: "manual trigger",
    type: "n8n-nodes-base.manualTrigger",
    typeVersion: 1,
    trigger: true,
  },
  { match: "http request", type: "n8n-nodes-base.httpRequest", typeVersion: 3 },
  { match: "if", type: "n8n-nodes-base.if", typeVersion: 1 },
  { match: "switch", type: "n8n-nodes-base.switch", typeVersion: 1 },
  { match: "set", type: "n8n-nodes-base.set", typeVersion: 2 },
  { match: "edit fields", type: "n8n-nodes-base.set", typeVersion: 2 },
  { match: "code", type: "n8n-nodes-base.code", typeVersion: 1 },
  { match: "function", type: "n8n-nodes-base.code", typeVersion: 1 },
  { match: "merge", type: "n8n-nodes-base.merge", typeVersion: 2 },
  { match: "split out", type: "n8n-nodes-base.splitOut", typeVersion: 1 },
  {
    match: "split in batches",
    type: "n8n-nodes-base.splitInBatches",
    typeVersion: 1,
  },
  {
    match: "loop over items",
    type: "n8n-nodes-base.splitInBatches",
    typeVersion: 1,
  },
  { match: "wait", type: "n8n-nodes-base.wait", typeVersion: 1 },
  { match: "filter", type: "n8n-nodes-base.filter", typeVersion: 1 },
  {
    match: "remove duplicates",
    type: "n8n-nodes-base.removeDuplicates",
    typeVersion: 1,
  },
  { match: "hubspot", type: "n8n-nodes-base.hubspot", typeVersion: 1 },
  { match: "salesforce", type: "n8n-nodes-base.salesforce", typeVersion: 1 },
  { match: "postgres", type: "n8n-nodes-base.postgres", typeVersion: 1 },
  { match: "postgresql", type: "n8n-nodes-base.postgres", typeVersion: 1 },
  { match: "mysql", type: "n8n-nodes-base.mySql", typeVersion: 1 },
  { match: "airtable", type: "n8n-nodes-base.airtable", typeVersion: 1 },
  {
    match: "google sheets",
    type: "n8n-nodes-base.googleSheets",
    typeVersion: 3,
  },
  { match: "gmail", type: "n8n-nodes-base.gmail", typeVersion: 1 },
  { match: "send email", type: "n8n-nodes-base.emailSend", typeVersion: 1 },
  { match: "slack", type: "n8n-nodes-base.slack", typeVersion: 1 },
  { match: "telegram", type: "n8n-nodes-base.telegram", typeVersion: 1 },
  { match: "notion", type: "n8n-nodes-base.notion", typeVersion: 2 },
  { match: "openai", type: "n8n-nodes-base.openAi", typeVersion: 1 },
  {
    match: "respond to webhook",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1,
  },
];

const PLACEHOLDER = { type: "n8n-nodes-base.noOp", typeVersion: 1 } as const;

const resolveType = (
  node: string,
): { type: string; typeVersion: number; trigger: boolean; mapped: boolean } => {
  const name = node.trim().toLowerCase();
  const hit =
    NODE_TYPES.find((n) => name === n.match) ??
    NODE_TYPES.find((n) => name.startsWith(`${n.match} `)) ??
    NODE_TYPES.find((n) => name.startsWith(`${n.match}(`)) ??
    NODE_TYPES.find((n) => name.startsWith(`${n.match}:`));
  return hit === undefined
    ? { ...PLACEHOLDER, trigger: false, mapped: false }
    : {
        type: hit.type,
        typeVersion: hit.typeVersion,
        trigger: hit.trigger === true,
        mapped: true,
      };
};

/** Whether a portfolio's rank-1 project carries an n8n implementation. */
export const n8nProjectOf = (
  portfolio: PortfolioSuggestions,
): PortfolioProject | null => {
  const project = [...portfolio.projects].sort((a, b) => a.rank - b.rank)[0];
  if (project === undefined || project.implementation === undefined)
    return null;
  return /\bn8n\b/i.test(project.implementation.platform) ? project : null;
};

/**
 * The plan entry — written at Stage 9, when the implementation block exists,
 * the way the intent brief is written at Stage 2 (D-66). Planned exactly
 * when the rank-1 project's implementation is on n8n; omitted, with the
 * reason, otherwise. `FR-091`: the reader sees a decision, not an absence.
 */
export const planN8nWorkflow = (
  portfolio: PortfolioSuggestions | undefined,
): readonly ArtifactPlanEntry[] => {
  if (portfolio === undefined) {
    return [
      {
        artifactType: "n8n_workflow",
        planned: false,
        depthLevel: "standard",
        omissionReason:
          "No portfolio was generated, so there is no implementation plan to render into a workflow.",
      },
    ];
  }
  const project = n8nProjectOf(portfolio);
  if (project === null) {
    const first = [...portfolio.projects].sort((a, b) => a.rank - b.rank)[0];
    return [
      {
        artifactType: "n8n_workflow",
        planned: false,
        depthLevel: "standard",
        omissionReason:
          first?.implementation === undefined
            ? "The portfolio's first project has no automation-platform implementation plan, so there is nothing to render into an n8n workflow."
            : `The portfolio's first project is planned on ${first.implementation.platform}, not n8n; only n8n import files are rendered.`,
      },
    ];
  }
  return [
    {
      artifactType: "n8n_workflow",
      planned: true,
      depthLevel: "standard",
      inclusionReason:
        "Rendered from the portfolio project's n8n implementation plan: one node per step, wired in order, each with a note carrying its purpose, setup and credential (D-71). A scaffold — parameters are left for the builder.",
    },
  ];
};

interface N8nNode {
  readonly parameters: Record<string, unknown>;
  readonly name: string;
  readonly type: string;
  readonly typeVersion: number;
  readonly position: readonly [number, number];
  readonly notes?: string;
}

const sticky = (
  name: string,
  content: string,
  position: readonly [number, number],
  size: { width: number; height: number },
  color = 1,
): N8nNode => ({
  parameters: { content, height: size.height, width: size.width, color },
  name,
  type: "n8n-nodes-base.stickyNote",
  typeVersion: 1,
  position,
});

const COLUMN = 300;
const NODE_Y = 420;
const NOTE_Y = 40;

/**
 * Renders the import file. Pure: the same project renders the same file.
 */
export const renderN8nWorkflow = (
  project: PortfolioProject,
): Record<string, unknown> => {
  const implementation = project.implementation;
  if (implementation === undefined) {
    throw new Error(
      "renderN8nWorkflow: the project has no implementation plan",
    );
  }
  const steps = [...implementation.steps].sort((a, b) => a.step - b.step);
  const nodes: N8nNode[] = [];
  const connections: Record<
    string,
    { main: { node: string; type: "main"; index: number }[][] }
  > = {};
  const used = new Map<string, number>();
  const unmapped: string[] = [];

  // A unique n8n node name per step: n8n keys connections by name.
  const uniqueName = (base: string): string => {
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} ${String(count)}`;
  };

  nodes.push(
    sticky(
      "README — read this first",
      [
        `## ${project.name}`,
        "",
        "**This is a scaffold generated by NAIGX, not a finished workflow.** The node types and the wiring are real and import as-is. Every node's parameters are still at their defaults: open each node and set it up following the note beside it. Nothing here was invented — a value the analysis did not state was left for you to enter.",
        "",
        `**Why this project.** ${project.whyThisProject}`,
        "",
        `**The business problem.** ${project.businessProblem}`,
        "",
        `**What to build.** ${project.whatToBuild}`,
        "",
        "**How to use this file.** In n8n: Workflows → Import from File. Then work left to right: read the note above each node, open the node, set what the note says, attach the named credential (Credentials → Add), and run with pinned test data before pointing it at live systems.",
        "",
        "Grey placeholder nodes are steps whose n8n node NAIGX could not map by name; the note says what to replace them with.",
      ].join("\n"),
      [-40, NOTE_Y - 20],
      { width: 620, height: 400 },
      4,
    ),
  );

  let previous: string | null = null;
  steps.forEach((step, index) => {
    const resolved = resolveType(step.node);
    const workflowLine =
      project.workflow[step.step - 1] ?? `Step ${String(step.step)}`;
    const name = uniqueName(
      resolved.mapped ? step.node.trim() : `${step.node.trim()} (replace me)`,
    );
    if (!resolved.mapped) unmapped.push(step.node);
    const x = 700 + index * COLUMN;

    nodes.push({
      parameters: {},
      name,
      type: resolved.type,
      typeVersion: resolved.typeVersion,
      position: [x, NODE_Y],
      notes: step.purpose,
    });

    nodes.push(
      sticky(
        `Note — step ${String(step.step)}`,
        [
          `### Step ${String(step.step)} · ${step.node}`,
          `*${workflowLine}*`,
          "",
          `**Why this node.** ${step.purpose}`,
          "",
          "**Set it up:**",
          ...step.setup.map((line) => `- ${line}`),
          "",
          `**Credential:** ${step.credential ?? "none"}`,
          ...(resolved.mapped
            ? []
            : [
                "",
                `⚠️ NAIGX could not map "${step.node}" to an n8n node type by name. Replace this placeholder with the right node (search the node panel for it, or use HTTP Request against the service's API).`,
              ]),
        ].join("\n"),
        [x - 20, NOTE_Y],
        { width: 260, height: 340 },
        resolved.mapped ? 1 : 3,
      ),
    );

    // Wiring: linear, in step order. A trigger starts a new chain — nothing
    // feeds a trigger, so the previous node is left unconnected to it.
    if (previous !== null && !resolved.trigger) {
      connections[previous] = {
        main: [[{ node: name, type: "main", index: 0 }]],
      };
    }
    previous = name;
  });

  if (implementation.notes.length > 0) {
    nodes.push(
      sticky(
        "Wiring notes",
        [
          "### Wiring notes",
          "",
          ...implementation.notes.map((n) => `- ${n}`),
        ].join("\n"),
        [700 + steps.length * COLUMN, NOTE_Y],
        { width: 360, height: 340 },
        5,
      ),
    );
  }

  return {
    name: `NAIGX scaffold — ${project.name}`.slice(0, 120),
    nodes,
    connections,
    settings: { executionOrder: "v1" },
    // `DP-1`: retrieved whole. The standing is in the document so a reader of
    // the stored artifact, not only of the note, knows what it is.
    naigx: {
      standing: "scaffold",
      platform: implementation.platform,
      steps_mapped: steps.length - unmapped.length,
      steps_unmapped: unmapped,
    },
  };
};
