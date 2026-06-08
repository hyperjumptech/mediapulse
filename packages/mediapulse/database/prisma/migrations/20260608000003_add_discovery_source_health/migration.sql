CREATE TABLE "discovery_source_health" (
    "id" TEXT NOT NULL,
    "listing_url" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "discovered" BOOLEAN NOT NULL,
    "item_count" INTEGER NOT NULL,
    "winning_strategy" TEXT,
    "failure_count" INTEGER NOT NULL,
    "last_error" TEXT,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discovery_source_health_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "discovery_source_health_listing_url_run_date_key" ON "discovery_source_health"("listing_url", "run_date");
CREATE INDEX "discovery_source_health_listing_url_run_date_idx" ON "discovery_source_health"("listing_url", "run_date" DESC);
