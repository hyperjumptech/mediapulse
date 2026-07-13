-- CreateTable
CREATE TABLE "fetch_event" (
    "id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "provider" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fetch_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_citation" (
    "id" TEXT NOT NULL,
    "newsletter_id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_citation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fetch_event_data_source_id_idx" ON "fetch_event"("data_source_id");

-- CreateIndex
CREATE INDEX "fetch_event_ticker_id_idx" ON "fetch_event"("ticker_id");

-- CreateIndex
CREATE INDEX "newsletter_citation_newsletter_id_idx" ON "newsletter_citation"("newsletter_id");

-- CreateIndex
CREATE INDEX "newsletter_citation_data_source_id_idx" ON "newsletter_citation"("data_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_citation_newsletter_id_data_source_id_section_ke_key" ON "newsletter_citation"("newsletter_id", "data_source_id", "section_key");

-- AddForeignKey
ALTER TABLE "fetch_event" ADD CONSTRAINT "fetch_event_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_citation" ADD CONSTRAINT "newsletter_citation_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_citation" ADD CONSTRAINT "newsletter_citation_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
