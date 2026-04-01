-- AlterTable
ALTER TABLE "delivery_run" ADD COLUMN "hermes_schedule_id" TEXT,
ADD COLUMN "hermes_execution_id" TEXT,
ADD COLUMN "run_skip_reason" TEXT;

-- AlterTable
ALTER TABLE "delivery_recipient_outcome" ADD COLUMN "error_category" TEXT;
