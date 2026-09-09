/**
 * The analysis as a Markdown document (`API-040`, `FR-050`–`FR-053`, `M-13`).
 *
 * `SA §3.8` is the governing constraint: *"Export is a pure transformation of
 * stored artifacts. Never generates content, invokes the NIE, or alters
 * analysis substance."* Everything here reads `AnalysisView` — the same object
 * `API-021` returns — and lays it out. No provider, no database, no clock
 * beyond the generation timestamp the caller passes in.
 *
 * PRESENTATION-READY WITHOUT REFORMATTING (`AC-008`, `UX-013`). The reader of
 * this document is a third party who was not present for the analysis, so the
 * export states what a screen can leave to a tooltip: what provenance means,
 * why a confidence band is missing, which artifacts were not included and on
 * whose decision.
 *
 * IT MIRRORS THE SCREEN'S ORDER (`FR-040`). Intent, classification, verdict,
 * requirements, the path's artifacts, then unknowns, provenance and artifact
 * status. The artifact block is path-dependent and the rest is not, exactly as
 * `AnalysisView.tsx` has it — a reader who saw the analysis on screen should
 * recognise the document.
 *
 * DEGRADATION IS AN INPUT, NOT A FILTER (`M-14`, `FR-091`). A degraded, timed
 * out, failed or omitted state is labelled in the document rather than
 * excluded from it. A document that quietly drops what went wrong is worse
 * than one that says so, because the reader cannot tell the difference between
 * "not applicable" and "never produced".
 */

import type {
  AnalysisView,
  RefusalView,
  ArtifactView,
  ContextElementView,
  RequirementView,
} from "../db/analysis-reader.js";
import { artifactTitle, renderArtifactDocument } from "./artifact-markdown.js";

/**
 * `FR-051` — "Exports state that output is generated intelligence requiring
 * professional review." Placed at the end, where a reader arrives having seen
 * the reasoning, and stated without hedging.
 *
 * `FR-051` also forbids marketing content. There is none in this file, and
 * that is a property to preserve: nothing here names the product as a product,
 * invites further use, or characterises the analysis as better than what it
 * demonstrably is.
 */
const DISCLAIMER =
  "This document is generated intelligence, not professional advice. Every conclusion in it was produced by an automated reasoning pipeline from the text supplied, and none of it has been reviewed by a person. Treat it as a structured starting point that requires professional review before it is acted on or presented as fact.";

