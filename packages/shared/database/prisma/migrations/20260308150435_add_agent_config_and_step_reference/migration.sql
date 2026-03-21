-- AlterTable
ALTER TABLE "pipeline_step" ADD COLUMN     "agent_config_id" TEXT;

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

-- CreateIndex
CREATE UNIQUE INDEX "agent_config_agent_id_agent_version_name_key" ON "agent_config"("agent_id", "agent_version", "name");

-- AddForeignKey
ALTER TABLE "pipeline_step" ADD CONSTRAINT "pipeline_step_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "agent_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
