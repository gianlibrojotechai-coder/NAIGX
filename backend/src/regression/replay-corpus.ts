/**
 * The recorded corpus a **replay deployment** serves from
 * ([D-62](../../../docs/37-D-62-Mode-Aware-Readiness.md)).
 *
 * ## What this answers
 *
 * D-62 §3 makes a replay instance ready only when "a usable recorded corpus is
 * available", and §5 fixes what replay is: it reproduces what was captured for
 * an input it has a recording for, and analyses nothing else. This module is
 * the one place that decides what *usable* means for a running instance, and
 * it decides it per recording, against the fragments that instance actually
 * composes with.
 *
 * ## ⚠️ THE RULE: a recording is served only if the deployment's composition
 * IS the composition it was captured against
 *
 * The runtime composes every prompt from the **published** fragments
 * (`db/fragment-resolver.ts`). A recording is an answer to the prompt it was
 * captured with (D-63 §7). Those are the same question only when the published
 * composition reproduces the recording's `fragmentsCompositionHash` — and that
 * is checked here, recording by recording, with the same `composePrompt` the
 * pipeline uses. A recording whose captured composition the deployment cannot
 * reproduce is **excluded with a stated reason**, never keyed against the
 * newer prompt: that would serve yesterday's answer to today's question and
 * call it a recording.
 *
 * This is deliberately stricter than the regression runner, which pins a
 * recording to its captured composition so it can be *evaluated* whatever the
 * fragments do today. Evaluation and serving are different acts. A regression
 * run asks "what did the model say to this prompt"; a deployment promises
 * "this is what the system says", and it may only make that promise for the
 * prompts it actually composes.
 *
 * ## What it does not do
 *
 * It does not relax the manifest gate — `store.read` still refuses an
 * unmanifested or edited file, and that refusal is reported as an exclusion
 * rather than swallowed. It does not touch the activation gate, the publisher,
 * or the recording store's write path. It reads, verifies, and keys.
 */

import type { CapabilityProfile } from "../nie/capability-profile.js";
import type { FragmentResolver } from "../nie/ports.js";
import type { ReplayFixture } from "../provider/adapters/replay.js";
import { buildReplayFixtures } from "../harness/recordings.js";
import type { CorpusCase } from "./corpus.js";
import {
  fragmentsCompositionHash,
  inputTextHash,
  RecordingIntegrityError,
  type RecordingStore,
} from "./recording-store.js";

export interface ReplayCorpusOptions {
  /** The frozen corpus — the only source of the input text a key derives from. */
  readonly cases: readonly CorpusCase[];
  /** The canonical store. Held, withdrawn and superseded evidence is invisible to it. */
  readonly store: RecordingStore;
  /**
   * ⚠️ THE DEPLOYMENT'S OWN RESOLVER — the one the pipeline composes with.
   * Keys built against any other resolver would not match a single runtime
   * request, and the mismatch would surface three stages in as a provider
   * failure blaming the recording.
   */
  readonly resolver: FragmentResolver;
  /**
   * The operator inventory Stage 7 keys against (`FR-022`). Capture/replay
   * parity: a `job_description` recording made with a profile files a Stage 7
   * fixture only when the same profile is given here.
   */
  readonly capabilityProfile?: CapabilityProfile;
}

export interface ExcludedRecording {
  readonly caseId: string;
  readonly reason: string;
}

export interface ReplayCorpus {
  /** Every served recording's fixtures, merged, keyed as the adapter looks them up. */
  readonly fixtures: Readonly<Record<string, ReplayFixture>>;
  /**
   * Whether the served recordings were captured under low-variance sampling —
   * `true` only when every one of them declares it (`AI §10.6`). One adapter
   * serves the whole corpus, so it can claim no more than its weakest member.
   */
  readonly lowVarianceSampling: boolean;
  /** Case ids whose recordings this instance will serve. */
  readonly served: readonly string[];
  /** Recordings that exist but are not served, each with the reason. */
  readonly excluded: readonly ExcludedRecording[];
  /** Corpus cases with no recording at all — not evidence, not a problem. */
  readonly unrecorded: number;
}

/**
 * Loads every servable recording for the given corpus and resolver.
 *
 * Never throws for a single bad recording: one unmanifested file must not take
 * the whole instance down when fourteen others are fine. It is reported in
 * `excluded`, the startup log states it, and readiness counts what remains.
 */
