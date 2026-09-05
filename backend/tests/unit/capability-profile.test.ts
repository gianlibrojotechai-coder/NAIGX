/**
 * Unit — the capability profile loader.
 *
 * The profile is one half of every gap analysis, so its integrity decides
 * whether a verdict means anything. Two rules carry the weight and both are
 * asserted as refusals: a capability without evidence cannot load, and
 * `familiar` depth is not matchable.
 *
 * The fixtures here are synthetic and say so. The real profile
 * (`research/capability-profile/profile.yaml`) is the operator's inventory and
 * is never authored by the system.
 *
 * No filesystem writes, no database, no provider.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CapabilityProfileError,
  isMatchable,
  loadCapabilityProfile,
  parseCapabilityProfile,
  PROFILE_PATH,
} from "../../src/nie/capability-profile.js";

const VALID = `profile_version: profile-v1
owner: test-operator
capabilities:
  - id: cap-001
    name: Multi-system workflow orchestration
    platforms: [n8n]
    depth: demonstrated
    evidence:
      - type: workflow
        locator: https://example.invalid/lead-routing.json
        description: Nine-node lead routing workflow with an error branch
  - id: cap-002
    name: CRM integration
    platforms: [HubSpot]
    depth: familiar
    evidence:
      - type: doc
        locator: https://example.invalid/notes.md
        description: Notes from reading the HubSpot API docs
`;

// --- the shape loads -----------------------------------------------------

test("a well-formed profile parses", () => {
  const profile = parseCapabilityProfile(VALID);

  assert.equal(profile.profileVersion, "profile-v1");
  assert.equal(profile.owner, "test-operator");
  assert.equal(profile.capabilities.length, 2);

  const first = profile.capabilities[0];
  assert.ok(first);
  assert.equal(first.id, "cap-001");
  assert.equal(first.depth, "demonstrated");
  assert.deepEqual(first.platforms, ["n8n"]);
  assert.equal(first.evidence.length, 1);
  assert.equal(first.evidence[0]?.type, "workflow");
});

test("platforms are optional and default to empty", () => {
  const profile = parseCapabilityProfile(
    VALID.replace("    platforms: [n8n]\n", ""),
  );
  assert.deepEqual(profile.capabilities[0]?.platforms, []);
});

test("an empty profile is valid — a new operator has nothing to cite yet", () => {
  const profile = parseCapabilityProfile(
    "profile_version: profile-v1\nowner: test-operator\ncapabilities: []\n",
  );
  assert.deepEqual(profile.capabilities, []);
});

// --- familiarity is not demonstration ------------------------------------

test("familiar depth loads but is not matchable", () => {
  // The asymmetry the whole verdict rests on. Accepting familiarity would let
  // a gap analysis conclude "apply now" for a posting the operator cannot
  // evidence — the one error that costs a real application.
  const profile = parseCapabilityProfile(VALID);
  const [demonstrated, familiar] = profile.capabilities;
  assert.ok(demonstrated && familiar);

  assert.equal(isMatchable(demonstrated), true);
  assert.equal(isMatchable(familiar), false, "familiar is never matchable");
});

test("production and demonstrated are both matchable", () => {
  const profile = parseCapabilityProfile(
    VALID.replace("depth: demonstrated", "depth: production"),
  );
  const promoted = profile.capabilities[0];
  assert.ok(promoted);
  assert.equal(isMatchable(promoted), true);
});

// --- evidence is the unit ------------------------------------------------

test("a capability with no evidence is rejected, not downgraded", () => {
  const noEvidence = `profile_version: profile-v1
owner: test-operator
capabilities:
  - id: cap-001
    name: Something claimed
    depth: production
    evidence: []
`;
  assert.throws(
    () => parseCapabilityProfile(noEvidence),
    (error: unknown) =>
      error instanceof CapabilityProfileError &&
      /at least one evidence item/.test(error.message),
  );
});

test("evidence without a locator is rejected — that is assertion, not evidence", () => {
  assert.throws(
    () =>
      parseCapabilityProfile(
        VALID.replace(
          "        locator: https://example.invalid/lead-routing.json\n",
          "",
        ),
      ),
    (error: unknown) =>
      error instanceof CapabilityProfileError && /locator/.test(error.message),
  );
});

// --- malformed profiles fail loudly --------------------------------------

test("malformed profiles are rejected rather than half-loaded", () => {
  const cases: readonly [string, string][] = [
    ["not YAML", ":\n  - ["],
    [
      "a missing profile_version",
      VALID.replace("profile_version: profile-v1\n", ""),
    ],
    ["a missing owner", VALID.replace("owner: test-operator\n", "")],
    [
      "capabilities not a list",
      "profile_version: profile-v1\nowner: t\ncapabilities: nope\n",
    ],
    ["an unknown depth", VALID.replace("depth: demonstrated", "depth: expert")],
    [
      "an unknown evidence type",
      VALID.replace("type: workflow", "type: vibes"),
    ],
    ["a missing capability id", VALID.replace("  - id: cap-001\n", "  - \n")],
  ];

  for (const [label, text] of cases) {
    assert.throws(
      () => parseCapabilityProfile(text),
      CapabilityProfileError,
      `${label} must be rejected`,
    );
  }
});

test("duplicate capability ids are rejected — a match citation must resolve", () => {
  assert.throws(
    () => parseCapabilityProfile(VALID.replace("id: cap-002", "id: cap-001")),
    (error: unknown) =>
      error instanceof CapabilityProfileError &&
      /already used by/.test(error.message),
  );
});

test("CRLF and LF checkouts agree", () => {
  assert.deepEqual(
    parseCapabilityProfile(VALID.replace(/\n/g, "\r\n")),
    parseCapabilityProfile(VALID),
  );
});

// --- the committed profile -----------------------------------------------

test("the committed profile loads and is operator-authored", () => {
  // It ships empty on purpose: NAIGX inventing entries here would corrupt
  // every verdict it produces. This asserts it is *loadable*, not populated.
  const profile = loadCapabilityProfile(PROFILE_PATH);
  assert.equal(profile.profileVersion, "profile-v1");
  assert.ok(Array.isArray(profile.capabilities));
});

test("a missing profile fails with the path, not a crash", () => {
  assert.throws(
    () => loadCapabilityProfile("does/not/exist.yaml"),
    (error: unknown) =>
      error instanceof CapabilityProfileError &&
      /not found at/.test(error.message),
  );
});
