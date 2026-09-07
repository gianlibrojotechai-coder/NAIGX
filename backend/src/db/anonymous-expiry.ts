/**
 * Anonymous analysis expiry ([D-45](../../../docs/20-D-45-Anonymous-Expiry-And-Token-Lifetime.md)).
 *
 * `DBQ-6` forbids "indefinite retention of unowned content" and `DB §5.5`
 * requires unclaimed anonymous analyses to "expire on a fixed schedule". This
 * is that schedule.
 *
 * TWO PERIODS, DELIBERATELY NOT ONE. `APIQ-4` says the token lifetime must
 * *align with* the expiry period, not equal it, because they govern different
 * things: the token decides who can **reach** an analysis, expiry decides how
 * long the **row** survives unclaimed. The token expires first. Between the
 * two, the analysis exists and nobody holds a credential for it — which is the
 * correct state for content awaiting deletion, not a gap.
 *
 * NEITHER NUMBER WAS CHOSEN FOR BEING REASONABLE:
 *
 *   · 24 hours comes from `FR-004`'s claimability window ("within the same
 *     session") and `API §3.4`'s "short, fixed".
 *   · 7 days is `DB §8.3`'s published StageTrace retention, applied to a
 *     second entity rather than invented. After 7 days an analysis's own
 *     traces are already purged, so the `FR-100` diagnosis claim no longer
 *     holds for it, and `NFR-031` then publishes one content-retention window
 *     instead of two.
 */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * How long an anonymous token can be presented (`APIQ-4`).
 *
 * **Fixed and non-sliding.** `API §3.4` says "short, fixed", so use does not
 * extend it — a sliding window would let a token held open by polling live
 * indefinitely, which is the indefinite unowned access `DB §5.5` prevents.
 */
export const ANONYMOUS_TOKEN_LIFETIME_HOURS = 24;

/** How long an unclaimed anonymous analysis survives (`DBQ-6`). */
export const ANONYMOUS_ANALYSIS_EXPIRY_DAYS = 7;

/**
 * ⚠️ THE MIGRATION-ERA EVIDENCE BOUNDARY. FROZEN. NEVER RECOMPUTE THIS.
 *
 * Mirrors the constant in `20260907170000_identity_and_operational`. It is a
 * fixed instant, not `now()` and not a relative offset: an instant that moved
 * would silently change which rows are exempt, and pinning that is the one
 * property this boundary exists for.
 *
 * Analyses created **before** it predate anonymous-token issuance — `API-020`
 * has always hashed a UUID and discarded it, so no token for them ever existed
 * and they were never claimable. Under the policy above they would expire on
 * the day the mechanism landed, having never had the 24-hour window it grants.
 * They are also cited evidence (D-45 §3): the single live-provider run, and
 * the analysis `STATUS.md` cites as M-06's demonstrated `FR-100` claim.
 *
 * THIS IS A ONE-OFF EXEMPTION, NOT A RETENTION EXCEPTION. It covers a fixed
 * set of pre-existing rows, grants no standing category of exempt content, and
 * is why there is **no exemption column** on `analysis` — a flag would be a
 * permanent mechanism for a boundary that is by definition temporary.
 */
export const ANONYMOUS_EXPIRY_BOUNDARY = new Date("2026-09-07T00:00:00.000Z");

/** When a token issued at `issuedAt` stops being presentable. */
export const anonymousTokenExpiresAt = (issuedAt: Date): Date =>
  new Date(issuedAt.getTime() + ANONYMOUS_TOKEN_LIFETIME_HOURS * MS_PER_HOUR);

/** Analyses created before this instant are eligible for the sweep. */
export const anonymousExpiryCutoff = (now: Date): Date =>
  new Date(now.getTime() - ANONYMOUS_ANALYSIS_EXPIRY_DAYS * MS_PER_DAY);

/**
 * Whether one analysis may be swept.
 *
 * Both conditions must hold, and the boundary is checked first because it is
 * absolute: an exempt row is never eligible however old it becomes.
 */
export const isSweepEligible = (analysis: {
  readonly createdAt: Date;
  readonly userId: string | null;
}): ((now: Date) => boolean) => {
  return (now: Date): boolean => {
    // Owned analyses are not unowned content and are never swept by this rule;
    // they are deleted only by `FR-063` or `FR-073`.
    if (analysis.userId !== null) return false;
    // D-45 §3 — the evidence exemption.
    if (analysis.createdAt < ANONYMOUS_EXPIRY_BOUNDARY) return false;
    return analysis.createdAt < anonymousExpiryCutoff(now);
  };
};

export interface AnonymousSweepClient {
  readonly analysis: {
    deleteMany(args: {
      where: {
        userId: null;
        createdAt: { gte: Date; lt: Date };
      };
    }): Promise<{ count: number }>;
  };
}

export interface AnonymousSweepResult {
  readonly deleted: number;
  readonly cutoff: Date;
  readonly boundary: Date;
}

/**
 * Deletes expired unclaimed anonymous analyses.
 *
 * The `gte: boundary` is the exemption, expressed in the query rather than
 * filtered afterwards: a row below the boundary is not selected at all, so
 * there is no path by which one could be deleted by a later change to this
 * function's body.
 *
 * Cascades to every child through the FKs `DB §5.3` already defines. Stage
 * traces are **not** touched — they live in the other store and expire on
 * `DB §8.3`'s own schedule, which for these rows has long since run.
 */
export async function sweepExpiredAnonymousAnalyses(
  client: AnonymousSweepClient,
  now: Date,
): Promise<AnonymousSweepResult> {
  const cutoff = anonymousExpiryCutoff(now);

  // A cutoff earlier than the boundary would make the range empty. Returning
  // early keeps that legible rather than relying on Postgres to find nothing.
  if (cutoff <= ANONYMOUS_EXPIRY_BOUNDARY) {
    return { deleted: 0, cutoff, boundary: ANONYMOUS_EXPIRY_BOUNDARY };
  }

  const { count } = await client.analysis.deleteMany({
    where: {
      userId: null,
      createdAt: { gte: ANONYMOUS_EXPIRY_BOUNDARY, lt: cutoff },
    },
  });

  return { deleted: count, cutoff, boundary: ANONYMOUS_EXPIRY_BOUNDARY };
}
