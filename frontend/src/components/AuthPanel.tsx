/**
 * Sign in, register and sign out (`FR-070`, `FR-004`, `UX-001`).
 *
 * ⚠️ NEVER SHOWN BEFORE A FIRST ANALYSIS. `FR-004`: "the prompt appears only
 * at the point of use", and `UX-001` — "zero configuration to value" — means a
 * new user completes an analysis "with one paste and one click". An account
 * gate on the landing surface would break both, so this is a control the user
 * can reach and never a wall they must pass.
 *
 * `FR-004` CLAIM ON AUTHENTICATION. When the current session holds an
 * anonymous analysis, the token travels with the sign-in or registration and
 * the analysis becomes theirs. That is stated on the form rather than done
 * silently: a user should know their analysis is about to move into an
 * account, and one who does not want that should be able to see it happening.
 *
 * The claim is **not** required. A stale or absent token still signs the user
 * in — failing the login because an analysis expired would be punishing them
 * for waiting.
 */

import { useState } from "react";

import {
  register,
  signIn,
  toApiFailure,
  type AccountUser,
} from "../api/auth";
import { getAnonymousToken } from "../api/analyses";

type Mode = "signin" | "register";

export function AuthPanel({
  user,
  onSignedIn,
  onSignOut,
  onOpenHistory,
  busy,
}: {
  user: AccountUser | null;
  onSignedIn: (user: AccountUser | null, claimedAnalysisId: string | null) => void;
  onSignOut: () => void;
  onOpenHistory: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const claimable = getAnonymousToken();

  if (user !== null) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-600">{user.email}</span>
        <button
          type="button"
          onClick={onOpenHistory}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          History
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
      >
        Sign in
      </button>
    );
  }

  const submit = async () => {
    setWorking(true);
    setError(null);
    setAction(null);
    try {
      const session =
        mode === "register"
          ? await register(email, password, claimable)
          : await signIn(email, password, claimable);
      setOpen(false);
      setEmail("");
      setPassword("");
      onSignedIn(session.user, session.claimedAnalysisId);
    } catch (caught) {
      const failure = toApiFailure(caught);
      setError(failure.message);
      setAction(failure.action);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">
          {mode === "register" ? "Create an account" : "Sign in"}
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          Close
        </button>
      </div>

      <p className="mt-1 text-sm text-slate-600">
        An account is needed to keep history and to export. It is never needed
        to run an analysis.
      </p>

      {/* `FR-004` — the claim, stated before it happens. */}
      {claimable !== null && (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          The analysis on screen will be saved to this account.
        </p>
      )}

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            autoComplete="email"
            required
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Password</span>
          <input
            type="password"
            value={password}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            required
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {mode === "register" && (
            <span className="mt-1 block text-xs text-slate-500">
              At least 12 characters. Length is what makes a password hard to
              guess.
            </span>
          )}
        </label>

        {error !== null && (
          <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2">
            <p className="text-sm text-rose-900">{error}</p>
            {action !== null && (
              <p className="mt-1 text-xs text-rose-800">{action}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={working || busy}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {working
            ? "Working…"
            : mode === "register"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "register" ? "signin" : "register");
          setError(null);
        }}
        className="mt-3 text-xs text-slate-600 underline hover:text-slate-900"
      >
        {mode === "register"
          ? "I already have an account"
          : "I need an account"}
      </button>
    </div>
  );
}
