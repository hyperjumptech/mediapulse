/*
  Warnings:

  - You are about to drop the `development` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `development_anchor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `development_citation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_entity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_entity_alias` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_entity_mention` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_extraction_run` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_ingestion_run` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_relation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_relation_kind` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_relation_kind_alias` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_ticker_entity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_ticker_relation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `storyline` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `storyline_anchor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `storyline_ticker` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "development" DROP CONSTRAINT "development_ingestion_run_id_fkey";

-- DropForeignKey
ALTER TABLE "development" DROP CONSTRAINT "development_storyline_id_fkey";

-- DropForeignKey
ALTER TABLE "development_anchor" DROP CONSTRAINT "development_anchor_development_id_fkey";

-- DropForeignKey
ALTER TABLE "development_citation" DROP CONSTRAINT "development_citation_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "development_citation" DROP CONSTRAINT "development_citation_development_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_entity" DROP CONSTRAINT "knowledge_entity_extraction_run_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_entity" DROP CONSTRAINT "knowledge_entity_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_entity_alias" DROP CONSTRAINT "knowledge_entity_alias_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_entity_mention" DROP CONSTRAINT "knowledge_entity_mention_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_entity_mention" DROP CONSTRAINT "knowledge_entity_mention_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_entity_mention" DROP CONSTRAINT "knowledge_entity_mention_extraction_run_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_entity_mention" DROP CONSTRAINT "knowledge_entity_mention_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_extraction_run" DROP CONSTRAINT "knowledge_extraction_run_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_relation" DROP CONSTRAINT "knowledge_relation_evidence_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_relation" DROP CONSTRAINT "knowledge_relation_extraction_run_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_relation" DROP CONSTRAINT "knowledge_relation_kind_slug_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_relation" DROP CONSTRAINT "knowledge_relation_object_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_relation" DROP CONSTRAINT "knowledge_relation_subject_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_relation_kind" DROP CONSTRAINT "knowledge_relation_kind_extraction_run_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_relation_kind_alias" DROP CONSTRAINT "knowledge_relation_kind_alias_kind_slug_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_ticker_entity" DROP CONSTRAINT "knowledge_ticker_entity_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_ticker_entity" DROP CONSTRAINT "knowledge_ticker_entity_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_ticker_relation" DROP CONSTRAINT "knowledge_ticker_relation_relation_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_ticker_relation" DROP CONSTRAINT "knowledge_ticker_relation_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "storyline_anchor" DROP CONSTRAINT "storyline_anchor_storyline_id_fkey";

-- DropForeignKey
ALTER TABLE "storyline_ticker" DROP CONSTRAINT "storyline_ticker_storyline_id_fkey";

-- DropForeignKey
ALTER TABLE "storyline_ticker" DROP CONSTRAINT "storyline_ticker_ticker_id_fkey";

-- DropTable
DROP TABLE "development";

-- DropTable
DROP TABLE "development_anchor";

-- DropTable
DROP TABLE "development_citation";

-- DropTable
DROP TABLE "knowledge_entity";

-- DropTable
DROP TABLE "knowledge_entity_alias";

-- DropTable
DROP TABLE "knowledge_entity_mention";

-- DropTable
DROP TABLE "knowledge_extraction_run";

-- DropTable
DROP TABLE "knowledge_ingestion_run";

-- DropTable
DROP TABLE "knowledge_relation";

-- DropTable
DROP TABLE "knowledge_relation_kind";

-- DropTable
DROP TABLE "knowledge_relation_kind_alias";

-- DropTable
DROP TABLE "knowledge_ticker_entity";

-- DropTable
DROP TABLE "knowledge_ticker_relation";

-- DropTable
DROP TABLE "storyline";

-- DropTable
DROP TABLE "storyline_anchor";

-- DropTable
DROP TABLE "storyline_ticker";

-- DropEnum
DROP TYPE "KnowledgeEntityKind";

-- DropEnum
DROP TYPE "KnowledgeFactSource";

-- DropEnum
DROP TYPE "StorylineKind";

-- DropEnum
DROP TYPE "StorylineTickerSource";
