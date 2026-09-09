/**
 * The `integration_requirements` artifact — every external system the design
 * touches: what for, which way, what its API must offer, what constrains it,
 * and what is not yet known (D-84, `FR-035`).
 *
 * PROVENANCE IS VISIBLE. A constraint the input stated and one the model
 * knows in general are different kinds of fact, and the second goes stale:
 * each is badged, and the knowledge-currency note is always shown last.
 * Uncertainties are listed as such — a capability the builder must verify is
 * never dressed as a requirement met.
 */

import type { IntegrationRequirements } from "../api/types";
import { Badge } from "./ui";

const DIRECTION: Record<string, string> = {
  inbound: "Inbound — data flows from the system into the design",
  outbound: "Outbound — the design writes to the system",
  bidirectional: "Bidirectional — data flows both ways",
};

export function IntegrationRequirementsView({
  requirements,
}: {
  requirements: IntegrationRequirements;
}) {
  return (
    <div className="space-y-6">
      {requirements.integrations.length === 0 ? (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">
            No external system
          </h3>
          <p className="text-sm text-slate-800">
            {requirements.no_integrations_statement}
          </p>
        </section>
      ) : (
        <ol className="space-y-6">
          {requirements.integrations.map((integration, index) => (
            <li
              key={`${integration.system}-${integration.component}`}
              className="space-y-2"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-sm font-semibold text-slate-900">
                  {integration.system}
                </h3>
                <span className="text-xs text-slate-600">
                  via {integration.component}
                </span>
              </div>
              <p className="text-sm text-slate-800">{integration.purpose}</p>
              <p className="text-xs text-slate-600">
                {DIRECTION[integration.direction] ?? integration.direction}
              </p>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  The API must offer
                </p>
                <ul className="list-disc pl-5 text-sm text-slate-800 space-y-0.5">
                  {integration.capabilities_required.map((capability) => (
                    <li key={capability}>{capability}</li>
                  ))}
                </ul>
              </div>
              {integration.constraints.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Known constraints
                  </p>
                  <ul className="space-y-1">
                    {integration.constraints.map((constraint, i) => (
                      <li
                        key={`${String(i)}-${constraint.constraint.slice(0, 16)}`}
                        className="text-sm text-slate-800 flex flex-wrap items-baseline gap-2"
                      >
                        <span className="flex-1 min-w-0">
                          {constraint.constraint}
                        </span>
                        <Badge>
                          {constraint.provenance === "stated"
                            ? `stated · context #${String(constraint.context_index ?? "")}`
                            : "general knowledge — verify"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {integration.uncertainties.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Verify before building
                  </p>
                  <ul className="list-disc pl-5 text-sm text-slate-800 space-y-0.5">
                    {integration.uncertainties.map((uncertainty) => (
                      <li key={uncertainty}>{uncertainty}</li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-slate-600 border-t border-slate-200 pt-3">
        {requirements.knowledge_currency_note}
      </p>
    </div>
  );
}
