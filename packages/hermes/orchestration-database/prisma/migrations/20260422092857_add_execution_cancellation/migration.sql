-- AlterEnum
ALTER TYPE "AgentJobExecutionStatus" ADD VALUE 'cancelled';

-- AlterEnum
ALTER TYPE "ScheduleRunStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "http_trigger_execution" ADD COLUMN     "cancelled_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "manual_pipeline_execution" ADD COLUMN     "cancelled_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "schedule_execution" ADD COLUMN     "cancelled_at" TIMESTAMP(3);
