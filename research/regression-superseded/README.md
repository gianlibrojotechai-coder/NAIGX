# Superseded recordings — replaced, not withdrawn, not deleted

A recording lands here when the **same case** has been re-captured and the newer
recording admitted in its place. The case remains evidenced; only which
recording evidences it has changed.

⚠️ **This is a different thing from `research/regression-withdrawn/`.** A
withdrawn recording's composition is *stale against the candidate*, so it could
not be evidence for anything and its case left the evidenced set. A superseded
recording was perfectly valid — it simply is no longer the best evidence
available for its case.

Files here are invisible to `createRecordingStore`, the manifest gate, coverage
computation and the activation gate, which read
`research/regression-recordings/<corpusVersion>/` and only that. Nothing here
counts toward coverage.

Names carry the original `capturedAt`, so repeated supersession of one case
never collides and the order is readable from the filenames.

## Superseded 2026-09-09

| File | Why it was replaced |
|---|---|
| `jd-002-2026-09-09T06-23-33-503Z.json` | A valid `apply_now` run: 4 stages, terminal `recommendation_generation`, all four supported assertions passing, composition `6fee0b11ff3fac3e`. It was replaced by a `build_first` capture of the same case that reaches **Stage 9**, and `stage.portfolio_suggestions` is composed on no other recording in the corpus |

⚠️ **The replacement is not "a better answer" — it is a different reachable
outcome of the same input.** jd-002 has produced `build_first`, then
`apply_now`, then `build_first` from identical text, with nine technical
requirements extracted every time. Only the build path reaches Stage 9, so only
it can evidence `stage.portfolio_suggestions`. The variance itself is `FR-024`
behaviour and is tracked separately; this file is what that variance looked like
on the run that did not reach Stage 9.

Keeping it matters for exactly that reason: it is the evidence that the corpus's
coverage of `stage.portfolio_suggestions` rests on a non-deterministic verdict,
and a future reader comparing the two recordings can see it directly.

## `jd-002-pre-D-70-2026-09-10.json` — superseded by the D-70 capture

The `build_first` jd-002 recording that carried `stage.portfolio_suggestions`
under the fragment as it stood before D-70 (composition `1d9880fe…`). D-70
changed that fragment and the portfolio artifact schema (v2), so this
recording no longer reproduces the composition the deployment asks for and
was reported `excluded` by the replay loader — the gate working as designed
(D-64 §4.2). Replaced in the canonical store by a capture against the
candidate composition (Opus 5, high effort, $0.4965), whose Stage 9 output
carries the `implementation` block. Kept here because it is the evidence the
earlier pass reference `d4abcd42626452df` rested on for this fragment.

## Superseded 2026-09-10 — D-76, the interview-guidance generator

| File | Why it was replaced |
|---|---|
| `jd-002-pre-D-76-2026-09-10.json` | The D-70 `build_first` capture (five stages, terminal `portfolio_suggestions`, composition `cfa5d7e5…`). Valid, and still reproducing its composition — but the job-description path gained a second Stage 9 generator (`stage.interview_guidance`, D-76), and a recording with no fixture for it evidences a path that no longer exists. Replaced by a capture of the same case that reaches both generators (six stages, $0.2463, Sonnet 5 medium) |
| `jd-008-pre-D-76-2026-09-10.json` | The `apply_now` capture (four stages, terminal `recommendation_generation`). Same reason: on `apply_now` the path now generates the interview guidance too. Replaced by a five-stage capture ($0.1852) |

⚠️ **A finding, recorded.** Before these were replaced, `regression:run` on the two old recordings **passed** against the new pipeline — `run_completeness` is judged against the stages a recording holds, so a stage *added* to a path is invisible to it, and `composition_mismatch` compares only the compositions of recorded stages. A new stage therefore does not invalidate an old recording the way a changed fragment does. Both old recordings were replaced regardless; the gap in the gate is noted in `docs/51` D-76 §4.
| `jd-002-D-76-first-capture-2026-09-10.json` | The first D-76 capture of `jd-002` (six stages, $0.2463). Admitted, then found — by `tests/unit/replay-corpus.test.ts` test 3, not by the gate — to carry a **portfolio answer the parser rejects**: a second project named "(merged) — no standalone project required" claiming a subset of the first's gaps, which `FR-022`'s redundancy rule refuses. The capture tool records provider responses whether or not the artifact parsed, and `artifact_set` is a deferred assertion, so the targeted run (`19f89fb8a3433584`) and the fifteen-case run (`b539f5bccb7c0581`) both passed on it. Replaced the same hour by a second capture ($0.2244) whose single project the parser accepts; the references in force are `be3b5a805ba95031` (targeted) and `0294795b4da49f78` (fifteen cases). The two earlier run records are left in place as the history of what was measured |

