/**
 * The analysis's confidence band, with every factor behind it (D-86,
 * `AI §8.4` "factors are always exposed", `FR-045`).
 *
 * A BAND, NOT A SCORE. The band leads; the base score is shown small because
 * it is an intermediate the thresholds were applied to, not a measure of its
 * own. Each of the seven factors states how it took part — weighted, a cap,
 * or unmeasured in this version — so a reader can see that the v1 model
 * rests on two measured factors and says so, rather than seven.
 */

import type { OverallConfidence } from "../api/types";
import { Badge } from "./ui";

const TONE: Record<string, "success" | "warning" | "danger"> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

const DECIDED: Record<string, string> = {
  no_artifacts: "No recommendation was produced, so the band is low by rule.",
  conflict_cap:
    "The input carries a contradiction Stage 3 flagged, which caps the band at medium.",
  weighted_base:
    "Decided by the weighted measurement of requirement clarity and evidence quality.",
};

export function OverallConfidenceView({
  confidence,
}: {
  confidence: OverallConfidence;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Confidence</h3>
        <Badge tone={TONE[confidence.band] ?? "warning"}>
          {confidence.band}
        </Badge>
        <span className="text-xs text-slate-600">
          {DECIDED[confidence.decided_by] ?? confidence.decided_by}
          {confidence.base_score !== null &&
            ` Base ${confidence.base_score.toFixed(3)} on the ${confidence.model_version} model.`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pr-3">Factor</th>
              <th className="py-1.5 pr-3 text-right">Value</th>
              <th className="py-1.5 pr-3 text-right">Weight</th>
              <th className="py-1.5 pr-3">Part played</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {confidence.factors.map((factor) => (
              <tr
                key={factor.id}
                className="border-t border-slate-200 align-top"
              >
                <td className="py-1.5 pr-3">
                  <p className="text-slate-900">
                    <span className="font-mono text-xs text-slate-500 mr-1.5">
                      {factor.id}
                    </span>
                    {factor.label}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{factor.note}</p>
                </td>
                <td className="py-1.5 pr-3 text-right text-slate-900">
                  {factor.value === null ? "—" : factor.value.toFixed(3)}
                </td>
                <td className="py-1.5 pr-3 text-right text-slate-700">
                  {Math.round(factor.weight * 100)}%
                </td>
                <td className="py-1.5 pr-3 text-slate-700">
                  {factor.role === "weighted"
                    ? "Weighted"
                    : factor.role === "cap"
                      ? "Cap"
                      : "Not measured in v1"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
