-- AlterTable
ALTER TABLE "newsletter_section_item" ADD COLUMN     "points" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: rows written before points existed keep their text as a single point. The original
-- points cannot be recovered, because they were persisted already joined on a single space.
UPDATE "newsletter_section_item"
SET "points" = ARRAY["summary"]
WHERE cardinality("points") = 0 AND btrim("summary") <> '';

-- AlterTable
ALTER TABLE "newsletter_section_item" DROP COLUMN "summary";
