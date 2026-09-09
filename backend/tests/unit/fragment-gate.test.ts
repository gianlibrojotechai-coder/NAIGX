/**
 * Unit — the fragment change gate (`NFR-043`, `AD-14`, boundary check 7).
 *
 * `NFR-043`: "A regression suite of fixed inputs exists and runs before any
 * template change ships." This is the **change-detection half** of that: a
 * fragment cannot be edited without the edit being recorded in the manifest,
 * and therefore without appearing in review (`FR-019`).
 *
 * It is deliberately not the golden-corpus output regression suite, which is a
 * Sprint 2 deliverable (`Roadmap` Sprint 2, `docs/12` D-14). What it does
 * guarantee today is that no fragment reaches the database unreviewed — and,
 * with `DB §4.5`'s activation CHECK, that no version becomes active without a
 * recorded passing run of whatever gate exists.
 *
 * Needs no database and no network, so it runs on every build.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildManifest,
  detectDrift,
  hashContent,
  isClean,
  readAuthoredFragments,
  type FragmentManifest,
} from "../../src/fragments/source.js";
import {
  composePrompt,
  FOUNDATION_FRAGMENT_KEYS,
  STAGE_FRAGMENT_KEYS,
  TYPE_MODIFIER_FRAGMENT_KEYS,
} from "../../src/nie/prompt.js";

const PROMPTS_ROOT = path.resolve(import.meta.dirname, "../../../prompts");
const MANIFEST_PATH = path.join(PROMPTS_ROOT, "fragments.manifest.json");

const manifest = (): FragmentManifest =>
  JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as FragmentManifest;

test("every authored fragment matches its recorded hash", () => {
  const fragments = readAuthoredFragments(PROMPTS_ROOT);
  const drift = detectDrift(fragments, manifest());

  assert.ok(
    isClean(drift),
    `Fragment drift — run \`npm run fragments:write\` after reviewing:\n` +
      `  changed: ${drift.changed.join(", ") || "none"}\n` +
      `  added:   ${drift.added.join(", ") || "none"}\n` +
      `  removed: ${drift.removed.join(", ") || "none"}`,
  );
});

test("the gate detects a changed fragment", () => {
  // The gate is worthless if it cannot fail. Proven against a mutated copy
  // rather than by mutating the repository.
  const fragments = readAuthoredFragments(PROMPTS_ROOT);
  const first = fragments[0];
  assert.ok(first);

  const mutated = [
    { ...first, contentHash: hashContent(`${first.content}\nedited`) },
    ...fragments.slice(1),
  ];
  const drift = detectDrift(mutated, manifest());
  assert.deepEqual(drift.changed, [first.fragmentKey]);
  assert.equal(isClean(drift), false);
});

test("the gate detects an added or removed fragment", () => {
  const fragments = readAuthoredFragments(PROMPTS_ROOT);

  const added = detectDrift(
    [
      ...fragments,
      {
        fragmentKey: "stage.smuggled",
        fragmentClass: "stage",
        content: "x",
        contentHash: hashContent("x"),
        sourcePath: "prompts/stage/smuggled.md",
      },
    ],
    manifest(),
  );
  assert.deepEqual(added.added, ["stage.smuggled"]);

  const removed = detectDrift(fragments.slice(1), manifest());
  assert.deepEqual(removed.removed, [fragments[0]?.fragmentKey]);
});

test("every fragment the composer requires exists", () => {
  // The composer resolves by key; a missing file is a runtime halt. Catching it
  // here means the failure surfaces in review, not mid-analysis.
  const authored = new Set(
    readAuthoredFragments(PROMPTS_ROOT).map((f) => f.fragmentKey),
  );

  const required = [
    ...FOUNDATION_FRAGMENT_KEYS,
    ...Object.values(STAGE_FRAGMENT_KEYS),
    ...Object.values(TYPE_MODIFIER_FRAGMENT_KEYS).filter(
      (key): key is string => key !== null,
    ),
  ];

  for (const key of required) {
    assert.ok(authored.has(key), `composer requires fragment "${key}"`);
  }
  // Stage 9 registers per generator (`AID-08`), so one stage key is
  // `portfolio_suggestions` rather than a shared `artifact_generation`. Stage 6
  // does the same for the same reason (`docs/15` D-40): `workflow_review` and
  // `architecture_analysis` are two jobs with two prompts, never one.
  assert.equal(required.length, 16, "4 foundation + 8 stage + 4 type modifier");
});

test("fragment classes map onto the DB §4.5 vocabulary", () => {
  const allowed = new Set([
    "foundation",
    "stage",
    "type_modifier",
    "artifact",
    "output_contract",
  ]);
  for (const fragment of readAuthoredFragments(PROMPTS_ROOT)) {
    assert.ok(
      allowed.has(fragment.fragmentClass),
      `${fragment.sourcePath} has class "${fragment.fragmentClass}"`,
    );
  }
});

test("hashing is line-ending independent", () => {
  // Otherwise the gate fails on Windows checkouts for a reason unrelated to
  // reasoning, and contributors learn to ignore it.
  assert.equal(hashContent("a\nb"), hashContent("a\nb"));
  const fragments = readAuthoredFragments(PROMPTS_ROOT);
  for (const fragment of fragments) {
    assert.ok(!fragment.content.includes("\r"), fragment.sourcePath);
  }
});

test("the manifest is rebuildable and stable", () => {
  const fragments = readAuthoredFragments(PROMPTS_ROOT);
  const rebuilt = buildManifest(fragments, manifest().version);
  assert.deepEqual(rebuilt.fragments, manifest().fragments);
});

// --- type modifiers are path framing, not stage instructions -------------

/**
 * `AI §6.2` defines a type modifier as **"Path-specific framing"**, changing
 * only "when Path changes". It is composed into *every* stage that runs after
 * classification, so anything stage-specific inside one leaks into stages it
 * was never written for.
 *
 * That is not hypothetical. The first real Stage 6 run failed because the
 * business-requirement modifier — authored while only Stages 1-3 existed —
 * ended the architecture prompt with Stage 3 categorisation guidance, in the
 * recency position immediately before generation.
 */
