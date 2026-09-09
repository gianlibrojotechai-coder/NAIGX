/**
 * The `intent_brief` artifact — what the input asks for, as understood (D-66).
 *
 * The first artifact of every reasoning path, rendered from the Stage 2
 * intent record within seconds of submission so a reader has something true
 * to read while the slow stages run (`NFR-001`, `FR-041`).
 *
 * ⚠️ IT SAYS WHAT IT IS, FIRST. This is a statement of the problem, not a
 * conclusion, and the design's whole honesty rests on a reader never
 * mistaking one for the other. The standing line is not decoration; the
 * artifact's schema fixes `standing: "understanding_only"` so the document
 * carries the same claim in storage that it makes on screen.
 *
 * Provenance travels with every objective (`FR-042`, `FR-043`): *stated* is
 * in the input, *inferred* was derived from it — the same two words the
 * understanding section uses, so the vocabulary is one.
 */

import type { IntentBrief } from "../api/types";

function Provenance({ value }: { value: "stated" | "inferred" }) {
  return (
    <span
      className="ml-2 inline-flex items-center rounded border border-slate-300 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-700"
      title={
        value === "stated"
          ? "Present in the input text"
          : "Derived from the input, not written in it"
      }
    >
      {value === "stated" ? "● stated" : "◐ inferred"}
    </span>
  );
}

export function IntentBriefView({ brief }: { brief: IntentBrief }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        How the input was understood before any reasoning ran. This is the
        problem as stated and inferred, not a conclusion.
      </p>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Objective</h3>
        <p className="text-sm text-slate-800">
          {brief.objective.content}
          <Provenance value={brief.objective.provenance} />
        </p>
      </section>

      {brief.secondary_objectives.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Also aims to</h3>
          <ul className="list-disc pl-5 space-y-1">
            {brief.secondary_objectives.map((objective, index) => (
              <li
                key={`${objective.content}-${String(index)}`}
                className="text-sm text-slate-800"
              >
                {objective.content}
                <Provenance value={objective.provenance} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Scope, as inferred
        </h3>
        <p className="text-sm text-slate-800">{brief.inferred_scope}</p>
      </section>
    </div>
  );
}
