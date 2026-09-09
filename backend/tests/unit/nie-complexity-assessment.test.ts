/**
 * Unit — the complexity assessment (D-80, `FR-033`, `docs/09` §1).
 *
 * The model scores five factors; everything after is arithmetic done here.
 * These pin the arithmetic against `docs/09` §1.4's worked example, the
 * parser's refusals, the rendered document's schema, and Stage 10's
 * recomputation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseComplexityFactors,
  renderComplexityScore,
  scoreComplexity,
} from "../../src/nie/stages/complexity-assessment.js";
import { validateArtifact } from "../../src/nie/artifact-validation.js";
import { checkInternalConsistency } from "../../src/nie/stages/response-validation.js";

const factors = (scores: Record<string, number>) =>
  JSON.stringify({
    factors: Object.entries(scores).map(([factor, score]) => ({
      factor,
      score,
      justification: `Because of what the design does in the ${factor} dimension.`,
    })),
  });

const WORKED = {
  workflow: 4,
  integration: 3,
  data_logic: 5,
  failure_risk: 3,
  operational: 2,
};

test("docs/09 §1.4's worked example reproduces: weighted 3.50, complexity 70", () => {
  const assessment = parseComplexityFactors(factors(WORKED));
  assert.equal(assessment.weightedScore, 3.5);
  assert.equal(assessment.complexityScore, 70);
  assert.deepEqual(
    assessment.factors.map((f) => [f.factor, f.contribution]),
    [
      ["workflow", 1],
      ["integration", 0.6],
      ["data_logic", 1],
      ["failure_risk", 0.6],
      ["operational", 0.3],
    ],
  );
  const document = renderComplexityScore(assessment);
  validateArtifact("complexity_score", document);
  assert.equal(document["scale_version"], "complexity-v1");
});

test("the achievable range is 20–100", () => {
  const low = parseComplexityFactors(
    factors({
      workflow: 1,
      integration: 1,
      data_logic: 1,
      failure_risk: 1,
      operational: 1,
    }),
  );
  assert.equal(low.complexityScore, 20);
  const high = parseComplexityFactors(
    factors({
      workflow: 5,
      integration: 5,
      data_logic: 5,
      failure_risk: 5,
      operational: 5,
    }),
  );
  assert.equal(high.complexityScore, 100);
  validateArtifact("complexity_score", renderComplexityScore(low));
  validateArtifact("complexity_score", renderComplexityScore(high));
});

test("all five factors, each once, integer 1–5, each justified", () => {
  assert.throws(
    () =>
      parseComplexityFactors(
        factors({
          workflow: 3,
          integration: 3,
          data_logic: 3,
          failure_risk: 3,
        }),
      ),
    /missing operational/,
  );
  assert.throws(
    () => parseComplexityFactors(factors({ ...WORKED, workflow: 6 })),
    /integer from 1 to 5/,
  );
  assert.throws(
    () =>
      parseComplexityFactors(
        JSON.stringify({
          factors: [
            ...JSON.parse(factors(WORKED)).factors,
            { factor: "workflow", score: 2, justification: "again" },
          ],
        }),
      ),
    /scored twice/,
  );
  assert.throws(
    () =>
      parseComplexityFactors(
        JSON.stringify({
          factors: JSON.parse(factors(WORKED)).factors.map(
            (f: { factor: string }) =>
              f.factor === "workflow" ? { ...f, justification: "" } : f,
          ),
        }),
      ),
    /justification/,
  );
});

test("Stage 10 recomputes the arithmetic and fails a document whose score does not follow from its factors", () => {
  const document = renderComplexityScore(
    parseComplexityFactors(factors(WORKED)),
  );
  const ok = checkInternalConsistency("complexity_score", document, {
    inputText: "",
  });
  assert.equal(ok.passed, true, ok.detail ?? "");
  const tampered = { ...document, complexity_score: 85 };
  const finding = checkInternalConsistency("complexity_score", tampered, {
    inputText: "",
  });
  assert.equal(finding.passed, false);
  assert.match(finding.detail ?? "", /85/);
  assert.deepEqual(
    scoreComplexity(new Map(Object.entries(WORKED) as [never, number][])),
    { weightedScore: 3.5, complexityScore: 70 },
  );
});
