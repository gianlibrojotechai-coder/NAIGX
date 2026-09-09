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

    // D-70 — the node-by-node build on the named automation platform.
    const implementation = project.implementation;
    if (isRecord(implementation)) {
      const platform = str(implementation.platform) ?? "the platform";
      const steps = list(implementation.steps).filter(isRecord);
      if (steps.length > 0) {
        lines.push(`**How to build it in ${platform} — node by node.**`, "");
        for (const item of steps) {
          const node = str(item.node);
          const purpose = str(item.purpose);
          if (node === null || purpose === null) continue;
          lines.push(`${String(item.step ?? "")}. **${node}** — ${purpose}`);
          for (const line of strList(item.setup)) lines.push(`   - ${line}`);
          const credential = str(item.credential);
          lines.push(`   - Credential: ${credential ?? "none"}`);
        }
        lines.push("");
        const notes = strList(implementation.notes);
        if (notes.length > 0) {
          lines.push("*Wiring notes:*", "", ...bullets(notes), "");
        }
      }
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

// --- skill_gap_analysis ------------------------------------------------------

/**
 * The job-description path's gap analysis (D-75). The priorities come first —
 * the order to close the gaps is the one thing a reader takes away — then
 * every requirement with its necessity, its evidence or its gap.
 */
const renderSkillGapAnalysis = (document: unknown): ArtifactRender => {
  if (!isRecord(document)) return unrenderable("skill_gap_analysis");
  if (document.standing !== "gap_analysis") {
    return unrenderable("skill_gap_analysis");
  }
  const requirements = list(document.requirements).filter(isRecord);
  const priorities = list(document.priorities).filter(isRecord);
  const summary = isRecord(document.summary) ? document.summary : {};
  if (requirements.length === 0) return unrenderable("skill_gap_analysis");

  const lines: string[] = [
    "*The posting's requirements as the verdict weighed them — rendered from the reasoning above, not generated beside it. Each is classified must-have or nice-to-have and is either evidenced by something a screener could open, or a gap with a priority.*",
    "",
    `**In numbers.** ${String(int(summary.requirements) ?? requirements.length)} requirements (${String(int(summary.must_have) ?? 0)} must-have, ${String(int(summary.nice_to_have) ?? 0)} nice-to-have); ${String(int(summary.evidenced) ?? 0)} evidenced; ${String(int(summary.gaps) ?? 0)} gaps, of which ${String(int(summary.decisive_gaps) ?? 0)} decided the verdict.`,
    "",
    "#### Close these first",
    "",
  ];
  if (priorities.length === 0) {
    lines.push(
      "*No gaps. Every requirement is evidenced — there is nothing to close before applying.*",
      "",
    );
  } else {
    lines.push(
      "| Order | Requirement | Necessity | Priority | Decisive | A build could close it |",
      "|---|---|---|---|---|---|",
    );
    priorities.forEach((entry, index) => {
      lines.push(
        `| ${String(index + 1)} | ${inlineCell(str(entry.name) ?? "—")} | ${humaniseToken(str(entry.necessity))} | ${humaniseToken(str(entry.priority))} | ${entry.decisive === true ? "yes" : "no"} | ${entry.buildable === true ? "yes" : "no"} |`,
      );
    });
    lines.push("");
  }

  lines.push("#### Every requirement", "");
  for (const req of requirements) {
    const gap = isRecord(req.gap) ? req.gap : null;
    lines.push(
      `- **${str(req.name) ?? "Unnamed requirement"}** — ${humaniseToken(str(req.necessity))}, ${humaniseToken(str(req.kind))}, ${str(req.provenance) ?? "unknown provenance"}. ${gap === null ? "**Evidenced.**" : `**Gap** (${humaniseToken(str(gap.priority))}${gap.decisive === true ? ", decisive" : ""}): ${str(gap.why_it_matters) ?? "no reason recorded"}`}`,
    );
    for (const ev of list(req.evidence).filter(isRecord)) {
      lines.push(
        `  - ${humaniseToken(str(ev.strength))} match, \`${str(ev.capability_id) ?? "?"}\` — ${str(ev.evidence_ref) ?? ""}`,
      );
    }
  }
  lines.push("");
  return { lines, rendered: true };
};

const humaniseToken = (token: string | null): string =>
  token === null ? "—" : token.replace(/_/g, " ");

// --- architecture_recommendation -------------------------------------------

/**
 * The requirement path's recommended architecture (D-73). Inputs and outputs
 * are laid out per component because a reader of a recommendation is about
 * to build it; the standing line comes first so the document is never read
 * as an assessment of something the reader submitted.
 */
const renderArchitectureRecommendation = (
  document: unknown,
): ArtifactRender => {
  if (!isRecord(document)) return unrenderable("architecture_recommendation");
  if (document.standing !== "recommendation") {
    return unrenderable("architecture_recommendation");
  }
  const summary = str(document.summary);
  const dataFlow = str(document.data_flow);
  const components = list(document.components).filter(isRecord);
  if (summary === null || dataFlow === null || components.length === 0) {
    return unrenderable("architecture_recommendation");
  }

  const lines: string[] = [
    "*A recommended architecture for the stated requirement — rendered from the reasoning above, not generated beside it. It is a recommendation to build from, not an assessment of a submitted design.*",
    "",
    "#### The recommended approach",
    "",
    summary,
    "",
    `**Data flow.** ${dataFlow}`,
    "",
    "| # | Component | Responsibility | Inputs | Outputs | On failure | Integrates with |",
    "|---|---|---|---|---|---|---|",
  ];

  for (const component of components) {
    const external = str(component.external_system);
    const direction = str(component.integration_direction);
    const integration =
      external === null
        ? "—"
        : `${external}${direction === null ? "" : ` (${direction})`}`;
    lines.push(
      `| ${String(int(component.ordinal) ?? "—")} | ${inlineCell(str(component.name) ?? "—")} | ${inlineCell(str(component.responsibility) ?? "—")} | ${inlineCell(str(component.inputs) ?? "—")} | ${inlineCell(str(component.outputs) ?? "—")} | ${inlineCell(str(component.failure_handling) ?? "—")} | ${inlineCell(integration)} |`,
    );
  }
  lines.push("");

  const tradeOffs = list(document.trade_offs).filter(isRecord);
  lines.push("#### What this approach accepts", "");
  if (tradeOffs.length === 0) {
    lines.push(
      "*No trade-offs were stated for this recommendation. `FR-020` does not require them on the requirement path; none has been invented here.*",
      "",
    );
  } else {
    for (const tradeOff of tradeOffs) {
      lines.push(
        `- **${str(tradeOff.choice) ?? "Unnamed choice"}** — accepts: ${str(tradeOff.accepted) ?? "not recorded"}`,
      );
    }
    lines.push("");
  }

  const rejected = list(document.rejected_approaches).filter(isRecord);
  lines.push("#### What was rejected, and why", "");
  if (rejected.length === 0) {
    lines.push(
      "*No rejected alternative was stated. The reasoning hierarchy above records how the architecture was reached; a comparison of alternatives is not part of this artifact.*",
      "",
    );
  } else {
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
  intent_brief: "Intent Brief",
  n8n_workflow: "n8n Workflow (import file)",
  skill_gap_analysis: "Skill Gap Analysis",
  portfolio_suggestions: "Portfolio Suggestions",
  interview_guidance: "Interview Guidance",
  workflow_recommendation: "Workflow Recommendation",
  risk_assessment: "Risk Assessment",
  assessment_feedback: "Assessment Feedback",
  architecture_recommendation: "Architecture Recommendation",
  mermaid_diagram: "Architecture Diagram",
};

/**
 * Intent Brief — what the input asks for, as understood (D-66).
 *
 * Rendered with its standing stated first, because a reader who skims to the
 * artifacts must not mistake the problem statement for a conclusion.
 */
const renderIntentBrief = (document: unknown): ArtifactRender => {
  if (!isRecord(document)) return unrenderable("intent_brief");
  const objective = document.objective;
  if (!isRecord(objective)) return unrenderable("intent_brief");
  const content = str(objective.content);
  const provenance = str(objective.provenance);
  const scope = str(document.inferred_scope);
  if (content === null || provenance === null || scope === null) {
    return unrenderable("intent_brief");
  }
  const secondary = list(document.secondary_objectives).filter(isRecord);

  const lines: string[] = [
    "*How the input was understood before any reasoning ran. This is the problem as stated and inferred, not a conclusion.*",
    "",
    `**Objective** (${provenance}). ${content}`,
    "",
  ];
  if (secondary.length > 0) {
    lines.push("**Also aims to:**", "");
    for (const item of secondary) {
      const text = str(item.content);
      const p = str(item.provenance);
      if (text !== null)
        lines.push(`- ${text}${p === null ? "" : ` *(${p})*`}`);
    }
    lines.push("");
  }
  lines.push(`**Scope, as inferred.** ${scope}`);
  return { rendered: true, lines };
};

/**
 * D-71 — the import file is the artifact; the document lists what it holds
 * and where to get it. The JSON itself is downloaded from the analysis view,
 * not printed: a ten-node workflow is ~400 lines that a PDF reader cannot
 * import anyway.
 */
const renderN8nWorkflow = (document: unknown): ArtifactRender => {
  if (!isRecord(document)) return unrenderable("n8n_workflow");
  const nodes = list(document.nodes).filter(isRecord);
  const naigx = isRecord(document.naigx) ? document.naigx : {};
  const steps = nodes.filter(
    (n) => str(n.type) !== "n8n-nodes-base.stickyNote",
  );
  if (steps.length === 0) return unrenderable("n8n_workflow");
  const lines: string[] = [
    "*An n8n import file (Workflows → Import from File), downloadable from the analysis view. It is a scaffold: node types and wiring import as-is; every node's parameters are set by the builder from the note beside it.*",
    "",
    `**Nodes, in order** (${String(int(naigx.steps_mapped) ?? steps.length)} of ${String(steps.length)} mapped to a known n8n node):`,
    "",
  ];
  steps.forEach((node, index) => {
    const name = str(node.name) ?? "node";
    const type = (str(node.type) ?? "").replace("n8n-nodes-base.", "");
    const purpose = str(node.notes);
    lines.push(
      `${String(index + 1)}. **${name}** (${type})${purpose === null ? "" : ` — ${purpose}`}`,
    );
  });
  const unmapped = strList(naigx.steps_unmapped);
  if (unmapped.length > 0) {
    lines.push("", `Placeholders to replace by hand: ${unmapped.join(", ")}.`);
  }
  lines.push("");
  return { rendered: true, lines };
};

const RENDERERS: Readonly<
  Record<string, (document: unknown) => ArtifactRender>
> = {
  intent_brief: renderIntentBrief,
  n8n_workflow: renderN8nWorkflow,
  skill_gap_analysis: renderSkillGapAnalysis,
  portfolio_suggestions: renderPortfolioSuggestions,
  workflow_recommendation: renderWorkflowRecommendation,
  risk_assessment: renderRiskAssessment,
  assessment_feedback: renderAssessmentFeedback,
  architecture_recommendation: renderArchitectureRecommendation,
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
