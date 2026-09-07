# D-48 — `APIQ-6` resolved: a static operator credential, separable by construction

**Date:** 2026-09-07
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** `APIQ-6` (operator authentication mechanism for `/internal/*`)
**Affects:** `API §5`, `API §6.8`, `API-070`, `NFR-026`, `NFR-081`, `M-16`, `M-18`, `M-19`
**Extends** [D-44](19-D-44-Refresh-Token-Table.md). Supersedes nothing.

---

## 1. The question, and the two constraints on it

`APIQ-6` asks how `/internal/*` authenticates, and fixes two properties:

> Must be **separable from user auth**; trace access must be **independently audited**.

`API §6.8` adds that every internal endpoint is "unreachable without operator authorization" and "excluded from the public contract and from `v1` compatibility guarantees", and `API §11.1` states the rule plainly: *"Never expose internal metrics on a public endpoint."*

**Separable is the hard requirement.** `M-15` built a user credential — sessions, refresh rotation, an anonymous class — and the failure this decision must prevent is a user session becoming an operator credential by any path: a shared resolver, a role column, a check somebody can invert. `API §10.4` is explicit that v1 has "one role and no permission model", so an operator is not a user with a flag; it is a different kind of caller.

## 2. The decision

1. **A static operator credential, supplied by configuration** as `NAIGX_OPERATOR_TOKEN`, presented as `Authorization: Bearer <token>`.
2. **Resolved by its own function, not by the user resolver.** `resolveOperator` reads the configured secret and nothing else; `resolvePrincipal` (`src/auth/principal.ts`) reads sessions and anonymous ownership and nothing else. **Neither can return the other's answer**, because neither consults the other's source — the same structural separation [D-44](19-D-44-Refresh-Token-Table.md) §3 gave refresh tokens.
3. **`/internal/*` accepts an operator credential and nothing else.** A valid user access token, a valid anonymous token, an absent header and a malformed one all receive the same refusal. Being signed in is not a step toward being an operator.
4. **The comparison is constant-time.** A secret compared with `===` leaks its prefix through timing, and this one guards the operational surface of the whole system.
5. **The secret is never logged, never echoed, and never returned.** It does not appear in an error message, a response body, or a log line — including on failure, where the temptation to say "expected X, got Y" is strongest.
6. **Absent configuration disables the surface.** With no `NAIGX_OPERATOR_TOKEN` set, `/internal/*` refuses every request rather than defaulting to open. A development convenience that let the endpoints answer without a credential would be the one that reached production.

## 3. What was rejected

**A role column on `USER`.** Rejected, and it is the option that looks most natural and is most dangerous. `API §10.4` says v1 has "one role and no permission model", and `DB §10.4` lists role tables among what is "deliberately not built". More importantly it fails `APIQ-6`'s own requirement: an operator resolved through the user resolver is not separable from user auth, and one bug in a role check turns every session into an operator credential. The separation this record buys is that **there is no such check to get wrong**.

**Network-level restriction only** — a separate port, or trusting a reverse proxy. Rejected as the primary mechanism. It is worth having *as well*, but on its own "unreachable without operator authorization" becomes an operations promise this repository cannot verify, nothing is auditable, and the guarantee evaporates the first time someone runs the service without the proxy in front of it. Nothing here prevents adding it at `M-19`.

**Deferring `API-070` to `M-19`.** Rejected. `M-16`'s milestone line is "all `PRD §3.2` metrics reporting", and metrics that cannot be read are not reporting. Deferring the endpoint would defer the milestone.

**Per-operator credentials with their own table.** Rejected as premature. There is one operator, no operator lifecycle, and no rotation requirement in any document. `MVP §4.5` warns against building for multiple users before one is validated, and this would be that mistake applied to the operator surface. The interface is narrow enough that adding a store later replaces one function.

## 4. What this costs

**One shared secret, with no rotation story and no per-operator attribution.** An audit event can record *that* an operator acted and not *which* one, because there is only one credential. With a single operator that distinction records nothing; with a team it would matter, and closing it means the table §3's rejection defers.

**The secret must be distributed and stored somewhere.** That is an operational surface this project does not yet have — there is no deployment (`M-19` untouched) and no secret management. Until then it lives in `.env` beside the database credentials, with the same exposure.

## 5. Scope — what this does **not** authorise

`API §6.8` lists four internal endpoints. **Only `API-070` (`/internal/metrics`) is implemented under this record.**

⚠️ **`API-073` (trace read) is explicitly out of scope, and the existence of operator authentication is not a reason to build it.** `API §6.8` calls it "the highest-privilege read in the system" and requires that **every access to it is itself audited**; `DB §8.4` restricts trace reads to operators because traces carry full user business content. Building it because the credential now exists would be exactly the drift this section exists to prevent — the credential is a prerequisite, not a licence.

`API-071` (provider health) and `API-072` (prompt versions) are likewise unbuilt. Each needs its own scope and its own decision about what it discloses.

## 6. What closing this requires

At **`M-18` (Security)**, this record is an input rather than a finding: the single shared secret, its absence of rotation, and the lack of per-operator attribution are known and stated here.

At **`M-19` (Deployment)**: decide whether `/internal/*` is additionally restricted at the network layer, and where the secret is stored. Adding network restriction does not supersede this record; the two are complementary.

## 7. Non-claims

- This does **not** implement `API-071`, `API-072` or `API-073`, and does not authorise them.
- This does **not** provide per-operator identity, credential rotation, or an operator lifecycle.
- This does **not** constitute a security review. `M-18` is separate, and this is one input to it.
- This does **not** alter user authentication in any way. `resolvePrincipal` is untouched.
- The credential is a **shared secret**, with the properties shared secrets have. It is chosen for being separable and testable, not for being strong against an attacker who already has the configuration.
