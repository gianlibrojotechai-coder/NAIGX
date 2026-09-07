/**
 * A declined analysis (`API §9.3`, `FR-092`, `AI §5.4`, `FR-044`).
 *
 * ⚠️ THIS IS NOT AN ERROR SCREEN, AND IT IS NOT AN EMPTY RESULT. `API §9.3`
 * states that both refusal codes are "not failures": the request was
 * well-formed and processed correctly, and the *content* cannot be analysed.
 * Before this existed, a refused analysis rendered as an ordinary result with
 * every section blank — the user could not tell a deliberate refusal from a
 * run that had quietly produced nothing.
 *
 * THE UNKNOWNS ARE THE PRODUCT. `PV §5` identifies the insufficient case as a
 * defining product moment and `API §9.3` is explicit that "returning a generic
 * error here would waste the most valuable thing the system determined". So
 * what is missing, and what would resolve each item, is the largest thing on
 * the screen — not a footnote under an apology.
 *
 * The tone is deliberate: NAIGX would rather refuse than guess, and the
 * refusal is presented as a result the user can act on rather than as a
 * shortcoming to apologise for.
 */

import type { Refusal } from "../api/types";

const TYPE_LABELS: Readonly<Record<string, string>> = {
  business_requirement: "A business requirement",
  existing_workflow: "An existing workflow",
  job_description: "A job description",
  technical_assessment: "A technical assessment",
};

export function RefusalView({
  refusal,
  onStartOver,
}: {
  refusal: Refusal;
  onStartOver?: () => void;
}) {
  const insufficient = refusal.code === "insufficient_context";

  return (
    <section className="border border-slate-300 bg-white rounded-lg overflow-hidden">
      <header className="px-6 py-5 border-b border-slate-200 bg-slate-50">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          No analysis was produced
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          {insufficient
            ? "There is not enough here to reason about"
            : "This input is outside what NAIGX analyses"}
        </h2>
        <p className="mt-2 text-sm text-slate-700">{refusal.message}</p>
      </header>

      <div className="px-6 py-5 space-y-5">
        {/* `AI §5.4` / `FR-044` — what is missing, and what would resolve it.
            The reason this screen exists rather than an error toast. */}
        {insufficient && refusal.unknowns.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              What would let this proceed
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Add these and submit again. NAIGX stopped rather than inventing
              them.
            </p>
            <ul className="mt-3 space-y-3">
              {refusal.unknowns.map((unknown, index) => (
                <li
                  key={`${unknown.missing}-${String(index)}`}
                  className="border border-slate-200 rounded-md px-4 py-3"
                >
                  <p className="font-medium text-slate-900">
                    {unknown.missing}
                  </p>
                  {unknown.would_resolve !== null && (
                    <p className="mt-1 text-sm text-slate-600">
                      {unknown.would_resolve}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* An insufficiency with no recorded unknowns is an incomplete record,
            and saying so beats an empty panel that looks like a bug. */}
        {insufficient && refusal.unknowns.length === 0 && (
          <p className="text-sm text-slate-600">
            No specific gaps were recorded against this refusal, so what to add
            is not stated here. Treat that as an incomplete record rather than
            as an absence of anything to add.
          </p>
        )}

        {/* `FR-092` — name what *would* work. A refusal that does not leaves
            the user with nothing to try. */}
        {!insufficient && refusal.supportedTypes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              What NAIGX does analyse
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {refusal.supportedTypes.map((type) => (
                <li key={type}>
                  {TYPE_LABELS[type] ?? type.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {refusal.action !== null && (
          <p className="text-sm text-slate-700 border-t border-slate-200 pt-4">
            {refusal.action}
          </p>
        )}

        {onStartOver !== undefined && (
          <button
            type="button"
            onClick={onStartOver}
            className="inline-flex items-center rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            Submit a different input
          </button>
        )}
      </div>
    </section>
  );
}
