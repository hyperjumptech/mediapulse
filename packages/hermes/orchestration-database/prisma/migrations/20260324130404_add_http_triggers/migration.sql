-- CreateEnum
CREATE TYPE "HttpTriggerAuthType" AS ENUM ('BEARER_TOKEN');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'DELETE', 'PATCH');

-- AlterTable
ALTER TABLE "agent_job_execution" ADD COLUMN     "http_trigger_execution_id" TEXT,
ADD COLUMN     "http_trigger_id" TEXT;

-- CreateTable
CREATE TABLE "http_trigger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pipeline_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "method" "HttpMethod" NOT NULL DEFAULT 'POST',
    "auth_type" "HttpTriggerAuthType" NOT NULL DEFAULT 'BEARER_TOKEN',
    "token_hash" TEXT NOT NULL,
    "token_hint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_triggered_at" TIMESTAMP(3),

    CONSTRAINT "http_trigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "http_trigger_execution" (
    "id" TEXT NOT NULL,
    "http_trigger_id" TEXT NOT NULL,
    "execution_time" TIMESTAMP(3) NOT NULL,
    "enqueue_status" "ScheduleEnqueueStatus" NOT NULL,
    "run_status" "ScheduleRunStatus" NOT NULL DEFAULT 'pending',
    "effective_execution_config" JSONB,
    "jobs_created" INTEGER NOT NULL,
    "jobs_enqueued" INTEGER NOT NULL,
    "succeeded_invocation_count" INTEGER NOT NULL DEFAULT 0,
    "failed_invocation_count" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "http_trigger_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "http_trigger_step_execution" (
    "id" TEXT NOT NULL,
    "http_trigger_execution_id" TEXT NOT NULL,
    "pipeline_step_id" TEXT NOT NULL,
    "expected_invocation_count" INTEGER NOT NULL,
    "succeeded_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "rollup_status" "ScheduleStepRollupStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "http_trigger_step_execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "http_trigger_step_execution_http_trigger_execution_id_pipel_key" ON "http_trigger_step_execution"("http_trigger_execution_id", "pipeline_step_id");

-- AddForeignKey
ALTER TABLE "agent_job_execution" ADD CONSTRAINT "agent_job_execution_http_trigger_id_fkey" FOREIGN KEY ("http_trigger_id") REFERENCES "http_trigger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_job_execution" ADD CONSTRAINT "agent_job_execution_http_trigger_execution_id_fkey" FOREIGN KEY ("http_trigger_execution_id") REFERENCES "http_trigger_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "http_trigger" ADD CONSTRAINT "http_trigger_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "http_trigger_execution" ADD CONSTRAINT "http_trigger_execution_http_trigger_id_fkey" FOREIGN KEY ("http_trigger_id") REFERENCES "http_trigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "http_trigger_step_execution" ADD CONSTRAINT "http_trigger_step_execution_http_trigger_execution_id_fkey" FOREIGN KEY ("http_trigger_execution_id") REFERENCES "http_trigger_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "http_trigger_step_execution" ADD CONSTRAINT "http_trigger_step_execution_pipeline_step_id_fkey" FOREIGN KEY ("pipeline_step_id") REFERENCES "pipeline_step"("id") ON DELETE CASCADE ON UPDATE CASCADE;
