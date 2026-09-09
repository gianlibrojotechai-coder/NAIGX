/**
 * Unit — principal resolution and the ownership predicate (`M-15` Phase 2).
 *
 * These are the tests that matter most in this milestone, because every one of
 * them describes a way an attacker gets in if it fails:
 *
 *   · an analysis id accepted as evidence of ownership
 *   · a refresh token accepted as an access credential
 *   · a revoked or expired session still resolving
 *   · a token for one analysis granting access to another
 *   · a claimed analysis still answering to its old anonymous token
 *
 * `NFR-026` requires authorization "enforced server-side on every history and
 * export operation" and `API §3.3` adds "never from a client-supplied owner
 * identifier". Both are properties of `resolvePrincipal` and
 * `mayAccessAnalysis`, so both are pinned here.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ANONYMOUS,
  bearerToken,
  mayAccessAnalysis,
  resolvePrincipal,
  type PrincipalLookup,
} from "../../src/auth/principal.js";
import { generateToken, hashToken } from "../../src/auth/tokens.js";
import { anonymousTokenExpiresAt } from "../../src/db/anonymous-expiry.js";

const NOW = new Date("2026-09-07T12:00:00.000Z");
const ANALYSIS_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const OTHER_ANALYSIS = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const USER_ID = "cccccccc-3333-4333-8333-cccccccccccc";
const SESSION_ID = "dddddddd-4444-4444-8444-dddddddddddd";

const options = { anonymousTokenExpiresAt, now: () => NOW };

/**
 * A lookup over fixed rows, applying the same predicates the real queries do.
 *
 * Written to *enforce* the where clauses rather than ignore them: a double
 * that returned rows regardless would let a resolver bug pass.
 */
const lookup = (rows: {
  sessions?: {
    tokenHash: string;
    revokedAt: Date | null;
    expiresAt: Date;
  }[];
  analyses?: {
    anonymousTokenHash: string;
    userId: string | null;
    createdAt: Date;
    analysisId?: string;
  }[];
}): PrincipalLookup => ({
  session: {
    findFirst: ({ where }) => {
      const match = (rows.sessions ?? []).find(
        (s) =>
          s.tokenHash === where.tokenHash &&
          s.revokedAt === null &&
          s.expiresAt > where.expiresAt.gt,
      );
      return Promise.resolve(
        match === undefined ? null : { sessionId: SESSION_ID, userId: USER_ID },
      );
    },
  },
  analysis: {
    findFirst: ({ where }) => {
      const match = (rows.analyses ?? []).find(
        (a) =>
          a.anonymousTokenHash === where.anonymousTokenHash &&
          a.userId === null,
      );
      return Promise.resolve(
        match === undefined
          ? null
          : {
              analysisId: match.analysisId ?? ANALYSIS_ID,
              createdAt: match.createdAt,
            },
      );
    },
  },
});

// --- header parsing ---------------------------------------------------------

test("a bearer token is extracted, case-insensitively on the scheme", () => {
  assert.equal(bearerToken("Bearer abc123"), "abc123");
  assert.equal(bearerToken("bearer abc123"), "abc123");
  assert.equal(bearerToken("  Bearer   abc123  "), "abc123");
});

test("anything that is not a bearer header yields no token", () => {
  assert.equal(bearerToken(undefined), null);
  assert.equal(bearerToken(""), null);
  assert.equal(bearerToken("Basic abc123"), null);
  assert.equal(bearerToken("Bearer"), null);
  assert.equal(bearerToken("Bearer a b"), null);
});

// --- THE constraint: an id is not a credential ------------------------------

test("no header resolves to no principal", async () => {
  const principal = await resolvePrincipal(undefined, lookup({}), options);
  assert.deepEqual(principal, ANONYMOUS);
});

test("an analysis id presented as a token establishes nothing", async () => {
  // The security property this milestone was told to preserve: possession of
  // an id is not possession of a credential. An id is a name; only a token
  // whose hash matches a stored row proves ownership.
  const principal = await resolvePrincipal(
    `Bearer ${ANALYSIS_ID}`,
    lookup({
      analyses: [
        {
          anonymousTokenHash: hashToken(generateToken()),
          userId: null,
          createdAt: NOW,
        },
      ],
    }),
    options,
  );
  assert.deepEqual(principal, ANONYMOUS);
});

test("an unrecognised token resolves to none rather than throwing", async () => {
  const principal = await resolvePrincipal(
    `Bearer ${generateToken()}`,
    lookup({}),
    options,
  );
  assert.deepEqual(principal, ANONYMOUS);
});

// --- token classes stay separate --------------------------------------------

