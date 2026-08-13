# Reasoning prompt fragments

Versioned reasoning assets (`AD-14`, `AI-010`–`AI-014`). **Not application
code** — these are authored here, reviewed as diffs (`FR-019`), and published to
`PROMPT_FRAGMENT_VERSION` in the primary store (`docs/12` D-3). The runtime
resolves content from the database, which is what makes rollback possible
without a deploy (`AI-014`).

## Fragment key

Derived from the path: `prompts/<class>/<name>.md` → `<class>.<name>`.
So `prompts/stage/classification.md` is the fragment `stage.classification`.

The four classes in use map to `PROMPT_FRAGMENT.fragment_class`:
`foundation`, `stage`, `type_modifier` (directory `type/`), and — once artifact
generation exists in Sprint 2 — `artifact` and `output_contract`.

## Composition order (`AI §6.1`)

Foundation (all four, in listed order) → the stage fragment → the type modifier,
once a classification is known → the output contract, once one exists.
Foundation precedes stage guidance so a stage fragment cannot appear to override
a prohibition.

## Changing a fragment

1. Edit the file. The diff is the review surface (`FR-019`).
2. Run `npm run fragments:check` — the manifest gate (`NFR-043`, boundary
   check 7). It fails until `fragments.manifest.json` records the new hash.
3. Run `npm run fragments:publish` to insert a new `PROMPT_FRAGMENT_VERSION`
   row. Rows are append-only (`DP-4`); nothing is edited in place.
4. Activation requires a `regression_pass_reference` — a database CHECK
   constraint, not a convention (`DB §4.5`).

> **Scope note.** The manifest gate detects *that* a fragment changed and forces
> the change through review. It is not the golden-corpus output-regression suite,
> which is a Sprint 2 deliverable. See `docs/12` D-14.
