/**
 * How the design disposed of each unknown (D-78, `docs/13` D-38).
 *
 * An unknown the design cites as if it were known is an assumption nobody
 * stated. Every unknown context element now carries a disposition — assumed,
 * excluded or deferred — with the statement that makes it checkable. Absent
 * on artifacts stored before D-78, which is said rather than hidden.
 */

import type { UnknownDisposition } from "../api/types";
import { humanise } from "../format";
import { Badge } from "./ui";

const TONE = {
  assumed: "warning",
  excluded: "neutral",
  deferred: "neutral",
} as const;

export function UnknownDispositions({
  dispositions,
}: {
  dispositions: readonly UnknownDisposition[] | undefined;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">
        How the unknowns were handled
      </h3>
      {dispositions === undefined ? (
        <p className="text-sm text-slate-600">
          Not recorded — this artifact was produced before dispositions were
          part of the design contract.
        </p>
      ) : dispositions.length === 0 ? (
        <p className="text-sm text-slate-600">
          The context set had no unknown element for the design to dispose of.
        </p>
      ) : (
        <ul className="space-y-2">
          {dispositions.map((entry) => (
            <li
              key={`${String(entry.context_index)}-${entry.disposition}`}
              className="border border-slate-200 rounded-md p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <Badge tone={TONE[entry.disposition]}>
                  {humanise(entry.disposition)}
                </Badge>
                <span className="font-medium text-slate-900 flex-1 min-w-0">
                  {entry.content ?? `Unknown #${String(entry.context_index)}`}
                </span>
              </div>
              <p className="text-slate-800 mt-1">{entry.statement}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