test("a refresh token is not an access credential", async () => {
  // D-44: a refresh token is resolvable from the database, and that must never
  // make it a Bearer credential on a protected route. `resolvePrincipal` does
  // not read `refresh_token` at all — API-002 alone consults it — so a refresh
  // token matches no session and no analysis, and resolves to none.
  //
  // Asserted through the lookup shape: the resolver is given a lookup with no
  // refresh-token surface whatsoever, and compiles. There is no query to make.
  const refreshToken = generateToken();
  const principal = await resolvePrincipal(
    `Bearer ${refreshToken}`,
    lookup({
      sessions: [
        {
          // A *different* token owns the session; the refresh token does not.
          tokenHash: hashToken(generateToken()),
          revokedAt: null,
          expiresAt: new Date(NOW.getTime() + 3_600_000),
        },
      ],
    }),
    options,
  );
  assert.deepEqual(principal, ANONYMOUS);
});

// --- session resolution -----------------------------------------------------

test("a live session token resolves to its user", async () => {
  const token = generateToken();
  const principal = await resolvePrincipal(
    `Bearer ${token}`,
    lookup({
      sessions: [
        {
          tokenHash: hashToken(token),
          revokedAt: null,
          expiresAt: new Date(NOW.getTime() + 3_600_000),
        },
      ],
    }),
    options,
  );

  assert.deepEqual(principal, {
    kind: "user",
    userId: USER_ID,
    sessionId: SESSION_ID,
  });
});

test("a revoked session resolves to none", async () => {
  const token = generateToken();
  const principal = await resolvePrincipal(
    `Bearer ${token}`,
    lookup({
      sessions: [
        {
          tokenHash: hashToken(token),
          revokedAt: NOW,
          expiresAt: new Date(NOW.getTime() + 3_600_000),
        },
      ],
    }),
    options,
  );
  assert.deepEqual(principal, ANONYMOUS);
});

test("an expired session resolves to none", async () => {
  const token = generateToken();
  const principal = await resolvePrincipal(
    `Bearer ${token}`,
    lookup({
      sessions: [
        {
          tokenHash: hashToken(token),
          revokedAt: null,
          expiresAt: new Date(NOW.getTime() - 1),
        },
      ],
    }),
    options,
  );
  assert.deepEqual(principal, ANONYMOUS);
});

// --- anonymous tokens -------------------------------------------------------

test("a live anonymous token resolves to the analysis it owns", async () => {
  const token = generateToken();
  const principal = await resolvePrincipal(
    `Bearer ${token}`,
    lookup({
      analyses: [
        {
          anonymousTokenHash: hashToken(token),
          userId: null,
          createdAt: new Date(NOW.getTime() - 3_600_000),
        },
      ],
    }),
    options,
  );

  assert.deepEqual(principal, { kind: "anonymous", analysisId: ANALYSIS_ID });
});

test("API §3.4 — an anonymous token expires 24 hours after issuance", async () => {
  const token = generateToken();
  const justInside = await resolvePrincipal(
    `Bearer ${token}`,
    lookup({
      analyses: [
        {
          anonymousTokenHash: hashToken(token),
          userId: null,
          createdAt: new Date(NOW.getTime() - 24 * 3_600_000 + 1_000),
        },
      ],
    }),
    options,
  );
  assert.equal(justInside.kind, "anonymous");

  const justOutside = await resolvePrincipal(
    `Bearer ${token}`,
    lookup({
      analyses: [
        {
          anonymousTokenHash: hashToken(token),
          userId: null,
          createdAt: new Date(NOW.getTime() - 24 * 3_600_000 - 1_000),
        },
      ],
    }),
    options,
  );
  assert.deepEqual(justOutside, ANONYMOUS);
});

test("the anonymous lifetime does not slide with use", async () => {
  // `API §3.4` says "short, **fixed**". Expiry is computed from issuance, so
  // resolving the token repeatedly cannot extend it — a sliding window would
  // let a token held open by polling live indefinitely.
  const token = generateToken();
  const issued = new Date(NOW.getTime() - 23 * 3_600_000);
  const rows = lookup({
    analyses: [
      { anonymousTokenHash: hashToken(token), userId: null, createdAt: issued },
    ],
  });

  const first = await resolvePrincipal(`Bearer ${token}`, rows, options);
  assert.equal(first.kind, "anonymous");

  const later = {
    anonymousTokenExpiresAt,
    now: () => new Date(NOW.getTime() + 2 * 3_600_000),
  };
  const second = await resolvePrincipal(`Bearer ${token}`, rows, later);
  assert.deepEqual(second, ANONYMOUS, "the window slid with use");
});