## Superseded 2026-09-10 — D-78, the Stage 6 disposition field and the platform generator

| File | Why it was replaced |
|---|---|
| `br-001` … `br-011` (nine files, `-pre-D-78-2026-09-10.json`) and `ta-005-pre-D-78-2026-09-10.json` | Valid recordings of the previous Stage 6 fragment. D-78 changed `stage.architecture_analysis` on every architecture-producing path (the `unknown_disposition` section, closing D-38) and added the requirement path's `stage.platform_recommendation` generator, so none of them reproduced the new composition and the requirement ones lacked a Stage 9 answer. Replaced by one campaign of ten captures, Sonnet 5 medium, **$1.1669** under a $6.00 ceiling; every planned artifact generated; every unknown disposed of exactly once (2–6 per case); the platform answers varied — Zapier, Make (×3), Microsoft Power Automate (×2) and **no platform (×2)** — which is the `AC-014` evidence FR-034 asks for |
| `br-005-D-78-first-capture-2026-09-10.json` | The campaign's br-005 capture: three stages, halting at Stage 3 as the case expects, but its Stage 1 answer scored **0.55** against the corpus's ≥0.6 bound. Stage 1's fragment is unchanged, so this is sampling variance, not a regression; recaptured once ($0.0359, confidence 0.75) rather than admitted with a failing assertion. References in force: `0e66d334d6693c34` (targeted, platform), `6d77a360c6175f97` (targeted, architecture), **`420014f023f83f7c`** (fifteen cases) |

## Superseded 2026-09-10 — D-79, the requirement path's risk register

| File | Why it was replaced |
|---|---|
| `br-001`, `br-002`, `br-003`, `br-004`, `br-007`, `br-009`, `br-010`, `br-011` (`-pre-D-79-2026-09-10.json`) | The D-78 recordings. D-79 added the requirement path's second Stage 9 generator (`stage.risk_assessment`) and tightened two fragments (`risk_assessment`: attribute a risk in an unnamed system to the component that would bear it; `platform_recommendation`: `also_required` is empty when no platform is recommended), so none reproduced the new composition. Replaced across three campaigns — **$1.0597 + $1.2264 + $0.3202 = $2.6063** under ceilings of $4.00 and $3.00 — after the first campaign's failures were diagnosed from their quarantined responses: two risk registers naming a part the design did not have (one a shortened external-system name, now tolerated by the parser as a naming near-miss; one an "unnamed system", now addressed in the fragment), one platform answer with companion platforms beside a null recommendation (now stated in the fragment), and four Stage 1/Stage 3 sampling failures (a mis-quoted span twice, an unexpected insufficiency halt, a 0.55 confidence). `br-005` was **not** recaptured: it halts at Stage 3 and composes no Stage 6 or Stage 9 fragment, so the D-78 recording still reproduces its composition |

References in force after D-79: `1d0a62c31922f865` (targeted, risk register), `4c4bd135f0b5fca9` (targeted, platform), **`f3a702e5885ca15c`** (fifteen cases).

## Superseded 2026-09-10 — D-80, the complexity score

| File | Why it was replaced |
|---|---|
| `br-001`, `br-002`, `br-003`, `br-004`, `br-005`, `br-007`, `br-009`, `br-010`, `br-011` (`-pre-D-80-2026-09-10.json`) | The D-79 recordings (and, for `br-005`, the D-78 one). D-80 added the requirement path's third Stage 9 generator (`stage.complexity_assessment`), so a recording with no fixture for it evidences a path that no longer exists — the gap the D-76 finding above describes, which is why every requirement case was recaptured rather than only the ones a changed fragment would have invalidated. Replaced by one campaign of ten captures, Sonnet 5 medium, **$1.7242** under a $4.00 ceiling; 10 captured, 0 failed; every planned artifact generated on every case (six on each requirement case, one on `br-005`, which halted at Stage 3 as the case expects with a 0.62 confidence, at the bound this time); read-only evaluation 10 of 10 before admission |
| `ew-001-pre-D-80-2026-09-10.json` | The workflow path's recording, which reached the review and rendered its two artifacts with no Stage 9 at all. Since D-80 the path scores the submitted workflow's complexity at Stage 9 (its first generator). Replaced by a capture of the same case that reaches it (four artifacts generated, $0.1248) |
