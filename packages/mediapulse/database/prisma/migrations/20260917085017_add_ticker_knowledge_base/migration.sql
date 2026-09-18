-- CreateEnum
CREATE TYPE "KnowledgeEntityKind" AS ENUM ('issuer', 'company', 'brand', 'regulator', 'government', 'person', 'product', 'place', 'other');

-- CreateEnum
CREATE TYPE "KnowledgeFactSource" AS ENUM ('profile', 'extracted', 'operator');

-- DropIndex
DROP INDEX "storyline_name_trgm_idx";

-- DropIndex
DROP INDEX "storyline_anchor_anchor_trgm_idx";

-- CreateTable
CREATE TABLE "knowledge_entity" (
    "id" TEXT NOT NULL,
    "kind" "KnowledgeEntityKind" NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT,
    "ticker_id" TEXT,
    "source" "KnowledgeFactSource" NOT NULL DEFAULT 'extracted',
    "extraction_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_entity_alias" (
    "entity_id" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "source" "KnowledgeFactSource" NOT NULL DEFAULT 'profile',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_entity_alias_pkey" PRIMARY KEY ("entity_id","normalized_alias")
);

-- CreateTable
CREATE TABLE "knowledge_ticker_entity" (
    "ticker_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "is_issuer" BOOLEAN NOT NULL DEFAULT false,
    "source" "KnowledgeFactSource" NOT NULL DEFAULT 'extracted',
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_ticker_entity_pkey" PRIMARY KEY ("ticker_id","entity_id")
);

-- CreateTable
CREATE TABLE "knowledge_relation_kind" (
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "inverse_label" TEXT,
    "symmetric" BOOLEAN NOT NULL DEFAULT false,
    "curated" BOOLEAN NOT NULL DEFAULT false,
    "observations" INTEGER NOT NULL DEFAULT 0,
    "first_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraction_run_id" TEXT,

    CONSTRAINT "knowledge_relation_kind_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "knowledge_relation_kind_alias" (
    "kind_slug" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "source" "KnowledgeFactSource" NOT NULL DEFAULT 'extracted',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_relation_kind_alias_pkey" PRIMARY KEY ("kind_slug","normalized_alias")
);

-- CreateTable
CREATE TABLE "knowledge_relation" (
    "id" TEXT NOT NULL,
    "subject_entity_id" TEXT NOT NULL,
    "object_entity_id" TEXT NOT NULL,
    "kind_slug" TEXT NOT NULL,
    "label" TEXT,
    "source" "KnowledgeFactSource" NOT NULL DEFAULT 'extracted',
    "evidence_data_source_id" TEXT,
    "evidence_span" TEXT,
    "observations" INTEGER NOT NULL DEFAULT 1,
    "first_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraction_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_ticker_relation" (
    "ticker_id" TEXT NOT NULL,
    "relation_id" TEXT NOT NULL,
    "source" "KnowledgeFactSource" NOT NULL DEFAULT 'extracted',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_ticker_relation_pkey" PRIMARY KEY ("ticker_id","relation_id")
);

-- CreateTable
CREATE TABLE "knowledge_entity_mention" (
    "ticker_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "surface_form" TEXT,
    "evidence_span" TEXT,
    "source" "KnowledgeFactSource" NOT NULL DEFAULT 'extracted',
    "extraction_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_entity_mention_pkey" PRIMARY KEY ("ticker_id","entity_id","data_source_id")
);

-- CreateTable
CREATE TABLE "knowledge_extraction_run" (
    "id" TEXT NOT NULL,
    "schedule_execution_id" TEXT,
    "ticker_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "DataCollectionRunStatus" NOT NULL,
    "agent_version" TEXT,
    "watermark_at" TIMESTAMP(3),
    "considered" INTEGER NOT NULL DEFAULT 0,
    "skipped_no_candidates" INTEGER NOT NULL DEFAULT 0,
    "entities_created" INTEGER NOT NULL DEFAULT 0,
    "relations_opened" INTEGER NOT NULL DEFAULT 0,
    "relations_confirmed" INTEGER NOT NULL DEFAULT 0,
    "mentions_written" INTEGER NOT NULL DEFAULT 0,
    "kinds_created" INTEGER NOT NULL DEFAULT 0,
    "rejected_span_not_in_text" INTEGER NOT NULL DEFAULT 0,
    "rejected_name_not_in_text" INTEGER NOT NULL DEFAULT 0,
    "stop_reason" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_extraction_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_entity_ticker_id_key" ON "knowledge_entity"("ticker_id");

-- CreateIndex
CREATE INDEX "knowledge_entity_extraction_run_id_idx" ON "knowledge_entity"("extraction_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_entity_kind_normalized_name_key" ON "knowledge_entity"("kind", "normalized_name");

-- CreateIndex
CREATE INDEX "knowledge_entity_alias_normalized_alias_idx" ON "knowledge_entity_alias"("normalized_alias");

-- CreateIndex
CREATE INDEX "knowledge_ticker_entity_ticker_id_mention_count_idx" ON "knowledge_ticker_entity"("ticker_id", "mention_count" DESC);

-- CreateIndex
CREATE INDEX "knowledge_ticker_entity_entity_id_idx" ON "knowledge_ticker_entity"("entity_id");

-- CreateIndex
CREATE INDEX "knowledge_relation_kind_curated_observations_idx" ON "knowledge_relation_kind"("curated", "observations");

-- CreateIndex
CREATE INDEX "knowledge_relation_kind_alias_normalized_alias_idx" ON "knowledge_relation_kind_alias"("normalized_alias");

-- CreateIndex
CREATE INDEX "knowledge_relation_object_entity_id_idx" ON "knowledge_relation"("object_entity_id");

-- CreateIndex
CREATE INDEX "knowledge_relation_kind_slug_idx" ON "knowledge_relation"("kind_slug");

-- CreateIndex
CREATE INDEX "knowledge_relation_evidence_data_source_id_idx" ON "knowledge_relation"("evidence_data_source_id");

-- CreateIndex
CREATE INDEX "knowledge_relation_extraction_run_id_idx" ON "knowledge_relation"("extraction_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_relation_subject_entity_id_kind_slug_object_entit_key" ON "knowledge_relation"("subject_entity_id", "kind_slug", "object_entity_id");

-- CreateIndex
CREATE INDEX "knowledge_ticker_relation_relation_id_idx" ON "knowledge_ticker_relation"("relation_id");

-- CreateIndex
CREATE INDEX "knowledge_entity_mention_entity_id_ticker_id_idx" ON "knowledge_entity_mention"("entity_id", "ticker_id");

-- CreateIndex
CREATE INDEX "knowledge_entity_mention_data_source_id_idx" ON "knowledge_entity_mention"("data_source_id");

-- CreateIndex
CREATE INDEX "knowledge_entity_mention_extraction_run_id_idx" ON "knowledge_entity_mention"("extraction_run_id");

-- CreateIndex
CREATE INDEX "knowledge_extraction_run_status_started_at_idx" ON "knowledge_extraction_run"("status", "started_at");

-- CreateIndex
CREATE INDEX "knowledge_extraction_run_ticker_id_started_at_idx" ON "knowledge_extraction_run"("ticker_id", "started_at");

-- AddForeignKey
ALTER TABLE "knowledge_entity" ADD CONSTRAINT "knowledge_entity_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entity" ADD CONSTRAINT "knowledge_entity_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "knowledge_extraction_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entity_alias" ADD CONSTRAINT "knowledge_entity_alias_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "knowledge_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_ticker_entity" ADD CONSTRAINT "knowledge_ticker_entity_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_ticker_entity" ADD CONSTRAINT "knowledge_ticker_entity_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "knowledge_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relation_kind" ADD CONSTRAINT "knowledge_relation_kind_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "knowledge_extraction_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relation_kind_alias" ADD CONSTRAINT "knowledge_relation_kind_alias_kind_slug_fkey" FOREIGN KEY ("kind_slug") REFERENCES "knowledge_relation_kind"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relation" ADD CONSTRAINT "knowledge_relation_subject_entity_id_fkey" FOREIGN KEY ("subject_entity_id") REFERENCES "knowledge_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relation" ADD CONSTRAINT "knowledge_relation_object_entity_id_fkey" FOREIGN KEY ("object_entity_id") REFERENCES "knowledge_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relation" ADD CONSTRAINT "knowledge_relation_kind_slug_fkey" FOREIGN KEY ("kind_slug") REFERENCES "knowledge_relation_kind"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relation" ADD CONSTRAINT "knowledge_relation_evidence_data_source_id_fkey" FOREIGN KEY ("evidence_data_source_id") REFERENCES "data_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relation" ADD CONSTRAINT "knowledge_relation_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "knowledge_extraction_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_ticker_relation" ADD CONSTRAINT "knowledge_ticker_relation_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_ticker_relation" ADD CONSTRAINT "knowledge_ticker_relation_relation_id_fkey" FOREIGN KEY ("relation_id") REFERENCES "knowledge_relation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entity_mention" ADD CONSTRAINT "knowledge_entity_mention_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entity_mention" ADD CONSTRAINT "knowledge_entity_mention_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "knowledge_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entity_mention" ADD CONSTRAINT "knowledge_entity_mention_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entity_mention" ADD CONSTRAINT "knowledge_entity_mention_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "knowledge_extraction_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_extraction_run" ADD CONSTRAINT "knowledge_extraction_run_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