test("a claimed analysis stops answering to its old anonymous token", async () => {
  // The `userId: null` predicate is in the query, so a claim invalidates the
  // credential by construction rather than by remembering to clear it.
  const token = generateToken();
  const principal = await resolvePrincipal(
    `Bearer ${token}`,
    lookup({
      analyses: [
        {
          anonymousTokenHash: hashToken(token),
          userId: USER_ID,
          createdAt: NOW,
        },
      ],
    }),
    options,
  );
  assert.deepEqual(principal, ANONYMOUS);
});

// --- the ownership predicate ------------------------------------------------

const owned = { analysisId: ANALYSIS_ID, ownerUserId: USER_ID };
const unowned = { analysisId: ANALYSIS_ID, ownerUserId: null };

test("an owner may access their own analysis", () => {
  assert.equal(
    mayAccessAnalysis(
      { kind: "user", userId: USER_ID, sessionId: SESSION_ID },
      owned,
    ),
    true,
  );
});

test("a different user may not", () => {
  assert.equal(
    mayAccessAnalysis(
      { kind: "user", userId: "someone-else", sessionId: SESSION_ID },
      owned,
    ),
    false,
  );
});

test("no principal may access an owned analysis", () => {
  assert.equal(mayAccessAnalysis(ANONYMOUS, owned), false);
});

test("an anonymous token may not access an owned analysis", () => {
  // Even one naming this exact id. Ownership transferred; the credential died.
  assert.equal(
    mayAccessAnalysis({ kind: "anonymous", analysisId: ANALYSIS_ID }, owned),
    false,
  );
});

test("API §3.4 — an anonymous token grants access to exactly one analysis", () => {
  // Scope is a property of the credential, not a counter somebody remembers
  // to check. A token for A grants nothing on B.
  assert.equal(
    mayAccessAnalysis({ kind: "anonymous", analysisId: ANALYSIS_ID }, unowned),
    true,
  );
  assert.equal(
    mayAccessAnalysis(
      { kind: "anonymous", analysisId: OTHER_ANALYSIS },
      unowned,
    ),
    false,
  );
});

test("an authenticated user may not read someone's unclaimed analysis", () => {
  // Being logged in is not ownership of unowned content. `DB §5.5`: an
  // anonymous analysis is "reachable only by its originating token".
  assert.equal(
    mayAccessAnalysis(
      { kind: "user", userId: USER_ID, sessionId: SESSION_ID },
      unowned,
    ),
    false,
  );
});

test("no principal may access an unowned analysis", () => {
  assert.equal(mayAccessAnalysis(ANONYMOUS, unowned), false);
});

// --- D-67 §2: owner-only access ----------------------------------------------

const sessionWithEmail = (
  tokenHash: string,
  email: string | undefined,
): PrincipalLookup => ({
  session: {
    findFirst: ({ where, select }) =>
      Promise.resolve(
        where.tokenHash === tokenHash
          ? {
              sessionId: SESSION_ID,
              userId: USER_ID,
              // Only when asked for, as Prisma would.
              ...(select.user !== undefined && email !== undefined
                ? { user: { email } }
                : {}),
            }
          : null,
      ),
  },
  analysis: { findFirst: () => Promise.resolve(null) },
});

test("D-67 — a session for an allowlisted account resolves; any other account resolves to none", async () => {
  const token = generateToken();
  const allowed = (email: string) => email === "owner@example.test";

  const owner = await resolvePrincipal(
    `Bearer ${token}`,
    sessionWithEmail(hashToken(token), "Owner@Example.test".toLowerCase()),
    { ...options, isAccountAllowed: allowed },
  );
  assert.equal(owner.kind, "user");

  const other = await resolvePrincipal(
    `Bearer ${token}`,
    sessionWithEmail(hashToken(token), "someone@else.test"),
    { ...options, isAccountAllowed: allowed },
  );
  assert.deepEqual(other, ANONYMOUS);

  // Fail closed: a row that carries no email is not allowed, not unknown.
  const noEmail = await resolvePrincipal(
    `Bearer ${token}`,
    sessionWithEmail(hashToken(token), undefined),
    { ...options, isAccountAllowed: allowed },
  );
  assert.deepEqual(noEmail, ANONYMOUS);
});

test("D-67 — without an allowlist the session select is unchanged and every account resolves", async () => {
  const token = generateToken();
  let selected: unknown;
  const lookupSpy: PrincipalLookup = {
    session: {
      findFirst: ({ select }) => {
        selected = select;
        return Promise.resolve({ sessionId: SESSION_ID, userId: USER_ID });
      },
    },
    analysis: { findFirst: () => Promise.resolve(null) },
  };
  const principal = await resolvePrincipal(
    `Bearer ${token}`,
    lookupSpy,
    options,
  );
  assert.equal(principal.kind, "user");
  assert.deepEqual(selected, { sessionId: true, userId: true });
});
