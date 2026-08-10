-- AlterTable
ALTER TABLE "data_source" ADD COLUMN     "registrable_domain" TEXT;

-- CreateTable
CREATE TABLE "domain_authority" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "open_page_rank" DOUBLE PRECISION,
    "global_rank" INTEGER,
    "referring_domains" INTEGER,
    "as_of" DATE,
    "refreshed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_authority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domain_authority_domain_key" ON "domain_authority"("domain");

-- CreateIndex
CREATE INDEX "domain_authority_refreshed_at_idx" ON "domain_authority"("refreshed_at");

-- CreateIndex
CREATE INDEX "data_source_registrable_domain_idx" ON "data_source"("registrable_domain");
