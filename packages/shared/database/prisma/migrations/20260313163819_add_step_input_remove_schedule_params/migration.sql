/*
  Warnings:

  - You are about to drop the column `params` on the `schedule` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pipeline_step" ADD COLUMN     "input" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "schedule" DROP COLUMN "params";
