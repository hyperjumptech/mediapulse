-- Slim the ticker table: promote the six code-read IDX keys to structured columns,
-- keep the full IDX blob (renamed metadata -> metadata_raw, data preserved), and
-- add the per-ticker discovery cache.

-- AlterTable: preserve the existing blob by renaming rather than dropping.
ALTER TABLE "ticker" RENAME COLUMN "metadata" TO "metadata_raw";

ALTER TABLE "ticker"
  ADD COLUMN "aliases" TEXT[],
  ADD COLUMN "business_activity" TEXT,
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "sector" TEXT,
  ADD COLUMN "sub_industry" TEXT,
  ADD COLUMN "sub_sector" TEXT;

-- Backfill structured classification from the raw IDX blob (TitleCase IDX keys,
-- with lowercase fallbacks matching the reader helpers).
UPDATE "ticker" SET
  "sector"            = COALESCE("metadata_raw"->>'Sektor', "metadata_raw"->>'sector'),
  "industry"          = COALESCE("metadata_raw"->>'Industri', "metadata_raw"->>'industry'),
  "sub_sector"        = COALESCE("metadata_raw"->>'SubSektor', "metadata_raw"->>'sub_sector'),
  "sub_industry"      = COALESCE("metadata_raw"->>'SubIndustri', "metadata_raw"->>'sub_industry'),
  "business_activity" = COALESCE("metadata_raw"->>'KegiatanUsahaUtama', "metadata_raw"->>'business_activity')
WHERE "metadata_raw" IS NOT NULL;

-- Backfill aliases when the raw blob carries a JSON array of aliases.
UPDATE "ticker" SET
  "aliases" = ARRAY(SELECT jsonb_array_elements_text("metadata_raw"->'aliases'))
WHERE "metadata_raw" IS NOT NULL
  AND jsonb_typeof("metadata_raw"->'aliases') = 'array';

-- CreateTable
CREATE TABLE "ticker_discovery" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "competitors" JSONB NOT NULL,
    "regulators" JSONB NOT NULL,
    "model" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticker_discovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticker_discovery_ticker_id_key" ON "ticker_discovery"("ticker_id");

-- CreateIndex
CREATE INDEX "ticker_discovery_expires_at_idx" ON "ticker_discovery"("expires_at");

-- AddForeignKey
ALTER TABLE "ticker_discovery" ADD CONSTRAINT "ticker_discovery_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
