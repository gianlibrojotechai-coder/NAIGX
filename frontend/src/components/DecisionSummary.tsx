/**
 * The decision, first (D-68; `FR-040` — conclusion before reasoning).
 *
 * The owner's feedback on the first real analysis was exact: "I would just
 * like to see if it's apply or build first. Then if it's build, what build
 * will I create, name of it, what app should I use. Then how do I show a
 * proof about it." This component answers those three questions, in that
 * order, from data the analysis already holds — the Stage 7 verdict and the
 * Stage 9 portfolio artifact. It adds nothing: every sentence below is a
 * field of the stored analysis, so the summary cannot disagree with the
 * reasoning it summarises (`SA §3.4`).
 *
 * The full reasoning stays on the page underneath, folded by default when a
 * verdict exists. Provenance, unknowns and the confidence statement are not
 * removed — they are one click away, and the export carries them in full.
 */

import type { Analysis, PortfolioProject } from "../api/types";
import { asPortfolioSuggestions } from "../api/types";
import { humanise } from "../format";
import { Badge } from "./ui";

const verdictLabel = (decision: string): string =>
  decision === "apply_now"
    ? "Apply now"
    : decision === "build_first"
      ? "Build first"
      : humanise(decision);

/** The first sentence of the rationale — the "why" a reader takes in first. */
const firstSentence = (text: string): string => {
  const match = /^(.+?[.!?])(\s|$)/.exec(text.trim());
  return match?.[1] ?? text.trim();
};

/**
 * How to show each kind of evidence. The analysis names the evidence type
 * (`repo`, `deployment`, `loom`, `doc`, …) and what it should show; the
 * instruction is what a person does about it.
 */
const EVIDENCE_HOW: Record<string, { title: string; how: string }> = {
  repo: {
    title: "Publish the code",
    how: "Put the source in a public repository with a README that says what it does and how to run it. Link it from the application.",
  },
  deployment: {
    title: "Put it live",
    how: "Deploy it somewhere a screener can open — a live page, a hosted workflow, or a recording of it running if it cannot be public.",
  },
  loom: {
    title: "Record a screen walkthrough",
    how: "A 3 to 5 minute screen recording (Loom, OBS, or the built-in recorder) that starts from the input, shows each step happening, and ends on the finished result. Narrate what you are doing and why.",
  },
  video: {
    title: "Record a screen walkthrough",
    how: "A 3 to 5 minute screen recording that starts from the input, shows each step happening, and ends on the finished result. Narrate what you are doing and why.",
  },
  doc: {
    title: "Write it up",
    how: "One page: the problem, the tools you chose and why, what broke and how you fixed it. Recruiters read this before they open the code.",
  },
  workflow: {
    title: "Export the workflow",
    how: "Export the automation itself (the n8n or Make JSON, or the platform's own export) and attach it, with a one-line note on each decision point and error path.",
  },
  screenshot: {
    title: "Capture the result",
    how: "Screenshots of the finished output with a caption each, so the proof survives without a click.",
  },
};

const howFor = (type: string): { title: string; how: string } =>
  EVIDENCE_HOW[type.toLowerCase()] ?? {
    title: humanise(type),
    how: "Produce it in a form a screener can open without asking you.",
  };

