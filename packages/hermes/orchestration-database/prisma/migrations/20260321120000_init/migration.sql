-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ScheduleRepeat" AS ENUM ('once', 'repeating');

-- CreateEnum
CREATE TYPE "ScheduleExecutionStatus" AS ENUM ('enqueuing', 'success', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "AgentJobExecutionStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "purpose" TEXT DEFAULT 'general',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_registry" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "description" TEXT,
    "endpoint" JSONB NOT NULL,
    "input_schema" JSONB,
    "config_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "agent_id" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "config_schema_fingerprint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "variable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_integration" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "version" TEXT,
    "capabilities" JSONB DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_pkey" PRIMARY KEY ("id")
);

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
    "schedule_execution_id" TEXT,
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

-- CreateTable
CREATE TABLE "pipeline_step" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "agent_config_id" TEXT,
    "input" JSONB DEFAULT '{}',
    "config" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_step_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_key_key" ON "api_key"("key");

-- CreateIndex
CREATE UNIQUE INDEX "agent_registry_agent_id_agent_version_key" ON "agent_registry"("agent_id", "agent_version");

-- CreateIndex
CREATE UNIQUE INDEX "agent_config_agent_id_agent_version_name_key" ON "agent_config"("agent_id", "agent_version", "name");

-- CreateIndex
CREATE UNIQUE INDEX "variable_key_key" ON "variable"("key");

-- CreateIndex
CREATE UNIQUE INDEX "domain_integration_key_key" ON "domain_integration"("key");

-- CreateIndex
CREATE UNIQUE INDEX "agent_job_execution_job_id_key" ON "agent_job_execution"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_step_pipeline_id_order_key" ON "pipeline_step"("pipeline_id", "order");

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variable" ADD CONSTRAINT "variable_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_execution" ADD CONSTRAINT "schedule_execution_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_job_execution" ADD CONSTRAINT "agent_job_execution_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_job_execution" ADD CONSTRAINT "agent_job_execution_schedule_execution_id_fkey" FOREIGN KEY ("schedule_execution_id") REFERENCES "schedule_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_step" ADD CONSTRAINT "pipeline_step_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_step" ADD CONSTRAINT "pipeline_step_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "agent_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
