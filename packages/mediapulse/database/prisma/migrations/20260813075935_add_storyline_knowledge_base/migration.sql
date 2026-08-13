-- CreateEnum
CREATE TYPE "StorylineKind" AS ENUM ('story', 'format');

-- CreateEnum
CREATE TYPE "StorylineTickerSource" AS ENUM ('placement', 'operator');

-- AlterTable
ALTER TABLE "newsletter_section_item" ALTER COLUMN "points" DROP DEFAULT;

-- CreateTable
CREATE TABLE "storyline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "StorylineKind" NOT NULL DEFAULT 'story',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_reason" TEXT,
    "locked_at" TIMESTAMP(3),
    "first_observed_at" TIMESTAMP(3) NOT NULL,
    "last_observed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storyline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyline_anchor" (
    "storyline_id" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,

    CONSTRAINT "storyline_anchor_pkey" PRIMARY KEY ("storyline_id","anchor")
);

-- CreateTable
CREATE TABLE "development" (
    "id" TEXT NOT NULL,
    "storyline_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "ingestion_run_id" TEXT,
    "attach_evidence" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_anchor" (
    "development_id" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "from_title" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "development_anchor_pkey" PRIMARY KEY ("development_id","anchor")
);

-- CreateTable
CREATE TABLE "development_citation" (
    "id" TEXT NOT NULL,
    "development_id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyline_ticker" (
    "storyline_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "source" "StorylineTickerSource" NOT NULL DEFAULT 'placement',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storyline_ticker_pkey" PRIMARY KEY ("storyline_id","ticker_id")
);

-- CreateTable
CREATE TABLE "knowledge_ingestion_run" (
    "id" TEXT NOT NULL,
    "schedule_execution_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "DataCollectionRunStatus" NOT NULL,
    "agent_version" TEXT,
    "watermark_at" TIMESTAMP(3),
    "considered" INTEGER NOT NULL DEFAULT 0,
    "storylinesOpened" INTEGER NOT NULL DEFAULT 0,
    "developmentsOpened" INTEGER NOT NULL DEFAULT 0,
    "citationsAdded" INTEGER NOT NULL DEFAULT 0,
    "storylinesLocked" INTEGER NOT NULL DEFAULT 0,
    "skippedNoAnchors" INTEGER NOT NULL DEFAULT 0,
    "stop_reason" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_ingestion_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storyline_kind_last_observed_at_idx" ON "storyline"("kind", "last_observed_at");

-- CreateIndex
CREATE INDEX "storyline_locked_idx" ON "storyline"("locked");

-- CreateIndex
CREATE INDEX "storyline_anchor_anchor_idx" ON "storyline_anchor"("anchor");

-- CreateIndex
CREATE INDEX "development_storyline_id_observed_at_idx" ON "development"("storyline_id", "observed_at");

-- CreateIndex
CREATE INDEX "development_ingestion_run_id_idx" ON "development"("ingestion_run_id");

-- CreateIndex
CREATE INDEX "development_citation_data_source_id_idx" ON "development_citation"("data_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "development_citation_development_id_data_source_id_key" ON "development_citation"("development_id", "data_source_id");

-- CreateIndex
CREATE INDEX "storyline_ticker_ticker_id_idx" ON "storyline_ticker"("ticker_id");

-- CreateIndex
CREATE INDEX "knowledge_ingestion_run_status_started_at_idx" ON "knowledge_ingestion_run"("status", "started_at");

-- CreateIndex
CREATE INDEX "knowledge_ingestion_run_schedule_execution_id_idx" ON "knowledge_ingestion_run"("schedule_execution_id");

-- AddForeignKey
ALTER TABLE "storyline_anchor" ADD CONSTRAINT "storyline_anchor_storyline_id_fkey" FOREIGN KEY ("storyline_id") REFERENCES "storyline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development" ADD CONSTRAINT "development_storyline_id_fkey" FOREIGN KEY ("storyline_id") REFERENCES "storyline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development" ADD CONSTRAINT "development_ingestion_run_id_fkey" FOREIGN KEY ("ingestion_run_id") REFERENCES "knowledge_ingestion_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_anchor" ADD CONSTRAINT "development_anchor_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "development"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_citation" ADD CONSTRAINT "development_citation_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "development"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_citation" ADD CONSTRAINT "development_citation_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyline_ticker" ADD CONSTRAINT "storyline_ticker_storyline_id_fkey" FOREIGN KEY ("storyline_id") REFERENCES "storyline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyline_ticker" ADD CONSTRAINT "storyline_ticker_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
