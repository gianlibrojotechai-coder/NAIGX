/**
 * The `interview_guidance` artifact — what the posting is really testing for,
 * and what to be ready to say (D-76).
 *
 * DERIVED, AND SHOWN TO BE. Each competency names the requirements it came
 * from and cites only capabilities the analysis matched, so a reader can see
 * why it is here rather than take it as the generic interview canon. A gap
 * is stated as a gap with the honest way to handle it, which is worth more in
 * an interview than a claim that cannot be backed.
 */

import type { InterviewGuidance, InterviewCompetency } from "../api/types";
import { Badge } from "./ui";

function Competency({
  competency,
  index,
}: {
  competency: InterviewCompetency;
  index: number;
}) {
  const gap = competency.standing === "gap";
  return (
    <li
      className={`border rounded-md overflow-hidden ${gap ? "border-rose-300" : "border-slate-200"}`}
    >
      <header className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h4 className="font-semibold text-slate-900 flex-1 min-w-0">
          {competency.name}
        </h4>
        <Badge tone={gap ? "danger" : "success"}>
          {gap ? "A gap" : "Evidenced"}
        </Badge>
      </header>
      <div className="px-4 py-3 space-y-3">
        <p className="text-sm text-slate-700">
          <span className="font-medium">Why this posting implies it: </span>
          {competency.why_the_posting_implies_it}
          <span className="text-xs text-slate-500">
            {" "}
            (from {competency.derived_from.join(", ")})
          </span>
        </p>
        <div>
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Be ready to explain
          </h5>
          <ul className="mt-1 space-y-1 list-disc pl-5">
            {competency.be_ready_to_explain.map((point, i) => (
              <li
                key={`${String(i)}-${point.slice(0, 16)}`}
                className="text-sm text-slate-800"
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-3">
          <span className="font-medium">Likely question: </span>
          {competency.likely_question}
        </p>
        {competency.evidence_to_cite.length > 0 && (
          <p className="text-sm text-slate-700 flex flex-wrap items-center gap-2">
            <span className="font-medium">Cite:</span>
            {competency.evidence_to_cite.map((id) => (
              <code
                key={id}
                className="text-xs bg-slate-100 px-1.5 py-0.5 rounded"
              >
                {id}
              </code>
            ))}
          </p>
        )}
        {competency.how_to_handle_the_gap !== null && (
          <p className="text-sm text-slate-800">
            <span className="font-medium">How to handle the gap: </span>
            {competency.how_to_handle_the_gap}
          </p>
        )}
      </div>
    </li>
  );
}

export function InterviewGuidanceView({
  guidance,
}: {
  guidance: InterviewGuidance;
}) {
  const ordered = [...guidance.competencies].sort((a, b) => a.rank - b.rank);
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        The competencies this posting implies, derived from its requirements.
        Each names the requirements behind it and cites only what the analysis
        matched — nothing here is the generic interview canon.
      </p>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          How to frame it
        </h3>
        <p className="text-sm text-slate-800">{guidance.framing}</p>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          In preparation order
        </h3>
        <ol className="space-y-3">
          {ordered.map((competency, index) => (
            <Competency
              key={`${String(competency.rank)}-${competency.name}`}
              competency={competency}
              index={index}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}
