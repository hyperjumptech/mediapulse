-- DropForeignKey
ALTER TABLE "domain_integration" DROP CONSTRAINT "domain_integration_api_key_id_fkey";

-- DropIndex
DROP INDEX "domain_integration_api_key_id_key";

-- AlterTable
ALTER TABLE "domain_integration" DROP COLUMN "api_key_id";

-- DropTable
DROP TABLE "api_key";

-- AlterTable
ALTER TABLE "encrypted_payload" ADD COLUMN "credential_sha256_hex" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "encrypted_payload_credential_sha256_hex_key" ON "encrypted_payload"("credential_sha256_hex");

-- AlterTable
ALTER TABLE "domain_integration" ADD COLUMN "created_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "domain_integration" ADD CONSTRAINT "domain_integration_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
