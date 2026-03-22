-- AlterTable
ALTER TABLE "agent_job_execution" ADD COLUMN     "data_queue_attempts" INTEGER,
ADD COLUMN     "data_queue_max_attempts" INTEGER;
