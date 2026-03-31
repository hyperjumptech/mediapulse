-- CreateEnum
CREATE TYPE "DataCollectionRunStatus" AS ENUM ('success', 'partial_success', 'failed');

-- CreateEnum
CREATE TYPE "DataCollectionProviderStage" AS ENUM ('web-search', 'web-fetch');

-- CreateEnum
CREATE TYPE "DataCollectionProvider" AS ENUM ('serper', 'jina');

-- CreateEnum
CREATE TYPE "DataCollectionErrorCategory" AS ENUM ('network_error', 'timeout_error', 'provider_http_error', 'provider_schema_error', 'provider_data_invalid', 'internal_processing_error');

-- CreateTable
CREATE TABLE "data_collection_run" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "DataCollectionRunStatus" NOT NULL,
    "queries_total" INTEGER NOT NULL DEFAULT 0,
    "urls_total" INTEGER NOT NULL DEFAULT 0,
    "search_success" INTEGER NOT NULL DEFAULT 0,
    "search_failed" INTEGER NOT NULL DEFAULT 0,
    "fetch_success" INTEGER NOT NULL DEFAULT 0,
    "fetch_failed" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "data_collection_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_collection_failure" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "stage" "DataCollectionProviderStage" NOT NULL,
    "provider" "DataCollectionProvider" NOT NULL,
    "search_query_id" TEXT,
    "url" TEXT,
    "error_category" "DataCollectionErrorCategory" NOT NULL,
    "retryable" BOOLEAN NOT NULL,
    "http_status" INTEGER,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_collection_failure_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "data_collection_run" ADD CONSTRAINT "data_collection_run_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_failure" ADD CONSTRAINT "data_collection_failure_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "data_collection_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_failure" ADD CONSTRAINT "data_collection_failure_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_failure" ADD CONSTRAINT "data_collection_failure_search_query_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_query"("id") ON DELETE SET NULL ON UPDATE CASCADE;
