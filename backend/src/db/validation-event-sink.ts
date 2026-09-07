/**
 * `VALIDATION_EVENT` persistence (`DB §4.7`, `M-10`).
 *
 * ⚠️ THE TABLE HAS EXISTED SINCE SPRINT 1 WITH NOTHING WRITING IT.
 * `docs/STATUS.md` carried "`VALIDATION_EVENT` attribution — table exists with
 * correct columns; **0 rows**. Nothing writes it." as an open item, and `M-10`
 * — "outputs passing schema validation before presentation, 100%" — was
 * unmeasurable in consequence. `M-16` is the milestone that owns it.
 *
 * ⚠️ NO USER CONTENT. `failure_detail` carries the validator's message, which
 * names the schema rule that failed and never the document that failed it
 * (`NFR-081`, `DB §8.3` — this row is on the 30-day tier precisely because it
 * holds "structural outcomes only").
 *
 * A write here must never fail the analysis it measures, so the pipeline calls
 * it through its own guard — a measurement is not worth an outcome.
 */

import type { PrismaClient as TracePrismaClient } from "../generated/prisma-trace/client.js";
import type { ValidationEventSink } from "../nie/ports.js";

export function createValidationEventSink(
  prisma: TracePrismaClient,
): ValidationEventSink {
  return {
    async record(event) {
      await prisma.validationEvent.create({
        data: {
          stageTraceId: event.stageTraceId,
          artifactType: event.artifactType,
          validationClass: event.validationClass,
          passed: event.passed,
          ...(event.failureDetail !== undefined
            ? { failureDetail: event.failureDetail }
            : {}),
          regenerationTriggered: event.regenerationTriggered,
        },
      });
    },
  };
}
