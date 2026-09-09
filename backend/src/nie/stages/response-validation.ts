/**
 * Stage 10 — Response Validation (`AI §3.2`, [D-72](../../../../docs/47-D-72-Stages-10-And-12.md)).
 *
 * "Guarantee that no invalid or unsupported output reaches a user." Six
 * validation classes are specified; until D-72 only `schema` ran, inline at
 * Stage 9. This module supplies the other five as **pure checks** over the
 * reasoning results and the artifact documents the pipeline already holds.
 * It reads no store, calls no provider, and has no opinion about the input —
 * it only asks whether what the pipeline produced is consistent with itself.
 *
 * Two kinds of finding, and the difference is the whole design:
 *
 *   · **Enforced** classes (`rationale_completeness`, `reference_integrity`,
 *     `provenance_integrity`, `internal_consistency`) are properties the
 *     contracts already promise. A failure is a defect — a renderer that
 *     drew a diagram with the wrong node count, a citation to a context
 *     element that does not exist — and the artifact carrying it is
 *     **failed**, exactly as a schema failure fails it (`DB §4.4` keeps the
 *     row; `FR-091` labels it). For reasoning results the parsers enforce
 *     these already, so a failure there is re-verification catching a bug,
 *     and the analysis fails closed rather than presenting it.
 *   · **Advisory** (`unsupported_claim_detection`) is a heuristic: a platform
 *     a project names that appears nowhere in the input, the context, the
 *     requirements or the operator's own capabilities. A heuristic must not
 *     fail an artifact — it would fail legitimate suggestions — so it is
 *     recorded as a finding for the reader and the operator, and nothing
 *     else. Its `detail` says so.
 *
 * Every check is a function of stored fields. Nothing here invents a value.
 */

import type {
  ArchitectureResult,
  ContextResult,
  IntentResult,
  PortfolioSuggestions,
  RecommendationResult,
  WorkflowReviewResult,
} from "../contracts.js";

/** Thrown when an enforced Stage 10 class fails an artifact (D-72). */
export class ResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResponseValidationError";
  }
}

export type ValidationClass =
  | "schema"
  | "rationale_completeness"
  | "reference_integrity"
  | "provenance_integrity"
  | "unsupported_claim_detection"
  | "internal_consistency";

export interface ValidationFinding {
  readonly validationClass: ValidationClass;
  /** The artifact checked, or `reasoning` for a check over stage outputs. */
  readonly subject: string;
  readonly passed: boolean;
  /** Names the rule, never the content (`NFR-081`). */
  readonly detail?: string;
  /** Advisory findings are recorded and never fail anything. */
  readonly advisory: boolean;
}

/** What the reasoning stages produced, as far as this run got. */
export interface ReasoningContext {
  readonly inputText: string;
  readonly intent?: IntentResult;
  readonly context?: ContextResult;
  readonly architecture?: ArchitectureResult;
  readonly workflowReview?: WorkflowReviewResult;
  readonly recommendation?: RecommendationResult;
  readonly portfolio?: PortfolioSuggestions;
  /** Platform names the operator already evidences (capability profile). */
  readonly knownPlatforms?: readonly string[];
}

const nonEmpty = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== "";

const finding = (
  validationClass: ValidationClass,
  subject: string,
  passed: boolean,
  detail?: string,
  advisory = false,
): ValidationFinding => ({
  validationClass,
  subject,
  passed,
  ...(detail !== undefined ? { detail } : {}),
  advisory,
});

// --- reasoning-level checks --------------------------------------------------

/**
 * `rationale_completeness` — every conclusion carries its reasoning
 * (`FR-042`, `FR-034`, `FR-021` AC: each finding carries a remediation).
 */
export function checkRationaleCompleteness(
  ctx: ReasoningContext,
): ValidationFinding {
  const problems: string[] = [];
  const arch = ctx.architecture;
  if (arch !== undefined) {
    arch.components.forEach((c, i) => {
      if (!nonEmpty(c.responsibility))
        problems.push(`component ${String(i)} has no responsibility`);
      if (!nonEmpty(c.failureHandling))
        problems.push(`component ${String(i)} has no failure handling`);
    });
    (arch.rejectedApproaches ?? []).forEach((r, i) => {
      if (!nonEmpty(r.rejectionReason))
        problems.push(`rejected approach ${String(i)} has no reason`);
    });
  }
  const review = ctx.workflowReview;
  if (review !== undefined) {
    review.findings.forEach((f, i) => {
      if (!nonEmpty(f.remediation))
        problems.push(`finding ${String(i)} has no remediation`);
      if (!nonEmpty(f.description))
        problems.push(`finding ${String(i)} has no description`);
    });
    if (review.findings.length === 0 && !nonEmpty(review.soundnessStatement)) {
      problems.push("a review with no findings must state soundness");
    }
  }
  const rec = ctx.recommendation;
  if (rec !== undefined) {
    if (!nonEmpty(rec.verdict.rationale))
      problems.push("verdict has no rationale");
    if (!nonEmpty(rec.verdict.criteriaApplied))
      problems.push("verdict states no criteria");
    if (rec.verdict.alternatives.length === 0)
      problems.push("verdict names no rejected alternative");
    rec.gaps.forEach((g, i) => {
      if (!nonEmpty(g.whyItMatters))
        problems.push(`gap ${String(i)} does not say why it matters`);
    });
  }
  return finding(
    "rationale_completeness",
    "reasoning",
    problems.length === 0,
    problems.length === 0 ? undefined : problems.join("; "),
  );
}

