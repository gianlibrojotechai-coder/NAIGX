/**
 * Artifact → Markdown (`FR-050`, `FR-052`, `FR-053`).
 *
 * One renderer per artifact type, reading the stored document — the same
 * jsonb `API-021` returns and the frontend presenters narrow. `SA §3.8`:
 * "Export is a pure transformation of stored artifacts." Nothing here decides
 * anything; it lays out what the reasoning already concluded.
 *
 * NARROWING RATHER THAN CASTING. Every document arrives as `unknown`. A stored
 * artifact reaches here only when its `validation_status` is `valid`, so the
 * shape should hold — but "should" is what a cast assumes and a narrow checks.
 * Where a document does not match, the renderer says so in the document rather
 * than throwing: an export that fails wholesale because one artifact is
 * malformed loses the seven parts that were fine. `FR-091`'s principle — a
 * reader must be able to tell what is missing and why — applies to the export
 * as much as to the screen.
 *
 * `FR-053` COPY IS A ONE-ARTIFACT EXPORT. `FR-052`'s `artifact_types`
 * selection already specifies exactly that, so the copy control fetches from
 * `API-040` with a single type and these renderers serve both. There is no
 * second Markdown writer to drift from this one.
 */

import {
  likelihoodLabel,
  riskBand,
  riskScore,
  severityLabel,
} from "./risk-scale.js";

// --- narrowing helpers ------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const int = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

const list = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

const strList = (value: unknown): readonly string[] =>
  list(value).flatMap((entry) => {
    const text = str(entry);
    return text === null ? [] : [text];
  });

/**
 * `|` would end a table cell early and break every column after it.
 *
 * Applied only inside table cells. Prose is emitted verbatim — escaping it
 * would put backslashes into a document a user hands to somebody else.
 */
const cell = (text: string): string => text.replace(/\|/g, "\\|");

/** Free text on one line: a stray newline inside a cell breaks the table. */
const inlineCell = (text: string): string =>
  cell(text.replace(/\s*\n\s*/g, " ")).trim();

const bullets = (items: readonly string[]): string[] =>
  items.map((item) => `- ${item}`);

/**
 * What a renderer produces.
 *
 * `rendered: false` means the stored document did not match its shape. The
 * lines still say so, and the caller counts it — a malformed artifact is
 * reported, never dropped.
 */
export interface ArtifactRender {
  readonly lines: readonly string[];
  readonly rendered: boolean;
}

const unrenderable = (artifactType: string): ArtifactRender => ({
  rendered: false,
  lines: [
    `*This artifact is stored but its content does not match the \`${artifactType}\` schema, so it could not be laid out here. The analysis record is unchanged; this is a rendering fault in the export, not a failure of the analysis.*`,
  ],
});

// --- portfolio_suggestions --------------------------------------------------

const EFFORT_NOTE =
  "Effort is a coarse band, not an estimate in hours — a precise figure would be invented.";

