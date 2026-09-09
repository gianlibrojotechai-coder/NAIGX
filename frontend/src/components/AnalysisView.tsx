/**
 * The stored analysis, presented (`FR-040`–`FR-045`).
 *
 * HIERARCHY IS FIXED, NOT AESTHETIC. `FR-040` requires the problem as
 * understood to lead and to be visible without scrolling, then conclusions,
 * then supporting detail. The order below is that requirement:
 *
 *   1 the input as understood · 2 classification · 3 verdict · 4 requirements
 *   5… the artifacts this path produced · then unknowns · provenance ·
 *   artifact status
 *
 * THE ARTIFACT BLOCK IS PATH-DEPENDENT, THE REST IS NOT. Sections 1-4 and the
 * closing three are asked of every analysis; what sits between them is
 * whatever the classified path actually produced — portfolio suggestions on
 * the job-description path, a workflow review and risk register on the
 * existing-workflow path, assessment feedback and a diagram on the assessment
 * path. `ARTIFACT_PRESENTERS` is that mapping, and an artifact type absent
 * from it still appears in Artifact status, so nothing goes unmentioned merely
 * because no view has been written for it yet.
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

import { useId, useState } from "react";
import type { ReactNode } from "react";

import {
  asArchitectureRecommendation,
  asAssessmentFeedback,
  asBusinessAnalysis,
  asComplexityScore,
  asIntentBrief,
  asInterviewGuidance,
  asMermaidDiagram,
  asPlatformRecommendation,
  asPortfolioSuggestions,
  asRiskAssessment,
  asSkillGapAnalysis,
  asWorkflowRecommendation,
  type Analysis,
  type ArtifactEntry,
  type Requirement,
  asN8nWorkflow,
} from "../api/types";
import {
  formatElapsed,
  formatTimestamp,
  humanise,
  verdictLabel,
  verdictMeaning,
} from "../format";
import { ArchitectureRecommendationView } from "./ArchitectureRecommendation";
import { AssessmentFeedbackView } from "./AssessmentFeedback";
import { BusinessAnalysisView } from "./BusinessAnalysis";
import { ComplexityScoreView } from "./ComplexityScore";
import { IntentBriefView } from "./IntentBrief";
import { InterviewGuidanceView } from "./InterviewGuidance";
import { N8nWorkflowView } from "./N8nWorkflow";
import { ClassificationCorrection } from "./ClassificationCorrection";
import { DecisionSummary } from "./DecisionSummary";
import { CopyArtifactButton, ExportAnalysisButton } from "./ExportControls";
import { MermaidDiagramView } from "./MermaidDiagram";
import { PlatformRecommendationView } from "./PlatformRecommendation";
import { PortfolioSuggestionsView } from "./PortfolioSuggestions";
import { RiskAssessmentView } from "./RiskAssessment";
import { SkillGapAnalysisView } from "./SkillGapAnalysis";
import { WorkflowRecommendationView } from "./WorkflowRecommendation";
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
        <Badge
          tone={requirement.necessity === "must_have" ? "danger" : "neutral"}
        >
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
                <Badge
                  tone={match.strength === "strong" ? "success" : "warning"}
                >
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
          {entry.outcome === null
            ? "No outcome recorded"
            : humanise(entry.outcome)}
        </Badge>
        {entry.validation_status !== null && (
          <Badge
            tone={entry.validation_status === "valid" ? "success" : "danger"}
          >
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

// --- the artifact block ----------------------------------------------------

/**
 * How one artifact type is presented, when the path produced one.
 *
 * `render` returns null when the stored document cannot be read as its type.
 * That is a real case — the content is opaque, and narrowing it is the only
 * honest way to render it — so the presenter reports the failure rather than
 * drawing half an object.
 */
interface ArtifactPresenter {
  readonly title: string;
  readonly subtitle: string;
  readonly render: (content: unknown, analysisId: string) => ReactNode | null;
}

