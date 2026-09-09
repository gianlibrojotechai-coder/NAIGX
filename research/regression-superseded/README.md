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
