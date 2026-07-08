-- AlterTable
ALTER TABLE "ticker_discovery" ADD COLUMN     "customer_segments" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "main_inputs" JSONB NOT NULL DEFAULT '[]';
