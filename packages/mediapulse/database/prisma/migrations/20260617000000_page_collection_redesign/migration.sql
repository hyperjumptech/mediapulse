-- CreateEnum
CREATE TYPE "CollectionGateStatus" AS ENUM ('passed', 'failed');

-- CreateEnum
CREATE TYPE "ArticleAssociationSource" AS ENUM ('inferred', 'manual');

-- DropForeignKey
ALTER TABLE "data_source" DROP CONSTRAINT "data_source_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "data_source" DROP CONSTRAINT "data_source_search_query_id_fkey";

-- DropForeignKey
ALTER TABLE "data_collection_run" DROP CONSTRAINT "data_collection_run_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "data_collection_failure" DROP CONSTRAINT "data_collection_failure_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "collection_url_outcome" DROP CONSTRAINT "collection_url_outcome_ticker_id_fkey";

-- DropIndex
DROP INDEX "data_source_ticker_id_canonical_url_key";

-- DropIndex
DROP INDEX "dead_url_ticker_id_expires_at_idx";

-- AlterTable
ALTER TABLE "data_source" ADD COLUMN     "analyzed_at" TIMESTAMP(3),
ADD COLUMN     "collection_gate_reason" TEXT,
ADD COLUMN     "collection_gate_status" "CollectionGateStatus",
ADD COLUMN     "curated_source_id" TEXT,
ALTER COLUMN "ticker_id" DROP NOT NULL,
ALTER COLUMN "search_query_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "dead_url" ALTER COLUMN "ticker_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "article_relevance" ADD COLUMN     "association_reasoning" TEXT,
ADD COLUMN     "association_source" "ArticleAssociationSource" NOT NULL DEFAULT 'inferred';

-- AlterTable
ALTER TABLE "data_collection_run" ALTER COLUMN "ticker_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "data_collection_failure" ALTER COLUMN "ticker_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "collection_url_outcome" ADD COLUMN     "curated_source_id" TEXT,
ALTER COLUMN "ticker_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "curated_source" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "listing_url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_items" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curated_source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curated_source_listing_url_key" ON "curated_source"("listing_url");

-- CreateIndex
CREATE INDEX "data_source_curated_source_id_idx" ON "data_source"("curated_source_id");

-- CreateIndex
CREATE INDEX "data_source_collection_gate_status_analyzed_at_idx" ON "data_source"("collection_gate_status", "analyzed_at");

-- CreateIndex
CREATE INDEX "dead_url_expires_at_idx" ON "dead_url"("expires_at");

-- CreateIndex
CREATE INDEX "collection_url_outcome_curated_source_id_created_at_idx" ON "collection_url_outcome"("curated_source_id", "created_at");

-- Partial unique indexes for ticker-scoped vs global article dedup
CREATE UNIQUE INDEX "data_source_global_canonical_url_key" ON "data_source"("canonical_url") WHERE "ticker_id" IS NULL;

CREATE UNIQUE INDEX "data_source_ticker_canonical_url_key" ON "data_source"("ticker_id", "canonical_url") WHERE "ticker_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_search_query_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_query"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_curated_source_id_fkey" FOREIGN KEY ("curated_source_id") REFERENCES "curated_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_run" ADD CONSTRAINT "data_collection_run_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_failure" ADD CONSTRAINT "data_collection_failure_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_url_outcome" ADD CONSTRAINT "collection_url_outcome_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_url_outcome" ADD CONSTRAINT "collection_url_outcome_curated_source_id_fkey" FOREIGN KEY ("curated_source_id") REFERENCES "curated_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
