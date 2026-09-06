/**
 * Unit — reviewer packets for the `M-08` partial rubric review (`docs/10` §4).
 *
 * The properties under test are all about restraint. A packet builder is a
 * small thing to get right and an easy thing to get wrong in one specific
 * direction: by helpfully filling in the answer. `docs/10` §4.3 excludes AI
 * review "in any capacity, for any criterion", so a generated verdict is not a
 * bug in formatting — it is inadmissible evidence written into a retained
 * record.
 *
 * Runs against the **real** committed recordings and the real corpus, because
 * the claim being made is about those specific thirteen files. No provider, no
 * database, no network.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { loadCorpus } from "../../src/regression/corpus.js";
import {
  createRecordingStore,
  type CaseRecording,
} from "../../src/regression/recording-store.js";
import {
  buildPacket,
  buildPackets,
  buildUnblindingIndex,
  reviewerId,
  NOT_ASSESSABLE,
  RUBRIC_CRITERIA,
  buildIndex,
  type PacketInput,
} from "../../src/regression/review-packet.js";

const CORPUS_VERSION = "corpus-v1";

/** Every corpus case that has a manifest-verified recording. */
const packetInputs = (): {
  inputs: PacketInput[];
  recordings: Map<string, CaseRecording>;
} => {
  const store = createRecordingStore();
  const recorded = new Set(store.list(CORPUS_VERSION));
  const recordings = new Map<string, CaseRecording>();
  const inputs: PacketInput[] = [];

  for (const corpusCase of loadCorpus()) {
    if (!recorded.has(corpusCase.caseId)) continue;
    const verified = store.read(CORPUS_VERSION, corpusCase.caseId);
    if (verified === undefined) continue;
    recordings.set(corpusCase.caseId, verified.recording);
    inputs.push({ corpusCase, recording: verified.recording });
  }
  return { inputs, recordings };
};

// --- coverage -------------------------------------------------------------

test("every committed recording produces a packet", () => {
  const { inputs } = packetInputs();
  const packets = buildPackets(inputs);

  assert.equal(
    packets.length,
    13,
    "the thirteen committed recordings are the whole available sample",
  );
  assert.equal(
    new Set(packets.map((p) => p.reviewerId)).size,
    13,
    "identifiers are unique, or two analyses share a review record",
  );
});

test("the sample covers only business_requirement and unsupported", () => {
  // Stated as a test so a later capture that widens the corpus fails here and
  // forces the M-11 non-claim to be revisited deliberately.
  const { inputs } = packetInputs();
  const types = new Set(inputs.map((i) => i.corpusCase.inputType));

  assert.deepEqual(
    [...types].sort(),
    ["business_requirement", "unsupported"],
    "these packets are not evidence for existing_workflow or technical_assessment",
  );
});

// --- blindness (docs/10 §4.2) --------------------------------------------

test("packets carry no fragment version, composition hash or model identity", () => {
  const { inputs } = packetInputs();

  for (const input of buildPackets(inputs)) {
    const body = input.content;
    for (const forbidden of [
      "fragments-v1",
      "fragmentsManifestVersion",
      "fragmentsCompositionHash",
      "claude",
      "anthropic",
      "modelKey",
      "inputTextHash",
    ]) {
      assert.ok(
        !body.toLowerCase().includes(forbidden.toLowerCase()),
        `${input.reviewerId} exposes "${forbidden}" — §4.2 anchoring`,
      );
    }
  }
});

test("packets carry no corpus expectation", () => {
  // §4.2: "the reviewer should also not know whether the analysis is expected
  // to pass." The corpus states the expected classification, artifact set,
  // confidence band and a written rationale — every one of them an answer key.
  const { inputs } = packetInputs();

  for (const input of inputs) {
    const packet = buildPacket(input);
    const body = packet.content;

    assert.ok(
      !body.includes(input.corpusCase.rationale.slice(0, 60)),
      "the corpus rationale is an answer key and must not travel with the question",
    );
    for (const artifactType of input.corpusCase.expectedArtifactSet) {
      assert.ok(
        !body.includes(artifactType),
        `expected artifact "${artifactType}" leaked into ${packet.reviewerId}`,
      );
    }
    assert.ok(!body.includes("expected_"), "no expectation field names");
    assert.ok(
      !body.includes(`case_character`) && !body.includes("special_class"),
      "case character and special class are authored labels, not evidence",
    );
  }
});

