-- CreateTable
CREATE TABLE "organon_article_send" (
    "id" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "ticker_symbols" TEXT[],
    "organon_job_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "failure_retried_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organon_article_send_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organon_article_send_canonical_url_key" ON "organon_article_send"("canonical_url");

-- CreateIndex
CREATE INDEX "organon_article_send_organon_job_id_idx" ON "organon_article_send"("organon_job_id");

-- CreateIndex
CREATE INDEX "organon_article_send_sent_at_idx" ON "organon_article_send"("sent_at");

-- CreateIndex
CREATE INDEX "data_source_ticker_section_created_at_idx" ON "data_source_ticker_section"("created_at");
