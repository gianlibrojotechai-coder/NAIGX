/**
 * Artifact schema publication (`DB §4.4` ARTIFACT_SCHEMA).
 *
 * Mirrors the fragment pattern `docs/12` D-3 established: **authored in the
 * repository, published to the database, referenced from the database at
 * runtime.** `backend/schemas/` holds the definition a developer reviews;
 * `ARTIFACT_SCHEMA` holds the version an `ARTIFACT` row points at, so a stored
 * artifact always knows which schema version it satisfied.
 *
 * VERSIONS ARE ASSIGNED, NOT DERIVED. `ARTIFACT_SCHEMA_VERSION` is a declared
 * constant. A content hash would version the schema automatically, and an
 * automatic version is one nobody decided — the append-only guarantee
 * (`DB §4.4`, `DP-4`) is only meaningful if a new version is a deliberate act.
 *
 * AN EXISTING VERSION IS IMMUTABLE. Publishing a *different* definition under
 * a version that already exists fails loudly rather than updating it. Rows
 * already reference that version, and silently changing the definition beneath
 * them would make every stored `validation_status` a claim about a schema that
 * no longer exists.
 *
 * Reads one file and one table. No provider, no network.
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import {
  ARTIFACT_SCHEMA_VERSION,
  loadArtifactSchemaDefinition,
} from "../nie/artifact-validation.js";
import type { ArtifactType } from "../nie/contracts.js";

/**
 * A key-order-independent rendering of a JSON value, for comparison only.
 *
 * ⚠️ THE STORE DOES NOT PRESERVE KEY ORDER. `definition` is a Postgres `jsonb`
 * column, and `jsonb` normalises objects — keys come back sorted by length then
 * bytewise, so `{"$schema":…,"$id":…}` reads back as `{"$id":…,"$schema":…}`.
 * Comparing with `JSON.stringify` alone therefore reports a difference for a
 * definition that round-tripped **unchanged**, which turns every check into a
 * false immutability violation and invites version bumps for changes that never
 * happened. Found against real Postgres; the in-memory fake preserved order and
 * could not have surfaced it.
 *
 * Array order is preserved, because in JSON it is significant and `jsonb` keeps
 * it. Only object keys are reordered.
 */
function canonicalJson(value: unknown): string {
  const canonicalise = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(canonicalise);
    if (node !== null && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, child]) => [key, canonicalise(child)]),
      );
    }
    return node;
  };
  return JSON.stringify(canonicalise(value));
}

/**
 * Whether a stored definition still says what the authored file says.
 *
 * Exported so the `schemas:check` command asks the question exactly one way.
 */
export function definitionsMatch(stored: unknown, authored: unknown): boolean {
  return canonicalJson(stored) === canonicalJson(authored);
}

/** Raised when a published version would change beneath the rows using it. */
export class ArtifactSchemaConflictError extends Error {
  readonly artifactType: string;
  readonly version: string;

  constructor(artifactType: string, version: string) {
    super(
      `Artifact schema "${artifactType}" version ${version} is already published with a different definition. ` +
        "A published version is immutable (DB §4.4, DP-4) because stored artifacts reference it. " +
        "Bump ARTIFACT_SCHEMA_VERSION and publish the change as a new version.",
    );
    this.name = "ArtifactSchemaConflictError";
    this.artifactType = artifactType;
    this.version = version;
  }
}

export type PublishOutcome = "published" | "unchanged";

export interface PublishResult {
  readonly artifactType: string;
  readonly version: string;
  readonly schemaId: string;
  readonly outcome: PublishOutcome;
}

/**
 * Publishes one artifact schema, or confirms it is already published.
 *
 * @throws ArtifactSchemaConflictError when the version exists with different
 * content.
 */
export async function publishArtifactSchema(
  prisma: PrismaClient,
  artifactType: ArtifactType,
  version: string = ARTIFACT_SCHEMA_VERSION,
): Promise<PublishResult> {
  const definition = loadArtifactSchemaDefinition(artifactType);

  const existing = await prisma.artifactSchema.findUnique({
    where: { artifactType_version: { artifactType, version } },
  });

  if (existing !== null) {
    // Compared by value, not by reference or hash: the stored column is the
    // artifact of record, and the question is whether it still says what the
    // file says — not whether it says it in the same order.
    if (!definitionsMatch(existing.definition, definition)) {
      throw new ArtifactSchemaConflictError(artifactType, version);
    }
    return {
      artifactType,
      version,
      schemaId: existing.schemaId,
      outcome: "unchanged",
    };
  }

  const created = await prisma.artifactSchema.create({
    data: {
      artifactType,
      version,
      definition: definition as object,
      effectiveFrom: new Date(),
    },
  });

  return {
    artifactType,
    version,
    schemaId: created.schemaId,
    outcome: "published",
  };
}

/**
 * Resolves the `schema_id` an `ARTIFACT` row must reference.
 *
 * Refuses rather than publishing on demand. Publication is a deliberate step,
 * and a run that quietly created the schema it was about to claim conformance
 * with would be attesting to its own homework.
 */
export async function requirePublishedSchemaId(
  prisma: PrismaClient,
  artifactType: ArtifactType,
  version: string = ARTIFACT_SCHEMA_VERSION,
): Promise<string> {
  const row = await prisma.artifactSchema.findUnique({
    where: { artifactType_version: { artifactType, version } },
    select: { schemaId: true },
  });

  if (row === null) {
    throw new Error(
      `Artifact schema "${artifactType}" version ${version} is not published. ` +
        "Run `npm run schemas:publish` before storing artifacts of this type.",
    );
  }
  return row.schemaId;
}