test("the reviewer identifier does not announce the case", () => {
  const { inputs } = packetInputs();

  for (const input of buildPackets(inputs)) {
    assert.match(input.reviewerId, /^RP-[0-9a-f]{8}$/);
    assert.ok(
      !input.content.includes(input.caseId),
      `${input.reviewerId} still names ${input.caseId}`,
    );
  }
});

test("the unblinding index holds what the packets withhold", () => {
  // Attribution must be recoverable afterwards — a verdict nobody can trace to
  // a case is not evidence — but recoverable from a separate, clearly marked
  // file rather than from the packet being read.
  const { inputs, recordings } = packetInputs();
  const index = buildUnblindingIndex(buildPackets(inputs), recordings);
  const parsed = JSON.parse(index) as {
    warning: string;
    packets: {
      reviewerId: string;
      caseId: string;
      fragmentsManifestVersion: string | null;
    }[];
  };

  assert.match(parsed.warning, /DO NOT OPEN BEFORE REVIEWING/);
  assert.equal(parsed.packets.length, 13);
  assert.ok(
    parsed.packets.every(
      (p) => p.caseId !== "" && p.fragmentsManifestVersion !== null,
    ),
    "every packet is attributable once the review is done",
  );
  assert.equal(
    parsed.packets.find((p) => p.caseId === "br-001")?.reviewerId,
    reviewerId("br-001"),
  );
});

// --- source fidelity ------------------------------------------------------

test("the submitted input reaches the reviewer verbatim", () => {
  const { inputs } = packetInputs();

  for (const input of inputs) {
    assert.ok(
      buildPacket(input).content.includes(input.corpusCase.inputText),
      `${input.corpusCase.caseId} input text was altered`,
    );
  }
});

test("every recorded stage output reaches the reviewer", () => {
  // Reformatted, never rewritten: C-1 asks whether a claim traces to context,
  // which cannot be judged from a summary of what the model said.
  const { inputs } = packetInputs();

  for (const input of inputs) {
    const packet = buildPacket(input).content;
    for (const stage of input.recording.stages) {
      // Some captures wrap their JSON in a markdown fence — real model
      // behaviour. The renderer unwraps a *closed* fence so it does not nest
      // inside the packet's own; an unterminated one is left exactly as
      // captured. The test mirrors both.
      const closed = /^```[a-z]*\n([\s\S]*)\n```$/i.exec(stage.output.trim());
      const inner = closed?.[1] ?? stage.output;
      let expected: string;
      try {
        expected = JSON.stringify(JSON.parse(inner) as unknown, null, 2);
      } catch {
        expected = inner;
      }
      assert.ok(
        packet.includes(expected),
        `${input.corpusCase.caseId} lost the ${stage.stageKey} output`,
      );
    }
  }
});

test("packet generation does not write to the recordings", () => {
  const { inputs, recordings } = packetInputs();
  const before = JSON.stringify([...recordings.entries()]);

  buildPackets(inputs);
  buildUnblindingIndex(buildPackets(inputs), recordings);

  assert.equal(
    JSON.stringify([...recordings.entries()]),
    before,
    "the recordings are immutable source evidence",
  );
});

// --- no verdict is generated ---------------------------------------------

test("no criterion arrives with a pass or fail", () => {
  // The property this whole module exists to preserve (`docs/10` §4.3).
  const { inputs } = packetInputs();

  for (const packet of buildPackets(inputs)) {
    const verdicts = packet.content
      .split("\n")
      .filter((line) => line.startsWith("**Verdict:**"));

    assert.equal(
      verdicts.length,
      RUBRIC_CRITERIA.length,
      "one verdict line per criterion",
    );
    for (const line of verdicts) {
      const decided =
        line.includes("NOT ASSESSABLE") ||
        line.includes("` pass / fail / not assessable `");
      assert.ok(
        decided,
        `${packet.reviewerId} carries a pre-decided verdict: ${line}`,
      );
    }
  }
});

test("an overall pass is not reachable and the packet says so", () => {
  const { inputs } = packetInputs();

  for (const packet of buildPackets(inputs)) {
    assert.match(packet.content, /cannot be recorded as a rubric pass/);
    assert.match(packet.content, /This is not an M-08 pass/);
    assert.ok(
      !packet.content.includes("**Overall:** pass"),
      "no overall pass is pre-filled",
    );
  }
});

