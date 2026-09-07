/**
 * Audit event persistence (`DB §4.6`, `SA §10.7`, `NFR-081`).
 *
 * ⚠️ NO USER BUSINESS CONTENT EVER REACHES THIS TABLE. `DB §4.6` states it as
 * a constraint and `NFR-081` as a requirement, and the shape below is how it
 * is kept: there is no field an analysis input, an artifact, a prompt or a
 * verdict could occupy. Absence by construction, not by filtering — the same
 * discipline `API-021` follows for stage traces.
 *
 * ⚠️ A FAILED AUDIT WRITE MUST NOT FAIL THE ACTION IT AUDITS. A login that
 * succeeded and then 500'd because an audit row could not be written would
 * leave the user unable to log in *and* leave no record of why. So writes are
 * guarded, and a failure is surfaced through `onError` rather than thrown.
 *
 * That is a deliberate trade and worth naming: it means the audit trail is
 * best-effort under database failure. `DB §4.6` calls the table append-only
 * and does not require synchronous durability with the audited action, and the
 * alternative — refusing the action — makes an audit outage an availability
 * outage.
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type { AuditWriter } from "../auth/sessions.js";

/**
 * The events this system writes.
 *
 * A closed set, so a reader can enumerate what the trail can contain rather
 * than discovering event types by sampling rows.
 */
export const AUDIT_EVENT_TYPES = [
  // `API-001`, `API-003` — session lifecycle.
  "session.created",
  "session.revoked",
  // `API-002` — the security signal. Reuse indicates theft.
  "session.refresh_reuse_detected",
  "session.login_failed",
  // `API-004` — registration.
  "user.registered",
  // `FR-004` / `DB §10.3` — "claim audited".
  "analysis.claimed",
  // `FR-063` / `FR-073` — deletion.
  "analysis.deleted",
  "user.deleted",
  // `API-040` — the `M-4` instrument.
  "export.generated",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export interface AuditSinkOptions {
  readonly prisma: PrismaClient;
  /** Surfaces a failed audit write without failing the audited action. */
  readonly onError?: (error: unknown) => void;
}

export function createAuditSink(options: AuditSinkOptions): AuditWriter {
  return {
    async record(event) {
      try {
        await options.prisma.auditEvent.create({
          data: {
            userId: event.userId,
            eventType: event.eventType,
            resourceType: event.resourceType,
            resourceId: event.resourceId ?? null,
            outcome: event.outcome,
            correlationId: event.correlationId ?? null,
            ipHash: event.ipHash ?? null,
          },
        });
      } catch (error) {
        options.onError?.(error);
      }
    },
  };
}

/** An audit sink that records nowhere. For tests that are not about auditing. */
export const nullAuditSink: AuditWriter = {
  record: () => Promise.resolve(),
};
