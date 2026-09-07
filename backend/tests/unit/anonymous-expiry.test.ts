/**
 * Unit — anonymous expiry and the migration-era evidence boundary ([D-45](../../../docs/20-D-45-Anonymous-Expiry-And-Token-Lifetime.md)).
 *
 * THE BOUNDARY IS THE POINT. D-45 exempts a fixed set of pre-existing rows —
 * the single live-provider run and the analysis `STATUS.md` cites as M-06's
 * demonstrated `FR-100` claim — and the whole exemption rests on one instant
 * never moving. A boundary computed from `now()` would look identical in
 * ordinary use and quietly change which rows are exempt every day it ran.
 *
 * So these tests pin: the constant itself, that exactly pre-boundary rows are
 * exempt, that post-boundary rows are eligible, and that no amount of elapsed
 * time makes an exempt row sweepable.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ANONYMOUS_ANALYSIS_EXPIRY_DAYS,
  ANONYMOUS_EXPIRY_BOUNDARY,
  ANONYMOUS_TOKEN_LIFETIME_HOURS,
  anonymousExpiryCutoff,
  anonymousTokenExpiresAt,
  isSweepEligible,
  sweepExpiredAnonymousAnalyses,
  type AnonymousSweepClient,
} from "../../src/db/anonymous-expiry.js";

test("D-45 — the policy values are 24 hours and 7 days", () => {
  assert.equal(ANONYMOUS_TOKEN_LIFETIME_HOURS, 24);
  assert.equal(ANONYMOUS_ANALYSIS_EXPIRY_DAYS, 7);
});

test("the expiry period is DB §8.3's StageTrace value, not a second window", () => {
  // D-45 §2.2: 7 days is the published trace-retention number applied to a
  // second entity, so `NFR-031` publishes one content-retention window rather
  // than two. If this ever diverges, the data policy has two numbers to
  // explain and one of them is unexplained.
  assert.equal(ANONYMOUS_ANALYSIS_EXPIRY_DAYS, 7);
});

test("the boundary is a frozen instant, matching the migration", () => {
  // Mirrors `20260907170000_identity_and_operational`. If these disagree, the
  // exemption means one thing in SQL and another in code.
  assert.equal(
    ANONYMOUS_EXPIRY_BOUNDARY.toISOString(),
    "2026-09-07T00:00:00.000Z",
  );
});

test("the boundary does not move between reads", () => {
  // The property the whole exemption rests on.
  const first = ANONYMOUS_EXPIRY_BOUNDARY.getTime();
  const second = ANONYMOUS_EXPIRY_BOUNDARY.getTime();
  assert.equal(first, second);
  // And it is in the past relative to any plausible run, so it can never
  // become a moving "recent" cutoff.
  assert.ok(ANONYMOUS_EXPIRY_BOUNDARY < new Date("2026-09-08T00:00:00.000Z"));
});

test("a token expires 24 hours after issuance, computed from issuance", () => {
  const issued = new Date("2026-09-10T08:00:00.000Z");
  assert.equal(
    anonymousTokenExpiresAt(issued).toISOString(),
    "2026-09-11T08:00:00.000Z",
  );
});

test("the sweep cutoff is 7 days before now", () => {
  const now = new Date("2026-09-20T00:00:00.000Z");
  assert.equal(
    anonymousExpiryCutoff(now).toISOString(),
    "2026-09-13T00:00:00.000Z",
  );
});

// --- eligibility ------------------------------------------------------------

const NOW = new Date("2026-10-01T00:00:00.000Z");

const eligible = (createdAt: string, userId: string | null = null) =>
  isSweepEligible({ createdAt: new Date(createdAt), userId })(NOW);

test("a pre-boundary row is exempt", () => {
  // The 22 legacy analyses. Newest is 2026-09-06T11:46:44.817Z.
  assert.equal(eligible("2026-09-06T11:46:44.817Z"), false);
  assert.equal(eligible("2026-08-14T00:00:00.000Z"), false);
  assert.equal(eligible("2026-09-06T23:59:59.999Z"), false);
});

test("no elapsed time makes an exempt row sweepable", () => {
  // The exemption is absolute, not a longer retention period. Checked a year
  // out, because "eventually it expires anyway" would be a different decision
  // from the one D-45 records.
  const farFuture = new Date("2027-10-01T00:00:00.000Z");
  assert.equal(
    isSweepEligible({
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      userId: null,
    })(farFuture),
    false,
  );
});

test("a post-boundary row older than 7 days is eligible", () => {
  assert.equal(eligible("2026-09-07T00:00:00.000Z"), true);
  assert.equal(eligible("2026-09-20T00:00:00.000Z"), true);
});

test("a post-boundary row younger than 7 days is not yet eligible", () => {
  assert.equal(eligible("2026-09-28T00:00:00.000Z"), false);
});

test("an owned analysis is never swept by this rule", () => {
  // Claimed content is not unowned content. It is deleted by `FR-063` or
  // `FR-073`, never by a retention sweep for anonymous rows.
  assert.equal(eligible("2026-09-10T00:00:00.000Z", "a-user"), false);
});

// --- the query --------------------------------------------------------------

test("the sweep query excludes pre-boundary rows in the WHERE clause", async () => {
  // Expressed in the query rather than filtered afterwards, so no later edit
  // to this function's body can delete an exempt row.
  let captured: unknown;
  const client: AnonymousSweepClient = {
    analysis: {
      deleteMany: (args) => {
        captured = args.where;
        return Promise.resolve({ count: 3 });
      },
    },
  };

  const result = await sweepExpiredAnonymousAnalyses(client, NOW);

  assert.deepEqual(captured, {
    userId: null,
    createdAt: {
      gte: ANONYMOUS_EXPIRY_BOUNDARY,
      lt: anonymousExpiryCutoff(NOW),
    },
  });
  assert.equal(result.deleted, 3);
  assert.equal(result.boundary, ANONYMOUS_EXPIRY_BOUNDARY);
});

test("the sweep deletes nothing when the cutoff precedes the boundary", async () => {
  // In the days right after the migration, every unowned row is either exempt
  // or too young. The range is empty and no query need run.
  let called = false;
  const client: AnonymousSweepClient = {
    analysis: {
      deleteMany: () => {
        called = true;
        return Promise.resolve({ count: 99 });
      },
    },
  };

  const result = await sweepExpiredAnonymousAnalyses(
    client,
    new Date("2026-09-08T00:00:00.000Z"),
  );

  assert.equal(called, false);
  assert.equal(result.deleted, 0);
});
