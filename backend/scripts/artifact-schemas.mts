/**
 * Artifact schema tooling — the publisher (`DB §4.4`, `docs/12` D-3 pattern).
 *
 *   npm run schemas:check     verify published rows match the authored files
 *   npm run schemas:publish   publish authored schemas to ARTIFACT_SCHEMA
 *
 * Mirrors `fragments.mts`: authored in the repository, published deliberately,
 * referenced from the database at runtime. `check` needs a database because the
 * published row is the thing being checked — unlike the fragment manifest,
 * there is no on-disk record of what was published.
 */

import "dotenv/config";

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  ArtifactSchemaConflictError,
  definitionsMatch,
  publishArtifactSchema,
} from "../src/db/artifact-schema-publisher.js";
import {
  ARTIFACT_SCHEMA_VERSION,
  loadArtifactSchemaDefinition,
} from "../src/nie/artifact-validation.js";
import { STAGES } from "../src/nie/stages.js";
import type { ArtifactType } from "../src/nie/contracts.js";

/**
 * Every artifact type a stage declares it produces.
 *
 * Read from the stage registry rather than the schemas directory, so the set
 * published is the set the pipeline can actually generate — the same source
 * boundary check 5 reads.
 */
const declaredTypes = (): readonly ArtifactType[] => [
  ...new Set(STAGES.flatMap((stage) => stage.producesArtifactTypes)),
];

const command = process.argv[2] ?? "check";

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const close = async (code: number): Promise<never> => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(code);
};

const types = declaredTypes();
if (types.length === 0) {
  console.log("No artifact types are declared by any stage.");
  await close(0);
}

if (command === "publish") {
  let published = 0;
  let unchanged = 0;

  for (const artifactType of types) {
    try {
      const result = await publishArtifactSchema(prisma, artifactType);
      if (result.outcome === "published") {
        published += 1;
        console.log(
          `✅ ${artifactType} v${result.version} published (${result.schemaId})`,
        );
      } else {
        unchanged += 1;
        console.log(`   ${artifactType} v${result.version} already published`);
      }
    } catch (error) {
      if (error instanceof ArtifactSchemaConflictError) {
        console.error(`❌ ${error.message}`);
        await close(1);
      }
      throw error;
    }
  }

  console.log(
    `\nPublished ${String(published)}; ${String(unchanged)} unchanged.`,
  );
  await close(0);
}

if (command === "check") {
  const problems: string[] = [];

  for (const artifactType of types) {
    const row = await prisma.artifactSchema.findUnique({
      where: {
        artifactType_version: {
          artifactType,
          version: ARTIFACT_SCHEMA_VERSION,
        },
      },
    });

    if (row === null) {
      problems.push(
        `${artifactType} v${ARTIFACT_SCHEMA_VERSION} is not published`,
      );
      continue;
    }
    if (
      !definitionsMatch(
        row.definition,
        loadArtifactSchemaDefinition(artifactType),
      )
    ) {
      problems.push(
        `${artifactType} v${ARTIFACT_SCHEMA_VERSION} differs from the authored file — ` +
          "a published version is immutable, so this needs a version bump",
      );
    }
  }

  if (problems.length === 0) {
    console.log(
      `✅ ${String(types.length)} artifact schema(s) published and matching.`,
    );
    await close(0);
  }

  console.error("❌ Artifact schema drift:");
  for (const problem of problems) console.error(`   ${problem}`);
  await close(1);
}

console.error("Usage: artifact-schemas.mts <check|publish>");
await close(1);
