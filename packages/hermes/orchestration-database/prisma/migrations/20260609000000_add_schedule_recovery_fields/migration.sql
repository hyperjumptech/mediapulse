-- AlterTable
ALTER TABLE "schedule" ADD COLUMN "last_recovered_at" TIMESTAMP(3);
ALTER TABLE "schedule" ADD COLUMN "last_missed_run_count" INTEGER;
