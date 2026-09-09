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

/**
 * Every interface, which is what a container needs.
 *
 * ⚠️ THIS IS NOT THE SAME QUESTION AS "IS THE PORT EXPOSED". Inside a
 * container, `0.0.0.0` means every interface *of that container's network
 * namespace* — the app is reachable from Caddy on the compose network and from
 * nowhere else, because the production compose publishes no port for it.
 * Binding `127.0.0.1` inside a container would instead make it unreachable
 * from the proxy, which is why loopback is the override rather than the
 * default: it is the correct value for a bare-process deployment sharing a
 * host with its proxy, and the wrong one for the containerised topology D-50
 * sanctions.
 */
const DEFAULT_HOST = "0.0.0.0";

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
  /** The interface to bind. See `DEFAULT_HOST` — the default is deliberate. */
  readonly host: string;
  readonly port: number;
  /**
   * Whether `X-Forwarded-*` may be believed (`SA §9.1` puts a TLS-terminating
   * proxy in front of the application tier).
   *
   * ⚠️ THIS DECIDES WHAT `request.ip` MEANS, AND IT IS WRONG IN BOTH
   * DIRECTIONS BY DEFAULT.
   *
   * `false` behind a proxy collapses every client to the proxy's own address:
   * the per-IP authentication limit (`authAttemptIp`) becomes one global
   * bucket that any single client can exhaust for everyone, and every session
   * row records the proxy's address as the user's (`DB §8`).
   *
   * `true` when *not* behind a proxy is worse: `X-Forwarded-For` is then a
   * client-supplied header, so an attacker rotates it per request and the
   * per-IP limit stops existing at all.
   *
   * There is no value that is safe in ignorance, so this is configuration with
   * no inferred default — it is `false` because that is the safe answer for a
   * directly exposed process, and the production compose that puts Caddy in
   * front sets it to `true` in the same file that creates the proxy.
   */
  readonly trustProxy: boolean;
  /**
   * Salt for the stored session and audit IP hash (`DB §4.1` — "raw IP is
   * never persisted"; `DB §13` classifies `ip_hash` **Pseudonymous**).
   *
   * ⚠️ AN UNSALTED-IN-PRACTICE HASH IS NOT PSEUDONYMOUS. IPv4 is 2^32 values;
   * with a salt anybody can read out of the repository, the whole space is
   * enumerable in seconds and `ip_hash` reverses to the address it was meant
   * to stand in for. The dev default exists so a test and a local run need no
   * configuration — so this is **required when `NODE_ENV=production`**, which
   * is the one place the default would silently become the deployed value.
   *
   * Absent outside production means "use the development default".
   */
  readonly ipHashSecret?: string;
  /**
   * `NAIGX_ANALYSIS_TIMEOUT_MS` — the `FR-094` executor deadline. Omitted
   * means `DEFAULT_ANALYSIS_TIMEOUT_MS` (180 s), unchanged. Made
   * configurable on 2026-09-09 (D-65) because Sonnet 5's stage latencies
   * put the job-description path past 180 s before Stage 9 could finish.
   */
  readonly analysisTimeoutMs?: number;
  /**
   * Path to the host-held root key file
   * ([D-61](../../../docs/36-D-61-Host-Held-Key-File.md)).
   *
   * ⚠️ REQUIRED IN PRODUCTION. It wraps the data key that seals `raw_content`,
   * `structured_input` and `structured_output`, so an instance without it can
   * neither read its own history nor store new content readably.
   *
   * ⚠️ This is a **path, never key material.** The file's contents are read by
   * the key-file provider and never enter configuration, logs or diagnostics.
   *
   * D-61 replaced the managed key service D-52 had chosen. `DB §13.1`'s
   * "managed key service" row is therefore an **explicit v1.0 deviation**,
   * recorded as one rather than reinterpreted as satisfied.
   *
   * Absent outside production selects the offline test double, which refuses
   * to construct under `NODE_ENV=production`.
   */
  readonly keyFile?: string;
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
  /**
   * The operator credential for `/internal/*` ([D-48](../../../docs/23-D-48-Operator-Authentication.md)).
   *
   * ⚠️ Credential class (`DB §13.2`): never logged, never echoed, never
   * returned — including in an error. Absent means the internal surface is
   * **disabled**, not open: a development default that let these endpoints
   * answer without a credential would be the one that reached production.
   */
  readonly operatorToken?: string;
  readonly provider: {
    readonly apiKey?: string;
    readonly model?: string;
    /** USD per million tokens, as decimal strings (`docs/12` D-4, D-10). */
    readonly inputUsdPerMillionTokens?: string;
    readonly outputUsdPerMillionTokens?: string;
    /**
     * `output_config.effort` for adaptive-thinking models (D-65). Omitted
     * means the provider's default, which is `high` — the depth whose latency
     * the 2026-09-08 pilot recorded. Validated against the documented levels.
     */
    readonly effort?: "low" | "medium" | "high" | "xhigh" | "max";
  };
}

const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;

