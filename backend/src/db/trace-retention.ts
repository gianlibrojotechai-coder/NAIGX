/**
 * Tiered trace retention (`DB §8.3`).
 *
 * `DB §8.3` calls this "the single most important design property of the trace
 * store": three retention periods, because the three entities have different
 * content sensitivity. A monolithic trace record would force everything to
 * expire on the most restrictive schedule, discarding cost and quality history
 * that carries no privacy cost and has long-term analytical value.
 *
 * The periods below are the v1 policy values resolving `PRD O-5` and `DBQ-2`.
 * `DB §8.3` marks them "explicitly subject to revision" — particularly the
 * 7-day StageTrace window, which trades diagnostic reach against content
 * exposure and has no usage data behind it yet.
 *
 * OUTSTANDING, and not discharged by this module: `NFR-031` requires these
 * periods to appear in a published data-handling policy accessible before first
 * submission. Setting them in code is not publishing them.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Retention period per trace entity, in days.
 *
 * Sensitivity drives the tier:
 *   · StageTrace         — HIGH: full user business content.
 *   · ProviderInvocation — NONE: metrics only.
 *   · ValidationEvent    — NONE: structural outcomes only.
 */
export const TRACE_RETENTION_DAYS = {
  /** 7 days. The shortest period still supporting diagnosis of a reported
   *  problem within a working week (`EV-3`, `FR-100`). */
  stageTrace: 7,
  /** 30 days. Long enough for cost and latency trend analysis (`NFR-083`). */
  providerInvocation: 30,
  /** 30 days. Supports the schema-validation failure rate that `SA §12.3`
   *  names the leading quality indicator. */
  validationEvent: 30,
} as const;

export type TraceEntity = keyof typeof TRACE_RETENTION_DAYS;

/**
 * The instant before which rows of `entity` have expired.
 *
 * Pure: takes `now` rather than reading the clock, so expiry is testable at
 * exact tier boundaries.
 */
export function retentionCutoff(entity: TraceEntity, now: Date): Date {
  return new Date(now.getTime() - TRACE_RETENTION_DAYS[entity] * MS_PER_DAY);
}

/** Rows deleted per entity by one purge pass. */
export interface TracePurgeResult {
  readonly stageTrace: number;
  readonly providerInvocation: number;
  readonly validationEvent: number;
}

/**
 * The minimal surface `purgeExpiredTraces` needs.
 *
 * Declared structurally rather than importing the generated client, so this
 * module stays independent of client generation and is unit-testable without a
 * database.
 */
export interface TracePurgeClient {
  readonly stageTrace: {
    deleteMany(args: {
      where: { startedAt: { lt: Date } };
    }): Promise<{ count: number }>;
  };
  readonly providerInvocation: {
    deleteMany(args: {
      where: { recordedAt: { lt: Date } };
    }): Promise<{ count: number }>;
  };
  readonly validationEvent: {
    deleteMany(args: {
      where: { recordedAt: { lt: Date } };
    }): Promise<{ count: number }>;
  };
}

/**
 * Deletes expired rows from each tier independently.
 *
 * Each entity is swept against its own cutoff — that independence is the whole
 * point of §8.3. StageTrace is purged first so that user business content is
 * removed before the metric tiers are touched: if a later delete fails, the
 * content is already gone rather than still waiting behind a failed sweep.
 *
 * This is the mechanism, not the schedule. Nothing here installs a timer; the
 * operator surface that invokes it is a separate deliverable.
 */
export async function purgeExpiredTraces(
  client: TracePurgeClient,
  now: Date = new Date(),
): Promise<TracePurgeResult> {
  const stageTrace = await client.stageTrace.deleteMany({
    where: { startedAt: { lt: retentionCutoff("stageTrace", now) } },
  });

  const providerInvocation = await client.providerInvocation.deleteMany({
    where: { recordedAt: { lt: retentionCutoff("providerInvocation", now) } },
  });

  const validationEvent = await client.validationEvent.deleteMany({
    where: { recordedAt: { lt: retentionCutoff("validationEvent", now) } },
  });

  return {
    stageTrace: stageTrace.count,
    providerInvocation: providerInvocation.count,
    validationEvent: validationEvent.count,
  };
}
