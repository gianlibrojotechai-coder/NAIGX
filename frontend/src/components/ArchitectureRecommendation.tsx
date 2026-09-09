/**
 * The `architecture_recommendation` artifact — the design to build from (D-73).
 *
 * WHAT IT IS, SAID FIRST. The same Stage 6 architecture that the assessment
 * path turns into feedback is, on the requirement path, a recommendation: the
 * reader did not submit a design to be judged, they described a need and are
 * being handed a shape for it. The standing line at the top exists so nobody
 * reads the component table as a critique of something they wrote.
 *
 * INPUTS AND OUTPUTS ARE THE POINT. A person about to build this — in n8n, in
 * code, on paper — needs to know what each part consumes and produces before
 * the responsibility sentence means anything. They are given the same weight
 * as the responsibility, and the external system a component talks to is
 * named with its direction where Stage 6 named one.
 *
 * TRADE-OFFS ARE CARRIED, NOT REQUIRED. `FR-020` asks the requirement path for
 * neither trade-offs nor rejected alternatives, so an empty list here is an
 * honest state and is said to be one — not, as on the assessment path, the
 * sign of an incomplete artifact.
 */

import type {
  ArchitectureRecommendation,
  RecommendedComponent,
} from "../api/types";

const DIRECTION_COPY: Record<string, string> = {
  inbound: "receives from",
  outbound: "sends to",
  bidirectional: "exchanges with",
};

function Component({ component }: { component: RecommendedComponent }) {
  const external = component.external_system;
  const direction =
    component.integration_direction === undefined
      ? "integrates with"
      : (DIRECTION_COPY[component.integration_direction] ?? "integrates with");

  return (
    <li className="border border-slate-200 rounded-md overflow-hidden">
      <header className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {String(component.ordinal + 1).padStart(2, "0")}
        </span>
        <h4 className="font-semibold text-slate-900">{component.name}</h4>
        {external !== undefined && (
          <span className="text-xs text-slate-600">
            {direction} <span className="text-slate-800">{external}</span>
          </span>
        )}
      </header>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-slate-800">{component.responsibility}</p>
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr] text-sm">
          <dt className="font-medium text-slate-600">Takes in</dt>
          <dd className="text-slate-800">{component.inputs}</dd>
          <dt className="font-medium text-slate-600">Produces</dt>
          <dd className="text-slate-800">{component.outputs}</dd>
          <dt className="font-medium text-slate-600">On failure</dt>
          <dd className="text-slate-800">{component.failure_handling}</dd>
        </dl>
      </div>
    </li>
  );
}

export function ArchitectureRecommendationView({
  recommendation,
}: {
  recommendation: ArchitectureRecommendation;
}) {
  const {
    summary,
    data_flow: dataFlow,
    components,
    trade_offs: tradeOffs,
    rejected_approaches: rejected,
  } = recommendation;
  const ordered = [...components].sort((a, b) => a.ordinal - b.ordinal);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        A recommended architecture for what you described — rendered from the
        reasoning above, not generated beside it. It is a shape to build from,
        not a review of a design you submitted.
      </p>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          The recommended approach
        </h3>
        <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-3">
          {summary}
        </p>
        <p className="text-sm text-slate-700">
          <span className="font-medium">Data flow: </span>
          {dataFlow}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Components, in build order
        </h3>
        <p className="text-xs text-slate-600">
          Each one names what it takes in and what it produces, so the next
          component's input is always something an earlier one made.
        </p>
        <ul className="space-y-3">
          {ordered.map((component) => (
            <Component
              key={`${String(component.ordinal)}-${component.name}`}
              component={component}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          What this approach accepts
        </h3>
        {tradeOffs.length === 0 ? (
          <p className="text-sm text-slate-600">
            No trade-offs were stated for this recommendation. The requirement
            path does not require them, and none has been invented here.
          </p>
        ) : (
          <ul className="space-y-2">
            {tradeOffs.map((tradeOff, index) => (
              <li
                key={`${tradeOff.choice}-${String(index)}`}
                className="border border-slate-200 rounded-md p-3"
              >
                <p className="text-sm font-medium text-slate-900">
                  {tradeOff.choice}
                </p>
                <p className="text-sm text-slate-700 mt-0.5">
                  <span className="font-medium">Accepted cost: </span>
                  {tradeOff.accepted}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Alternatives considered
        </h3>
        {rejected.length === 0 ? (
          <p className="text-sm text-slate-600">
            No rejected alternative was stated. The reasoning hierarchy above
            records how this architecture was reached; a comparison of
            alternatives is not part of this artifact.
          </p>
        ) : (
          <ul className="space-y-2">
            {rejected.map((entry, index) => (
              <li
                key={`${entry.approach}-${String(index)}`}
                className="border border-slate-200 rounded-md p-3"
              >
                <p className="text-sm font-medium text-slate-900">
                  {entry.approach}
                </p>
                <p className="text-sm text-slate-700 mt-0.5">
                  <span className="font-medium">Rejected because: </span>
                  {entry.rejection_reason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
