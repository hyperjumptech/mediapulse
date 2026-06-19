-- AlterTable
ALTER TABLE "data_collection_run" ADD COLUMN "schedule_execution_id" TEXT;

-- CreateIndex
CREATE INDEX "data_collection_run_schedule_execution_id_idx" ON "data_collection_run"("schedule_execution_id");
