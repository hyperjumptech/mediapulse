-- AlterTable
ALTER TABLE "agent_registry" ALTER COLUMN "domain_integration_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "pipeline" ALTER COLUMN "domain_integration_id" SET NOT NULL;
