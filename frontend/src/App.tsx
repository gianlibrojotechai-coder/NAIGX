/**
 * NAIGX — job-description analysis (`M-12`, first usable increment).
 *
 * Paste a posting, submit, watch it run, read the stored analysis. One page,
 * one flow, no configuration (`NFR-071`).
 *
 * WHAT WAS REMOVED AND WHY. The scaffold described a workflow-complexity
 * analyser with a complexity score, risk detection and optimisation
 * suggestions, above a textarea and button wired to nothing. None of that is
 * what NAIGX does, and a header advertising features that do not exist is a
 * false claim in the product's own voice. The health-check indicator went with
 * it: a permanent "Connected" dot reported on a dependency the user has no
 * decision to make about, while saying nothing about the request they actually
 * care about. Reachability is now reported where it matters — on the failure
 * of the call that needed it, with the corrective step attached.
 *
 * NOT HERE, DELIBERATELY: authentication, history, export, SSE. Each is
 * specified and each is a later increment; none is stubbed, because a control
 * that does nothing is worse than an absent one.
 */

import { JobDescriptionForm } from "./components/JobDescriptionForm";
import { Processing } from "./components/Processing";
import { AnalysisView } from "./components/AnalysisView";
import { isOffline } from "./api/analyses";
import { useAnalysis } from "./useAnalysis";

function App() {
  const { state, submit, reset, retryRetrieval } = useAnalysis();

  const showForm = state.phase === "idle" || state.phase === "submitting";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            NAIGX
          </h1>
          <p className="text-sm text-slate-600">
            Should you apply to this role, or build evidence first?
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {showForm && (
          <JobDescriptionForm
            onSubmit={(content) => {
              void submit(content);
            }}
            busy={state.phase === "submitting"}
          />
        )}

        {state.phase === "processing" && (
          <Processing
            status={state.status}
            elapsedSeconds={state.elapsedSeconds}
            connectionWarning={state.connectionWarning}
            onCancel={reset}
          />
        )}

        {state.phase === "error" && state.failure !== null && (
          <div
            role="alert"
            className="border border-rose-300 bg-rose-50 rounded-lg p-5"
          >
            <h2 className="font-semibold text-rose-900">
              {isOffline(state.failure)
                ? "Cannot reach the backend"
                : "That did not work"}
            </h2>
            <p className="text-sm text-rose-900 mt-1">
              {state.failure.message}
            </p>
            {state.failure.action !== null && (
              <p className="text-sm text-rose-900 mt-2">
                <span className="font-medium">What to do: </span>
                {state.failure.action}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              {/* The analysis may have completed even though retrieving it
                  did not — offer the retry before offering to start over. */}
              {state.analysisId !== null && (
                <button
                  type="button"
                  onClick={retryRetrieval}
                  className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
                >
                  Retry retrieval
                </button>
              )}
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
              >
                Start over
              </button>
            </div>

            {state.analysisId !== null && (
              <p className="text-xs text-rose-900/80 mt-3">
                The analysis is stored as <code>{state.analysisId}</code> and is
                not lost.
              </p>
            )}
          </div>
        )}

        {state.phase === "done" && state.analysis !== null && (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
              >
                Analyse another posting
              </button>
            </div>
            <AnalysisView analysis={state.analysis} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
