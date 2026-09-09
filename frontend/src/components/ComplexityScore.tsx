/**
 * The `complexity_score` artifact — the score, and the table that lets a
 * reader reconstruct it (D-80, `FR-033`, `docs/09` §1).
 *
 * THE TABLE IS THE ARTIFACT. `docs/09` §1.4: "a score displayed without this
 * table is a defect, regardless of whether the number is correct." Every
 * factor shows its score, its weight and its contribution; the weighted score
 * and the 0–100 score follow by arithmetic the reader can check on the page.
 * The achievable range is 20–100 (the minimum factor score is 1), and the
 * axis says so rather than pretending 0 is reachable.
 */

import type { ComplexityScore } from "../api/types";

const BAND = (score: number): { label: string; tone: string } =>
  score >= 80
    ? { label: "Severe", tone: "bg-rose-600" }
    : score >= 60
      ? { label: "High", tone: "bg-amber-700" }
      : score >= 40
        ? { label: "Moderate", tone: "bg-amber-300" }
        : { label: "Low", tone: "bg-emerald-600" };

export function ComplexityScoreView({ score }: { score: ComplexityScore }) {
  const band = BAND(score.complexity_score);
  const pct = ((score.complexity_score - 20) / 80) * 100;
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="text-4xl font-semibold text-slate-900 tabular-nums">
            {score.complexity_score}
          </p>
          <p className="text-sm text-slate-600">
            of 100 on the {score.scale_version} scale · {band.label}
          </p>
        </div>
        <div
          className="h-2 rounded-full bg-slate-200 overflow-hidden"
          role="img"
          aria-label={`Complexity ${String(score.complexity_score)} of 100, on an axis whose lowest achievable value is 20`}
        >
          <div
            className={`h-2 ${band.tone}`}
            style={{ width: `${String(pct)}%` }}
          />
        </div>
        <p className="text-xs text-slate-600">
          The lowest achievable score is 20: every factor scores at least 1.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          How the score was reached
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-3">Factor</th>
                <th className="py-1.5 pr-3 text-right">Score (1–5)</th>
                <th className="py-1.5 pr-3 text-right">Weight</th>
                <th className="py-1.5 pr-3 text-right">Contribution</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {score.factors.map((factor) => (
                <tr
                  key={factor.factor}
                  className="border-t border-slate-200 align-top"
                >
                  <td className="py-2 pr-3">
                    <p className="font-medium text-slate-900">{factor.label}</p>
                    <p className="text-xs text-slate-700 mt-0.5">
                      {factor.justification}
                    </p>
                  </td>
                  <td className="py-2 pr-3 text-right text-slate-900">
                    {factor.score}
                  </td>
                  <td className="py-2 pr-3 text-right text-slate-700">
                    {Math.round(factor.weight * 100)}%
                  </td>
                  <td className="py-2 pr-3 text-right text-slate-900">
                    {factor.contribution.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="tabular-nums">
              <tr className="border-t border-slate-300">
                <td
                  className="py-2 pr-3 font-medium text-slate-900"
                  colSpan={3}
                >
                  Weighted score (sum of contributions)
                </td>
                <td className="py-2 pr-3 text-right font-medium text-slate-900">
                  {score.weighted_score.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  className="py-2 pr-3 font-medium text-slate-900"
                  colSpan={3}
                >
                  Complexity score (weighted score × 20)
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                  {score.complexity_score}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
