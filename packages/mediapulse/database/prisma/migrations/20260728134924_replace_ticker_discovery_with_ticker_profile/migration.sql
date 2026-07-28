-- DropForeignKey
ALTER TABLE "ticker_discovery" DROP CONSTRAINT "ticker_discovery_ticker_id_fkey";

-- DropTable
DROP TABLE "ticker_discovery";

-- CreateTable
CREATE TABLE "ticker_profile" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "company_overview" TEXT NOT NULL,
    "business_operation" TEXT NOT NULL,
    "sector_indonesian" TEXT NOT NULL,
    "sector_english" TEXT NOT NULL,
    "sub_sector_indonesian" TEXT NOT NULL,
    "sub_sector_english" TEXT NOT NULL,
    "industry_indonesian" TEXT NOT NULL,
    "industry_english" TEXT NOT NULL,
    "sub_industry_indonesian" TEXT NOT NULL,
    "sub_industry_english" TEXT NOT NULL,
    "aliases" TEXT[],
    "competitors" JSONB NOT NULL,
    "regulators" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticker_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticker_profile_ticker_id_key" ON "ticker_profile"("ticker_id");

-- AddForeignKey
ALTER TABLE "ticker_profile" ADD CONSTRAINT "ticker_profile_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
