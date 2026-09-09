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
import { DataPolicy } from "./components/DataPolicy";
import { Processing } from "./components/Processing";
import { useEffect, useState } from "react";

import { AnalysisView } from "./components/AnalysisView";
import { RefusalView } from "./components/RefusalView";
import { AuthPanel } from "./components/AuthPanel";
import { HistoryView } from "./components/HistoryView";
import { isOffline } from "./api/analyses";
import { setSessionEndedHandler, signOut, type AccountUser } from "./api/auth";
import { useAnalysis } from "./useAnalysis";

function App() {
  const {
    state,
    submit,
    reset,
    retryRetrieval,
    correctClassification,
    openStored,
  } = useAnalysis();

  const [user, setUser] = useState<AccountUser | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  // `NFR-031` — the policy must be reachable BEFORE first submission, so it is
  // a peer of the form rather than something behind an account or a footer.
  const [showPolicy, setShowPolicy] = useState(false);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);

  /**
   * A refresh that fails ends the session (`API-002`).
   *
   * Registered once. The client has already dropped the credential by the time
   * this fires; this is the UI catching up rather than deciding.
   */
  useEffect(() => {
    setSessionEndedHandler(() => {
      setUser(null);
      setShowHistory(false);
    });
  }, []);

  const showForm =
    !showHistory && (state.phase === "idle" || state.phase === "submitting");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* WCAG 2.4.1 Bypass Blocks (Level A). Without this, a keyboard user
          traverses the whole header — including the auth controls — on every
          view before reaching the content they came for.

          Visually hidden until focused, which is the point: it costs sighted
          users nothing and is the first stop for anyone tabbing. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>

      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-accent-300 via-accent-400 to-sky-700 bg-clip-text text-transparent">
              NAIGX
            </span>
          </h1>
          <p className="text-sm text-slate-600">
            A decision, then the reasoning behind it.
          </p>
          {/* `FR-004`/`UX-001` — reachable, never a gate. An analysis runs
              with no account, and this sits beside that rather than before it. */}
          <div className="ml-auto">
            <AuthPanel
              user={user}
              busy={state.phase === "submitting"}
              onSignedIn={(signedIn, claimedAnalysisId) => {
                setUser(signedIn);
                setClaimNotice(
                  claimedAnalysisId === null
                    ? null
                    : "Your analysis has been saved to this account.",
                );
              }}
              onSignOut={() => {
                void signOut().then(() => {
                  setUser(null);
                  setShowHistory(false);
                });
              }}
              onOpenHistory={() => {
                setShowHistory(true);
              }}
            />
          </div>
        </div>
      </header>

      {/* `tabIndex={-1}` so the skip link can move focus here. Without it the
          browser scrolls but leaves focus in the header, and the next Tab
          returns the user to where they were trying to leave. */}
      <main
        id="main"
        tabIndex={-1}
        className="max-w-4xl mx-auto px-6 py-8 space-y-6 focus:outline-none"
      >
        {claimNotice !== null && (
          <p
            role="status"
            className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
          >
            {claimNotice}
          </p>
        )}

        {showHistory && (
          <HistoryView
            onClose={() => {
              setShowHistory(false);
            }}
            onOpen={(analysisId) => {
              setShowHistory(false);
              void openStored(analysisId);
            }}
          />
        )}

        {showPolicy && (
          <DataPolicy
            onClose={() => {
              setShowPolicy(false);
            }}
          />
        )}

        {showForm && (
          <>
            <div className="pt-4 pb-2">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Paste it. Get a decision.
              </h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                A job posting, a business problem, an existing workflow, or a
                technical brief. NAIGX works out which it is, reasons it
                through, and shows you the conclusion first — with everything it
                rests on one click below.
              </p>
            </div>
            <JobDescriptionForm
              onSubmit={(content) => {
                void submit(content);
              }}
              busy={state.phase === "submitting"}
            />

            {/* `NFR-031` — "accessible before first submission". Beside the
                form, not in a footer: a policy linked from a results page is
                published after the decision it exists to inform. */}
            {!showPolicy && (
              <p className="text-sm text-slate-600">
                Your text is encrypted and never used to train models.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setShowPolicy(true);
                  }}
                  className="underline underline-offset-2 hover:text-slate-900"
                >
                  How your data is handled
                </button>
              </p>
            )}
          </>
        )}

        {!showHistory && state.phase === "processing" && (
          <Processing
            status={state.status}
            elapsedSeconds={state.elapsedSeconds}
            connectionWarning={state.connectionWarning}
            progress={state.progress}
            streaming={state.streaming}
            onCancel={reset}
          />
        )}

        {!showHistory && state.phase === "error" && state.failure !== null && (
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

        {/* `API §9.3` — a refusal is a determination, not a failure, and gets
            its own presentation rather than an empty result or an error box. */}
        {!showHistory &&
          state.phase === "refused" &&
          state.refusal !== null && (
            <RefusalView refusal={state.refusal} onStartOver={reset} />
          )}

        {!showHistory && state.phase === "done" && state.analysis !== null && (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
              >
                New analysis
              </button>
            </div>
            <AnalysisView
              analysis={state.analysis}
              // `FR-014` — offered only when this session holds the content the
              // correction must re-submit (`API §7.5` step 1). An analysis
              // opened without it cannot be corrected, and hiding the control
              // beats offering one that would fail.
              {...(state.submittedContent !== null
                ? { onCorrectClassification: correctClassification }
                : {})}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
