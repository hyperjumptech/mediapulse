-- Add shared listing discovery cache table keyed by listing URL for cross-ticker deduplication.
CREATE TABLE "listing_discovery_cache" (
    "id" TEXT NOT NULL,
    "listing_url" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_discovery_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "listing_discovery_cache_listing_url_key" ON "listing_discovery_cache"("listing_url");

CREATE INDEX "listing_discovery_cache_expires_at_idx" ON "listing_discovery_cache"("expires_at");
