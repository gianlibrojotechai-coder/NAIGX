-- CreateEnum
CREATE TYPE "analysis_status" AS ENUM ('queued', 'running', 'completed', 'failed', 'timed_out');

-- CreateEnum
CREATE TYPE "source_type" AS ENUM ('paste', 'file');

-- CreateEnum
CREATE TYPE "classification_type" AS ENUM ('business_requirement', 'existing_workflow', 'job_description', 'technical_assessment', 'unsupported');

-- CreateEnum
CREATE TYPE "context_provenance" AS ENUM ('stated', 'inferred', 'unknown');

-- CreateEnum
CREATE TYPE "confidence_band" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "sufficiency_level" AS ENUM ('sufficient', 'thin', 'insufficient');

-- CreateEnum
CREATE TYPE "fragment_class" AS ENUM ('foundation', 'stage', 'type_modifier', 'artifact', 'output_contract');

-- CreateEnum
CREATE TYPE "referencing_type" AS ENUM ('recommendation', 'architecture_component');

-- CreateEnum
CREATE TYPE "export_format" AS ENUM ('markdown', 'pdf');

-- CreateTable
CREATE TABLE "user" (
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "credential_hash" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "training_consent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "session" (
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent_class" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "default_export_format" "export_format" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "analysis" (
    "analysis_id" UUID NOT NULL,
    "user_id" UUID,
    "anonymous_token_hash" TEXT,
    "status" "analysis_status" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "derived_title" TEXT,
    "model_version_id" UUID,
    "overall_confidence_band" "confidence_band",
    "sufficiency_level" "sufficiency_level",
    "degradation_flag" BOOLEAN NOT NULL DEFAULT false,
    "timeout_flag" BOOLEAN NOT NULL DEFAULT false,
    "supersedes_analysis_id" UUID,

    CONSTRAINT "analysis_pkey" PRIMARY KEY ("analysis_id")
);

-- CreateTable
CREATE TABLE "analysis_input" (
    "analysis_id" UUID NOT NULL,
    "raw_content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "character_count" INTEGER NOT NULL,
    "source_type" "source_type" NOT NULL,
    "original_filename" TEXT,

    CONSTRAINT "analysis_input_pkey" PRIMARY KEY ("analysis_id")
);

-- CreateTable
CREATE TABLE "classification" (
    "analysis_id" UUID NOT NULL,
    "determined_type" "classification_type" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "candidate_types" "classification_type"[],
    "was_low_confidence" BOOLEAN NOT NULL,
    "user_override_type" "classification_type",
    "overridden_at" TIMESTAMP(3),

    CONSTRAINT "classification_pkey" PRIMARY KEY ("analysis_id")
);

-- CreateTable
CREATE TABLE "intent_record" (
    "intent_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "primary_objective" TEXT NOT NULL,
    "secondary_objectives" JSONB NOT NULL,
    "inferred_scope" TEXT NOT NULL,
    "objective_provenance" JSONB NOT NULL,

    CONSTRAINT "intent_record_pkey" PRIMARY KEY ("intent_id")
);

-- CreateTable
CREATE TABLE "context_element" (
    "context_element_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "provenance" "context_provenance" NOT NULL,
    "source_span_start" INTEGER,
    "source_span_end" INTEGER,
    "inference_basis" TEXT,
    "resolution_hint" TEXT,
    "specificity_score" DOUBLE PRECISION NOT NULL,
    "conflicts_with_id" UUID,

    CONSTRAINT "context_element_pkey" PRIMARY KEY ("context_element_id")
);

-- CreateTable
CREATE TABLE "architecture_model" (
    "architecture_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "data_flow_description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "architecture_model_pkey" PRIMARY KEY ("architecture_id")
);

-- CreateTable
CREATE TABLE "architecture_component" (
    "component_id" UUID NOT NULL,
    "architecture_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,
    "inputs" TEXT NOT NULL,
    "outputs" TEXT NOT NULL,
    "failure_handling" TEXT NOT NULL,
    "integration_direction" TEXT,
    "external_system" TEXT,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "architecture_component_pkey" PRIMARY KEY ("component_id")
);

-- CreateTable
CREATE TABLE "recommendation" (
    "recommendation_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "recommendation_type" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "criteria_applied" TEXT NOT NULL,
    "limits" TEXT NOT NULL,
    "confidence_band" "confidence_band" NOT NULL,
    "confidence_factors" JSONB NOT NULL,
    "is_negative_conclusion" BOOLEAN NOT NULL,

    CONSTRAINT "recommendation_pkey" PRIMARY KEY ("recommendation_id")
);

