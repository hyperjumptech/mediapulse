/*
  Warnings:

  - You are about to drop the column `aliases` on the `ticker` table. All the data in the column will be lost.
  - You are about to drop the column `business_activity` on the `ticker` table. All the data in the column will be lost.
  - You are about to drop the column `industry` on the `ticker` table. All the data in the column will be lost.
  - You are about to drop the column `metadata_raw` on the `ticker` table. All the data in the column will be lost.
  - You are about to drop the column `sector` on the `ticker` table. All the data in the column will be lost.
  - You are about to drop the column `sub_industry` on the `ticker` table. All the data in the column will be lost.
  - You are about to drop the column `sub_sector` on the `ticker` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ticker" DROP COLUMN "aliases",
DROP COLUMN "business_activity",
DROP COLUMN "industry",
DROP COLUMN "metadata_raw",
DROP COLUMN "sector",
DROP COLUMN "sub_industry",
DROP COLUMN "sub_sector";
