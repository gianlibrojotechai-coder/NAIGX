/**
 * Unit — artifact schema validation (`FR-039`, `docs/12` D-1).
 *
 * `AI §9.3`: "the same schema drives generation guidance and validation — they
 * cannot disagree." These run against the **registered schema file**, not a
 * restatement of its rules, so a change to `schemas/portfolio_suggestions.schema.json`
 * moves these results.
 *
 * Two of the four rejection cases exercise constructs a hand-rolled checker
 * would most likely get wrong, which is why `docs/12` D-1 fixed draft 2020-12
 * and the implementation uses a conforming validator: the conditional
 * `if`/`then` on `why_not_consolidated`, and the `const` pinning
 * `reusability.provenance`.
 *
 * Reads one schema file. No provider, no database, no network.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ArtifactSchemaError,
  validateArtifact,
  validationStatusOf,
} from "../../src/nie/artifact-validation.js";

/** Runs `fn`, returning the error it threw. Fails the test if it did not. */
const capture = (fn: () => void): ArtifactSchemaError & Error => {
  try {
    fn();
  } catch (error) {
    return error as ArtifactSchemaError & Error;
  }
  return assert.fail("expected a validation error, but none was thrown");
};

/** A conforming Stage 9 response, in the wire shape the schema describes. */
const validArtifact = () => ({
  projects: [
    {
      rank: 1,
      name: "Lead intake automation",
      complexity: "intermediate",
      primary_gaps: ["req-1", "req-2"],
      secondary_capabilities: ["error handling"],
      why_this_project: "Closes both decisive gaps at once.",
      business_problem: "Leads are keyed by hand.",
      what_to_build: "A webhook intake with deterministic scoring.",
      workflow: ["Receive webhook", "Score", "Write to CRM"],
      platforms: ["n8n"],
      technical_concepts: ["idempotency"],
      evidence_to_produce: [{ type: "repo", what_it_shows: "The workflow" }],
      reusability: {
        provenance: "inferred",
        basis: "Both gaps recur across the posting's requirements.",
        claim: "Transfers to comparable intake roles.",
      },
      estimated_effort: "days",
      portfolio_value: "Shows CRM integration end to end.",
    },
  ],
  consolidation_rationale:
    "Two gaps share one system, so one project closes both.",
});

// --- the valid case ------------------------------------------------------

test("a conforming artifact validates", () => {
  assert.doesNotThrow(() =>
    validateArtifact("portfolio_suggestions", validArtifact()),
  );
  assert.equal(
    validationStatusOf("portfolio_suggestions", validArtifact()),
    "valid",
    "DB §4.4 — only `valid` artifacts are presentable",
  );
});

// --- rejections ----------------------------------------------------------

test("a missing consolidation_rationale is rejected", () => {
  const doc = validArtifact() as Record<string, unknown>;
  delete doc["consolidation_rationale"];

  const error = capture(() => validateArtifact("portfolio_suggestions", doc));

  assert.equal(error.artifactType, "portfolio_suggestions");
  assert.match(error.message, /consolidation_rationale/);
  assert.equal(validationStatusOf("portfolio_suggestions", doc), "failed");
});

test("a single-gap project without why_not_consolidated is rejected", () => {
  // The schema's `if`/`then`: one gap makes `why_not_consolidated` required.
  // `docs/12` D-29 — one project per gap is the naive answer, and the reason it
  // cannot fold into another has to be stated.
  const doc = validArtifact();
  const [project] = doc.projects;
  assert.ok(project);
  project.primary_gaps = ["req-1"];

  const error = capture(() => validateArtifact("portfolio_suggestions", doc));

  assert.match(error.message, /why_not_consolidated/);
  assert.ok(
    error.violations.some((v) => v.startsWith("/projects/0")),
    "the violation names the offending project, not just the document",
  );
});

test("a reusability provenance other than inferred is rejected", () => {
  // The schema's `const`. `docs/12` D-29: a model must not be able to promote
  // its own guess to `stated`.
  const doc = validArtifact();
  const [project] = doc.projects;
  assert.ok(project);
  project.reusability.provenance = "stated";

  const error = capture(() => validateArtifact("portfolio_suggestions", doc));

  assert.ok(
    error.violations.some((v) =>
      v.includes("/projects/0/reusability/provenance"),
    ),
  );
});

test("an empty project list is rejected", () => {
  // `minItems: 1` — a build_first verdict with no project says nothing.
  const doc = validArtifact();
  doc.projects = [];

  assert.throws(
    () => validateArtifact("portfolio_suggestions", doc),
    ArtifactSchemaError,
  );
});

// --- registration --------------------------------------------------------

test("an artifact type with no registered schema raises rather than skipping", () => {
  const error = capture(() =>
    validateArtifact(
      "interview_guidance" as Parameters<typeof validateArtifact>[0],
      {},
    ),
  );

  assert.match(error.message, /No registered schema/);
  assert.ok(
    !(error instanceof ArtifactSchemaError),
    "a missing schema is a registration fault, not a non-conforming artifact",
  );
});
