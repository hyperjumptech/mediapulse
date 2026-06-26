-- AlterTable
ALTER TABLE "data_source" ADD COLUMN     "section" TEXT,
ADD COLUMN     "section_reason" TEXT,
ADD COLUMN     "section_score" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "data_source_ticker_id_section_idx" ON "data_source"("ticker_id", "section");
