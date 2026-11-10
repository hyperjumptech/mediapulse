/*
  Warnings:

  - You are about to drop the `ticker_profile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ticker_profile" DROP CONSTRAINT "ticker_profile_ticker_id_fkey";

-- DropTable
DROP TABLE "ticker_profile";
