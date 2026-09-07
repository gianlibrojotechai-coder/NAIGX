/**
 * Analysis endpoints — `API-020`, `API-021`, `API-026` (`API §6.2`).
 *
 *   POST   /analyses               create, 202, returns before reasoning ends
 *   GET    /analyses/{id}          the stored analysis (`FR-060`)
 *   GET    /analyses/{id}/status   cheap polling (`SA AR-06`)
 *
 * THE READ PATH REPRODUCES, IT NEVER REGENERATES (`FR-060`, `API-021`
 * acceptance). Every field returned is read from the stored record. Nothing
 * here calls the NIE, and nothing here reaches a provider — retrieving an
 * analysis a second time cannot cost money or produce a different answer.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN. `API-021` is explicit: "Contains no
 * stage traces, prompt fragments, or provider identity." Those live in the
 * separate trace store and are operator-only (`DB §8.4`), so the shape below
 * has no field they could occupy — absence by construction rather than by
 * filtering.
 *
 * SCOPE OF THIS BUILD (`docs/12` D-37). Transport and lifecycle. Creation
 * hands the analysis to the orchestrator (`SA §3.3`), which owns execution;
 * this module never runs a stage itself. Three specified elements remain
 * absent and are named rather than stubbed:
 *
 *   · `events_url` — `API-025` (SSE) is not implemented; advertising a URL
 *     that 404s would be worse than omitting it.
 *   · `events_url` remains the only absent element of the create response.
 * `classification_override` was previously absent for want of the flow it
 * belongs to. That flow now exists: `FR-014` correction re-submits the same
 * content with the type fixed, and `API §7.5` creates a **new** analysis
 * rather than mutating the original.
 *
 * OWNERSHIP IS ENFORCED (`M-15`, `NFR-026`). Every read here asks
 * `mayAccessAnalysis`, the single predicate in `src/auth/principal.ts`. An
 * owned analysis answers only to its owner; an unowned one answers only to the
 * holder of the token issued when it was created. **An analysis id is a name,
 * not a credential** — knowing one grants nothing.
 */

import type { FastifyPluginAsync } from "fastify";

import type { AnalysisEventLog } from "../events/analysis-event-log.js";
import { readAnalysis } from "../db/analysis-reader.js";
import { generateToken, hashToken } from "../auth/tokens.js";
import { mayAccessAnalysis, type Principal } from "../auth/principal.js";
import {
  AppError,
  insufficientContextError,
  invalidStateError,
  notFoundError,
  unsupportedInputTypeError,
} from "../http/errors.js";
import {
  CLASSIFICATION_TYPES,
  isRetryableArtifactType,
  type ClassificationType,
} from "../nie/contracts.js";
import { sendSuccess } from "../http/responses.js";
import type { PrismaClient } from "../generated/prisma/client.js";

/** `FR-002` — the bounds the migration also enforces with a CHECK. */
export const CONTENT_MIN = 50;
export const CONTENT_MAX = 50_000;

export interface AnalysisRouteOptions {
  readonly prisma: PrismaClient;
  /** Injected so the content hash is testable without importing crypto here. */
  readonly hashContent: (content: string) => string;
  /**
   * Starts reasoning for a created analysis (`SA §3.3`).
   *
   * Optional, and its absence is a designed state rather than a failure: an
   * instance with no executor still accepts and stores submissions, and they
   * stay `queued`. That is what this API did before the orchestrator existed,
   * and it is what a test that only exercises the HTTP contract wants.
   *
   * **Not awaited.** `API-020` returns before reasoning completes, so the
   * request cannot block on a run that takes tens of seconds. The analysis row
   * is the durable record (`SA §12`), so a process restart loses the in-flight
   * run, not the submission.
   */
  readonly startExecution?: (
    analysisId: string,
    classificationOverride?: ClassificationType,
  ) => void;
  /**
   * The event log `API-025` streams from.
   *
   * Optional: without it the endpoint reports that streaming is unavailable and
   * clients use `API-026` polling, which `SA AR-06` requires to exist anyway.
   */
  readonly eventLog?: AnalysisEventLog;
  /**
   * Regenerates one failed artifact from stored reasoning (`API-032`).
   *
   * Optional on the same principle as `startExecution`: an instance without a
   * reasoning stack still serves every read endpoint, and a retry request
   * against it reports the capability as unavailable rather than pretending.
   *
   * @returns the outcome the endpoint reports. Throws nothing provider-shaped;
   * the composition root normalises before it gets here.
   */
  readonly retryArtifact?: (
    analysisId: string,
    artifactType: string,
  ) => Promise<void>;
}