const renderPortfolioSuggestions = (document: unknown): ArtifactRender => {
  if (!isRecord(document)) return unrenderable("portfolio_suggestions");

  const projects = list(document.projects).filter(isRecord);
  const rationale = str(document.consolidation_rationale);
  if (projects.length === 0 || rationale === null) {
    return unrenderable("portfolio_suggestions");
  }

  const lines: string[] = [
    "**Why these projects and not one per gap.** " + rationale,
    "",
  ];

  // Rank is a total order over the set (`docs/12` D-29). Sorted rather than
  // trusted to arrive ordered: the export states "build this first", so the
  // order is the content.
  const ordered = [...projects].sort(
    (left, right) => (int(left.rank) ?? 0) - (int(right.rank) ?? 0),
  );

  for (const project of ordered) {
    const rank = int(project.rank);
    const name = str(project.name) ?? "Untitled project";
    lines.push(`### ${rank === null ? "" : `${String(rank)}. `}${name}`, "");

    const complexity = str(project.complexity);
    const effort = str(project.estimated_effort);
    const facts: string[] = [];
    if (complexity !== null) facts.push(`**Complexity:** ${complexity}`);
    if (effort !== null) facts.push(`**Effort:** ${effort}`);
    const gaps = strList(project.primary_gaps);
    if (gaps.length > 0) facts.push(`**Closes gaps:** ${gaps.join(", ")}`);
    if (facts.length > 0) lines.push(facts.join(" · "), "");

    const sections: readonly (readonly [string, string | null])[] = [
      ["Why this project", str(project.why_this_project)],
      ["Business problem", str(project.business_problem)],
      ["What to build", str(project.what_to_build)],
      ["Portfolio value", str(project.portfolio_value)],
      ["Why it cannot fold into another", str(project.why_not_consolidated)],
    ];
    for (const [heading, body] of sections) {
      if (body !== null) lines.push(`**${heading}.** ${body}`, "");
    }

    const workflow = strList(project.workflow);
    if (workflow.length > 0) {
      lines.push("**Workflow — trigger through outcome.**", "");
      workflow.forEach((step, index) => {
        lines.push(`${String(index + 1)}. ${step}`);
      });
      lines.push("");
    }

    const platforms = strList(project.platforms);
    const concepts = strList(project.technical_concepts);
    const secondary = strList(project.secondary_capabilities);
    if (platforms.length > 0)
      lines.push(`**Platforms:** ${platforms.join(", ")}`, "");
    if (concepts.length > 0)
      lines.push(`**Technical concepts:** ${concepts.join(", ")}`, "");
    if (secondary.length > 0)
      lines.push(`**Also demonstrates:** ${secondary.join(", ")}`, "");

    const evidence = list(project.evidence_to_produce).filter(isRecord);
    if (evidence.length > 0) {
      lines.push("**Evidence to produce.**", "");
      lines.push(
        ...bullets(
          evidence.flatMap((entry) => {
            const type = str(entry.type);
            const shows = str(entry.what_it_shows);
            if (type === null || shows === null) return [];
            return [`**${type}** — ${shows}`];
          }),
        ),
        "",
      );
    }

    // `FR-043` provenance, at the level of a single claim. The reusability
    // claim is always inferred and always carries what it rests on, so a
    // reader can discount it. Exporting the claim without its basis would
    // hand somebody an inference dressed as a finding.
    const reusability = project.reusability;
    if (isRecord(reusability)) {
      const claim = str(reusability.claim);
      const basis = str(reusability.basis);
      if (claim !== null) {
        lines.push(`**Reusability (inferred).** ${claim}`, "");
        if (basis !== null)
          lines.push(`*Basis for that inference:* ${basis}`, "");
      }
    }
  }

  lines.push(`*${EFFORT_NOTE}*`, "");
  return { lines, rendered: true };
};

// --- workflow_recommendation ------------------------------------------------

const renderWorkflowRecommendation = (document: unknown): ArtifactRender => {
  if (!isRecord(document)) return unrenderable("workflow_recommendation");

  const structure = document.current_structure;
  if (!isRecord(structure)) return unrenderable("workflow_recommendation");

  const summary = str(structure.summary);
  const dataFlow = str(structure.data_flow);
  const steps = list(structure.steps).filter(isRecord);
  if (summary === null || dataFlow === null || steps.length === 0) {
    return unrenderable("workflow_recommendation");
  }

  // `FR-021`: the structure is stated before anything is evaluated. The order
  // of these sections is the requirement, not a layout preference.
  const lines: string[] = [
    "#### The workflow as it stands",
    "",
    summary,
    "",
    `**Data flow.** ${dataFlow}`,
    "",
    "| Step | Responsibility | Inputs | Outputs | On failure |",
    "|---|---|---|---|---|",
  ];

  for (const step of steps) {
    lines.push(
      `| ${inlineCell(str(step.name) ?? "—")} | ${inlineCell(str(step.responsibility) ?? "—")} | ${inlineCell(str(step.inputs) ?? "—")} | ${inlineCell(str(step.outputs) ?? "—")} | ${inlineCell(str(step.failure_handling) ?? "—")} |`,
    );
  }
  lines.push("");

  const findings = list(document.findings).filter(isRecord);
  lines.push("#### Findings", "");

  if (findings.length === 0) {
    // `FR-021`: silence is not soundness. An empty list must be accompanied by
    // an explicit statement, and the export carries it for the same reason the
    // screen does — a reader must not conclude the review simply stopped.
    const soundness = str(document.soundness_statement);
    lines.push(
      soundness ??
        "*No findings were recorded, and no soundness statement accompanies them. Treat the absence as unexplained rather than as a clean review.*",
      "",
    );
  } else {
    for (const finding of findings) {
      const severity = int(finding.severity);
      const severityText =
        severity === null
          ? ""
          : ` — severity ${String(severity)} (${severityLabel(severity)})`;
      lines.push(
        `- **${str(finding.step) ?? "Unattributed step"}**${severityText}`,
        `  - ${str(finding.description) ?? "No description recorded."}`,
        `  - *Remediation:* ${str(finding.remediation) ?? "None recorded."}`,
      );
    }
    lines.push("");
  }

  const optimisations = strList(document.optimisations);
  if (optimisations.length > 0) {
    lines.push("#### Optimisations", "", ...bullets(optimisations), "");
  }

  return { lines, rendered: true };
};