/**
 * `reference_integrity` — every reference resolves: context indices into the
 * context set, requirement ids into the requirement set, finding indices
 * into the structure, decisive gaps into the gaps.
 */
export function checkReferenceIntegrity(
  ctx: ReasoningContext,
): ValidationFinding {
  const problems: string[] = [];
  const contextSize = ctx.context?.elements.length ?? 0;
  const inRange = (indices: readonly number[], where: string) => {
    for (const index of indices) {
      if (!Number.isInteger(index) || index < 0 || index >= contextSize) {
        problems.push(
          `${where} cites context element ${String(index)} of ${String(contextSize)}`,
        );
      }
    }
  };
  ctx.architecture?.components.forEach((c, i) => {
    inRange(c.groundedInContextIndices, `architecture component ${String(i)}`);
  });
  const review = ctx.workflowReview;
  if (review !== undefined) {
    review.structure.forEach((c, i) => {
      inRange(c.groundedInContextIndices, `workflow step ${String(i)}`);
    });
    review.findings.forEach((f, i) => {
      if (f.componentIndex < 0 || f.componentIndex >= review.structure.length) {
        problems.push(
          `finding ${String(i)} cites step ${String(f.componentIndex)} of ${String(review.structure.length)}`,
        );
      }
    });
  }
  const rec = ctx.recommendation;
  if (rec !== undefined) {
    const ids = new Set(rec.requiredCapabilities.map((r) => r.id));
    rec.requiredCapabilities.forEach((r) => {
      inRange(r.groundedInContextIndices, `requirement ${r.id}`);
    });
    rec.matched.forEach((m) => {
      if (!ids.has(m.requirementId))
        problems.push(`match cites unknown requirement ${m.requirementId}`);
    });
    const gapIds = new Set<string>();
    rec.gaps.forEach((g) => {
      gapIds.add(g.requirementId);
      if (!ids.has(g.requirementId))
        problems.push(`gap cites unknown requirement ${g.requirementId}`);
    });
    rec.verdict.decisiveGaps.forEach((id) => {
      if (!gapIds.has(id))
        problems.push(`decisive gap ${id} is not among the gaps`);
    });
    ctx.portfolio?.projects.forEach((p) => {
      p.primaryGaps.forEach((id) => {
        if (!gapIds.has(id))
          problems.push(`project "${p.name}" claims unknown gap ${id}`);
      });
      p.implementation?.steps.forEach((s) => {
        if (s.step < 1 || s.step > p.workflow.length) {
          problems.push(
            `project "${p.name}" implementation step ${String(s.step)} points outside its ${String(p.workflow.length)}-step workflow`,
          );
        }
      });
    });
  }
  return finding(
    "reference_integrity",
    "reasoning",
    problems.length === 0,
    problems.length === 0 ? undefined : problems.join("; "),
  );
}

/**
 * `provenance_integrity` — every provenance label is one the contract
 * allows and carries what that label requires (`AIP-3`, `FR-043`).
 */
export function checkProvenanceIntegrity(
  ctx: ReasoningContext,
): ValidationFinding {
  const problems: string[] = [];
  ctx.context?.elements.forEach((e, i) => {
    if (
      e.provenance === "stated" &&
      (e.sourceSpanStart === undefined || e.sourceSpanEnd === undefined)
    ) {
      problems.push(
        `context element ${String(i)} is stated without a source span`,
      );
    }
    if (e.provenance === "inferred" && !nonEmpty(e.inferenceBasis)) {
      problems.push(`context element ${String(i)} is inferred without a basis`);
    }
    if (e.provenance === "unknown" && !nonEmpty(e.resolutionHint)) {
      problems.push(
        `context element ${String(i)} is unknown without a resolution hint`,
      );
    }
  });
  const intent = ctx.intent;
  if (intent !== undefined) {
    [intent.primaryObjective, ...intent.secondaryObjectives].forEach((o, i) => {
      if (o.provenance !== "stated" && o.provenance !== "inferred") {
        problems.push(
          `objective ${String(i)} carries provenance ${String(o.provenance)}`,
        );
      }
    });
  }
  ctx.portfolio?.projects.forEach((p) => {
    if (p.reusability.provenance !== "inferred") {
      problems.push(
        `project "${p.name}" presents reusability as ${String(p.reusability.provenance)}; it can only be inferred`,
      );
    }
    if (!nonEmpty(p.reusability.basis))
      problems.push(`project "${p.name}" infers reusability with no basis`);
  });
  return finding(
    "provenance_integrity",
    "reasoning",
    problems.length === 0,
    problems.length === 0 ? undefined : problems.join("; "),
  );
}

