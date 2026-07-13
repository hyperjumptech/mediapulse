-- AlterTable
ALTER TABLE "data_source" ADD COLUMN     "description" TEXT,
ADD COLUMN     "fetch_provider" TEXT,
ADD COLUMN     "fetched_at" TIMESTAMP(3),
ALTER COLUMN "content" DROP NOT NULL;
