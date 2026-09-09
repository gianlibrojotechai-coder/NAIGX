/**
 * The `implementation_roadmap` artifact — the phases in which the design is
 * built, each with what it builds, what it depends on, and what exists when
 * it is done (D-82, `FR-036`).
 *
 * THE OUTCOME IS THE POINT. A phase name says what is being worked on; the
 * outcome says what a person can do afterwards that they could not before,
 * which is what a reader scoping the work needs. The dependencies are shown
 * as the phase numbers they name, so the order can be checked against them.
 * An estimate appears only when the generator cited the context element that
 * supplied its basis — most roadmaps carry none, and say nothing rather than
 * a number.
 */

import type { ImplementationRoadmap } from "../api/types";
import { Badge } from "./ui";

export function ImplementationRoadmapView({
  roadmap,
}: {
  roadmap: ImplementationRoadmap;
}) {
  return (
    <div className="space-y-6">
      <ol className="space-y-5">
        {roadmap.phases.map((phase) => (
          <li
            key={phase.ordinal}
            className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5"
          >
            <span className="font-mono text-sm text-slate-500 tabular-nums pt-0.5">
              {String(phase.ordinal).padStart(2, "0")}
            </span>
            <div className="space-y-1.5 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">
                {phase.name}
              </h3>
              <p className="text-sm text-slate-800">{phase.objective}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                <span>Builds</span>
                {phase.components.map((component) => (
                  <Badge key={component}>{component}</Badge>
                ))}
              </div>
              <p className="text-xs text-slate-600">
                {phase.depends_on.length === 0
                  ? "Depends on nothing earlier; it can start first."
                  : `Depends on ${phase.depends_on
                      .map((d) => `phase ${String(d)}`)
                      .join(", ")}.`}
              </p>
              <p className="text-sm text-slate-900">
                <span className="font-medium">When it is done: </span>
                {phase.outcome}
              </p>
              {phase.estimate !== undefined && phase.estimate !== null && (
                <p className="text-xs text-slate-600">
                  Estimate {phase.estimate.duration}, on the basis of context
                  element #{phase.estimate.basis_context_index}.
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <section className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">Why this order</h3>
        <p className="text-sm text-slate-800">{roadmap.sequencing_rationale}</p>
      </section>
    </div>
  );
}
