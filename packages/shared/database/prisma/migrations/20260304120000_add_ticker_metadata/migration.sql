-- AlterTable
ALTER TABLE "ticker" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