/**
 * `unsupported_claim_detection` — ADVISORY. A platform a project names that
 * is nowhere in the input, the context, the requirements or the operator's
 * evidenced platforms. Recorded, never enforced: a heuristic that fails an
 * artifact would fail legitimate suggestions, which is worse than a note.
 */
export function checkUnsupportedClaims(
  ctx: ReasoningContext,
): ValidationFinding {
  const portfolio = ctx.portfolio;
  if (portfolio === undefined) {
    return finding(
      "unsupported_claim_detection",
      "portfolio_suggestions",
      true,
      undefined,
      true,
    );
  }
  const haystack = [
    ctx.inputText,
    ...(ctx.context?.elements.map((e) => e.content) ?? []),
    ...(ctx.recommendation?.requiredCapabilities.map((r) => r.name) ?? []),
    ...(ctx.recommendation?.matched.map((m) => m.evidenceRef) ?? []),
    ...(ctx.knownPlatforms ?? []),
  ]
    .join("\n")
    .toLowerCase();
  const unsupported: string[] = [];
  for (const project of portfolio.projects) {
    for (const platform of project.platforms) {
      // The leading word of "HubSpot (free tier …)" is the platform.
      const head =
        platform
          .trim()
          .split(/[\s(,/]/)[0]
          ?.toLowerCase() ?? "";
      if (head.length >= 3 && !haystack.includes(head))
        unsupported.push(platform.trim());
    }
  }
  return finding(
    "unsupported_claim_detection",
    "portfolio_suggestions",
    unsupported.length === 0,
    unsupported.length === 0
      ? undefined
      : `advisory: platform(s) not found in the input, context, requirements or evidenced capabilities — ${unsupported.join("; ")}`,
    true,
  );
}

// --- artifact-level checks ---------------------------------------------------

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

/**
 * `internal_consistency` — an artifact agrees with the reasoning it was
 * rendered from (`FR-031`: diagram nodes match the architecture; D-40: a
 * rendered artifact cannot disagree with its source).
 *
 * Applied to one artifact at a time, at the moment it is validated, so a
 * failure fails that artifact and nothing else.
 */
export function checkInternalConsistency(
  artifactType: string,
  content: unknown,
  ctx: ReasoningContext,
): ValidationFinding {
  const doc = asRecord(content);
  const problems: string[] = [];
  if (doc === null) {
    return finding(
      "internal_consistency",
      artifactType,
      false,
      "artifact is not an object",
    );
  }
  switch (artifactType) {
    case "mermaid_diagram": {
      const components = ctx.architecture?.components ?? [];
      const diagram = String(doc["diagram"] ?? "");
      if (doc["node_count"] !== components.length) {
        problems.push(
          `node_count ${String(doc["node_count"])} ≠ ${String(components.length)} components`,
        );
      }
      for (const c of components) {
        if (!diagram.includes(c.name))
          problems.push(`component "${c.name}" is not in the diagram`);
      }
      break;
    }
    case "skill_gap_analysis": {
      const rec = ctx.recommendation;
      const rendered = asArray(doc["requirements"]);
      const expected = rec?.requiredCapabilities.length ?? 0;
      if (rendered.length !== expected)
        problems.push(
          `${String(rendered.length)} requirements rendered, ${String(expected)} reasoned`,
        );
      const gaps = rendered.filter((r) => asRecord(r)?.["gap"] !== null).length;
      const expectedGaps = rec?.gaps.length ?? 0;
      if (gaps !== expectedGaps)
        problems.push(
          `${String(gaps)} gaps rendered, ${String(expectedGaps)} reasoned`,
        );
      const decisive = rendered.filter(
        (r) => asRecord(asRecord(r)?.["gap"])?.["decisive"] === true,
      ).length;
      const expectedDecisive = rec?.verdict.decisiveGaps.length ?? 0;
      if (decisive !== expectedDecisive)
        problems.push(
          `${String(decisive)} decisive gaps rendered, ${String(expectedDecisive)} in the verdict`,
        );
      if (rec !== undefined && doc["decision"] !== rec.verdict.decision)
        problems.push("decision differs from the verdict");
      break;
    }
    case "architecture_recommendation": {
      const components = ctx.architecture?.components ?? [];
      const rendered = asArray(doc["components"]);
      if (rendered.length !== components.length) {
        problems.push(
          `${String(rendered.length)} components rendered, ${String(components.length)} reasoned`,
        );
      }
      const names = new Set(
        rendered.map((c) => String(asRecord(c)?.["name"] ?? "")),
      );
      for (const c of components) {
        if (!names.has(c.name))
          problems.push(`component "${c.name}" is not in the recommendation`);
      }
      if (doc["standing"] !== "recommendation") {
        problems.push('standing is not "recommendation"');
      }
      const tradeOffs = asArray(doc["trade_offs"]).length;
      const rejected = asArray(doc["rejected_approaches"]).length;
      const expectedT = ctx.architecture?.tradeOffs?.length ?? 0;
      const expectedR = ctx.architecture?.rejectedApproaches?.length ?? 0;
      if (tradeOffs !== expectedT)
        problems.push(
          `${String(tradeOffs)} trade-offs rendered, ${String(expectedT)} reasoned`,
        );
      if (rejected !== expectedR)
        problems.push(
          `${String(rejected)} rejected approaches rendered, ${String(expectedR)} reasoned`,
        );
      break;
    }
    case "assessment_feedback": {
      const tradeOffs = asArray(doc["trade_offs"]).length;
      const rejected = asArray(doc["rejected_approaches"]).length;
      const expectedT = ctx.architecture?.tradeOffs?.length ?? 0;
      const expectedR = ctx.architecture?.rejectedApproaches?.length ?? 0;
      if (tradeOffs !== expectedT)
        problems.push(
          `${String(tradeOffs)} trade-offs rendered, ${String(expectedT)} reasoned`,
        );
      if (rejected !== expectedR)
        problems.push(
          `${String(rejected)} rejected approaches rendered, ${String(expectedR)} reasoned`,
        );
      break;
    }
    case "risk_assessment": {
      const risks = asArray(doc["risks"]).length;
      const expected = ctx.workflowReview?.findings.length ?? 0;
      if (risks !== expected)
        problems.push(
          `${String(risks)} risks rendered, ${String(expected)} findings reasoned`,
        );
      break;
    }
    case "workflow_recommendation": {
      const findings = asArray(doc["findings"]).length;
      const expected = ctx.workflowReview?.findings.length ?? 0;
      if (findings !== expected)
        problems.push(
          `${String(findings)} findings rendered, ${String(expected)} reasoned`,
        );
      const structure = asRecord(doc["current_structure"]);
      const steps = asArray(structure?.["steps"]).length;
      const expectedSteps = ctx.workflowReview?.structure.length ?? 0;
      if (steps !== expectedSteps)
        problems.push(
          `${String(steps)} steps rendered, ${String(expectedSteps)} reasoned`,
        );
      break;
    }
    case "intent_brief": {
      const objective = asRecord(doc["objective"]);
      if (
        ctx.intent !== undefined &&
        objective?.["content"] !== ctx.intent.primaryObjective.content
      ) {
        problems.push("objective differs from the intent record");
      }
      if (doc["standing"] !== "understanding_only")
        problems.push("standing is not understanding_only");
      break;
    }
    case "n8n_workflow": {
      const nodes = asArray(doc["nodes"]).filter(
        (n) => asRecord(n)?.["type"] !== "n8n-nodes-base.stickyNote",
      );
      const steps =
        ctx.portfolio?.projects.find((p) => p.implementation !== undefined)
          ?.implementation?.steps.length ?? 0;
      if (nodes.length !== steps)
        problems.push(
          `${String(nodes.length)} nodes rendered, ${String(steps)} implementation steps`,
        );
      break;
    }
    case "portfolio_suggestions": {
      // The parser has already grounded gaps and ordered ranks; consistency
      // here is that every project's workflow is non-empty when it carries an
      // implementation, which the parser does not cross-check.
      for (const p of asArray(doc["projects"])) {
        const project = asRecord(p);
        const impl = asRecord(project?.["implementation"]);
        if (impl !== null && asArray(project?.["workflow"]).length === 0) {
          problems.push(
            `project "${String(project?.["name"])}" has an implementation but no workflow`,
          );
        }
      }
      break;
    }
    default:
      break;
  }
  return finding(
    "internal_consistency",
    artifactType,
    problems.length === 0,
    problems.length === 0 ? undefined : problems.join("; "),
  );
}

/** The reasoning-level classes, in the order the spec lists them. */
export function validateReasoning(
  ctx: ReasoningContext,
): readonly ValidationFinding[] {
  return [
    checkRationaleCompleteness(ctx),
    checkReferenceIntegrity(ctx),
    checkProvenanceIntegrity(ctx),
    checkUnsupportedClaims(ctx),
  ];
}
