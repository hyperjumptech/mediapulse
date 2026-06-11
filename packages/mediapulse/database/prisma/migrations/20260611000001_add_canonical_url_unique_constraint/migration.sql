-- Migration: add canonical_url to data_source with per-ticker uniqueness constraint.
--
-- Steps:
--   1. Add canonical_url as nullable.
--   2. Populate it from the raw url using a best-effort SQL normalization:
--      - strip fragment (#...) via split_part
--      - lowercase the result
--      - remove common tracking query params (utm_*, fbclid, gclid, mc_*)
--        NOTE: exact parameter stripping is hard in plain SQL; we strip the full
--        query string when it contains only tracking params, otherwise leave it.
--      The TypeScript canonicalizeUrl() function handles edge cases more precisely;
--      this SQL approximation is safe for the migration because any remaining
--      variation will be resolved the moment the application writes new rows using
--      the TypeScript-computed canonical URL.
--   3. Deduplicate rows: for each (ticker_id, canonical_url) group keep the row with
--      the highest published_at, or latest created_at when published_at is null.
--      Re-point all dependent rows to the surviving id before deleting duplicates.
--   4. Make canonical_url NOT NULL and add the unique constraint.

-- Step 1: add nullable column
ALTER TABLE "data_source" ADD COLUMN "canonical_url" TEXT;

-- Step 2: populate canonical_url from url
-- Strip fragment, lowercase, strip pure-tracking query strings.
-- The regexp removes the entire query string when every parameter is a tracking one.
-- Non-tracking query strings are kept as-is (safe fallback).
UPDATE "data_source"
SET "canonical_url" = lower(
  CASE
    WHEN split_part(split_part("url", '#', 1), '?', 2) ~ '^((utm_[^&=]*=[^&]*|fbclid=[^&]*|gclid=[^&]*|mc_[^&=]*=[^&]*)(&|$))+$'
      THEN split_part(split_part("url", '#', 1), '?', 1)
    ELSE split_part("url", '#', 1)
  END
);

-- Step 3: deduplicate — keep the best survivor per (ticker_id, canonical_url),
-- re-point dependents to the survivor, then delete the losers.

-- 3a. Identify survivors: highest published_at wins; fall back to latest created_at.
CREATE TEMP TABLE _ds_survivors AS
SELECT DISTINCT ON ("ticker_id", "canonical_url")
  "id" AS survivor_id,
  "ticker_id",
  "canonical_url"
FROM "data_source"
ORDER BY
  "ticker_id",
  "canonical_url",
  "published_at" DESC NULLS LAST,
  "created_at"   DESC;

-- 3b. Build a mapping from every duplicate id to its survivor id.
CREATE TEMP TABLE _ds_remap AS
SELECT
  ds."id"          AS old_id,
  srv.survivor_id  AS new_id
FROM "data_source"  AS ds
JOIN _ds_survivors  AS srv
  ON  ds."ticker_id"     = srv."ticker_id"
  AND ds."canonical_url" = srv."canonical_url"
WHERE ds."id" <> srv.survivor_id;

-- 3c. Re-point article_relevance (unique on (data_source_id, ticker_id), so we
--     delete the duplicate-target row when the survivor already has one).
DELETE FROM "article_relevance"
WHERE "data_source_id" IN (SELECT old_id FROM _ds_remap)
  AND EXISTS (
    SELECT 1 FROM "article_relevance" ar2
    JOIN _ds_remap r ON r.old_id = "article_relevance"."data_source_id"
    WHERE ar2."data_source_id" = r.new_id
      AND ar2."ticker_id"      = "article_relevance"."ticker_id"
  );

UPDATE "article_relevance"
SET "data_source_id" = r.new_id
FROM _ds_remap r
WHERE "article_relevance"."data_source_id" = r.old_id;

-- 3d. Re-point article_entity (unique on (data_source_id, entity_id)).
DELETE FROM "article_entity"
WHERE "data_source_id" IN (SELECT old_id FROM _ds_remap)
  AND EXISTS (
    SELECT 1 FROM "article_entity" ae2
    JOIN _ds_remap r ON r.old_id = "article_entity"."data_source_id"
    WHERE ae2."data_source_id" = r.new_id
      AND ae2."entity_id"      = "article_entity"."entity_id"
  );

UPDATE "article_entity"
SET "data_source_id" = r.new_id
FROM _ds_remap r
WHERE "article_entity"."data_source_id" = r.old_id;

-- 3e. Re-point entity_evidence (unique on (entity_id, data_source_id, ticker_id)).
DELETE FROM "entity_evidence"
WHERE "data_source_id" IN (SELECT old_id FROM _ds_remap)
  AND EXISTS (
    SELECT 1 FROM "entity_evidence" ee2
    JOIN _ds_remap r ON r.old_id = "entity_evidence"."data_source_id"
    WHERE ee2."data_source_id" = r.new_id
      AND ee2."entity_id"      = "entity_evidence"."entity_id"
      AND ee2."ticker_id"      = "entity_evidence"."ticker_id"
  );

UPDATE "entity_evidence"
SET "data_source_id" = r.new_id
FROM _ds_remap r
WHERE "entity_evidence"."data_source_id" = r.old_id;

-- 3f. Re-point entity_relation_evidence (unique on (entity_relation_id, data_source_id, ticker_id)).
DELETE FROM "entity_relation_evidence"
WHERE "data_source_id" IN (SELECT old_id FROM _ds_remap)
  AND EXISTS (
    SELECT 1 FROM "entity_relation_evidence" ere2
    JOIN _ds_remap r ON r.old_id = "entity_relation_evidence"."data_source_id"
    WHERE ere2."data_source_id"     = r.new_id
      AND ere2."entity_relation_id" = "entity_relation_evidence"."entity_relation_id"
      AND ere2."ticker_id"          = "entity_relation_evidence"."ticker_id"
  );

UPDATE "entity_relation_evidence"
SET "data_source_id" = r.new_id
FROM _ds_remap r
WHERE "entity_relation_evidence"."data_source_id" = r.old_id;

-- 3g. Delete the now-orphaned duplicate data_source rows.
DELETE FROM "data_source"
WHERE "id" IN (SELECT old_id FROM _ds_remap);

-- Clean up temp tables.
DROP TABLE _ds_remap;
DROP TABLE _ds_survivors;

-- Step 4: enforce NOT NULL and add the unique constraint.
ALTER TABLE "data_source" ALTER COLUMN "canonical_url" SET NOT NULL;
CREATE UNIQUE INDEX "data_source_ticker_id_canonical_url_key"
  ON "data_source" ("ticker_id", "canonical_url");
