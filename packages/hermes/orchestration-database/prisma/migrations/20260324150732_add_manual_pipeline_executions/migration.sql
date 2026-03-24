-- AlterTable
ALTER TABLE "agent_job_execution" ADD COLUMN     "manual_execution_id" TEXT;

-- CreateTable
CREATE TABLE "manual_pipeline_execution" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
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

    CONSTRAINT "manual_pipeline_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_pipeline_step_execution" (
    "id" TEXT NOT NULL,
    "manual_execution_id" TEXT NOT NULL,
    "pipeline_step_id" TEXT NOT NULL,
    "expected_invocation_count" INTEGER NOT NULL,
    "succeeded_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "rollup_status" "ScheduleStepRollupStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_pipeline_step_execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manual_pipeline_step_execution_manual_execution_id_pipeline_key" ON "manual_pipeline_step_execution"("manual_execution_id", "pipeline_step_id");

-- AddForeignKey
ALTER TABLE "agent_job_execution" ADD CONSTRAINT "agent_job_execution_manual_execution_id_fkey" FOREIGN KEY ("manual_execution_id") REFERENCES "manual_pipeline_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_pipeline_execution" ADD CONSTRAINT "manual_pipeline_execution_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_pipeline_step_execution" ADD CONSTRAINT "manual_pipeline_step_execution_manual_execution_id_fkey" FOREIGN KEY ("manual_execution_id") REFERENCES "manual_pipeline_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_pipeline_step_execution" ADD CONSTRAINT "manual_pipeline_step_execution_pipeline_step_id_fkey" FOREIGN KEY ("pipeline_step_id") REFERENCES "pipeline_step"("id") ON DELETE CASCADE ON UPDATE CASCADE;
