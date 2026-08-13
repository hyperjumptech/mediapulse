-- An article reports exactly one move, so a Data Source may cite at most one Development.
-- Without this, re-ingesting an article opens a second Development for an event that happened once.

-- Keep the earliest citation per Data Source and drop the rest.
DELETE FROM "development_citation" a
USING "development_citation" b
WHERE a."data_source_id" = b."data_source_id"
  AND (a."created_at" > b."created_at"
       OR (a."created_at" = b."created_at" AND a."id" > b."id"));

-- Developments left with no citation described no article and are removed.
DELETE FROM "development" d
WHERE NOT EXISTS (
  SELECT 1 FROM "development_citation" c WHERE c."development_id" = d."id"
);

-- Storylines left with no development are removed with them.
DELETE FROM "storyline" s
WHERE NOT EXISTS (
  SELECT 1 FROM "development" d WHERE d."storyline_id" = s."id"
);

DROP INDEX IF EXISTS "development_citation_development_id_data_source_id_key";
DROP INDEX IF EXISTS "development_citation_data_source_id_idx";

CREATE UNIQUE INDEX "development_citation_data_source_id_key" ON "development_citation"("data_source_id");
CREATE INDEX "development_citation_development_id_idx" ON "development_citation"("development_id");

-- Counters were created without @map and broke the snake_case convention every other model follows.
ALTER TABLE "knowledge_ingestion_run" RENAME COLUMN "storylinesOpened" TO "storylines_opened";
ALTER TABLE "knowledge_ingestion_run" RENAME COLUMN "developmentsOpened" TO "developments_opened";
ALTER TABLE "knowledge_ingestion_run" RENAME COLUMN "citationsAdded" TO "citations_added";
ALTER TABLE "knowledge_ingestion_run" RENAME COLUMN "storylinesLocked" TO "storylines_locked";
ALTER TABLE "knowledge_ingestion_run" RENAME COLUMN "skippedNoAnchors" TO "skipped_no_anchors";
