-- AlterTable
ALTER TABLE "data_collection_run" DROP COLUMN "extended_counters",
DROP COLUMN "fetch_failed",
DROP COLUMN "fetch_success",
DROP COLUMN "queries_total",
DROP COLUMN "retry_count",
DROP COLUMN "search_failed",
DROP COLUMN "search_success",
DROP COLUMN "urls_total";

