/**
 * Unit — Stage 9, the `portfolio_suggestions` generator (`FR-022`,
 * `docs/12` D-29).
 *
 * Two failure directions are refused here, and they pull opposite ways.
 *
 * **Invention.** A project justified by a gap nobody reported is work the
 * posting never asked for — the Stage 7 grounding discipline, one level up.
 *
 * **Fragmentation.** A model asked for projects will return one per gap. That
 * is the naive generator this stage exists not to be, so a redundant project
 * is rejected and a solo project has to justify itself.
 *
 * Between them sits the property that actually matters to the operator: the
 * smallest set of real systems that closes every decisive technical gap.
 *
 * No provider, no database, no filesystem.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { StageError, type GapItem } from "../../src/nie/contracts.js";
import {
  parsePortfolioSuggestions,
  PortfolioGroundingError,
} from "../../src/nie/stages/portfolio-suggestions.js";

const eligible: readonly GapItem[] = [
  { requirementId: "req-1", priority: "high", whyItMatters: "Zapier" },
  { requirementId: "req-2", priority: "high", whyItMatters: "HubSpot" },
  { requirementId: "req-3", priority: "high", whyItMatters: "Web builders" },
];

const project = (overrides: Record<string, unknown> = {}) => ({
  rank: 1,
  name: "Lead intake and CRM sync",
  complexity: "intermediate",
  primary_gaps: ["req-1", "req-2", "req-3"],
  secondary_capabilities: ["Error handling", "Structured logging"],
  why_this_project: "It exercises all three named platforms in one workflow.",
  business_problem: "Leads arrive by form and are re-keyed into the CRM.",
  what_to_build: "A form-triggered pipeline that qualifies and syncs leads.",
  workflow: ["Trigger: form submission", "Qualify", "Outcome: CRM record"],
  platforms: ["Zapier", "HubSpot", "Webflow"],
  technical_concepts: ["Webhooks", "Field mapping", "Idempotency"],
  evidence_to_produce: [
    { type: "repo", what_it_shows: "The workflow export and its README" },
    { type: "loom", what_it_shows: "A run end to end" },
  ],
  reusability: {
    provenance: "inferred",
    basis: "Zapier and HubSpot are named in this posting's requirements",
    claim: "Likely to transfer to other CRM automation postings",
  },
  estimated_effort: "days",
  portfolio_value:
    "Covers the three platform gaps with one demonstrable system",
  ...overrides,
});

const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    projects: [project()],
    consolidation_rationale:
      "One workflow naturally exercises all three platforms, so one project.",
    ...overrides,
  });

const parse = (text: string, gaps: readonly GapItem[] = eligible) =>
  parsePortfolioSuggestions(text, gaps);

// --- the shape it is supposed to produce ---------------------------------

test("a consolidated single project covering every gap parses", () => {
  const result = parse(body());

  assert.equal(result.projects.length, 1);
  const [first] = result.projects;
  assert.equal(first?.rank, 1);
  assert.equal(first?.complexity, "intermediate");
  assert.deepEqual(first?.primaryGaps, ["req-1", "req-2", "req-3"]);
  assert.equal(first?.estimatedEffort, "days");
  assert.equal(first?.evidenceToProduce.length, 2);
  assert.equal(first?.reusability.provenance, "inferred");
  assert.ok(first?.reusability.basis.length > 0);
  assert.ok(result.consolidationRationale.length > 0);
});

test("projects are returned in rank order", () => {
  const result = parse(
    body({
      projects: [
        project({
          rank: 2,
          name: "Second",
          primary_gaps: ["req-3"],
          why_not_consolidated: "Different platform entirely",
        }),
        project({ rank: 1, name: "First", primary_gaps: ["req-1", "req-2"] }),
      ],
    }),
  );
  assert.deepEqual(
    result.projects.map((p) => p.name),
    ["First", "Second"],
  );
});

// --- grounding: no invented gaps -----------------------------------------

test("a project citing a gap outside the eligible set is rejected", () => {
  assert.throws(
    () => parse(body({ projects: [project({ primary_gaps: ["req-99"] })] })),
    (error: unknown) =>
      error instanceof PortfolioGroundingError &&
      /not one of the decisive technical gaps/.test(error.message),
  );
});

test("a non-technical gap cannot reach this stage at all", () => {
  // Stage 8 filters by kind before Stage 9 is called, so a disposition gap is
  // simply absent from the eligible set — and citing it fails as ungrounded.
  const technicalOnly: readonly GapItem[] = [eligible[0] as GapItem];
  assert.throws(
    () =>
      parse(
        body({
          projects: [project({ primary_gaps: ["req-1", "req-2"] })],
        }),
        technicalOnly,
      ),
    PortfolioGroundingError,
  );
});

test("every eligible gap must be claimed by some project", () => {
  assert.throws(
    () =>
      parse(
        body({
          projects: [project({ primary_gaps: ["req-1", "req-2"] })],
          consolidation_rationale: "x",
        }),
      ),
    (error: unknown) =>
      error instanceof PortfolioGroundingError &&
      /must be addressed by at least one project/.test(error.message) &&
      /req-3/.test(error.message),
  );
});

// --- consolidation: no redundant or lazy fragmentation -------------------

test("a project whose gaps are a subset of another's is rejected", () => {
  assert.throws(
    () =>
      parse(
        body({
          projects: [
            project({ rank: 1, primary_gaps: ["req-1", "req-2", "req-3"] }),
            project({
              rank: 2,
              name: "Redundant",
              primary_gaps: ["req-1"],
              why_not_consolidated: "claims to stand alone",
            }),
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof StageError && /redundant/.test(error.message),
  );
});

test("two projects covering identical gap sets are rejected", () => {
  assert.throws(
    () =>
      parse(
        body({
          projects: [project({ rank: 1 }), project({ rank: 2, name: "Twin" })],
        }),
      ),
    (error: unknown) =>
      error instanceof StageError && /redundant/.test(error.message),
  );
});

test("a single-gap project must justify not being consolidated", () => {
  assert.throws(
    () =>
      parse(
        body({
          projects: [
            project({ rank: 1, primary_gaps: ["req-1", "req-2"] }),
            project({ rank: 2, name: "Solo", primary_gaps: ["req-3"] }),
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof StageError && /why_not_consolidated/.test(error.message),
  );
});

test("a justified single-gap project is allowed", () => {
  const result = parse(
    body({
      projects: [
        project({ rank: 1, primary_gaps: ["req-1", "req-2"] }),
        project({
          rank: 2,
          name: "Video pipeline",
          primary_gaps: ["req-3"],
          why_not_consolidated:
            "Media tooling shares no trigger or datastore with the CRM workflow",
        }),
      ],
    }),
  );
  assert.equal(result.projects.length, 2);
  assert.ok(result.projects[1]?.whyNotConsolidated);
});

// --- evidence is part of the specification -------------------------------

test("a project producing no evidence is rejected", () => {
  assert.throws(
    () => parse(body({ projects: [project({ evidence_to_produce: [] })] })),
    (error: unknown) =>
      error instanceof StageError &&
      /at least one evidence item is required/.test(error.message),
  );
});

test("evidence types come from the profile-compatible vocabulary", () => {
  assert.throws(
    () =>
      parse(
        body({
          projects: [
            project({
              evidence_to_produce: [
                { type: "vibes", what_it_shows: "nothing" },
              ],
            }),
          ],
        }),
      ),
    StageError,
  );
});

// --- reusability is inferred, and says what it rests on -------------------

test("reusability must state its basis", () => {
  assert.throws(
    () =>
      parse(
        body({
          projects: [
            project({
              reusability: { provenance: "inferred", claim: "Very reusable" },
            }),
          ],
        }),
      ),
    StageError,
  );
});

test("reusability claimed as stated fact is rejected", () => {
  // The system has seen one posting and models no market, so a reusability
  // claim can only ever be an inference (`docs/12` D-29).
  assert.throws(
    () =>
      parse(
        body({
          projects: [
            project({
              reusability: {
                provenance: "stated",
                basis: "b",
                claim: "The market demands this",
              },
            }),
          ],
        }),
      ),
    StageError,
  );
});

// --- ordering and closed sets --------------------------------------------

test("rank must be a total order with no gaps or ties", () => {
  for (const ranks of [
    [1, 3],
    [1, 1],
    [0, 1],
    [2, 3],
  ]) {
    assert.throws(
      () =>
        parse(
          body({
            projects: [
              project({ rank: ranks[0], primary_gaps: ["req-1", "req-2"] }),
              project({
                rank: ranks[1],
                name: "Other",
                primary_gaps: ["req-3"],
                why_not_consolidated: "distinct domain",
              }),
            ],
          }),
        ),
      StageError,
      `ranks ${JSON.stringify(ranks)} must be rejected`,
    );
  }
});

test("complexity and effort come from their closed sets", () => {
  for (const overrides of [
    { complexity: "trivial" },
    { estimated_effort: "months" },
  ]) {
    assert.throws(
      () => parse(body({ projects: [project(overrides)] })),
      StageError,
    );
  }
});

test("an empty project list is rejected when a build was decided", () => {
  assert.throws(() => parse(body({ projects: [] })), StageError);
});

test("no eligible gaps means the stage should never have been called", () => {
  assert.throws(() => parse(body(), []), StageError);
});

test("a malformed response fails the stage rather than half-parsing", () => {
  assert.throws(() => parse("not json"), StageError);
});

// --- D-70: the implementation block ----------------------------------------

const implementation = {
  platform: "n8n",
  steps: [
    {
      step: 1,
      node: "Webhook",
      purpose: "Receive the form submission",
      setup: ["HTTP method: POST", "Respond: Immediately"],
      credential: null,
    },
    {
      step: 3,
      node: "HubSpot",
      purpose: "Create or update the contact",
      setup: ["Resource: Contact", "Operation: Create/Update", "Map email"],
      credential: "HubSpot OAuth2 API",
    },
  ],
  notes: ["Attach an Error Workflow that posts to Slack on failure"],
};

test("D-70 — an implementation block is read, node by node, with its credential or null", () => {
  const result = parse(body({ projects: [project({ implementation })] }));
  const plan = result.projects[0]?.implementation;
  assert.ok(plan !== undefined);
  assert.equal(plan.platform, "n8n");
  assert.equal(plan.steps.length, 2);
  assert.deepEqual(plan.steps[0], {
    step: 1,
    node: "Webhook",
    purpose: "Receive the form submission",
    setup: ["HTTP method: POST", "Respond: Immediately"],
    credential: null,
  });
  assert.equal(plan.steps[1]?.credential, "HubSpot OAuth2 API");
  assert.deepEqual(plan.notes, [
    "Attach an Error Workflow that posts to Slack on failure",
  ]);
});

test("D-70 — null or absent means no implementation, and nothing is invented", () => {
  const absent = parse(body({ projects: [project()] }));
  assert.equal(absent.projects[0]?.implementation, undefined);
  const nulled = parse(body({ projects: [project({ implementation: null })] }));
  assert.equal(nulled.projects[0]?.implementation, undefined);
});

test("D-70 — a node that points at no workflow step is refused", () => {
  const bad = {
    ...implementation,
    steps: [{ ...implementation.steps[0], step: 0 }],
  };
  assert.throws(
    () => parse(body({ projects: [project({ implementation: bad })] })),
    StageError,
  );
  const badCredential = {
    ...implementation,
    steps: [{ ...implementation.steps[0], credential: 42 }],
  };
  assert.throws(
    () =>
      parse(body({ projects: [project({ implementation: badCredential })] })),
    StageError,
  );
});
