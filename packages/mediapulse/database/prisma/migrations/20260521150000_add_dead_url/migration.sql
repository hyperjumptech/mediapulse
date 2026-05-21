-- CreateTable
CREATE TABLE "dead_url" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "error_category" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dead_url_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dead_url_url_key" ON "dead_url"("url");

-- CreateIndex
CREATE INDEX "dead_url_ticker_id_expires_at_idx" ON "dead_url"("ticker_id", "expires_at");
