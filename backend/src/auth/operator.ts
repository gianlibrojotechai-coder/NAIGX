/**
 * Operator authentication for `/internal/*` ([D-48](../../../docs/23-D-48-Operator-Authentication.md)).
 *
 * ⚠️ THIS MODULE SHARES NOTHING WITH USER AUTHENTICATION, DELIBERATELY.
 * `APIQ-6` requires operator auth to be "separable from user auth", and the
 * separation here is structural rather than a check somebody could invert:
 *
 *   · `resolveOperator` reads the configured secret. It never touches
 *     `session`, `refresh_token` or `anonymous_token_hash`.
 *   · `resolvePrincipal` (`src/auth/principal.ts`) reads sessions and
 *     anonymous ownership. It has no notion of an operator.
 *
 * Neither function can return the other's answer, because neither consults the
 * other's source. A user session therefore cannot become an operator
 * credential by any path — there is no role check to get wrong, which is
 * exactly why `API §10.4`'s "one role and no permission model" is kept.
 *
 * ⚠️ THE SECRET IS NEVER LOGGED, ECHOED OR RETURNED. Not in an error message,
 * not in a response body, not on failure — where the temptation to say
 * "expected X, got Y" is strongest and the damage is largest.
 */

import { timingSafeEqual } from "node:crypto";

import { AppError } from "../http/errors.js";
import { bearerToken } from "./principal.js";

/**
 * A caller proven to hold the operator credential.
 *
 * A distinct type from `Principal` on purpose: a function that wants an
 * operator cannot be handed a `UserPrincipal` by mistake, because the two do
 * not unify. `API §10.4` — an operator is a different kind of caller, not a
 * user with a flag.
 */
export interface OperatorPrincipal {
  readonly kind: "operator";
}

/**
 * Compares two secrets without leaking their common prefix.
 *
 * `===` short-circuits on the first differing byte, and the difference is
 * measurable across enough requests. `timingSafeEqual` requires equal lengths,
 * so the length check happens first — and length alone is a far weaker signal
 * than a byte-by-byte oracle.
 */
const secretsMatch = (presented: string, configured: string): boolean => {
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(configured, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

/**
 * Whether this request holds the operator credential.
 *
 * Returns `null` for every other case — a user token, an anonymous token, a
 * missing header, a malformed one, and a wrong secret all resolve identically.
 * `/internal/*` gives them all the same refusal, so none of them is a step
 * toward the others.
 *
 * ⚠️ AN ABSENT CONFIGURED SECRET DISABLES THE SURFACE. With none set, nothing
 * authenticates. A development convenience that let these endpoints answer
 * without a credential would be the one that reached production.
 */
export function resolveOperator(
  header: string | undefined,
  configuredSecret: string | undefined,
): OperatorPrincipal | null {
  if (configuredSecret === undefined || configuredSecret === "") return null;

  const presented = bearerToken(header);
  if (presented === null) return null;

  return secretsMatch(presented, configuredSecret)
    ? { kind: "operator" }
    : null;
}

/**
 * The refusal for `/internal/*`.
 *
 * ⚠️ IT SAYS NOTHING ABOUT WHY. Not whether a secret is configured, not
 * whether the presented one was close, not whether the caller is a valid user.
 * `API §6.8` requires these endpoints to be "unreachable without operator
 * authorization", and a message that distinguished "no operator token
 * configured" from "wrong operator token" would tell an attacker which
 * deployments are worth attacking.
 *
 * `operator_only` 403 rather than `unauthenticated` 401: a 401 invites the
 * client to authenticate, and no user credential can ever satisfy this.
 */
export const operatorOnlyError = (): AppError =>
  new AppError(
    "operator_only",
    "This endpoint is not part of the public API.",
    {
      action:
        "Operational endpoints are reachable only with operator credentials.",
    },
  );

/** Guards an internal route. Throws rather than returning a flag to ignore. */
export function requireOperator(
  header: string | undefined,
  configuredSecret: string | undefined,
): OperatorPrincipal {
  const operator = resolveOperator(header, configuredSecret);
  if (operator === null) throw operatorOnlyError();
  return operator;
}