// --- C-3 and C-6 ----------------------------------------------------------

test("C-3 and C-6 are marked not assessable, with the reason", () => {
  const { inputs } = packetInputs();
  const packet = buildPacket(inputs[0] as PacketInput);

  assert.match(packet.content, /C-3 · Proportional/);
  assert.ok(packet.content.includes(NOT_ASSESSABLE["C-3"] as string));
  assert.match(packet.content, /ARTIFACT_PLAN_ENTRY/);
  assert.match(packet.content, /artifact_set/);

  assert.match(packet.content, /C-6 · Defensible/);
  assert.ok(packet.content.includes(NOT_ASSESSABLE["C-6"] as string));
  assert.match(packet.content, /FR-034/);
  assert.match(packet.content, /do_not_automate_conclusion/);
});

test("the five assessable criteria are left blank", () => {
  const { inputs } = packetInputs();
  const body = buildPacket(inputs[0] as PacketInput).content;

  for (const id of ["C-1", "C-2", "C-4", "C-5", "C-7"]) {
    assert.equal(
      NOT_ASSESSABLE[id],
      undefined,
      `${id} must not be pre-marked — it is the reviewer's to decide`,
    );
    const section = body.slice(body.indexOf(`#### ${id} ·`));
    assert.match(
      section.slice(0, section.indexOf("####", 4) + 1 || undefined),
      /` pass \/ fail \/ not assessable `/,
      `${id} has no blank verdict line`,
    );
  }
});

// --- the §4.4 record ------------------------------------------------------

test("the record carries every docs/10 §4.4 field", () => {
  const { inputs } = packetInputs();
  const packet = buildPacket(inputs[0] as PacketInput);

  for (const field of [
    "Analysis identifier",
    "Input type",
    "Assigned confidence band",
    "Reviewer identifier",
    "Date (ISO 8601)",
    "Overall",
  ]) {
    assert.ok(
      packet.content.includes(field),
      `§4.4 field "${field}" is missing`,
    );
  }
  assert.equal(RUBRIC_CRITERIA.length, 7, "all seven criteria are present");
});

test("the absent confidence band is reported, not invented", () => {
  const { inputs } = packetInputs();

  for (const packet of buildPackets(inputs)) {
    assert.match(
      packet.content,
      /\*\*Assigned confidence band:\*\* not available/,
      "Stage 11 is deferred; a band here would be fabricated",
    );
    for (const band of ["high", "medium", "low"]) {
      assert.ok(
        !packet.content.includes(`confidence band:** ${band}`),
        `a "${band}" band was invented`,
      );
    }
  }
});

test("the corpus-versus-runtime distinction travels with the packet", () => {
  const { inputs } = packetInputs();

  for (const packet of buildPackets(inputs)) {
    assert.match(packet.content, /D-24/);
    assert.match(
      packet.content,
      /not.*evidence that the prompts now in force/s,
    );
  }
});

// --- determinism ----------------------------------------------------------

test("regeneration is byte-identical", () => {
  const { inputs, recordings } = packetInputs();

  const first = buildPackets(inputs);
  const second = buildPackets([...inputs].reverse());

  assert.deepEqual(
    first.map((p) => [p.filename, p.content]),
    second.map((p) => [p.filename, p.content]),
    "input ordering must not change the output",
  );
  assert.equal(
    buildUnblindingIndex(first, recordings),
    buildUnblindingIndex(second, recordings),
  );
});

test("the reviewer identifier is stable across runs", () => {
  assert.equal(reviewerId("br-001"), reviewerId("br-001"));
  assert.notEqual(reviewerId("br-001"), reviewerId("br-002"));
  assert.match(reviewerId("br-001"), /^RP-[0-9a-f]{8}$/);
});

test("packets are ordered by reviewer id, not by case id", () => {
  const { inputs } = packetInputs();
  const packets = buildPackets(inputs);
  const ids = packets.map((p) => p.reviewerId);

  assert.deepEqual(ids, [...ids].sort(), "ordering is derived and stable");
});

