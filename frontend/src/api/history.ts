/**
 * History calls (`API-022`–`API-024`).
 *
 * ⚠️ A SUMMARY IS NOT AN ANALYSIS. `API-022` returns "summaries only — never
 * full artifact content", and the type below says so: there is no field an
 * artifact could occupy. Opening an entry fetches it through `API-021`, which
 * is where the full record lives. A listing that carried content would read a
 * user's most sensitive data on every page of history they browse.
 */

import { api } from "./client";
import { authed } from "./auth";
import type { SuccessEnvelope } from "./types";

export interface HistoryEntry {
  readonly analysis_id: string;
  readonly derived_title: string | null;
  readonly classification: string | null;
  readonly created_at: string;
  readonly status: string;
  readonly confidence_band: string | null;
  /** `API §9.3` — a declined analysis is listed and marked, never hidden. */
  readonly refused: boolean;
}

export interface HistoryPage {
  readonly items: readonly HistoryEntry[];
  readonly pagination: {
    readonly next_cursor: string | null;
    readonly limit: number;
  };
  /**
   * `API-022` — "empty state distinguishable from filtered-empty".
   *
   * Without this a user with no history and a user whose filter matched
   * nothing see the same blank page and cannot tell which they are.
   */
  readonly filtered: boolean;
}

export interface HistoryQuery {
  readonly cursor?: string | null;
  readonly classification?: string | null;
  readonly q?: string | null;
  readonly limit?: number;
}

export const fetchHistory = async (
  query: HistoryQuery = {},
): Promise<HistoryPage> => {
  const params = new URLSearchParams();
  if (query.cursor != null) params.set("cursor", query.cursor);
  if (query.classification != null)
    params.set("classification", query.classification);
  if (query.q != null && query.q.trim() !== "") params.set("q", query.q.trim());
  if (query.limit !== undefined) params.set("limit", String(query.limit));

  const suffix = params.toString();
  const response = await authed((config) =>
    api.get<SuccessEnvelope<HistoryPage>>(
      `/analyses${suffix === "" ? "" : `?${suffix}`}`,
      config,
    ),
  );
  return response.data.data;
};

export interface DeletionReceipt {
  readonly trace_purge_window: string;
  readonly deleted_count?: number;
}

/**
 * `API-023` — permanent, confirmed, and `202` with a stated window.
 *
 * The confirmation is sent by the caller having shown the user what it means;
 * this function does not ask. A client that could delete without the server
 * seeing a confirmation would make `FR-063`'s requirement unenforceable.
 */
export const deleteAnalysis = async (
  analysisId: string,
): Promise<DeletionReceipt> => {
  const response = await authed((config) =>
    api.delete<SuccessEnvelope<DeletionReceipt>>(`/analyses/${analysisId}`, {
      ...config,
      data: { confirmation: true },
    }),
  );
  return response.data.data;
};

/** `API-024` — deletes only the caller's analyses. */
export const deleteAllAnalyses = async (): Promise<DeletionReceipt> => {
  const response = await authed((config) =>
    api.delete<SuccessEnvelope<DeletionReceipt>>("/analyses", {
      ...config,
      data: { confirmation: true },
    }),
  );
  return response.data.data;
};
