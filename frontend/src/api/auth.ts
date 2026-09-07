/**
 * Authentication and account calls (`API-001`–`API-004`, `API-010`–`API-014`).
 *
 * ⚠️ TOKENS LIVE IN MEMORY, NOT IN `localStorage`. A token in web storage is
 * readable by any script that ends up on the page, which turns one XSS into a
 * stolen session that outlives the tab. Holding it in a module variable means
 * a reload requires a refresh exchange — a real cost, paid deliberately.
 *
 * ⚠️ THE REFRESH TOKEN IS NEVER SENT AS A `Bearer` HEADER. `API-002` takes it
 * in the body, and the server's request authenticator does not read the
 * refresh table at all ([D-44](../../../docs/19-D-44-Refresh-Token-Table.md)).
 * Sending it as a credential would not work, and the client should not be
 * shaped as though it might.
 *
 * ⚠️ A REFRESH IS ATTEMPTED ONCE PER FAILED REQUEST, NEVER IN A LOOP. If the
 * retry also 401s, the session is over. `API-002` invalidates a whole family
 * on reuse, so a client that kept retrying with rotated tokens would be
 * indistinguishable from an attacker replaying one — and would revoke the
 * user's own session as it went.
 */

import axios, { type AxiosRequestConfig } from "axios";

import { api } from "./client";
import { toApiFailure, type ApiFailure } from "./analyses";
import type { SuccessEnvelope } from "./types";

export interface AccountUser {
  readonly user_id: string;
  readonly email: string;
  readonly created_at?: string;
  readonly training_consent?: boolean;
}

interface SessionResponse {
  readonly user?: AccountUser;
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_at: string;
  /** `FR-004` — present when an anonymous analysis was transferred. */
  readonly claimed_analysis_id?: string;
}

export interface Session {
  readonly user: AccountUser | null;
  readonly expiresAt: string;
  readonly claimedAnalysisId: string | null;
}

// --- in-memory credential store ---------------------------------------------

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onSessionEnded: (() => void) | null = null;

/** Called when a refresh fails, so the UI can return to a signed-out state. */
export const setSessionEndedHandler = (handler: () => void): void => {
  onSessionEnded = handler;
};

export const isSignedIn = (): boolean => accessToken !== null;

/** The header for an authenticated request, or nothing. */
export const authHeader = (): Record<string, string> =>
  accessToken === null ? {} : { Authorization: `Bearer ${accessToken}` };

const store = (tokens: SessionResponse): Session => {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  return {
    user: tokens.user ?? null,
    expiresAt: tokens.expires_at,
    claimedAnalysisId: tokens.claimed_analysis_id ?? null,
  };
};

const clear = (): void => {
  accessToken = null;
  refreshToken = null;
};

// --- API-004 / API-001 / API-003 --------------------------------------------

export const register = async (
  email: string,
  password: string,
  anonymousToken?: string | null,
): Promise<Session> => {
  const response = await api.post<SuccessEnvelope<SessionResponse>>("/users", {
    email,
    password,
    ...(anonymousToken != null ? { anonymous_token: anonymousToken } : {}),
  });
  return store(response.data.data);
};

export const signIn = async (
  email: string,
  password: string,
  anonymousToken?: string | null,
): Promise<Session> => {
  const response = await api.post<SuccessEnvelope<SessionResponse>>(
    "/auth/sessions",
    {
      email,
      password,
      ...(anonymousToken != null ? { anonymous_token: anonymousToken } : {}),
    },
  );
  return store(response.data.data);
};

export const signOut = async (): Promise<void> => {
  try {
    await api.delete("/auth/sessions/current", { headers: authHeader() });
  } catch {
    // `API-003` is idempotent and the local credential is being dropped
    // regardless. A failed logout must not leave the user apparently signed in.
  } finally {
    clear();
  }
};

// --- API-002 ----------------------------------------------------------------

/**
 * Exchanges the refresh token for a new pair.
 *
 * Returns false when the session is over, which includes `token_reused`: the
 * server has revoked the family, and the only correct response is to sign the
 * user out rather than retry into a revoked session.
 */
const refreshSession = async (): Promise<boolean> => {
  if (refreshToken === null) return false;
  try {
    const response = await api.post<SuccessEnvelope<SessionResponse>>(
      "/auth/sessions/refresh",
      { refresh_token: refreshToken },
    );
    store(response.data.data);
    return true;
  } catch {
    clear();
    onSessionEnded?.();
    return false;
  }
};

/**
 * Performs an authenticated request, refreshing once on a 401.
 *
 * The single place a retry may happen. Every authenticated call goes through
 * here so no other module has to remember the once-only rule.
 */
export const authed = async <T>(
  request: (config: AxiosRequestConfig) => Promise<T>,
): Promise<T> => {
  try {
    return await request({ headers: authHeader() });
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    if (status !== 401) throw error;

    // Exactly one attempt. See the header note.
    const refreshed = await refreshSession();
    if (!refreshed) throw error;

    return await request({ headers: authHeader() });
  }
};

// --- account ----------------------------------------------------------------

export const fetchCurrentUser = async (): Promise<AccountUser> => {
  const response = await authed((config) =>
    api.get<SuccessEnvelope<AccountUser>>("/users/me", config),
  );
  return response.data.data;
};

export interface Settings {
  readonly default_export_format: "markdown" | "pdf";
  readonly updated_at: string;
}

export const fetchSettings = async (): Promise<Settings> => {
  const response = await authed((config) =>
    api.get<SuccessEnvelope<Settings>>("/users/me/settings", config),
  );
  return response.data.data;
};

export const updateSettings = async (
  format: "markdown" | "pdf",
): Promise<Settings> => {
  const response = await authed((config) =>
    api.put<SuccessEnvelope<Settings>>(
      "/users/me/settings",
      { default_export_format: format },
      config,
    ),
  );
  return response.data.data;
};

export interface DeletionReceipt {
  readonly trace_purge_window: string;
  readonly deletion_id?: string;
  readonly deleted_count?: number;
}

/**
 * `API-011` — permanent, and `202` because deletion spans two stores.
 *
 * The local credential is dropped whatever the server said: the session rows
 * cascaded with the account, so the token in memory no longer resolves.
 */
export const deleteAccount = async (): Promise<DeletionReceipt> => {
  const response = await authed((config) =>
    api.delete<SuccessEnvelope<DeletionReceipt>>("/users/me", {
      ...config,
      data: { confirmation: true },
    }),
  );
  clear();
  return response.data.data;
};

export { toApiFailure, type ApiFailure };