interface CreateBody {
  readonly content?: unknown;
  readonly source_type?: unknown;
  /** `FR-014` / `API §7.5` — the user's corrected type. */
  readonly classification_override?: unknown;
  /** The analysis this one corrects, for `FR-064` lineage. Optional. */
  readonly supersedes_analysis_id?: unknown;
}

/** `DB §4.2` SOURCE_TYPE. Mirrors the persisted enum exactly. */
const SOURCE_TYPES = ["paste", "file"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Validates before anything is written or spent (`FR-005`, `API §6.1`:
 * "Authoritative gate before any cost is incurred").
 *
 * Every message names the constraint and the corrective action. `FR-005`
 * forbids "invalid input" as a response, and `FR-002` requires the minimum to
 * be stated with its reason and the maximum with the actual count.
 */
function validateCreate(body: CreateBody): {
  content: string;
  sourceType: SourceType;
} {
  const { content } = body;

  if (typeof content !== "string" || content.trim() === "") {
    throw new AppError("validation_failed", "`content` is required.", {
      field: "content",
      action: "Send the text to analyse in the `content` field.",
    });
  }

  const characterCount = content.length;
  if (characterCount < CONTENT_MIN) {
    throw new AppError(
      "content_too_short",
      `Input is ${String(characterCount)} characters. At least ${String(CONTENT_MIN)} are needed to reason about it — below that there is not enough to analyse, and any conclusion would be invented.`,
      {
        field: "content",
        action: "Paste the full text rather than an excerpt.",
        details: { characterCount, minimum: CONTENT_MIN },
      },
    );
  }
  if (characterCount > CONTENT_MAX) {
    throw new AppError(
      "content_too_long",
      `Input is ${String(characterCount)} characters; the maximum is ${String(CONTENT_MAX)}.`,
      {
        field: "content",
        action: "Split the input, or submit the section you want analysed.",
        details: { characterCount, maximum: CONTENT_MAX },
      },
    );
  }

  // `FR-001` / `UX-002`: the API never demands a type. `source_type` describes
  // how the text arrived, not what it is about.
  const raw = body.source_type;
  if (raw !== undefined && !SOURCE_TYPES.includes(raw as SourceType)) {
    throw new AppError(
      "validation_failed",
      `\`source_type\` must be one of: ${SOURCE_TYPES.join(", ")}.`,
      {
        field: "source_type",
        action: "Omit the field to accept the default, `paste`.",
      },
    );
  }

  return { content, sourceType: (raw as SourceType | undefined) ?? "paste" };
}

/**
 * `FR-014` / `API §7.5` — the user's corrected classification.
 *
 * ⚠️ `unsupported` IS REFUSED. It is a refusal outcome (`FR-092`), not a frame
 * anything can be reasoned under: fixing it would ask the pipeline to decline
 * on the user's own instruction, producing no analysis and consuming the
 * submission. A user who believes their input is out of scope simply does not
 * submit it.
 */
function validateOverride(raw: unknown): ClassificationType | undefined {
  if (raw === undefined) return undefined;

  const correctable = CLASSIFICATION_TYPES.filter(
    (type) => type !== "unsupported",
  );

  if (
    typeof raw !== "string" ||
    !(correctable as readonly string[]).includes(raw)
  ) {
    throw new AppError(
      "validation_failed",
      `\`classification_override\` must be one of: ${correctable.join(", ")}.`,
      {
        field: "classification_override",
        action:
          "Omit the field to let NAIGX determine the type, or name one of the correctable types.",
        details: { correctable_types: correctable },
      },
    );
  }
  return raw as ClassificationType;
}

/**
 * The analysis being corrected, when one was named (`FR-064` lineage).
 *
 * Optional: `API §7.5` describes the correction as a plain submission with the
 * same content and an override, and requires only that "the original analysis
 * remains retrievable" — which is true whether or not the new one points at
 * it. Recording the link when the client supplies it makes the correction
 * legible in history rather than leaving two unrelated analyses of the same
 * text.
 */
function validateSupersedes(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new AppError(
      "validation_failed",
      "`supersedes_analysis_id` must be the id of the analysis being corrected.",
      {
        field: "supersedes_analysis_id",
        action: "Send the original analysis id, or omit the field.",
      },
    );
  }
  return raw;
}

