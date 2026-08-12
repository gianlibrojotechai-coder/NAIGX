# Boundary Checks — `SA` Appendix A

Mechanical enforcement of NAIGX's architectural boundaries.

```bash
node tools/boundary-checks/check.mjs     # exit 0 = clean, 1 = violation
```

Run in CI on every build by [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). **A failure blocks the build.**

Zero dependencies, no network, no external services. Node built-ins only — per `Roadmap` Sprint 0, the checks exist *before* the code they govern, because "adding them later means auditing violations instead of preventing them" (`EP-3`).

---

## The eight checks

Exactly the eight in `SA` Appendix A. None invented, none substituted.

| # | Check | Enforces | State |
|---|---|---|---|
| 1 | No provider name or SDK import outside `provider/adapters/` | `AI-001`, AD-03 | ✅ enforcing |
| 2 | No database, HTTP, or framework import inside the NIE module | AD-02, `AP-3` | ⏸️ inactive |
| 3 | No outbound HTTP client available outside the provider adapter | `TC-008`, AD-09 | ✅ enforcing |
| 4 | Dependency direction inward only | `AP-1` | ✅ enforcing |
| 5 | Every artifact type has a registered schema | `FR-039`, AD-08 | ⏸️ inactive |
| 6 | Every pipeline stage emits a trace event | `AP-8`, `FR-100` | ⏸️ inactive |
| 7 | Regression suite passes before any template change merges | `NFR-043`, AD-14 | ⏸️ armed |
| 8 | Second-provider test passes | `AI-005`, AR-43 | ⏸️ armed |

---

## Deferred checks do not silently pass

A check whose subject module does not exist yet reports `inactive` and is **listed loudly in the summary**. It is never quietly counted as passing.

More importantly, each one **arms itself**. The moment its subject appears, it either begins enforcing or fails demanding to be wired:

| # | Activation condition | Behaviour on activation |
|---|---|---|
| 2 | `backend/src/nie/` exists | Begins enforcing immediately — no wiring needed |
| 5 | `backend/src/nie/` exists | **Fails** until an artifact-type/schema source is registered here |
| 6 | `backend/src/nie/` exists | **Fails** until a stage/trace-emission source is registered here |
| 7 | First template under `prompts/` | **Fails** until a regression runner is registered here |
| 8 | Second adapter under `backend/src/provider/adapters/` | **Fails** until a second-provider test is registered here |

This is the design point. A deferred check that returns green is a check nobody notices is missing; a deferred check that turns red the moment its subject exists cannot be forgotten. Checks 5, 6, 7 and 8 are fail-safe in exactly that way.

**Check 8 arms at the *second* adapter, not the first**, because the `Roadmap` places the stub provider in Sprint 0 and "second adapter with passing automated test" in Sprint 1. Arming earlier would fail the Sprint 0 task the roadmap sequences first.

---

## Two scoping decisions, recorded

Both narrow *how* a rule is detected. Neither narrows the rule.

### Check 1 detects imports and dependencies, not free text

`AI-001` governs provider-specific **logic**, and an SDK import is how that logic enters a codebase. Import-specifier and `package.json` detection is deterministic and produces no false positives.

Free-text provider-name scanning was evaluated and **rejected on evidence**: `frontend/src/App.tsx` contains the string `OpenAI` inside a placeholder depicting an example workflow a *user* might paste. That is legitimate user-facing content, not provider-specific logic. A scanner that flagged it would train the team to ignore this check.

`AI-006` — provider identity never reaching a client — is a property of runtime responses, verified by `AC-025`, not of source text.

### Check 3 is scoped to backend source

`TC-008` and AD-09 forbid *the system* holding outbound capability against user-owned platforms. `SA §1.3` has the frontend depend on "API contract only", and its HTTP client addresses NAIGX's own API.

Including the frontend would fail CI on architecture the documents prescribe. The check therefore covers server-side source, where the prohibited capability would actually live, plus `backend/package.json` so a client library cannot be introduced ahead of its use.

---

## Verified to fail

Each enforcing and armed check has been exercised against a deliberate violation and confirmed to exit non-zero:

| Scenario | Check | Result |
|---|---|---|
| `import OpenAI from "openai"` in `backend/src/` | 1 | ❌ fails |
| `import axios` in `backend/src/` | 3 | ❌ fails |
| bare `fetch()` in `backend/src/` | 3 | ❌ fails |
| `config/` importing `routes/` | 4 | ❌ fails |
| NIE module importing `pg` | 2 | ❌ fails |
| NIE module present, registry unwired | 5 | ❌ fails |
| Template under `prompts/` with no regression suite | 7 | ❌ fails |

---

## Adding a check is not permitted

`SA` Appendix A defines eight. The runner asserts `checks.length === 8` and exits `2` otherwise. Changing the set means changing `SA` Appendix A first.
