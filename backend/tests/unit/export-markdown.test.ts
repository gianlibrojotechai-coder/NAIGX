/**
 * Unit — the Markdown export (`M-13`, `FR-050`–`FR-053`, `API-040`).
 *
 * WHAT THESE TESTS ARE FOR. An export is a document a user hands to somebody
 * who was not present for the analysis. That reader cannot hover a tooltip,
 * cannot open a collapsed section, and has no way to ask what a blank space
 * meant. So the properties worth pinning are the ones about **honesty
 * surviving the transformation**:
 *
 *   · provenance travels with the claim (`FR-043`)
 *   · an unavailable confidence says so rather than going missing (`FR-045`)
 *   · omitted and failed stay distinguishable (`FR-091`)
 *   · a partial export names what it left out (`FR-052`)
 *   · degradation is stated at the top rather than inferred from gaps (`M-14`)
 *   · no marketing content appears (`FR-051`)
 *
 * They are not tests that the document looks nice. They are tests that it does
 * not quietly become more confident than the analysis was.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { AnalysisView } from "../../src/db/analysis-reader.js";
import { renderAnalysisMarkdown } from "../../src/export/markdown.js";

const GENERATED_AT = new Date("2026-09-07T12:00:00.000Z");

const baseAnalysis: AnalysisView = {
  analysis_id: "11111111-2222-3333-4444-555555555555",
  status: "completed",
  created_at: "2026-09-07T11:58:00.000Z",
  completed_at: "2026-09-07T11:59:30.000Z",
  derived_title: "Automation Engineer at Northwind",
  sufficiency_level: "sufficient",
  overall_confidence_band: null,
  overall_confidence: null,
  degraded: false,
  timed_out: false,
  refusal: null,
  input: { character_count: 2400, source_type: "paste" },
  classification: {
    determined_type: "job_description",
    confidence: 0.91,
    candidate_types: null,
    was_low_confidence: false,
    user_override_type: null,
    overridden_at: null,
  },
  intent: {
    primary_objective: "Determine fit for an automation engineer role",
    inferred_scope:
      "One posting, assessed against the stored capability profile",
    objective_provenance: { primary: "inferred", secondary: [] },
  },
  context: [
    {
      content: "Five years of workflow automation experience",
      category: "requirement",
      provenance: "stated",
      specificity_score: 4,
      source_span_start: 120,
      source_span_end: 168,
      inference_basis: null,
      resolution_hint: null,
    },
    {
      content:
        "The team is small enough that the hire owns delivery end to end",
      category: "constraint",
      provenance: "inferred",
      specificity_score: 2,
      source_span_start: null,
      source_span_end: null,
      inference_basis: "The posting names no other engineers on the team",
      resolution_hint: null,
    },
    {
      content: "Salary band",
      category: "constraint",
      provenance: "unknown",
      specificity_score: null,
      source_span_start: null,
      source_span_end: null,
      inference_basis: null,
      resolution_hint: "Ask the recruiter for the band before the first call",
    },
  ],
  unknowns: [
    {
      content: "Salary band",
      resolution_hint: "Ask the recruiter for the band before the first call",
    },
  ],
  verdict: {
    decision: "build_first",
    rationale: "One decisive gap in orchestration tooling remains unevidenced.",
    criteria_applied: "Every must-have requirement carries strong evidence.",
    confidence_band: null,
    confidence_factors: null,
    alternatives: [
      {
        alternative: "Apply now and address the gap in interview",
        rejection_reason: "The gap is decisive and cannot be argued around.",
      },
    ],
  },
  requirements: [
    {
      id: "REQ-1",
      name: "Workflow orchestration at scale",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      matched: [],
      gaps: [
        {
          priority: "high",
          why_it_matters: "The role is defined by it.",
          decisive: true,
        },
      ],
    },
    {
      id: "REQ-2",
      name: "API integration",
      necessity: "must_have",
      provenance: "stated",
      kind: "technical",
      matched: [
        {
          capability_id: "CAP-9",
          strength: "strong",
          evidence_ref: "terra-finds",
        },
      ],
      gaps: [],
    },
  ],
  decisive_gaps: ["REQ-1"],
  artifacts: [
    {
      artifact_type: "portfolio_suggestions",
      planned: true,
      outcome: "generated",
      inclusion_reason: "One decisive technical gap is eligible.",
      omission_reason: null,
      validation_status: "valid",
      content: {
        consolidation_rationale:
          "One project covers the single decisive gap; a second would repeat it.",
        projects: [
          {
            rank: 1,
            name: "Orchestrated intake pipeline",
            complexity: "intermediate",
            primary_gaps: ["REQ-1"],
            secondary_capabilities: ["Error handling"],
            why_this_project: "It exercises orchestration directly.",
            business_problem: "Intake requests are handled by hand.",
            what_to_build: "A queue-backed pipeline with retries.",
            workflow: ["Request arrives", "Queued", "Processed", "Reported"],
            platforms: ["n8n"],
            technical_concepts: ["Queueing", "Idempotency"],
            evidence_to_produce: [
              { type: "repo", what_it_shows: "The pipeline source" },
            ],
            why_not_consolidated: "It is the only decisive gap.",
            reusability: {
              provenance: "inferred",
              basis: "The requirements name orchestration generically",
              claim: "Most orchestration roles would accept this evidence",
            },
            estimated_effort: "days",
            portfolio_value: "Closes the one gap blocking the application.",
          },
        ],
      },
    },
    {
      artifact_type: "skill_gap_analysis",
      planned: false,
      outcome: "omitted",
      inclusion_reason: null,
      omission_reason: "portfolio_suggestions only (docs/12 D-29).",
      validation_status: null,
      content: null,
    },
    {
      artifact_type: "interview_guidance",
      planned: true,
      outcome: "failed",
      inclusion_reason: "Planned for this path.",
      omission_reason: null,
      validation_status: "invalid",
      content: null,
    },
  ],
};

// Pulled out so overrides can spread them without a non-null assertion.
const baseIntent = baseAnalysis.intent as NonNullable<AnalysisView["intent"]>;
const baseVerdict = baseAnalysis.verdict as NonNullable<
  AnalysisView["verdict"]
>;
const baseClassification = baseAnalysis.classification as NonNullable<
  AnalysisView["classification"]
>;

const render = (
  overrides: Partial<AnalysisView> = {},
  artifactTypes?: readonly string[],
) =>
  renderAnalysisMarkdown(
    { ...baseAnalysis, ...overrides },
    {
      generatedAt: GENERATED_AT,
      ...(artifactTypes !== undefined ? { artifactTypes } : {}),
    },
  );

// --- FR-051 metadata and disclaimer -----------------------------------------

test("FR-051 — generation date, classification and analysis id are carried", () => {
  const { document } = render();
  assert.match(document, /11111111-2222-3333-4444-555555555555/);
  assert.match(document, /2026-09-07T12:00:00\.000Z/);
  assert.match(document, /Job description/);
});

test("FR-051 — the document states it is generated intelligence needing review", () => {
  const { document } = render();
  assert.match(document, /generated intelligence, not professional advice/);
  assert.match(document, /requires professional review/);
});

test("FR-051 — no marketing content appears", () => {
  // Not a style preference: `FR-051` forbids it, and a document a user hands
  // to a hiring manager must not read as a pitch for the tool that wrote it.
  const lowered = render().document.toLowerCase();
  for (const phrase of [
    "powered by",
    "sign up",
    "try naigx",
    "learn more",
    "upgrade",
    "get started",
    "visit ",
  ]) {
    assert.equal(
      lowered.includes(phrase),
      false,
      `marketing phrase present: ${phrase}`,
    );
  }
});

// --- FR-043 provenance -------------------------------------------------------

test("FR-043 — stated and inferred are distinguished, and inference carries its basis", () => {
  const { document } = render();
  assert.match(document, /\*\*Stated\*\* — present in the input text/);
  assert.match(document, /\*\*Inferred\*\* — reasoned from the input/);
  // The basis travels with the inferred element, in its own column.
  assert.match(document, /The posting names no other engineers on the team/);
});

test("FR-043 — the primary objective's provenance is stated, not implied", () => {
  const { document } = render();
  assert.match(document, /This objective was inferred/);
});

test("an unrecognised provenance document is reported as silence, not guessed", () => {
  const { document } = render({
    intent: { ...baseIntent, objective_provenance: { primary: 7 } },
  });
  assert.equal(/This objective was/.test(document), false);
  // The objective itself still appears — a missing provenance is not a reason
  // to withhold the conclusion it belongs to.
  assert.match(document, /Determine fit for an automation engineer role/);
});

// --- FR-045 confidence -------------------------------------------------------

test("FR-045 — an unavailable confidence is stated with its reason, not omitted", () => {
  const { document } = render();
  assert.match(document, /\*\*Confidence: not available\.\*\*/);
  assert.match(document, /not computed in this version/);
});

