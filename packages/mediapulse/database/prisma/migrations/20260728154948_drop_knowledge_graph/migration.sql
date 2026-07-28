-- DropForeignKey
ALTER TABLE "article_entity" DROP CONSTRAINT "article_entity_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "article_entity" DROP CONSTRAINT "article_entity_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "entity" DROP CONSTRAINT "entity_type_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_alias" DROP CONSTRAINT "entity_alias_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_evidence" DROP CONSTRAINT "entity_evidence_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_evidence" DROP CONSTRAINT "entity_evidence_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_evidence" DROP CONSTRAINT "entity_evidence_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_relation" DROP CONSTRAINT "entity_relation_from_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_relation" DROP CONSTRAINT "entity_relation_relation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_relation" DROP CONSTRAINT "entity_relation_to_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_relation_evidence" DROP CONSTRAINT "entity_relation_evidence_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_relation_evidence" DROP CONSTRAINT "entity_relation_evidence_entity_relation_id_fkey";

-- DropForeignKey
ALTER TABLE "entity_relation_evidence" DROP CONSTRAINT "entity_relation_evidence_ticker_id_fkey";

-- DropForeignKey
ALTER TABLE "ticker_entity" DROP CONSTRAINT "ticker_entity_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "ticker_entity" DROP CONSTRAINT "ticker_entity_ticker_id_fkey";

-- DropTable
DROP TABLE "article_entity";

-- DropTable
DROP TABLE "entity";

-- DropTable
DROP TABLE "entity_alias";

-- DropTable
DROP TABLE "entity_evidence";

-- DropTable
DROP TABLE "entity_relation";

-- DropTable
DROP TABLE "entity_relation_evidence";

-- DropTable
DROP TABLE "entity_type";

-- DropTable
DROP TABLE "relation_type";

-- DropTable
DROP TABLE "ticker_entity";

-- DropEnum
DROP TYPE "Sentiment";

-- DropEnum
DROP TYPE "TickerEntitySource";

