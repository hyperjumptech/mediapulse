-- Rename stable identifier column (avoids confusion with API key); Prisma field `integrationId` maps here.
ALTER TABLE "domain_integration" RENAME COLUMN "key" TO "integration_id";

ALTER INDEX "domain_integration_key_key" RENAME TO "domain_integration_integration_id_key";
