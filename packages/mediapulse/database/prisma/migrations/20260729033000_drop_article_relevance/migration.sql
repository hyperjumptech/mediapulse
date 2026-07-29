-- DropForeignKey
ALTER TABLE "article_relevance" DROP CONSTRAINT "article_relevance_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "article_relevance" DROP CONSTRAINT "article_relevance_ticker_id_fkey";

-- DropTable
DROP TABLE "article_relevance";

-- DropEnum
DROP TYPE "ArticleAssociationSource";
