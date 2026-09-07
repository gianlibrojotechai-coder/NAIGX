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
 *
 * ## Encryption ([D-53](../../../docs/28-D-53-Encryption-Layers.md) §2)
 *
 * `structured_input` and `structured_output` are two of the three fields
 * `DB §13.1` row 3 names, and **this is the only place either is written**.
 * That is what makes sealing them a two-line change rather than an audit: the
 * NIE produces them and never persists anything (`AD-02`/`AP-3`), so the
 * encryption boundary sits here, in the database layer, where it belongs.
 *
 * ⚠️ THEY ARE ALSO NEVER READ BACK BY THE APPLICATION. Nothing selects either
 * column — retention counts rows, the purge deletes them, instrumentation
 * counts validation events. So sealing them costs no read path today, and any
 * future reader must go through the same `FieldCipher` rather than reaching for
 * the column directly.
 *
 * The sealed value is a string, stored in a `Json` column as a JSON string.
 * That keeps one envelope codec across all three fields and needs no column
 * type migration.
 */

import type { FieldCipher } from "../crypto/data-key.js";
import { Prisma } from "../generated/prisma-trace/client.js";
import type { PrismaClient } from "../generated/prisma-trace/client.js";
import type { StageTraceRecord, StageTraceSink } from "../nie/ports.js";

export function createStageTraceSink(
  prisma: PrismaClient,
  cipher: FieldCipher,
): StageTraceSink {
  // The value reaching the column: JSON-serialised, then sealed. Serialising
  // first means the envelope wraps one string regardless of the shape inside,
  // so nothing here needs to know what a stage trace looks like.
  const sealJson = (value: unknown): string =>
    cipher.seal(JSON.stringify(value ?? null));

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
          structuredInput: sealJson(trace.structuredInput ?? {}),
          // `DbNull` writes a SQL NULL; a bare `null` would be ambiguous with
          // the JSON value `null`, and a failed stage produced no output at all
          // rather than an output that was null.
          //
          // ⚠️ THE NULL CASE IS NOT SEALED, AND MUST NOT BE. "No output" is
          // absence, not content — sealing it would replace a SQL NULL with a
          // ciphertext that decrypts to "null", making a failed stage
          // indistinguishable from one that produced a null result.
          structuredOutput:
            trace.structuredOutput === null ||
            trace.structuredOutput === undefined
              ? Prisma.DbNull
              : sealJson(trace.structuredOutput),
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