test("a stored confidence band is printed when one exists", () => {
  const { document } = render({
    verdict: { ...baseVerdict, confidence_band: "moderate" },
  });
  assert.match(document, /\*\*Confidence\.\*\* Moderate/);
  assert.equal(/Confidence: not available/.test(document), false);
});

// --- FR-042 / FR-034 rationale and criteria ---------------------------------

test("FR-042 and FR-034 — rationale, criteria and rejected alternatives travel with the verdict", () => {
  const { document } = render();
  const verdictIndex = document.indexOf("## 3. Verdict");
  const requirementsIndex = document.indexOf("## 4. Requirements");
  const section = document.slice(verdictIndex, requirementsIndex);

  assert.match(section, /Build first/);
  assert.match(section, /One decisive gap in orchestration tooling/);
  assert.match(section, /Every must-have requirement carries strong evidence/);
  assert.match(section, /Apply now and address the gap in interview/);
  assert.match(section, /The gap is decisive and cannot be argued around/);
});

// --- FR-091 omitted vs failed -----------------------------------------------

test("FR-091 — omitted and failed are reported differently", () => {
  const { document } = render();
  const status = document.slice(document.indexOf("Artifact status"));

  assert.match(status, /Skill Gap Analysis \| Omitted/);
  assert.match(status, /portfolio_suggestions only/);
  assert.match(status, /Interview Guidance \| Failed/);
  assert.match(status, /Omitted and failed mean different things/);
});

