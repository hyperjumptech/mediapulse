-- CreateTable
CREATE TABLE "data_source_ticker_section" (
    "id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "section" TEXT,
    "section_score" DOUBLE PRECISION,
    "section_reason" TEXT,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_source_ticker_section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_source_ticker_section_ticker_id_section_analyzed_at_idx" ON "data_source_ticker_section"("ticker_id", "section", "analyzed_at");

-- CreateIndex
CREATE UNIQUE INDEX "data_source_ticker_section_data_source_id_ticker_id_key" ON "data_source_ticker_section"("data_source_id", "ticker_id");

-- AddForeignKey
ALTER TABLE "data_source_ticker_section" ADD CONSTRAINT "data_source_ticker_section_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_source_ticker_section" ADD CONSTRAINT "data_source_ticker_section_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
