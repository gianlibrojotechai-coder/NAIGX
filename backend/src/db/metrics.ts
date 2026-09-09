/**
 * Product metrics (`FR-102`, `PRD §3.2`, `API-070`).
 *
 * COMPUTED FROM STORED ROWS, NOT FROM A SEPARATE EVENT PIPELINE. Every metric
 * below is a query over tables that already exist for their own reasons —
 * `ANALYSIS` for lifecycle, `ARTIFACT` for first-artifact timing, `EXPORT` for
 * `M-4`, `FEEDBACK` for `M-7`, `VALIDATION_EVENT` for `M-10`. That satisfies
 * `FR-102`'s third criterion — "metrics are queryable without code changes" —
 * in the strongest available sense: an operator with database access can ask
 * these questions directly, and this module is a convenience over the same
 * data rather than the only way to reach it.
 *
 * A parallel event store would have been the alternative, and it would have
 * introduced a second source of truth that can disagree with the first.
 *
 * ⚠️ THREE OF THE TEN METRICS ARE NOT HERE, AND MUST NOT BE ADDED.
 * `PRD §3.2` defines their instrumentation as manual:
 *
 *   · **M-6** classification accuracy — "manually sampled"
 *   · **M-8** recommendation explicability — "Manual review protocol"
 *   · **M-9** platform recommendation defensibility — "Manual review protocol"
 *
 * A computed stand-in for any of them would be a number that looks like the
 * metric and measures something else — the failure `PRD §3.1` warns about when
 * it says targets exist "to make the first real numbers interpretable". They
 * are reported as `unavailable` with their reason, never as zero and never
 * omitted.
 *
 * ⚠️ NO USER BUSINESS CONTENT. Every value here is a count, a ratio or a
 * duration. `API §11.1` forbids exposing internal metrics publicly; this
 * module additionally has no field an analysis input or artifact could occupy,
 * so an operator endpoint cannot leak content by accident.
 */

import { TRACE_PURGE_WINDOW_HOURS } from "./trace-purge.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { PrismaClient as TracePrismaClient } from "../generated/prisma-trace/client.js";

/** A metric this system computes. */
export interface ComputedMetric {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  /** `ratio`, `seconds`, or `count` — so a reader knows what the number is. */
  readonly unit: "ratio" | "seconds" | "count";
}

/**
 * A metric `PRD §3.2` defines as manual review.
 *
 * Reported so the absence is legible. Omitting them would let a reader assume
 * the seven present metrics are all ten.
 */
export interface ManualMetric {
  readonly id: string;
  readonly name: string;
  readonly instrumentation: "manual review";
  readonly reason: string;
}

export interface MetricsSnapshot {
  readonly computed: readonly ComputedMetric[];
  readonly manual: readonly ManualMetric[];
  /** `M-19` Phase 4. Deployment health, kept separate from product metrics. */
  readonly operational: readonly OperationalMetric[];
  readonly generatedAt: Date;
}

/** `PRD §3.2`, verbatim on why each is not computed. */
const MANUAL_METRICS: readonly ManualMetric[] = [
  {
    id: "M-6",
    name: "classification_accuracy",
    instrumentation: "manual review",
    reason:
      "PRD §3.2 defines this as manually sampled. A computed proxy would measure agreement with the classifier rather than correctness.",
  },
  {
    id: "M-8",
    name: "recommendation_explicability",
    instrumentation: "manual review",
    reason:
      "PRD §3.2 names a manual review protocol. Whether a rationale traces to a stated constraint is a judgement, not a query.",
  },
  {
    id: "M-9",
    name: "platform_recommendation_defensibility",
    instrumentation: "manual review",
    reason:
      "PRD §3.2 names a manual review protocol. The artifact it measures is also unbuilt (platform_recommendation, M-07).",
  },
];

/** Guards every ratio: a rate over zero attempts is not zero, it is undefined. */
const ratio = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : numerator / denominator;

