# Pending recordings — NOT part of the regression corpus

⚠️ **Nothing in this directory is evidence.** The recording store reads
`research/regression-recordings/<corpusVersion>/` and only that. Files here are
invisible to `createRecordingStore`, the manifest gate, coverage computation and
the activation gate — deliberately.

## Why this exists

A recording can be captured before the project is ready to admit it to the
corpus. Admitting one is not a filing decision: it changes what every fragment
composes into, which changes what an existing pass reference is sufficient to
activate.

`ew-001` is the case that made this concrete. It was captured 2026-09-08 against
a real provider (`claude-sonnet-4-5`, $0.1072, adapter `anthropic`) and it is
genuine evidence — but admitting it to the corpus meant:

- every foundation fragment then composes into **14** recorded cases rather
  than 13, so the committed references `4ea7eef7345389e9` and
  `35af47fbdabae5eb` stop being sufficient to activate them; and
- ⚠️ **its own corpus assertions had never been evaluated**, because
  `regression:run` selects `FIRST_VERTICAL` and `ew-001` is `existing_workflow`
  with no special class, so no existing mechanism could run it.

Holding it here kept the evidence without asserting it.

## ✅ `ew-001` WAS ADMITTED — 2026-09-09

**This directory is now empty of recordings, and that is the expected state.**
On the owner's approval `ew-001.json` was moved to
`research/regression-recordings/corpus-v1/` and manifested. Both consequences
above landed exactly as predicted: coverage went 9 → 11 of 15 fragments, and
the two committed references stopped being sufficient for foundation
activation.

⚠️ **Nothing was re-captured and no existing recording was touched.** Byte
identity was verified across the move (`sha256 2fbf851c…`, 22216 bytes,
unchanged), and the manifest diff was a **single insertion**.

The directory is kept, with this README, because the *mechanism* is still
needed: the next capture will land here first, and the reasoning below is what
governs it.

## ⚠️ Do not move a file into the store to "fix" a drift error

Leaving an unmanifested recording inside the store makes
`regression:recordings:check` fail with `unmanifested: <case>`. That check is
correct and is the reason this directory exists. The resolution is a decision
about whether the case belongs in the corpus — never a `regression:recordings:write`
to silence it.

## Contents

| File | Captured | Status |
|---|---|---|
| `ew-001.json` | 2026-09-08 | Real provider evidence. Corpus assertions **unevaluated**. Untracked, held pending a targeted-run mechanism |

## ⚠️ HELD EVIDENCE IS NOW COMMITTED — and it is still NOT canonical

From 2026-09-09 the recordings in this directory are **version-controlled**.
That is a durability decision, not an admission decision: `ew-001` sat untracked
here for a day, and a `git clean -xfd` would have destroyed $0.1072 of paid
evidence that could not be regenerated for free.

⚠️ **Being committed changes nothing about what this evidence proves.** These
files remain invisible to `createRecordingStore()`, the manifest gate, coverage
computation and the activation gate, because those read
`research/regression-recordings/<corpusVersion>/` and only that. A recording
here:

- is **not** in the canonical corpus count;
- is **not** in `research/regression-recordings/corpus-v1/recordings.manifest.json`;
- **cannot** widen coverage or satisfy any activation reference.

`corpus-v1/recordings.manifest.json` **inside this directory** is the holding
area's own integrity record, written by the capture store. It is **not** the
canonical manifest and must never be copied over it.

**Admission is still the separate, deliberate act it always was:** move the file
into `research/regression-recordings/<corpusVersion>/`, then run
`npm run regression:recordings:write` against the canonical store, then re-run
the suite so a fresh reference covers the widened set.
