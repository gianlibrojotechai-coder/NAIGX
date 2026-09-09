/**
 * Stage 12 — Response Assembly (`AI §3.2`, [D-72](../../../../docs/47-D-72-Stages-10-And-12.md)).
 *
 * "Compose the final output set for delivery … Assembly failure fails the
 * analysis; partial assembly is not permitted, since an incompletely
 * assembled response cannot guarantee disclosure."
 *
 * Until D-72 every branch of the pipeline assembled its own result and the
 * disclosure guarantee was a property of each branch. This is the single
 * step every result now passes through. It composes nothing new — the
 * content is already in the result — it **verifies** that the disclosure
 * the contracts promise is complete:
 *
 *   · every planned artifact has an outcome (`generated` or `failed`), never
 *     an unresolved plan (`DB §4.4`);
 *   · every artifact not planned says why (`FR-091`: omitted is a decision
 *     with a reason, not an absence);
 *   · no artifact type is planned twice (a duplicate plan entry would let
 *     one outcome hide another);
 *   · a halted run says where and why (`FR-092`, `API §9.3`);
 *   · a run that reasoned carries the reasoning its artifacts rest on (an
 *     artifact without its source stage would be a conclusion without the
 *     reasoning `FR-042` requires beside it).
 *
 * A violation throws. That is the specified behaviour, and the reason it is
 * safe: every branch already produces a complete result, so an assembly
 * failure is a defect surfacing at the last possible moment rather than a
 * partial answer reaching a reader.
 */

import type { PipelineResult } from "../contracts.js";

export class AssemblyError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(
      `Stage 12 refused to assemble the response — partial assembly is not permitted: ${problems.join("; ")}`,
    );
    this.name = "AssemblyError";
    this.problems = problems;
  }
}

export interface AssemblyReport {
  readonly planned: number;
  readonly generated: number;
  readonly failed: number;
  readonly omitted: number;
  readonly halted: boolean;
}

/** Verifies disclosure completeness; throws `AssemblyError` otherwise. */
export function assembleResponse(result: PipelineResult): AssemblyReport {
  const problems: string[] = [];
  const plan = result.artifactPlan ?? [];
  const seen = new Set<string>();
  let generated = 0;
  let failed = 0;
  let omitted = 0;

  for (const entry of plan) {
    if (seen.has(entry.artifactType)) {
      problems.push(`artifact ${entry.artifactType} is planned twice`);
    }
    seen.add(entry.artifactType);
    if (entry.planned) {
      if (entry.outcome === "generated") generated += 1;
      else if (entry.outcome === "failed") failed += 1;
      else {
        problems.push(
          `artifact ${entry.artifactType} is planned but has no outcome`,
        );
      }
      if (
        typeof entry.inclusionReason !== "string" ||
        entry.inclusionReason.trim() === ""
      ) {
        problems.push(
          `artifact ${entry.artifactType} is planned without a reason`,
        );
      }
    } else {
      omitted += 1;
      if (
        typeof entry.omissionReason !== "string" ||
        entry.omissionReason.trim() === ""
      ) {
        problems.push(
          `artifact ${entry.artifactType} is omitted without a reason`,
        );
      }
    }
  }

  const halted = result.haltedAt !== undefined;
  if (halted) {
    const reason = result.haltedAt?.reason;
    if (typeof reason !== "string" || reason.trim() === "") {
      problems.push("the run halted without a stated reason");
    }
  }

  // An artifact rests on reasoning that must travel with it.
  const types = new Set<string>(
    plan
      .filter((e) => e.planned && e.outcome === "generated")
      .map((e) => e.artifactType),
  );
  if (
    (types.has("portfolio_suggestions") ||
      types.has("n8n_workflow") ||
      types.has("skill_gap_analysis") ||
      types.has("interview_guidance")) &&
    result.recommendation === undefined
  ) {
    problems.push(
      "a job-description artifact was generated without the recommendation it rests on",
    );
  }
  if (
    (types.has("assessment_feedback") ||
      types.has("mermaid_diagram") ||
      types.has("architecture_recommendation")) &&
    result.architecture === undefined
  ) {
    problems.push(
      "an architecture artifact was generated without the architecture it rests on",
    );
  }
  if (
    (types.has("workflow_recommendation") || types.has("risk_assessment")) &&
    result.workflowReview === undefined
  ) {
    problems.push(
      "a workflow artifact was generated without the review it rests on",
    );
  }
  if (types.has("intent_brief") && result.intent === undefined) {
    problems.push(
      "the intent brief was generated without the intent record it rests on",
    );
  }

  if (problems.length > 0) throw new AssemblyError(problems);

  return {
    planned: plan.filter((e) => e.planned).length,
    generated,
    failed,
    omitted,
    halted,
  };
}