function BuildCard({ project }: { project: PortfolioProject }) {
  return (
    <div
      className="rise lift rounded-lg border border-slate-200 bg-white p-5"
      style={{ ["--i" as string]: 2 }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        What to build
      </p>
      <h3 className="mt-1 text-xl font-semibold text-slate-900">
        {project.name}
      </h3>
      {project.what_to_build !== undefined && (
        <p className="mt-2 text-sm text-slate-700">{project.what_to_build}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {project.complexity !== undefined && (
          <Badge tone="neutral">{humanise(project.complexity)}</Badge>
        )}
        {project.estimated_effort !== undefined && (
          <Badge tone="info">
            Effort: {humanise(project.estimated_effort)}
          </Badge>
        )}
      </div>
      {project.platforms !== undefined && project.platforms.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Apps and tools to use
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {project.platforms.map((platform) => (
              <li
                key={platform}
                className="rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-sm text-slate-800"
              >
                {platform}
              </li>
            ))}
          </ul>
        </div>
      )}
      {project.workflow !== undefined && project.workflow.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Build it in this order
          </p>
          <ol className="mt-1.5 space-y-1.5 text-sm text-slate-800">
            {project.workflow.map((step, index) => (
              <li
                key={`${String(index)}-${step}`}
                className="rise flex gap-2.5"
                style={{ ["--i" as string]: 4 + index }}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-semibold grid place-items-center"
                >
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ProofCard({ project }: { project: PortfolioProject }) {
  const evidence = project.evidence_to_produce ?? [];
  return (
    <div
      className="rise lift rounded-lg border border-slate-200 bg-white p-5"
      style={{ ["--i" as string]: 3 }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        How to prove it
      </p>
      <h3 className="mt-1 text-xl font-semibold text-slate-900">
        Show it, do not describe it
      </h3>
      {evidence.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          The analysis did not list specific evidence. A public repository, a
          live result and a short screen recording are the default set.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {evidence.map((item, index) => {
            const how = howFor(item.type);
            return (
              <li
                key={`${item.type}-${String(index)}`}
                className="rounded-md border border-slate-200 bg-slate-100 p-3"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {how.title}
                </p>
                <p className="mt-0.5 text-sm text-slate-700">{how.how}</p>
                <p className="mt-1.5 text-xs text-slate-600">
                  <span className="font-medium">It must show: </span>
                  {item.what_it_shows}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function DecisionSummary({ analysis }: { analysis: Analysis }) {
  const verdict = analysis.verdict;
  const portfolioEntry = analysis.artifacts.find(
    (entry) =>
      entry.artifact_type === "portfolio_suggestions" &&
      entry.outcome === "generated",
  );
  const portfolio =
    portfolioEntry === undefined
      ? null
      : asPortfolioSuggestions(portfolioEntry.content);
  const project = portfolio?.projects[0] ?? null;

  if (verdict === null) {
    // Not a job-description analysis, or Stage 7 did not run: the conclusion
    // is the artifact set, and the reasoning below is the product.
    const produced = analysis.artifacts.filter(
      (entry) => entry.outcome === "generated",
    );
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {analysis.classification === null
            ? "Analysis"
            : humanise(analysis.classification.determined_type)}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">
          {analysis.derived_title ?? "Analysis complete"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {produced.length === 0
            ? "The reasoning is below; this path produced no separate artifact."
            : `Produced ${String(produced.length)} artifact${produced.length === 1 ? "" : "s"}: ${produced.map((e) => humanise(e.artifact_type)).join(", ")}. The reasoning and each artifact are below.`}
        </p>
      </div>
    );
  }

  const build = verdict.decision === "build_first";

  return (
    <section aria-labelledby="decision-heading" className="space-y-4">
      <div
        className="rise rounded-lg border border-slate-200 bg-white p-6"
        style={{ ["--i" as string]: 0 }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          The decision
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2
            id="decision-heading"
            className="text-3xl font-semibold tracking-tight text-slate-900"
          >
            {verdictLabel(verdict.decision)}
          </h2>
          <span className="pulse-once rounded">
            <Badge tone={build ? "warning" : "success"}>
              {build
                ? "Build evidence before applying"
                : "Your evidence is enough"}
            </Badge>
          </span>
        </div>
        <p className="mt-3 text-slate-700">
          {firstSentence(verdict.rationale)}
        </p>
        {analysis.decisive_gaps.length > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            Decisive gap{analysis.decisive_gaps.length === 1 ? "" : "s"}:{" "}
            {analysis.decisive_gaps.join(", ")}. A decisive gap is one that
            changes the verdict on its own.
          </p>
        )}
      </div>

      {build && project !== null && (
        <div className="grid gap-4 md:grid-cols-2">
          <BuildCard project={project} />
          <ProofCard project={project} />
        </div>
      )}
      {build && project === null && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">
            No build plan was produced
          </p>
          <p className="mt-1 text-sm text-amber-900">
            The verdict says build first, but the portfolio artifact was not
            generated. Artifact status below says why.
          </p>
        </div>
      )}
      {!build && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            What to do
          </p>
          <p className="mt-1 text-slate-800">
            Apply with the evidence you already have. The requirements section
            below lists which of your work covers each requirement, so the
            application can point at it.
          </p>
        </div>
      )}
    </section>
  );
}
