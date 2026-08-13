/**
 * Environment configuration.
 *
 * Parsed and validated exactly once, at startup, by the composition root.
 * Invalid configuration fails fast with a message naming every problem at
 * once, rather than surfacing as an obscure runtime failure later.
 *
 * No other module reads `process.env`.
 */

const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGIN = "http://localhost:5173";
const DEFAULT_LOG_LEVEL: LogLevel = "info";

const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
  readonly databaseUrl: string;
  /**
   * Connection string for the trace store.
   *
   * A separate database, not a schema inside the primary one (`DB §1.4`,
   * `docs/12` D-2). Kept as a distinct variable so the two stores can be given
   * distinct credentials — §8.4 restricts trace reads to operators, and a
   * shared connection string would make that a policy claim rather than an
   * enforceable boundary.
   */
  readonly traceDatabaseUrl: string;
  readonly port: number;
  readonly corsOrigin: string;
  readonly logLevel: LogLevel;
  /**
   * Real-provider settings. All optional: the product runs, and the whole test
   * suite passes, with none of them set — the stub and replay adapters need no
   * credential (`docs/12` D-11).
   *
   * ⚠️ `apiKey` is Credential class (`DB §13.2`): never logged, never exported,
   * never in a trace or an error message. Nothing in this codebase logs
   * `AppConfig`, and nothing should start.
   */
  readonly provider: {
    readonly apiKey?: string;
    readonly model?: string;
    /** USD per million tokens, as decimal strings (`docs/12` D-4, D-10). */
    readonly inputUsdPerMillionTokens?: string;
    readonly outputUsdPerMillionTokens?: string;
  };
}

const isLogLevel = (value: string): value is LogLevel =>
  (LOG_LEVELS as readonly string[]).includes(value);

/**
 * Reads and validates configuration from the given environment.
 *
 * @throws Error listing every invalid or missing variable.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = [];

  const rawDatabaseUrl = env["DATABASE_URL"]?.trim();
  if (rawDatabaseUrl === undefined || rawDatabaseUrl === "") {
    problems.push(
      "DATABASE_URL is required (example: postgresql://naigx:password@localhost:5432/naigx)",
    );
  }

  const rawTraceDatabaseUrl = env["TRACE_DATABASE_URL"]?.trim();
  if (rawTraceDatabaseUrl === undefined || rawTraceDatabaseUrl === "") {
    problems.push(
      "TRACE_DATABASE_URL is required (example: postgresql://naigx:password@localhost:5432/naigx_trace)",
    );
  } else if (rawTraceDatabaseUrl === rawDatabaseUrl) {
    // `DB §1.4` — the trace store is a separate database. Pointing both at one
    // database would silently collapse the retention, access-control, and
    // blast-radius separation the design depends on, and nothing downstream
    // would report the loss.
    problems.push(
      "TRACE_DATABASE_URL must not equal DATABASE_URL — the trace store is a separate database (DB §1.4)",
    );
  }

  let port = DEFAULT_PORT;
  const rawPort = env["PORT"]?.trim();
  if (rawPort !== undefined && rawPort !== "") {
    const parsed = Number(rawPort);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      problems.push(
        `PORT must be an integer between 1 and 65535 (received "${rawPort}")`,
      );
    } else {
      port = parsed;
    }
  }

  const rawCorsOrigin = env["CORS_ORIGIN"]?.trim();
  const corsOrigin =
    rawCorsOrigin === undefined || rawCorsOrigin === ""
      ? DEFAULT_CORS_ORIGIN
      : rawCorsOrigin;

  let logLevel = DEFAULT_LOG_LEVEL;
  const rawLogLevel = env["LOG_LEVEL"]?.trim();
  if (rawLogLevel !== undefined && rawLogLevel !== "") {
    if (!isLogLevel(rawLogLevel)) {
      problems.push(
        `LOG_LEVEL must be one of ${LOG_LEVELS.join(", ")} (received "${rawLogLevel}")`,
      );
    } else {
      logLevel = rawLogLevel;
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${problems
        .map((problem) => `  - ${problem}`)
        .join("\n")}`,
    );
  }

  const optional = (name: string): string | undefined => {
    const value = env[name]?.trim();
    return value === undefined || value === "" ? undefined : value;
  };

  return {
    provider: {
      // Read here and nowhere else — adapters receive values, never the
      // environment.
      ...(optional("ANTHROPIC_API_KEY") !== undefined
        ? { apiKey: optional("ANTHROPIC_API_KEY") as string }
        : {}),
      ...(optional("PROVIDER_MODEL") !== undefined
        ? { model: optional("PROVIDER_MODEL") as string }
        : {}),
      ...(optional("PROVIDER_INPUT_USD_PER_MTOK") !== undefined
        ? {
            inputUsdPerMillionTokens: optional(
              "PROVIDER_INPUT_USD_PER_MTOK",
            ) as string,
          }
        : {}),
      ...(optional("PROVIDER_OUTPUT_USD_PER_MTOK") !== undefined
        ? {
            outputUsdPerMillionTokens: optional(
              "PROVIDER_OUTPUT_USD_PER_MTOK",
            ) as string,
          }
        : {}),
    },
    databaseUrl: rawDatabaseUrl as string,
    traceDatabaseUrl: rawTraceDatabaseUrl as string,
    port,
    corsOrigin,
    logLevel,
  };
}
