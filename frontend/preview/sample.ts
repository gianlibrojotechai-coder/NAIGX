/** Sample analysis for the preview — modelled on a RevOps posting. Not real. */
import type { Analysis } from "../src/api/types";

type GapShape = {
  priority: "high" | "medium" | "low";
  decisive: boolean;
  buildable: boolean;
} | null;

const req = (
  id: string,
  name: string,
  necessity: "must_have" | "nice_to_have",
  status: "evidenced" | "gap",
  gap: GapShape,
) => ({
  id,
  name,
  necessity,
  kind: "technical",
  provenance: "stated" as const,
  status,
  evidence:
    status === "evidenced"
      ? [
          {
            capability_id: "cap-1",
            strength: "strong" as const,
            evidence_ref: "profile",
          },
        ]
      : [],
  gap: gap === null ? null : { ...gap, why_it_matters: "Named in the posting." },
});

const requirements = [
  req("req-1", "n8n or Make workflow design", "must_have", "evidenced", null),
  req("req-2", "HubSpot CRM administration", "must_have", "gap", {
    priority: "high",
    decisive: true,
    buildable: true,
  }),
  req("req-3", "Lead routing and deduplication", "must_have", "gap", {
    priority: "high",
    decisive: true,
    buildable: true,
  }),
  req("req-4", "REST API integration", "must_have", "evidenced", null),
  req("req-5", "Google Sheets reporting", "must_have", "evidenced", null),
  req("req-6", "Slack alerting", "nice_to_have", "evidenced", null),
  req("req-7", "Data quality monitoring", "must_have", "gap", {
    priority: "medium",
    decisive: false,
    buildable: true,
  }),
  req("req-8", "Stakeholder requirements gathering", "must_have", "evidenced", null),
  req("req-9", "Documentation of automations", "must_have", "evidenced", null),
  req("req-10", "Salesforce experience", "nice_to_have", "gap", {
    priority: "low",
    decisive: false,
    buildable: false,
  }),
  req("req-11", "SQL for reporting", "nice_to_have", "gap", {
    priority: "medium",
    decisive: false,
    buildable: true,
  }),
  req("req-12", "Error handling and retries", "must_have", "evidenced", null),
];

const evidenced = requirements.filter((r) => r.status === "evidenced").length;
const gaps = requirements.filter((r) => r.status === "gap");

const step = (
  n: number,
  node: string,
  purpose: string,
  setup: string[],
  credential: string | null,
) => ({ step: n, node, purpose, setup, credential });

