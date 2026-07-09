-- AlterTable
ALTER TABLE "data_collection_run" ADD COLUMN     "snapshot" JSONB;

-- CreateTable
CREATE TABLE "page_collection_run" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT,
    "schedule_execution_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "DataCollectionRunStatus" NOT NULL,
    "snapshot" JSONB,

    CONSTRAINT "page_collection_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_collection_url_outcome" (
    "id" TEXT NOT NULL,
    "schedule_execution_id" TEXT,
    "run_id" TEXT NOT NULL,
    "ticker_id" TEXT,
    "status" "CollectionUrlStatus" NOT NULL,
    "url" TEXT NOT NULL,
    "reason" TEXT,
    "reason_detail" TEXT,
    "source" TEXT,
    "curated_source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_collection_url_outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_collection_failure" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "ticker_id" TEXT,
    "stage" "DataCollectionProviderStage" NOT NULL,
    "provider" "DataCollectionProvider" NOT NULL,
    "url" TEXT,
    "error_category" "DataCollectionErrorCategory" NOT NULL,
    "retryable" BOOLEAN NOT NULL,
    "http_status" INTEGER,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_collection_failure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_collection_run_schedule_execution_id_idx" ON "page_collection_run"("schedule_execution_id");

-- CreateIndex
CREATE INDEX "page_collection_url_outcome_schedule_execution_id_idx" ON "page_collection_url_outcome"("schedule_execution_id");

-- CreateIndex
CREATE INDEX "page_collection_url_outcome_run_id_status_idx" ON "page_collection_url_outcome"("run_id", "status");

-- CreateIndex
CREATE INDEX "page_collection_url_outcome_ticker_id_created_at_idx" ON "page_collection_url_outcome"("ticker_id", "created_at");

-- CreateIndex
CREATE INDEX "page_collection_url_outcome_curated_source_id_created_at_idx" ON "page_collection_url_outcome"("curated_source_id", "created_at");

-- AddForeignKey
ALTER TABLE "page_collection_run" ADD CONSTRAINT "page_collection_run_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_collection_url_outcome" ADD CONSTRAINT "page_collection_url_outcome_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "page_collection_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_collection_url_outcome" ADD CONSTRAINT "page_collection_url_outcome_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_collection_url_outcome" ADD CONSTRAINT "page_collection_url_outcome_curated_source_id_fkey" FOREIGN KEY ("curated_source_id") REFERENCES "curated_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_collection_failure" ADD CONSTRAINT "page_collection_failure_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "page_collection_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_collection_failure" ADD CONSTRAINT "page_collection_failure_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