test("a fenced capture does not nest a code fence inside the packet", () => {
  // Several recordings wrap their JSON in a markdown fence. Rendered as
  // captured, that fence nests inside the packet's own and the reviewer reads
  // markup instead of reasoning.
  const { inputs } = packetInputs();

  for (const packet of buildPackets(inputs)) {
    // Walk the packet as a reader's markdown parser would: a block opens on a
    // fence line and closes only on a line of the *same* delimiter. If a
    // captured stray fence could close a block early, the rest of the packet
    // renders as markup instead of evidence.
    let open: string | null = null;
    let blocks = 0;

    for (const line of packet.content.split("\n")) {
      const fence = /^(`{3,})[a-z]*$/i.exec(line);
      if (fence === null) continue;
      const delimiter = fence[1] as string;

      if (open === null) {
        open = delimiter;
      } else if (delimiter === open) {
        open = null;
        blocks += 1;
      }
    }

    assert.equal(open, null, `${packet.reviewerId} leaves a fence unclosed`);
    assert.ok(blocks >= 2, `${packet.reviewerId} lost its content blocks`);
  }
});

// --- bundle additions -----------------------------------------------------

test("every packet records the rubric version", () => {
  // `docs/10` §6 — reviews under different rubric versions are not comparable,
  // so a record without the version cannot be placed against any other.
  const { inputs } = packetInputs();

  for (const packet of buildPackets(inputs)) {
    assert.match(packet.content, /\*\*Rubric version:\*\* rubric-v1/);
  }
});

test("each criterion shows what failing looks like", () => {
  const { inputs } = packetInputs();
  const body = buildPacket(inputs[0] as PacketInput, []).content;

  for (const criterion of RUBRIC_CRITERIA) {
    assert.ok(
      body.includes(criterion.failingLooksLike),
      `${criterion.id} omits its "failing looks like" text`,
    );
  }
});

test("C-7 names same-type comparison candidates and no others", () => {
  const { inputs } = packetInputs();
  const packets = buildPackets(inputs);
  const typeOf = new Map(packets.map((p) => [p.reviewerId, p.inputType]));

  for (const packet of packets) {
    const section = packet.content.slice(packet.content.indexOf("#### C-7 ·"));
    const named = [...section.matchAll(/RP-[0-9a-f]{8}/g)].map((m) => m[0]);

    assert.ok(named.length > 0, `${packet.reviewerId} names no candidate`);
    for (const candidate of named) {
      assert.equal(
        typeOf.get(candidate),
        packet.inputType,
        `${packet.reviewerId} offers a different-type comparison`,
      );
      assert.notEqual(
        candidate,
        packet.reviewerId,
        "a packet is not its own comparison case",
      );
    }
  }
});

test("the index reports coverage without judging it", () => {
  const { inputs, recordings } = packetInputs();
  const packets = buildPackets(inputs);
  const stages = new Map<string, readonly string[]>(
    [...recordings].map(([caseId, r]) => [
      caseId,
      r.stages.map((s) => s.stageKey),
    ]),
  );
  const index = buildIndex(packets, stages);

  assert.match(index, /\*\*business_requirement\*\*: 11/);
  assert.match(index, /\*\*unsupported\*\*: 2/);
  assert.match(index, /≥20 analyses per input type/);
  assert.match(index, /no packet in this bundle can be recorded as a/);
  assert.match(index, /second independent reviewer/);

  for (const packet of packets) {
    assert.ok(
      index.includes(packet.reviewerId),
      `${packet.reviewerId} missing from the index`,
    );
    assert.ok(!index.includes(packet.caseId), "the index must stay blind");
  }
  // The index may quote the rubric's pass *condition* — it must not attach a
  // verdict to a packet. So the check is per line: no line naming a packet may
  // also carry pass/fail language.
  for (const line of index.split("\n")) {
    if (!/RP-[0-9a-f]{8}/.test(line)) continue;
    assert.ok(
      !/\b(pass|passes|passed|fail|fails|failed)\b/i.test(line),
      `a packet is given a verdict: ${line}`,
    );
  }
});

test("the index is deterministic", () => {
  const { inputs, recordings } = packetInputs();
  const stages = new Map<string, readonly string[]>(
    [...recordings].map(([caseId, r]) => [
      caseId,
      r.stages.map((s) => s.stageKey),
    ]),
  );

  assert.equal(
    buildIndex(buildPackets(inputs), stages),
    buildIndex(buildPackets([...inputs].reverse()), stages),
  );
});
