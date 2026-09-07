# D-42 — `API-040` returns the document; `export_id` exists only when a row does

**Date:** 2026-09-07
**Status:** Accepted
**Sprint:** 4 (Handoff surface)
**Affects:** `API-040`, `API-041`, `APIQ-2`, `DB §4.4` EXPORT, `M-4`, `M-13`
**Extends** [D-41](16-D-41-Anonymous-Export-Deviation.md). Supersedes nothing.

---

## 1. The conflict, stated exactly

`API-040`'s response contract is unconditional. Its **Output** row is:

> `export_id`, `download_url`, `expires_at`

and its **Acceptance** row ends:

> Records an `EXPORT` row — the `M-4` instrument.

[D-41](16-D-41-Anonymous-Export-Deviation.md) §4.3 decided the opposite for the only caller that exists in Sprint 4:

> The `EXPORT` row — and therefore the `M-4` signal — is written **only when a real authenticated owner exists**. Until M-15 lands, that condition is never true.

D-41 §4.1 then requires that `API-040` "accepts an anonymous request against a terminal analysis and **returns the document**", and D-41 §4.2 forbids inventing ownership of any kind.

**All three output fields are unsatisfiable under those decisions**, and each fails for its own reason rather than as a single oversight:

| Field | Why it cannot honestly exist | Source |
|---|---|---|
| `export_id` | It is the primary key of the `EXPORT` row. No row is written, so the id would identify nothing. | `DB §4.4`, D-41 §4.3 |
| `download_url` | `API-041`'s URL is `/analyses/{analysis_id}/exports/{export_id}/content`. With no `export_id` there is no URL to build; a synthesised one would 404 on first use. | `API-041` |
| `expires_at` | It describes the expiry of a stored file. `DB §4.4` states files **are not stored**, and D-41 §4.5 resolved `APIQ-2` in favour of a direct on-demand response, so nothing exists to expire. | `DB §4.4`, D-41 §4.5 |

The only ways to return all three are to write an `EXPORT` row with a fabricated `user_id`, or to mint an identifier that references no row. **D-41 §4.2 forbids the first by name and D-41 §3 rejects it at length** — *"a metric with invented subjects is worse than a metric with missing rows"*. The second is the same lie with the storage step removed: a client that receives an `export_id` may reasonably persist it, quote it in a bug report, or `GET` it. It would be an identifier that never identified anything.

This record exists because there is no reading of `API-040` under which the response contract is met. Choosing silently would have left an endpoint whose shape disagrees with its specification and no statement of why.

## 2. What was rejected

**Mint an `export_id` without a row.** Rejected. It is `API-020`'s recorded defect repeated deliberately: that endpoint already stores an `anonymousTokenHash` that is never issued, leaving `FR-004` claimability unmet, and D-41 §3 cites it as the mistake not to make twice. An identifier is a promise that something is retrievable by it.

**Write the `EXPORT` row anonymously with a null `user_id`.** Rejected, and it is not available anyway — `DB §4.4` types `user_id` as a non-null FK to User. Relaxing that column would alter a schema whose stated purpose is instrumenting `M-4`, in order to store rows attributable to nobody. It would also require a migration to record a measurement that D-41 has already decided not to take.

**Return `null` for all three fields.** Rejected. It keeps the shape while draining it of meaning, and a client cannot distinguish "this deployment never issues export ids" from "this export failed to register". Absence by construction is legible; a null is a question.

**Defer export until M-15 supplies identity.** Already rejected by D-41 §3, on the grounds that export is the whole point of Sprint 4. Nothing here reopens it.

## 3. The decision

1. **`API-040` returns the exported document as its response body**, with the content type and `Content-Disposition` of the requested format. It does not return a pointer to a document.
2. **`export_id`, `download_url` and `expires_at` are present only when an `EXPORT` row was actually written.** Under D-41 that condition is never met before M-15, so in Sprint 4 the three fields are **structurally absent, not null**. A caller that sees no `export_id` is seeing an accurate report that no export record exists.
3. **No identifier is minted, and no row is written, for an anonymous export.** No synthetic `user_id`, no null-owner row, no placeholder id.
   - **The success status is `200 OK`, not the specified `201 Created`.** `201` announces that a resource was created and, by convention, identifies it — which is the same claim `export_id` would make and the same one §1 established cannot be honestly made. Returning `201` for a request that creates nothing would restate in the status line exactly what this record removed from the body. When an `EXPORT` row is written under M-15, `201` becomes correct and is what that path should return.
4. **`API-041` remains specified and unimplemented.** It is reachable only via an `export_id`, and no `export_id` is issued, so implementing it now would build a lookup for keys that cannot exist. Regeneration from the analysis id is what an anonymous caller has, and it is exactly `API-040` called again — deterministic, because `DB §4.4` requires generation from immutable artifacts and `SA §3.8` forbids export from altering analysis substance.
5. **The ownership decision path is written now** (D-41 §4.4). The export route reads `Analysis.user_id` and branches on a real owner rather than a placeholder. Today that column is always null, so the branch resolves to "anonymous" from data rather than from a stub, and M-15 supplies an identity rather than a new branch.

## 4. What this costs

**The `API-040` response shape does not match its specification during Sprint 4.** A client written against `docs/07` §6.5 and expecting `export_id` will not find one. That cost is accepted because the alternative shapes are all worse: a fabricated id, a null field that cannot be interpreted, or no export at all.

**`M-4` is unmeasurable, exactly as D-41 §5 already recorded.** This record adds no new measurement cost; it only makes the response consistent with the cost D-41 accepted.

## 5. What closing this requires

When M-15 lands, in this order:

1. Authenticated exports write their `EXPORT` row, and `API-040` returns `export_id` for those.
2. `download_url` becomes constructible, and `API-041` is implemented against real keys.
3. `expires_at` is decided on its merits **or dropped**: D-41 §4.5 resolved `APIQ-2` in favour of a direct response with no stored file, so a lifetime for a document that is regenerated on every request may have nothing to describe. Whether `expires_at` survives is an owner decision, not an implementation detail.
4. Whether anonymous export survives at all remains open, as D-41 §6 left it.

## 6. Non-claims

- This does **not** claim `API-040` is implemented to specification. It is implemented to D-41 plus this record.
- This does **not** claim `API-041` is implemented. It is not.
- This does **not** instrument `M-4`, in whole or in part.
- This does **not** authorise any other endpoint to drop a specified response field.
- **PDF is not delivered in this increment.** `API-040` enumerates `markdown` and `pdf`; only `markdown` is built, and a `pdf` request is refused with a stated corrective action rather than silently returning Markdown under a PDF content type. `docs/08` sanctions Markdown as the fallback, and `SA AQ-3` — the PDF rendering approach — remains open. See `M-13` limitations in `docs/STATUS.md`.
- **`NFR-005` (export p95 ≤ 10s) is unmeasured** and stays unmeasured. No load measurement exists in this project, and none was invented for this increment.
