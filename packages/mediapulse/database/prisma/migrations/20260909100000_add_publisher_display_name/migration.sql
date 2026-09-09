-- CreateEnum
CREATE TYPE "PublisherNameSource" AS ENUM ('derived', 'llm', 'site_metadata', 'manual');

-- CreateTable
CREATE TABLE "publisher" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "name_source" "PublisherNameSource" NOT NULL DEFAULT 'derived',
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publisher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "publisher_domain_key" ON "publisher"("domain");

-- CreateIndex
CREATE INDEX "publisher_name_source_last_seen_at_idx" ON "publisher"("name_source", "last_seen_at");