const typeModifiers = () =>
  readAuthoredFragments(PROMPTS_ROOT).filter(
    (f) => f.fragmentClass === "type_modifier",
  );

test("a type modifier exists for every classified path", () => {
  const authored = new Set(typeModifiers().map((f) => f.fragmentKey));
  const required = Object.values(TYPE_MODIFIER_FRAGMENT_KEYS).filter(
    (key): key is string => key !== null,
  );
  assert.equal(required.length, 4);
  for (const key of required) {
    assert.ok(authored.has(key), `missing type modifier "${key}"`);
  }
});

test("no type modifier carries Stage 3 context-element categorisation", () => {
  // The six `AI §5.3` categories are Stage 3's vocabulary. Naming one as a
  // category — the backticked form the stage fragment uses — instructs the
  // model to produce context elements, whichever stage is running.
  const categories = [
    "constraint",
    "environment",
    "scale",
    "dependency",
    "system",
    "objective",
  ];
  for (const fragment of typeModifiers()) {
    for (const category of categories) {
      assert.ok(
        !fragment.content.includes(`\`${category}\``),
        `${fragment.sourcePath} categorises as \`${category}\` — Stage 3 guidance`,
      );
    }
  }
});

test("no type modifier carries provenance-extraction instructions", () => {
  // Provenance discipline belongs to the shared foundation fragment and to
  // Stage 3. A path modifier that repeats it pushes every later stage toward
  // element extraction.
  const provenanceTerms = [
    "source_quote",
    "source_span",
    "`stated`",
    "`inferred`",
    "`unknown`",
    "provenance",
  ];
  for (const fragment of typeModifiers()) {
    for (const term of provenanceTerms) {
      assert.ok(
        !fragment.content.toLowerCase().includes(term.toLowerCase()),
        `${fragment.sourcePath} contains provenance instruction "${term}"`,
      );
    }
  }
});

test("no type modifier dictates an output shape or names a stage", () => {
  // Output shape is the stage fragment's job. A modifier that also specifies
  // one competes with whichever stage it lands in.
  const stageSpecific = [
    "Respond with",
    "JSON",
    "{",
    "specificity_score",
    "grounded_in_context_indices",
    "sufficiency",
    "candidate_types",
    "determined_type",
    "STAGE ",
    "Stage 1",
    "Stage 2",
    "Stage 3",
    "Stage 6",
  ];
  for (const fragment of typeModifiers()) {
    for (const marker of stageSpecific) {
      assert.ok(
        !fragment.content.includes(marker),
        `${fragment.sourcePath} contains stage-specific text "${marker}"`,
      );
    }
  }
});

