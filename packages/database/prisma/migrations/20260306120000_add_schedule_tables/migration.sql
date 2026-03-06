-- CreateEnum
CREATE TYPE "ScheduleRepeat" AS ENUM ('once', 'repeating');

-- CreateEnum
CREATE TYPE "ScheduleExecutionStatus" AS ENUM ('success', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "AgentJobExecutionStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "schedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repeat" "ScheduleRepeat" NOT NULL,
    "cron_expression" TEXT,
    "interval" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "start_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "pipeline_id" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "retry_config" JSONB,
    "timeout" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_execution" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "execution_time" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleExecutionStatus" NOT NULL,
    "jobs_created" INTEGER NOT NULL,
    "jobs_enqueued" INTEGER NOT NULL,
    "errors" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_job_execution" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "pipeline_id" TEXT,
    "pipeline_step_id" TEXT,
    "status" "AgentJobExecutionStatus" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enqueued_at" TIMESTAMP(3) NOT NULL,
    "dependencies" JSONB,
    "params" JSONB NOT NULL DEFAULT '{}',
    "error" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_job_execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_job_execution_job_id_key" ON "agent_job_execution"("job_id");

-- AddForeignKey
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_execution" ADD CONSTRAINT "schedule_execution_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_job_execution" ADD CONSTRAINT "agent_job_execution_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
