/**
 * The `executive_summary` artifact — the analysis in a page, for a reader who
 * will not read the detailed artifacts (D-85, `FR-038`).
 *
 * IT IS A SUMMARY, AND SAYS SO. Every figure here is projected from a
 * detailed artifact below it, and the standing line says the detail governs.
 * A section whose source did not generate is not shown; the closing line
 * names what is missing rather than leaving the reader to infer it.
 */

import type { ExecutiveSummary } from "../api/types";

const BAND_LABEL: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};

export function ExecutiveSummaryView({ summary }: { summary: ExecutiveSummary }) {
  return (
    <div className="space-y-6">
      <p className="text-lg font-medium text-slate-900 text-balance">
        {summary.headline}
      </p>

      <section className="space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-900">The problem</h3>
        <p className="text-sm text-slate-800">{summary.problem.scope}</p>
        {summary.problem.key_constraints.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-slate-800 space-y-0.5">
            {summary.problem.key_constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        )}
        {summary.problem.open_questions !== undefined &&
          summary.problem.open_questions > 0 && (
            <p className="text-xs text-slate-600">
              {summary.problem.open_questions === 1
                ? "One thing the input left open still needs an answer."
                : `${String(summary.problem.open_questions)} things the input left open still need answers.`}
            </p>
          )}
      </section>

      <section className="space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-900">
          The proposed approach
        </h3>
        <p className="text-sm text-slate-800">{summary.approach.summary}</p>
        <p className="text-sm text-slate-700">{summary.approach.data_flow}</p>
        <p className="text-xs text-slate-600">
          {summary.approach.components.length === 1
            ? "One part to build: "
            : `${String(summary.approach.components.length)} parts to build: `}
          {summary.approach.components.join(", ")}.
        </p>
        {summary.platform !== undefined && (
          <p className="text-sm text-slate-800">
            <span className="font-medium">Platform: </span>
            {summary.platform.recommended === null
              ? "no automation platform is recommended. "
              : `${summary.platform.recommended}. `}
            {summary.platform.rationale}
          </p>
        )}
      </section>

      {summary.principal_risks !== undefined && (
        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold text-slate-900">
            Principal risks
          </h3>
          {summary.principal_risks.length === 0 ? (
            <p className="text-sm text-slate-700">
              The register lists no risks for this design.
            </p>
          ) : (
            <ol className="space-y-1">
              {summary.principal_risks.map((risk) => (
                <li
                  key={`${risk.component}-${risk.description.slice(0, 24)}`}
                  className="text-sm text-slate-800"
                >
                  <span className="font-medium">{risk.component}: </span>
                  {risk.description}
                  <span className="text-xs text-slate-600">
                    {" "}
                    (severity {risk.severity} of 5, likelihood {risk.likelihood}{" "}
                    of 5)
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {summary.complexity !== undefined && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Complexity</h3>
          <p className="text-sm text-slate-800">
            <span className="text-2xl font-semibold tabular-nums mr-2">
              {summary.complexity.score}
            </span>
            of 100 — {BAND_LABEL[summary.complexity.band] ?? summary.complexity.band}.
            The full score, with the factors that produced it, is below.
          </p>
        </section>
      )}

      {summary.phases !== undefined && summary.phases.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold text-slate-900">
            How it would be built
          </h3>
          <ol className="space-y-1">
            {summary.phases.map((phase) => (
              <li key={phase.ordinal} className="text-sm text-slate-800">
                <span className="font-medium">
                  {String(phase.ordinal)}. {phase.name}:
                </span>{" "}
                {phase.outcome}
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-xs text-slate-600 border-t border-slate-200 pt-3">
        This page summarises the detailed artifacts below, which govern where
        they say more.
        {summary.not_summarised.length > 0 &&
          ` Not summarised, because it did not generate: ${summary.not_summarised.join(", ")}.`}
      </p>
    </div>
  );
}