test("each type modifier still frames its own path distinctly", () => {
  // Stage-neutral must not mean interchangeable: `AI §4.2` says the frame
  // changes intent priors, what counts as relevant, and what the path produces.
  const byKey = new Map(typeModifiers().map((f) => [f.fragmentKey, f.content]));

  assert.match(
    byKey.get("type.job_description") ?? "",
    /produces no architecture/i,
    "AI §4.1: a job description generates no architecture",
  );
  assert.match(
    byKey.get("type.assessment") ?? "",
    /rejected alternatives/i,
    "AI §9.1: assessment feedback names at least one rejected alternative",
  );
  assert.match(
    byKey.get("type.existing_workflow") ?? byKey.get("type.workflow") ?? "",
    /already runs|already have/i,
    "AI §4.1: the workflow path reviews something that exists",
  );
  assert.match(
    byKey.get("type.business_requirement") ?? "",
    /no existing automation|nothing has been built/i,
    "AI §4.1: a requirement describes a need without an implementation",
  );

  // All four distinct.
  assert.equal(new Set([...byKey.values()]).size, 4);
});

// --- Stage 6 receives appropriate path framing ---------------------------

/** Resolves fragments straight from `prompts/`, so this needs no database. */
const authoredResolver = {
  resolve: (keys: readonly string[]) => {
    const byKey = new Map(
      readAuthoredFragments(PROMPTS_ROOT).map((f) => [f.fragmentKey, f]),
    );
    return Promise.resolve(
      keys.map((fragmentKey) => {
        const fragment = byKey.get(fragmentKey);
        if (fragment === undefined) {
          throw new Error(`no authored fragment "${fragmentKey}"`);
        }
        return {
          fragmentKey,
          fragmentVersionId: `authored:${fragmentKey}`,
          version: "authored",
          content: fragment.content,
        };
      }),
    );
  },
};

test("Stage 6 composes its own output shape plus path framing", async () => {
  // The failure this guards: the composed prompt used to END with Stage 3
  // categorisation guidance, in the recency position right before generation.
  const prompt = await composePrompt(
    { stageKey: "architecture_analysis", classifiedAs: "business_requirement" },
    authoredResolver,
  );

  // The architecture-producing paths both reach Stage 6 (`AI §9.1`).
  assert.match(prompt.instructions, /STAGE 6 — ARCHITECTURE ANALYSIS/);
  assert.match(prompt.instructions, /"summary"/, "the stage owns the shape");
  assert.match(prompt.instructions, /grounded_in_context_indices/);

  // The path modifier is present and is the last fragment (`AI §6.1` order).
  assert.match(prompt.instructions, /PATH MODIFIER — BUSINESS REQUIREMENT/);
  assert.equal(
    prompt.fragments[prompt.fragments.length - 1]?.fragmentKey,
    "type.business_requirement",
  );

  // ...and what it says there does not compete with the stage.
  const modifier = prompt.fragments[prompt.fragments.length - 1]?.content ?? "";
  for (const category of ["`environment`", "`objective`", "`constraint`"]) {
    assert.ok(
      !modifier.includes(category),
      `the last thing Stage 6 reads must not categorise as ${category}`,
    );
  }
  assert.ok(
    !modifier.includes("Respond with"),
    "only the stage fragment dictates the response",
  );
});

test("Stage 6 composes for the assessment path too", async () => {
  const prompt = await composePrompt(
    { stageKey: "architecture_analysis", classifiedAs: "technical_assessment" },
    authoredResolver,
  );
  assert.match(prompt.instructions, /STAGE 6 — ARCHITECTURE ANALYSIS/);
  assert.match(prompt.instructions, /PATH MODIFIER — TECHNICAL ASSESSMENT/);
  assert.match(prompt.instructions, /rejected alternatives/i);
});

test("the same modifier serves Stage 3 without dictating to it", async () => {
  // The point of stage-neutrality: one modifier, many stages, no competition.
  const stage3 = await composePrompt(
    { stageKey: "context_extraction", classifiedAs: "business_requirement" },
    authoredResolver,
  );
  const stage6 = await composePrompt(
    { stageKey: "architecture_analysis", classifiedAs: "business_requirement" },
    authoredResolver,
  );

  assert.match(stage3.instructions, /STAGE 3 — CONTEXT EXTRACTION/);
  assert.match(stage3.instructions, /PATH MODIFIER — BUSINESS REQUIREMENT/);

  const modifierIn = (text: string) =>
    text.slice(text.indexOf("PATH MODIFIER — BUSINESS REQUIREMENT"));
  assert.equal(
    modifierIn(stage3.instructions),
    modifierIn(stage6.instructions),
    "one modifier, unchanged, valid for both stages",
  );
});
