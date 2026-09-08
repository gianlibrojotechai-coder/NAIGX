# D-62 — Readiness is mode-aware: what "can reason" means in replay

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the `API-060` / replay-mode contradiction found on the first real deploy
**Affects:** `API-060`, `M-19`, `src/index.ts`
**Amends** `API-060`'s acceptance text. Supersedes nothing.

---

## 1. The question

The first production deploy came up with the backend reporting **503** and the
container marked `unhealthy`. One of the two causes:

```
No provider is configured
```

`deploy/.env` holds no provider variables — deliberately, under the standing
no-provider-spend constraint. The instance runs in **replay** mode, which
`execution-mode.ts` makes the default precisely so *"nothing reaches a provider
by omission"*.

So the deployment was configured exactly as intended, and its own health check
declared it unfit to serve. **That is a contradiction between two correct
things**, not a bug in either.

## 2. What each side actually says

**`API-060`** (`docs/07` §6.7):

> Readiness includes database reachability, **provider reachability**, and
> template loadability — **an instance that cannot reason must not receive
> traffic.**

**The implementation** answered that question by checking for an Anthropic
credential, in every mode:

```ts
const { apiKey, model } = config.provider;
if (apiKey === undefined || model === undefined) {
  return Promise.reject(new Error("No provider is configured"));
}
```

⚠️ **The requirement's intent is right and the implementation's reading was too
narrow.** `API-060` asks whether the instance can *reason*. A replay instance
reasons from recordings; it never touches a credential. Testing for one tests a
capability that mode does not use.

## 3. The decision

**Readiness asks each mode what reasoning actually requires of it.**

| Mode | Ready when | Not ready when |
|---|---|---|
| **`live`** | A credential and model are configured and an adapter constructs. **Unchanged** | Either absent |
| **`replay`** | A **usable recorded corpus** is available | The corpus is empty or the adapter cannot be built |

Both remain **configuration** probes, not model calls: readiness is polled
continuously and billing a token per poll would be a defect.

## 4. ⚠️ This is not a relaxation, and the replay branch proves it

The tempting version of this change makes replay readiness trivially true —
"the adapter constructed, therefore ready". **That would be a green light on an
instance that can serve nothing**, which is the failure mode `API-060` exists
to prevent, reintroduced under a different name.

So the replay probe asks for the thing that actually makes replay able to
answer: **recordings**. And on the current deployment it **fails**, because none
are wired into the runtime yet:

```
Replay mode is configured but no recordings are available, so no
submission can be served. Readiness fails deliberately (D-62).
```

**The instance is still not ready. What changed is that it now says why, and
the reason is true.** Before this record it reported a missing Anthropic
credential — a thing it neither has nor needs.

The probe reads `REPLAY_FIXTURES`, the same constant the adapter is constructed
from, so the two cannot drift apart: a probe measuring something other than
what the adapter holds would be a claim about a different instance.

## 5. ⚠️ What replay is, and is not, suitable for

Recorded in both the code and the deployment docs, because the distinction is
easy to lose once an instance is green:

- **Replay serves deterministic, demonstrable, previously-recorded traffic.**
  Given an input it has a recording for, it reproduces exactly what was
  captured.
- **Replay cannot analyse arbitrary unseen input.** This is enforced by
  construction, not by convention: `createRecordedProvider` keys its fixtures on
  the provider inputs derived from a specific input text, so a submission with
  no recording finds no fixture and fails visibly at Stage 1.

⚠️ **A healthy replay instance is therefore not a general-purpose NAIGX.** It is
an instance that can faithfully serve what it has recorded. Reporting it as
ready must never be read as "this deployment can analyse anything a user sends".

## 6. What was rejected

**Configuring a provider to make the check pass.** Rejected — it spends money
to satisfy a probe, and the standing constraint forbids it.

**A dummy credential.** Rejected. It would make `checkProvider` pass while
`resolveExecutionMode` still selected replay, so the probe would assert a
capability the running system does not have. A fabricated green light.

**Dropping provider reachability from readiness.** Rejected. `API-060`'s intent
— an instance that cannot reason must not receive traffic — is correct and
worth keeping. Only the *test* for it was wrong.

**Treating "adapter constructed" as sufficient in replay.** Rejected; §4.

## 7. Consequences

| Consequence | Handling |
|---|---|
| `API-060` acceptance text amended | Provider reachability is now "reasoning capability, per the configured execution mode" |
| The deployed instance is **still not ready** | Correctly, and for a true reason. Wiring a recorded corpus into the runtime is the remaining work |
| Live behaviour unchanged | The credential requirement stands exactly as before |
| ⚠️ A ready replay instance is not a general instance | §5. Stated in the record, the code and the deploy docs, because a green health check invites the opposite assumption |
| Revisit trigger | The first deployment intended to serve arbitrary user input, which must run in `live` mode and meets the unchanged live requirement |
