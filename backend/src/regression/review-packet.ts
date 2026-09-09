/**
 * Reviewer packets for the `M-08` rubric review (`docs/10` §4).
 *
 * A packet is the material one human needs to assess one recorded analysis
 * against the seven criteria, plus the `docs/10` §4.4 record they fill in.
 * Nothing here judges anything.
 *
 * ⚠️ THIS MODULE MUST NOT PRODUCE A VERDICT. `docs/10` §4.3: "An AI reviewer
 * may not be counted as the independent reviewer, in any capacity, for any
 * criterion." A generated pass or fail would not merely be inadmissible — it
 * would contaminate the record it was written into, because §3.3 makes the
 * verdict-plus-evidence pair the unit of retention. Where a criterion arrives
 * pre-marked it is marked **not assessable**, which is a statement about
 * *absent material*, never a judgment about reasoning.
 *
 * ASSESSABILITY IS DERIVED FROM THE RECORDING, NOT ASSUMED FROM ITS VINTAGE.
 * `C-3` and `C-6` were once hard-coded not-assessable. That was true of the
 * 2026-08-14 captures and would have become false the moment a
 * job-description case was recorded — those reach Stage 7 and artifact
 * generation, so both criteria have material. See `assessabilityOf`.
 *
 * WHETHER A PASS IS REACHABLE therefore varies per packet, and the header says
 * which. What no packet can do is satisfy §4.1 sampling or §4.3 reviewer
 * independence, so a review of any set built here is reported as partial.
 *
 * DETERMINISM. Same recordings and same corpus produce byte-identical packets.
 * No clock, no randomness, no filesystem ordering dependence — a packet that
 * changed between runs could not be cited as the evidence a verdict rests on.
 */

import { createHash } from "node:crypto";

import { STAGES } from "../nie/stages.js";
import type { CorpusCase } from "./corpus.js";
import type { CaseRecording } from "./recording-store.js";

/** `docs/10` §2, in the order the rubric states them. */
export const RUBRIC_CRITERIA = [
  {
    id: "C-1",
    name: "Grounded",
    failingLooksLike: "Claims not traceable to context",
    passesWhen:
      "Every substantive claim traces to a context element extracted from the input, or is explicitly labelled inferred or unknown (FR-013)",
    evidenceToRecord:
      "At least one claim checked against its provenance label. On failure, the specific ungrounded claim",
    note: "Direct instrument for M-8.",
  },
  {
    id: "C-2",
    name: "Specific",
    failingLooksLike: "Generic advice applicable to any input",
    passesWhen:
      "Recommendations, risks, and components refer to this submission's particulars. A risk that does not name a component fails by construction (FR-032)",
    evidenceToRecord:
      "On failure, the generic statement and why it would apply unchanged to a different input",
    note: "Assess against the architecture components present. The AC-013 do-not-automate clause has no material here — that is a Stage 7 output.",
  },
  {
    id: "C-3",
    name: "Proportional",
    failingLooksLike: "Depth mismatched to problem complexity",
    passesWhen:
      "The artifact set and depth match what the input supports. Minimal input yields a minimal artifact set (FR-017); over-production is a defect (PV §3.2)",
    evidenceToRecord:
      "The artifact set produced, and whether the plan's inclusion and omission reasons justify it (ARTIFACT_PLAN_ENTRY)",
    note: null,
  },
  {
    id: "C-4",
    name: "Complete",
    failingLooksLike: "Material consideration omitted silently",
    passesWhen:
      "Nothing material is missing without being named as omitted or unknown. Deliberate omission with a stated reason is a pass; silent omission is a fail",
    evidenceToRecord:
      "On failure, the omitted consideration and why it is material",
    note: "Assessable at the context and architecture level only. Artifact-level omission has no material here.",
  },
  {
    id: "C-5",
    name: "Honest",
    failingLooksLike:
      "Uncertainty concealed; unknowns filled with plausible defaults",
    passesWhen:
      "Unknowns are surfaced with what would resolve them (FR-044); uncertain platform characteristics are disclosed rather than asserted (AI-042); confidence is not uniformly presented across non-uniform certainty (FR-045)",
    evidenceToRecord:
      "On failure, the invented detail or the concealed uncertainty",
    note: "The FR-044 and AI-042 clauses are assessable. The FR-045 confidence clause is not — no confidence band exists (Stage 11 deferred, docs/12 D-33).",
  },
  {
    id: "C-6",
    name: "Defensible",
    failingLooksLike: 'The user cannot answer "why this, not the alternative?"',
    passesWhen:
      "Recommendations state their criteria and at least one rejected alternative with a reason (FR-034)",
    evidenceToRecord:
      "The stated criteria and rejected alternative, or their absence",
    note: "Direct instrument for M-9.",
  },
  {
    id: "C-7",
    name: "Consistent",
    failingLooksLike: "Similar inputs yielding materially different treatment",
    passesWhen:
      "Treatment is materially consistent with comparable corpus cases and with repeated runs of the same input (FR-024)",
    evidenceToRecord:
      "The comparison case used. Requires more than one analysis to assess (§3.4)",
    note: "Use another packet of the same input type as the comparison case, and name it. The repeated-run clause is not assessable: every recording was captured at lowVarianceSampling=false, so repeat-run stability was never measured.",
  },
] as const;