export async function loadReplayCorpus(
  options: ReplayCorpusOptions,
): Promise<ReplayCorpus> {
  const fixtures: Record<string, ReplayFixture> = {};
  const served: string[] = [];
  const excluded: ExcludedRecording[] = [];
  const lowVariance: boolean[] = [];
  let unrecorded = 0;

  for (const corpusCase of options.cases) {
    let verified;
    try {
      verified = options.store.read(
        corpusCase.corpusVersion,
        corpusCase.caseId,
      );
    } catch (error) {
      // The manifest gate refusing is an answer about this recording, not a
      // reason to serve nothing. Stated, and moved past.
      excluded.push({
        caseId: corpusCase.caseId,
        reason:
          error instanceof RecordingIntegrityError
            ? error.message
            : `unreadable recording: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    if (verified === undefined) {
      unrecorded += 1;
      continue;
    }
    const { recording } = verified;

    // `docs/12` D-19: Stage 3 verifies quotes against the input, so a recording
    // is only valid against the text it was captured from.
    const expectedHash = inputTextHash(corpusCase.inputText);
    if (recording.inputTextHash !== expectedHash) {
      excluded.push({
        caseId: corpusCase.caseId,
        reason:
          `captured against different input text (recorded ${recording.inputTextHash.slice(0, 12)}, ` +
          `corpus ${expectedHash.slice(0, 12)})`,
      });
      continue;
    }

    // --- does this deployment compose the prompt the recording answers? ---
    let deployed: string;
    try {
      deployed = await fragmentsCompositionHash(
        recording.stages,
        options.resolver,
      );
    } catch (error) {
      // Typically "No active published version for fragment(s): …" — the
      // instance cannot compose this recording's stages at all.
      excluded.push({
        caseId: corpusCase.caseId,
        reason: `cannot compose its stages here: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    if (deployed !== recording.fragmentsCompositionHash) {
      excluded.push({
        caseId: corpusCase.caseId,
        reason:
          `the published composition (${deployed.slice(0, 12)}) is not the one it was captured ` +
          `against (${recording.fragmentsCompositionHash.slice(0, 12)}) — it would answer a prompt this instance does not ask`,
      });
      continue;
    }

    // Hash equality covers every recorded stage's composed instructions, so
    // keying against the deployment's resolver and against the recording's
    // pinned composition produce identical keys. The deployment's is used
    // because it is the one the runtime will present.
    const caseFixtures = await buildReplayFixtures(
      recording.stages,
      options.resolver,
      corpusCase.inputText,
      {
        ...(options.capabilityProfile !== undefined
          ? { capabilityProfile: options.capabilityProfile }
          : {}),
      },
    );

    // Two cases keying the same request would mean two recorded answers to one
    // question, and the adapter can only hold one. It has never happened —
    // Stage 1's input is the case text — but silently overwriting is exactly
    // how it would go unnoticed if it did.
    const collision = Object.keys(caseFixtures).find((key) => key in fixtures);
    if (collision !== undefined) {
      excluded.push({
        caseId: corpusCase.caseId,
        reason: `request key ${collision} is already filed by another served recording`,
      });
      continue;
    }

    Object.assign(fixtures, caseFixtures);
    served.push(corpusCase.caseId);
    lowVariance.push(recording.lowVarianceSampling);
  }

  return {
    fixtures,
    lowVarianceSampling: lowVariance.length > 0 && lowVariance.every(Boolean),
    served,
    excluded,
    unrecorded,
  };
}

/**
 * The readiness question for replay mode, answered from what was loaded.
 *
 * Throws the `API-060` readiness failure when nothing can be served. The
 * message names the counts, because "no recordings are available" has two
 * very different causes — nothing mounted, or everything excluded — and an
 * operator looking at a 503 should not have to guess which.
 *
 * ⚠️ The phrase "no recordings are available" is D-62's readiness wording and
 * `deploy/README.md` documents it as the replay-mode 503 message. Keep it
 * verbatim. (The runbook's build marker is a different string — the startup
 * log line `Replay corpus loaded` in `dist/index.js` — because this message
 * no longer lives in that file.)
 */
export function assertReplayServable(corpus: ReplayCorpus): void {
  if (Object.keys(corpus.fixtures).length > 0) {
    return;
  }
  const detail =
    corpus.excluded.length === 0
      ? `${String(corpus.unrecorded)} corpus case(s) have no recording and none was loaded`
      : `${String(corpus.excluded.length)} recording(s) were excluded — ` +
        corpus.excluded
          .slice(0, 3)
          .map((e) => `${e.caseId}: ${e.reason}`)
          .join("; ") +
        (corpus.excluded.length > 3 ? "; …" : "");
  throw new Error(
    "Replay mode is configured but no recordings are available, so no " +
      `submission can be served (${detail}). Readiness fails deliberately (D-62).`,
  );
}
