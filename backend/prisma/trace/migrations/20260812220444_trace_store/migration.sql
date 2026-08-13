-- CreateEnum
CREATE TYPE "validation_class" AS ENUM ('schema', 'rationale_completeness', 'reference_integrity', 'provenance_integrity', 'unsupported_claim_detection', 'internal_consistency');

-- CreateEnum
CREATE TYPE "provider_error_class" AS ENUM ('transient', 'persistent', 'capability_mismatch', 'malformed_response');

-- CreateTable
CREATE TABLE "stage_trace" (
    "stage_trace_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "stage_number" INTEGER NOT NULL,
    "stage_key" TEXT NOT NULL,
    "structured_input" JSONB NOT NULL,
    "structured_output" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL,

    CONSTRAINT "stage_trace_pkey" PRIMARY KEY ("stage_trace_id")
);

-- CreateTable
CREATE TABLE "provider_invocation" (
    "invocation_id" UUID NOT NULL,
    "stage_trace_id" UUID NOT NULL,
    "model_version_id" UUID NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "estimated_cost" DECIMAL(18,8) NOT NULL,
    "outcome" TEXT NOT NULL,
    "error_class" "provider_error_class",
    "attempt_number" INTEGER NOT NULL,
    "fallback_used" BOOLEAN NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_invocation_pkey" PRIMARY KEY ("invocation_id")
);

-- CreateTable
CREATE TABLE "validation_event" (
    "validation_event_id" UUID NOT NULL,
    "stage_trace_id" UUID NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "validation_class" "validation_class" NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "failure_detail" TEXT,
    "regeneration_triggered" BOOLEAN NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_event_pkey" PRIMARY KEY ("validation_event_id")
);

-- CreateIndex
CREATE INDEX "stage_trace_analysis_id_idx" ON "stage_trace"("analysis_id");

-- CreateIndex
CREATE INDEX "stage_trace_stage_key_outcome_idx" ON "stage_trace"("stage_key", "outcome");

-- CreateIndex
CREATE INDEX "stage_trace_started_at_idx" ON "stage_trace"("started_at");

-- CreateIndex
CREATE INDEX "provider_invocation_stage_trace_id_idx" ON "provider_invocation"("stage_trace_id");

-- CreateIndex
CREATE INDEX "provider_invocation_model_version_id_outcome_idx" ON "provider_invocation"("model_version_id", "outcome");

-- CreateIndex
CREATE INDEX "provider_invocation_recorded_at_idx" ON "provider_invocation"("recorded_at");

-- CreateIndex
CREATE INDEX "validation_event_validation_class_passed_idx" ON "validation_event"("validation_class", "passed");

-- CreateIndex
CREATE INDEX "validation_event_artifact_type_idx" ON "validation_event"("artifact_type");

-- CreateIndex
CREATE INDEX "validation_event_recorded_at_idx" ON "validation_event"("recorded_at");
