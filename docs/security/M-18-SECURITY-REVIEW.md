# M-18 — Security review against `PRD §9.3`

**Date:** 2026-09-07
**Reviewed at:** commit `4b138ba` (Sprint 5, after M-17)
**Scope:** `NFR-020` – `NFR-027`, and the surfaces M-15/M-16 added
**Milestone criterion:** *"Review complete; no unresolved high-severity findings"* (`AC-026`)

---

## ⚠️ What this review is worth

**It was performed by the same agent that wrote the code.** That is a real
limitation on its weight and it is stated first rather than in a footnote: an
author reviewing their own work shares its blind spots by construction, and the
findings below are the ones visible from inside the assumptions that produced
them.

No project document forbids this — `docs/10` §4.3 excludes AI review for the
*reasoning rubric* specifically, and nothing extends that to `M-18`. So this
review is admissible. It is not equivalent to an independent one, and
`AC-026`'s "review completed" should be read against that.

**One thing this review can claim without qualification:** the `NFR-027`
finding was reproduced, fixed, and the fix verified by test. That is evidence
regardless of who found it.

---

## Verdict

**M-18 does not pass.** Its criterion is "no unresolved high-severity
findings", and finding **H-2** is unresolved and cannot be resolved in this
milestone.

> **Amended 2026-09-08:** H-2's requirement label was corrected (see the
> finding). The verdict is unchanged.
>
> **Amended 2026-09-10 (corrected the same day).** An earlier amendment this morning called H-2 resolved and the criterion met; that overstated what [D-61](../36-D-61-Host-Held-Key-File.md) supports, and D-61 §7 says so itself: *"M-18 remains not passed on its own terms and this record does not close it."* The precise position:
>
> - **The mechanism H-2 named is implemented and verified.** The three `DB §13.1` row-3 fields are sealed at the application layer (D-53, D-61); the fail-closed key-permission tests ran on the VPS with zero skips (D-61 §8); production logs `Field encryption active`; both restore drills decrypted the fields. This is evidence, not a description change.
> - **The key-management condition H-2 stated is NOT met by mechanism.** `DB §13.1` requires "keys: managed key service; never in application configuration", and this finding said it "must not be closed by encrypting with a locally-held key and calling it done". D-61 replaced the managed key service with a host-held `0400` key file — never in application configuration, backed up separately — and recorded that as an **explicit v1.0 deviation** from `DB §13.1`, with the reasoning and the revisit triggers. So H-2 is *resolved with a recorded deviation* (D-61 §7), which is a different state from resolved: the deviation stands until the owner ratifies D-61's amendment of `DB §13.1` (listed in D-61 as an authoritative amendment to ratify), or an independent reviewer accepts it.
> - **Therefore M-18 is NOT PASSED.** Its criterion is "no unresolved high-severity findings"; H-2 is unresolved-by-deviation pending an owner decision, and this review is a self-review (see above). The four medium and two low findings stand as recorded.
> - **`NFR-021` (full-volume encryption at rest) is a separate requirement and is UNMET.** Checked on the VPS 2026-09-10: the root filesystem is plain `ext4` on `sda1`, no `crypttab`, no dm-crypt device, and Docker's data lives on that root filesystem. Meeting it is host work — an encrypted data volume or a re-provision with disk encryption — not application code, and D-53 §3 says what such encryption on rented infrastructure is worth even when done.

| Severity | Count | State |
|---|---|---|
| High | 2 | 1 fixed, **1 unresolved** |
| Medium | 4 | 0 fixed — all deferred with recorded rationale |
| Low | 2 | 0 fixed — accepted |

---

## High

### H-1 — Untrusted content reached a rendering context unescaped · `NFR-027` · **FIXED**

`renderExportHtml` passed artifact content through `marked`, which emits raw
HTML by default. Artifact content is model output derived from the user's own
submitted text, so this is a reachable path rather than a hypothetical one: an
input that induces markup in an artifact, then a PDF export, and it renders.

**Why the context makes it worse.** `export/pdf.ts` launches Chromium with
`--no-sandbox` (required to run as root in a container). Script execution there
is unsandboxed script execution on the server.

**Reproduced.** Six vectors were live before the fix:

| Vector | Before |
|---|---|
| Block `<script>` | executed |
| Block `<img onerror>` | executed |
| **Inline** `<img onerror>` | executed |
| Inline `<script>` | executed |
| `<iframe src=file://>` in a table cell | rendered |
| `[text](javascript:…)` | live link |

**Fixed** by escaping block HTML in the renderer, refusing the inline-HTML
tokenizer match, and restricting link schemes to `https`, `http`, `mailto`,
fragments and relative paths. Escaped rather than stripped, so a user who wrote
`<thing>` still sees it.

⚠️ **A renderer-only fix would have missed the inline case**, which is how this
class of bug usually survives its first repair — inline HTML comes from a
separate tokenizer. Six regression tests in `tests/unit/export-html.test.ts`
cover each vector, including one asserting that ordinary `https` links still
work, because a fix that breaks legitimate links gets reverted.

### H-2 — No application-level encryption of confidential content · `DB §13.1` row 3 · **UNRESOLVED**

> ⚠️ **Corrected 2026-09-08.** This finding was originally labelled `NFR-021`.
> That was wrong, and the correction is left visible rather than quietly
> applied. `NFR-021` is *"stored analysis content encrypted at rest"*, which
> `DB §13.1` maps to **full-volume** encryption; the application-level layer is
> a separate row of that table carrying **no requirement number**.
> [D-53](../28-D-53-Encryption-Layers.md) §1 sets out the split.
>
> **The finding and the verdict are unchanged** — both layers are
> unimplemented, so H-2 stands and M-18 remains not passed. What the mislabel
> got wrong was the cost: it made one blocker look like a single expensive
> problem, when it is a free one (`NFR-021`, an encrypted volume) and a
> $1/month one (row 3, a managed key service).

