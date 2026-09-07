/**
 * Unit — operator authentication ([D-48](../../../docs/23-D-48-Operator-Authentication.md)).
 *
 * `APIQ-6` requires operator auth to be "separable from user auth", and the
 * tests that matter are the rejections: a valid **user** credential, a valid
 * **anonymous** credential, a missing one and a malformed one must all be
 * refused identically. If any of them ever authenticated, `/internal/*` would
 * be reachable by an ordinary account.
 *
 * Also pinned: that the configured secret never appears in the refusal. An
 * error saying "expected X" would hand over the credential it is guarding.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  operatorOnlyError,
  requireOperator,
  resolveOperator,
} from "../../src/auth/operator.js";
import { generateToken } from "../../src/auth/tokens.js";

const SECRET = "an-operator-secret-value";

test("the configured credential authenticates", () => {
  assert.deepEqual(resolveOperator(`Bearer ${SECRET}`, SECRET), {
    kind: "operator",
  });
});

test("a wrong secret does not", () => {
  assert.equal(resolveOperator("Bearer not-the-secret", SECRET), null);
});

// --- the rejections that matter ---------------------------------------------

test("a valid USER access token does not authenticate an operator", () => {
  // The separation `APIQ-6` requires. A session token is a real credential
  // resolved by `resolvePrincipal`; this function never consults that source,
  // so a signed-in user is not one step from being an operator.
  const userToken = generateToken();
  assert.equal(resolveOperator(`Bearer ${userToken}`, SECRET), null);
});

test("a valid ANONYMOUS token does not authenticate an operator", () => {
  const anonymousToken = generateToken();
  assert.equal(resolveOperator(`Bearer ${anonymousToken}`, SECRET), null);
});

test("a missing credential does not authenticate", () => {
  assert.equal(resolveOperator(undefined, SECRET), null);
  assert.equal(resolveOperator("", SECRET), null);
});

test("a malformed credential does not authenticate", () => {
  assert.equal(resolveOperator("Bearer", SECRET), null);
  assert.equal(resolveOperator(`Basic ${SECRET}`, SECRET), null);
  assert.equal(resolveOperator(SECRET, SECRET), null, "no scheme");
  assert.equal(resolveOperator(`Bearer ${SECRET} extra`, SECRET), null);
});

test("a prefix of the secret does not authenticate", () => {
  // Length is checked before the constant-time compare, which `timingSafeEqual`
  // requires. A prefix must fail on length, not by accident.
  assert.equal(resolveOperator(`Bearer ${SECRET.slice(0, -1)}`, SECRET), null);
  assert.equal(resolveOperator(`Bearer ${SECRET}x`, SECRET), null);
});

// --- the fail-closed default -------------------------------------------------

test("with no configured secret, nothing authenticates", () => {
  // D-48 §2.6 — absent configuration **disables** the surface. A development
  // convenience that let these endpoints answer without a credential would be
  // the one that reached production.
  assert.equal(resolveOperator(`Bearer ${SECRET}`, undefined), null);
  assert.equal(resolveOperator(`Bearer ${SECRET}`, ""), null);
  assert.equal(resolveOperator("Bearer anything", undefined), null);
  assert.equal(resolveOperator(undefined, undefined), null);
});

// --- the refusal --------------------------------------------------------------

test("the refusal never leaks the secret or why it failed", () => {
  const error = operatorOnlyError();
  const serialised = JSON.stringify({
    code: error.code,
    message: error.message,
    action: error.action,
    details: error.details,
  });

  assert.equal(serialised.includes(SECRET), false);
  // It also must not say whether a secret is configured, or whether the
  // presented one was close — that would tell an attacker which deployments
  // are worth attacking.
  assert.equal(
    /configured|expected|close|missing secret/i.test(serialised),
    false,
  );
});

test("the refusal is operator_only, not unauthenticated", () => {
  // A 401 invites the client to authenticate, and no user credential can ever
  // satisfy this endpoint. 403 says the door is not for them.
  assert.equal(operatorOnlyError().code, "operator_only");
});

test("requireOperator throws rather than returning a flag to ignore", () => {
  assert.throws(() => requireOperator("Bearer wrong", SECRET), {
    code: "operator_only",
  });
  assert.deepEqual(requireOperator(`Bearer ${SECRET}`, SECRET), {
    kind: "operator",
  });
});
