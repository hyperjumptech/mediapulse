-- AlterTable
ALTER TABLE "article_analysis_run" ADD COLUMN     "agent_version" TEXT;

-- AlterTable
ALTER TABLE "data_source_ticker_section" ADD COLUMN     "article_analysis_run_id" TEXT;

-- CreateIndex
CREATE INDEX "data_source_ticker_section_article_analysis_run_id_idx" ON "data_source_ticker_section"("article_analysis_run_id");
