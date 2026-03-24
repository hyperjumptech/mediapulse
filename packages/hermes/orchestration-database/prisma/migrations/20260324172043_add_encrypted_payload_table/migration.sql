/*
  Warnings:

  - You are about to drop the column `encrypted_api_key` on the `domain_integration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "domain_integration" DROP COLUMN "encrypted_api_key";

-- CreateTable
CREATE TABLE "encrypted_payload" (
    "id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "domain_integration_id" TEXT,
    "variable_id" TEXT,

    CONSTRAINT "encrypted_payload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "encrypted_payload_domain_integration_id_key" ON "encrypted_payload"("domain_integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "encrypted_payload_variable_id_key" ON "encrypted_payload"("variable_id");

-- AddForeignKey
ALTER TABLE "encrypted_payload" ADD CONSTRAINT "encrypted_payload_domain_integration_id_fkey" FOREIGN KEY ("domain_integration_id") REFERENCES "domain_integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encrypted_payload" ADD CONSTRAINT "encrypted_payload_variable_id_fkey" FOREIGN KEY ("variable_id") REFERENCES "variable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
