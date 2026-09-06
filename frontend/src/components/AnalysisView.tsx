/**
 * The stored analysis, presented (`FR-040`–`FR-045`).
 *
 * HIERARCHY IS FIXED, NOT AESTHETIC. `FR-040` requires the problem as
 * understood to lead and to be visible without scrolling, then conclusions,
 * then supporting detail. The order below is that requirement:
 *
 *   1 the job as understood · 2 classification · 3 verdict · 4 requirements
 *   5 portfolio suggestions · 6 unknowns · 7 provenance · 8 artifact status
 *
 * NOTHING IS INVENTED. Every field that the store can hold as null renders as
 * an explicit statement of unavailability. This is most conspicuous with
 * confidence: `FR-045` asks for it per recommendation, Stage 11 does not
 * exist (`docs/12` D-33), and the honest rendering of a null band is to say
 * there is none — not a bar at some default, and not silence.
 *
 * A FAILED ARTIFACT'S CONTENT IS NEVER RENDERED. The API withholds it
 * (`DB §4.4`), and this view would have nothing to draw even if it tried; what
 * it shows instead is that the artifact was attempted and did not validate,
 * which is the difference `FR-091` exists to preserve.
 */

import {
  asPortfolioSuggestions,
  type Analysis,
  type ArtifactEntry,
  type Requirement,
} from "../api/types";
import {
  formatElapsed,
  formatTimestamp,
  humanise,
  verdictLabel,
  verdictMeaning,
} from "../format";
import { PortfolioSuggestionsView } from "./PortfolioSuggestions";
import {
  Badge,
  Field,
  ProvenanceBadge,
  ProvenanceLegend,
  Section,
  Unavailable,
} from "./ui";

// --- 4 · requirements ------------------------------------------------------

