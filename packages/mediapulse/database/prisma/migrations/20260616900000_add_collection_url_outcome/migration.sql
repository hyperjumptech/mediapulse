-- CreateEnum
CREATE TYPE "CollectionAgent" AS ENUM ('data-collection', 'page-collection');

-- CreateEnum
CREATE TYPE "CollectionUrlStatus" AS ENUM ('collected', 'dropped', 'failed');

-- CreateTable
CREATE TABLE "collection_url_outcome" (
    "id" TEXT NOT NULL,
    "schedule_execution_id" TEXT,
    "run_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "agent" "CollectionAgent" NOT NULL,
    "status" "CollectionUrlStatus" NOT NULL,
    "url" TEXT NOT NULL,
    "reason" TEXT,
    "reason_detail" TEXT,
    "source" TEXT,
    "search_query_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_url_outcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_url_outcome_schedule_execution_id_idx" ON "collection_url_outcome"("schedule_execution_id");

-- CreateIndex
CREATE INDEX "collection_url_outcome_run_id_status_idx" ON "collection_url_outcome"("run_id", "status");

-- CreateIndex
CREATE INDEX "collection_url_outcome_ticker_id_created_at_idx" ON "collection_url_outcome"("ticker_id", "created_at");

-- AddForeignKey
ALTER TABLE "collection_url_outcome" ADD CONSTRAINT "collection_url_outcome_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "data_collection_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_url_outcome" ADD CONSTRAINT "collection_url_outcome_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
