/**
 * The `workflow_recommendation` artifact — the workflow as it is, then what is
 * wrong with it.
 *
 * ORDER IS THE REQUIREMENT, not a layout preference. `FR-021`: "Output
 * identifies the workflow's current structure before evaluating it." A reader
 * who disagrees with a finding has to be able to see what the reviewer thought
 * the workflow was, so the structure is rendered first and is not collapsible
 * away behind the findings.
 *
 * SILENCE IS NOT APPROVAL. `FR-021` requires a sound workflow to yield "an
 * explicit statement that no material issues were found, not manufactured
 * criticism". An empty findings list therefore renders as that statement, and
 * an empty list with no statement renders as the defect it is — never as a
 * clean bill of health nobody actually gave.
 */

import type {
  WorkflowFinding,
  WorkflowRecommendation,
  WorkflowStep,
} from "../api/types";
import { severityLabel } from "../format";
import { Badge, Unavailable } from "./ui";

function Detail({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </h5>
      <p className="text-sm text-slate-800 mt-0.5">{children}</p>
    </div>
  );
}

function Step({ step, ordinal }: { step: WorkflowStep; ordinal: number }) {
  return (
    <li className="border border-slate-200 rounded-md overflow-hidden">
      <header className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-semibold grid place-items-center">
          {ordinal}
        </span>
        <h4 className="font-semibold text-slate-900 flex-1 min-w-0">
          {step.name}
        </h4>
      </header>
      <div className="p-4 space-y-3">
        <Detail label="Responsibility">{step.responsibility}</Detail>
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Inputs">{step.inputs}</Detail>
          <Detail label="Outputs">{step.outputs}</Detail>
        </div>
        {/* Kept last and always shown. Where the submission says nothing about
            failure, the reviewer is required to say *that* rather than invent
            a recovery — so this field carrying "not stated" is information. */}
        <Detail label="Failure handling">{step.failure_handling}</Detail>
      </div>
    </li>
  );
}

function Finding({ finding }: { finding: WorkflowFinding }) {
  return (
    <li className="border border-slate-200 rounded-md p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={finding.severity >= 4 ? "danger" : "warning"}>
          {severityLabel(finding.severity)} severity
        </Badge>
        <span className="text-sm font-medium text-slate-900">
          {finding.step}
        </span>
      </div>
      <p className="text-sm text-slate-800">{finding.description}</p>
      <p className="text-sm text-slate-800">
        <span className="font-medium">Remediation: </span>
        {finding.remediation}
      </p>
    </li>
  );
}

export function WorkflowRecommendationView({
  recommendation,
}: {
  recommendation: WorkflowRecommendation;
}) {
  const { current_structure: structure, findings, optimisations } = recommendation;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          The workflow as identified
        </h3>
        <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-3">
          {structure.summary}
        </p>
        <p className="text-sm text-slate-700">
          <span className="font-medium">Data flow: </span>
          {structure.data_flow}
        </p>
        <ol className="space-y-3">
          {structure.steps.map((step, index) => (
            <Step
              key={`${step.name}-${String(index)}`}
              step={step}
              ordinal={index + 1}
            />
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Findings
          {findings.length > 0 && (
            <span className="ml-2 font-normal text-slate-500">
              {findings.length} issue{findings.length === 1 ? "" : "s"}
            </span>
          )}
        </h3>

        {findings.length > 0 ? (
          <ul className="space-y-3">
            {findings.map((finding, index) => (
              <Finding
                key={`${finding.step}-${String(index)}`}
                finding={finding}
              />
            ))}
          </ul>
        ) : recommendation.soundness_statement !== undefined ? (
          <div className="border border-emerald-300 bg-emerald-50 rounded-md p-4">
            <h4 className="font-medium text-emerald-900">
              No material issues were found
            </h4>
            <p className="text-sm text-emerald-900 mt-1">
              {recommendation.soundness_statement}
            </p>
          </div>
        ) : (
          <Unavailable>
            No findings were recorded, and no statement of soundness was stored
            either. Read this as an incomplete review rather than as a sound
            workflow — the two are different claims, and only one of them was
            made.
          </Unavailable>
        )}
      </section>

      {optimisations.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Optimisations
          </h3>
          <p className="text-xs text-slate-600">
            Improvements, not problems. The workflow is correct without them.
          </p>
          <ul className="list-disc list-outside ml-4 space-y-1 text-sm text-slate-800">
            {optimisations.map((entry, index) => (
              <li key={`${entry}-${String(index)}`}>{entry}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
