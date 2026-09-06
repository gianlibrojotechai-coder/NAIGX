/**
 * The three calls this tool makes (`API-020`, `API-026`, `API-021`).
 *
 * Each returns the `data` payload; the envelope is unwrapped here so no
 * component has to know about it. Errors are normalised into `ApiFailure`,
 * which always carries a message written to be read by a person — the server's
 * own text where there is one, because `FR-005` and `FR-090` require the API's
 * messages to name the constraint and the corrective step, and replacing them
 * with a generic string here would discard exactly that work.
 */

import axios from "axios";

import { api, POLL_TIMEOUT_MS } from "./client";
import type {
  Analysis,
  AnalysisStatusResponse,
  CreatedAnalysis,
  ErrorEnvelope,
  SuccessEnvelope,
} from "./types";

export interface ApiFailure {
  readonly message: string;
  /** The corrective step, when the server named one (`FR-090`). */
  readonly action: string | null;
  readonly code: string | null;
}

/** True when the failure is the backend being unreachable rather than refusing. */
export const isOffline = (failure: ApiFailure): boolean =>
  failure.code === "network_unreachable";

export const toApiFailure = (error: unknown): ApiFailure => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ErrorEnvelope | undefined;
    if (body?.error) {
      return {
        message: body.error.message,
        action: body.error.action ?? null,
        code: body.error.code,
      };
    }
    if (error.response) {
      return {
        message: `The server responded with ${String(error.response.status)} and no explanation.`,
        action: "Try again; if it persists, check the backend logs.",
        code: "unexpected_response",
      };
    }
    // No response at all: the request never completed.
    return {
      message:
        error.code === "ECONNABORTED"
          ? "The request timed out before the server answered."
          : "Could not reach the NAIGX backend.",
      action:
        "Start the backend (`npm run dev` in `backend/`) and confirm it is listening on the configured port.",
      code: "network_unreachable",
    };
  }
  return {
    message: error instanceof Error ? error.message : "Something went wrong.",
    action: null,
    code: null,
  };
};

/** `API-020`. Returns `202` before reasoning completes. */
export const createAnalysis = async (
  content: string,
  signal?: AbortSignal,
): Promise<CreatedAnalysis> => {
  const response = await api.post<SuccessEnvelope<CreatedAnalysis>>(
    "/analyses",
    { content, source_type: "paste" },
    signal ? { signal } : {},
  );
  return response.data.data;
};

/** `API-026`. Cheap enough to poll; bounded by its own short timeout. */
export const fetchStatus = async (
  analysisId: string,
  signal?: AbortSignal,
): Promise<AnalysisStatusResponse> => {
  const response = await api.get<SuccessEnvelope<AnalysisStatusResponse>>(
    `/analyses/${analysisId}/status`,
    { timeout: POLL_TIMEOUT_MS, ...(signal ? { signal } : {}) },
  );
  return response.data.data;
};

/** `API-021`. Reproduces the stored analysis; never re-runs reasoning. */
export const fetchAnalysis = async (
  analysisId: string,
  signal?: AbortSignal,
): Promise<Analysis> => {
  const response = await api.get<SuccessEnvelope<Analysis>>(
    `/analyses/${analysisId}`,
    signal ? { signal } : {},
  );
  return response.data.data;
};
