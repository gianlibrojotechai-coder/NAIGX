/**
 * Request authentication (`API §3.3`, `NFR-026`).
 *
 * Resolves the `Authorization` header into a `Principal` once per request and
 * decorates it onto the request, so every route asks the same question of the
 * same answer. `SA §10.2` centralises authorization at the API layer; this is
 * where that centralisation lives.
 *
 * ⚠️ THIS HOOK AUTHENTICATES; IT DOES NOT AUTHORIZE. It never rejects a
 * request. An unrecognised or absent credential resolves to `none`, and the
 * route decides what that means — a 401 on a protected endpoint, and an
 * entirely ordinary request on an open one like `API-020`, which `API §3.3`
 * requires to work with no account at all.
 *
 * Rejecting here would break `FR-004` on the first request it ever saw.
 *
 * ⚠️ IT NEVER READS `refresh_token`. `resolvePrincipal` consults sessions and
 * anonymous ownership only, so a refresh token presented as a `Bearer`
 * credential resolves to `none` on every protected route in the API
 * ([D-44](../../../docs/19-D-44-Refresh-Token-Table.md)).
 */

import type { FastifyInstance } from "fastify";

import {
  resolvePrincipal,
  type Principal,
  type PrincipalLookup,
} from "../auth/principal.js";
import { anonymousTokenExpiresAt } from "../db/anonymous-expiry.js";
import { AppError } from "./errors.js";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Who is asking. Always present — `none` when no credential verified, so
     * a route can never forget to handle the unauthenticated case by finding
     * `undefined` and treating it as falsy in the wrong direction.
     */
    principal: Principal;
  }
}

export interface AuthenticateOptions {
  readonly lookup: PrincipalLookup;
  readonly now?: () => Date;
}

export function registerAuthentication(
  app: FastifyInstance,
  options: AuthenticateOptions,
): void {
  // ⚠️ NOT `decorateRequest`. Fastify refuses a reference-type request
  // decorator, and rightly: a decorator value is shared across every request,
  // so one request mutating a shared principal object would change what every
  // other request saw — an authorization bug of the worst kind.
  //
  // Assigned in `onRequest` instead, which is the first hook Fastify runs. By
  // the time any route handler or route-level hook executes, `principal` is
  // always set, which is what the module augmentation above asserts.
  app.addHook("onRequest", async (request) => {
    request.principal = await resolvePrincipal(
      request.headers.authorization,
      options.lookup,
      {
        anonymousTokenExpiresAt,
        now: options.now ?? (() => new Date()),
      },
    );
  });
}

/**
 * The principal of an authenticated user, or `401`.
 *
 * For endpoints `API §3.3` lists under "Authentication required" — export,
 * history, settings, feedback, account operations.
 */
export function requireUser(principal: Principal): {
  userId: string;
  sessionId: string;
} {
  if (principal.kind !== "user") {
    throw new AppError("unauthenticated", "This action needs an account.", {
      action:
        "Sign in, or register — your current analysis can be claimed into the new account.",
    });
  }
  return { userId: principal.userId, sessionId: principal.sessionId };
}
