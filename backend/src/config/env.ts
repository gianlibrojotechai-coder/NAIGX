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
  readonly port: number;
  readonly corsOrigin: string;
  readonly logLevel: LogLevel;
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

  return {
    databaseUrl: rawDatabaseUrl as string,
    port,
    corsOrigin,
    logLevel,
  };
}