// --- risk_assessment --------------------------------------------------------

const renderRiskAssessment = (document: unknown): ArtifactRender => {
  if (!isRecord(document)) return unrenderable("risk_assessment");
  if (!Array.isArray(document.risks)) return unrenderable("risk_assessment");

  const risks = list(document.risks).filter(isRecord);

  if (risks.length === 0) {
    const statement = str(document.no_risks_statement);
    return {
      rendered: true,
      lines: [
        statement ??
          "*No risks were recorded, and no statement accompanies the empty register. Treat the absence as unexplained rather than as a clean assessment.*",
        "",
      ],
    };
  }

  // Score and band are computed here from `docs/09` §2 and are not stored.
  // The scale version travels with them: a band is meaningless without the
  // scale that produced it, and this document may be read long after a
  // revision.
  const lines: string[] = [
    "| Component | Risk | Severity | Likelihood | Score | Band | Mitigation |",
    "|---|---|---|---|---|---|---|",
  ];

  const scored = risks.map((risk) => {
    const severity = int(risk.severity);
    const likelihood = int(risk.likelihood);
    const score =
      severity === null || likelihood === null
        ? null
        : riskScore(severity, likelihood);
    return { risk, severity, likelihood, score };
  });

  // Highest risk first: a register a reader scans top-down should open with
  // what matters most. Ties keep their stored order.
  const ordered = [...scored].sort(
    (left, right) => (right.score ?? -1) - (left.score ?? -1),
  );

  for (const { risk, severity, likelihood, score } of ordered) {
    lines.push(
      `| ${inlineCell(str(risk.component) ?? "—")} ` +
        `| ${inlineCell(str(risk.description) ?? "—")} ` +
        `| ${severity === null ? "—" : `${String(severity)} · ${severityLabel(severity)}`} ` +
        `| ${likelihood === null ? "—" : `${String(likelihood)} · ${likelihoodLabel(likelihood)}`} ` +
        `| ${score === null ? "—" : String(score)} ` +
        `| ${score === null ? "—" : riskBand(score)} ` +
        `| ${inlineCell(str(risk.mitigation) ?? "—")} |`,
    );
  }

  lines.push(
    "",
    "*Score is severity × likelihood on the 1–5 scales of `docs/09` §2, scale version `risk-v1`. Score and band are derived when the document is produced and are never stored, so they always reflect the scale named here.*",
    "",
  );

  return { lines, rendered: true };
};

// --- assessment_feedback ----------------------------------------------------

