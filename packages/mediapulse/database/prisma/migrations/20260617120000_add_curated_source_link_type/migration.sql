-- CreateEnum
CREATE TYPE "CuratedSourceLinkType" AS ENUM ('page', 'listing');

-- AlterTable
ALTER TABLE "curated_source" ADD COLUMN "link_type" "CuratedSourceLinkType" NOT NULL DEFAULT 'listing';