/**
 * Refuses a caller who may not act on this analysis (`NFR-026`).
 *
 * ⚠️ RAISES `not_found`, NEVER `forbidden`. Distinguishing "exists but is not
 * yours" from "does not exist" tells an unauthenticated caller which ids are
 * real, and analysis ids are the only thing standing between an attacker and
 * a list of what this system has analysed. `API-021` lists `not_found` 404 in
 * its errors; `forbidden` 403 belongs to endpoints where the caller is known
 * and the resource is theirs to be refused.
 */
function requireAccess(
  principal: Principal,
  stored: {
    view: { analysis_id: string };
    ownership: { ownerUserId: string | null };
  },
): void {
  const permitted = mayAccessAnalysis(principal, {
    analysisId: stored.view.analysis_id,
    ownerUserId: stored.ownership.ownerUserId,
  });
  if (!permitted) throw notFoundError();
}

export const analysisRoutes: FastifyPluginAsync<AnalysisRouteOptions> = (
  app,
  { prisma, hashContent, startExecution, eventLog, retryArtifact },
) => {
  // --- API-020 — create ---------------------------------------------------
  app.post("/analyses", async (request, reply) => {
    const body = (request.body ?? {}) as CreateBody;
    const { content, sourceType } = validateCreate(body);

    // `FR-004` — THE TOKEN IS NOW ACTUALLY ISSUED.
    //
    // Until M-15 this endpoint stored `hashContent(randomUUID())` and threw
    // the UUID away, so the owner hash satisfied the database constraint and
    // nobody held the credential. `FR-004` requires an anonymous analysis to
    // be "claimable into history if the user authenticates within the same
    // session", and it was not claimable by anyone. The recorded defect is
    // closed here: the raw token is generated, returned once, and stored only
    // as a hash.
    //
    // An authenticated caller gets no token — their analysis is owned from
    // creation, and issuing an anonymous credential for it would create a
    // second way to reach owned content.
    const principal = request.principal;
    const owner = principal.kind === "user" ? principal.userId : null;
    const anonymousToken = owner === null ? generateToken() : null;

    // `FR-014` / `API §7.5` — CORRECTION IS A SUBMISSION, NOT AN EDIT.
    //
    // "The contract deliberately does not mutate the original analysis." A
    // correction re-submits the same content with the type fixed, and a **new**
    // analysis is created: `DB DP-3` makes analyses immutable, and re-running
    // reasoning under a different frame produces a genuinely different
    // analysis. An update would destroy both what the system originally
    // concluded and the accuracy signal the comparison provides.
    //
    // Nothing here mutates the original row. It is read only to confirm it
    // exists, and remains retrievable exactly as it was.
    const classificationOverride = validateOverride(
      body.classification_override,
    );
    const supersedesAnalysisId = validateSupersedes(
      body.supersedes_analysis_id,
    );

    if (supersedesAnalysisId !== undefined) {
      // A lineage pointer to an analysis that does not exist would be worse
      // than none: it would claim a history nobody can follow. The column is
      // also a real FK, so an unknown id would fail at the database with a
      // message that names a constraint rather than the problem.
      const original = await prisma.analysis.findUnique({
        where: { analysisId: supersedesAnalysisId },
        select: { analysisId: true },
      });
      if (original === null) {
        throw new AppError(
          "validation_failed",
          "The analysis this submission says it corrects does not exist.",
          {
            field: "supersedes_analysis_id",
            action:
              "Send the id of an analysis that exists, or omit the field to submit this as a new analysis.",
          },
        );
      }
    }

    // One transaction: an analysis without its input is a row nothing can be
    // reasoned from, and `DB §4.2` makes the relation required.
    const analysis = await prisma.analysis.create({
      data: {
        status: "queued",
        // ⚠️ EXACTLY ONE OWNER, AND NOW IT IS A REAL CHOICE.
        //
        // `DB §4.2` enforces `analysis_exactly_one_owner_check` — exactly one
        // of `user_id` or `anonymous_token_hash` (`DP-8`, `FR-004`: ownership
        // is "never ambiguous and never absent"). Until `M-15` this endpoint
        // could only ever write the second, because there were no users; the
        // branch below is what identity added.
        //
        // The anonymous hash is now a hash of a token somebody actually holds,
        // which is what makes `FR-004` claimability real rather than recorded
        // as an open defect.
        ...(owner !== null
          ? { userId: owner }
          : { anonymousTokenHash: hashToken(anonymousToken as string) }),
        // `FR-064` lineage. The original is preserved (`DP-3`); this only
        // records which analysis this one corrects.
        ...(supersedesAnalysisId !== undefined ? { supersedesAnalysisId } : {}),
        input: {
          create: {
            rawContent: content,
            contentHash: hashContent(content),
            characterCount: content.length,
            sourceType,
          },
        },
      },
    });

    // Reasoning starts once the row exists, and is deliberately not awaited:
    // the response must precede it. Where no executor is wired the analysis
    // stays `queued`, which the status endpoint reports rather than hides.
    startExecution?.(analysis.analysisId, classificationOverride);

    // 202, not 201: reasoning has not completed. `API-020` acceptance —
    // "Returns before reasoning completes."
    return sendSuccess(
      request,
      reply,
      {
        analysis_id: analysis.analysisId,
        status: analysis.status,
        // Returned **once**, at creation, and never again — the store holds
        // only its hash. `API §3.4`: it grants read and event-stream access to
        // this analysis only, and expires 24 hours after issuance (D-45).
        ...(anonymousToken !== null ? { anonymous_token: anonymousToken } : {}),
        // Echoed so a client can confirm the correction was accepted before
        // any stage has run. Absent on an ordinary submission, matching how
        // every other optional field in this API reports "not applicable".
        ...(classificationOverride !== undefined
          ? { classification_override: classificationOverride }
          : {}),
        ...(supersedesAnalysisId !== undefined
          ? { supersedes_analysis_id: supersedesAnalysisId }
          : {}),
      },
      202,
    );
  });

  // --- API-025 — event stream ---------------------------------------------
  //
  // Server-Sent Events: a plain HTTP response that stays open and pushes
  // `data:` frames. Chosen over WebSockets by `SA AD-04` because the traffic is
  // one-directional — the server narrates, the client listens — and SSE
  // reconnects on its own, carrying `Last-Event-ID` so the server knows where
  // to resume.
  //
  // ⚠️ THE STREAM IS A CONVENIENCE, NEVER THE RECORD. `API-025`: "Stream
  // failure never fails the analysis." Everything here is also reachable
  // through `API-026` polling and `API-021` retrieval, which is why a dropped
  // connection, a restarted process or an absent event log all degrade to
  // "use the other endpoints" rather than to lost work.
  app.get<{ Params: { id: string } }>(
    "/analyses/:id/events",
    async (request, reply) => {
      const analysisId = request.params.id;

      const analysis = await prisma.analysis.findUnique({
        where: { analysisId },
        select: { status: true, userId: true },
      });
      if (analysis === null) throw notFoundError();

      // `API-025` is owner-scoped. A stream is a read of the same content the
      // retrieval endpoint guards, arriving in instalments.
      requireAccess(request.principal, {
        view: { analysis_id: analysisId },
        ownership: { ownerUserId: analysis.userId },
      });

      if (eventLog === undefined) {
        // No stream on this instance. A 503 with the corrective step, rather
        // than an empty stream that looks like a slow analysis forever.
        throw new AppError(
          "service_unavailable",
          "Event streaming is not available on this instance.",
          {
            action:
              "Poll `/analyses/{id}/status` and retrieve the analysis when it completes.",
          },
        );
      }

      // `Last-Event-ID` is set by the browser automatically on reconnect. A
      // client may also pass it explicitly after a manual retry.
      const header = request.headers["last-event-id"];
      const resumeFrom = Number.parseInt(
        Array.isArray(header) ? (header[0] ?? "") : (header ?? ""),
        10,
      );
      const afterSequence = Number.isFinite(resumeFrom) ? resumeFrom : 0;

      const subscription = eventLog.subscribe(
        analysisId,
        afterSequence,
        () => undefined,
      );
      if (subscription === undefined) {
        // The analysis exists but its log does not — it finished before this
        // process started, or the log was evicted. `SA AD-05` accepts that
        // in-flight state is lost on restart; the stored analysis is not.
        throw new AppError(
          "expired",
          "No live event stream exists for this analysis.",
          {
            action:
              "Retrieve the completed analysis from `/analyses/{id}`, or poll `/analyses/{id}/status`.",
          },
        );
      }
      subscription.unsubscribe();

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        // Proxies that buffer would defeat the point of streaming.
        "X-Accel-Buffering": "no",
      });

      const write = (sequenced: {
        sequence: number;
        event: { type: string };
      }): void => {
        // The SSE frame format: `id:` is what comes back as `Last-Event-ID`,
        // `event:` names the type so a client can listen selectively, and the
        // blank line terminates the frame.
        reply.raw.write(
          `id: ${String(sequenced.sequence)}\n` +
            `event: ${sequenced.event.type}\n` +
            `data: ${JSON.stringify(sequenced.event)}\n\n`,
        );
      };

      const live = eventLog.subscribe(
        analysisId,
        afterSequence,
        (sequenced) => {
          write(sequenced);
          if (
            sequenced.event.type === "complete" ||
            sequenced.event.type === "error"
          ) {
            // `API §7.4`: the terminal event is always emitted before close, so a
            // closed stream without one is a fault the client can detect.
            reply.raw.end();
          }
        },
      );

      if (live === undefined) {
        reply.raw.end();
        return reply;
      }

      if (eventLog.isComplete(analysisId)) {
        // Replay already delivered the terminal event; nothing further comes.
        reply.raw.end();
        return reply;
      }

      request.raw.on("close", () => {
        live.unsubscribe();
      });

      // Fastify must not try to send its own body — this response is ours now.
      return reply;
    },
  );

  // --- API-032 — retry a failed artifact ----------------------------------
  //
  // `FR-091`: "Retry of a failed artifact is available without re-running the
  // full analysis." `API §7.6` scopes it — "reuses stored reasoning; no stage
  // 1-8 re-run" — and `API-032` calls it "the sole permitted mutation to a
  // terminal analysis ... permitted because it completes rather than alters
  // the record (`DB DP-3`)".
  //
  // `API §7.8` permits this anonymously. It is one of four things an anonymous
  // caller may do, listed beside creating, retrieving and subscribing — so no
  // auth gate is added here, and none is being deferred either.
  app.post<{ Params: { id: string; type: string } }>(
    "/analyses/:id/artifacts/:type/retry",
    async (request, reply) => {
      const { id: analysisId, type: artifactType } = request.params;

      const analysis = await prisma.analysis.findUnique({
        where: { analysisId },
        select: { status: true, userId: true },
      });
      if (analysis === null) throw notFoundError();

      // `API §7.8` permits an anonymous caller to retry a failed artifact —
      // one of four things it lists as permitted — so this is owner-scoped
      // rather than authenticated-only. The anonymous holder of *this*
      // analysis's token qualifies; a caller with someone else's does not.
      requireAccess(request.principal, {
        view: { analysis_id: analysisId },
        ownership: { ownerUserId: analysis.userId },
      });

      // `API-032` calls this "the sole permitted mutation to a **terminal**
      // analysis". A run still in flight may yet produce the artifact itself,
      // and retrying underneath it would race the pipeline for the same plan
      // entry.
      if (analysis.status === "queued" || analysis.status === "running") {
        throw invalidStateError(
          "This analysis is still running, so its artifacts are not final yet.",
          "Wait for the analysis to finish, then retry anything that failed.",
          { status: analysis.status },
        );
      }

      // `API-032` validation: "Artifact must currently be in `failed` state."
      const entry = await prisma.artifactPlanEntry.findFirst({
        where: { analysisId, artifactType },
        select: { outcome: true },
      });
      if (entry === null) throw notFoundError();

      if (entry.outcome !== "failed") {
        // The message names the state the artifact *is* in. `FR-005` requires
        // an error to state a corrective action, and "invalid state" alone
        // leaves the caller nothing to do.
        throw invalidStateError(
          entry.outcome === "generated"
            ? "This artifact generated successfully, so there is nothing to retry."
            : entry.outcome === "omitted"
              ? "This artifact was deliberately omitted rather than attempted, so there is nothing to retry."
              : "This artifact has not been attempted yet, so there is nothing to retry.",
          entry.outcome === "omitted"
            ? "Omission is a decision, not a failure. Submit a new analysis if you want a different plan."
            : "Retrieve the analysis to see the artifact's current state.",
          { artifact_type: artifactType, current_outcome: entry.outcome },
        );
      }

      // A rendered artifact is a deterministic function of reasoning already
      // stored (`docs/15` D-40), so a second attempt recomputes the identical
      // document and fails identically. Refusing is the honest answer: a
      // failure here is a defect in the renderer, and a retry button that
      // cannot help would imply otherwise. The `artifact_failed` event says
      // the same thing through `retryAvailable`, from the same predicate.
      if (!isRetryableArtifactType(artifactType)) {
        throw invalidStateError(
          "This artifact is rendered from reasoning that is already stored, not generated, so retrying it would produce exactly the same document.",
          "Its failure indicates a defect to report rather than a transient error to retry. Submit a new analysis if the underlying reasoning should change.",
          { artifact_type: artifactType, deterministic: true },
        );
      }

      if (retryArtifact === undefined) {
        throw new AppError(
          "service_unavailable",
          "Artifact regeneration is not available on this instance.",
          { action: "Try again later, or submit a new analysis." },
        );
      }

      await retryArtifact(analysisId, artifactType);

      // `202 Accepted` per `API-032`, with the stream to watch. The work is
      // done by the time we reply — but the contract is 202, and a client that
      // followed `events_url` for the outcome stays correct either way.
      return sendSuccess(
        request,
        reply,
        {
          status: "accepted",
          events_url: `/analyses/${analysisId}/events`,
        },
        202,
      );
    },
  );

  // --- API-026 — status ---------------------------------------------------
  app.get<{ Params: { id: string } }>(
    "/analyses/:id/status",
    async (request, reply) => {
      const analysis = await prisma.analysis.findUnique({
        where: { analysisId: request.params.id },
        // Selected, not fetched-then-trimmed. "Cheap enough to poll at a
        // few-second interval" is a property of the query, not of the
        // serialiser, and there is no path here by which artifact content
        // could reach a client.
        select: {
          userId: true,
          status: true,
          createdAt: true,
          completedAt: true,
          degradationFlag: true,
          timeoutFlag: true,
        },
      });
      if (analysis === null) throw notFoundError();

      // Owner-scoped like every other read. A status is thin, but "this id is
      // a real analysis and it completed" is still disclosure.
      requireAccess(request.principal, {
        view: { analysis_id: request.params.id },
        ownership: { ownerUserId: analysis.userId },
      });

      return sendSuccess(request, reply, {
        status: analysis.status,
        updated_at: (analysis.completedAt ?? analysis.createdAt).toISOString(),
        degraded: analysis.degradationFlag,
        timed_out: analysis.timeoutFlag,
      });
    },
  );

  // --- API-021 — retrieve -------------------------------------------------
  //
  // The read itself lives in `src/db/analysis-reader.ts`, shared with `API-040`
  // export so that the JSON view and the exported document cannot disagree
  // about what an analysis contains.
  app.get<{ Params: { id: string } }>(
    "/analyses/:id",
    async (request, reply) => {
      const stored = await readAnalysis(prisma, request.params.id);
      if (stored === null) throw notFoundError();

      // `NFR-026` — server-side ownership, before anything is disclosed.
      //
      // ⚠️ 404, NOT 403, FOR A NON-OWNER. A 403 would confirm the analysis
      // exists, turning the id space into an oracle for whether a given
      // analysis is real. `DB §5.5` says an anonymous analysis is "reachable
      // only by its originating token"; unreachable is indistinguishable from
      // absent, and that is the point.
      requireAccess(request.principal, stored);

      // `API §9.3` — TWO DOMAIN ERRORS THAT ARE NOT FAILURES.
      //
      // "The request was well-formed and processed correctly; the *content*
      // cannot be analyzed." Both are 422, and both are raised here rather
      // than at submission because execution is asynchronous: `API-020`
      // returns 202 before Stage 1 has run, so the refusal cannot be known
      // while the caller is still on the creating request. §9.4's flow places
      // these after classification, which is where they are detected — this is
      // where they become visible.
      //
      // Until now they were detected, recorded on the pipeline result, and
      // discarded. A refused analysis came back 200 with empty sections, which
      // is indistinguishable from a run that produced nothing for some other
      // reason. `PV §5` calls the insufficient case a defining product moment;
      // serving it as an empty success wasted it.
      const refusal = stored.view.refusal;
      if (refusal !== null) {
        if (refusal.code === "unsupported_input_type") {
          // `FR-092` — say which types *are* supported. A refusal that does
          // not name an alternative leaves the user with nothing to try.
          throw unsupportedInputTypeError(
            CLASSIFICATION_TYPES.filter((type) => type !== "unsupported"),
          );
        }
        // `AI §5.4` — the unknowns are the answer, not decoration. They carry
        // what is missing and what would resolve it, which is the whole reason
        // `API §9.3` refuses to accept a generic error here.
        throw insufficientContextError(
          refusal.unknowns.map((unknown) => ({
            content: unknown.content,
            resolutionHint: unknown.resolution_hint,
          })),
        );
      }

      // The view is the response body. `ownership` is deliberately not spread
      // in: `API-021` carries no owner field, so the reader returns it beside
      // the view rather than inside it.
      return sendSuccess(request, reply, stored.view);
    },
  );

  return Promise.resolve();
};
