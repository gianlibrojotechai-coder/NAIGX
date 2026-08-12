/**
 * Application error foundation (`API §9.1`–`§9.3`, `SA §11`).
 *
 * The error codes below are the complete taxonomy from `API §9.2`, reproduced
 * rather than invented. The taxonomy is closed: an error that does not map to
 * one of these codes is a programming error, and is reported to the client as
 * `internal_error` rather than being given an improvised code.
 *
 * Two disciplines are enforced here:
 *
 *   - `message` and `action` are client-facing text. They must never carry a
 *     stack trace, framework detail, internal identifier, or provider name
 *     (`API §9.5`, `SA §11.2`, `FR-090`, `AI-006`).
 *   - `action` is required wherever an action exists (`FR-090`). "Invalid
 *     input" with no corrective step is explicitly unacceptable (`FR-005`).
 *
 * Diagnostic detail belongs on `cause`, which is logged server-side and never
 * serialised to a client.
 */

/**
 * Error code to HTTP status, exactly as tabulated in `API §9.2`.
 *
 * Note that `unsupported_input_type` and `insufficient_context` are 422 by
 * design (`API §9.3`): the request was well-formed and processed correctly,
 * and the refusal is a product behaviour rather than a failure.
 */
export const ERROR_STATUS = {
  // Validation — 400
  validation_failed: 400,
  content_too_short: 400,
  content_too_long: 400,
  unsupported_file_type: 400,
  file_too_large: 400,
  // Authentication — 401
  unauthenticated: 401,
  invalid_credentials: 401,
  invalid_token: 401,
  token_expired: 401,
  token_reused: 401,
  // Authorization — 403
  forbidden: 403,
  anonymous_limit_reached: 403,
  operator_only: 403,
  // Not found — 404
  not_found: 404,
  // Conflict — 409
  email_in_use: 409,
  invalid_state: 409,
  // Gone — 410
  expired: 410,
  // Unsupported input — 422
  unsupported_input_type: 422,
  insufficient_context: 422,
  // Rate limit — 429
  rate_limited: 429,
  // Server — 500
  internal_error: 500,
  // Unavailable — 503
  service_unavailable: 503,
  // Timeout — 504
  analysis_timeout: 504,
} as const satisfies Record<string, number>;

export type ApiErrorCode = keyof typeof ERROR_STATUS;

export interface AppErrorOptions {
  /** Corrective step for the user. Required wherever one exists (`FR-090`). */
  readonly action?: string;
  /** Offending field. Validation errors only (`API §9.1`). */
  readonly field?: string;
  /** Structured context — limits, actual values. Never internal detail. */
  readonly details?: Readonly<Record<string, unknown>>;
  /** Underlying error. Logged server-side; never sent to a client. */
  readonly cause?: unknown;
}

/**
 * An error that is safe to render to a client, because every field on it was
 * written to be seen.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly action: string | undefined;
  readonly field: string | undefined;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );

    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.action = options.action;
    this.field = options.field;
    this.details = options.details;
  }
}

export const isAppError = (value: unknown): value is AppError =>
  value instanceof AppError;

/**
 * The two errors the framework itself must be able to raise.
 *
 * Deliberately not a factory per code — the remaining codes belong to the
 * features that will raise them, and inventing constructors for them now would
 * be guessing at their messages and corrective actions.
 */

export const notFoundError = (): AppError =>
  new AppError("not_found", "The requested resource does not exist.", {
    action: "Check the request URL and try again.",
  });

/**
 * The catch-all for anything unrecognised. The message is fixed and generic on
 * purpose: the original error is logged, never described to the client.
 * The action names the correlation ID because that is the identifier a user
 * can quote when reporting an incident (`API §9.5`).
 */
export const internalError = (cause: unknown): AppError =>
  new AppError("internal_error", "Something went wrong on our side.", {
    action:
      "Try again in a few moments. If the problem persists, quote the correlation ID from this response.",
    cause,
  });
