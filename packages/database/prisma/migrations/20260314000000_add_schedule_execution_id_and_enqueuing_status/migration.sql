-- AlterEnum
ALTER TYPE "ScheduleExecutionStatus" ADD VALUE 'enqueuing';

-- AlterTable
ALTER TABLE "agent_job_execution" ADD COLUMN "schedule_execution_id" TEXT;

-- AddForeignKey
ALTER TABLE "agent_job_execution" ADD CONSTRAINT "agent_job_execution_schedule_execution_id_fkey" FOREIGN KEY ("schedule_execution_id") REFERENCES "schedule_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