-- CreateTable
CREATE TABLE "recommendation_alternative" (
    "alternative_id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "alternative" TEXT NOT NULL,
    "rejection_reason" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "recommendation_alternative_pkey" PRIMARY KEY ("alternative_id")
);

-- CreateTable
CREATE TABLE "context_reference" (
    "reference_id" UUID NOT NULL,
    "context_element_id" UUID NOT NULL,
    "referencing_type" "referencing_type" NOT NULL,
    "referencing_id" UUID NOT NULL,
    "relevance" TEXT NOT NULL,

    CONSTRAINT "context_reference_pkey" PRIMARY KEY ("reference_id")
);

-- CreateTable
CREATE TABLE "platform_recommendation" (
    "platform_recommendation_id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "recommended_platform" TEXT,
    "selection_criteria" TEXT NOT NULL,
    "knowledge_currency_note" TEXT NOT NULL,

    CONSTRAINT "platform_recommendation_pkey" PRIMARY KEY ("platform_recommendation_id")
);

-- CreateTable
CREATE TABLE "risk_item" (
    "risk_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "mitigation" TEXT NOT NULL,

    CONSTRAINT "risk_item_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "complexity_assessment" (
    "assessment_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "factor_breakdown" JSONB NOT NULL,
    "scale_version" TEXT NOT NULL,

    CONSTRAINT "complexity_assessment_pkey" PRIMARY KEY ("assessment_id")
);

-- CreateTable
CREATE TABLE "prompt_fragment" (
    "fragment_id" UUID NOT NULL,
    "fragment_key" TEXT NOT NULL,
    "fragment_class" "fragment_class" NOT NULL,
    "owner_class" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_fragment_pkey" PRIMARY KEY ("fragment_id")
);

-- CreateTable
CREATE TABLE "prompt_fragment_version" (
    "fragment_version_id" UUID NOT NULL,
    "fragment_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMP(3),
    "deprecated_at" TIMESTAMP(3),
    "regression_pass_reference" TEXT,

    CONSTRAINT "prompt_fragment_version_pkey" PRIMARY KEY ("fragment_version_id")
);

-- CreateTable
CREATE TABLE "fragment_usage" (
    "usage_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "fragment_version_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "fragment_usage_pkey" PRIMARY KEY ("usage_id")
);

-- CreateTable
CREATE TABLE "provider" (
    "provider_id" UUID NOT NULL,
    "provider_key" TEXT NOT NULL,
    "declared_capabilities" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_pkey" PRIMARY KEY ("provider_id")
);

-- CreateTable
CREATE TABLE "model_version" (
    "model_version_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "model_key" TEXT NOT NULL,
    "version_label" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "model_version_pkey" PRIMARY KEY ("model_version_id")
);

