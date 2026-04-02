/*
  Warnings:

  - Changed the type of `status` on the `delivery_recipient_outcome` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "DeliveryRecipientOutcomeStatus" AS ENUM ('success', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "delivery_recipient_outcome" DROP COLUMN "status",
ADD COLUMN     "status" "DeliveryRecipientOutcomeStatus" NOT NULL;
