/**
 * Fragment → case coverage (`docs/12` D-30 decision 3).
 *
 * D-30 made capture **targeted**: when a fragment changes, the cases needing
 * fresh evidence are "the cases whose composition includes the changed
 * fragment", and "coverage is computed offline and named in the pass reference".
 * This computes that set.
 *
 * OFFLINE BY CONSTRUCTION. It resolves fragments and composes prompts; it never
 * calls a provider and needs no credential. Composition is a pure function of
 * the fragment set and the stage sequence, so the covered set is known *before*
 * anything is paid for — which is the whole point of targeting.
 *
 * IT REUSES `composePrompt`. Membership is read from `ComposedPrompt.fragments`,
 * the structured record the composer already returns for `AI-013`. Nothing here
 * parses rendered prompt text, and there is no second composition path: a
 * coverage answer derived from a different assembly than the pipeline uses would
 * be a claim about a prompt nobody sends.
 *
 * WHAT A CASE'S STAGE SEQUENCE IS. The recorded one. `fragmentsCompositionHash`
 * already treats a recording's `stages` as the authoritative account of what a
 * case ran, and coverage answers the same question that hash does — which cases
 * a fragment edit invalidates. A case with no recording has no composition to
 * invalidate and is reported as **unrecorded**, never as uncovered: those are
 * different states, and collapsing them would let a targeted result read as
 * suite-wide.
 *
 * COVERAGE IS NOT A PASS. It says which cases exercised a fragment, not that
 * they passed. `isCleanRun` in `pass-reference.ts` is what judges outcomes.
 */

import { composePrompt } from "../nie/prompt.js";
import type { FragmentResolver } from "../nie/ports.js";
import type { CorpusCase } from "./corpus.js";
import type { RecordingStore } from "./recording-store.js";

/** One case's composed fragment set, and whether the target is in it. */
export interface CaseCoverage {
  readonly caseId: string;
  /** Storage partition — a case's immutable entry provenance (D-30 dec. 8). */
  readonly corpusVersion: string;
  /** The stages this case actually ran, in recorded order. */
  readonly stageKeys: readonly string[];
  /** Every fragment key composed across those stages, sorted and unique. */
  readonly fragmentKeys: readonly string[];
  readonly exercisesFragment: boolean;
}

export interface FragmentCoverage {
  /** The repository's fragment identity — e.g. `stage.classification`. */
  readonly fragmentKey: string;
  /**
   * The version actually resolved while computing this coverage.
   *
   * `fragmentKey` names the fragment; `fragmentVersionId` names the row that
   * answered for it (`ResolvedFragment`, `DB §4.5`). Recording both is what
   * makes a coverage result auditable after an activation moves.
   * Absent when no composed case resolved the fragment at all.
   */
  readonly fragmentVersionId?: string;
  readonly fragmentVersion?: string;
  /** Suite version measured against, from `corpus.manifest.json` (D-30). */
  readonly suiteVersion: string;
  /** Every case in the corpus, recorded or not. */
  readonly corpusSize: number;
  /** Cases whose composition could be determined offline. */
  readonly determinedCases: number;
  /**
   * Cases with no recording.
   *
   * Not uncovered — **undetermined**. A non-zero value means this result cannot
   * speak for the whole corpus, whatever the covered count says.
   */
  readonly unrecordedCaseIds: readonly string[];
  readonly coveredCaseIds: readonly string[];
  readonly uncoveredCaseIds: readonly string[];
  /**
   * True only when every case in the corpus is covered.
   *
   * Requires `unrecordedCaseIds` to be empty, so a fragment present in all 13
   * recorded compositions of a 44-case corpus is **not** entire-corpus coverage.
   * D-30's "a fragment appearing in every composition produces full-corpus
   * coverage" holds only once every case has a composition to appear in.
   */
  readonly coversEntireCorpus: boolean;
  readonly cases: readonly CaseCoverage[];
}

export interface FragmentCoverageOptions {
  readonly fragmentKey: string;
  readonly cases: readonly CorpusCase[];
  readonly suiteVersion: string;
  readonly store: RecordingStore;
  /** The real resolver — coverage must reflect the active composition. */
  readonly resolver: FragmentResolver;
}

/**
 * Which corpus cases exercise `fragmentKey`, computed from real compositions.
 *
 * Deterministic: same corpus, same recordings, same active fragments produce an
 * identical result. Case lists are sorted so two runs are comparable by value.
 */
export async function computeFragmentCoverage(
  options: FragmentCoverageOptions,
): Promise<FragmentCoverage> {
  const { fragmentKey, cases, suiteVersion, store, resolver } = options;

  const covered: string[] = [];
  const uncovered: string[] = [];
  const unrecorded: string[] = [];
  const perCase: CaseCoverage[] = [];

  let fragmentVersionId: string | undefined;
  let fragmentVersion: string | undefined;

  for (const corpusCase of cases) {
    const verified = store.read(corpusCase.corpusVersion, corpusCase.caseId);
    if (verified === undefined) {
      unrecorded.push(corpusCase.caseId);
      continue;
    }

    const keys = new Set<string>();
    const stageKeys: string[] = [];

    for (const stage of verified.recording.stages) {
      stageKeys.push(stage.stageKey);
      const prompt = await composePrompt(
        {
          stageKey: stage.stageKey,
          ...(stage.classifiedAs !== undefined
            ? { classifiedAs: stage.classifiedAs }
            : {}),
        },
        resolver,
      );
      for (const fragment of prompt.fragments) {
        keys.add(fragment.fragmentKey);
        if (fragment.fragmentKey === fragmentKey) {
          fragmentVersionId = fragment.fragmentVersionId;
          fragmentVersion = fragment.version;
        }
      }
    }

    const exercisesFragment = keys.has(fragmentKey);
    (exercisesFragment ? covered : uncovered).push(corpusCase.caseId);
    perCase.push({
      caseId: corpusCase.caseId,
      corpusVersion: corpusCase.corpusVersion,
      stageKeys,
      fragmentKeys: [...keys].sort(),
      exercisesFragment,
    });
  }

  covered.sort();
  uncovered.sort();
  unrecorded.sort();

  return {
    fragmentKey,
    ...(fragmentVersionId !== undefined ? { fragmentVersionId } : {}),
    ...(fragmentVersion !== undefined ? { fragmentVersion } : {}),
    suiteVersion,
    corpusSize: cases.length,
    determinedCases: perCase.length,
    unrecordedCaseIds: unrecorded,
    coveredCaseIds: covered,
    uncoveredCaseIds: uncovered,
    coversEntireCorpus:
      unrecorded.length === 0 && covered.length === cases.length,
    cases: perCase.sort((a, b) => a.caseId.localeCompare(b.caseId)),
  };
}