export const sample: Analysis = {
  analysis_id: "preview-0001",
  status: "completed",
  created_at: "2026-09-29T03:57:39Z",
  completed_at: "2026-09-29T04:02:01Z",
  derived_title: "RevOps Automation Specialist",
  sufficiency_level: "sufficient",
  overall_confidence_band: "medium",
  overall_confidence: null,
  degraded: false,
  timed_out: false,
  input: {
    character_count: 3120,
    source_type: "pasted",
    content:
      "RevOps Automation Specialist\n\nSalford, UK - hybrid, 3 days on site\n£45,000 - £52,000 depending on experience\n\nWe are a B2B SaaS company selling into UK manufacturing.",
  },
  classification: {
    determined_type: "job_description",
    confidence: 0.97,
    candidate_types: ["job_description"],
    was_low_confidence: false,
    user_override_type: null,
    overridden_at: null,
  },
  intent: {
    primary_objective:
      "A Series B SaaS company wants one person to own the automations that keep leads, deals and reporting moving between HubSpot, the product database and Slack, so revenue operations stop creaking as headcount grows.",
    inferred_scope:
      "Design and run the automations end to end: intake, routing, hygiene, alerts and weekly reporting, with documentation the sales and marketing teams can follow.",
    objective_provenance: null,
  },
  context: [],
  unknowns: [],
  verdict: {
    decision: "build_first",
    rationale:
      "Two must-have requirements, HubSpot administration and lead routing, have no evidence behind them and the posting treats both as the core of the job. Everything else you already cover. One built project closes both.",
    criteria_applied: null,
    confidence_band: "medium",
    confidence_factors: null,
    alternatives: [
      {
        alternative: "Apply now and learn HubSpot on the job",
        rejection_reason:
          "The posting asks for evidence of CRM ownership, not willingness.",
      },
    ],
  },
  requirements: requirements.map((r) => ({
    id: r.id,
    name: r.name,
    necessity: r.necessity,
    provenance: r.provenance,
    kind: r.kind,
    matched: r.evidence,
    gaps:
      r.gap === null
        ? []
        : [
            {
              priority: r.gap.priority,
              why_it_matters: r.gap.why_it_matters,
              decisive: r.gap.decisive,
            },
          ],
  })),
  decisive_gaps: ["req-2", "req-3"],
  artifacts: [
    {
      artifact_type: "intent_brief",
      planned: true,
      outcome: "generated",
      inclusion_reason: null,
      omission_reason: null,
      validation_status: "valid",
      content: {
        standing: "understanding_only",
        objective: {
          content:
            "Own the automations that move leads, deals and reporting between HubSpot, the product database and Slack for a 120-person B2B SaaS company.",
          provenance: "stated",
        },
        secondary_objectives: [
          {
            content: "Cut manual lead handling in the sales team.",
            provenance: "inferred",
          },
          {
            content:
              "Give leadership a weekly pipeline report without spreadsheets.",
            provenance: "stated",
          },
          {
            content: "Document every automation so it survives you.",
            provenance: "stated",
          },
        ],
        inferred_scope:
          "Hybrid role in Salford, three days on site. You would be the only automation owner, reporting to the Head of Revenue Operations.",
      },
    },
    {
      artifact_type: "skill_gap_analysis",
      planned: true,
      outcome: "generated",
      inclusion_reason: null,
      omission_reason: null,
      validation_status: "valid",
      content: {
        standing: "gap_analysis",
        decision: "build_first",
        requirements,
        priorities: gaps.map((g) => ({
          requirement_id: g.id,
          name: g.name,
          necessity: g.necessity,
          priority: g.gap?.priority ?? "low",
          decisive: g.gap?.decisive ?? false,
          buildable: g.gap?.buildable ?? false,
        })),
        summary: {
          requirements: requirements.length,
          must_have: requirements.filter((r) => r.necessity === "must_have")
            .length,
          nice_to_have: requirements.filter(
            (r) => r.necessity === "nice_to_have",
          ).length,
          evidenced,
          gaps: gaps.length,
          decisive_gaps: 2,
        },
      },
    },
    {
      artifact_type: "portfolio_suggestions",
      planned: true,
      outcome: "generated",
      inclusion_reason: null,
      omission_reason: null,
      validation_status: "valid",
      content: {
        consolidation_rationale:
          "One project exercises both decisive gaps against a real CRM.",
        projects: [
          {
            rank: 1,
            name: "Inbound lead router for HubSpot",
            complexity: "moderate",
            primary_gaps: ["req-2", "req-3"],
            business_problem:
              "Web and event leads land in HubSpot unowned and duplicated. Reps pick the ones they notice, the rest go cold, and nobody can say how many were dropped.",
            what_to_build:
              "A workflow that catches every new HubSpot contact, checks for a duplicate by email and company domain, scores it from three fields, assigns an owner by territory, and posts a summary to the sales channel. Log every decision to a sheet so the routing rules can be argued about with data.",
            workflow: [],
            platforms: ["n8n", "HubSpot", "Slack", "Google Sheets"],
            estimated_effort: "two_weekends",
            portfolio_value:
              "Demonstrates CRM ownership and routing logic on a live account.",
            implementation: {
              platform: "n8n",
              steps: [
                step(1, "HubSpot Trigger", "Fire on every new contact.", ["Subscribe to contact.creation"], "HubSpot developer"),
                step(2, "Find duplicates", "Search HubSpot by email and company domain.", ["Search contacts API"], "HubSpot"),
                step(3, "IF duplicate", "Branch: merge into the existing record or continue.", [], null),
                step(4, "Score the lead", "Code node: three fields to a 0 to 100 score.", ["Weights in a Set node"], null),
                step(5, "Assign owner", "Territory lookup from a Google Sheet.", ["Sheet: territory to owner id"], "Google"),
                step(6, "Update HubSpot", "Write score, owner and source to the contact.", ["Update contact"], "HubSpot"),
                step(7, "Notify Slack", "Post the lead card to #sales-inbound.", ["Channel id"], "Slack"),
                step(8, "Log decision", "Append the routing decision to the audit sheet.", ["Append row"], "Google"),
              ],
              notes: ["Run on the HubSpot sandbox first."],
            },
          },
          {
            rank: 2,
            name: "Pipeline hygiene monitor",
            what_to_build:
              "A nightly check that flags deals with no next step, stale close dates or missing amounts, and posts the list to the owner.",
            platforms: ["n8n", "HubSpot", "Slack"],
            estimated_effort: "one_weekend",
          },
          {
            rank: 3,
            name: "Weekly pipeline report",
            what_to_build:
              "A Monday-morning summary of pipeline by stage and owner, built from HubSpot into a Google Sheet and a Slack post.",
            platforms: ["n8n", "HubSpot", "Google Sheets"],
            estimated_effort: "one_weekend",
          },
        ],
      },
    },
    {
      artifact_type: "n8n_workflow",
      planned: true,
      outcome: "generated",
      inclusion_reason: null,
      omission_reason: null,
      validation_status: "valid",
      content: {
        name: "Inbound lead router for HubSpot",
        nodes: [
          { name: "HubSpot Trigger", type: "n8n-nodes-base.hubspotTrigger", typeVersion: 1, parameters: {} },
          { name: "Find duplicates", type: "n8n-nodes-base.hubspot", typeVersion: 2, parameters: {} },
          { name: "IF duplicate", type: "n8n-nodes-base.if", typeVersion: 2, parameters: {} },
          { name: "Score the lead", type: "n8n-nodes-base.code", typeVersion: 2, parameters: {} },
          { name: "Assign owner", type: "n8n-nodes-base.googleSheets", typeVersion: 4, parameters: {} },
          { name: "Update HubSpot", type: "n8n-nodes-base.hubspot", typeVersion: 2, parameters: {} },
          { name: "Notify Slack", type: "n8n-nodes-base.slack", typeVersion: 2, parameters: {} },
          { name: "Log decision", type: "n8n-nodes-base.googleSheets", typeVersion: 4, parameters: {} },
        ],
        connections: {},
        settings: {},
        naigx: {
          standing: "scaffold",
          platform: "n8n",
          steps_mapped: 8,
          steps_unmapped: [],
        },
      },
    },
  ],
};
