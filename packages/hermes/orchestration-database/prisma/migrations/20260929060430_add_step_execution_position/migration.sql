-- AlterTable
ALTER TABLE "http_trigger_step_execution" ADD COLUMN     "position" INTEGER;

-- AlterTable
ALTER TABLE "manual_pipeline_step_execution" ADD COLUMN     "position" INTEGER;

-- AlterTable
ALTER TABLE "schedule_step_execution" ADD COLUMN     "position" INTEGER;
