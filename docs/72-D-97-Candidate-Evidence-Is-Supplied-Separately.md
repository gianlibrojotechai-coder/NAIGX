# D-97 — The job-description path is told the candidate's evidence is supplied separately

**Date:** 2026-10-02
**Status:** Accepted — on the owner's "go" to the second defect scoped in [D-96 §4](71-D-96-Scaffold-Maps-Against-The-Catalogue.md), within a $3.00 ceiling
**Sprint:** 5 (continuation), finish line 1 (D-67)
**Resolves:** an analysis saying "the candidate's own background is not supplied" in its scope and unknowns while its verdict cites the capability profile throughout
**Affects:** `prompts/type/job_description.md` (**a fragment change** — the D-63/D-64 route), `prompts/fragments.manifest.json`, the two canonical job-description recordings (`jd-002`, `jd-008`, recaptured), `research/regression-superseded/`. **No code, schema, API or requirement change.**
**Builds on** D-70 (the route a fragment change takes), D-63/D-64 (authored resolution and pass-reference composition), D-91 (sample variance).

---

## 1. The defect

The owner's analysis `704fc3b1` (2026-10-02, a Shopify / CRM / attribution
posting) said in its Stage 2 scope that "the submitter's own background is
not supplied, so any gap analysis depends on information the candidate must
provide", and listed the same thing in its unknowns table with a question to
ask the candidate. Its Stage 7 verdict then weighed nine capabilities from
the capability profile. Both statements were honest from where each stage
stood: Stages 2 and 3 see the posting only; the profile reaches the pipeline
at Stage 7. Read together in one document they contradict each other, and a
reader — the owner showing it to a client — would conclude the tool was
confused about its own inputs.

## 2. The change

One paragraph added to the job-description path modifier, which composes into
every stage after classification on that path:

> The candidate's own evidence is not in the posting and is not expected to
> be: it is supplied separately, to the stage that weighs it, as a capability
> profile. Its absence from the input is therefore not a limit on scope and
> not an unknown. An unknown on this path is something the posting leaves
> unsaid about the role, the employer or the hiring process — never the
> candidate's background, experience or portfolio.

It says what is true at every stage it reaches: at Stages 2 and 3 the profile
is elsewhere, at Stages 7 and 9 it is in the request.

## 3. The route, and what it cost

| Step | Result |
|---|---|
| Fragment edited; `fragments:check` refuses; `fragments:write` records the new hash; `check` clean | ✅ 23 fragments match the manifest |
| Dry run of the capture path for both cases | ✅ 12 calls, $0.00 |
| **Paid capture**, held outside the canonical store, `--budget=3.00`, on `claude-sonnet-5` at medium effort (the model the canonical recordings were captured on) | ✅ `jd-002` $0.2747, `jd-008` $0.2408 — **$0.5154 of the $3.00 ceiling** |
| The fix, read in the held answers before admission | ✅ neither scope nor unknowns mentions the candidate's background in either case |
| `evaluate` on the held recordings | ✅ 2 passed: classification, artifact set, confidence band `high` (0.868, 0.915), confidence bound, run completeness, artifact generation, reference integrity |
| Admission — a decision, recorded here | ✅ the two prior recordings moved to `research/regression-superseded/…-pre-D-97-2026-10-02.json` with their reason; new recordings admitted; `recordings:write`, `recordings:check` clean (15) |
| Targeted run `--fragment=type.job_description` | ✅ 2 passed → **`corpus-regression:corpus-v3+fragments-v1:8a1361a151cba5ca`** (`research/regression-runs/8a1361a151cba5ca.json`) |
| Full backend gate | ✅ typecheck clean, 1,069 passing, 95 skipped |
| Production: fragment activated under the reference; one live job-description run shows no "background not supplied" | ⏳ §4 |

⚠️ **What the corpus did and did not show.** Neither corpus case exhibited
the wording before the change — their scopes and unknowns never mentioned
the candidate — so the recapture proves the paragraph does no harm on two
recorded postings, not that it cures the live one. The cure is evidenced only
by the next live run on a posting like the owner's (§4).

## 4. Production

From the new image: `fragments publish -- --reference=corpus-regression:corpus-v3+fragments-v1:8a1361a151cba5ca`
(one new version expected, 22 unchanged), then the backend recreated so it
resolves the new active version. Rollback is the previous active version of
`type.job_description`, which a publish never deletes (`DP-4`, append-only).
