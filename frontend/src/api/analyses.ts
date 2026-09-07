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
  Refusal,
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

/**
 * An error envelope out of a response body, whatever shape axios handed back.
 *
 * A binary request (`responseType: "arraybuffer"`, used by the PDF export)
 * gets its *error* bodies as bytes too, and reading `.error` off an
 * `ArrayBuffer` yields nothing. Without this decode, a `service_unavailable`
 * naming the corrective step would surface as "the server responded with 503
 * and no explanation" — discarding exactly the message `FR-090` requires the
 * API to write.
 */
const readErrorEnvelope = (data: unknown): ErrorEnvelope | undefined => {
  if (data instanceof ArrayBuffer) {
    try {
      return JSON.parse(new TextDecoder().decode(data)) as ErrorEnvelope;
    } catch {
      return undefined;
    }
  }
  return data as ErrorEnvelope | undefined;
};

export const toApiFailure = (error: unknown): ApiFailure => {
  if (axios.isAxiosError(error)) {
    const body = readErrorEnvelope(error.response?.data);
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

/**
 * A classification correction (`FR-014`, `API §7.5`).
 *
 * Sent on an ordinary `POST /analyses`, because `API §7.5` makes a correction
 * a submission rather than an edit: "a new analysis is created with the type
 * fixed" and "the original analysis remains retrievable". There is no update
 * endpoint to call, deliberately — `DB DP-3` makes analyses immutable.
 */
export interface Correction {
  readonly classificationOverride: string;
  /** The analysis being corrected, recorded as lineage. */
  readonly supersedesAnalysisId?: string;
}

/** `API-020`. Returns `202` before reasoning completes. */
export const createAnalysis = async (
  content: string,
  signal?: AbortSignal,
  correction?: Correction,
): Promise<CreatedAnalysis> => {
  const response = await api.post<SuccessEnvelope<CreatedAnalysis>>(
    "/analyses",
    {
      content,
      source_type: "paste",
      ...(correction !== undefined
        ? {
            classification_override: correction.classificationOverride,
            ...(correction.supersedesAnalysisId !== undefined
              ? { supersedes_analysis_id: correction.supersedesAnalysisId }
              : {}),
          }
        : {}),
    },
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

/**
 * A refusal out of a 422 error envelope (`API §9.3`).
 *
 * The two refusal codes are **not failures** — the request was well-formed and
 * processed correctly, and the content could not be analysed. So they are
 * lifted out of the error path into a value the UI renders deliberately,
 * rather than being shown as "something went wrong".
 *
 * Returns `null` for any other error, which stays a failure.
 */
export const toRefusal = (error: unknown): Refusal | null => {
  if (!axios.isAxiosError(error)) return null;
  const body = readErrorEnvelope(error.response?.data);
  if (body?.error === undefined) return null;

  const code = body.error.code;
  if (code !== "unsupported_input_type" && code !== "insufficient_context") {
    return null;
  }

  const details = (body.error.details ?? {}) as {
    unknowns?: readonly { missing?: unknown; would_resolve?: unknown }[];
    supported_types?: readonly unknown[];
  };

  return {
    code,
    message: body.error.message,
    action: body.error.action ?? null,
    // Narrowed rather than cast: this is the part the user acts on, and a
    // malformed entry should be dropped rather than rendered as "undefined".
    unknowns: (details.unknowns ?? []).flatMap((entry) =>
      typeof entry?.missing === "string"
        ? [
            {
              missing: entry.missing,
              would_resolve:
                typeof entry.would_resolve === "string"
                  ? entry.would_resolve
                  : null,
            },
          ]
        : [],
    ),
    supportedTypes: (details.supported_types ?? []).filter(
      (type): type is string => typeof type === "string",
    ),
  };
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

/**
 * `API-040`. The analysis as a Markdown document.
 *
 * ⚠️ THE RESPONSE IS THE DOCUMENT, NOT AN ENVELOPE. `docs/17` D-42: no
 * `export_id`, `download_url` or `expires_at` is returned, because under
 * `docs/16` D-41 no `EXPORT` row is written for an anonymous export and those
 * fields would identify nothing. So this call unwraps nothing — the body is
 * the file.
 *
 * `artifactTypes` is `FR-052`'s selection, and it is also what `FR-053`
 * copy-to-clipboard uses: copying one artifact is a partial export of that
 * artifact. One serialiser, on the server, so the copied text and the
 * downloaded file cannot drift.
 */
export const exportAnalysisMarkdown = async (
  analysisId: string,
  artifactTypes?: readonly string[],
  signal?: AbortSignal,
): Promise<string> => {
  const response = await api.post<string>(
    `/analyses/${analysisId}/exports`,
    {
      format: "markdown",
      ...(artifactTypes !== undefined ? { artifact_types: artifactTypes } : {}),
    },
    {
      // Without this axios parses a JSON-looking body; the document is text.
      responseType: "text",
      transformResponse: [(data: string) => data],
      ...(signal ? { signal } : {}),
    },
  );
  return response.data;
};

/**
 * `API-040` with `format: "pdf"`. The same document, typeset.
 *
 * ⚠️ NOT A SECOND DOCUMENT. The server renders the PDF from the Markdown this
 * module already fetches, so there is no client-side content model here either
 * — this call differs from `exportAnalysisMarkdown` by one field.
 *
 * Returns a `Blob` because the body is binary. `arraybuffer` rather than the
 * default: axios would otherwise coerce the bytes through a string and corrupt
 * the file.
 *
 * PDF can be **unavailable** — it needs a browser on the server (`SA AQ-3`),
 * and where none is installed the API refuses with `service_unavailable` and
 * names Markdown. The caller surfaces that message rather than retrying.
 */
export const exportAnalysisPdf = async (
  analysisId: string,
  artifactTypes?: readonly string[],
  signal?: AbortSignal,
): Promise<Blob> => {
  const response = await api.post<ArrayBuffer>(
    `/analyses/${analysisId}/exports`,
    {
      format: "pdf",
      ...(artifactTypes !== undefined ? { artifact_types: artifactTypes } : {}),
    },
    {
      responseType: "arraybuffer",
      ...(signal ? { signal } : {}),
    },
  );
  return new Blob([response.data], { type: "application/pdf" });
};
