/*
  Warnings:

  - You are about to drop the column `status` on the `schedule_execution` table. All the data in the column will be lost.
  - Added the required column `enqueue_status` to the `schedule_execution` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ScheduleEnqueueStatus" AS ENUM ('success', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "ScheduleRunStatus" AS ENUM ('pending', 'running', 'succeeded', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "ScheduleStepRollupStatus" AS ENUM ('pending', 'running', 'success', 'partial', 'failed', 'skipped', 'cancelled');

-- AlterTable
ALTER TABLE "agent_job_execution" ADD COLUMN     "agent_response" JSONB,
ADD COLUMN     "semantic_status" TEXT;

-- AlterTable
ALTER TABLE "pipeline" ADD COLUMN     "execution_config" JSONB;

-- AlterTable
ALTER TABLE "schedule" ADD COLUMN     "execution_config" JSONB;

-- AlterTable
ALTER TABLE "schedule_execution" DROP COLUMN "status",
ADD COLUMN     "effective_execution_config" JSONB,
ADD COLUMN     "enqueue_status" "ScheduleEnqueueStatus" NOT NULL,
ADD COLUMN     "failed_invocation_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "run_status" "ScheduleRunStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "succeeded_invocation_count" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "ScheduleExecutionStatus";

-- CreateTable
CREATE TABLE "schedule_step_execution" (
    "id" TEXT NOT NULL,
    "schedule_execution_id" TEXT NOT NULL,
    "pipeline_step_id" TEXT NOT NULL,
    "expected_invocation_count" INTEGER NOT NULL,
    "succeeded_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "rollup_status" "ScheduleStepRollupStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_step_execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_step_execution_schedule_execution_id_pipeline_step_key" ON "schedule_step_execution"("schedule_execution_id", "pipeline_step_id");

-- AddForeignKey
ALTER TABLE "schedule_step_execution" ADD CONSTRAINT "schedule_step_execution_schedule_execution_id_fkey" FOREIGN KEY ("schedule_execution_id") REFERENCES "schedule_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_step_execution" ADD CONSTRAINT "schedule_step_execution_pipeline_step_id_fkey" FOREIGN KEY ("pipeline_step_id") REFERENCES "pipeline_step"("id") ON DELETE CASCADE ON UPDATE CASCADE;
