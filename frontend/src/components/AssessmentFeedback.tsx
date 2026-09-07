/**
 * The `assessment_feedback` artifact — the approach, and what it costs.
 *
 * `FR-023`: "Output is structured for the user to understand and defend, not
 * to submit verbatim." The trade-offs and rejected approaches are therefore
 * given equal weight to the design itself rather than tucked underneath it —
 * they are the part a reader has to be able to say out loud when questioned,
 * and the part a design document usually omits.
 *
 * `FR-023` requires at least one rejected alternative with its reason, and the
 * schema enforces `minItems: 1` on both lists. An empty list reaching here
 * means something upstream failed, so it renders as a stated absence rather
 * than as a section that quietly disappears.
 */

import type { AssessmentComponent, AssessmentFeedback } from "../api/types";
import { Unavailable } from "./ui";

function Component({ component }: { component: AssessmentComponent }) {
  return (
    <li className="border border-slate-200 rounded-md p-4 space-y-2">
      <h4 className="font-semibold text-slate-900">{component.name}</h4>
      <p className="text-sm text-slate-800">{component.responsibility}</p>
      <p className="text-sm text-slate-700">
        <span className="font-medium">On failure: </span>
        {component.failure_handling}
      </p>
    </li>
  );
}

export function AssessmentFeedbackView({
  feedback,
}: {
  feedback: AssessmentFeedback;
}) {
  const { approach, trade_offs: tradeOffs, rejected_approaches: rejected } = feedback;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">The approach</h3>
        <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-3">
          {approach.summary}
        </p>
        <p className="text-sm text-slate-700">
          <span className="font-medium">Data flow: </span>
          {approach.data_flow}
        </p>
        <ul className="space-y-3">
          {approach.components.map((component, index) => (
            <Component
              key={`${component.name}-${String(index)}`}
              component={component}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          What this approach accepts
        </h3>
        <p className="text-xs text-slate-600">
          An approach that costs nothing is either trivial or misdescribed.
          These are the costs to be ready to defend.
        </p>
        {tradeOffs.length === 0 ? (
          <Unavailable>
            No trade-offs were stored. `FR-023` requires them, so treat this as
            an incomplete artifact rather than a costless design.
          </Unavailable>
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
          Alternatives rejected
        </h3>
        <p className="text-xs text-slate-600">
          The question you will be asked is "why not X?". These are the
          prepared answers.
        </p>
        {rejected.length === 0 ? (
          <Unavailable>
            No rejected alternatives were stored. `FR-023` requires at least
            one, because a solution presented without alternatives cannot be
            defended under questioning.
          </Unavailable>
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
