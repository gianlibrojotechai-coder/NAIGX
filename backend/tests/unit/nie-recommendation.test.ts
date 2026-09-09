/**
 * Unit — Stage 7, Recommendation Generation on the job-description path
 * (`FR-022`).
 *
 * The property that matters is that a verdict cannot be reached on invented
 * material. A requirement the posting does not support manufactures a gap; a
 * match on a capability that does not exist, or that is only `familiar`,
 * manufactures readiness. Both directions are rejected here, so most of these
 * tests are about refusing a plausible-looking recommendation.
 *
 * `apply_now` is tested as a first-class outcome, not an edge case — a system
 * that cannot say "you already have enough evidence" is a project generator.
 *
 * No provider, no database, no filesystem.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isBuildableKind,
  StageError,
  REQUIREMENT_KINDS,
  type ContextResult,
} from "../../src/nie/contracts.js";
import {
  parseRecommendation,
  RecommendationGroundingError,
} from "../../src/nie/stages/recommendation-generation.js";
import {
  parseCapabilityProfile,
  type CapabilityProfile,
} from "../../src/nie/capability-profile.js";

const context: ContextResult = {
  sufficiency: "sufficient",
  elements: [
    {
      content: "n8n is the automation platform in use",
      category: "system",
      provenance: "stated",
      sourceSpanStart: 0,
      sourceSpanEnd: 10,
      specificityScore: 0.9,
    },
    {
      content: "HubSpot CRM integration is required",
      category: "system",
      provenance: "stated",
      sourceSpanStart: 11,
      sourceSpanEnd: 20,
      specificityScore: 0.9,
    },
    {
      content: "Error handling and retries expected",
      category: "constraint",
      provenance: "inferred",
      inferenceBasis: "The posting names production reliability",
      specificityScore: 0.6,
    },
  ],
};

const profile: CapabilityProfile =
  parseCapabilityProfile(`profile_version: profile-v1
owner: test-operator
capabilities:
  - id: cap-001
    name: Multi-system workflow orchestration
    platforms: [n8n]
    depth: demonstrated
    evidence:
      - type: workflow
        locator: https://example.invalid/lead-routing.json
        description: Nine-node lead routing workflow with an error branch
  - id: cap-002
    name: CRM integration
    platforms: [HubSpot]
    depth: familiar
    evidence:
      - type: doc
        locator: https://example.invalid/notes.md
        description: Notes from reading the HubSpot API docs
`);

const requirement = (overrides: Record<string, unknown> = {}) => ({
  id: "req-1",
  name: "Build automations in n8n",
  necessity: "must_have",
  provenance: "stated",
  kind: "technical",
  grounded_in_context_indices: [0],
  ...overrides,
});

const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    required_capabilities: [requirement()],
    matched: [
      {
        requirement_id: "req-1",
        capability_id: "cap-001",
        strength: "strong",
        evidence_ref: "https://example.invalid/lead-routing.json",
      },
    ],
    gaps: [],
    verdict: {
      decision: "apply_now",
      rationale: "The one must-have is already evidenced by a built workflow.",
      decisive_gaps: [],
      criteria_applied:
        "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when no evidenced capability covers it.",
      alternatives: [
        {
          alternative: "Apply now without building",
          rejection_reason: "The decisive gap has no built evidence behind it.",
        },
      ],
    },
    ...overrides,
  });

const parse = (text: string) => parseRecommendation(text, context, profile);

// --- apply_now is a first-class outcome ----------------------------------

test("an apply_now verdict parses and cites its evidence", () => {
  const result = parse(body());

  assert.equal(result.verdict.decision, "apply_now");
  assert.deepEqual(result.verdict.decisiveGaps, []);
  assert.equal(result.requiredCapabilities.length, 1);
  assert.equal(result.requiredCapabilities[0]?.necessity, "must_have");
  assert.equal(result.matched[0]?.capabilityId, "cap-001");
  assert.equal(
    result.matched[0]?.evidenceRef,
    "https://example.invalid/lead-routing.json",
    "the match points at an artifact a reader could open",
  );
});

test("a build_first verdict parses when it names what would close the gap", () => {
  const result = parse(
    body({
      required_capabilities: [
        requirement(),
        requirement({
          id: "req-2",
          name: "HubSpot CRM integration",
          grounded_in_context_indices: [1],
        }),
      ],
      gaps: [
        {
          requirement_id: "req-2",
          priority: "high",
          why_it_matters: "Every workflow in the posting terminates in the CRM",
        },
      ],
      verdict: {
        decision: "build_first",
        rationale: "CRM integration is a must-have with no evidence behind it.",
        decisive_gaps: ["req-2"],
        criteria_applied:
          "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when no evidenced capability covers it.",
        alternatives: [
          {
            alternative: "Apply now without building",
            rejection_reason:
              "The decisive gap has no built evidence behind it.",
          },
        ],
      },
    }),
  );

  assert.equal(result.verdict.decision, "build_first");
  assert.deepEqual(result.verdict.decisiveGaps, ["req-2"]);
  assert.equal(result.gaps[0]?.priority, "high");
});

// --- requirements must trace to the posting ------------------------------

test("a requirement grounded in nothing is rejected as invented", () => {
  assert.throws(
    () =>
      parse(
        body({
          required_capabilities: [
            requirement({ grounded_in_context_indices: [] }),
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /grounded in no context element/.test(error.message),
  );
});

test("a requirement citing a context element that does not exist is rejected", () => {
  assert.throws(
    () =>
      parse(
        body({
          required_capabilities: [
            requirement({ grounded_in_context_indices: [7] }),
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /has 3 element\(s\) with indices 0-2/.test(error.message),
  );
});

test("required_capabilities may not be empty", () => {
  // A posting with nothing extractable is a Stage 3 sufficiency judgement.
  assert.throws(
    () => parse(body({ required_capabilities: [], matched: [], gaps: [] })),
    StageError,
  );
});

// --- matches must cite real, usable evidence -----------------------------

test("a match on a capability outside the profile is rejected", () => {
  assert.throws(
    () =>
      parse(
        body({
          matched: [
            {
              requirement_id: "req-1",
              capability_id: "cap-999",
              strength: "strong",
              evidence_ref: "https://example.invalid/lead-routing.json",
            },
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /not in the capability profile/.test(error.message),
  );
});

test("a match on a familiar capability is rejected, not downgraded", () => {
  // The decisive refusal: familiarity is not demonstrated ability, and a match
  // on it is how a gap analysis talks itself into applying too early.
  assert.throws(
    () =>
      parse(
        body({
          matched: [
            {
              requirement_id: "req-1",
              capability_id: "cap-002",
              strength: "partial",
              evidence_ref: "https://example.invalid/notes.md",
            },
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /familiarity is not demonstrated ability/.test(error.message),
  );
});

test("a match citing an evidence locator the capability does not have is rejected", () => {
  assert.throws(
    () =>
      parse(
        body({
          matched: [
            {
              requirement_id: "req-1",
              capability_id: "cap-001",
              strength: "strong",
              evidence_ref: "https://example.invalid/something-else.json",
            },
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /is not a locator on capability/.test(error.message),
  );
});

/**
 * ⚠️ THE TWO FAILURE MODES THAT COST THREE PAID JOB-DESCRIPTION CAPTURES.
 *
 * Both are subtler than the foreign-URL case above: each cites a string that
 * really does appear in the profile, or really is a prefix of one, so a check
 * looser than exact equality against *that capability's* locators would let
 * them through. The prompt was tightened for these; these keep the validator
 * honest whatever the prompt says.
 */
