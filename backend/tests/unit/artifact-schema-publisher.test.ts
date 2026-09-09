/**
 * Unit — artifact schema publication (`DB §4.4` ARTIFACT_SCHEMA, `docs/12` D-3).
 *
 * The property under test is immutability. A published version is referenced by
 * every `ARTIFACT` row validated under it, so changing the definition beneath
 * those rows would turn each stored `validation_status` into a claim about a
 * schema that no longer exists. Publication must refuse rather than update.
 *
 * The store is a fake; the schema definition is the **real committed file**, so
 * a change to `schemas/portfolio_suggestions.schema.json` moves these results.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ArtifactSchemaConflictError,
  definitionsMatch,
  publishArtifactSchema,
  requirePublishedSchemaId,
} from "../../src/db/artifact-schema-publisher.js";
import {
  ARTIFACT_SCHEMA_VERSION,
  loadArtifactSchemaDefinition,
} from "../../src/nie/artifact-validation.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

interface Row {
  schemaId: string;
  artifactType: string;
  version: string;
  definition: unknown;
}

const fakeStore = (initial: Row[] = []) => {
  const rows = [...initial];

  const prisma = {
    artifactSchema: {
      findUnique: ({
        where,
      }: {
        where: {
          artifactType_version: { artifactType: string; version: string };
        };
      }) => {
        const { artifactType, version } = where.artifactType_version;
        return Promise.resolve(
          rows.find(
            (r) => r.artifactType === artifactType && r.version === version,
          ) ?? null,
        );
      },
      create: ({ data }: { data: Omit<Row, "schemaId"> }) => {
        const row = { schemaId: `schema-${String(rows.length + 1)}`, ...data };
        rows.push(row);
        return Promise.resolve(row);
      },
    },
  } as unknown as PrismaClient;

  return { prisma, rows };
};

const authored = () => loadArtifactSchemaDefinition("portfolio_suggestions");

// --- publication ---------------------------------------------------------

test("an unpublished schema is published at the declared version", async () => {
  const store = fakeStore();

  const result = await publishArtifactSchema(
    store.prisma,
    "portfolio_suggestions",
  );

  assert.equal(result.outcome, "published");
  assert.equal(result.version, ARTIFACT_SCHEMA_VERSION);
  assert.equal(result.version, "3", "explicitly assigned, not derived");
  assert.equal(store.rows.length, 1);
  assert.deepEqual(
    store.rows[0]?.definition,
    authored(),
    "the stored definition is the authored file verbatim",
  );
});

test("republishing an unchanged schema is a no-op, not a new row", async () => {
  const store = fakeStore();
  const first = await publishArtifactSchema(
    store.prisma,
    "portfolio_suggestions",
  );
  const second = await publishArtifactSchema(
    store.prisma,
    "portfolio_suggestions",
  );

  assert.equal(second.outcome, "unchanged");
  assert.equal(second.schemaId, first.schemaId, "the same row is referenced");
  assert.equal(store.rows.length, 1, "append-only, and nothing was appended");
});

// --- immutability --------------------------------------------------------

test("publishing a different definition under an existing version fails", async () => {
  const store = fakeStore([
    {
      schemaId: "schema-existing",
      artifactType: "portfolio_suggestions",
      version: ARTIFACT_SCHEMA_VERSION,
      // Published earlier, since changed on disk.
      definition: { type: "object", title: "An older shape" },
    },
  ]);

  try {
    await publishArtifactSchema(store.prisma, "portfolio_suggestions");
    assert.fail("expected a conflict, but publication succeeded");
  } catch (error) {
    assert.ok(error instanceof ArtifactSchemaConflictError);
    assert.equal(error.version, ARTIFACT_SCHEMA_VERSION);
    assert.match(error.message, /immutable/);
    assert.match(error.message, /new version/);
  }

  assert.deepEqual(
    store.rows[0]?.definition,
    { type: "object", title: "An older shape" },
    "the published definition is untouched by the failed attempt",
  );
});

test("a deliberate version bump publishes alongside, not over", async () => {
  const store = fakeStore();
  await publishArtifactSchema(store.prisma, "portfolio_suggestions", "1");
  const bumped = await publishArtifactSchema(
    store.prisma,
    "portfolio_suggestions",
    "2",
  );

  assert.equal(bumped.outcome, "published");
  assert.equal(store.rows.length, 2, "version 1 still exists");
  assert.deepEqual(store.rows.map((r) => r.version).sort(), ["1", "2"]);
});

// --- resolution -----------------------------------------------------------

test("an artifact cannot reference an unpublished schema", async () => {
  const store = fakeStore();

  await assert.rejects(
    requirePublishedSchemaId(store.prisma, "portfolio_suggestions"),
    /not published/,
    "publication is deliberate; a run must not create the schema it claims to satisfy",
  );
});

test("a published schema resolves to the id an ARTIFACT row references", async () => {
  const store = fakeStore();
  const published = await publishArtifactSchema(
    store.prisma,
    "portfolio_suggestions",
  );

  assert.equal(
    await requirePublishedSchemaId(store.prisma, "portfolio_suggestions"),
    published.schemaId,
  );
});

// --- one source of truth --------------------------------------------------

test("validation and publication read the same definition", async () => {
  // `AI §9.3` — "the same schema drives generation guidance and validation —
  // they cannot disagree." Publication stores what `loadArtifactSchemaDefinition`
  // returns, and `validateArtifact` compiles the same call.
  const store = fakeStore();
  await publishArtifactSchema(store.prisma, "portfolio_suggestions");

  assert.deepEqual(store.rows[0]?.definition, authored());
  assert.equal(
    (authored() as { $schema?: string })["$schema"],
    "https://json-schema.org/draft/2020-12/schema",
    "docs/12 D-1 — draft 2020-12 is the authoritative representation",
  );
});

// --- key order is not content ---------------------------------------------

/**
 * Reorders every object's keys, the way a `jsonb` round-trip does.
 *
 * Postgres normalises `jsonb` objects — keys return sorted by length then
 * bytewise, never in the order they were written. A store that preserves order
 * (this fake, and any in-memory double) cannot reproduce that, which is why the
 * defect below survived the offline suite and appeared on the first real
 * publication.
 */
const reorderKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, child]): [string, unknown] => [key, reorderKeys(child)])
        .reverse(),
    );
  }
  return value;
};

test("a definition that round-tripped through jsonb is unchanged, not a conflict", async () => {
  const store = fakeStore([
    {
      schemaId: "schema-existing",
      artifactType: "portfolio_suggestions",
      version: ARTIFACT_SCHEMA_VERSION,
      // Same content, different key order — exactly what Postgres returns.
      definition: reorderKeys(authored()),
    },
  ]);

  const result = await publishArtifactSchema(
    store.prisma,
    "portfolio_suggestions",
  );

  assert.equal(
    result.outcome,
    "unchanged",
    "key order is a storage detail; treating it as a change makes every check a false immutability violation",
  );
  assert.equal(store.rows.length, 1, "nothing was republished");
});

test("comparison is by content, and content still differs when it differs", async () => {
  assert.equal(definitionsMatch(authored(), reorderKeys(authored())), true);
  assert.equal(
    definitionsMatch(authored(), { ...(authored() as object), type: "array" }),
    false,
    "order-insensitivity must not become difference-blindness",
  );
});
