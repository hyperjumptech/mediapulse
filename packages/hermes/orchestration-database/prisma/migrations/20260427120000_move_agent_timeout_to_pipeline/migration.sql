-- Per-agent invoke timeout moved from schedule to pipeline.
-- When multiple schedules on one pipeline had different non-null timeouts, MAX preserves the longest configured value.

-- AlterTable
ALTER TABLE "pipeline" ADD COLUMN "timeout" INTEGER;

-- Backfill from schedules (MAX per pipeline_id)
UPDATE "pipeline" AS p
SET "timeout" = agg.max_timeout
FROM (
  SELECT "pipeline_id", MAX("timeout") AS max_timeout
  FROM "schedule"
  WHERE "timeout" IS NOT NULL
  GROUP BY "pipeline_id"
) AS agg
WHERE p."id" = agg."pipeline_id";

-- AlterTable
ALTER TABLE "schedule" DROP COLUMN "timeout";