export type CriterionId = (typeof RUBRIC_CRITERIA)[number]["id"];

/**
 * Whether a criterion has material in *this* recording, and why not when it
 * does not.
 *
 * ⚠️ DERIVED, NEVER ASSUMED. `C-3` and `C-6` were once hard-coded
 * not-assessable, which was accurate for the 2026-08-14 recordings and became
 * a lie the moment a job-description case was captured: those reach Stage 7
 * and artifact generation, so both criteria have material. A packet builder
 * that decided by corpus vintage rather than by content would have told a
 * reviewer to skip the only two criteria the capture was bought to unblock.
 *
 * Not-assessable is a statement about **absent material**, never a judgment
 * about reasoning — `docs/10` §3.4's precedent for `C-7`.
 */
export interface CriterionAssessability {
  readonly assessable: boolean;
  /** Present only when not assessable; rendered as the verdict. */
  readonly reason: string | null;
}

const NOT_ASSESSABLE_PREFIX = "NOT ASSESSABLE.";

const assessable: CriterionAssessability = { assessable: true, reason: null };

const blocked = (reason: string): CriterionAssessability => ({
  assessable: false,
  reason: `${NOT_ASSESSABLE_PREFIX} ${reason}`,
});

/** The recorded output of one stage, parsed if it parses. */
const stageOutput = (
  recording: CaseRecording,
  stageKey: string,
): Record<string, unknown> | undefined => {
  const stage = recording.stages.find((s) => s.stageKey === stageKey);
  if (stage === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(unfence(stage.output));
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * `C-3` — the artifact set produced.
 *
 * Evidence is the presence of an artifact-generating stage. The inclusion and
 * omission reasons `docs/10` names live in `ARTIFACT_PLAN_ENTRY`, which is
 * persisted rather than recorded, so a recording carries the *set* but not the
 * plan's reasoning — stated in the note so the reviewer is not left looking
 * for something that was never captured.
 */
const proportionality = (recording: CaseRecording): CriterionAssessability => {
  // D-66: the intent brief is rendered on every reasoning path without a
  // selection decision, so its stage is not evidence of artifact selection.
  // Only stages that decide what to produce count as C-3 evidence.
  const artifactStages = new Set(
    STAGES.filter((s) =>
      s.producesArtifactTypes.some((t) => t !== "intent_brief"),
    ).map((s) => s.stageKey),
  );
  const produced = recording.stages.filter((s) =>
    artifactStages.has(s.stageKey),
  );

  if (produced.length === 0) {
    return blocked(
      "C-3's required evidence is the artifact set produced (ARTIFACT_PLAN_ENTRY). " +
        "This recording contains no artifact-generating stage — either it predates " +
        "Stages 8-9, or its path routes to architecture only and never reaches them.",
    );
  }
  return assessable;
};

/**
 * `C-6` — stated criteria plus at least one rejected alternative (`FR-034`).
 *
 * Checked against the recorded verdict rather than inferred from the stage's
 * presence: a Stage 7 output captured before `FR-034` landed has a verdict and
 * still carries neither field.
 */
const defensibility = (recording: CaseRecording): CriterionAssessability => {
  const output = stageOutput(recording, "recommendation_generation");
  if (output === undefined) {
    return blocked(
      "C-6's required evidence is stated criteria plus at least one rejected " +
        "alternative with a reason (FR-034), which is a Stage 7 output. This " +
        "recording contains no Stage 7 recommendation — either it predates the " +
        "stage, or its path produces no recommendation at all.",
    );
  }

  const verdict = output["verdict"];
  const record =
    verdict !== null && typeof verdict === "object"
      ? (verdict as Record<string, unknown>)
      : {};
  const criteria = record["criteria_applied"];
  const alternatives = record["alternatives"];

  const hasCriteria = typeof criteria === "string" && criteria.trim() !== "";
  const hasAlternative = Array.isArray(alternatives) && alternatives.length > 0;

  if (!hasCriteria || !hasAlternative) {
    return blocked(
      "C-6 requires stated criteria plus at least one rejected alternative " +
        `(FR-034). This recording's verdict carries ${hasCriteria ? "criteria but no alternative" : hasAlternative ? "an alternative but no criteria" : "neither"} — ` +
        "it was captured before Stage 7 produced them.",
    );
  }
  return assessable;
};

/** The per-criterion assessability of one recording. */
export function assessabilityOf(
  recording: CaseRecording,
): Readonly<Record<string, CriterionAssessability>> {
  return {
    "C-3": proportionality(recording),
    "C-6": defensibility(recording),
  };
}

/**
 * A stable reviewer-facing identifier.
 *
 * Derived, not sequential. `br-001` announces both the input type and a
 * position in an authored ordering, and `docs/10` §4.2 asks the reviewer not to
 * know whether a case is expected to pass — an ordering is a weak signal of
 * exactly that. The digest is deterministic, so the same case always carries
 * the same label across regenerations, and the mapping is recoverable from the
 * unblinding index rather than from the packet.
 */
export const reviewerId = (caseId: string): string =>
  `RP-${createHash("sha256").update(caseId, "utf8").digest("hex").slice(0, 8)}`;

/** Human-readable stage labels. Stage numbers are not exposed as prompt keys. */
const STAGE_LABELS: Readonly<Record<string, string>> = {
  input_classification: "Classification",
  intent_detection: "Intent",
  context_extraction: "Context extraction",
  architecture_analysis: "Architecture analysis",
  recommendation_generation: "Recommendation",
  artifact_planning: "Artifact plan",
  portfolio_suggestions: "Portfolio suggestions",
  // D-76: the second Stage 9 generator.
  interview_guidance: "Interview guidance",
  platform_recommendation: "Platform recommendation",
  risk_assessment: "Risk register",
  complexity_assessment: "Complexity assessment",
  implementation_roadmap: "Implementation roadmap",
  edge_case_analysis: "Edge cases and practices",
  integration_requirements: "Integration requirements",
};

/**
 * Pretty-prints a recorded provider response.
 *
 * Reformatted, never rewritten: a reviewer assessing whether a claim is
 * grounded must see what the model actually returned. Unparseable output is
 * emitted verbatim, because a malformed response is itself assessable material.
 *
 * SOME CAPTURES ARE FENCED. Several recordings wrap their JSON in a markdown
 * code fence — real model behaviour, which the pipeline's own parser tolerates.
 * Left alone it nests inside the packet's fence and renders as noise, so the
 * outer fence is unwrapped for display. Only the fence is removed; if what it
 * contained still does not parse, that content is shown exactly as captured.
 */
const unfence = (output: string): string => {
  const match = /^```[a-z]*\n([\s\S]*)\n```$/i.exec(output.trim());
  return match?.[1] ?? output;
};

const renderOutput = (output: string): string => {
  const body = unfence(output);
  try {
    return JSON.stringify(JSON.parse(body) as unknown, null, 2);
  } catch {
    return body;
  }
};

/**
 * A fence longer than any run of backticks in the content.
 *
 * `un-002` opens a code fence and never closes it — a malformed capture, and
 * assessable material precisely because it is malformed. Stripping the stray
 * fence would edit the evidence; fencing it with three backticks would break
 * the packet's own block. Widening the delimiter shows the response exactly as
 * captured and cannot nest.
 */
const fenceFor = (content: string): string => {
  const longest = [...content.matchAll(/`+/g)].reduce(
    (max, [run]) => Math.max(max, run.length),
    0,
  );
  return "`".repeat(Math.max(3, longest + 1));
};

/**
 * `docs/10` §6 — "Version recorded on every review record".
 *
 * Not one of the §4.4 fields, and required anyway: §6 makes reviews under
 * different rubric versions incomparable, so a record that omits the version
 * cannot be placed against any other.
 */
export const RUBRIC_VERSION = "rubric-v1";

export interface PacketInput {
  readonly corpusCase: CorpusCase;
  readonly recording: CaseRecording;
}

/**
 * The other packets a `C-7` judgment may legitimately be made against.
 *
 * `docs/10` §3.4 permits comparison "against another analysis of the same input
 * type in the same sample". Naming the candidates is mechanical — it saves the
 * reviewer from opening thirteen files to find a peer — and it stops short of
 * the judgment: which peer to use, and whether treatment is consistent, are
 * theirs. Where no peer exists, §3.4 records `C-7` as not assessable rather
 * than as a pass.
 */
const comparisonCandidates = (
  self: string,
  peers: readonly { readonly reviewerId: string; readonly inputType: string }[],
  inputType: string,
): readonly string[] =>
  peers
    .filter((p) => p.inputType === inputType && p.reviewerId !== self)
    .map((p) => p.reviewerId)
    .sort();

export interface ReviewPacket {
  readonly reviewerId: string;
  /** Retained for the unblinding index only; never rendered into the packet. */
  readonly caseId: string;
  readonly inputType: string;
  readonly filename: string;
  readonly content: string;
}

/**
 * The header, which states the ceiling this packet actually has.
 *
 * Written from the recording rather than fixed, because the ceiling moved: a
 * recording with every criterion assessable can in principle reach a
 * seven-of-seven pass, and telling its reviewer otherwise would be false.
 */
const header = (blockedIds: readonly string[]): string => {
  const lines = [
    blockedIds.length > 0
      ? "> **This packet cannot yield a rubric pass.**"
      : "> **This packet is not an M-08 pass.**",
    blockedIds.length > 0
      ? `> \`docs/10\` §3.5 requires all seven criteria to pass. ${blockedIds.join(" and ")} ` +
        "have no material in this recording and are marked not assessable below."
      : "> All seven criteria have material here, so a pass is reachable — but a pass" +
        "\n> is a reviewer's judgment, and M-08 additionally needs an adequate sample" +
        "\n> (§4.1) and a qualifying reviewer (§4.3).",
    "> Any review of this set is reported as partial and, unless a second human" +
      "\n> reviews the same packets, single-reviewer (§4.3).",
    "",
    "> **Corpus evidence, not current-runtime evidence.** These are captured provider",
    "> responses, replayed since. Per `docs/12` D-24 they are **not** evidence that the",
    "> prompts now in force produce these responses. A verdict here describes the",
    "> reasoning as it was captured, not as the system reasons today.",
  ];
  return lines.join("\n");
};

/** Builds one packet. Pure: no clock, no filesystem, no randomness. */
export function buildPacket(
  { corpusCase, recording }: PacketInput,
  peers: readonly {
    readonly reviewerId: string;
    readonly inputType: string;
  }[] = [],
): ReviewPacket {
  const id = reviewerId(corpusCase.caseId);
  const candidates = comparisonCandidates(id, peers, corpusCase.inputType);
  // Derived from this recording, not from the corpus vintage.
  const assessability = assessabilityOf(recording);
  const blockedIds = Object.entries(assessability)
    .filter(([, state]) => !state.assessable)
    .map(([criterionId]) => criterionId)
    .sort();
  const lines: string[] = [];

  lines.push(`# Review packet ${id}`, "", header(blockedIds), "");
  lines.push("---", "", "## 1 · The submitted input", "");
  lines.push("```text", corpusCase.inputText, "```", "");
  lines.push(
    `*${String(corpusCase.characterCount)} characters.*`,
    "",
    "---",
    "",
    "## 2 · What the system produced",
    "",
    `*${String(recording.stages.length)} stage(s) recorded: ${recording.stages
      .map((s) => STAGE_LABELS[s.stageKey] ?? s.stageKey)
      .join(" → ")}.*`,
    "",
    "> **Reading the grounding.** Context elements are an ordered array. Where a",
    "> later stage cites `grounded_in_context_indices`, those are **0-based**",
    "> positions into that array — the first element is index 0. `C-1` is checked",
    "> by following a cited index back to the element it names and to that",
    "> element's own `provenance` and `source_quote`.",
    "",
  );

  if (recording.stages.length === 0) {
    lines.push("*No stage output was recorded for this case.*", "");
  }
  for (const stage of recording.stages) {
    const label = STAGE_LABELS[stage.stageKey] ?? stage.stageKey;
    const rendered = renderOutput(stage.output);
    const fence = fenceFor(rendered);
    lines.push(`### ${label}`, "", `${fence}json`, rendered, fence, "");
  }

  lines.push(
    "---",
    "",
    "## 3 · What is absent, and why",
    "",
    "Stated so an absence is not read as a silent omission by the reasoning:",
    "",
    "- **No recommendation, artifact plan, or artifacts.** Stages 7, 8 and 9 did not",
    "  exist when this was captured. This is a gap in the *evidence*, not in the",
    "  analysis under review.",
    "- **No confidence band.** Stage 11 is deferred (`docs/12` D-33), so none was ever",
    "  assigned. `docs/10` §4.4 asks for the assigned band; the honest entry is",
    "  *not available*, and §4.1 stratification across bands is impossible.",
    "",
    "⚠️ **Two kinds of absence, and only the first is explained above.** A stage that",
    "did not exist at capture time is a gap in the evidence. A stage that existed and",
    "did not run is a decision the analysis made — and whether that decision was right",
    "is exactly what `C-4` and `C-5` ask. The stage list in §2 is the record of what",
    "ran; this document does not tell you which kind any absence is, because that",
    "reading is the review.",
    "",
    "---",
    "",
    "## 4 · Review record — `docs/10` §4.4",
    "",
    "Fill this in. A verdict without evidence is not recorded as a verdict (§3.3).",
    "",
    `- **Analysis identifier:** ${id}`,
    `- **Input type:** ${corpusCase.inputType}`,
    "- **Assigned confidence band:** not available — Stage 11 deferred (`docs/12` D-33)",
    `- **Rubric version:** ${RUBRIC_VERSION}  (§6)`,
    "- **Reviewer identifier:** _______________  (author / independent — §4.3)",
    "- **Date (ISO 8601):** _______________",
    "",
    "### Per criterion",
    "",
  );

  for (const criterion of RUBRIC_CRITERIA) {
    lines.push(`#### ${criterion.id} · ${criterion.name}`, "");
    lines.push(`*Failing looks like:* ${criterion.failingLooksLike}`, "");
    lines.push(`*Passes when:* ${criterion.passesWhen}`, "");
    lines.push(`*Evidence to record:* ${criterion.evidenceToRecord}`, "");
    if (criterion.note !== null) lines.push(`*Note:* ${criterion.note}`, "");

    if (criterion.id === "C-7") {
      lines.push(
        candidates.length === 0
          ? "*Comparison candidates:* none — no other packet in this set shares this " +
              "input type. §3.4 records C-7 as not assessable where no comparison " +
              "case is available."
          : `*Comparison candidates (same input type):* ${candidates.join(", ")}. ` +
              "Name the one you used.",
        "",
      );
    }

    const state = assessability[criterion.id];
    if (state !== undefined && !state.assessable) {
      lines.push(
        `**Verdict:** ${state.reason ?? "NOT ASSESSABLE."}`,
        "",
        "**Evidence:** see above.",
        "",
      );
    } else {
      lines.push(
        "**Verdict:** ` pass / fail / not assessable `",
        "",
        "**Evidence:**",
        "",
        "> ",
        "",
      );
    }
  }

  lines.push(
    "### Overall",
    "",
    blockedIds.length > 0
      ? `Per §3.5 an analysis passes only when all seven criteria pass. ${blockedIds.join(" and ")} ` +
          "are not assessable here, so this analysis cannot be recorded as a rubric pass."
      : "Per §3.5 this analysis passes only if all seven criteria pass. All seven have " +
          "material, so a pass is reachable — it is yours to determine.",
    "",
    blockedIds.length > 0
      ? "- **Overall:** ` fail / not assessable `  (a pass is not reachable — see above)"
      : "- **Overall:** ` pass / fail `",
    "- **Notes:**",
    "",
    "> ",
    "",
  );

  return {
    reviewerId: id,
    caseId: corpusCase.caseId,
    inputType: corpusCase.inputType,
    filename: `${id}.md`,
    content: `${lines.join("\n")}\n`,
  };
}

/**
 * Builds every packet, ordered by reviewer id.
 *
 * Ordering by the derived id rather than by case id is deliberate: it is
 * deterministic, and it does not present the cases in the authored sequence.
 */
export function buildPackets(
  inputs: readonly PacketInput[],
): readonly ReviewPacket[] {
  // Peers first: a packet needs to know its same-type siblings before it can
  // name C-7 comparison candidates, and that set must not depend on the order
  // the inputs arrived in.
  const peers = inputs
    .map((input) => ({
      reviewerId: reviewerId(input.corpusCase.caseId),
      inputType: input.corpusCase.inputType,
    }))
    .sort((a, b) => (a.reviewerId < b.reviewerId ? -1 : 1));

  return inputs
    .map((input) => buildPacket(input, peers))
    .sort((a, b) => (a.reviewerId < b.reviewerId ? -1 : 1));
}

/**
 * The index that rejoins a reviewer id to its case, for use **after** review.
 *
 * Kept out of the packet directory's reading order and named to be unmistakable.
 * Attribution has to be recoverable — a verdict nobody can trace back to a case
 * is not evidence — but it must not be recoverable *while reading the packet*.
 */
export function buildUnblindingIndex(
  packets: readonly ReviewPacket[],
  recordings: ReadonlyMap<string, CaseRecording>,
): string {
  const rows = [...packets]
    .sort((a, b) => (a.caseId < b.caseId ? -1 : 1))
    .map((p) => {
      const recording = recordings.get(p.caseId);
      return {
        reviewerId: p.reviewerId,
        caseId: p.caseId,
        inputType: p.inputType,
        capturedAt: recording?.capturedAt ?? null,
        fragmentsManifestVersion: recording?.fragmentsManifestVersion ?? null,
        fragmentsCompositionHash: recording?.fragmentsCompositionHash ?? null,
        provider: recording?.provider ?? null,
        lowVarianceSampling: recording?.lowVarianceSampling ?? null,
      };
    });

  return `${JSON.stringify(
    {
      warning:
        "DO NOT OPEN BEFORE REVIEWING. This file carries the fragment version, " +
        "composition hash and model identity that docs/10 §4.2 keeps out of the " +
        "packets to avoid anchoring. It exists so completed verdicts can be " +
        "attributed to their cases afterwards.",
      packets: rows,
    },
    null,
    2,
  )}\n`;
}

/**
 * The bundle index: what exists, what each criterion can be judged from, and
 * what is missing.
 *
 * Mechanical throughout. It reports which stages were recorded and which
 * criteria therefore have material; it does not say whether that material is
 * good, which is the review.
 */
export function buildIndex(
  packets: readonly ReviewPacket[],
  stagesByCase: ReadonlyMap<string, readonly string[]>,
): string {
  const byType = new Map<string, ReviewPacket[]>();
  for (const packet of packets) {
    byType.set(packet.inputType, [
      ...(byType.get(packet.inputType) ?? []),
      packet,
    ]);
  }

  const lines: string[] = [
    "# Review bundle index",
    "",
    `Rubric version \`${RUBRIC_VERSION}\`. ${String(packets.length)} packet(s).`,
    "",
    "Read `README.md` first. Do not open the unblinding index until every verdict",
    "is written.",
    "",
    "---",
    "",
    "## Packets by input type",
    "",
    "Stage names are what was *recorded*, in order. They say what ran, not whether",
    "what ran was right.",
    "",
    "| Packet | Input type | Stages recorded | C-7 comparison candidates |",
    "|---|---|---|---|",
  ];

  for (const [inputType, group] of [...byType].sort()) {
    for (const packet of group) {
      const stages = stagesByCase.get(packet.caseId) ?? [];
      const peers = group
        .filter((p) => p.reviewerId !== packet.reviewerId)
        .map((p) => p.reviewerId)
        .sort();
      lines.push(
        `| \`${packet.reviewerId}\` | ${inputType} | ${
          stages.length === 0 ? "*none*" : stages.join(" → ")
        } | ${peers.length === 0 ? "*none*" : peers.map((p) => `\`${p}\``).join(", ")} |`,
      );
    }
  }

  lines.push(
    "",
    `${[...byType]
      .sort()
      .map(([type, group]) => `**${type}**: ${String(group.length)}`)
      .join(" · ")}`,
    "",
    "⚠️ `docs/10` §4.1 requires ≥20 analyses per input type. No type here reaches",
    "that. This bundle is partial evidence and must be reported as partial.",
    "",
    "---",
    "",
    "## Which evidence supports which criterion",
    "",
    "| Criterion | Assessable here | Evidence available in the packets |",
    "|---|---|---|",
    "| C-1 Grounded | **Yes** | Context extraction carries `provenance` and `source_quote` per element; later stages cite `grounded_in_context_indices` back into that array |",
    "| C-2 Specific | **Partly** | Architecture components and responsibilities, where an architecture stage was recorded. The `AC-013` do-not-automate clause has no material — that is a Stage 7 output |",
    "| C-3 Proportional | **No** | Requires the artifact set and `ARTIFACT_PLAN_ENTRY`. Stages 8–9 did not exist at capture |",
    "| C-4 Complete | **Partly** | Context elements, the sufficiency judgment, and which stages ran. Artifact-level omission has no material |",
    "| C-5 Honest | **Partly** | Unknowns and resolution hints in context extraction. The `FR-045` confidence clause has no material — Stage 11 is deferred (`docs/12` D-33) |",
    "| C-6 Defensible | **No** | Requires `FR-034` stated criteria plus a rejected alternative. That is a Stage 7 output; Stage 7 did not exist at capture |",
    "| C-7 Consistent | **Yes, within type** | Same-input-type peers, named per packet. The repeated-run clause has no material — every capture ran at default sampling, so repeat-run stability was never measured |",
    "",
    "Per §3.5 an analysis passes only when all seven criteria pass. C-3 and C-6 are",
    "not assessable throughout, so **no packet in this bundle can be recorded as a",
    "rubric pass.** That is a property of the evidence, not of the reasoning.",
    "",
    "---",
    "",
    "## What a complete review would need, and this bundle does not have",
    "",
    "| Missing | Consequence | What would supply it |",
    "|---|---|---|",
    "| Stage 7 recommendations | C-6 unassessable; C-2's `AC-013` clause unassessable | A capture against the current pipeline |",
    "| Stage 8–9 artifact plans and artifacts | C-3 unassessable | A capture against the current pipeline |",
    "| Stage 11 confidence bands | C-5's `FR-045` clause unassessable; §4.1 stratification impossible; §7 calibration impossible | Stage 11, deferred by `docs/12` D-33 |",
    "| ≥20 analyses per input type (§4.1) | Sample too small for a v1.0 gate | More corpus capture |",
    "| `existing_workflow` and `technical_assessment` recordings | Two of four input types unrepresented | Capture for those paths |",
    "| Repeat runs of the same input | C-7's `FR-024` clause unassessable | A second capture of the same cases |",
    "| A second independent reviewer (§4.3, ambiguity A-1) | No agreement measurement is possible from one reviewer (§5) | A human other than the analysis author |",
    "",
    "---",
    "",
    "## If two people review the same packets",
    "",
    "`docs/10` §5 becomes available and is worth using: agreement is computed",
    "**per criterion**, `not assessable` verdicts are excluded from both sides of",
    "the ratio, and every disagreement produces a log entry with both verdicts,",
    "both pieces of evidence, and a type (§5.4). Where disagreement persists, §5.5",
    "is explicit that **the failing verdict stands**.",
    "",
  );

  return `${lines.join("\n")}\n`;
}