function RequirementCard({ requirement }: { requirement: Requirement }) {
  const decisive = requirement.gaps.some((gap) => gap.decisive);

  return (
    <li
      className={`border rounded-md p-4 ${decisive ? "border-rose-300 bg-rose-50/40" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <h4 className="font-medium text-slate-900 flex-1 min-w-0">
          {requirement.name}
        </h4>
        <Badge tone={requirement.necessity === "must_have" ? "danger" : "neutral"}>
          {humanise(requirement.necessity)}
        </Badge>
        <Badge>{humanise(requirement.kind)}</Badge>
        <ProvenanceBadge provenance={requirement.provenance} />
      </div>

      {requirement.matched.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Evidenced
          </h5>
          <ul className="mt-1 space-y-1">
            {requirement.matched.map((match) => (
              <li
                key={match.capability_id}
                className="text-sm text-slate-800 flex flex-wrap items-center gap-2"
              >
                <Badge tone={match.strength === "strong" ? "success" : "warning"}>
                  {humanise(match.strength)} match
                </Badge>
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                  {match.capability_id}
                </code>
                <span className="text-slate-600 text-xs break-all">
                  {match.evidence_ref}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requirement.gaps.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Gaps
          </h5>
          <ul className="mt-1 space-y-1.5">
            {requirement.gaps.map((gap, index) => (
              <li
                key={`${gap.priority}-${String(index)}`}
                className="text-sm text-slate-800"
              >
                <span className="inline-flex flex-wrap items-center gap-1.5 mr-2 align-middle">
                  <Badge
                    tone={
                      gap.priority === "high"
                        ? "danger"
                        : gap.priority === "medium"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {humanise(gap.priority)} priority
                  </Badge>
                  {gap.decisive && <Badge tone="danger">Decisive</Badge>}
                </span>
                {gap.why_it_matters}
              </li>
            ))}
          </ul>
        </div>
      )}

      {requirement.matched.length === 0 && requirement.gaps.length === 0 && (
        <p className="mt-3 text-sm text-slate-500 italic">
          Neither evidenced nor recorded as a gap.
        </p>
      )}
    </li>
  );
}

// --- 8 · artifact status ---------------------------------------------------

function artifactTone(entry: ArtifactEntry) {
  if (entry.outcome === "generated") return "success" as const;
  if (entry.outcome === "failed") return "danger" as const;
  if (entry.outcome === "omitted") return "neutral" as const;
  return "warning" as const;
}

function ArtifactStatusRow({ entry }: { entry: ArtifactEntry }) {
  return (
    <li className="border border-slate-200 rounded-md p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900 flex-1 min-w-0">
          {humanise(entry.artifact_type)}
        </span>
        <Badge tone={artifactTone(entry)}>
          {entry.outcome === null ? "No outcome recorded" : humanise(entry.outcome)}
        </Badge>
        {entry.validation_status !== null && (
          <Badge tone={entry.validation_status === "valid" ? "success" : "danger"}>
            Validation {entry.validation_status}
          </Badge>
        )}
      </div>

      {entry.outcome === "failed" && (
        <p className="mt-2 text-sm text-rose-900">
          Generated but failed schema validation, so its content is withheld
          rather than shown. The failed document is retained server-side for
          diagnosis.
        </p>
      )}
      {entry.outcome === "omitted" && (
        <p className="mt-2 text-sm text-slate-600">
          Not generated — a decision, not a failure.
          {entry.omission_reason !== null && ` ${entry.omission_reason}.`}
        </p>
      )}
      {entry.outcome === "generated" && entry.inclusion_reason !== null && (
        <p className="mt-2 text-sm text-slate-600">{entry.inclusion_reason}.</p>
      )}
    </li>
  );
}

// --- the view --------------------------------------------------------------

export function AnalysisView({ analysis }: { analysis: Analysis }) {
  const portfolioEntry = analysis.artifacts.find(
    (entry) => entry.artifact_type === "portfolio_suggestions",
  );
  const suggestions =
    portfolioEntry?.validation_status === "valid"
      ? asPortfolioSuggestions(portfolioEntry.content)
      : null;

  const inferredCount = analysis.context.filter(
    (element) => element.provenance === "inferred",
  ).length;
  const statedCount = analysis.context.filter(
    (element) => element.provenance === "stated",
  ).length;

  const duration = formatElapsed(analysis.created_at, analysis.completed_at);

  /**
   * Artifact status opens itself when there is something to answer for.
   *
   * A failed or omitted artifact is the case `FR-091` exists for, and burying
   * it behind a closed section is the "unexplained gap" the requirement is
   * meant to prevent. When everything generated cleanly there is nothing to
   * disclose, and the section stays out of the way.
   */
  const artifactsNeedAttention = analysis.artifacts.some(
    (entry) => entry.outcome !== "generated",
  );

  return (
    <div className="space-y-4">
      {/* Run-level honesty first: a degraded or failed run is context for
          everything below it, so it cannot sit at the bottom. */}
      {(analysis.status !== "completed" ||
        analysis.degraded ||
        analysis.timed_out) && (
        <div
          role="status"
          className="border border-amber-300 bg-amber-50 rounded-lg p-4"
        >
          <h2 className="font-semibold text-amber-900">
            {analysis.status === "failed"
              ? "This run failed before finishing"
              : analysis.status === "timed_out"
                ? "This run timed out"
                : "This analysis is incomplete"}
          </h2>
          <p className="text-sm text-amber-900 mt-1">
            {analysis.status === "completed"
              ? "The run finished, but not everything it planned was produced. What was completed is stored and shown below; what was not is marked in Artifact status."
              : "Whatever completed before the run stopped was stored and is shown below. Sections with nothing in them were never reached."}
          </p>
        </div>
      )}

      {/* The legend sits outside every collapsible section on purpose.
          `FR-043` requires the treatment to be explained "without requiring a
          tutorial", and a legend folded inside a closed section explains
          nothing — while the badges it decodes appear on requirements and
          suggestions that are open by default. */}
      <div className="border border-slate-200 bg-white rounded-lg px-5 py-3">
        <ProvenanceLegend />
      </div>

      {/* 1 · the job as understood — leads, per FR-040 */}
      <Section
        step={1}
        title="The job as understood"
        subtitle="What NAIGX took the posting to be asking for"
      >
        {analysis.intent === null ? (
          <Unavailable>
            No intent record was stored. Stage 2 did not complete for this
            analysis.
          </Unavailable>
        ) : (
          <dl className="space-y-4">
            <Field label="Primary objective">
              {analysis.intent.primary_objective}
            </Field>
            {analysis.intent.inferred_scope !== null && (
              <Field label="Scope">{analysis.intent.inferred_scope}</Field>
            )}
          </dl>
        )}

        {analysis.derived_title !== null && (
          <p className="mt-4 text-sm text-slate-600">
            Stored as: <span className="font-medium">{analysis.derived_title}</span>
          </p>
        )}
      </Section>

      {/* 2 · classification */}
      <Section
        step={2}
        title="Classification"
        subtitle="What kind of input this was determined to be"
        defaultOpen={false}
        accent={
          analysis.classification?.was_low_confidence === true ? (
            <Badge tone="warning">Low confidence</Badge>
          ) : undefined
        }
      >
        {analysis.classification === null ? (
          <Unavailable>No classification was stored.</Unavailable>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Determined type">
              {humanise(analysis.classification.determined_type)}
            </Field>
            <Field label="Classifier confidence">
              {analysis.classification.confidence.toFixed(2)}
              {analysis.classification.was_low_confidence && (
                <span className="block text-amber-800 mt-1">
                  Recorded as low confidence — the reasoning that follows rests
                  on a type the system was not sure of.
                </span>
              )}
            </Field>
            {analysis.classification.user_override_type !== null && (
              <Field label="Overridden to">
                {humanise(analysis.classification.user_override_type)}
              </Field>
            )}
            {analysis.sufficiency_level !== null && (
              <Field label="Input sufficiency">
                {humanise(analysis.sufficiency_level)}
              </Field>
            )}
          </dl>
        )}
      </Section>

      {/* 3 · verdict */}
      <Section
        step={3}
        title="Verdict"
        subtitle="Apply now, or build evidence first"
        accent={
          analysis.verdict !== null ? (
            <Badge
              tone={
                analysis.verdict.decision === "apply_now" ? "success" : "warning"
              }
            >
              {verdictLabel(analysis.verdict.decision)}
            </Badge>
          ) : undefined
        }
      >
        {analysis.verdict === null ? (
          <Unavailable>
            No verdict was stored. Stage 7 did not complete for this analysis.
          </Unavailable>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {verdictLabel(analysis.verdict.decision)}
              </p>
              {verdictMeaning(analysis.verdict.decision) !== null && (
                <p className="text-sm text-slate-600 mt-1">
                  {verdictMeaning(analysis.verdict.decision)}
                </p>
              )}
            </div>

            {/* FR-042 — the rationale travels with the conclusion. */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rationale
              </h3>
              <p className="mt-1 text-slate-800">{analysis.verdict.rationale}</p>
            </div>

            {analysis.verdict.alternatives.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Alternatives considered
                </h3>
                <ul className="mt-1 space-y-2">
                  {analysis.verdict.alternatives.map((alternative, index) => (
                    <li
                      key={`${alternative.alternative}-${String(index)}`}
                      className="text-sm text-slate-800"
                    >
                      <span className="font-medium">
                        {alternative.alternative}
                      </span>
                      {" — "}
                      <span className="text-slate-600">
                        {alternative.rejection_reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* FR-045. Null is the honest answer while Stage 11 is deferred. */}
            {analysis.verdict.confidence_band === null ? (
              <Unavailable>
                Confidence is not available. NAIGX does not yet compute a
                confidence band, and showing one here would be inventing the
                measurement. Weigh this verdict on its rationale and on the
                unknowns below.
              </Unavailable>
            ) : (
              <Field label="Confidence">
                {humanise(analysis.verdict.confidence_band)}
              </Field>
            )}
          </div>
        )}
      </Section>

      {/* 4 · requirements */}
      <Section
        step={4}
        title="Requirements"
        subtitle={`What the posting asks for, and what is evidenced${analysis.decisive_gaps.length > 0 ? ` · ${String(analysis.decisive_gaps.length)} decisive gap${analysis.decisive_gaps.length === 1 ? "" : "s"}` : ""}`}
        accent={
          analysis.decisive_gaps.length > 0 ? (
            <Badge tone="danger">
              {analysis.decisive_gaps.length} decisive
            </Badge>
          ) : undefined
        }
      >
        {analysis.requirements.length === 0 ? (
          <Unavailable>
            No requirements were extracted for this analysis.
          </Unavailable>
        ) : (
          <>
            {analysis.decisive_gaps.length > 0 && (
              <p className="text-sm text-rose-900 bg-rose-50 border border-rose-300 rounded-md p-3 mb-4">
                <span className="font-medium">
                  Decisive gaps drive the verdict:{" "}
                </span>
                {analysis.decisive_gaps.join(", ")}. These are the ones worth
                closing first.
              </p>
            )}
            <ul className="space-y-3">
              {analysis.requirements.map((requirement) => (
                <RequirementCard
                  key={requirement.id}
                  requirement={requirement}
                />
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* 5 · portfolio suggestions */}
      <Section
        step={5}
        title="Portfolio suggestions"
        subtitle="What to build to close the decisive gaps"
      >
        {portfolioEntry === undefined ? (
          <Unavailable>
            No portfolio suggestions were planned for this analysis.
          </Unavailable>
        ) : portfolioEntry.outcome === "omitted" ? (
          <Unavailable>
            Omitted — a decision, not a failure.
            {portfolioEntry.omission_reason !== null &&
              ` ${portfolioEntry.omission_reason}.`}
          </Unavailable>
        ) : portfolioEntry.validation_status === "failed" ? (
          <div className="border border-rose-300 bg-rose-50 rounded-md p-4">
            <h3 className="font-medium text-rose-900">
              Suggestions were generated but failed validation
            </h3>
            <p className="text-sm text-rose-900 mt-1">
              The document did not conform to the portfolio-suggestions schema,
              so its content is not shown — a document that failed its contract
              is not evidence of anything. It is retained server-side for
              diagnosis, and re-running the analysis is the way to get a valid
              set.
            </p>
          </div>
        ) : suggestions === null ? (
          <Unavailable>
            The stored artifact could not be read as portfolio suggestions.
          </Unavailable>
        ) : (
          <PortfolioSuggestionsView suggestions={suggestions} />
        )}
      </Section>

      {/* 6 · unknowns — FR-044, listed prominently rather than footnoted */}
      <Section
        step={6}
        title="Unknowns"
        subtitle="What the posting does not say, and what would resolve it"
        accent={
          analysis.unknowns.length > 0 ? (
            <Badge tone="warning">{analysis.unknowns.length}</Badge>
          ) : undefined
        }
      >
        {analysis.unknowns.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nothing was recorded as unknown for this analysis.
          </p>
        ) : (
          <ul className="space-y-3">
            {analysis.unknowns.map((unknown, index) => (
              <li
                key={`${unknown.content}-${String(index)}`}
                className="border border-amber-300 bg-amber-50/60 rounded-md p-3"
              >
                <p className="text-slate-900">{unknown.content}</p>
                {unknown.resolution_hint === null ? (
                  <p className="text-sm text-slate-600 mt-1 italic">
                    No resolution hint was recorded.
                  </p>
                ) : (
                  <p className="text-sm text-slate-700 mt-1">
                    <span className="font-medium">To resolve: </span>
                    {unknown.resolution_hint}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 7 · provenance — FR-043 */}
      <Section
        step={7}
        title="Provenance"
        subtitle={`What was stated versus inferred · ${String(statedCount)} stated, ${String(inferredCount)} inferred`}
        defaultOpen={false}
      >
        {analysis.context.length === 0 ? (
          <Unavailable>No context elements were stored.</Unavailable>
        ) : (
          <ul className="space-y-2">
            {analysis.context.map((element, index) => (
              <li
                key={`${element.content}-${String(index)}`}
                className="border border-slate-200 rounded-md p-3"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <p className="text-sm text-slate-900 flex-1 min-w-0">
                    {element.content}
                  </p>
                  <ProvenanceBadge provenance={element.provenance} />
                  <Badge>{humanise(element.category)}</Badge>
                </div>
                {element.inference_basis !== null && (
                  <p className="text-xs text-slate-600 mt-1.5">
                    Inferred from: {element.inference_basis}
                  </p>
                )}
                {element.resolution_hint !== null && (
                  <p className="text-xs text-slate-600 mt-1.5">
                    To resolve: {element.resolution_hint}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 8 · artifact status — FR-091 */}
      <Section
        step={8}
        title="Artifact status"
        subtitle="What was planned, produced, omitted or failed"
        defaultOpen={artifactsNeedAttention}
        accent={
          artifactsNeedAttention ? (
            <Badge tone="warning">Not all generated</Badge>
          ) : undefined
        }
      >
        {analysis.artifacts.length === 0 ? (
          <Unavailable>
            No artifact plan was stored. Stage 8 did not complete for this
            analysis.
          </Unavailable>
        ) : (
          <ul className="space-y-2">
            {analysis.artifacts.map((entry) => (
              <ArtifactStatusRow key={entry.artifact_type} entry={entry} />
            ))}
          </ul>
        )}
      </Section>

      {/* Run metadata, last: useful, never the point. */}
      <footer className="text-xs text-slate-500 px-1 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          Analysis <code>{analysis.analysis_id}</code>
        </span>
        {formatTimestamp(analysis.created_at) !== null && (
          <span>Started {formatTimestamp(analysis.created_at)}</span>
        )}
        {duration !== null && <span>Took {duration}</span>}
        {analysis.input !== null && (
          <span>
            {analysis.input.character_count.toLocaleString()} characters
            submitted
          </span>
        )}
      </footer>
    </div>
  );
}
