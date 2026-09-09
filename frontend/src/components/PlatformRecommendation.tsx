/**
 * The `platform_recommendation` artifact — the platform, the criteria that
 * chose it, and what was rejected (D-78, `FR-034`).
 *
 * CRITERIA FIRST. The recommendation is only as defensible as the criteria it
 * followed from, so they lead — each traced to the context element or the
 * component it rests on. "No platform" is a real answer and is shown as one,
 * not as an empty field. The knowledge-currency note is always shown: a
 * platform's capabilities and pricing change, and the reader is told to
 * verify before committing (`FR-035`).
 */

import type { PlatformRecommendation } from "../api/types";
import { Badge } from "./ui";

export function PlatformRecommendationView({
  recommendation,
}: {
  recommendation: PlatformRecommendation;
}) {
  const platform = recommendation.recommended_platform;
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          The criteria applied
        </h3>
        <ol className="space-y-1.5">
          {recommendation.criteria_applied.map((criterion, index) => (
            <li
              key={`${String(index)}-${criterion.criterion.slice(0, 16)}`}
              className="text-sm text-slate-800 flex flex-wrap items-baseline gap-2"
            >
              <span className="font-mono text-xs text-slate-500 tabular-nums w-6">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 min-w-0">{criterion.criterion}</span>
              {criterion.context_index !== null && (
                <Badge>context #{criterion.context_index}</Badge>
              )}
              {criterion.component !== null && (
                <Badge tone="neutral">{criterion.component}</Badge>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          The recommendation
        </h3>
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
          <p className="text-2xl font-semibold text-slate-900">
            {platform === null
              ? "No platform — do not automate this"
              : platform}
          </p>
          {recommendation.also_required.length > 0 && (
            <p className="text-sm text-slate-700">
              <span className="font-medium">Alongside: </span>
              {recommendation.also_required
                .map((entry) => `${entry.platform} (${entry.role})`)
                .join("; ")}
            </p>
          )}
          <p className="text-sm text-slate-800">{recommendation.rationale}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Rejected, and why
        </h3>
        <ul className="space-y-2">
          {recommendation.alternatives_rejected.map((entry, index) => (
            <li
              key={`${String(index)}-${entry.platform}`}
              className="border border-slate-200 rounded-md p-3"
            >
              <p className="text-sm font-medium text-slate-900">
                {entry.platform}
              </p>
              <p className="text-sm text-slate-700 mt-0.5">
                {entry.rejection_reason}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          How each component is covered
        </h3>
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr] text-sm">
          {recommendation.fit.map((entry) => (
            <div key={entry.component} className="contents">
              <dt className="font-medium text-slate-700">{entry.component}</dt>
              <dd className="text-slate-800">{entry.how}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        <span className="font-medium">Verify before committing. </span>
        {recommendation.knowledge_currency_note}
      </p>
    </div>
  );
}