/**
 * `PROVIDER_EFFORT` — refused rather than passed through. A misspelt level
 * would reach the provider as a 400 on every call, which is a slower way of
 * failing to start.
 */
const parseEffort = (value: string): (typeof EFFORT_LEVELS)[number] => {
  const level = value.trim();
  if (!(EFFORT_LEVELS as readonly string[]).includes(level)) {
    throw new Error(
      `PROVIDER_EFFORT must be one of ${EFFORT_LEVELS.join(", ")} (received ${JSON.stringify(value)})`,
    );
  }
  return level as (typeof EFFORT_LEVELS)[number];
};

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

  let host = DEFAULT_HOST;
  const rawHost = env["HOST"]?.trim();
  if (rawHost === "") {
    // A set-but-empty `HOST` is usually a compose substitution that did not
    // resolve. Quietly falling back to every interface would *widen* the bind
    // in response to a broken configuration, so it is refused instead.
    problems.push(
      `HOST must not be blank — leave it unset to accept the default (${DEFAULT_HOST})`,
    );
  } else if (rawHost !== undefined) {
    host = rawHost;
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

  // Strict, and deliberately not "any non-empty string is true". `TRUST_PROXY`
  // decides whether a client-supplied header can set its own rate-limit
  // identity, and the classic loose parse turns the typo `TRUST_PROXY=flase`
  // into `true` — silently, in the direction that removes the limit.
  let trustProxy = false;
  const rawTrustProxy = env["TRUST_PROXY"]?.trim().toLowerCase();
  if (rawTrustProxy !== undefined && rawTrustProxy !== "") {
    if (rawTrustProxy === "true" || rawTrustProxy === "1") {
      trustProxy = true;
    } else if (rawTrustProxy !== "false" && rawTrustProxy !== "0") {
      problems.push(
        `TRUST_PROXY must be true, false, 1 or 0 (received "${rawTrustProxy}")`,
      );
    }
  }

  // `DB §4.1` / `DB §13`. Enforced only in production, because that is the
  // only environment where falling back to the in-repository default would be
  // a defect rather than a convenience.
  const isProduction = env["NODE_ENV"]?.trim() === "production";
  // `FR-094` deadline override (D-65). A positive integer of milliseconds, or
  // absent; anything else is a configuration error rather than a silent
  // fallback to the default.
  const rawTimeout = env["NAIGX_ANALYSIS_TIMEOUT_MS"]?.trim();
  let analysisTimeoutMs: number | undefined;
  if (rawTimeout !== undefined && rawTimeout !== "") {
    const parsed = Number(rawTimeout);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      problems.push(
        `NAIGX_ANALYSIS_TIMEOUT_MS must be a positive integer of milliseconds (received ${JSON.stringify(rawTimeout)})`,
      );
    } else {
      analysisTimeoutMs = parsed;
    }
  }

  const ipHashSecret = env["NAIGX_IP_HASH_SECRET"]?.trim();
  if (isProduction && (ipHashSecret === undefined || ipHashSecret === "")) {
    problems.push(
      "NAIGX_IP_HASH_SECRET is required when NODE_ENV=production — the " +
        "development default is a constant in this repository, and an IP hash " +
        "salted with a public constant is reversible by enumeration (DB §4.1)",
    );
  }

  // `DB §13.1` / D-61. The path is validated for presence here; the file's
  // existence, permissions and length are checked by the provider on every
  // load, because a file can be replaced or chmod'd after startup and a
  // config-time check would not notice.
  const rawKeyFile = env["NAIGX_KEY_FILE"]?.trim();
  const keyFile =
    rawKeyFile !== undefined && rawKeyFile !== "" ? rawKeyFile : undefined;

  if (isProduction && keyFile === undefined) {
    problems.push(
      "NAIGX_KEY_FILE is required when NODE_ENV=production — DB §13.1 requires " +
        "application-level encryption for raw_content, structured_input and " +
        "structured_output. Point it at a file containing 32 random bytes " +
        "(openssl rand -base64 32), readable only by the account this process " +
        "runs as. There is deliberately no in-process fallback.",
    );
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
    // D-48. Read here and nowhere else; the value reaches `resolveOperator`
    // and no other function.
    ...(optional("NAIGX_OPERATOR_TOKEN") !== undefined
      ? { operatorToken: optional("NAIGX_OPERATOR_TOKEN") as string }
      : {}),
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
      ...(optional("PROVIDER_EFFORT") !== undefined
        ? { effort: parseEffort(optional("PROVIDER_EFFORT") as string) }
        : {}),
    },
    databaseUrl: rawDatabaseUrl as string,
    traceDatabaseUrl: rawTraceDatabaseUrl as string,
    host,
    port,
    trustProxy,
    ...(keyFile !== undefined ? { keyFile } : {}),
    ...(analysisTimeoutMs !== undefined ? { analysisTimeoutMs } : {}),
    ...(ipHashSecret !== undefined && ipHashSecret !== ""
      ? { ipHashSecret }
      : {}),
    corsOrigin,
    logLevel,
  };
}
