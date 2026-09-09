/**
 * The `edge_cases_and_practices` artifact — the boundary conditions this
 * design will meet, each with its consequence and handling, and the practices
 * that apply to specific parts of it (D-83, `FR-037`).
 *
 * THE SCENARIO LEADS. A reader checks an edge case by recognising the
 * situation, so the scenario is the heading and the component it arises in
 * is the badge; consequence and handling follow as a pair. Practices are
 * shown under the part they apply to, never as a general list.
 */

import type { EdgeCasesAndPractices } from "../api/types";
import { Badge } from "./ui";

export function EdgeCasesAndPracticesView({
  analysis,
}: {
  analysis: EdgeCasesAndPractices;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Edge cases this design will meet
        </h3>
        <ol className="space-y-4">
          {analysis.edge_cases.map((edgeCase, index) => (
            <li
              key={`${String(index)}-${edgeCase.scenario.slice(0, 24)}`}
              className="space-y-1"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm font-medium text-slate-900 flex-1 min-w-0">
                  {edgeCase.scenario}
                </p>
                <Badge>{edgeCase.component}</Badge>
              </div>
              <p className="text-sm text-slate-800">
                <span className="font-medium">If unhandled: </span>
                {edgeCase.consequence}
              </p>
              <p className="text-sm text-slate-800">
                <span className="font-medium">Handling: </span>
                {edgeCase.handling}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Practices that apply here
        </h3>
        {analysis.practices.length === 0 ? (
          <p className="text-sm text-slate-600">
            No practice was listed: none applied to a specific part of this
            design beyond what the components already state.
          </p>
        ) : (
          <ul className="space-y-3">
            {analysis.practices.map((practice, index) => (
              <li
                key={`${String(index)}-${practice.practice.slice(0, 24)}`}
                className="space-y-0.5"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm font-medium text-slate-900 flex-1 min-w-0">
                    {practice.practice}
                  </p>
                  <Badge>{practice.applies_to}</Badge>
                </div>
                <p className="text-sm text-slate-700">{practice.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