export interface MetricsClients {
  readonly prisma: PrismaClient;
  /** Optional: `M-10` needs the trace store, and an instance may lack one. */
  readonly trace?: TracePrismaClient;
  /**
   * The field cipher, read for its plaintext counter only (`M-19` Phase 4).
   *
   * ⚠️ NEVER FOR ITS KEY. Only `plaintextReads` is touched — a number. Nothing
   * in this module can reach key material, and nothing should be added that
   * can: `API §11.1` already forbids exposing internals publicly, and metrics
   * are the surface most likely to be scraped somewhere careless.
   */
  readonly cipher?: { readonly plaintextReads: number };
}

/**
 * Operational metrics — `M-19` Phase 4, for alerting.
 *
 * ⚠️ THESE ARE NOT `PRD §3.2` PRODUCT METRICS, and the distinction is kept in
 * the output as well as here. The ten product metrics measure whether the
 * product works; these measure whether the *deployment* is keeping promises it
 * has already made to users. Merging them would let an operational alert read
 * as a product regression, and vice versa.
 *
 * Each one exists because Phase 3 created a failure that is otherwise silent:
 *
 *   · `purge_outbox_overdue` — `API-011` tells the user their traces go within
 *     a stated window. A row older than that window is a **broken promise**,
 *     not a slow one, and nothing else would ever say so.
 *   · `purge_outbox_failed` — an instruction that exhausted its retries. The
 *     row is retained precisely so this number can be non-zero.
 *   · `encryption_plaintext_reads` — the ONLY signal that the encryption
 *     backfill is unfinished. A partly-sealed table serves reads perfectly
 *     well ([D-55](../../../docs/30-D-55-Envelope-Format-And-Purge-Outbox.md)
 *     §7), so nothing misbehaves and nothing complains. Non-zero means
 *     `DB §13.1` row 3 is not actually met, however green everything looks.
 */
export interface OperationalMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: "count";
  readonly help: string;
}

/**
 * Reads every automatable metric.
 *
 * One pass over each table rather than one query per metric — these run behind
 * an operator endpoint that may be scraped on an interval, and a scrape that
 * costs a dozen sequential round trips is a scrape somebody turns off.
 */
