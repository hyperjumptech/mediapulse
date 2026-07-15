-- AlterTable
ALTER TABLE "data_source" ADD COLUMN     "data_collection_run_id" TEXT;

-- CreateIndex
CREATE INDEX "data_source_data_collection_run_id_idx" ON "data_source"("data_collection_run_id");