const ARTIFACT_PRESENTERS: Readonly<Record<string, ArtifactPresenter>> = {
  skill_gap_analysis: {
    title: "Skill gap analysis",
    subtitle: "Every requirement classified, and the order to close the gaps",
    render: (content) => {
      const gaps = asSkillGapAnalysis(content);
      return gaps === null ? null : <SkillGapAnalysisView analysis={gaps} />;
    },
  },
  portfolio_suggestions: {
    title: "Portfolio suggestions",
    subtitle: "What to build to close the decisive gaps",
    render: (content) => {
      const suggestions = asPortfolioSuggestions(content);
      return suggestions === null ? null : (
        <PortfolioSuggestionsView suggestions={suggestions} />
      );
    },
  },
  n8n_workflow: {
    title: "n8n workflow",
    subtitle:
      "An import file for n8n, with the guide beside it — a scaffold you finish by hand",
    render: (content, analysisId) => {
      const workflow = asN8nWorkflow(content);
      return workflow === null ? null : (
        <N8nWorkflowView workflow={workflow} analysisId={analysisId} />
      );
    },
  },
  intent_brief: {
    title: "Intent brief",
    subtitle:
      "What the input asks for, as understood — available before reasoning, and not a conclusion",
    render: (content) => {
      const brief = asIntentBrief(content);
      return brief === null ? null : <IntentBriefView brief={brief} />;
    },
  },
  interview_guidance: {
    title: "Interview guidance",
    subtitle:
      "The competencies this posting implies, and what to be ready to say",
    render: (content) => {
      const guidance = asInterviewGuidance(content);
      return guidance === null ? null : (
        <InterviewGuidanceView guidance={guidance} />
      );
    },
  },
  workflow_recommendation: {
    title: "Workflow review",
    subtitle: "The workflow as identified, then what is wrong with it",
    render: (content) => {
      const recommendation = asWorkflowRecommendation(content);
      return recommendation === null ? null : (
        <WorkflowRecommendationView recommendation={recommendation} />
      );
    },
  },
  risk_assessment: {
    title: "Risk assessment",
    subtitle: "Each risk scored, attributed to a component, and mitigated",
    render: (content) => {
      const assessment = asRiskAssessment(content);
      return assessment === null ? null : (
        <RiskAssessmentView assessment={assessment} />
      );
    },
  },
  assessment_feedback: {
    title: "Assessment feedback",
    subtitle: "The approach, its accepted costs, and the alternatives rejected",
    render: (content) => {
      const feedback = asAssessmentFeedback(content);
      return feedback === null ? null : (
        <AssessmentFeedbackView feedback={feedback} />
      );
    },
  },
  business_analysis: {
    title: "Business analysis",
    subtitle:
      "The problem as understood — objectives, constraints and unknowns, before any design",
    render: (content) => {
      const analysis = asBusinessAnalysis(content);
      return analysis === null ? null : (
        <BusinessAnalysisView analysis={analysis} />
      );
    },
  },
  architecture_recommendation: {
    title: "Architecture recommendation",
    subtitle:
      "The design to build from — each component with what it takes in and produces",
    render: (content) => {
      const recommendation = asArchitectureRecommendation(content);
      return recommendation === null ? null : (
        <ArchitectureRecommendationView recommendation={recommendation} />
      );
    },
  },
  platform_recommendation: {
    title: "Platform recommendation",
    subtitle:
      "The platform, the criteria that chose it, and the alternatives rejected",
    render: (content) => {
      const recommendation = asPlatformRecommendation(content);
      return recommendation === null ? null : (
        <PlatformRecommendationView recommendation={recommendation} />
      );
    },
  },
  complexity_score: {
    title: "Complexity score",
    subtitle:
      "Five factors scored against fixed anchors, and the arithmetic that combines them",
    render: (content) => {
      const score = asComplexityScore(content);
      return score === null ? null : <ComplexityScoreView score={score} />;
    },
  },
  mermaid_diagram: {
    title: "Architecture diagram",
    subtitle: "The components, drawn from the design rather than beside it",
    render: (content) => {
      const diagram = asMermaidDiagram(content);
      return diagram === null ? null : <MermaidDiagramView diagram={diagram} />;
    },
  },
};

/**
 * One artifact, in whichever of its five states it is actually in.
 *
 * The four non-rendering states are the point. `FR-091` requires a gap to be
 * labelled rather than left blank, and "was never planned", "was deliberately
 * omitted", "was generated and failed its schema" and "is stored but could not
 * be read" are four different facts a reader needs kept apart.
 */
function ArtifactSection({
  entry,
  presenter,
  step,
  analysisId,
}: {
  entry: ArtifactEntry;
  presenter: ArtifactPresenter;
  step: number;
  analysisId: string;
}) {
  const rendered =
    entry.validation_status === "valid"
      ? presenter.render(entry.content, analysisId)
      : null;

  return (
    <Section
      step={step}
      title={presenter.title}
      subtitle={presenter.subtitle}
      // `FR-053` — every artifact has a copy control. Offered only where there
      // is a valid document to copy: a control on a failed artifact would copy
      // content `DB §4.4` says is not presentable.
      //
      // `action`, not `accent`: the accent slot renders inside the section's
      // own toggle button, and a button inside a button is invalid HTML.
      action={
        rendered === null ? undefined : (
          <CopyArtifactButton
            analysisId={analysisId}
            artifactType={entry.artifact_type}
          />
        )
      }
    >
      {entry.outcome === "omitted" ? (
        <Unavailable>
          Omitted — a decision, not a failure.
          {entry.omission_reason !== null && ` ${entry.omission_reason}.`}
        </Unavailable>
      ) : entry.validation_status === "failed" ? (
        <div className="border border-rose-300 bg-rose-50 rounded-md p-4">
          <h3 className="font-medium text-rose-900">
            Generated, but it failed validation
          </h3>
          <p className="text-sm text-rose-900 mt-1">
            The document did not conform to its published schema, so its content
            is not shown — a document that failed its contract is not evidence
            of anything. It is retained server-side for diagnosis, and
            re-running the analysis is the way to get a valid one.
          </p>
        </div>
      ) : entry.outcome !== "generated" ? (
        <Unavailable>
          This artifact was planned but no outcome was recorded. The run did not
          reach it.
        </Unavailable>
      ) : rendered === null ? (
        <Unavailable>
          The stored artifact could not be read as{" "}
          {presenter.title.toLowerCase()}. It is retained server-side; nothing
          is shown here rather than a partial document presented as whole.
        </Unavailable>
      ) : (
        rendered
      )}
    </Section>
  );
}