test("a match BORROWING a real locator from another capability is rejected", () => {
  // jd-001's shape: `https://example.invalid/notes.md` is a genuine declared
  // locator — on cap-002, not on the cap-001 this match names.
  assert.throws(
    () =>
      parse(
        body({
          matched: [
            {
              requirement_id: "req-1",
              capability_id: "cap-001",
              strength: "strong",
              evidence_ref: "https://example.invalid/notes.md",
            },
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /is not a locator on capability/.test(error.message),
  );
});

test("a match ADDING an anchor to a declared locator is rejected", () => {
  // jd-002's shape: the locator is real and the file exists; the fragment was
  // invented. `#business-logic` on a README that declares `#workflow-breakdown`
  // is a citation a reader cannot open, which is what the rule protects.
  assert.throws(
    () =>
      parse(
        body({
          matched: [
            {
              requirement_id: "req-1",
              capability_id: "cap-001",
              strength: "strong",
              evidence_ref:
                "https://example.invalid/lead-routing.json#error-branch",
            },
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /is not a locator on capability/.test(error.message),
  );
});

test("the exact declared locator is accepted — the rule is not simply strict", () => {
  // Without this the two rejections above would also pass against a validator
  // that refused everything.
  const result = parse(
    body({
      matched: [
        {
          requirement_id: "req-1",
          capability_id: "cap-001",
          strength: "strong",
          evidence_ref: "https://example.invalid/lead-routing.json",
        },
      ],
      gaps: [],
    }),
  );

  assert.equal(
    result.matched[0]?.evidenceRef,
    "https://example.invalid/lead-routing.json",
  );
});

test("a match or gap naming an unknown requirement is rejected", () => {
  for (const overrides of [
    {
      matched: [
        {
          requirement_id: "req-nope",
          capability_id: "cap-001",
          strength: "strong",
          evidence_ref: "https://example.invalid/lead-routing.json",
        },
      ],
    },
    {
      gaps: [
        { requirement_id: "req-nope", priority: "high", why_it_matters: "x" },
      ],
    },
  ]) {
    assert.throws(() => parse(body(overrides)), RecommendationGroundingError);
  }
});

// --- the verdict must be coherent ----------------------------------------

test("a requirement cannot be both matched and a gap", () => {
  assert.throws(
    () =>
      parse(
        body({
          gaps: [
            { requirement_id: "req-1", priority: "high", why_it_matters: "x" },
          ],
          verdict: {
            decision: "build_first",
            rationale: "x",
            decisive_gaps: ["req-1"],
            criteria_applied:
              "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when no evidenced capability covers it.",
            alternatives: [
              {
                alternative: "Apply now without building",
                rejection_reason:
                  "The decisive gap has no built evidence behind it.",
              },
            ],
          },
        }),
      ),
    (error: unknown) =>
      error instanceof StageError &&
      /both matched and a gap/.test(error.message),
  );
});

test("build_first must name at least one decisive gap", () => {
  assert.throws(
    () =>
      parse(
        body({
          verdict: {
            decision: "build_first",
            rationale: "Felt like it",
            decisive_gaps: [],
            criteria_applied:
              "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when no evidenced capability covers it.",
            alternatives: [
              {
                alternative: "Apply now without building",
                rejection_reason:
                  "The decisive gap has no built evidence behind it.",
              },
            ],
          },
        }),
      ),
    (error: unknown) =>
      error instanceof StageError &&
      /must name at least one decisive gap/.test(error.message),
  );
});

test("apply_now must not name decisive gaps", () => {
  assert.throws(
    () =>
      parse(
        body({
          required_capabilities: [
            requirement(),
            requirement({ id: "req-2", grounded_in_context_indices: [1] }),
          ],
          gaps: [
            { requirement_id: "req-2", priority: "low", why_it_matters: "x" },
          ],
          verdict: {
            decision: "apply_now",
            rationale: "x",
            decisive_gaps: ["req-2"],
            criteria_applied:
              "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when no evidenced capability covers it.",
            alternatives: [
              {
                alternative: "Apply now without building",
                rejection_reason:
                  "The decisive gap has no built evidence behind it.",
              },
            ],
          },
        }),
      ),
    (error: unknown) =>
      error instanceof StageError &&
      /must not name decisive gaps/.test(error.message),
  );
});

test("decisive_gaps must reference a reported gap", () => {
  assert.throws(
    () =>
      parse(
        body({
          verdict: {
            decision: "build_first",
            rationale: "x",
            decisive_gaps: ["req-1"],
            criteria_applied:
              "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when no evidenced capability covers it.",
            alternatives: [
              {
                alternative: "Apply now without building",
                rejection_reason:
                  "The decisive gap has no built evidence behind it.",
              },
            ],
          },
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /not one of the reported gaps/.test(error.message),
  );
});

// --- structural -----------------------------------------------------------

test("duplicate requirement ids are rejected", () => {
  assert.throws(
    () =>
      parse(
        body({
          required_capabilities: [requirement(), requirement()],
          matched: [],
          gaps: [],
        }),
      ),
    (error: unknown) =>
      error instanceof StageError && /duplicate id/.test(error.message),
  );
});

test("necessity, provenance, strength and priority come from their closed sets", () => {
  const bad: readonly Record<string, unknown>[] = [
    { required_capabilities: [requirement({ necessity: "would_be_nice" })] },
    { required_capabilities: [requirement({ provenance: "unknown" })] },
    {
      matched: [
        {
          requirement_id: "req-1",
          capability_id: "cap-001",
          strength: "vibes",
          evidence_ref: "https://example.invalid/lead-routing.json",
        },
      ],
    },
    {
      gaps: [
        { requirement_id: "req-1", priority: "urgent", why_it_matters: "x" },
      ],
    },
  ];

  for (const overrides of bad) {
    assert.throws(() => parse(body(overrides)), StageError);
  }
});

test("a malformed response fails the stage rather than half-parsing", () => {
  assert.throws(() => parse("not json"), StageError);
});

// --- D-28: a requirement's kind decides what closing it would take --------

test("kind is required and comes from its closed set", () => {
  const { kind: _dropped, ...withoutKind } = requirement();
  assert.throws(
    () => parse(body({ required_capabilities: [withoutKind] })),
    StageError,
    "a requirement with no kind cannot be judged buildable or not",
  );
  assert.throws(
    () =>
      parse(
        body({ required_capabilities: [requirement({ kind: "soft_skill" })] }),
      ),
    StageError,
  );
});

test("isBuildableKind admits technical alone", () => {
  assert.equal(isBuildableKind("technical"), true);
  for (const kind of REQUIREMENT_KINDS.filter((k) => k !== "technical")) {
    assert.equal(
      isBuildableKind(kind),
      false,
      `${kind} must not be buildable — no project closes it`,
    );
  }
});

/** A — the case the rule exists to permit. */
test("A — a technical gap may be decisive and reach build_first", () => {
  const result = parse(
    body({
      required_capabilities: [
        requirement(),
        requirement({
          id: "req-2",
          name: "HubSpot CRM integration",
          kind: "technical",
          grounded_in_context_indices: [1],
        }),
      ],
      gaps: [
        {
          requirement_id: "req-2",
          priority: "high",
          why_it_matters: "Every workflow in the posting terminates in HubSpot",
        },
      ],
      verdict: {
        decision: "build_first",
        rationale: "CRM integration is a must-have with nothing behind it.",
        decisive_gaps: ["req-2"],
        criteria_applied:
          "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when no evidenced capability covers it.",
        alternatives: [
          {
            alternative: "Apply now without building",
            rejection_reason:
              "The decisive gap has no built evidence behind it.",
          },
        ],
      },
    }),
  );

  assert.equal(result.verdict.decision, "build_first");
  assert.deepEqual(result.verdict.decisiveGaps, ["req-2"]);
  assert.equal(result.requiredCapabilities[1]?.kind, "technical");
});

/**
 * B, C, D — a non-buildable gap is reportable but never decisive. These are
 * exactly the requirements the first real run turned into build targets.
 */
for (const [label, kind, name] of [
  ["B", "disposition", "Resourcefulness when facing unfamiliar tasks"],
  ["C", "track_record", "Experience training non-technical team members"],
  ["D", "domain_experience", "Drone / eVTOL / aerospace experience"],
] as const) {
  test(`${label} — a ${kind} gap is reportable but cannot be decisive`, () => {
    const shape = (decisive: readonly string[]) =>
      body({
        required_capabilities: [
          requirement(),
          requirement({
            id: "req-2",
            name,
            kind,
            grounded_in_context_indices: [2],
          }),
        ],
        gaps: [
          {
            requirement_id: "req-2",
            priority: "medium",
            why_it_matters: "The posting asks for it and nothing evidences it",
          },
        ],
        verdict: {
          decision: decisive.length > 0 ? "build_first" : "apply_now",
          rationale: `${name} remains unevidenced.`,
          criteria_applied:
            "Only a technical gap can be closed by building something.",
          decisive_gaps: decisive,
          alternatives: [
            {
              alternative: "Build first",
              rejection_reason: "No technical gap remains unevidenced.",
            },
          ],
        },
      });

    const reported = parse(shape([]));
    assert.equal(reported.gaps.length, 1, "it is reportable as a gap");
    assert.equal(reported.gaps[0]?.requirementId, "req-2");
    assert.equal(reported.verdict.decision, "apply_now");

    assert.throws(
      () => parse(shape(["req-2"])),
      (error: unknown) =>
        error instanceof RecommendationGroundingError &&
        /only a "technical" requirement can be closed by building/.test(
          error.message,
        ),
      `a ${kind} gap must not be able to justify a portfolio build`,
    );
  });
}

test("E — build_first is unreachable when every gap is non-technical", () => {
  // No buildable gap exists to name, so `decisive_gaps` must be empty — and an
  // empty decisive set is already forbidden for build_first. The two rules
  // compose to make the verdict unreachable, which is the intent.
  assert.throws(
    () =>
      parse(
        body({
          required_capabilities: [
            requirement(),
            requirement({
              id: "req-2",
              name: "Operates independently with minimal oversight",
              kind: "disposition",
              grounded_in_context_indices: [2],
            }),
          ],
          gaps: [
            {
              requirement_id: "req-2",
              priority: "high",
              why_it_matters: "The founder expects autonomy",
            },
          ],
          verdict: {
            decision: "build_first",
            rationale: "Autonomy is unevidenced.",
            decisive_gaps: [],
            criteria_applied:
              "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when no evidenced capability covers it.",
            alternatives: [
              {
                alternative: "Apply now without building",
                rejection_reason:
                  "The decisive gap has no built evidence behind it.",
              },
            ],
          },
        }),
      ),
    (error: unknown) =>
      error instanceof StageError &&
      /must name at least one decisive gap/.test(error.message),
  );
});

test("F — apply_now is valid while non-technical gaps remain", () => {
  // Deliberate (`docs/12` D-28): building would not close them, so building
  // first would be false advice. The prompt asks the rationale to say so; that
  // is guidance rather than a mechanical rule, so nothing is asserted on it.
  const result = parse(
    body({
      required_capabilities: [
        requirement(),
        requirement({
          id: "req-2",
          name: "Five years in aerospace",
          kind: "domain_experience",
          grounded_in_context_indices: [2],
        }),
      ],
      gaps: [
        {
          requirement_id: "req-2",
          priority: "high",
          why_it_matters:
            "Sector experience is preferred and cannot be built toward",
        },
      ],
      verdict: {
        decision: "apply_now",
        rationale:
          "The technical must-have is evidenced. Aerospace exposure is missing and no project would close it, so building first would not improve the application.",
        decisive_gaps: [],
        criteria_applied:
          "Must-have technical requirements weighted above nice-to-haves; a gap is decisive when no evidenced capability covers it.",
        alternatives: [
          {
            alternative: "Apply now without building",
            rejection_reason:
              "The decisive gap has no built evidence behind it.",
          },
        ],
      },
    }),
  );

  assert.equal(result.verdict.decision, "apply_now");
  assert.equal(result.gaps.length, 1);
  assert.deepEqual(result.verdict.decisiveGaps, []);
});

test("G — a requirement in neither matched nor gaps is rejected", () => {
  // The defect the first real run exposed: 23 requirements extracted, 21
  // disposed of, and two that silently vanished.
  assert.throws(
    () =>
      parse(
        body({
          required_capabilities: [
            requirement(),
            requirement({
              id: "req-2",
              name: "Drone industry experience",
              kind: "domain_experience",
              grounded_in_context_indices: [2],
            }),
          ],
          gaps: [],
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /must be reported as matched or as a gap/.test(error.message) &&
      /req-2/.test(error.message),
  );
});

test("H — a requirement in both matched and gaps is still rejected", () => {
  assert.throws(
    () =>
      parse(
        body({
          gaps: [
            { requirement_id: "req-1", priority: "high", why_it_matters: "x" },
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof StageError &&
      /both matched and a gap/.test(error.message),
  );
});

test("I — a familiar capability still cannot be matched", () => {
  assert.throws(
    () =>
      parse(
        body({
          required_capabilities: [
            requirement(),
            requirement({
              id: "req-2",
              name: "HubSpot CRM integration",
              grounded_in_context_indices: [1],
            }),
          ],
          matched: [
            {
              requirement_id: "req-1",
              capability_id: "cap-001",
              strength: "strong",
              evidence_ref: "https://example.invalid/lead-routing.json",
            },
            {
              requirement_id: "req-2",
              capability_id: "cap-002",
              strength: "partial",
              evidence_ref: "https://example.invalid/notes.md",
            },
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof RecommendationGroundingError &&
      /familiarity is not demonstrated ability/.test(error.message),
  );
});

// --- FR-034: criteria applied and rejected alternatives -------------------
//
// `AI §3.2` has always specified Stage 7's output as including "the criteria
// applied" and "rejected alternatives with reasons", and `AI-031` makes naming
// what was rejected a Stage 7 responsibility. The parser read neither, so
// `criteria_applied` was stored null and `RecommendationAlternative` stayed
// empty — leaving `docs/10` C-6, the `M-9` instrument, unassessable for every
// analysis NAIGX had ever produced.

test("the criteria applied are parsed and carried", () => {
  const result = parse(
    body({
      verdict: {
        decision: "apply_now",
        rationale: "The CRM gap is decisive.",
        criteria_applied:
          "Must-have technical requirements weighted above nice-to-haves.",
        decisive_gaps: [],
        alternatives: [
          {
            alternative: "Apply now",
            rejection_reason: "The decisive gap has no evidence behind it.",
          },
        ],
      },
    }),
  );

  assert.equal(
    result.verdict.criteriaApplied,
    "Must-have technical requirements weighted above nice-to-haves.",
  );
});

test("a verdict without criteria is refused", () => {
  // `AIP-4` — an unexplained recommendation must be unrepresentable. The
  // database enforces it too; the parser refuses before it gets that far.
  assert.throws(
    () =>
      parse(
        body({
          verdict: {
            decision: "apply_now",
            rationale: "x",
            decisive_gaps: [],
            alternatives: [{ alternative: "Apply now", rejection_reason: "y" }],
          },
        }),
      ),
    /criteria_applied/,
  );
});

test("empty criteria are refused as firmly as absent ones", () => {
  assert.throws(
    () =>
      parse(
        body({
          verdict: {
            decision: "apply_now",
            rationale: "x",
            criteria_applied: "   ",
            decisive_gaps: [],
            alternatives: [{ alternative: "Apply now", rejection_reason: "y" }],
          },
        }),
      ),
    /criteria_applied/,
  );
});

test("at least one rejected alternative is required", () => {
  // `FR-034`: "At least one rejected alternative is named with its reason."
  // A decision with nothing rejected is not a position taken against options.
  assert.throws(
    () =>
      parse(
        body({
          verdict: {
            decision: "apply_now",
            rationale: "x",
            criteria_applied: "y",
            decisive_gaps: [],
            alternatives: [],
          },
        }),
      ),
    /at least one rejected alternative/,
  );
});

test("an alternative without a reason is refused", () => {
  // Naming an option without saying why it lost answers nothing.
  assert.throws(
    () =>
      parse(
        body({
          verdict: {
            decision: "apply_now",
            rationale: "x",
            criteria_applied: "y",
            decisive_gaps: [],
            alternatives: [{ alternative: "Apply now" }],
          },
        }),
      ),
    /rejection_reason/,
  );
});

test("every rejected alternative is carried, in order", () => {
  const result = parse(
    body({
      verdict: {
        decision: "apply_now",
        rationale: "x",
        criteria_applied: "y",
        decisive_gaps: [],
        alternatives: [
          { alternative: "Apply now", rejection_reason: "first" },
          {
            alternative: "Wait for a different posting",
            rejection_reason: "second",
          },
        ],
      },
    }),
  );

  assert.equal(result.verdict.alternatives.length, 2);
  assert.deepEqual(
    result.verdict.alternatives.map((a) => a.rejectionReason),
    ["first", "second"],
  );
});

test("apply_now must also name what it rejected", () => {
  // The requirement is not conditional on the decision. An apply_now verdict
  // that never considered building is as undefended as the reverse.
  assert.throws(
    () =>
      parse(
        body({
          verdict: {
            decision: "apply_now",
            rationale: "x",
            criteria_applied: "y",
            decisive_gaps: [],
            alternatives: [],
          },
        }),
      ),
    /at least one rejected alternative/,
  );
});