`DB §13.1` requires application-level encryption on the three
highest-sensitivity fields — `raw_content`, `structured_input`,
`structured_output` — "so that a storage-layer compromise does not yield
plaintext business content". `AnalysisInput.rawContent` is annotated
*"Classified Confidential business (§13.2) — application-level encryption"*.

**None is implemented.** All three are stored as plaintext. `raw_content` is
the user's submitted document; the two trace fields are full stage inputs and
outputs.

**Why it is not fixed here.** `DB §13.1` also specifies *"Keys: managed key
service; never in application configuration"*. There is no key service and no
deployment (`M-19` untouched), so the only implementation available today would
put a key in `.env` — which the requirement names as the thing not to do, and
which would make the encryption a gesture: an attacker with the database
usually has the configuration too.

`DBQ-8` deferred the *scope* question and recorded that only Confidential
business fields need it. It did not defer the mechanism, and the mechanism is
absent.

**This is the finding that fails M-18.** It should be resolved with `M-19`,
where key management becomes a real option, and it must not be closed by
encrypting with a locally-held key and calling it done.

---

## Medium

### M-1 — No transport encryption · `NFR-020` · deferred to `M-19`
Nothing is deployed; there is no TLS termination, and `HOST` binds `0.0.0.0`
with no env override (already recorded in `STATUS.md`). Unmeetable before a
deployment exists.

### M-2 — Rate limiting does not compose across instances · `NFR-025`/`NFR-051` · [D-46](../21-D-46-In-Memory-Rate-Limiting.md)
Counters live in process memory, so a fleet of `N` enforces `N ×` the limit.
`R-13` ties rate limiting to bounding provider spend. **Recorded before this
review rather than found by it**, which is the outcome D-46 §3 intended.

### M-3 — Single shared operator credential · [D-48](../23-D-48-Operator-Authentication.md)
One secret, no rotation, no per-operator attribution: an audit event records
*that* an operator read metrics, never which one. Also recorded in advance.
With one operator this records nothing; with a team it would matter.

### M-4 — `--no-sandbox` in the PDF renderer · [D-43](../18-D-43-PDF-Rendering-Approach.md)
Required to run as root in a container. It is defence-in-depth that H-1 was
relying on, and H-1's fix does not remove the need for it. **Recommendation:**
at `M-19`, run the application as a non-root user and drop the flag. The page
already makes no network requests — every request is aborted — so the residual
exposure is a rendering engine parsing content this server produced.

---

## Low

### L-1 — Deletion instruction is lost on restart
The trace-purge queue is in-process, so a restart between the primary-store
commit and the purge leaves traces the user asked to be deleted. Bounded by
`DB §8.3`'s 7-day trace expiry, so the worst case is delay rather than
indefinite retention. Already recorded; closes with a durable queue at `M-19`.

### L-2 — `dangerouslySetInnerHTML` in the diagram view
`MermaidDiagram.tsx` mounts Mermaid's SVG output, and there is no other way to
mount an SVG string. Mermaid runs with `securityLevel: "strict"`, which
sanitizes labels. **The residual risk is that this trusts Mermaid's sanitizer**
— accepted, because the alternative is not rendering diagrams, and because the
input to it is a diagram this system generated from its own architecture
components rather than arbitrary user markup.

---

## What was checked and found sound

| Requirement | Finding |
|---|---|
| `NFR-022` credential hashing | `scrypt` with per-value salt, constant-time compare, algorithm named in the stored value. Timing-equivalence on the missing-user path is tested |
| `NFR-023` provider keys server-side | No route reads `config.provider`; `AppConfig` is never serialised into a response. Verified by search |
| `NFR-026` server-side authorization | One predicate, applied on every guarded endpoint, tested including cross-user and anonymous cases. 404 rather than 403 so the id space is not an oracle |
| Token handling | Stored hashed, never raw; refresh reuse revokes the family; a refresh token cannot authenticate a resource route (structurally, not by a check) |
| Audit logging | No field can hold user business content; `user_id` nullified rather than cascaded on deletion |
| Operator surface | Refuses user tokens, anonymous tokens, missing and malformed credentials; the secret never appears in a refusal; absent configuration disables the surface |
| Frontend token storage | In memory, not `localStorage` — an XSS cannot exfiltrate a session that outlives the tab |

---

## Recommendations, in order

1. **`M-19`: implement both encryption layers** — an encrypted volume for
   `NFR-021` (free) and application-level envelope encryption for `DB §13.1`
   row 3 (a managed key service, ~$1/month). **Both** are required to close
   H-2 and unblock `M-18`; see [D-53](../28-D-53-Encryption-Layers.md) and
   [D-52](../27-D-52-Managed-Key-Service.md).
2. **`M-19`: run as non-root and drop `--no-sandbox`** (M-4).
3. **`M-19`: TLS, a shared rate-limit store, and a durable purge queue** —
   M-1, M-2, L-1.
4. **Before beta: an independent security review.** This one is admissible and
   not independent, and `PRD §14.1`'s evidential bar is the place that
   distinction should be settled.

---

## Non-claims

- This does **not** establish that the system is secure. It establishes that
  eight named requirements were examined and what was found.
- This is **not an independent review**, and must not be reported as one.
- **`M-18` is not passed.** H-2 is unresolved and its own criterion forbids it.
- No penetration testing, dependency-vulnerability scanning, or threat
  modelling was performed. Each is a separate exercise.
- The Medium and Low findings were, with one exception, recorded in decision
  records *before* this review. That is the intended outcome — a review should
  confirm known gaps, not discover them — but it also means this review
  surfaced fewer new findings than a first review of unfamiliar code would.