// --- the view --------------------------------------------------------------

export function AnalysisView({
  analysis,
  onCorrectClassification,
  correcting = false,
}: {
  analysis: Analysis;
  /** `FR-014` — re-runs with the type fixed. Absent hides the control. */
  onCorrectClassification?: (type: string) => void;
  correcting?: boolean;
}) {
  /**
   * The artifacts this path produced *and* has a view for, in plan order.
   *
   * Plan order is the pipeline's own order, which is the order the reasoning
   * produced them in. Anything without a presenter is skipped here and still
   * appears in Artifact status, so it is never silently dropped.
   */
  const presentable = analysis.artifacts.flatMap((entry) => {
    const presenter = ARTIFACT_PRESENTERS[entry.artifact_type];
    return presenter === undefined ? [] : [{ entry, presenter }];
  });

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

  // D-68 — the decision first; the full reasoning folded when a verdict exists
  // to summarise. Folded, not removed: every section below still renders on
  // demand, and the export carries all of it regardless.
  const [showReasoning, setShowReasoning] = useState(analysis.verdict === null);
  const reasoningId = useId();

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

      <DecisionSummary analysis={analysis} />

      {/* The legend sits outside every collapsible section on purpose.
          `FR-043` requires the treatment to be explained "without requiring a
          tutorial", and a legend folded inside a closed section explains
          nothing — while the badges it decodes appear on requirements and
          suggestions that are open by default. */}
      <div className="border border-slate-200 bg-white rounded-lg px-5 py-3 flex items-start justify-between gap-4 flex-wrap">
        <ProvenanceLegend />
        {/* `FR-050`. Beside the legend rather than at the foot of the page:
            the export carries the same provenance distinctions the legend
            decodes, and the two belong in the same glance. */}
        <ExportAnalysisButton analysisId={analysis.analysis_id} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setShowReasoning((value) => !value);
          }}
          aria-expanded={showReasoning}
          aria-controls={reasoningId}
          className="px-4 py-2 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
        >
          {showReasoning
            ? "Hide the full reasoning"
            : "Show the full reasoning"}
        </button>
        <p className="text-sm text-slate-600">
          Requirements, evidence, provenance and unknowns — everything the
          decision rests on.
        </p>
      </div>

      <div id={reasoningId} className={showReasoning ? "space-y-4" : "hidden"}>
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
              Stored as:{" "}
              <span className="font-medium">{analysis.derived_title}</span>
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
                    Recorded as low confidence — the reasoning that follows
                    rests on a type the system was not sure of.
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

          {/* `FR-014` — "a control allows reclassification to any supported
            type". It re-submits rather than editing; `API §7.5` creates a new
            analysis and keeps this one. */}
          {analysis.classification !== null &&
            onCorrectClassification !== undefined && (
              <ClassificationCorrection
                determinedType={analysis.classification.determined_type}
                wasLowConfidence={analysis.classification.was_low_confidence}
                onCorrect={onCorrectClassification}
                busy={correcting}
              />
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
                  analysis.verdict.decision === "apply_now"
                    ? "success"
                    : "warning"
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
                <p className="mt-1 text-slate-800">
                  {analysis.verdict.rationale}
                </p>
              </div>

              {/* `FR-034` — the standard, beside the conclusion it produced. The
                rationale says what was decided; this says what it was measured
                against, which is what lets a reader dispute the standard. */}
              {analysis.verdict.criteria_applied !== null && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Criteria applied
                  </h3>
                  <p className="mt-1 text-slate-800">
                    {analysis.verdict.criteria_applied}
                  </p>
                </div>
              )}

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

        {/* 5… · what this path produced. Nothing renders when the path has no
          artifact types — `business_requirement` is currently one such path,
          and an empty block is the honest rendering of that. */}
        {presentable.map(({ entry, presenter }, index) => (
          <ArtifactSection
            key={entry.artifact_type}
            entry={entry}
            presenter={presenter}
            step={5 + index}
            analysisId={analysis.analysis_id}
          />
        ))}

        {/* unknowns — FR-044, listed prominently rather than footnoted */}
        <Section
          step={5 + presentable.length}
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

        {/* provenance — FR-043 */}
        <Section
          step={6 + presentable.length}
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

        {/* artifact status — FR-091. Always last, and always present: it is the
          one section that accounts for every planned artifact, including the
          ones no view above knows how to draw. */}
        <Section
          step={7 + presentable.length}
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
      </div>

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
