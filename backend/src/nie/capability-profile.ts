/**
 * The capability profile — what the operator has actually demonstrated.
 *
 * WHY THIS EXISTS AND WHY IT IS NEW. `FR-022` requires the job-description path
 * to produce "skill gap analysis", and no authoritative document says *gap
 * against what*. Every other input to the NIE describes the submitted artifact;
 * nothing modelled the person the analysis is for. Stage 7 cannot decide
 * between applying and building without one side of that comparison, so the
 * profile is a new primitive rather than an unbuilt part of an existing one.
 *
 * IT IS AUTHORED, NOT INFERRED. The profile is a version-controlled repository
 * asset — the same shape `docs/11` gives the corpus and `docs/12` D-3 gives
 * prompt fragments: reviewable as a diff, owned by a human, never written by
 * the system. NAIGX writing its own capability inventory would let it justify
 * whatever verdict it liked.
 *
 * EVIDENCE IS THE UNIT, NOT CLAIMED SKILL. Two rules are enforced here rather
 * than left to the model:
 *
 *   · a capability with no evidence cannot be loaded, so it can never be cited
 *     in a match;
 *   · `familiar` depth loads but is **not matchable** (`isMatchable`) —
 *     familiarity is not a demonstration, and a gap analysis that accepts it
 *     recommends applying when it should recommend building.
 *
 * Reads the filesystem and nothing else — no database, no network, no provider.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

/**
 * `research/capability-profile/` — outside `backend/`, for the reason
 * `docs/11` §7.1 keeps the corpus outside it: an inventory inside the source
 * tree invites an import, and this is operator data, not application data.
 */
export const PROFILE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../research/capability-profile/profile.yaml",
);

/** What the evidence proves, in descending order of what it settles. */
export const CAPABILITY_DEPTHS = [
  "production",
  "demonstrated",
  "familiar",
] as const;
export type CapabilityDepth = (typeof CAPABILITY_DEPTHS)[number];

/** Forms of evidence a reader could actually open. */
export const EVIDENCE_TYPES = [
  "workflow",
  "diagram",
  "loom",
  "repo",
  "doc",
  "deployment",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface CapabilityEvidence {
  readonly type: EvidenceType;
  /** A URL or repository path — something that can be opened and checked. */
  readonly locator: string;
  readonly description: string;
}

export interface Capability {
  readonly id: string;
  readonly name: string;
  readonly platforms: readonly string[];
  readonly depth: CapabilityDepth;
  /** At least one. A capability without evidence cannot support a match. */
  readonly evidence: readonly CapabilityEvidence[];
}

export interface CapabilityProfile {
  readonly profileVersion: string;
  readonly owner: string;
  readonly capabilities: readonly Capability[];
}

/** Raised when the profile cannot be read as a trustworthy inventory. */
export class CapabilityProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityProfileError";
  }
}

/**
 * Whether a capability may be cited as evidence of meeting a requirement.
 *
 * `familiar` is excluded deliberately, and the asymmetry is the point:
 * accepting familiarity as demonstration produces "apply now" on a posting the
 * operator cannot evidence, which costs an application and a first impression;
 * rejecting it produces "build first" on something they could arguably already
 * do, which costs time. Only the second error is recoverable.
 */
export const isMatchable = (capability: Capability): boolean =>
  capability.depth !== "familiar";

type Doc = Record<string, unknown>;

const fail = (message: string): never => {
  throw new CapabilityProfileError(`capability profile: ${message}`);
};

const requireString = (doc: Doc, key: string, where: string): string => {
  const value = doc[key];
  if (typeof value !== "string" || value.trim() === "") {
    return fail(`${where}: "${key}" must be a non-empty string`);
  }
  return value.trim();
};

const requireMember = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  key: string,
  where: string,
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return fail(
      `${where}: "${key}" must be one of ${allowed.join(" | ")} (found ${JSON.stringify(value)})`,
    );
  }
  return value as T;
};

function parseEvidence(value: unknown, where: string): CapabilityEvidence {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(`${where}: each evidence item must be a mapping`);
  }
  const doc = value as Doc;
  return {
    type: requireMember(doc["type"], EVIDENCE_TYPES, "type", where),
    // A locator is what separates evidence from assertion.
    locator: requireString(doc, "locator", where),
    description: requireString(doc, "description", where),
  };
}

function parseCapability(value: unknown, index: number): Capability {
  const where = `capabilities[${String(index)}]`;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(`${where}: must be a mapping`);
  }
  const doc = value as Doc;

  const platforms = doc["platforms"];
  if (
    platforms !== undefined &&
    (!Array.isArray(platforms) || platforms.some((p) => typeof p !== "string"))
  ) {
    fail(`${where}: "platforms" must be a list of strings`);
  }

  const rawEvidence = doc["evidence"];
  if (!Array.isArray(rawEvidence) || rawEvidence.length === 0) {
    fail(
      `${where}: at least one evidence item is required — a capability that cannot be evidenced cannot be cited in a match`,
    );
  }

  return {
    id: requireString(doc, "id", where),
    name: requireString(doc, "name", where),
    platforms: (platforms ?? []) as readonly string[],
    depth: requireMember(doc["depth"], CAPABILITY_DEPTHS, "depth", where),
    evidence: (rawEvidence as unknown[]).map((e, i) =>
      parseEvidence(e, `${where}.evidence[${String(i)}]`),
    ),
  };
}

/** Parses profile text. Exported so tests can drive it without the filesystem. */
export function parseCapabilityProfile(raw: string): CapabilityProfile {
  // Normalised first, for the reason `fragments/source.ts` normalises: a
  // Windows checkout must agree with a Linux one.
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw.replace(/\r\n/g, "\n")) as unknown;
  } catch (error) {
    return fail(
      `not valid YAML — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fail("expected a YAML mapping at the document root");
  }
  const doc = parsed as Doc;

  const rawCapabilities = doc["capabilities"];
  if (!Array.isArray(rawCapabilities)) {
    fail('"capabilities" must be a list (use [] when the profile is empty)');
  }

  const capabilities = (rawCapabilities as unknown[]).map(parseCapability);

  // Ids are what Stage 7 cites in a match, so a duplicate would make a citation
  // ambiguous and the evidence behind a verdict unresolvable.
  const seen = new Map<string, number>();
  capabilities.forEach((capability, index) => {
    const first = seen.get(capability.id);
    if (first !== undefined) {
      fail(
        `capabilities[${String(index)}]: id ${JSON.stringify(capability.id)} is already used by capabilities[${String(first)}]`,
      );
    }
    seen.set(capability.id, index);
  });

  return {
    profileVersion: requireString(doc, "profile_version", "profile"),
    owner: requireString(doc, "owner", "profile"),
    capabilities,
  };
}

export function loadCapabilityProfile(
  profilePath: string = PROFILE_PATH,
): CapabilityProfile {
  if (!fs.existsSync(profilePath)) {
    return fail(`not found at ${profilePath}`);
  }
  return parseCapabilityProfile(fs.readFileSync(profilePath, "utf8"));
}
