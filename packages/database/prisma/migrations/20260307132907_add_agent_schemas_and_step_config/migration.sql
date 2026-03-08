-- AlterTable
ALTER TABLE "agent_registry" ADD COLUMN     "config_schema" JSONB,
ADD COLUMN     "input_schema" JSONB;

-- AlterTable
ALTER TABLE "pipeline_step" ADD COLUMN     "config" JSONB DEFAULT '{}';
