-- CreateEnum
CREATE TYPE "DomainIntegrationStatus" AS ENUM ('pending', 'active');

-- AlterTable
ALTER TABLE "agent_registry" ADD COLUMN "domain_integration_id" TEXT;

-- AlterTable
ALTER TABLE "domain_integration" ADD COLUMN "api_key_id" TEXT,
ADD COLUMN "encrypted_api_key" TEXT,
ADD COLUMN "status" "DomainIntegrationStatus" NOT NULL DEFAULT 'active',
ALTER COLUMN "base_url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pipeline" ADD COLUMN "domain_integration_id" TEXT;

-- Backfill foreign keys to the primary domain integration (default or oldest).
UPDATE "pipeline"
SET "domain_integration_id" = (
  SELECT "id"
  FROM "domain_integration"
  ORDER BY "is_default" DESC, "created_at" ASC
  LIMIT 1
)
WHERE "domain_integration_id" IS NULL;

UPDATE "agent_registry"
SET "domain_integration_id" = (
  SELECT "id"
  FROM "domain_integration"
  ORDER BY "is_default" DESC, "created_at" ASC
  LIMIT 1
)
WHERE "domain_integration_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "domain_integration_api_key_id_key" ON "domain_integration"("api_key_id");

-- AddForeignKey
ALTER TABLE "agent_registry" ADD CONSTRAINT "agent_registry_domain_integration_id_fkey" FOREIGN KEY ("domain_integration_id") REFERENCES "domain_integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_integration" ADD CONSTRAINT "domain_integration_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_key"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_domain_integration_id_fkey" FOREIGN KEY ("domain_integration_id") REFERENCES "domain_integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
