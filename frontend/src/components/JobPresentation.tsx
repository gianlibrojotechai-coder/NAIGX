/**
 * The one-page presentation of a job-description analysis (D-93).
 *
 * The owner's brief: "what I just want to see as the results is the
 * description of the job, the workflow that I will need to create, the apps
 * that I will need to use, build or apply — I don't need the req-4/6,
 * confidence, something visual, like NAIGX will give a single web page
 * presentation."
 *
 * So this view shows four things and nothing else: the job in plain words,
 * the verdict, the workflow to build (as a diagram, then as steps), and the
 * apps it runs on. Requirement ids, provenance badges, the confidence table
 * and the alternatives stay in the full view (`AnalysisView`), one click away
 * — the reasoning is not removed, it is not *led* with.
 *
 * Everything here is read from data the analysis already holds: the Stage 7
 * verdict, the `skill_gap_analysis`, `portfolio_suggestions` and
 * `n8n_workflow` artifacts and the intent brief. No new API, no new
 * generation. If an artifact is absent the panel that needs it says so in one
 * line rather than disappearing (`FR-093`).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  asIntentBrief,
  asN8nWorkflow,
  asPortfolioSuggestions,
  asSkillGapAnalysis,
  type Analysis,
  type N8nWorkflow,
  type PortfolioProject,
  type SkillGapAnalysis,
} from "../api/types";
import { humanise, verdictLabel } from "../format";
import { ExportAnalysisButton } from "./ExportControls";

// --- data shaping -----------------------------------------------------------

const artifactContent = (analysis: Analysis, type: string): unknown => {
  const entry = analysis.artifacts.find(
    (a) => a.artifact_type === type && a.outcome === "generated",
  );
  return entry?.content ?? null;
};

const firstSentence = (text: string): string => {
  const match = /^(.+?[.!?])(\s|$)/.exec(text.trim());
  return match?.[1] ?? text.trim();
};

/**
 * The role, as a title. The posting's first non-empty line is usually the
 * job title; when the input is not in the response (an analysis opened from
 * history without its content) the stored title or the objective stands in.
 */
const roleTitle = (analysis: Analysis): string => {
  const content = analysis.input?.content;
  if (typeof content === "string") {
    const line = content
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l !== "");
    if (line !== undefined && line.length <= 90) return line;
  }
  if (analysis.derived_title !== null) return analysis.derived_title;
  return "The role";
};

/** A workflow step: what the diagram draws and the list explains. */
interface Step {
  readonly name: string;
  readonly purpose: string | null;
  readonly app: string | null;
}

/** `n8n-nodes-base.googleSheets` → "Google Sheets". */
const appFromNodeType = (type: string): string | null => {
  const known: Readonly<Record<string, string>> = {
    httpRequest: "HTTP Request",
    webhook: "Webhook",
    scheduleTrigger: "Schedule",
    manualTrigger: "Manual trigger",
    gmail: "Gmail",
    gmailTrigger: "Gmail",
    googleSheets: "Google Sheets",
    googleDrive: "Google Drive",
    googleCalendar: "Google Calendar",
    slack: "Slack",
    hubspot: "HubSpot",
    notion: "Notion",
    airtable: "Airtable",
    openAi: "OpenAI",
    telegram: "Telegram",
    telegramTrigger: "Telegram",
    postgres: "PostgreSQL",
    mySql: "MySQL",
    code: "Code",
    set: "Set",
    if: "IF",
    switch: "Switch",
    merge: "Merge",
    splitInBatches: "Loop",
    wait: "Wait",
    emailSend: "Email",
    microsoftExcel: "Excel",
    microsoftOutlook: "Outlook",
    microsoftTeams: "Teams",
    salesforce: "Salesforce",
    stripe: "Stripe",
    shopify: "Shopify",
    zendesk: "Zendesk",
    jira: "Jira",
    github: "GitHub",
    twilio: "Twilio",
  };
  if (type === "n8n-nodes-base.noOp" || type === "n8n-nodes-base.stickyNote")
    return null;
  const bare = type
    .replace(/^@?[\w-]+\/[\w-]+\./, "")
    .replace(/^n8n-nodes-base\./, "");
  if (bare in known) return known[bare] ?? null;
  if (/agent|lmChat|openAi|anthropic|gemini/i.test(bare)) return "AI model";
  return humanise(bare.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase());
};

