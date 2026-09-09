# D-74 — The event stream authenticates like every other request

**Date:** 2026-09-10
**Status:** Accepted — closes M-15 limitation 1 (STATUS: "`FR-041` progressive streaming is degraded for owned analyses") without either of the two workarounds it rejected
**Sprint:** 5 (continuation) toward finish line 2 (v1.0)
**Resolves:** `API-025` is owner-scoped since M-15, and the browser's `EventSource` cannot send an `Authorization` header. Every stream against an owned analysis was refused with 401/403 and the UI fell back to the 2-second poll. Since D-67 disables anonymous analysis, **every** production analysis is owned, so on the owner's instance `FR-041` progressive rendering never came from the stream at all — the D-68 processing rail lit from polls
**Affects:** `frontend/src/api/events.ts` (rewritten over `fetch`), `frontend/src/api/sse.ts` (new: the frame parser), `frontend/src/api/analyses.ts` (`analysisAuth` exported), `frontend/src/components/Processing.tsx` (comment); **one backend line** — `routes/analyses.ts` carries Fastify's reply headers onto the raw stream response (§2a). The route already authenticated from the `Authorization` header through the `onRequest` hook, accepted `Last-Event-ID` as a header, and wrote `id:` on every frame; `@fastify/cors` reflects requested headers, so the preflight admits `Last-Event-ID` as it already admitted `Authorization`
**Builds on** M-12 (`API-025` SSE with resumption), M-15 (owner scoping), D-67, D-68.

---

## 1. What changed

`streamAnalysis` opens the stream with `fetch`, presenting the same `Authorization` header every other request sends (session token first, anonymous token otherwise — the one `analysisAuth` predicate `analyses.ts` already had). The `text/event-stream` body is read as bytes and parsed against the SSE grammar; each frame's `id:` is remembered and sent back as `Last-Event-ID` on reconnect, which the server already honours by replaying from that sequence.

What `EventSource` did implicitly is now explicit and bounded:

| Behaviour | `EventSource` | D-74 |
|---|---|---|
| Credential | none possible | `Authorization` header |
| Reconnect on drop | forever | 5 attempts, 2 s apart, then leave the poll to finish |
| Resume | `Last-Event-ID` automatic | `Last-Event-ID` from the last `id:` seen |
| Refused (401/403), expired (410), unavailable (503) | retry loop | close at once; the poll covers all three (`SA AR-06`) |
| Terminal event | close | close, `onClosed(true)` |
| Browser without streaming `fetch` | n/a | `undefined` → poll only |

The two workarounds STATUS rejected remain rejected: nothing goes in the query string, and no cookie is introduced. The credential travels exactly where `API §3.1` puts it.

## 2. What was verified without a browser

The frame parser is a pure module (`sse.ts`) and was exercised directly: whole frames as the server writes them; a frame split across two chunks completed by the next read rather than dropped; comment lines and CRLF tolerated; multi-line `data:` joined per the grammar. The server side is covered by `tests/integration/event-stream-auth.test.ts`: the stream is served to a bearer credential presented as a header, refused without one, and resumes after `Last-Event-ID`.

## 2a. What the browser check found: the stream had no CORS headers

The first browser run against a local replay backend sent the header, the server answered 200 — and the page saw `net::ERR_FAILED` on the request and on all five reconnects. The route writes the stream with `reply.raw.writeHead`, which bypasses every header Fastify had set on the reply, including the `Access-Control-Allow-Origin` that `@fastify/cors` attaches in its hook. A cross-origin browser therefore received the frames and refused to read them.

Production is same-origin (`VITE_API_BASE_URL=""`, one edge), so it would not have hit this; the documented local setup — Vite on 5173 against the API on 3000, `NFR-071`'s "a clean checkout of both halves talks to itself" — always had, for anonymous streams too, and nothing noticed because the owner-scoped refusal arrived first. The fix is one spread: the reply's decided headers are carried into the raw `writeHead`, and the stream's own come after. `event-stream-auth.test.ts` pins that a request from the configured origin gets the allow-origin header back on the stream.

## 3. What is claimed, and what is not

- **Claimed:** a signed-in account now receives the event stream, and the processing rail lights from it. Verified on the built frontend against a local replay backend before deployment, and on production from a real browser after it (D-74 §4).
- **Not claimed:** the two M-12 non-claims stand — resumption after a *forced* disconnect has not been demonstrated on production, and no streaming-versus-polling comparison has been run (STATUS, Important Non-Claims 7).

## 4. Verification

| Check | Result |
|---|---|
| Parser: whole frames, split frames, comments, CRLF, multi-line data | ✅ offline check, 2026-09-10 |
| Server: session bearer served (200, `id:` on every frame); no credential and a stranger's token refused (404, by design — "does not exist" rather than "not yours"); anonymous token still served; `Last-Event-ID: 1` resumes at frame 2 | ✅ `tests/integration/event-stream-auth.test.ts` (5) |
| Built frontend, signed in, local replay backend (`br-001`), every status poll held back 1.4 s so nothing but the stream could have informed the page | ✅ 2026-09-10 — the stream request carried `Authorization: Bearer …`; answered 200 `text/event-stream` with the allow-origin header; the page received 9 frames, ids 1–9, in order (`classification`, `plan`, `artifact`, `understanding`, `reasoning_complete`, `plan`, `artifact`, `artifact`, `complete`), and at 0.7 s the rail showed all five stops "reported complete" before any poll had answered; the client then closed the connection itself on the terminal frame. The analysis view rendered the intent brief, the architecture recommendation and the diagram (D-73) |
| Live, in production, from a real browser | ✅ **Production, 2026-09-10:** deployed as image `47669ecdfaf3` at `df6886f` (outgoing `e9e3f7c75a3b` kept as `rollback-af04454`, edge likewise), live mode unchanged (caps 6.00/50.00, anonymous disabled, allowlist 1 account, key absent from the environment), readiness 200, `schemas check` 8 published and matching. One billed business-requirement analysis (`br-001`, id `81516808-a180-4934-b323-b0ceaac50ad4`) under a temporary allowlisted verification address, removed again the same minute (`deploy/.env` restored byte-for-byte, the address now refused 403): **completed in 140.6 s, 4 provider calls, $0.3741**. The stream request carried the bearer header and was answered 200 `text/event-stream` 5.0 s after submission; the page received 7 chunks carrying 9 frames, ids 1–9 in order, the first at 4.6 s and the last at 140.5 s; at 15 s the rail showed "Read — reported complete, Understand — in progress" and the copy read "following progress live" (the stream's wording, not the poll's); at 45 s four stops lit; the terminal frame closed it. Same-origin, so §2a's CORS fix was not exercised there — it is pinned by test |
| Frontend lint and build | ✅ |
