/**
 * The `skill_gap_analysis` artifact — the requirements as the verdict weighed
 * them, and the order to close the gaps (D-75).
 *
 * THE ORDER IS THE PRODUCT. The reasoning hierarchy already shows every
 * requirement with its evidence and gaps; what it does not do is tell a
 * reader which gap to close first. So this presenter leads with that list —
 * decisive first, then priority, then must-have before nice-to-have — and
 * puts the full classification under it.
 *
 * NO GAPS IS A FINDING. An `apply_now` analysis with everything evidenced
 * renders a stated absence, not an empty box (`FR-091`).
 */

import type { SkillGapAnalysis, SkillGapRequirement } from "../api/types";
import { humanise } from "../format";
import { Badge } from "./ui";

const PRIORITY_TONE = {
  high: "danger",
  medium: "warning",
  low: "neutral",
} as const;

function Requirement({ requirement }: { requirement: SkillGapRequirement }) {
  const gap = requirement.gap;
  return (
    <li
      className={`border rounded-md p-3 ${gap?.decisive === true ? "border-rose-300 bg-rose-50/40" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <h4 className="font-medium text-slate-900 flex-1 min-w-0">
          {requirement.name}
        </h4>
        <Badge
          tone={requirement.necessity === "must_have" ? "danger" : "neutral"}
        >
          {humanise(requirement.necessity)}
        </Badge>
        <Badge>{humanise(requirement.kind)}</Badge>
        <Badge tone={gap === null ? "success" : "warning"}>
          {gap === null ? "Evidenced" : "Gap"}
        </Badge>
      </div>
      {gap !== null && (
        <p className="mt-2 text-sm text-slate-800">
          <span className="font-medium">
            {humanise(gap.priority)} priority
            {gap.decisive ? ", decided the verdict" : ""}
            {gap.buildable ? ", a build could close it" : ""}:{" "}
          </span>
          {gap.why_it_matters}
        </p>
      )}
      {requirement.evidence.length > 0 && (
        <ul className="mt-2 space-y-1">
          {requirement.evidence.map((item) => (
            <li
              key={item.capability_id}
              className="text-sm text-slate-800 flex flex-wrap items-center gap-2"
            >
              <Badge tone={item.strength === "strong" ? "success" : "warning"}>
                {humanise(item.strength)} match
              </Badge>
              <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                {item.capability_id}
              </code>
              <span className="text-slate-600 text-xs break-all">
                {item.evidence_ref}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function SkillGapAnalysisView({
  analysis,
}: {
  analysis: SkillGapAnalysis;
}) {
  const { summary, priorities, requirements } = analysis;
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        The posting's requirements as the verdict weighed them — rendered from
        the reasoning above, not generated beside it. {summary.requirements}{" "}
        requirements: {summary.must_have} must-have, {summary.nice_to_have}{" "}
        nice-to-have; {summary.evidenced} evidenced; {summary.gaps} gap
        {summary.gaps === 1 ? "" : "s"}, {summary.decisive_gaps} of which
        decided the verdict.
      </p>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Close these first
        </h3>
        {priorities.length === 0 ? (
          <p className="text-sm text-slate-600">
            No gaps. Every requirement is evidenced — there is nothing to close
            before applying.
          </p>
        ) : (
          <ol className="space-y-2">
            {priorities.map((entry, index) => (
              <li
                key={entry.requirement_id}
                className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-md px-3 py-2"
              >
                <span className="font-mono text-xs text-slate-500 tabular-nums w-6">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-medium text-slate-900 flex-1 min-w-0">
                  {entry.name}
                </span>
                <Badge tone={PRIORITY_TONE[entry.priority]}>
                  {humanise(entry.priority)}
                </Badge>
                {entry.decisive && <Badge tone="danger">Decisive</Badge>}
                {entry.buildable && <Badge tone="success">Buildable</Badge>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Every requirement
        </h3>
        <ul className="space-y-2">
          {requirements.map((requirement) => (
            <Requirement key={requirement.id} requirement={requirement} />
          ))}
        </ul>
      </section>
    </div>
  );
}