const stepsFor = (
  project: PortfolioProject | null,
  workflow: N8nWorkflow | null,
): readonly Step[] => {
  if (
    project?.implementation !== undefined &&
    project.implementation.steps.length > 0
  ) {
    return project.implementation.steps.map((s) => ({
      name: s.node,
      purpose: s.purpose,
      app: null,
    }));
  }
  if (workflow !== null) {
    return workflow.nodes
      .filter((n) => n.type !== "n8n-nodes-base.stickyNote")
      .map((n) => ({
        name: n.name,
        purpose: null,
        app: appFromNodeType(n.type),
      }));
  }
  if (project?.workflow !== undefined) {
    return project.workflow.map((s) => ({ name: s, purpose: null, app: null }));
  }
  return [];
};

const appsFor = (
  project: PortfolioProject | null,
  workflow: N8nWorkflow | null,
): readonly string[] => {
  const seen = new Map<string, string>();
  const add = (name: string | null) => {
    if (name === null) return;
    const key = name.trim().toLowerCase();
    if (key === "" || seen.has(key)) return;
    seen.set(key, name.trim());
  };
  if (project?.implementation !== undefined)
    add(project.implementation.platform);
  project?.platforms?.forEach(add);
  workflow?.nodes.forEach((n) => {
    add(appFromNodeType(n.type));
  });
  // Generic n8n building blocks are not "apps you will use".
  const building = new Set([
    "code",
    "set",
    "if",
    "switch",
    "merge",
    "loop",
    "wait",
    "manual trigger",
    "no op",
  ]);
  return [...seen.values()].filter((n) => !building.has(n.toLowerCase()));
};

