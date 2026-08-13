/**
 * Production `StageTraceSink` — persists stage traces to the **trace store**
 * (`DB §4.7`, `§8`, `FR-100`).
 *
 * The trace store is a separate database (`DB §1.4`, `docs/12` D-2), so this
 * takes the trace Prisma client, not the primary one. `analysis_id` is written
 * as an identifier reference with no foreign key — nothing here may couple the
 * two stores, and the 7-day trace expiry must never be able to affect a stored
 * analysis.
 *
 * Retention is unchanged by this file: rows land in `stage_trace`, whose 7-day
 * tier is swept by `trace-retention.ts` against `started_at`.
 */

import { Prisma } from "../generated/prisma-trace/client.js";
import type { PrismaClient } from "../generated/prisma-trace/client.js";
import type { StageTraceRecord, StageTraceSink } from "../nie/ports.js";

export function createStageTraceSink(prisma: PrismaClient): StageTraceSink {
  return {
    async record(trace: StageTraceRecord): Promise<void> {
      await prisma.stageTrace.create({
        data: {
          stageTraceId: trace.stageTraceId,
          analysisId: trace.analysisId,
          stageNumber: trace.stageNumber,
          stageKey: trace.stageKey,
          // `structured_input` is non-null in the schema; a stage always has
          // an input even when it produced nothing.
          structuredInput: (trace.structuredInput ?? {}) as object,
          // `DbNull` writes a SQL NULL; a bare `null` would be ambiguous with
          // the JSON value `null`, and a failed stage produced no output at all
          // rather than an output that was null.
          structuredOutput:
            trace.structuredOutput === null ||
            trace.structuredOutput === undefined
              ? Prisma.DbNull
              : (trace.structuredOutput as object),
          startedAt: trace.startedAt,
          durationMs: trace.durationMs,
          outcome: trace.outcome,
          failureReason: trace.failureReason,
          retryCount: trace.retryCount,
        },
      });
    },
  };
}
