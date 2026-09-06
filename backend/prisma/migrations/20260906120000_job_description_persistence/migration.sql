-- CreateEnum
CREATE TYPE "intent_provenance" AS ENUM ('stated', 'inferred');

-- CreateEnum
CREATE TYPE "requirement_necessity" AS ENUM ('must_have', 'nice_to_have');

-- CreateEnum
CREATE TYPE "requirement_kind" AS ENUM ('technical', 'domain_experience', 'track_record', 'disposition');

-- CreateEnum
CREATE TYPE "match_strength" AS ENUM ('strong', 'partial');

-- CreateEnum
CREATE TYPE "gap_priority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "artifact_outcome" AS ENUM ('generated', 'failed', 'omitted');

-- CreateEnum
CREATE TYPE "validation_status" AS ENUM ('valid', 'failed');

-- AlterTable
ALTER TABLE "recommendation" ALTER COLUMN "criteria_applied" DROP NOT NULL,
ALTER COLUMN "limits" DROP NOT NULL,
ALTER COLUMN "confidence_band" DROP NOT NULL,
ALTER COLUMN "confidence_factors" DROP NOT NULL;

-- CreateTable
CREATE TABLE "required_capability" (
    "required_capability_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "necessity" "requirement_necessity" NOT NULL,
    "provenance" "intent_provenance" NOT NULL,
    "kind" "requirement_kind" NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "required_capability_pkey" PRIMARY KEY ("required_capability_id")
);

-- CreateTable
CREATE TABLE "capability_match" (
    "match_id" UUID NOT NULL,
    "required_capability_id" UUID NOT NULL,
    "capability_id" TEXT NOT NULL,
    "strength" "match_strength" NOT NULL,
    "evidence_ref" TEXT NOT NULL,

    CONSTRAINT "capability_match_pkey" PRIMARY KEY ("match_id")
);

-- CreateTable
CREATE TABLE "capability_gap" (
    "gap_id" UUID NOT NULL,
    "required_capability_id" UUID NOT NULL,
    "priority" "gap_priority" NOT NULL,
    "why_it_matters" TEXT NOT NULL,
    "decisive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "capability_gap_pkey" PRIMARY KEY ("gap_id")
);

-- CreateTable
CREATE TABLE "artifact_plan_entry" (
    "plan_entry_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "planned" BOOLEAN NOT NULL,
    "depth_level" TEXT NOT NULL,
    "inclusion_reason" TEXT,
    "omission_reason" TEXT,
    "outcome" "artifact_outcome",

    CONSTRAINT "artifact_plan_entry_pkey" PRIMARY KEY ("plan_entry_id")
);

-- CreateTable
CREATE TABLE "artifact" (
    "artifact_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "plan_entry_id" UUID NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "schema_id" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "depth_level" TEXT NOT NULL,
    "generation_attempt_count" INTEGER NOT NULL DEFAULT 1,
    "validation_status" "validation_status" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_pkey" PRIMARY KEY ("artifact_id")
);

-- CreateIndex
CREATE INDEX "required_capability_analysis_id_idx" ON "required_capability"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "required_capability_analysis_id_external_id_key" ON "required_capability"("analysis_id", "external_id");

-- CreateIndex
CREATE INDEX "capability_match_required_capability_id_idx" ON "capability_match"("required_capability_id");

-- CreateIndex
CREATE INDEX "capability_gap_required_capability_id_idx" ON "capability_gap"("required_capability_id");

-- CreateIndex
CREATE INDEX "artifact_plan_entry_analysis_id_idx" ON "artifact_plan_entry"("analysis_id");

-- CreateIndex
CREATE INDEX "artifact_plan_entry_artifact_type_outcome_idx" ON "artifact_plan_entry"("artifact_type", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_plan_entry_id_key" ON "artifact"("plan_entry_id");

-- CreateIndex
CREATE INDEX "artifact_analysis_id_artifact_type_idx" ON "artifact"("analysis_id", "artifact_type");

-- CreateIndex
CREATE INDEX "artifact_validation_status_idx" ON "artifact"("validation_status");

-- AddForeignKey
ALTER TABLE "required_capability" ADD CONSTRAINT "required_capability_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_match" ADD CONSTRAINT "capability_match_required_capability_id_fkey" FOREIGN KEY ("required_capability_id") REFERENCES "required_capability"("required_capability_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_gap" ADD CONSTRAINT "capability_gap_required_capability_id_fkey" FOREIGN KEY ("required_capability_id") REFERENCES "required_capability"("required_capability_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_plan_entry" ADD CONSTRAINT "artifact_plan_entry_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_plan_entry_id_fkey" FOREIGN KEY ("plan_entry_id") REFERENCES "artifact_plan_entry"("plan_entry_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "artifact_schema"("schema_id") ON DELETE RESTRICT ON UPDATE CASCADE;