const mermaidFor = (steps: readonly Step[]): string => {
  const label = (s: string) => s.replace(/["[\]{}()<>|]/g, " ").trim();
  const lines = ["flowchart LR"];
  steps.forEach((step, i) => {
    const text =
      step.app !== null &&
      !step.name.toLowerCase().includes(step.app.toLowerCase())
        ? `${label(step.name)}<br/><i>${label(step.app)}</i>`
        : label(step.name);
    lines.push(`  s${String(i)}["${text}"]`);
    if (i === 0) lines.push(`  class s${String(i)} trigger`);
    if (i === steps.length - 1 && steps.length > 1)
      lines.push(`  class s${String(i)} last`);
    if (i > 0) lines.push(`  s${String(i - 1)} --> s${String(i)}`);
  });
  lines.push(
    "  classDef default fill:#17181d,stroke:#383b46,color:#f1f5f9,rx:10,ry:10",
  );
  lines.push(
    "  classDef trigger fill:#0b1f2e,stroke:#22d3ee,color:#bae6fd,rx:10,ry:10",
  );
  lines.push(
    "  classDef last fill:#0b2a1e,stroke:#34d399,color:#a7f3d0,rx:10,ry:10",
  );
  return lines.join("\n");
};

// --- pieces -----------------------------------------------------------------

function FlowDiagram({ steps }: { steps: readonly Step[] }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const domId = useRef(
    `present-${Math.random().toString(36).slice(2, 10)}`,
  ).current;
  const source = mermaidFor(steps);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            fontFamily: "Inter Variable, Inter, system-ui, sans-serif",
            fontSize: "14px",
            lineColor: "#9aa0ae",
            primaryColor: "#17181d",
            primaryTextColor: "#f1f5f9",
            primaryBorderColor: "#383b46",
          },
          flowchart: { useMaxWidth: true, curve: "basis", padding: 12 },
        });
        const out = await mermaid.render(domId, source);
        if (!cancelled) setSvg(out.svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [source, domId]);

  const description = `Workflow with ${String(steps.length)} steps: ${steps.map((s) => s.name).join(", then ")}.`;

  if (failed || steps.length === 0) return null;
  return (
    <figure className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-100/60 p-4">
      {svg === null ? (
        <div
          className="beam-track h-16 rounded-md bg-slate-200/40"
          aria-hidden="true"
        />
      ) : (
        <div
          role="img"
          aria-label={description}
          className="[&_svg]:mx-auto [&_svg]:max-w-none"
          // Mermaid's output with `securityLevel: "strict"` — the same trust
          // boundary MermaidDiagram.tsx already relies on.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "accent" | "success" | "warning";
}) {
  const ring = {
    accent: "text-accent-300 border-accent-500/40",
    success: "text-emerald-700 border-emerald-300",
    warning: "text-amber-700 border-amber-300",
  }[tone];
  return (
    <div className={`rise rounded-lg border bg-white px-5 py-4 ${ring}`}>
      <p className="font-serif text-4xl leading-none">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  children,
  index,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  index: number;
}) {
  return (
    <section
      className="rise rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
      style={{ ["--i" as string]: index }}
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-400">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-serif text-2xl text-slate-900 sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const APP_HUES = [
  "#22d3ee",
  "#34d399",
  "#fcd34d",
  "#fb7185",
  "#818cf8",
  "#38bdf8",
  "#f472b6",
  "#a3e635",
];

function AppTile({ name, index }: { name: string; index: number }) {
  const hue = APP_HUES[index % APP_HUES.length] ?? "#22d3ee";
  const initials = name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <li
      className="lift rise flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-100/70 px-3 py-2.5"
      style={{ ["--i" as string]: index + 3 }}
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md font-mono text-sm font-bold text-slate-50"
        style={{ background: hue }}
      >
        {initials}
      </span>
      <span className="text-sm font-medium text-slate-800">{name}</span>
    </li>
  );
}

function GapChip({
  name,
  tone,
}: {
  name: string;
  tone: "danger" | "warning" | "neutral";
}) {
  const cls = {
    danger: "border-rose-300 bg-rose-50 text-rose-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    neutral: "border-slate-300 bg-slate-100 text-slate-700",
  }[tone];
  return (
    <li className={`rounded-full border px-3 py-1 text-sm ${cls}`}>{name}</li>
  );
}

const downloadWorkflow = (workflow: N8nWorkflow, analysisId: string) => {
  const blob = new Blob([JSON.stringify(workflow, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `naigx-n8n-workflow-${analysisId}.json`;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
};

// --- the page ---------------------------------------------------------------

export function JobPresentation({
  analysis,
  onShowFull,
}: {
  analysis: Analysis;
  onShowFull: () => void;
}) {
  const brief = asIntentBrief(artifactContent(analysis, "intent_brief"));
  const gapAnalysis: SkillGapAnalysis | null = asSkillGapAnalysis(
    artifactContent(analysis, "skill_gap_analysis"),
  );
  const portfolio = asPortfolioSuggestions(
    artifactContent(analysis, "portfolio_suggestions"),
  );
  const workflow = asN8nWorkflow(artifactContent(analysis, "n8n_workflow"));

  const projects =
    portfolio === null
      ? []
      : [...portfolio.projects].sort((a, b) => a.rank - b.rank);
  const top = projects[0] ?? null;
  const others = projects.slice(1, 3);
  const steps = stepsFor(top, workflow);
  const apps = appsFor(top, workflow);

  const verdict = analysis.verdict;
  const build = verdict?.decision === "build_first";
  const title = roleTitle(analysis);
  const objective =
    brief?.objective.content ?? analysis.intent?.primary_objective ?? null;
  const scope =
    brief?.inferred_scope ?? analysis.intent?.inferred_scope ?? null;

  const have =
    gapAnalysis?.requirements.filter((r) => r.status === "evidenced") ?? [];
  const gaps =
    gapAnalysis?.requirements.filter((r) => r.status === "gap") ?? [];
  const decisive = gaps.filter((g) => g.gap?.decisive === true);
  const buildable = gaps.filter(
    (g) => g.gap?.decisive !== true && g.gap?.buildable === true,
  );
  const rest = gaps.filter(
    (g) => g.gap?.decisive !== true && g.gap?.buildable !== true,
  );
  const total = gapAnalysis?.summary.requirements ?? have.length + gaps.length;
  const coverage = total === 0 ? 0 : Math.round((have.length / total) * 100);

  return (
    <div className="space-y-6">
      {/* 1 · the job and the verdict */}
      <section
        className="rise relative isolate overflow-hidden rounded-xl border border-slate-200 bg-white p-6 sm:p-10"
        style={{ ["--i" as string]: 0 }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{
            background: build
              ? "radial-gradient(circle, #fcd34d, transparent 65%)"
              : "radial-gradient(circle, #34d399, transparent 65%)",
          }}
        />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-400">
              NAIGX · Job fit
            </p>
            <h1 className="mt-2 font-serif text-4xl leading-tight text-slate-900 sm:text-5xl">
              {title}
            </h1>
            {objective !== null && (
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-700">
                {objective}
              </p>
            )}
            {scope !== null && (
              <p className="mt-3 max-w-2xl text-sm text-slate-600">{scope}</p>
            )}
            {brief !== null && brief.secondary_objectives.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {brief.secondary_objectives.slice(0, 4).map((o) => (
                  <li
                    key={o.content}
                    className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700"
                  >
                    {firstSentence(o.content)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col justify-between gap-5">
            {verdict === null ? (
              <p className="text-sm text-slate-500 italic">
                No verdict was reached for this analysis.
              </p>
            ) : (
              <div
                className={`pulse-once rounded-xl border-2 p-5 ${
                  build
                    ? "border-amber-300 bg-amber-50"
                    : "border-emerald-300 bg-emerald-50"
                }`}
              >
                <p
                  className={`font-mono text-[11px] font-semibold uppercase tracking-[0.2em] ${build ? "text-amber-700" : "text-emerald-600"}`}
                >
                  The call
                </p>
                <p
                  className={`mt-1 font-serif text-3xl ${build ? "text-amber-900" : "text-emerald-900"}`}
                >
                  {verdictLabel(verdict.decision)}
                </p>
                <p
                  className={`mt-3 text-sm leading-relaxed ${build ? "text-amber-900" : "text-emerald-900"}`}
                >
                  {firstSentence(verdict.rationale)}
                </p>
              </div>
            )}

            {gapAnalysis !== null && (
              <div className="flex items-center gap-4">
                <svg
                  viewBox="0 0 44 44"
                  className="h-16 w-16 shrink-0"
                  role="img"
                  aria-label={`${String(coverage)} percent of requirements covered`}
                >
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="#262830"
                    strokeWidth="5"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke={build ? "#fcd34d" : "#34d399"}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${String((coverage / 100) * 113)} 113`}
                    transform="rotate(-90 22 22)"
                  />
                  <text
                    x="22"
                    y="26"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="#f1f5f9"
                  >
                    {coverage}%
                  </text>
                </svg>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">
                    {have.length} of {total}
                  </span>{" "}
                  requirements you already cover.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2 · at a glance */}
      {gapAnalysis !== null && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat value={total} label="Requirements" tone="accent" />
          <Stat value={have.length} label="You already have" tone="success" />
          <Stat value={gaps.length} label="To close" tone="warning" />
        </div>
      )}

      {/* 3 · the workflow */}
      <Panel
        index={2}
        eyebrow={
          build ? "What to build first" : "The workflow this role expects"
        }
        title={top?.name ?? "The workflow"}
      >
        {top === null && steps.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            {build
              ? "No build suggestion was produced for this analysis."
              : "The verdict is apply now, so no build was suggested — the full view lists what this role expects of you."}
          </p>
        ) : (
          <div className="space-y-6">
            {top?.business_problem !== undefined && (
              <p className="max-w-3xl text-base leading-relaxed text-slate-700">
                {top.business_problem}
              </p>
            )}
            {top?.what_to_build !== undefined && (
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                {top.what_to_build}
              </p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {top?.estimated_effort !== undefined && (
                <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-sky-900">
                  Effort: {humanise(top.estimated_effort)}
                </span>
              )}
              {top?.complexity !== undefined && (
                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-slate-700">
                  Complexity: {humanise(top.complexity)}
                </span>
              )}
              {top?.implementation !== undefined && (
                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-slate-700">
                  Built in {top.implementation.platform}
                </span>
              )}
            </div>

            <FlowDiagram steps={steps} />

            {steps.length > 0 && (
              <ol className="grid gap-2 sm:grid-cols-2">
                {steps.map((step, i) => (
                  <li
                    key={`${String(i)}-${step.name}`}
                    className="rise flex gap-3 rounded-lg border border-slate-200 bg-slate-100/60 p-3"
                    style={{ ["--i" as string]: i + 4 }}
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-400 font-mono text-[11px] font-bold text-slate-50"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {step.name}
                      </p>
                      {step.purpose !== null && (
                        <p className="mt-0.5 text-sm text-slate-600">
                          {step.purpose}
                        </p>
                      )}
                      {step.purpose === null && step.app !== null && (
                        <p className="mt-0.5 text-sm text-slate-600">
                          {step.app}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {workflow !== null && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    downloadWorkflow(workflow, analysis.analysis_id);
                  }}
                  className="rounded-md bg-accent-400 px-4 py-2 font-mono text-sm font-semibold uppercase tracking-[0.12em] text-slate-50 hover:bg-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2"
                >
                  Download for n8n ↓
                </button>
                <p className="text-sm text-slate-600">
                  A scaffold: the nodes are wired, the settings are yours to
                  fill in.
                </p>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* 4 · the apps */}
      <Panel index={3} eyebrow="Your toolkit" title="Apps you will use">
        {apps.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No specific apps were named for this workflow.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app, i) => (
              <AppTile key={app} name={app} index={i} />
            ))}
          </ul>
        )}
      </Panel>

      {/* 5 · build or apply, in one breath */}
      {gapAnalysis !== null && (
        <Panel
          index={4}
          eyebrow={build ? "Why build first" : "Why apply now"}
          title={
            build
              ? "Close these, then apply"
              : "You are ready — here is what to sharpen"
          }
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {build
                  ? "Must close before applying"
                  : "Gaps the role would forgive"}
              </h3>
              {decisive.length === 0 &&
              buildable.length === 0 &&
              rest.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  Nothing — every requirement is evidenced.
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {decisive.map((g) => (
                    <GapChip key={g.id} name={g.name} tone="danger" />
                  ))}
                  {buildable.map((g) => (
                    <GapChip key={g.id} name={g.name} tone="warning" />
                  ))}
                  {rest.map((g) => (
                    <GapChip key={g.id} name={g.name} tone="neutral" />
                  ))}
                </ul>
              )}
              {decisive.length > 0 && (
                <p className="mt-3 text-xs text-slate-500">
                  Red is decisive: the role will not hire without it. Amber is
                  buildable with a project like the one above.
                </p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                You already bring
              </h3>
              {have.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  No evidenced requirement was recorded.
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {have.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-900"
                    >
                      {r.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* 6 · other ideas, briefly */}
      {others.length > 0 && (
        <Panel
          index={5}
          eyebrow="If you want more"
          title="Other projects worth building"
        >
          <ul className="grid gap-4 md:grid-cols-2">
            {others.map((p, i) => (
              <li
                key={`${String(p.rank)}-${p.name}`}
                className="lift rise rounded-lg border border-slate-200 bg-slate-100/60 p-4"
                style={{ ["--i" as string]: i + 6 }}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  #{p.rank}
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {p.name}
                </p>
                {p.what_to_build !== undefined && (
                  <p className="mt-2 text-sm text-slate-600">
                    {firstSentence(p.what_to_build)}
                  </p>
                )}
                {p.platforms !== undefined && p.platforms.length > 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    {p.platforms.join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* 7 · the way down */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-sm font-medium text-slate-900">
            Want the reasoning behind this?
          </p>
          <p className="text-sm text-slate-600">
            Every requirement, the evidence, and the alternatives NAIGX
            rejected.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportAnalysisButton analysisId={analysis.analysis_id} />
          <button
            type="button"
            onClick={onShowFull}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            Open the full analysis
          </button>
        </div>
      </div>
    </div>
  );
}