const humanise = (value: string): string => {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const verdictLabel = (decision: string): string => {
  if (decision === "apply_now") return "Apply now";
  if (decision === "build_first") return "Build first";
  return humanise(decision);
};

const verdictMeaning = (decision: string): string | null => {
  if (decision === "apply_now")
    return "The evidenced capabilities cover what this role requires.";
  if (decision === "build_first")
    return "At least one decisive gap should be closed with built evidence before applying.";
  return null;
};

const cell = (text: string): string =>
  text
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim();

/**
 * The primary objective's provenance out of the stored `{ primary, secondary }`
 * document, or `null` when the document does not carry one.
 *
 * `null` is reported as silence rather than as "inferred": guessing the
 * cautious value would still be guessing, and `FR-043` is a requirement about
 * knowing which it was.
 */
const objectiveProvenance = (stored: unknown): string | null => {
  if (typeof stored !== "object" || stored === null) return null;
  const primary = (stored as Record<string, unknown>).primary;
  return primary === "stated" || primary === "inferred" ? primary : null;
};

export interface MarkdownExportOptions {
  /**
   * `FR-052` — the artifact subset to include. Omit for the whole analysis.
   *
   * A selection never removes the narrative sections: intent, verdict and
   * requirements are the reasoning the artifacts rest on, and an artifact
   * detached from them is the "presented without its rationale" that `FR-042`
   * exists to prevent. What a selection controls is which artifacts are laid
   * out — and the ones it excludes are still named, per `FR-052`.
   */
  readonly artifactTypes?: readonly string[];
  /** `FR-051` generation date. Injected so the output is testable. */
  readonly generatedAt: Date;
}

export interface MarkdownExport {
  readonly document: string;
  /** Artifact types laid out in full. */
  readonly includedTypes: readonly string[];
  /**
   * Types present in the analysis but excluded by the caller's selection.
   * Reported back so the endpoint can state the same thing the document does.
   */
  readonly excludedTypes: readonly string[];
}

// --- sections ---------------------------------------------------------------

const metadataBlock = (analysis: AnalysisView, generatedAt: Date): string[] => {
  // `FR-051` — generation date, input classification and analysis identifier.
  // A table rather than prose: this is the block a reader checks when they
  // want to know what they are holding.
  const rows: string[] = [
    "| | |",
    "|---|---|",
    `| **Analysis** | \`${analysis.analysis_id}\` |`,
    `| **Input classified as** | ${analysis.classification === null ? "Not classified" : humanise(analysis.classification.determined_type)} |`,
    `| **Analysis completed** | ${analysis.completed_at ?? "Not completed"} |`,
    `| **Document generated** | ${generatedAt.toISOString()} |`,
  ];
  if (analysis.input !== null) {
    rows.push(
      `| **Source** | ${humanise(analysis.input.source_type)}, ${String(analysis.input.character_count)} characters |`,
    );
  }
  return [...rows, ""];
};

/**
 * `M-14` degradation, stated at the top.
 *
 * Not buried: a reader who is going to discount the whole document should
 * learn that before reading it, not after. `FR-094`'s timeout and `FR-091`'s
 * partial completion mean different things, so they are worded differently
 * rather than collapsed into one "incomplete" label.
 */
const degradationBlock = (analysis: AnalysisView): string[] => {
  if (analysis.timed_out) {
    return [
      "> **This analysis timed out.** It exceeded its time limit and was stopped before finishing. Everything that completed before it stopped was stored and appears below; sections with nothing in them were never reached. Nothing here was rolled back, and nothing here is invented to fill a gap.",
      "",
    ];
  }
  if (analysis.degraded) {
    return [
      '> **This analysis completed with degradation.** Part of it did not finish. What completed is reported below and what did not is named rather than omitted, so the difference between "not applicable" and "never produced" stays visible.',
      "",
    ];
  }
  if (analysis.status !== "completed") {
    return [
      `> **This analysis is \`${analysis.status}\`.** It is exported in that state; sections may be empty because the work that fills them never ran.`,
      "",
    ];
  }
  return [];
};

/**
 * D-86 — the analysis-level band with the seven factors behind it, before
 * the sections (`AI §8.4`: factors always exposed; `FR-045`). Absent only
 * when Stage 11 never ran, which the degradation block above already says.
 */
const confidenceBlock = (analysis: AnalysisView): string[] => {
  const c = analysis.overall_confidence;
  if (c === null || typeof c !== "object") return [];
  const rec = c as Record<string, unknown>;
  const band = typeof rec["band"] === "string" ? rec["band"] : null;
  if (band === null) return [];
  const decided: Record<string, string> = {
    no_artifacts: "no recommendation was produced, so the band is low by rule",
    conflict_cap:
      "the input carries a contradiction Stage 3 flagged, which caps the band at medium",
    weighted_base:
      "decided by the weighted measurement of requirement clarity and evidence quality",
  };
  const why = decided[String(rec["decided_by"])] ?? String(rec["decided_by"]);
  const lines = [
    `**Confidence: ${humanise(band)}.** ${why.charAt(0).toUpperCase()}${why.slice(1)}${typeof rec["base_score"] === "number" ? ` (base ${rec["base_score"].toFixed(3)}, ${String(rec["model_version"])})` : ""}.`,
    "",
    "| Factor | Value | Weight | Part played | Note |",
    "|---|---|---|---|---|",
  ];
  for (const f of Array.isArray(rec["factors"]) ? rec["factors"] : []) {
    const fr = f as Record<string, unknown>;
    const value =
      typeof fr["value"] === "number" ? fr["value"].toFixed(3) : "—";
    const weight =
      typeof fr["weight"] === "number"
        ? `${String(Math.round(fr["weight"] * 100))}%`
        : "—";
    const role =
      fr["role"] === "weighted"
        ? "Weighted"
        : fr["role"] === "cap"
          ? "Cap"
          : "Not measured in v1";
    lines.push(
      `| ${String(fr["id"])} ${String(fr["label"])} | ${value} | ${weight} | ${role} | ${String(fr["note"]).replace(/|/g, "\|")} |`,
    );
  }
  lines.push("");
  return lines;
};

const intentSection = (analysis: AnalysisView, step: number): string[] => {
  const lines = [`## ${String(step)}. The problem as understood`, ""];
  if (analysis.intent === null) {
    return [
      ...lines,
      "*No intent record was stored. Stage 2 did not complete for this analysis.*",
      "",
    ];
  }
  lines.push(`**Primary objective.** ${analysis.intent.primary_objective}`, "");

  // `FR-043` — provenance on the objective itself. An inferred objective is a
  // different claim from a stated one, and a reader who was not present for
  // the analysis has no other way to tell. Narrowed rather than cast: the
  // column is jsonb (`DB §4.2` specifies no child entity for it), so a shape
  // that fails to match is reported as unrecorded rather than printed raw.
  const primaryProvenance = objectiveProvenance(
    analysis.intent.objective_provenance,
  );
  if (primaryProvenance !== null) {
    lines.push(
      `*This objective was ${primaryProvenance} — ${primaryProvenance === "stated" ? "taken directly from the input text" : "inferred from the input rather than written in it"}.*`,
      "",
    );
  }
  if (analysis.intent.inferred_scope !== null) {
    lines.push(`**Scope.** ${analysis.intent.inferred_scope}`, "");
  }
  return lines;
};

const classificationSection = (
  analysis: AnalysisView,
  step: number,
): string[] => {
  const lines = [`## ${String(step)}. Classification`, ""];
  const classification = analysis.classification;
  if (classification === null) {
    return [...lines, "*No classification was stored.*", ""];
  }

  lines.push(
    `**Determined type.** ${humanise(classification.determined_type)} (confidence ${classification.confidence.toFixed(2)})`,
    "",
  );

  // `FR-015` — a low-confidence classification is recorded in the final
  // output, so the export carries it rather than reporting only the winner.
  if (classification.was_low_confidence) {
    lines.push(
      "> **This classification was low-confidence.** The input did not clearly resemble one kind of document, so everything downstream was reasoned on a type that was not certain. Weigh the conclusions accordingly.",
      "",
    );
  }

  // `FR-014` — a correction is distinguishable from an original.
  if (classification.user_override_type !== null) {
    lines.push(
      `**Corrected by the user** to ${humanise(classification.user_override_type)}${classification.overridden_at === null ? "" : ` on ${classification.overridden_at}`}. The analysis below was produced against the corrected type.`,
      "",
    );
  }
  return lines;
};

const verdictSection = (analysis: AnalysisView, step: number): string[] => {
  const lines = [`## ${String(step)}. Verdict`, ""];
  const verdict = analysis.verdict;
  if (verdict === null) {
    return [
      ...lines,
      "*No verdict was stored. Stage 7 did not complete for this analysis.*",
      "",
    ];
  }

  lines.push(`### ${verdictLabel(verdict.decision)}`, "");
  const meaning = verdictMeaning(verdict.decision);
  if (meaning !== null) lines.push(meaning, "");

  // `FR-042` — the rationale travels with the conclusion, always.
  lines.push("**Rationale.**", "", verdict.rationale, "");

  // `FR-034` — what the decision was measured against. The rationale says what
  // was decided; this says against what standard, which is what lets a reader
  // dispute the standard rather than only the verdict.
  if (verdict.criteria_applied !== null) {
    lines.push("**Criteria applied.**", "", verdict.criteria_applied, "");
  }

  if (verdict.alternatives.length > 0) {
    lines.push("**Alternatives considered.**", "");
    for (const alternative of verdict.alternatives) {
      lines.push(
        `- **${alternative.alternative}** — ${alternative.rejection_reason}`,
      );
    }
    lines.push("");
  }

  // `FR-045`. Null is the honest answer while Stage 11 is deferred
  // (`docs/12` D-33), and the export must not quietly drop the field — a
  // document with no confidence line reads as a document whose author forgot,
  // not as one where the measurement does not exist.
  if (verdict.confidence_band === null) {
    lines.push(
      "**Confidence: not available.** Per-recommendation confidence is not computed in this version (D-31 decision 5); the analysis-level band, with the factors behind it, is stated at the top of this document.",
      "",
    );
  } else {
    lines.push(`**Confidence.** ${humanise(verdict.confidence_band)}`, "");
  }

  return lines;
};

const requirementLines = (requirement: RequirementView): string[] => {
  const lines: string[] = [
    `#### ${requirement.name}`,
    "",
    `\`${requirement.id}\` · ${humanise(requirement.necessity)} · ${humanise(requirement.kind)} · ${requirement.provenance}`,
    "",
  ];

  if (requirement.matched.length > 0) {
    lines.push("**Evidenced by:**", "");
    for (const match of requirement.matched) {
      lines.push(
        `- \`${match.capability_id}\` — ${match.strength} match${match.evidence_ref === null ? "" : ` (${match.evidence_ref})`}`,
      );
    }
    lines.push("");
  }

  // `docs/12` D-28 — a gap is never separated from the requirement it belongs
  // to. Nesting it under the requirement is that rule expressed as layout.
  if (requirement.gaps.length > 0) {
    lines.push("**Gaps:**", "");
    for (const gap of requirement.gaps) {
      lines.push(
        `- ${humanise(gap.priority)} priority${gap.decisive ? ", **decisive**" : ""} — ${gap.why_it_matters}`,
      );
    }
    lines.push("");
  }

  if (requirement.matched.length === 0 && requirement.gaps.length === 0) {
    lines.push(
      "*Neither evidenced nor recorded as a gap. Stage 8 did not resolve this requirement.*",
      "",
    );
  }

  return lines;
};

const requirementsSection = (
  analysis: AnalysisView,
  step: number,
): string[] => {
  const lines = [`## ${String(step)}. Requirements`, ""];
  if (analysis.requirements.length === 0) {
    return [...lines, "*No requirements were stored.*", ""];
  }

  if (analysis.decisive_gaps.length > 0) {
    lines.push(
      `**${String(analysis.decisive_gaps.length)} decisive gap${analysis.decisive_gaps.length === 1 ? "" : "s"}:** ${analysis.decisive_gaps.map((id) => `\`${id}\``).join(", ")}. A decisive gap is one that would change the verdict on its own.`,
      "",
    );
  }

  for (const requirement of analysis.requirements) {
    lines.push(...requirementLines(requirement));
  }
  return lines;
};

const unknownsSection = (analysis: AnalysisView, step: number): string[] => {
  // `FR-044` — unknowns are prominent, with what would resolve each. Absence of
  // unknowns is stated too: a silent section reads as an oversight.
  const lines = [`## ${String(step)}. Unknowns`, ""];
  if (analysis.unknowns.length === 0) {
    return [
      ...lines,
      "*Nothing was recorded as unknown. The input answered every question the analysis needed to ask.*",
      "",
    ];
  }
  lines.push(
    "What the input does not say, and what would resolve each:",
    "",
    "| Unknown | What would resolve it |",
    "|---|---|",
  );
  for (const unknown of analysis.unknowns) {
    lines.push(
      `| ${cell(unknown.content)} | ${unknown.resolution_hint === null ? "*Not recorded.*" : cell(unknown.resolution_hint)} |`,
    );
  }
  lines.push("");
  return lines;
};

const provenanceRow = (element: ContextElementView): string =>
  `| ${cell(element.content)} | ${humanise(element.category)} | ${element.provenance} | ${element.inference_basis === null ? "—" : cell(element.inference_basis)} |`;

const provenanceSection = (analysis: AnalysisView, step: number): string[] => {
  // `FR-043` — stated and inferred are distinguished wherever displayed, and
  // "wherever" includes a document handed to somebody who never saw the tool.
  // The legend is spelled out because there is no tooltip in a Markdown file.
  const lines = [`## ${String(step)}. Provenance`, ""];
  if (analysis.context.length === 0) {
    return [...lines, "*No context elements were stored.*", ""];
  }

  const stated = analysis.context.filter((e) => e.provenance === "stated");
  const inferred = analysis.context.filter((e) => e.provenance === "inferred");

  lines.push(
    `${String(stated.length)} stated, ${String(inferred.length)} inferred, ${String(analysis.unknowns.length)} unknown.`,
    "",
    "- **Stated** — present in the input text, quoted or paraphrased.",
    "- **Inferred** — reasoned from the input, not written in it. The basis for each inference is given so it can be discounted.",
    "- **Unknown** — absent from the input and listed in the section above.",
    "",
    "| Element | Category | Provenance | Basis, where inferred |",
    "|---|---|---|---|",
  );
  for (const element of [...stated, ...inferred]) {
    lines.push(provenanceRow(element));
  }
  lines.push("");
  return lines;
};

/**
 * `FR-091` / `FR-052` — one section accounting for every planned artifact.
 *
 * Everything the analysis planned appears here with what became of it, whether
 * or not the caller selected it for export. `DB §4.4` exists so that "chose not
 * to produce it" and "tried and failed" stay distinguishable, and an export
 * that showed only successes would erase exactly that distinction.
 */
const artifactStatusSection = (
  analysis: AnalysisView,
  step: number,
  excluded: ReadonlySet<string>,
): string[] => {
  const lines = [`## ${String(step)}. Artifact status`, ""];
  if (analysis.artifacts.length === 0) {
    return [...lines, "*No artifacts were planned for this analysis.*", ""];
  }

  lines.push("| Artifact | Outcome | Why |", "|---|---|---|");
  for (const artifact of analysis.artifacts) {
    const title = artifactTitle(artifact.artifact_type);
    let outcome: string;
    let why: string;

    if (excluded.has(artifact.artifact_type)) {
      // `FR-052` — a partial export states what it left out, and says the
      // omission was the requester's choice rather than a failure.
      outcome = "Excluded from this export";
      why =
        "Produced by the analysis, but not selected for this document. Export the analysis without a selection to include it.";
    } else if (artifact.outcome === "omitted") {
      outcome = "Omitted";
      why =
        artifact.omission_reason ??
        "No reason recorded. The omission is real; the explanation is missing.";
    } else if (artifact.outcome === "failed") {
      outcome = "Failed";
      why =
        "Generation was attempted and did not succeed. Failed content is never presented, so nothing appears for it above.";
    } else if (
      artifact.validation_status !== null &&
      artifact.validation_status !== "valid"
    ) {
      outcome = "Produced, not valid";
      why = `Validation status \`${artifact.validation_status}\`. Only valid artifacts are presentable, so its content is withheld.`;
    } else {
      outcome = "Included";
      why = artifact.inclusion_reason ?? "Planned and produced.";
    }

    lines.push(`| ${cell(title)} | ${outcome} | ${cell(why)} |`);
  }

  lines.push(
    "",
    "*Omitted and failed mean different things. Omitted is a decision the analysis made and explained; failed is an attempt that did not succeed.*",
    "",
  );
  return lines;
};

// --- assembly ---------------------------------------------------------------

/** An artifact is laid out only when it is valid and has content to lay out. */
const isPresentable = (artifact: ArtifactView): boolean =>
  artifact.validation_status === "valid" && artifact.content !== null;

/**
 * Renders a stored analysis as a Markdown document.
 *
 * Pure. The generation timestamp is passed in rather than read, so the same
 * analysis renders identically on every call — which is what makes `API-041`
 * regeneration from the analysis id a sound substitute for a stored file
 * (`D-42` §3.4).
 */
/**
 * A refused analysis, as a document (`API §9.3`, `FR-092`, `AI §5.4`).
 *
 * ⚠️ NOT THE ORDINARY LAYOUT WITH EMPTY SECTIONS. A refusal produced no
 * intent, no verdict, no requirements and no artifacts, so the eight-section
 * document would be eight headings over nothing — a hollow file that reads as
 * a broken export rather than as the deliberate outcome it records.
 *
 * What it exports instead is the refusal itself: what was determined, why the
 * reasoning stopped, and — for an insufficient input — exactly what is missing
 * and what would resolve it. `API §9.3`: "returning a generic error here would
 * waste the most valuable thing the system determined." The same applies to a
 * document handed to somebody else.
 */
function refusalDocument(
  analysis: AnalysisView,
  refusal: RefusalView,
  generatedAt: Date,
): string[] {
  const unsupported = refusal.code === "unsupported_input_type";

  const lines: string[] = [
    `# ${unsupported ? "Input outside scope" : "Analysis declined — not enough to reason about"}`,
    "",
  ];
  lines.push(...metadataBlock(analysis, generatedAt));

  lines.push(
    unsupported
      ? "> **No analysis was produced, and that is a determination rather than a failure.** The input was classified as outside what NAIGX analyses, so no reasoning was performed."
      : "> **No analysis was produced, and that is a determination rather than a failure.** The input did not say enough to reason about without inventing the missing parts, so the analysis stopped rather than guessing.",
    "",
    "---",
    "",
    "## Why this stopped",
    "",
    refusal.reason,
    "",
    `*Stopped at stage ${String(refusal.halted_at_stage)}. Nothing beyond this point was attempted, so nothing below was inferred from a partial run.*`,
    "",
  );

  if (unsupported) {
    // `FR-092` — name what *would* work. A refusal that does not is a dead end.
    lines.push(
      "## What NAIGX does analyse",
      "",
      "- A business requirement",
      "- An existing workflow",
      "- A job description",
      "- A technical assessment",
      "",
    );
  } else if (refusal.unknowns.length > 0) {
    // `AI §5.4` / `FR-044` — the unknowns are the deliverable here.
    lines.push(
      "## What is missing",
      "",
      "Supplying these would let the analysis proceed:",
      "",
      "| Missing | What would resolve it |",
      "|---|---|",
    );
    for (const unknown of refusal.unknowns) {
      lines.push(
        `| ${cell(unknown.content)} | ${unknown.resolution_hint === null ? "*Not recorded.*" : cell(unknown.resolution_hint)} |`,
      );
    }
    lines.push("");
  } else {
    lines.push(
      "*No specific unknowns were recorded against this refusal, so what to add is not stated here. Treat that as an incomplete record rather than as an absence of anything to add.*",
      "",
    );
  }

  lines.push("---", "", DISCLAIMER, "");
  return lines;
}

/**
 * D-68 — the decision first, on the first page.
 *
 * The owner's reading of the first real export: a person wants the verdict,
 * then what to build (name, apps), then how to prove it — before the paper
 * trail. Everything here is a field of the analysis restated; nothing is
 * added, and the numbered sections that follow are unchanged.
 */
function summarySection(analysis: AnalysisView): string[] {
  const verdict = analysis.verdict;
  if (verdict === null) return [];
  const out: string[] = ["## Summary", ""];
  out.push(
    `**${verdictLabel(verdict.decision)}.** ${firstSentence(verdict.rationale)}`,
  );
  if (analysis.decisive_gaps.length > 0) {
    out.push(
      "",
      `Decisive gap${analysis.decisive_gaps.length === 1 ? "" : "s"}: ${analysis.decisive_gaps.map((g) => "\`" + g + "\`").join(", ")}.`,
    );
  }
  const portfolio = analysis.artifacts.find(
    (entry) =>
      entry.artifact_type === "portfolio_suggestions" &&
      entry.outcome === "generated",
  );
  const content = portfolio?.content;
  const projects =
    isPlainRecord(content) && Array.isArray(content["projects"])
      ? (content["projects"] as unknown[])
      : [];
  const project = projects[0];
  if (verdict.decision === "build_first" && isPlainRecord(project)) {
    out.push("", `**What to build.** ${String(project["name"] ?? "")}`);
    if (typeof project["what_to_build"] === "string") {
      out.push("", project["what_to_build"]);
    }
    if (
      Array.isArray(project["platforms"]) &&
      project["platforms"].length > 0
    ) {
      out.push(
        "",
        `**Apps and tools:** ${(project["platforms"] as unknown[]).map(String).join(", ")}`,
      );
    }
    if (
      Array.isArray(project["evidence_to_produce"]) &&
      project["evidence_to_produce"].length > 0
    ) {
      out.push("", "**How to prove it.**", "");
      for (const item of project["evidence_to_produce"] as unknown[]) {
        if (!isPlainRecord(item)) continue;
        out.push(
          `- **${String(item["type"] ?? "evidence")}** — ${String(item["what_it_shows"] ?? "")}`,
        );
      }
    }
  } else if (verdict.decision === "apply_now") {
    out.push(
      "",
      "**What to do.** Apply with the evidence you already have; the requirements section shows which work covers each requirement.",
    );
  }
  out.push(
    "",
    "*The sections that follow are the reasoning this rests on.*",
    "",
    "---",
    "",
  );
  return out;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const firstSentence = (text: string): string => {
  const match = /^(.+?[.!?])(\s|$)/.exec(text.trim());
  return match?.[1] ?? text.trim();
};

export function renderAnalysisMarkdown(
  analysis: AnalysisView,
  options: MarkdownExportOptions,
): MarkdownExport {
  // A refusal is exported as a refusal. Nothing below applies: there are no
  // artifacts to select from, no verdict to carry and no provenance to
  // explain, and a selection over an empty set is not a partial export.
  if (analysis.refusal !== null) {
    const lines = refusalDocument(
      analysis,
      analysis.refusal,
      options.generatedAt,
    );
    return {
      document:
        lines
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trimEnd() + "\n",
      includedTypes: [],
      excludedTypes: [],
    };
  }

  const selection =
    options.artifactTypes === undefined ? null : new Set(options.artifactTypes);

  const presentable = analysis.artifacts.filter(isPresentable);
  const included = presentable.filter(
    (artifact) => selection === null || selection.has(artifact.artifact_type),
  );
  const excludedTypes = presentable
    .filter(
      (artifact) =>
        selection !== null && !selection.has(artifact.artifact_type),
    )
    .map((artifact) => artifact.artifact_type);

  const title =
    analysis.derived_title ??
    (analysis.classification === null
      ? "Analysis"
      : `${humanise(analysis.classification.determined_type)} analysis`);

  const lines: string[] = [`# ${title}`, ""];
  lines.push(...metadataBlock(analysis, options.generatedAt));
  lines.push(...degradationBlock(analysis));
  lines.push(...confidenceBlock(analysis));

  if (selection !== null) {
    lines.push(
      `> **This is a partial export.** ${included.length === 0 ? "No artifacts were selected" : `${String(included.length)} of ${String(presentable.length)} available artifact${presentable.length === 1 ? " was" : "s were"} selected`}. Everything excluded is named in the artifact status section, so nothing is silently missing.`,
      "",
    );
  }

  lines.push("---", "");

  // Sections 1-4 are the reasoning and do not depend on the path.
  lines.push(...summarySection(analysis));

  let step = 1;
  lines.push(...intentSection(analysis, step++));
  lines.push(...classificationSection(analysis, step++));
  lines.push(...verdictSection(analysis, step++));
  lines.push(...requirementsSection(analysis, step++));

  // The artifact block is whatever the classified path produced.
  for (const artifact of included) {
    lines.push(
      `## ${String(step++)}. ${artifactTitle(artifact.artifact_type)}`,
      "",
    );
    lines.push(
      ...renderArtifactDocument(artifact.artifact_type, artifact.content).lines,
    );
    lines.push("");
  }

  // Closing sections renumber after the artifact block, exactly as on screen.
  lines.push(...unknownsSection(analysis, step++));
  lines.push(...provenanceSection(analysis, step++));
  lines.push(
    ...artifactStatusSection(analysis, step++, new Set(excludedTypes)),
  );

  lines.push("---", "", DISCLAIMER, "");

  return {
    // Collapse the runs of blank lines the section builders produce at their
    // seams, then end with exactly one newline.
    document:
      lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd() + "\n",
    includedTypes: included.map((artifact) => artifact.artifact_type),
    excludedTypes,
  };
}