test("failed artifact content is never presented", () => {
  const { document } = render();
  // It appears in the status table and nowhere else — there is no section for
  // it, because `DB §4.4` makes only valid artifacts presentable.
  assert.equal(/## \d+\. Interview Guidance/.test(document), false);
});

test("an omission with no recorded reason says the explanation is missing", () => {
  const { document } = render({
    artifacts: [
      {
        artifact_type: "skill_gap_analysis",
        planned: false,
        outcome: "omitted",
        inclusion_reason: null,
        omission_reason: null,
        validation_status: null,
        content: null,
      },
    ],
  });
  assert.match(document, /The omission is real; the explanation is missing/);
});

// --- FR-052 partial export ---------------------------------------------------

test("FR-052 — a partial export names what it left out", () => {
  const analysis: AnalysisView = {
    ...baseAnalysis,
    artifacts: [
      ...baseAnalysis.artifacts,
      {
        artifact_type: "risk_assessment",
        planned: true,
        outcome: "generated",
        inclusion_reason: "Planned for this path.",
        omission_reason: null,
        validation_status: "valid",
        content: { risks: [], no_risks_statement: "The workflow is sound." },
      },
    ],
  };

  const result = renderAnalysisMarkdown(analysis, {
    generatedAt: GENERATED_AT,
    artifactTypes: ["portfolio_suggestions"],
  });

  assert.deepEqual(result.includedTypes, ["portfolio_suggestions"]);
  assert.deepEqual(result.excludedTypes, ["risk_assessment"]);
  assert.match(result.document, /\*\*This is a partial export\.\*\*/);
  assert.match(result.document, /Risk Assessment \| Excluded from this export/);
  assert.match(result.document, /not selected for this document/);
  // The excluded artifact's content is genuinely absent.
  assert.equal(/The workflow is sound/.test(result.document), false);
});

test("a selection never strips the reasoning the artifact rests on", () => {
  // `FR-042`: an artifact detached from its rationale is the thing the
  // requirement exists to prevent. A one-artifact copy still carries the
  // verdict and the requirements it came from.
  const { document } = render({}, ["portfolio_suggestions"]);
  assert.match(document, /## 3\. Verdict/);
  assert.match(document, /## 4\. Requirements/);
  assert.match(document, /Confidence: not available/);
});

// --- M-14 degradation --------------------------------------------------------

test("M-14 — a timed-out analysis says so at the top, before anything else", () => {
  const { document } = render({ status: "timed_out", timed_out: true });
  const banner = document.indexOf("This analysis timed out");
  assert.notEqual(banner, -1);
  assert.ok(banner < document.indexOf("## 1."), "banner precedes the sections");
  assert.match(
    document,
    /Everything that completed before it stopped was stored/,
  );
});

test("M-14 — degradation and timeout are worded differently", () => {
  const degraded = render({ degraded: true }).document;
  assert.match(degraded, /completed with degradation/);
  assert.equal(/timed out/.test(degraded), false);
});

test("a non-terminal-looking status is labelled rather than dressed up", () => {
  const { document } = render({ status: "failed", completed_at: null });
  assert.match(document, /This analysis is `failed`/);
  assert.match(document, /Not completed/);
});

// --- FR-015 / FR-014 classification honesty ---------------------------------

test("FR-015 — a low-confidence classification is carried into the document", () => {
  const { document } = render({
    classification: {
      ...baseClassification,
      was_low_confidence: true,
    },
  });
  assert.match(document, /This classification was low-confidence/);
  assert.match(document, /reasoned on a type that was not certain/);
});

test("FR-014 — a user correction is distinguishable from an original", () => {
  const { document } = render({
    classification: {
      ...baseClassification,
      user_override_type: "existing_workflow",
      overridden_at: "2026-09-07T11:58:30.000Z",
    },
  });
  assert.match(document, /\*\*Corrected by the user\*\* to Existing workflow/);
});

// --- FR-044 unknowns ---------------------------------------------------------

test("FR-044 — unknowns are listed with what would resolve them", () => {
  const { document } = render();
  assert.match(document, /Salary band \| Ask the recruiter for the band/);
});

test("having no unknowns is stated rather than left blank", () => {
  const { document } = render({ unknowns: [] });
  assert.match(document, /Nothing was recorded as unknown/);
});

// --- structure ---------------------------------------------------------------

test("sections renumber around the path's artifact block", () => {
  const { document } = render();
  // Four fixed sections, then the artifact, then the three closing sections.
  assert.match(document, /## 1\. The problem as understood/);
  assert.match(document, /## 2\. Classification/);
  assert.match(document, /## 3\. Verdict/);
  assert.match(document, /## 4\. Requirements/);
  assert.match(document, /## 5\. Portfolio Suggestions/);
  assert.match(document, /## 6\. Unknowns/);
  assert.match(document, /## 7\. Provenance/);
  assert.match(document, /## 8\. Artifact status/);
});

test("a decisive gap is named and explained, not just counted", () => {
  const { document } = render();
  assert.match(document, /1 decisive gap:/);
  assert.match(document, /would change the verdict on its own/);
  assert.match(document, /decisive\*\* — The role is defined by it/);
});

test("the same analysis renders identically twice", () => {
  // What makes regeneration a sound substitute for a stored file (`D-42` §3.4).
  assert.equal(render().document, render().document);
});

test("a missing stage is reported as missing rather than skipped silently", () => {
  const { document } = render({ intent: null, verdict: null });
  assert.match(document, /No intent record was stored/);
  assert.match(document, /No verdict was stored\. Stage 7 did not complete/);
});

test("the document ends with exactly one newline and no blank-line runs", () => {
  const { document } = render();
  assert.ok(document.endsWith("\n"));
  assert.equal(document.endsWith("\n\n"), false);
  assert.equal(/\n{3,}/.test(document), false);
});
