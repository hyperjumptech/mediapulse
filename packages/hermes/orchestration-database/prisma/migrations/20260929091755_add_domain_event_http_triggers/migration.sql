-- AlterEnum
ALTER TYPE "HttpTriggerAuthType" ADD VALUE 'DOMAIN_EVENT';

-- AlterTable
ALTER TABLE "http_trigger" ADD COLUMN     "event_name" TEXT,
ALTER COLUMN "token_hash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "http_trigger_event_name_idx" ON "http_trigger"("event_name");
