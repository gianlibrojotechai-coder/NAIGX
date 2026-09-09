/**
 * Artifact schema publisher — the production entry point (`DB §4.4`, `FR-039`).
 *
 *   docker compose ... run --rm schemas publish
 *   docker compose ... run --rm schemas check
 *
 * ## ⚠️ WHY THIS EXISTS SEPARATELY FROM `scripts/artifact-schemas.mts`
 *
 * The runtime image prunes dev dependencies and ships no `scripts/` directory,
 * so `npm run schemas:publish` — `tsx scripts/artifact-schemas.mts` — cannot
 * run on a deployment. The same defect moved `encrypt.ts` and `fragments.ts`
 * under `src/ops/`, and it was found a third time on 2026-09-09 when the first
 * job-description submission to the deployed instance replayed six stages
 * correctly and then failed Stage 9 with *"Artifact schema
 * "portfolio_suggestions" version 1 is not published"* — against a production
 * database that had never been given the schemas, by a runbook that never said
 * to.
 *
 * `requirePublishedSchemaId` refuses rather than publishing on demand, and
 * that refusal is correct: a run that quietly created the schema it was about
 * to claim conformance with would be attesting to its own homework. So
 * publication is a deliberate deploy step, and this is the command for it.
 *
 * ## What it reads
 *
 * `schemas/*.schema.json`, resolved by `artifact-validation.ts` two levels up
 * from the compiled module — `/app/schemas` in the image, which the Dockerfile
 * now ships. No prompts, no research, no key file: the schemas are application
 * content and carry nothing sealed.
 */

import "dotenv/config";

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  ArtifactSchemaConflictError,
  definitionsMatch,
  publishArtifactSchema,
} from "../db/artifact-schema-publisher.js";
import { PrismaClient } from "../generated/prisma/client.js";
import {
  ARTIFACT_SCHEMA_VERSION,
  loadArtifactSchemaDefinition,
} from "../nie/artifact-validation.js";
import { ARTIFACT_TYPES, type ArtifactType } from "../nie/contracts.js";
import { STAGES } from "../nie/stages.js";

/**
 * The types the pipeline can actually generate, read from the stage registry —
 * the same source `scripts/artifact-schemas.mts` uses, so the two commands
 * cannot disagree about what "all schemas" means.
 */
const declaredTypes = (): readonly ArtifactType[] => {
  const declared = new Set(
    STAGES.flatMap((stage) => stage.producesArtifactTypes),
  );
  // Narrowed against the contract's own list rather than cast: a stage
  // declaring a type the contract does not know is a registry error, and it
  // is refused here rather than published under a name nothing validates.
  const unknown = [...declared].filter(
    (t) => !(ARTIFACT_TYPES as readonly string[]).includes(t),
  );
  if (unknown.length > 0) {
    throw new Error(
      `Stage registry declares artifact type(s) the contract does not define: ${unknown.join(", ")}`,
    );
  }
  return ARTIFACT_TYPES.filter((t) => declared.has(t));
};

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const close = async (): Promise<void> => {
  await prisma.$disconnect();
  await pool.end();
};

async function publish(types: readonly ArtifactType[]): Promise<void> {
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
        // A version that exists with DIFFERENT content is never overwritten:
        // stored artifacts reference it by id, and rewriting it would change
        // what they were validated against after the fact.
        console.error(`❌ ${error.message}`);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  }

  console.log(
    `Published ${String(published)}; ${String(unchanged)} unchanged.`,
  );
}

/** Reports what is published against what is authored; writes nothing. */
async function check(types: readonly ArtifactType[]): Promise<void> {
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
        `${artifactType} v${ARTIFACT_SCHEMA_VERSION} is published with different content`,
      );
    }
  }

  if (problems.length > 0) {
    console.error("❌ Artifact schemas are not in sync:");
    for (const problem of problems) console.error(`   ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `✅ ${String(types.length)} artifact schema(s) published and matching.`,
  );
}

try {
  const types = declaredTypes();
  switch (process.argv[2]) {
    case "publish":
      await publish(types);
      break;
    case "check":
      await check(types);
      break;
    default:
      console.error("Usage: schemas <publish|check>");
      process.exitCode = 1;
  }
} finally {
  await close();
}
