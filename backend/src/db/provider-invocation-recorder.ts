/**
 * Trace-store-backed `ProviderInvocation` recorder.
 *
 * Lives in `db/` rather than `provider/` on purpose. The provider abstraction
 * layer declares the `ProviderInvocationRecorder` port and knows nothing about
 * persistence; this adapts that port to the trace store. Keeping the Prisma
 * import on this side means `provider/` holds no database dependency, and the
 * layer stays unit-testable with no database at all.
 *
 * Writes land in the trace store — a separate database (`DB §1.4`,
 * `docs/12` D-2) — and carry `stage_trace_id` and `model_version_id` as
 * identifier references with no foreign key (`docs/12` D-9).
 */

import type { PrismaClient } from "../generated/prisma-trace/client.js";
import type {
  ProviderInvocationRecord,
  ProviderInvocationRecorder,
} from "../provider/invoke.js";

export function createProviderInvocationRecorder(
  prisma: PrismaClient,
): ProviderInvocationRecorder {
  return {
    async record(invocation: ProviderInvocationRecord): Promise<void> {
      await prisma.providerInvocation.create({
        data: {
          stageTraceId: invocation.stageTraceId,
          modelVersionId: invocation.modelVersionId,
          latencyMs: invocation.latencyMs,
          inputTokens: invocation.inputTokens,
          outputTokens: invocation.outputTokens,
          // Passed as a decimal string, never a JS number: `numeric(18,8)`
          // preserves what binary floating point would already have lost
          // (`docs/12` D-4).
          estimatedCost: invocation.estimatedCostUsd,
          outcome: invocation.outcome,
          errorClass: invocation.errorClass,
          attemptNumber: invocation.attemptNumber,
          fallbackUsed: invocation.fallbackUsed,
        },
      });
    },
  };
}
