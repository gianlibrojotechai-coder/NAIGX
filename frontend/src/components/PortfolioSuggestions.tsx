/**
 * The `portfolio_suggestions` artifact — what to build, in rank order.
 *
 * Rendered from known keys only. The schema leaves `additionalProperties`
 * open and the backend parser reads known keys and ignores others, so this
 * matches: an unrecognised field is skipped, not surfaced as raw JSON.
 *
 * `reusability.provenance` is fixed to `inferred` by the parser, so the claim
 * is always labelled as an inference with the basis it rests on. That is the
 * one place in this artifact where a reader most needs to know they are being
 * told a guess.
 */

import type { PortfolioProject, PortfolioSuggestions } from "../api/types";
import { humanise } from "../format";
import { Badge, ProvenanceBadge } from "./ui";

function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc list-outside ml-4 space-y-0.5 text-sm text-slate-800">
      {items.map((item, index) => (
        <li key={`${item}-${String(index)}`}>{item}</li>
      ))}
    </ul>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </h5>
      {children}
    </div>
  );
}

function Project({ project }: { project: PortfolioProject }) {
  return (
    <article className="border border-slate-200 rounded-md overflow-hidden">
      <header className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-semibold grid place-items-center">
          {project.rank}
        </span>
        <h4 className="font-semibold text-slate-900 flex-1 min-w-0">
          {project.name}
        </h4>
        {project.complexity !== undefined && (
          <Badge>{humanise(project.complexity)}</Badge>
        )}
        {project.estimated_effort !== undefined && (
          <Badge tone="info">{humanise(project.estimated_effort)}</Badge>
        )}
      </header>

      <div className="p-4 space-y-4">
        {project.primary_gaps !== undefined &&
          project.primary_gaps.length > 0 && (
            <Detail label="Closes these gaps">
              <div className="flex flex-wrap gap-1.5">
                {project.primary_gaps.map((gap) => (
                  <Badge key={gap} tone="danger">
                    {gap}
                  </Badge>
                ))}
              </div>
            </Detail>
          )}

        {project.why_this_project !== undefined && (
          <Detail label="Why this project">
            <p className="text-sm text-slate-800">{project.why_this_project}</p>
          </Detail>
        )}

        {project.business_problem !== undefined && (
          <Detail label="Business problem">
            <p className="text-sm text-slate-800">{project.business_problem}</p>
          </Detail>
        )}

        {project.what_to_build !== undefined && (
          <Detail label="What to build">
            <p className="text-sm text-slate-800">{project.what_to_build}</p>
          </Detail>
        )}

        {project.workflow !== undefined && project.workflow.length > 0 && (
          <Detail label="Workflow">
            <ol className="list-decimal list-outside ml-4 space-y-0.5 text-sm text-slate-800">
              {project.workflow.map((step, index) => (
                <li key={`${step}-${String(index)}`}>{step}</li>
              ))}
            </ol>
          </Detail>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {project.platforms !== undefined && project.platforms.length > 0 && (
            <Detail label="Platforms">
              <List items={project.platforms} />
            </Detail>
          )}
          {project.technical_concepts !== undefined &&
            project.technical_concepts.length > 0 && (
              <Detail label="Technical concepts">
                <List items={project.technical_concepts} />
              </Detail>
            )}
        </div>

        {project.implementation !== undefined &&
          project.implementation.steps.length > 0 && (
            <Detail
              label={`How to build it in ${project.implementation.platform}`}
            >
              <ol className="space-y-2">
                {project.implementation.steps.map((item) => (
                  <li
                    key={`${String(item.step)}-${item.node}`}
                    className="text-sm text-slate-800"
                  >
                    <span className="font-medium">Step {item.step} · </span>
                    <span className="font-mono">{item.node}</span>
                    <span className="text-slate-600"> — {item.purpose}</span>
                    <ul className="mt-1 ml-4 list-disc space-y-0.5 text-slate-700">
                      {item.setup.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="mt-0.5 ml-4 text-xs text-slate-600">
                      Credential: {item.credential ?? "none"}
                    </p>
                  </li>
                ))}
              </ol>
              {project.implementation.notes.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                  {project.implementation.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </Detail>
          )}

        {project.evidence_to_produce !== undefined &&
          project.evidence_to_produce.length > 0 && (
            <Detail label="Evidence to produce">
              <ul className="space-y-1.5">
                {project.evidence_to_produce.map((evidence, index) => (
                  <li
                    key={`${evidence.type}-${String(index)}`}
                    className="flex items-start gap-2 text-sm text-slate-800"
                  >
                    <Badge>{humanise(evidence.type)}</Badge>
                    <span className="flex-1 min-w-0">
                      {evidence.what_it_shows}
                    </span>
                  </li>
                ))}
              </ul>
            </Detail>
          )}

        {project.secondary_capabilities !== undefined &&
          project.secondary_capabilities.length > 0 && (
            <Detail label="Also demonstrates">
              <List items={project.secondary_capabilities} />
            </Detail>
          )}

        {project.why_not_consolidated !== undefined && (
          <Detail label="Why it cannot fold into another project">
            <p className="text-sm text-slate-800">
              {project.why_not_consolidated}
            </p>
          </Detail>
        )}

        {project.reusability !== undefined && (
          <Detail label="Reusability">
            <div className="text-sm text-slate-800 space-y-1">
              <p className="flex items-start gap-2">
                <ProvenanceBadge provenance="inferred" />
                <span className="flex-1 min-w-0">
                  {project.reusability.claim}
                </span>
              </p>
              <p className="text-slate-600 text-xs">
                Based on: {project.reusability.basis}
              </p>
            </div>
          </Detail>
        )}

        {project.portfolio_value !== undefined && (
          <Detail label="Portfolio value">
            <p className="text-sm text-slate-800">{project.portfolio_value}</p>
          </Detail>
        )}
      </div>
    </article>
  );
}

export function PortfolioSuggestionsView({
  suggestions,
}: {
  suggestions: PortfolioSuggestions;
}) {
  // Rank is a total order the generator is required to produce; sorting here
  // means a display that stays correct even if the stored array does not.
  const ordered = [...suggestions.projects].sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3">
        <span className="font-medium">Why these projects: </span>
        {suggestions.consolidation_rationale}
      </p>

      {ordered.map((project) => (
        <Project
          key={`${String(project.rank)}-${project.name}`}
          project={project}
        />
      ))}
    </div>
  );
}
