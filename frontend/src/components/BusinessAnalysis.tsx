/**
 * The `business_analysis` artifact — the problem as the analysis understood
 * it, before any design (D-77).
 *
 * IT PRECEDES THE SOLUTION, AND SAYS SO. A reader who skims to the artifacts
 * meets the objectives, the constraints and the unknowns before the
 * architecture, with every fact marked stated or inferred (`FR-043`) and
 * every unknown carrying what would resolve it (`FR-044`). Nothing here is a
 * conclusion, and the standing line is the first thing on the page.
 */

import type { BusinessAnalysis, BusinessFact } from "../api/types";
import { humanise } from "../format";
import { Badge, ProvenanceBadge } from "./ui";

function Fact({
  fact,
  showCategory,
}: {
  fact: BusinessFact;
  showCategory: boolean;
}) {
  return (
    <li className="text-sm text-slate-800 flex flex-wrap items-baseline gap-2">
      <span className="flex-1 min-w-0">{fact.content}</span>
      {showCategory && <Badge>{humanise(fact.category)}</Badge>}
      <ProvenanceBadge provenance={fact.provenance} />
    </li>
  );
}

export function BusinessAnalysisView({
  analysis,
}: {
  analysis: BusinessAnalysis;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        The problem as it was understood before any design was reasoned —
        objectives, constraints and what is known, each marked stated or
        inferred, and every unknown with what would resolve it. A statement of
        the problem, not a conclusion.
      </p>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">The problem</h3>
        <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-wrap items-baseline gap-2">
          <span className="flex-1 min-w-0">{analysis.objective.content}</span>
          <ProvenanceBadge provenance={analysis.objective.provenance} />
        </p>
        {analysis.secondary_objectives.length > 0 && (
          <ul className="space-y-1">
            {analysis.secondary_objectives.map((objective, index) => (
              <li
                key={`${String(index)}-${objective.content.slice(0, 16)}`}
                className="text-sm text-slate-800 flex flex-wrap items-baseline gap-2"
              >
                <span className="flex-1 min-w-0">{objective.content}</span>
                <ProvenanceBadge provenance={objective.provenance} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-slate-700">
          <span className="font-medium">Scope, as inferred: </span>
          {analysis.scope}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Constraints</h3>
        {analysis.constraints.length === 0 ? (
          <p className="text-sm text-slate-600">
            No constraint was extracted from the input.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {analysis.constraints.map((fact, index) => (
              <Fact
                key={`${String(index)}-${fact.content.slice(0, 16)}`}
                fact={fact}
                showCategory={false}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          What is known about the environment
        </h3>
        {analysis.environment.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nothing beyond the constraints was extracted.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {analysis.environment.map((fact, index) => (
              <Fact
                key={`${String(index)}-${fact.content.slice(0, 16)}`}
                fact={fact}
                showCategory
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          What the input does not say
          {analysis.unknowns.length > 0 && (
            <Badge tone="warning">{analysis.unknowns.length}</Badge>
          )}
        </h3>
        {analysis.unknowns.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nothing was recorded as unknown.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {analysis.unknowns.map((unknown, index) => (
              <li
                key={`${String(index)}-${unknown.content.slice(0, 16)}`}
                className="text-sm text-slate-800 border border-amber-200 rounded-md p-3"
              >
                <p className="font-medium">{unknown.content}</p>
                {unknown.resolution_hint !== null && (
                  <p className="text-slate-700 mt-0.5">
                    <span className="font-medium">Would be resolved by: </span>
                    {unknown.resolution_hint}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-600">
        Context sufficiency: {humanise(analysis.sufficiency)}.{" "}
        {analysis.counts.elements} elements extracted: {analysis.counts.stated}{" "}
        stated, {analysis.counts.inferred} inferred, {analysis.counts.unknown}{" "}
        unknown.
      </p>
    </div>
  );
}
