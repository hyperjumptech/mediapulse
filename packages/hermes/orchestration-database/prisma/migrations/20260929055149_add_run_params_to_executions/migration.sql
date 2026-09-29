-- AlterTable
ALTER TABLE "http_trigger_execution" ADD COLUMN     "run_params" JSONB;

-- AlterTable
ALTER TABLE "manual_pipeline_execution" ADD COLUMN     "run_params" JSONB;