-- CreateTable
CREATE TABLE "artifact_schema" (
    "schema_id" UUID NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "deprecated_at" TIMESTAMP(3),

    CONSTRAINT "artifact_schema_pkey" PRIMARY KEY ("schema_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_deleted_at_idx" ON "user"("deleted_at");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- CreateIndex
CREATE INDEX "analysis_user_id_created_at_idx" ON "analysis"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analysis_status_idx" ON "analysis"("status");

-- CreateIndex
CREATE INDEX "analysis_anonymous_token_hash_idx" ON "analysis"("anonymous_token_hash");

-- CreateIndex
CREATE INDEX "analysis_input_content_hash_idx" ON "analysis_input"("content_hash");

-- CreateIndex
CREATE INDEX "classification_determined_type_idx" ON "classification"("determined_type");

-- CreateIndex
CREATE INDEX "classification_user_override_type_idx" ON "classification"("user_override_type");

-- CreateIndex
CREATE UNIQUE INDEX "intent_record_analysis_id_key" ON "intent_record"("analysis_id");

-- CreateIndex
CREATE INDEX "context_element_analysis_id_provenance_idx" ON "context_element"("analysis_id", "provenance");

-- CreateIndex
CREATE INDEX "context_element_conflicts_with_id_idx" ON "context_element"("conflicts_with_id");

-- CreateIndex
CREATE UNIQUE INDEX "architecture_model_analysis_id_key" ON "architecture_model"("analysis_id");

-- CreateIndex
CREATE INDEX "architecture_component_architecture_id_idx" ON "architecture_component"("architecture_id");

-- CreateIndex
CREATE UNIQUE INDEX "architecture_component_architecture_id_name_key" ON "architecture_component"("architecture_id", "name");

-- CreateIndex
CREATE INDEX "recommendation_analysis_id_idx" ON "recommendation"("analysis_id");

-- CreateIndex
CREATE INDEX "recommendation_is_negative_conclusion_idx" ON "recommendation"("is_negative_conclusion");

-- CreateIndex
CREATE INDEX "recommendation_alternative_recommendation_id_idx" ON "recommendation_alternative"("recommendation_id");

-- CreateIndex
CREATE INDEX "context_reference_context_element_id_idx" ON "context_reference"("context_element_id");

-- CreateIndex
CREATE INDEX "context_reference_referencing_type_referencing_id_idx" ON "context_reference"("referencing_type", "referencing_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_recommendation_recommendation_id_key" ON "platform_recommendation"("recommendation_id");

-- CreateIndex
CREATE INDEX "platform_recommendation_recommended_platform_idx" ON "platform_recommendation"("recommended_platform");

-- CreateIndex
CREATE INDEX "risk_item_analysis_id_idx" ON "risk_item"("analysis_id");

-- CreateIndex
CREATE INDEX "risk_item_severity_likelihood_idx" ON "risk_item"("severity", "likelihood");

-- CreateIndex
CREATE UNIQUE INDEX "complexity_assessment_analysis_id_key" ON "complexity_assessment"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_fragment_fragment_key_key" ON "prompt_fragment"("fragment_key");

-- CreateIndex
CREATE INDEX "prompt_fragment_version_activated_at_idx" ON "prompt_fragment_version"("activated_at");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_fragment_version_fragment_id_version_key" ON "prompt_fragment_version"("fragment_id", "version");

-- CreateIndex
CREATE INDEX "fragment_usage_analysis_id_idx" ON "fragment_usage"("analysis_id");

-- CreateIndex
CREATE INDEX "fragment_usage_fragment_version_id_idx" ON "fragment_usage"("fragment_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_provider_key_key" ON "provider"("provider_key");

-- CreateIndex
CREATE UNIQUE INDEX "model_version_provider_id_model_key_version_label_key" ON "model_version"("provider_id", "model_key", "version_label");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_schema_artifact_type_version_key" ON "artifact_schema"("artifact_type", "version");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis" ADD CONSTRAINT "analysis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis" ADD CONSTRAINT "analysis_model_version_id_fkey" FOREIGN KEY ("model_version_id") REFERENCES "model_version"("model_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis" ADD CONSTRAINT "analysis_supersedes_analysis_id_fkey" FOREIGN KEY ("supersedes_analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_input" ADD CONSTRAINT "analysis_input_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification" ADD CONSTRAINT "classification_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intent_record" ADD CONSTRAINT "intent_record_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_element" ADD CONSTRAINT "context_element_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_element" ADD CONSTRAINT "context_element_conflicts_with_id_fkey" FOREIGN KEY ("conflicts_with_id") REFERENCES "context_element"("context_element_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_model" ADD CONSTRAINT "architecture_model_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_component" ADD CONSTRAINT "architecture_component_architecture_id_fkey" FOREIGN KEY ("architecture_id") REFERENCES "architecture_model"("architecture_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_alternative" ADD CONSTRAINT "recommendation_alternative_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendation"("recommendation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_reference" ADD CONSTRAINT "context_reference_context_element_id_fkey" FOREIGN KEY ("context_element_id") REFERENCES "context_element"("context_element_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_recommendation" ADD CONSTRAINT "platform_recommendation_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendation"("recommendation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_item" ADD CONSTRAINT "risk_item_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_item" ADD CONSTRAINT "risk_item_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "architecture_component"("component_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complexity_assessment" ADD CONSTRAINT "complexity_assessment_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_fragment_version" ADD CONSTRAINT "prompt_fragment_version_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "prompt_fragment"("fragment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fragment_usage" ADD CONSTRAINT "fragment_usage_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analysis"("analysis_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fragment_usage" ADD CONSTRAINT "fragment_usage_fragment_version_id_fkey" FOREIGN KEY ("fragment_version_id") REFERENCES "prompt_fragment_version"("fragment_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_version" ADD CONSTRAINT "model_version_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("provider_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Specification-mandated CHECK constraints.
--
-- `DB §4` states repeatedly that these rules are enforced by the database, not
-- by convention: "A row violating these is invalid" (§4.2 CONTEXT_ELEMENT),
-- "the database refuses to store one" (§4.2 design note), "The database is the
-- enforcement point" (§4.3 RECOMMENDATION).
--
-- Prisma Migrate cannot express CHECK constraints in schema.prisma, so they are
-- declared here. They are invisible to Prisma's schema diffing — see the note in
-- the accompanying report before generating the next migration.
-- ---------------------------------------------------------------------------

-- §4.1 USER — `credential_hash` is never null for an active account.
ALTER TABLE "user" ADD CONSTRAINT "user_active_requires_credential_check"
  CHECK ("deleted_at" IS NOT NULL OR "credential_hash" IS NOT NULL);

-- §4.1 SESSION — a session cannot expire before it is issued.
ALTER TABLE "session" ADD CONSTRAINT "session_expiry_after_issue_check"
  CHECK ("expires_at" > "issued_at");

-- §4.2 ANALYSIS — exactly one of `user_id` or `anonymous_token_hash` is set.
-- Ownership is never ambiguous and never absent (DP-8, `FR-004`).
ALTER TABLE "analysis" ADD CONSTRAINT "analysis_exactly_one_owner_check"
  CHECK (("user_id" IS NOT NULL) <> ("anonymous_token_hash" IS NOT NULL));

-- §4.2 ANALYSIS_INPUT — `FR-002` bounds: 50 to 50,000 characters.
ALTER TABLE "analysis_input" ADD CONSTRAINT "analysis_input_character_count_check"
  CHECK ("character_count" BETWEEN 50 AND 50000);

-- §4.2 CLASSIFICATION — `FR-011`: confidence in [0,1].
ALTER TABLE "classification" ADD CONSTRAINT "classification_confidence_range_check"
  CHECK ("confidence" >= 0 AND "confidence" <= 1);

-- §4.2 CONTEXT_ELEMENT — the conditional provenance requirements. This is the
-- schema-level enforcement of `AIP-3`: provenance without its supporting
-- reference is an unverifiable label, so the database refuses to store one.
ALTER TABLE "context_element" ADD CONSTRAINT "context_element_stated_requires_span_check"
  CHECK ("provenance" <> 'stated' OR ("source_span_start" IS NOT NULL AND "source_span_end" IS NOT NULL));
ALTER TABLE "context_element" ADD CONSTRAINT "context_element_inferred_requires_basis_check"
  CHECK ("provenance" <> 'inferred' OR "inference_basis" IS NOT NULL);
ALTER TABLE "context_element" ADD CONSTRAINT "context_element_unknown_requires_hint_check"
  CHECK ("provenance" <> 'unknown' OR "resolution_hint" IS NOT NULL);

-- §4.3 RECOMMENDATION — an unexplained recommendation cannot be represented
-- (`AIP-4`). Non-nullable alone is insufficient: an empty string is a null in
-- disguise, and this is the single most important constraint in the schema.
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_rationale_not_empty_check"
  CHECK (length(btrim("rationale")) > 0);
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_criteria_not_empty_check"
  CHECK (length(btrim("criteria_applied")) > 0);
-- Anything below `high` states its reason (`FR-018`, `FR-045`, `AI §8.4`).
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_confidence_factors_check"
  CHECK ("confidence_band" = 'high'
         OR ("confidence_factors" <> '[]'::jsonb
             AND "confidence_factors" <> '{}'::jsonb
             AND "confidence_factors" <> 'null'::jsonb));

-- §4.3 RECOMMENDATION_ALTERNATIVE — `FR-034`: a rejected alternative always
-- names why it was rejected.
ALTER TABLE "recommendation_alternative" ADD CONSTRAINT "recommendation_alternative_reason_not_empty_check"
  CHECK (length(btrim("rejection_reason")) > 0);

-- §4.3 RISK_ITEM — the 1-5 integer scales of `docs/09-Scoring-Scales.md` §2.1
-- and §2.2, and the `FR-032` requirement that a risk carries a mitigation.
ALTER TABLE "risk_item" ADD CONSTRAINT "risk_item_severity_range_check"
  CHECK ("severity" BETWEEN 1 AND 5);
ALTER TABLE "risk_item" ADD CONSTRAINT "risk_item_likelihood_range_check"
  CHECK ("likelihood" BETWEEN 1 AND 5);
ALTER TABLE "risk_item" ADD CONSTRAINT "risk_item_mitigation_not_empty_check"
  CHECK (length(btrim("mitigation")) > 0);

-- §4.3 COMPLEXITY_ASSESSMENT — `factor_breakdown` non-empty, so that `FR-033`
-- reconstruction is always possible from storage. The 20-100 score range is
-- deliberately NOT constrained: `docs/09` A-1 records the range as "recorded,
-- not decided", and a CHECK would harden an open item.
ALTER TABLE "complexity_assessment" ADD CONSTRAINT "complexity_assessment_breakdown_not_empty_check"
  CHECK ("factor_breakdown" <> '[]'::jsonb AND "factor_breakdown" <> '{}'::jsonb);

-- §4.5 PROMPT_FRAGMENT_VERSION — `NFR-043` as a data constraint rather than
-- process discipline: a fragment version cannot become active without a
-- recorded passing regression run.
ALTER TABLE "prompt_fragment_version" ADD CONSTRAINT "prompt_fragment_version_activation_gate_check"
  CHECK ("activated_at" IS NULL OR "regression_pass_reference" IS NOT NULL);
