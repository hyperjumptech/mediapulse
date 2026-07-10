-- DropForeignKey
ALTER TABLE "page_collection_url_outcome" DROP CONSTRAINT "page_collection_url_outcome_run_id_fkey";

-- DropForeignKey
ALTER TABLE "page_collection_url_outcome" DROP CONSTRAINT "page_collection_url_outcome_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "page_collection_url_outcome" DROP CONSTRAINT "page_collection_url_outcome_curated_source_id_fkey";

-- DropForeignKey
ALTER TABLE "page_collection_failure" DROP CONSTRAINT "page_collection_failure_run_id_fkey";

-- DropForeignKey
ALTER TABLE "page_collection_failure" DROP CONSTRAINT "page_collection_failure_ticker_id_fkey";

-- DropTable
DROP TABLE "page_collection_url_outcome";

-- DropTable
DROP TABLE "page_collection_failure";