const renderAssessmentFeedback = (document: unknown): ArtifactRender => {
  if (!isRecord(document)) return unrenderable("assessment_feedback");

  const approach = document.approach;
  if (!isRecord(approach)) return unrenderable("assessment_feedback");

  const summary = str(approach.summary);
  const dataFlow = str(approach.data_flow);
  const components = list(approach.components).filter(isRecord);
  if (summary === null || dataFlow === null || components.length === 0) {
    return unrenderable("assessment_feedback");
  }

  const lines: string[] = [
    "#### The approach",
    "",
    summary,
    "",
    `**Data flow.** ${dataFlow}`,
    "",
    "| Component | Responsibility | On failure |",
    "|---|---|---|",
  ];

  for (const component of components) {
    lines.push(
      `| ${inlineCell(str(component.name) ?? "—")} | ${inlineCell(str(component.responsibility) ?? "—")} | ${inlineCell(str(component.failure_handling) ?? "—")} |`,
    );
  }
  lines.push("");

  // `FR-023`: the output is "structured for the user to understand and defend,
  // not to submit verbatim". Trade-offs and rejected approaches are what make
  // it defensible under questioning, so they are headed sections rather than
  // prose a reader has to mine.
  const tradeOffs = list(document.trade_offs).filter(isRecord);
  if (tradeOffs.length > 0) {
    lines.push("#### What this approach accepts", "");
    for (const tradeOff of tradeOffs) {
      lines.push(
        `- **${str(tradeOff.choice) ?? "Unnamed choice"}** — accepts: ${str(tradeOff.accepted) ?? "not recorded"}`,
      );
    }
    lines.push("");
  }

  const rejected = list(document.rejected_approaches).filter(isRecord);
  if (rejected.length > 0) {
    lines.push("#### What was rejected, and why", "");
    for (const entry of rejected) {
      lines.push(
        `- **${str(entry.approach) ?? "Unnamed approach"}** — ${str(entry.rejection_reason) ?? "no reason recorded"}`,
      );
    }
    lines.push("");
  }

  return { lines, rendered: true };
};

// --- mermaid_diagram --------------------------------------------------------

/**
 * `FR-050`: "Mermaid source is included in the Markdown export."
 *
 * A fenced `mermaid` block is both — the literal source a reader can copy, and
 * a block that renders as a diagram anywhere Mermaid is supported (GitHub, and
 * this project's own Artifact pages). `FR-053`'s "copy of a Mermaid diagram
 * yields valid diagram source" is satisfied by the same output, which is why
 * there is no separate copy path.
 */
const renderMermaidDiagram = (document: unknown): ArtifactRender => {
  if (!isRecord(document)) return unrenderable("mermaid_diagram");

  const diagram = str(document.diagram);
  if (diagram === null || !diagram.startsWith("flowchart ")) {
    return unrenderable("mermaid_diagram");
  }

  const nodeCount = int(document.node_count);
  const lines = ["```mermaid", diagram, "```", ""];
  if (nodeCount !== null) {
    lines.push(
      `*${String(nodeCount)} node${nodeCount === 1 ? "" : "s"}, one per architecture component. The diagram is rendered from those components rather than generated, so it cannot name one the architecture does not have.*`,
      "",
    );
  }
  return { lines, rendered: true };
};

// --- dispatch ---------------------------------------------------------------

/** Human headings for the artifact types that have generators. */
export const ARTIFACT_TITLES: Readonly<Record<string, string>> = {
  skill_gap_analysis: "Skill Gap Analysis",
  portfolio_suggestions: "Portfolio Suggestions",
  interview_guidance: "Interview Guidance",
  workflow_recommendation: "Workflow Recommendation",
  risk_assessment: "Risk Assessment",
  assessment_feedback: "Assessment Feedback",
  mermaid_diagram: "Architecture Diagram",
};

const RENDERERS: Readonly<
  Record<string, (document: unknown) => ArtifactRender>
> = {
  portfolio_suggestions: renderPortfolioSuggestions,
  workflow_recommendation: renderWorkflowRecommendation,
  risk_assessment: renderRiskAssessment,
  assessment_feedback: renderAssessmentFeedback,
  mermaid_diagram: renderMermaidDiagram,
};

export const artifactTitle = (artifactType: string): string =>
  ARTIFACT_TITLES[artifactType] ??
  artifactType.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * Renders one stored artifact document.
 *
 * An artifact type with no renderer is reported as such rather than dumped as
 * JSON: a reader handed raw jsonb learns less than a reader told plainly that
 * this export cannot lay this type out yet. Mirrors the frontend, where an
 * artifact with no presenter still appears in artifact status.
 */
export const renderArtifactDocument = (
  artifactType: string,
  document: unknown,
): ArtifactRender => {
  const renderer = RENDERERS[artifactType];
  if (renderer === undefined) {
    return {
      rendered: false,
      lines: [
        `*This artifact was produced and stored, but the export has no layout for \`${artifactType}\` yet. It is present in the analysis and retrievable through the API.*`,
      ],
    };
  }
  return renderer(document);
};