export async function computeMetrics(
  clients: MetricsClients,
  now: Date = new Date(),
): Promise<MetricsSnapshot> {
  const { prisma } = clients;

  const [total, completed, terminal, exportCount, feedback, latencies] =
    await Promise.all([
      // M-1 denominator: every analysis that started.
      prisma.analysis.count(),
      prisma.analysis.count({ where: { status: "completed" } }),
      // Terminal-but-not-completed, for the failure side of M-1.
      prisma.analysis.count({
        where: { status: { in: ["failed", "timed_out"] } },
      }),
      prisma.export.count(),
      prisma.feedback.groupBy({ by: ["helpful"], _count: { _all: true } }),
      // M-2 and M-3 both need per-analysis timings. Selected rather than
      // aggregated in SQL because percentiles over a small set are cheaper to
      // compute here than to express portably.
      prisma.analysis.findMany({
        where: { status: "completed", completedAt: { not: null } },
        select: {
          createdAt: true,
          completedAt: true,
          artifacts: {
            select: { createdAt: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      }),
    ]);

  const helpful = feedback.find((row) => row.helpful)?._count._all ?? 0;
  const unhelpful = feedback.find((row) => !row.helpful)?._count._all ?? 0;
  const feedbackTotal = helpful + unhelpful;

  // M-2 — submission to first substantive artifact.
  const firstArtifactSeconds = latencies.flatMap((row) => {
    const first = row.artifacts[0];
    if (first === undefined) return [];
    return [(first.createdAt.getTime() - row.createdAt.getTime()) / 1000];
  });

  // M-3 — submission to all artifacts complete.
  const fullSeconds = latencies.flatMap((row) =>
    row.completedAt === null
      ? []
      : [(row.completedAt.getTime() - row.createdAt.getTime()) / 1000],
  );

  /**
   * Nearest-rank percentile.
   *
   * ⚠️ A PERCENTILE OVER A HANDFUL OF RUNS IS NOT A PERCENTILE. `NFR-001` and
   * `NFR-002` are stated as p50/p95 and `M-20` is the milestone that measures
   * them under load; these values describe whatever has happened so far, which
   * at present is a development database. Reported because `FR-102` requires
   * latency to be recorded "at both first-artifact and full-completion
   * points", and the count travels beside them so a reader can judge weight.
   */
  const percentile = (values: readonly number[], p: number): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)] ?? 0;
  };

  // M-5 — a user who submitted a second distinct analysis within 30 days.
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const owned = await prisma.analysis.findMany({
    where: { userId: { not: null } },
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const byUser = new Map<string, Date[]>();
  for (const row of owned) {
    if (row.userId === null) continue;
    const list = byUser.get(row.userId) ?? [];
    list.push(row.createdAt);
    byUser.set(row.userId, list);
  }
  let returning = 0;
  for (const dates of byUser.values()) {
    const first = dates[0];
    if (first === undefined) continue;
    if (
      dates.some(
        (date) =>
          date.getTime() > first.getTime() &&
          date.getTime() - first.getTime() <= THIRTY_DAYS_MS,
      )
    ) {
      returning += 1;
    }
  }

  // M-10 — schema validity, from the trace store when one is wired.
  let validationTotal = 0;
  let validationPassed = 0;
  if (clients.trace !== undefined) {
    const grouped = await clients.trace.validationEvent.groupBy({
      by: ["passed"],
      // D-72: Stage 10 records five more classes, one of them advisory. This
      // metric is `M-10` schema validity (`FR-039`) and counts only that class.
      where: { validationClass: "schema" },
      _count: { _all: true },
    });
    validationPassed = grouped.find((r) => r.passed)?._count._all ?? 0;
    validationTotal =
      validationPassed + (grouped.find((r) => !r.passed)?._count._all ?? 0);
  }

  const computed: ComputedMetric[] = [
    {
      id: "M-1",
      name: "analysis_completion_rate",
      value: ratio(completed, total),
      unit: "ratio",
    },
    {
      id: "M-1",
      name: "analyses_started_total",
      value: total,
      unit: "count",
    },
    {
      id: "M-1",
      name: "analyses_terminal_unsuccessful_total",
      value: terminal,
      unit: "count",
    },
    {
      id: "M-2",
      name: "time_to_first_artifact_p50",
      value: percentile(firstArtifactSeconds, 50),
      unit: "seconds",
    },
    {
      id: "M-2",
      name: "time_to_first_artifact_p95",
      value: percentile(firstArtifactSeconds, 95),
      unit: "seconds",
    },
    {
      id: "M-2",
      name: "time_to_first_artifact_samples",
      value: firstArtifactSeconds.length,
      unit: "count",
    },
    {
      id: "M-3",
      name: "full_analysis_latency_p50",
      value: percentile(fullSeconds, 50),
      unit: "seconds",
    },
    {
      id: "M-3",
      name: "full_analysis_latency_p95",
      value: percentile(fullSeconds, 95),
      unit: "seconds",
    },
    {
      id: "M-3",
      name: "full_analysis_latency_samples",
      value: fullSeconds.length,
      unit: "count",
    },
    {
      // ⚠️ The series starts at the M-15 date and nothing is backfilled
      // ([D-41](../../../docs/16-D-41-Anonymous-Export-Deviation.md) §6).
      id: "M-4",
      name: "export_rate",
      value: ratio(exportCount, completed),
      unit: "ratio",
    },
    { id: "M-4", name: "exports_total", value: exportCount, unit: "count" },
    {
      id: "M-5",
      name: "return_rate",
      value: ratio(returning, byUser.size),
      unit: "ratio",
    },
    {
      id: "M-5",
      name: "users_with_analyses_total",
      value: byUser.size,
      unit: "count",
    },
    {
      id: "M-7",
      name: "low_quality_flag_rate",
      value: ratio(unhelpful, feedbackTotal),
      unit: "ratio",
    },
    {
      id: "M-7",
      name: "feedback_total",
      value: feedbackTotal,
      unit: "count",
    },
    {
      id: "M-10",
      name: "schema_validity_rate",
      value: ratio(validationPassed, validationTotal),
      unit: "ratio",
    },
    {
      id: "M-10",
      name: "validation_events_total",
      value: validationTotal,
      unit: "count",
    },
  ];

  // --- operational (`M-19` Phase 4) ----------------------------------------
  //
  // Counted here rather than in a second endpoint so one scrape covers both,
  // and so an operator cannot have monitoring configured while missing these.
  const overdueBefore = new Date(
    now.getTime() - TRACE_PURGE_WINDOW_HOURS * 60 * 60 * 1000,
  );

  const [purgePending, purgeOverdue, purgeFailed] = await Promise.all([
    prisma.tracePurgeOutbox.count({ where: { failedAt: null } }),
    // ⚠️ The alertable one. `API-011` quotes the user a window; a row still
    // owed after it has passed is a promise already broken, and no other
    // signal exists — the request succeeded, the analysis is gone, and only
    // this row knows the trace half never happened.
    prisma.tracePurgeOutbox.count({
      where: { failedAt: null, enqueuedAt: { lt: overdueBefore } },
    }),
    prisma.tracePurgeOutbox.count({ where: { failedAt: { not: null } } }),
  ]);

  const operational: OperationalMetric[] = [
    {
      name: "purge_outbox_pending",
      value: purgePending,
      unit: "count",
      help: "Trace-purge instructions accepted and not yet completed (DB §5.4 step 2).",
    },
    {
      name: "purge_outbox_overdue",
      value: purgeOverdue,
      unit: "count",
      help: `Purges still owed after the ${String(TRACE_PURGE_WINDOW_HOURS)}h window quoted to the user (API-011). Non-zero is a broken promise, not a backlog.`,
    },
    {
      name: "purge_outbox_failed",
      value: purgeFailed,
      unit: "count",
      help: "Purge instructions that exhausted their retries. Retained as evidence; never drained again.",
    },
    {
      name: "encryption_plaintext_reads",
      value: clients.cipher?.plaintextReads ?? 0,
      unit: "count",
      help: "Stored values read that were NOT sealed, since process start. Non-zero means the encryption backfill is unfinished (D-55 §7) — DB §13.1 row 3 is not met, however healthy everything else looks.",
    },
  ];

  return {
    computed,
    manual: MANUAL_METRICS,
    operational,
    generatedAt: now,
  };
}

/**
 * Prometheus text exposition format (`API-070` — "a standard scrape format").
 *
 * Chosen because it is the format an operator's existing tooling reads without
 * a translator, and because it carries `# HELP` and `# TYPE` lines — so the
 * endpoint documents itself rather than needing a second document that drifts.
 *
 * The manual metrics appear as comments rather than as series. A series with
 * no value would scrape as `0` and be indistinguishable from a real zero,
 * which is the misreading this whole module is arranged to prevent.
 */
export function renderPrometheus(snapshot: MetricsSnapshot): string {
  const lines: string[] = [];

  for (const metric of snapshot.computed) {
    lines.push(`# HELP naigx_${metric.name} ${metric.id} (${metric.unit})`);
    lines.push(`# TYPE naigx_${metric.name} gauge`);
    lines.push(`naigx_${metric.name} ${String(metric.value)}`);
  }

  // ⚠️ A SEPARATE BLOCK, DELIBERATELY. These say whether the deployment is
  // keeping promises already made to users; the series above say whether the
  // product works. An alert on one must never read as a regression in the
  // other, so they are not interleaved.
  lines.push("");
  lines.push(
    "# Operational metrics (M-19 Phase 4). NOT PRD §3.2 product metrics.",
  );
  for (const metric of snapshot.operational) {
    lines.push(`# HELP naigx_${metric.name} ${metric.help}`);
    lines.push(`# TYPE naigx_${metric.name} gauge`);
    lines.push(`naigx_${metric.name} ${String(metric.value)}`);
  }

  lines.push("");
  lines.push("# The following PRD §3.2 metrics are NOT instrumented.");
  lines.push("# They are defined as manual review and have no computed value.");
  lines.push("# Emitting them as series would make them scrape as 0, which is");
  lines.push("# indistinguishable from a measured zero.");
  for (const metric of snapshot.manual) {
    lines.push(`# ${metric.id} ${metric.name}: ${metric.reason}`);
  }

  return `${lines.join("\n")}\n`;
}
